import { describe, expect, it } from 'vitest'
import { courseColors, pickFreeHue } from './palette.js'
import { dayItems, eventDate, gridRows, homeState, layoutLanes, maxLenFrom, nextDayCourse, rangeText, slotClock, snapEvent, weekBlocks, weeksHint } from './schedule.js'
import { DEFAULT_SETTINGS, emptyState } from './store.js'
import { buildPeriods, weekDates } from './time.js'

const S = DEFAULT_SETTINGS
const periods = buildPeriods(S)

// 开学 2026-09-07（周一）；2026-10-09 周五是第 5 周
const START = '2026-09-07'
const at = (d, hh, mm = 0) => new Date(2026, 9, d, hh, mm)
const course = (over = {}) => ({ id: 'c1', name: '高数', room: '教三 201', teacher: '王老师', note: '', ws: 1, we: 16, parity: null, hue: 255, slots: [{ day: 4, start: 1, len: 2 }], ...over })
const withData = (over = {}) => ({ ...emptyState(), settings: { ...S, startDate: START }, ...over })

describe('gridRows', () => {
  it('默认 13 节 + 午饭、晚饭两条分隔行', () => {
    const g = gridRows(S)
    expect(g.rows).toHaveLength(15)
    expect(g.rows.filter(r => r.type === 'meal').map(r => r.meal)).toEqual(['lunch', 'dinner'])
    expect(g.rowOf[5]).toBe(5)
    expect(g.rowOf[6]).toBe(7) // 午饭行占第 6 行
    expect(g.rowOf[10]).toBe(12) // 晚饭行占第 11 行
    expect(g.template.split(' ').filter(x => x === '8px')).toHaveLength(2)
  })
  it('关掉午饭就没有午饭分隔行', () => {
    const g = gridRows({ ...S, lunchOn: false })
    expect(g.rows.filter(r => r.type === 'meal').map(r => r.meal)).toEqual(['dinner'])
    expect(g.rowOf[6]).toBe(6)
  })
})

describe('节次工具', () => {
  it('连上节数不跨段', () => {
    expect(maxLenFrom(periods, 1)).toBe(5)
    expect(maxLenFrom(periods, 4)).toBe(2)
    expect(maxLenFrom(periods, 6)).toBe(4)
  })
  it('时间段的起止时间', () => {
    expect(slotClock(periods, { start: 1, len: 2 })).toBe('08:00–09:40')
    expect(slotClock(periods, { start: 10, len: 4 })).toBe('19:00–22:30')
    expect(slotClock(periods, { start: 20, len: 1 })).toBe('—')
  })
})

describe('snapEvent', () => {
  it('和节次重叠时吸附到重叠的那几节', () => {
    expect(snapEvent(periods, 8 * 60 + 30, 10 * 60 + 20)).toEqual({ start: 1, end: 3 })
  })
  it('落在午饭时吸附到下午第一节', () => {
    expect(snapEvent(periods, 12 * 60 + 50, 13 * 60 + 30)).toEqual({ start: 6, end: 6 })
  })
  it('比最后一节还晚时吸附到最后一节', () => {
    expect(snapEvent(periods, 23 * 60, 23 * 60 + 30)).toEqual({ start: 13, end: 13 })
  })
})

describe('layoutLanes', () => {
  it('不重叠的块各占整列', () => {
    const out = layoutLanes([{ day: 0, r1: 1, r2: 2 }, { day: 0, r1: 3, r2: 4 }])
    expect(out.map(x => [x.lane, x.lanes])).toEqual([[0, 1], [0, 1]])
  })
  it('重叠的块并排，后面不重叠的恢复整列', () => {
    const out = layoutLanes([
      { day: 1, r1: 1, r2: 3 },
      { day: 1, r1: 2, r2: 2 },
      { day: 1, r1: 5, r2: 6 },
      { day: 2, r1: 1, r2: 3 },
    ])
    expect(out.map(x => [x.lane, x.lanes])).toEqual([[0, 2], [1, 2], [0, 1], [0, 1]])
  })
})

describe('weekBlocks', () => {
  const st = withData({
    courses: [course({ slots: [{ day: 0, start: 1, len: 2 }, { day: 2, start: 6, len: 2 }] }), course({ id: 'c2', ws: 6, we: 8 })],
    events: [{ id: 'e1', title: '社团', date: '2026-10-07', st: 1140, et: 1200, place: '', remind: 0 }],
  })
  it('一门课的多个时间段都画出来；不在本周上的课不画；本周的日程也画', () => {
    const days = weekDates(START, 5)
    const b = weekBlocks(st, 5, days)
    expect(b.map(x => x.key).sort()).toEqual(['c1#0', 'c1#1', 'e1'])
    const slot2 = b.find(x => x.key === 'c1#1')
    expect([slot2.day, slot2.r1, slot2.r2]).toEqual([2, 7, 8])
    const ev = b.find(x => x.key === 'e1')
    expect(ev.day).toBe(2)
  })
  it('节数调少后，超出的时间段不画', () => {
    const s2 = { ...st, settings: { ...st.settings, eve: 0, pm: 0 } }
    const b = weekBlocks(s2, 5, weekDates(START, 5))
    expect(b.map(x => x.key)).not.toContain('c1#1')
  })
})

