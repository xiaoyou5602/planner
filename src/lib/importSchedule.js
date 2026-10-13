import { PICK_HUES } from './palette.js'
import { buildPeriods, fmtMin, toMin } from './time.js'

const asInt = (value, fallback = null) => {
  if (value == null || (typeof value === 'string' && !value.trim())) return fallback
  const n = Number(value)
  return Number.isInteger(n) ? n : fallback
}

const clean = value => String(value ?? '').trim()

function validClock(value) {
  const text = clean(value)
  if (!/^\d{1,2}:\d{2}$/.test(text)) return null
  const [h, m] = text.split(':').map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function normalizeTimeSlots(raw) {
  if (!Array.isArray(raw)) return []
  const slots = raw
    .map(item => ({
      number: asInt(item?.number),
      startTime: validClock(item?.startTime),
      endTime: validClock(item?.endTime),
    }))
    .filter(item => item.number > 0 && item.startTime && item.endTime && toMin(item.endTime) > toMin(item.startTime))
    .sort((a, b) => a.number - b.number)
  return slots.filter((item, i) => !i || item.number !== slots[i - 1].number)
}

function hueFor(name) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return PICK_HUES[hash % PICK_HUES.length]
}

function normalizeWeeks(raw, totalWeeks) {
  const weeks = Array.isArray(raw) ? raw.map(Number) : []
  return [...new Set(weeks.filter(w => Number.isInteger(w) && w >= 1 && w <= totalWeeks))].sort((a, b) => a - b)
}

function inferRule(weeks, totalWeeks) {
  const safe = weeks.length ? weeks : Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const ws = safe[0]
  const we = safe[safe.length - 1]
  const expected = parity => {
    const out = []
    for (let w = ws; w <= we; w++) if (!parity || (parity === 'odd' ? w % 2 : !(w % 2))) out.push(w)
    return out
  }
  const same = values => values.length === safe.length && values.every((w, i) => w === safe[i])
  const parity = same(expected(null)) ? null : same(expected('odd')) ? 'odd' : same(expected('even')) ? 'even' : null
  return { ws, we, parity }
}

function closestSection(periods, minute, preferEnd = false) {
  if (!periods.length) return 1
  let best = 0
  let distance = Infinity
  periods.forEach((period, i) => {
    const point = preferEnd ? period.end : period.start
    const next = Math.abs(point - minute)
    if (next < distance) {
      distance = next
      best = i
    }
  })
  return best + 1
}

function normalizeSlot(raw, periods) {
  const day = asInt(raw?.day)
  if (day < 1 || day > 7) return null
  const customStart = validClock(raw?.customStartTime)
  const customEnd = validClock(raw?.customEndTime)
  if (raw?.isCustomTime && customStart && customEnd && toMin(customEnd) > toMin(customStart)) {
    const start = closestSection(periods, toMin(customStart))
    const end = Math.max(start, closestSection(periods, toMin(customEnd), true))
    return { day: day - 1, start, len: end - start + 1, customStart, customEnd }
  }
  const start = asInt(raw?.startSection)
  const end = asInt(raw?.endSection, start)
  if (!start || start < 1 || !end || end < start) return null
  return { day: day - 1, start, len: end - start + 1 }
}

function slotKey(slot) {
  return [slot.day, slot.start, slot.len, slot.customStart || '', slot.customEnd || ''].join('|')
}

function normalizeCombo(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.publicSchedules)) return null
  const publicSchedules = raw.publicSchedules
    .map(item => ({
      name: clean(item?.name),
      startDate: clean(item?.startDate),
      endDate: clean(item?.endDate),
      defaultClassDuration: asInt(item?.defaultClassDuration, 45),
      defaultBreakDuration: asInt(item?.defaultBreakDuration, 10),
      timeSlots: normalizeTimeSlots(item?.timeSlots),
    }))
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate))
  return publicSchedules.length ? { name: clean(raw.name), publicSchedules } : null
}

/**
 * 把拾光桥接协议的数据变成本 App 的课程模型。这里只做校验和预览，不写存储。
 */
