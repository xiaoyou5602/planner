// 课表与首页用到的纯计算：网格行、课程块位置与并排、今日列表、首页状态。
// 不碰存储和界面，方便单测。
import { WD, activeInWeek, addDays, buildPeriods, currentWeek, fmtMin, toISO, toMin, totalWeeksOf, weekDates, weekdayIdx } from './time.js'

/**
 * 课表网格的行：每节一行（等分高度），两段之间饭点开着时插一条 8px 的分隔行。
 * rowOf[p] 是第 p 节所在的网格行号（从 1 开始）。
 */
export function gridRows(settings, date = null) {
  const periods = buildPeriods(settings, date)
  const rows = []
  const rowOf = {}
  periods.forEach((pd, i) => {
    const prev = periods[i - 1]
    if (prev && prev.seg !== pd.seg) {
      const meal = pd.seg === 'pm' ? 'lunch' : 'dinner'
      if (settings[`${meal}On`]) rows.push({ type: 'meal', meal })
    }
    rows.push({ type: 'p', ...pd })
    rowOf[pd.p] = rows.length
  })
  const template = rows.map(r => (r.type === 'meal' ? '8px' : 'minmax(0,1fr)')).join(' ')
  return { periods, rows, rowOf, template }
}

/** 第 p 节所在的段（上午/下午/晚上）还能往后连几节，用于限制「连上」 */
export function maxLenFrom(periods, p) {
  const seg = periods[p - 1]?.seg
  if (!seg) return 1
  let n = 0
  for (let i = p - 1; i < periods.length && periods[i].seg === seg; i++) n++
  return n
}

/** 把一个时间段的节次裁到当天实际节数内；完全超出时返回 null */
export function clipSlot(slot, total) {
  if (slot.start > total) return null
  return { ...slot, end: Math.min(slot.start + slot.len - 1, total) }
}

export function slotClock(periods, slot) {
  if (slot.customStart && slot.customEnd) return `${slot.customStart}–${slot.customEnd}`
  const s = periods[slot.start - 1]
  const e = periods[Math.min(slot.start + slot.len - 1, periods.length) - 1]
  return s && e ? `${fmtMin(s.start)}–${fmtMin(e.end)}` : '—'
}

export function periodLabel(slot) {
  if (slot.customStart && slot.customEnd) return '自定义时间'
  return slot.len > 1 ? `第 ${slot.start}–${slot.start + slot.len - 1} 节` : `第 ${slot.start} 节`
}

/**
 * 日程按分钟记时间，放进网格时吸附到和它重叠的节次；
 * 落在饭点或课前课后时，吸附到最近的一节，详情里仍显示真实时间。
 */
export function snapEvent(periods, st, et) {
  if (!periods.length) return null
  let i = periods.findIndex(p => p.end > st)
  if (i < 0) i = periods.length - 1
  let j = -1
  periods.forEach((p, k) => {
    if (p.start < et) j = k
  })
  j = Math.max(i, j)
  return { start: i + 1, end: j + 1 }
}

/**
 * 同一天里时间重叠的块并排显示：按开始行排序，重叠的分到不同「车道」。
 * items: [{ day, r1, r2 }]（行号含首尾）→ 原样返回并补上 lane / lanes
 */
export function layoutLanes(items) {
  const out = items.map(x => ({ ...x }))
  for (let d = 0; d < 7; d++) {
    const day = out.filter(x => x.day === d).sort((a, b) => a.r1 - b.r1 || b.r2 - a.r2)
    let cluster = []
    let clusterEnd = -1
    let laneEnds = []
    const flush = () => {
      cluster.forEach(x => (x.lanes = laneEnds.length))
      cluster = []
      laneEnds = []
    }
    day.forEach(x => {
      if (x.r1 > clusterEnd) flush()
      let lane = laneEnds.findIndex(end => end < x.r1)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = x.r2
      x.lane = lane
      cluster.push(x)
      clusterEnd = Math.max(clusterEnd, x.r2)
    })
    flush()
  }
  return out
}

/** 某教学周课表上要画的所有块（课程的每个时间段 + 这周里的日程） */
export function weekBlocks({ courses, events, settings }, week, dates, grid = gridRows(settings, dates[0])) {
  const total = grid.periods.length
  const items = []
  const isoDays = dates.map(toISO)
  courses.forEach(c => {
    if (!activeInWeek(c, week)) return
    c.slots.forEach((sl, si) => {
      const clip = clipSlot(sl, total)
      if (!clip) return
      items.push({ key: `${c.id}#${si}`, kind: 'course', id: c.id, slot: si, day: sl.day, date: isoDays[sl.day], r1: grid.rowOf[clip.start], r2: grid.rowOf[clip.end], name: c.name, room: c.room, hue: c.hue })
    })
  })
  events.forEach(ev => {
    const day = isoDays.indexOf(ev.date)
    if (day < 0) return
    const snap = snapEvent(grid.periods, ev.st, ev.et)
    if (!snap) return
    items.push({ key: ev.id, kind: 'event', id: ev.id, day, r1: grid.rowOf[snap.start], r2: grid.rowOf[snap.end], name: ev.title, room: ev.place })
  })
  return layoutLanes(items)
}