describe('homeState', () => {
  it('没有任何课程是 empty', () => {
    expect(homeState(withData(), at(9, 10)).mode).toBe('empty')
  })
  it('今天还有课：next + 倒计时', () => {
    const st = withData({ courses: [course({ slots: [{ day: 4, start: 6, len: 2 }] })] })
    const h = homeState(st, at(9, 13, 22))
    expect(h.week).toBe(5)
    expect(h.mode).toBe('next')
    expect(h.next.name).toBe('高数')
    expect(h.countdown).toBe('还有 38 分钟')
    expect(h.next.periods).toBe('第 6–7 节')
  })
  it('正在上课时显示正在上课', () => {
    const st = withData({ courses: [course()] })
    expect(homeState(st, at(9, 8, 30)).countdown).toBe('正在上课')
  })
  it('超过一小时显示小时和分钟', () => {
    const st = withData({ courses: [course({ slots: [{ day: 4, start: 10, len: 2 }] })] })
    expect(homeState(st, at(9, 13, 22)).countdown).toBe('5 小时 38 分后')
  })
  it('今天的课都上完是 done，并给出下一个有课的日子', () => {
    const st = withData({ courses: [course({ slots: [{ day: 4, start: 1, len: 2 }, { day: 0, start: 3, len: 2 }] })] })
    const h = homeState(st, at(9, 22))
    expect(h.mode).toBe('done')
    expect(h.count).toBe(1)
    expect(h.remain).toBe(0)
    expect(h.tmr.label).toBe('周一')
    expect(h.tmr.start).toBe(9 * 60 + 50) // 第 3 节按默认设置是 09:50
  })
  it('今天没课是 free，文案同一天固定', () => {
    const st = withData({ courses: [course({ slots: [{ day: 5, start: 1, len: 2 }] })] })
    const h = homeState(st, at(9, 10))
    expect(h.mode).toBe('free')
    expect(h.tmr.label).toBe('明天')
    expect(homeState(st, at(9, 23)).freeTip).toBe(h.freeTip)
    expect(homeState(st, at(10, 10)).freeTip).not.toBe(h.freeTip)
  })
  it('今天的日程进列表，但不算进课程节数', () => {
    const st = withData({ courses: [course()], events: [{ id: 'e1', title: '社团', date: '2026-10-09', st: 1140, et: 1200, place: '', remind: 0 }] })
    const h = homeState(st, at(9, 7))
    expect(h.all.map(x => x.name)).toEqual(['高数', '社团'])
    expect(h.count).toBe(1)
  })
})

describe('nextDayCourse', () => {
  it('跨周时用下一周的周次判断（单双周）', () => {
    // 第 5 周周五；只在双周周一上的课 → 下周一（第 6 周）有
    const st = withData({ courses: [course({ parity: 'even', slots: [{ day: 0, start: 1, len: 2 }] })] })
    expect(nextDayCourse(st, at(9, 10)).label).toBe('周一')
  })
  it('7 天内都没课返回 null', () => {
    const st = withData({ courses: [course({ ws: 1, we: 2 })] })
    expect(nextDayCourse(st, at(9, 10))).toBe(null)
  })
})

describe('dayItems', () => {
  it('课程按开始时间排序', () => {
    const st = withData({ courses: [course({ id: 'b', name: '下午课', slots: [{ day: 4, start: 6, len: 1 }] }), course({ id: 'a', name: '早课' })] })
    expect(dayItems(st, 5, at(9, 0)).map(x => x.name)).toEqual(['早课', '下午课'])
  })
})

describe('其它文字', () => {
  it('周次提示', () => {
    expect(weeksHint(1, 4, null)).toBe('范围内每周都上，共 4 周：1、2、3、4')
    expect(weeksHint(1, 8, 'odd')).toBe('只在单数周上，共 4 周：1、3、5、7')
    expect(weeksHint(1, 16, null)).toBe('范围内每周都上，共 16 周：1、2、3、4、5、6、7、8、9…')
  })
  it('日期范围跨月时写出月份', () => {
    expect(rangeText(weekDates(START, 4))).toBe('9月28日 – 10月4日')
    expect(rangeText(weekDates(START, 5))).toBe('10月5日 – 11日')
  })
  it('日程落在所看那一周的那一天', () => {
    expect(eventDate(START, 5, 2)).toBe('2026-10-07')
  })
})

describe('palette', () => {
  it('默认奶油色卡', () => {
    expect(courseColors({ current: 'soft', custom: {} }, 255)).toEqual({ bg: 'oklch(0.93 0.035 255)', bd: 'oklch(0.74 0.06 255)' })
  })
  it('找不到色卡时退回奶油', () => {
    expect(courseColors({ current: 'nope', custom: {} }, 155).bg).toBe('oklch(0.93 0.035 155)')
  })
  it('导入的 HEX 色卡按色相分配', () => {
    const pal = { current: 'u1', custom: { u1: { label: 'x', list: ['#AAAAAA', '#BBBBBB'] } } }
    expect(courseColors(pal, 255).bg).toBe('#AAAAAA')
    expect(courseColors(pal, 155).bg).toBe('#BBBBBB')
  })
  it('新课程挑用得最少的颜色', () => {
    expect(pickFreeHue([])).toBe(255)
    expect(pickFreeHue([{ hue: 255 }, { hue: 155 }])).toBe(25)
  })
})