export function prepareShiguangImport(raw, currentSettings, source = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('导入结果为空')
  const config = raw.config && typeof raw.config === 'object' ? raw.config : {}
  const maxWeek = Array.isArray(raw.courses)
    ? Math.max(0, ...raw.courses.flatMap(course => (Array.isArray(course?.weeks) ? course.weeks.map(Number) : [])))
    : 0
  const configuredWeeks = asInt(config.semesterTotalWeeks, currentSettings.totalWeeks || 20)
  const totalWeeks = Math.max(1, Math.min(60, Math.max(configuredWeeks, maxWeek)))
  const timeSlots = normalizeTimeSlots(raw.timeSlots)
  const settingsForPeriods = { ...currentSettings, ...(timeSlots.length ? { timeSlots } : {}) }
  const periods = buildPeriods(settingsForPeriods)
  const grouped = new Map()
  const warnings = []

  for (const [index, item] of (Array.isArray(raw.courses) ? raw.courses : []).entries()) {
    const name = clean(item?.name)
    const weeks = normalizeWeeks(item?.weeks, totalWeeks)
    const slot = normalizeSlot(item, periods)
    if (!name || !slot || !weeks.length) {
      warnings.push(`第 ${index + 1} 条课程缺少名称、周次或时间，已跳过`)
      continue
    }
    const teacher = clean(item.teacher)
    const room = clean(item.position)
    const key = JSON.stringify([name, teacher, room, weeks])
    if (!grouped.has(key)) {
      const rule = inferRule(weeks, totalWeeks)
      grouped.set(key, {
        name,
        teacher,
        room,
        note: '',
        credit: clean(item.credit),
        weeks,
        ...rule,
        hue: hueFor(name),
        slots: [],
        source: {
          type: 'shiguang',
          key: `${source.schoolId || 'tool'}:${source.adapterId || 'unknown'}`,
          school: clean(source.schoolName),
          adapter: clean(source.adapterName),
          maintainer: clean(source.maintainer),
        },
      })
    }
    const course = grouped.get(key)
    if (!course.slots.some(old => slotKey(old) === slotKey(slot))) course.slots.push(slot)
  }

  const courses = [...grouped.values()].filter(course => course.slots.length)
  if (!courses.length) throw new Error(warnings[0] || '没有解析到可导入的课程')

  const settingsPatch = { totalWeeks }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean(config.semesterStartDate))) settingsPatch.startDate = clean(config.semesterStartDate)
  const duration = asInt(config.defaultClassDuration)
  const rest = asInt(config.defaultBreakDuration)
  if (duration >= 1 && duration <= 240) settingsPatch.dur = duration
  if (rest != null && rest >= 0 && rest <= 120) settingsPatch.brk = rest
  if (timeSlots.length) settingsPatch.timeSlots = timeSlots
  const comboSchedule = normalizeCombo(raw.comboSchedule)
  if (comboSchedule) settingsPatch.comboSchedule = comboSchedule

  return {
    courses,
    settingsPatch,
    warnings,
    summary: {
      courses: courses.length,
      meetings: courses.reduce((sum, course) => sum + course.slots.length, 0),
      totalWeeks,
      startDate: settingsPatch.startDate || null,
      timeSlots: timeSlots.length,
      comboSchedules: comboSchedule?.publicSchedules.length || 0,
      clockRange: timeSlots.length ? `${timeSlots[0].startTime}–${timeSlots.at(-1).endTime}` : null,
    },
  }
}

export function importedWeeksText(course) {
  if (!Array.isArray(course?.weeks) || !course.weeks.length) return null
  const weeks = course.weeks
  return `${weeks.length > 12 ? `${weeks.slice(0, 11).join('、')}…` : weeks.join('、')}（共 ${weeks.length} 周）`
}

export function importedClockText(slot) {
  return slot?.customStart && slot?.customEnd ? `${slot.customStart}–${slot.customEnd}` : null
}

export function importSummaryText(summary) {
  const parts = [`${summary.courses} 门课程`, `${summary.meetings} 个上课时间`, `${summary.totalWeeks} 周`]
  if (summary.startDate) parts.push(`开学 ${summary.startDate}`)
  if (summary.timeSlots) parts.push(`${summary.timeSlots} 节作息 ${summary.clockRange}`)
  if (summary.comboSchedules) parts.push(`${summary.comboSchedules} 套分季作息`)
  return parts.join(' · ')
}
