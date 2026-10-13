import { buildPeriods } from './time.js'
import { pickFreeHue } from './palette.js'

const normalize = text => String(text ?? '').normalize('NFKC').replace(/[−–—～~]/g, '-').replace(/：/g, ':').trim()
const weekdays = '一二三四五六日'

// A usable box: finite, inside the page (0..1), non-empty.
export function validPdfRect(rect) {
  if (!rect || !['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(rect[key]))) return false
  return rect.left >= 0 && rect.top >= 0 && rect.right <= 1 && rect.bottom <= 1 && rect.right > rect.left && rect.bottom > rect.top
}

export function parsePdfWeeks(value) {
  const text = normalize(value).replace(/\s/g, '').replace(/、|，/g, ',')
  if (!text) return []
  const weeks = new Set()
  for (const raw of text.split(',')) {
    const part = raw.replace(/周/g, '').replace(/[()]/g, '')
    const match = /^(\d{1,2})(?:-(\d{1,2}))?([单双])?$/.exec(part)
    if (!match) return []
    const start = Number(match[1]), end = Number(match[2] || match[1])
    if (start < 1 || end < start || end > 60) return []
    for (let n = start; n <= end; n++) if (!match[3] || (match[3] === '单' ? n % 2 : n % 2 === 0)) weeks.add(n)
  }
  return [...weeks].sort((a, b) => a - b)
}

// A text segment may have several line rectangles. Split only when line counts match.
function positionedLines(page) {
  return page.blocks.flatMap(block => {
    const text = normalize(block.text)
    if (!text) return []
    const lines = text.split(/\r?\n/).map(normalize).filter(Boolean)
    const rects = (block.rects || []).filter(validPdfRect)
    const source = { pageIndex: page.pageIndex, blockId: block.id }
    if (lines.length === rects.length) return lines.map((text, i) => ({ text, rects: [rects[i]], source }))
    return [{ text, rects, source }]
  })
}

function headerOf(lines) {
  const headers = lines.map(line => {
    const match = /^(?:星期|周)([一二三四五六日天])$/.exec(line.text.replace(/\s/g, ''))
    if (!match || line.rects.length !== 1) return null
    const rect = line.rects[0]
    return { day: match[1] === '天' ? 6 : weekdays.indexOf(match[1]), x: (rect.left + rect.right) / 2, bottom: rect.bottom, top: rect.top }
  }).filter(Boolean)
  if (headers.length !== 7 || new Set(headers.map(h => h.day)).size !== 7) return null
  headers.sort((a, b) => a.x - b.x)
  if (Math.max(...headers.map(h => h.top)) - Math.min(...headers.map(h => h.top)) > 0.03) return null
  const gaps = headers.slice(1).map((h, i) => h.x - headers[i].x)
  if (Math.min(...gaps) <= 0.03 || Math.max(...gaps) / Math.min(...gaps) > 1.4) return null
  return { columns: headers.map((h, i) => ({ day: h.day, left: i ? (headers[i - 1].x + h.x) / 2 : h.x - gaps[0] / 2, right: i < 6 ? (h.x + headers[i + 1].x) / 2 : h.x + gaps[5] / 2 })), bottom: Math.max(...headers.map(h => h.bottom)) }
}

const isMetadata = text => /(?:场地|教师|教学班|课程性质|考核|学时|学分|选课|备注)\s*:|^[/\d,\s-]+$/.test(text)

/** School-style timetable with explicit (start-end节) and weeks. Unknown layouts stay reviewable. */
export function recognizePdfCourses(pages) {
  const ordered = [...pages].sort((a, b) => a.pageIndex - b.pageIndex)
  const pending = [], candidates = [], warnings = []
  let layout = null, previous = null, group = 0
  const columns = new Map()
  let inherited = false
  for (const page of ordered) {
    if (previous != null && page.pageIndex !== previous + 1) { layout = null; group++ }
    previous = page.pageIndex
    const lines = positionedLines(page)
    const header = headerOf(lines)
    if (header) {
      layout = { ...header, ratio: page.widthPt / page.heightPt }
      group++ // A new explicit header starts a separate table; no implicit course joining.
    } else if (layout && Math.abs(page.widthPt / page.heightPt - layout.ratio) < 0.015) {
      inherited = true
      warnings.push(`第 ${page.pageIndex + 1} 页无星期表头，暂沿用前页列位置，请核对。`)
    } else { layout = null; group++ }
    const other = lines.filter(line => line.text.includes('其他课程'))
    const footerTop = other.flatMap(line => line.rects.map(rect => rect.top))
    const footer = footerTop.length ? Math.min(...footerTop) : 1
    for (const line of lines) {
      const source = { ...line.source, rects: line.rects }
      if (line.text.includes('其他课程')) {
        pending.push({ name: '其他课程（未排定时间）', rawText: line.text, source: [source], reason: '没有明确星期和节次，请补全后导入' })
        continue
      }
      if (line.rects.length && (Math.min(...line.rects.map(r => r.top)) >= footer || (header && Math.max(...line.rects.map(r => r.bottom)) <= header.bottom + 0.002))) continue
      if (!layout || !line.rects.length) {
        pending.push({ name: '未定位文字', rawText: line.text, source: [source], reason: '未确定星期列；可手动填写排课' })
        continue
      }
      const owners = line.rects.map(rect => layout.columns.find(col => (rect.left + rect.right) / 2 >= col.left && (rect.left + rect.right) / 2 < col.right && rect.left >= col.left - 0.015 && rect.right <= col.right + 0.015)?.day)
      if (owners.some(day => day == null) || new Set(owners).size !== 1) {
        if (line.text.length > 8) pending.push({ name: '未定位文字', rawText: line.text, source: [source], reason: '文字位置跨列或在课表外，请核对' })
        continue
      }
      const day = owners[0], key = `${group}:${day}`
      if (!columns.has(key)) columns.set(key, { day, lines: [] })
      const y = Math.min(...line.rects.map(r => r.top)), x = Math.min(...line.rects.map(r => r.left))
      columns.get(key).lines.push({ ...line, source, y, x })
    }
  }
  for (const column of columns.values()) {
    const lines = column.lines.sort((a, b) => a.source.pageIndex - b.source.pageIndex || a.y - b.y || a.x - b.x)
      .flatMap(line => line.text.split('\n').map(text => ({ ...line, text })))
    const text = lines.map(line => line.text).join('\n')
    const offsets = []; let offset = 0
    for (const line of lines) { offsets.push(offset); offset += line.text.length + 1 }
    const starts = [...text.matchAll(/\(\s*(\d{1,2})\s*(?:-\s*(\d{1,2})\s*)?节\s*\)/g)].map(match => {
      let timingLine = offsets.findLastIndex(start => start <= match.index)
      const prefix = text.slice(offsets[timingLine], match.index).trim()
      let nameLine = timingLine, name = prefix
      if (!name && timingLine > 0 && !isMetadata(lines[timingLine - 1].text)) {
        nameLine = timingLine - 1
        name = lines[nameLine].text
        if (/^[)）]+$/.test(name) && nameLine > 0) name = lines[--nameLine].text + name
      }
      return { match, name: name.replace(/\s/g, ''), nameLine, timingLine }
    })
    if (!starts.length && text.trim()) pending.push({ name: '未识别的课程片段', rawText: text, source: lines.map(line => line.source), reason: '没有明确节次；请补全排课' })
    for (let i = 0; i < starts.length; i++) {
      const item = starts[i], next = starts[i + 1]
      const end = next ? offsets[next.nameLine] : text.length
      const rawText = text.slice(offsets[item.nameLine], end)
      const body = text.slice(item.match.index + item.match[0].length, end).replace(/\s/g, '')
      const weekMatch = /^([^/]*周(?:\([单双]\))?)/.exec(body)
      const weeksText = weekMatch?.[1] || ''
      const field = label => new RegExp(`/${label}:(.*?)(?=/[^/:]{1,14}:|$)`).exec(body)?.[1] || ''
      const record = { name: item.name, day: column.day, start: Number(item.match[1]), end: Number(item.match[2] || item.match[1]), weeksText, room: field('场地'), teacher: field('教师'), rawText, source: lines.slice(item.nameLine, next?.nameLine ?? lines.length).map(line => line.source) }
      candidates.push(record)
    }
  }
  return { candidates, pending, warnings, inherited }
}

export function validatePdfCandidate(item, settings) {
  const reasons = []
  const weeks = parsePdfWeeks(item.weeksText)
  const start = Number(item.start), end = Number(item.end), day = Number(item.day)
  if (!String(item.name || '').trim()) reasons.push('缺课程名')
  if (item.day === '' || item.day == null || !Number.isInteger(day) || day < 0 || day > 6) reasons.push('缺星期')
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start) reasons.push('节次不完整')
  else if (end > buildPeriods(settings).length) reasons.push('超出当前作息节数，请修改排课或上课时间设置')
  if (!weeks.length) reasons.push('缺少有效周次')
  else if (weeks.at(-1) > settings.totalWeeks) reasons.push('超出当前学期周数，请核对设置')
  return { reasons, weeks }
}