/** 某一天的课程与日程，按开始时间排好。now 给了就标出已上完 / 正在上 / 稍后 */
export function dayItems({ courses, events, settings }, week, date, now = null) {
  const periods = buildPeriods(settings, date)
  const total = periods.length
  const di = weekdayIdx(date)
  const out = []
  courses.forEach(c => {
    if (!activeInWeek(c, week)) return
    c.slots.forEach((sl, si) => {
      if (sl.day !== di) return
      const clip = clipSlot(sl, total)
      if (!clip) return
      const customStart = sl.customStart ? toMin(sl.customStart) : null
      const customEnd = sl.customEnd ? toMin(sl.customEnd) : null
      out.push({
        kind: 'course', id: c.id, slot: si, date: toISO(date), name: c.name, room: c.room, teacher: c.teacher,
        start: customStart ?? periods[clip.start - 1].start,
        end: customEnd ?? periods[clip.end - 1].end,
        periods: periodLabel(sl.customStart ? sl : { start: clip.start, len: clip.end - clip.start + 1 }),
      })
    })
  })
  const iso = toISO(date)
  events.forEach(ev => {
    if (ev.date === iso) out.push({ kind: 'event', id: ev.id, name: ev.title, room: ev.place, start: ev.st, end: ev.et })
  })
  out.sort((a, b) => a.start - b.start || a.end - b.end)
  if (now != null) out.forEach(x => (x.st = x.end < now ? 'done' : x.start > now ? 'later' : 'now'))
  return out
}

export const FREE_TIPS = ['好好休息，做点喜欢的事', '难得清闲，去晒晒太阳吧', '适合随便走走~', '睡个懒觉，也完全可以', '去吃点好吃的吧', '没有课程，自由活动！', '今天的时间，由你安排', '天气不错的话，出去晃晃吧', '可以找个舒服的地方发发呆~', '今天没有课，想去哪就去哪']

// 同一天固定一条，按本地日期轮换
export const freeTip = date => FREE_TIPS[Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5) % FREE_TIPS.length]

export function countdown(mins) {
  return mins >= 60 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分后` : `还有 ${mins} 分钟`
}

/**
 * 首页状态。mode：
 *   empty 还没有任何课程 / next 今天还有课 / done 今天的课上完了 / free 今天没课
 */
export function homeState(state, now = new Date()) {
  const { settings, courses } = state
  const week = currentWeek(settings.startDate, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const all = dayItems(state, week, now, nowMin)
  const list = all.filter(x => x.kind === 'course')
  const next = list.find(x => x.st !== 'done') || null
  const mode = !courses.length ? 'empty' : next ? 'next' : list.length ? 'done' : 'free'
  const mins = next ? next.start - nowMin : 0
  return {
    week,
    mode,
    all,
    count: list.length,
    remain: list.filter(x => x.st !== 'done').length,
    next,
    countdown: next ? (next.st === 'now' ? '正在上课' : countdown(mins)) : '',
    tmr: mode === 'done' || mode === 'free' ? nextDayCourse(state, now) : null,
    freeTip: freeTip(now),
  }
}

/** 今天之后 7 天内最近有课的那天的第一节课 */
export function nextDayCourse(state, now = new Date()) {
  const week = currentWeek(state.settings.startDate, now)
  const ti = weekdayIdx(now)
  for (let k = 1; k <= 7; k++) {
    const date = addDays(now, k)
    const w = week + Math.floor((ti + k) / 7)
    if (w > totalWeeksOf(state.settings)) break
    const first = dayItems({ ...state, events: [] }, w, date)[0]
    if (first) return { ...first, label: k === 1 ? '明天' : `周${WD[weekdayIdx(date)]}` }
  }
  return null
}

export function weeksHint(ws, we, parity) {
  const wk = []
  for (let w = ws; w <= we; w++) if (activeInWeek({ ws, we, parity }, w)) wk.push(w)
  const rule = parity === 'odd' ? '只在单数周上' : parity === 'even' ? '只在双数周上' : '范围内每周都上'
  return `${rule}，共 ${wk.length} 周：${wk.length > 10 ? `${wk.slice(0, 9).join('、')}…` : wk.join('、') || '无'}`
}

export function courseWeeksText(course) {
  if (Array.isArray(course.weeks) && course.weeks.length) {
    const weeks = course.weeks
    return `${weeks.length > 12 ? `${weeks.slice(0, 11).join('、')}…` : weeks.join('、')}（共 ${weeks.length} 周）`
  }
  return `第 ${course.ws}–${course.we} 周${course.parity === 'even' ? ' · 双周' : course.parity === 'odd' ? ' · 单周' : ''}`
}

/** 课表顶部的日期范围文字，如「10月5日 – 11日」「9月28日 – 10月4日」 */
export function rangeText(days) {
  const mon = days[0]
  const sun = days[6]
  return `${mon.getMonth() + 1}月${mon.getDate()}日 – ${sun.getMonth() !== mon.getMonth() ? `${sun.getMonth() + 1}月` : ''}${sun.getDate()}日`
}

/** 日程落在哪天：所看那一周的周一 + 星期几 */
export function eventDate(startISO, week, day, today = new Date()) {
  return toISO(weekDates(startISO, week, today)[day])
}
