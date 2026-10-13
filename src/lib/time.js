// 日期、教学周、节次时间的纯计算。不碰存储和界面，方便单测。

export const DAY_MS = 864e5
export const TOTAL_WEEKS = 20
export const WD = ['一', '二', '三', '四', '五', '六', '日']
export const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const WD_EN = ['Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.', 'Sun.']
export const MON_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 第一节课默认 8:00 开始（分钟数）
export const DAY_START = 480

const pad = n => String(n).padStart(2, '0')

export const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 周一为 0，周日为 6
export const weekdayIdx = d => (d.getDay() + 6) % 7

export const mondayOf = d => addDays(startOfDay(d), -weekdayIdx(d))

const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)

/**
 * 今天是第几教学周。没设开学日期、或开学日在未来，都按第 1 周算。
 * 开学日不是周一时，第 1 周从那一周的周一算起。
 */
export function currentWeek(startISO, today = new Date()) {
  const start = parseISO(startISO)
  if (!start) return 1
  const diff = daysBetween(mondayOf(start), today)
  return Math.max(1, Math.floor(diff / 7) + 1)
}

// 某教学周的周一到周日。没设开学日期时，第 1 周就是本周。
export function weekDates(startISO, week, today = new Date()) {
  const start = parseISO(startISO)
  const base = start ? mondayOf(start) : addDays(mondayOf(today), -(currentWeek(startISO, today) - 1) * 7)
  const mon = addDays(base, (week - 1) * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export function fmtMin(m) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * 按「上课时间」设置算出每一节的起止时间。节次编号全天连续。
 * 午饭 / 晚饭关闭时，两段之间按普通课间衔接。
 */
function explicitPeriods(s, date) {
  const base = (Array.isArray(s.timeSlots) ? s.timeSlots : []).filter(item => /^\d{1,2}:\d{2}$/.test(item?.startTime) && /^\d{1,2}:\d{2}$/.test(item?.endTime))
  if (!base.length) return null
  const iso = date instanceof Date ? toISO(date) : typeof date === 'string' ? date : null
  const seasonal = iso && s.comboSchedule?.publicSchedules?.find(item => item.startDate <= iso && iso <= item.endDate)
  const overrides = new Map((seasonal?.timeSlots || []).map(item => [Number(item.number), item]))
  return base.map((item, i) => {
    const value = { ...item, ...(overrides.get(Number(item.number)) || {}) }
    const start = toMin(value.startTime)
    const end = toMin(value.endTime)
    const seg = start < 12 * 60 ? 'am' : start < 18 * 60 ? 'pm' : 'eve'
    return { p: i + 1, seg, start, end }
  })
}

export function buildPeriods(s, date = null) {
  const imported = explicitPeriods(s, date)
  if (imported) return imported
  const span = cnt => cnt * s.dur + Math.max(0, cnt - 1) * s.brk
  const amStart = DAY_START
  const amEnd = amStart + span(s.am)
  const pmStart = s.am ? amEnd + (s.lunchOn ? s.lunchMin : s.brk) : DAY_START
  const pmEnd = pmStart + span(s.pm)
  const eveStart = s.pm || s.am ? (s.pm ? pmEnd : amEnd) + (s.dinnerOn ? s.dinnerMin : s.brk) : DAY_START

  const out = []
  const seg = (name, start, cnt) => {
    for (let i = 0; i < cnt; i++) {
      const st = start + i * (s.dur + s.brk)
      out.push({ p: out.length + 1, seg: name, start: st, end: st + s.dur })
    }
  }
  seg('am', amStart, s.am)
  seg('pm', pmStart, s.pm)
  seg('eve', eveStart, s.eve)
  return out
}

/**
 * 从实际生成的节次里找午饭、晚饭两侧的时间。
 * 导入作息的节数和手动设置可能不同，不能再用 s.am 之类的旧下标取值。
 */
export function periodBreaks(periods) {
  const last = seg => [...periods].reverse().find(period => period.seg === seg)
  const first = seg => periods.find(period => period.seg === seg)
  const amLast = last('am')
  const pmFirst = first('pm')
  const pmLast = last('pm')
  const eveFirst = first('eve')
  const dinnerFrom = pmLast?.end ?? amLast?.end ?? null
  return {
    lunch: amLast && pmFirst ? [amLast.end, pmFirst.start] : null,
    dinner: dinnerFrom != null && eveFirst ? [dinnerFrom, eveFirst.start] : null,
  }
}

// 课程在某教学周是否上课（起止周 + 单双周）
export function activeInWeek(c, week) {
  if (Array.isArray(c.weeks) && c.weeks.length) return c.weeks.includes(week)
  if (week < c.ws || week > c.we) return false
  if (c.parity === 'odd') return week % 2 === 1
  if (c.parity === 'even') return week % 2 === 0
  return true
}

export function totalWeeksOf(settings) {
  const value = Number(settings?.totalWeeks)
  return Number.isInteger(value) && value >= 1 ? value : TOTAL_WEEKS
}