export function pdfCandidateCourse(item, settings, sha256) {
  const { reasons, weeks } = validatePdfCandidate(item, settings)
  if (reasons.length) throw new Error(reasons.join('；'))
  return { name: item.name.trim(), room: (item.room || '').trim(), teacher: (item.teacher || '').trim(), weeks, ws: weeks[0], we: weeks.at(-1), parity: null, hue: null, note: '', slots: [{ day: Number(item.day), start: Number(item.start), len: Number(item.end) - Number(item.start) + 1 }], source: { type: 'pdf', sha256, pages: [...new Set((item.source || []).map(s => s.pageIndex))] } }
}

// Compare exact weekly occurrences, independent of file names, slot grouping or source keys.
export function mergePdfCourses(existing, incoming) {
  const known = new Set(), added = []
  const key = (course, slot, week) => JSON.stringify([course.name?.trim(), course.teacher?.trim() || '', course.room?.trim() || '', slot.day, slot.start, slot.len, slot.customStart || '', slot.customEnd || '', week])
  for (const course of existing) {
    const weeks = course.weeks?.length ? course.weeks : Array.from({ length: Math.max(0, Math.min(60, course.we || 0) - (course.ws || 1) + 1) }, (_, i) => i + (course.ws || 1)).filter(w => !course.parity || (course.parity === 'odd' ? w % 2 : w % 2 === 0))
    for (const slot of course.slots || []) for (const week of weeks) known.add(key(course, slot, week))
  }
  for (const course of incoming) for (const slot of course.slots) {
    const weeks = course.weeks.filter(week => !known.has(key(course, slot, week)))
    if (!weeks.length) continue
    for (const week of weeks) known.add(key(course, slot, week))
    added.push({ ...course, slots: [slot], weeks, ws: weeks[0], we: weeks.at(-1), parity: null })
  }
  // One course card per name/teacher/room/exact weeks; its meetings become sorted slots.
  const grouped = new Map()
  for (const course of added) {
    const id = JSON.stringify([course.name, course.teacher, course.room, course.weeks])
    const known = grouped.get(id)
    if (!known) { grouped.set(id, { ...course, slots: [...course.slots] }); continue }
    known.slots.push(...course.slots)
    known.source = { ...known.source, pages: [...new Set([...(known.source?.pages || []), ...(course.source?.pages || [])])].sort((a, b) => a - b) }
  }
  // Same name keeps its existing colour; a new name takes the least used one.
  const hues = new Map(existing.filter(course => course.name && course.hue != null).map(course => [course.name.trim(), course.hue]))
  const pool = [...existing]
  return [...grouped.values()].map(course => {
    if (!hues.has(course.name)) hues.set(course.name, pickFreeHue(pool))
    const result = { ...course, hue: hues.get(course.name), slots: course.slots.sort((a, b) => a.day - b.day || a.start - b.start) }
    pool.push(result)
    return result
  })
}

/**
 * Splits an editable draft into importable courses and items still missing fields.
 * Counts are per weekly meeting (one slot), compared against what is already saved.
 */
export function summarizePdfDraft(items, settings, existing, sha256) {
  const ready = [], fixes = []
  for (const item of items) {
    const { reasons } = validatePdfCandidate(item, settings)
    if (reasons.length) fixes.push({ item, reasons })
    else ready.push(item)
  }
  const courses = ready.map(item => pdfCandidateCourse(item, settings, sha256))
  const fresh = mergePdfCourses(existing, courses)
  const meetings = courses.reduce((sum, course) => sum + course.slots.length, 0)
  const freshMeetings = fresh.reduce((sum, course) => sum + course.slots.length, 0)
  return {
    courses,
    fixes,
    names: new Set(fresh.map(course => course.name)).size,
    meetings,
    freshMeetings,
    // A meeting already present in some week still adds the missing weeks, so it is not "duplicate".
    duplicateMeetings: Math.max(0, meetings - freshMeetings),
  }
}
