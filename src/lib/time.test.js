import { describe, expect, it } from 'vitest'
import { activeInWeek, buildPeriods, currentWeek, fmtMin, parseISO, periodBreaks, toISO, weekDates } from './time.js'
import { DEFAULT_SETTINGS } from './store.js'

describe('currentWeek', () => {
  it('没设开学日期按第 1 周', () => {
    expect(currentWeek(null, new Date(2026, 9, 10))).toBe(1)
  })
  it('开学当周是第 1 周，下周一进入第 2 周', () => {
    expect(currentWeek('2026-09-07', new Date(2026, 8, 13))).toBe(1)
    expect(currentWeek('2026-09-07', new Date(2026, 8, 14))).toBe(2)
  })
  it('原型里 2026-10-09 是第 5 周', () => {
    expect(currentWeek('2026-09-07', new Date(2026, 9, 9))).toBe(5)
  })
  it('开学日在未来时按第 1 周', () => {
    expect(currentWeek('2027-02-22', new Date(2026, 9, 10))).toBe(1)
  })
  it('开学日不是周一时从那周周一算起', () => {
    // 2026-09-09 是周三，第 1 周仍从 9/7 周一开始
    expect(currentWeek('2026-09-09', new Date(2026, 8, 14))).toBe(2)
  })
})

describe('weekDates', () => {
  it('返回周一到周日', () => {
    const d = weekDates('2026-09-07', 5)
    expect(toISO(d[0])).toBe('2026-10-05')
    expect(toISO(d[6])).toBe('2026-10-11')
  })
  it('没设开学日期时第 1 周就是本周', () => {
    const d = weekDates(null, 1, new Date(2026, 9, 10))
    expect(toISO(d[0])).toBe('2026-10-05')
  })
})

describe('buildPeriods', () => {
  it('默认设置：13 节，下午 14:00、晚上 19:00 开始', () => {
    const ps = buildPeriods(DEFAULT_SETTINGS)
    expect(ps).toHaveLength(13)
    expect(ps.map(p => p.p)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(fmtMin(ps[0].start)).toBe('08:00')
    expect(fmtMin(ps[5].start)).toBe('14:00')
    expect(fmtMin(ps[9].start)).toBe('19:00')
    expect(fmtMin(ps[12].end)).toBe('22:30')
  })
  it('关掉午饭后下午紧接课间', () => {
    const ps = buildPeriods({ ...DEFAULT_SETTINGS, lunchOn: false })
    expect(ps[5].start - ps[4].end).toBe(DEFAULT_SETTINGS.brk)
  })
  it('下午 0 节时晚上接在上午后面', () => {
    const ps = buildPeriods({ ...DEFAULT_SETTINGS, pm: 0 })
    expect(ps).toHaveLength(9)
    expect(ps[5].seg).toBe('eve')
    expect(ps[5].start - ps[4].end).toBe(DEFAULT_SETTINGS.dinnerMin)
  })
  it('教务导入的显式节次优先，并支持按日期切换分季作息', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      timeSlots: [
        { number: 1, startTime: '08:10', endTime: '08:55' },
        { number: 2, startTime: '09:05', endTime: '09:50' },
      ],
      comboSchedule: {
        publicSchedules: [{
          startDate: '2026-10-01', endDate: '2026-10-31',
          timeSlots: [{ number: 1, startTime: '08:30', endTime: '09:15' }],
        }],
      },
    }
    expect(fmtMin(buildPeriods(settings)[0].start)).toBe('08:10')
    expect(fmtMin(buildPeriods(settings, new Date(2026, 9, 11))[0].start)).toBe('08:30')
    expect(fmtMin(buildPeriods(settings, new Date(2026, 10, 1))[0].start)).toBe('08:10')
  })
  it('较短的导入作息按实际节次计算饭点，不读取旧的手动节数下标', () => {
    const periods = buildPeriods({
      ...DEFAULT_SETTINGS,
      timeSlots: [
        { number: 1, startTime: '08:00', endTime: '08:45' },
        { number: 2, startTime: '10:00', endTime: '10:45' },
        { number: 3, startTime: '14:00', endTime: '14:45' },
        { number: 4, startTime: '19:00', endTime: '19:45' },
      ],
    })
    expect(periods).toHaveLength(4)
    expect(periodBreaks(periods)).toEqual({
      lunch: [645, 840],
      dinner: [885, 1140],
    })
  })
})

describe('activeInWeek', () => {
  const c = { ws: 2, we: 10, parity: null }
  it('起止周之外不上', () => {
    expect(activeInWeek(c, 1)).toBe(false)
    expect(activeInWeek(c, 11)).toBe(false)
    expect(activeInWeek(c, 2)).toBe(true)
  })
  it('单双周', () => {
    expect(activeInWeek({ ...c, parity: 'odd' }, 3)).toBe(true)
    expect(activeInWeek({ ...c, parity: 'odd' }, 4)).toBe(false)
    expect(activeInWeek({ ...c, parity: 'even' }, 4)).toBe(true)
  })
  it('导入的不连续周次按明确列表判断', () => {
    expect(activeInWeek({ ...c, weeks: [1, 3, 6] }, 3)).toBe(true)
    expect(activeInWeek({ ...c, weeks: [1, 3, 6] }, 4)).toBe(false)
  })
})

describe('parseISO', () => {
  it('非法输入返回 null', () => {
    expect(parseISO('')).toBe(null)
    expect(parseISO('2026/10/10')).toBe(null)
  })
})
