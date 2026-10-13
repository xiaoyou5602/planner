import { describe, expect, it } from 'vitest'
import { mergePdfCourses, parsePdfWeeks, pdfCandidateCourse, recognizePdfCourses, summarizePdfDraft, validatePdfCandidate, validPdfRect } from './pdfCourses.js'
import { DEFAULT_SETTINGS } from './store.js'

// 合成的“横向星期、纵向节次”课表：列中心 0.16 起，每列宽 0.12
const center = day => 0.16 + 0.12 * day
const line = (id, text, day, top) => ({ id, text, rects: [{ left: center(day) - 0.05, top, right: center(day) + 0.05, bottom: top + 0.015 }] })
const header = '一二三四五六日'.split('').map((d, i) => ({ id: `h${i}`, text: `星期${d}`, rects: [{ left: center(i) - 0.02, top: 0.1, right: center(i) + 0.02, bottom: 0.12 }] }))
const page = (pageIndex, blocks, widthPt = 842) => ({ pageIndex, widthPt, heightPt: 595, blocks })

const firstPage = page(0, [
  { id: 't', text: '2026-2027学年第1学期', rects: [{ left: 0.02, top: 0.05, right: 0.12, bottom: 0.07 }] },
  ...header,
  line('a1', '高等数学', 0, 0.2),
  line('a2', '(1-2节)1-4周,7-10周/场地:A楼/101/教师:张三', 0, 0.22),
  line('b1', '大学英语', 0, 0.3),
  line('b2', '(3-4节)1-16周(单)/场地:B楼/', 0, 0.32),
  line('c1', '线性代数', 2, 0.2),
  line('c2', '(5节)3周', 2, 0.22),
  { id: 'f', text: '其他课程:创新创业 未排定', rects: [{ left: 0.05, top: 0.9, right: 0.6, bottom: 0.92 }] },
])
// 续页没有星期表头：英语的教室接在这页开头，后面还有一门新课
const secondPage = page(1, [
  line('d1', '201/教师:李四', 0, 0.05),
  line('e1', '体育', 0, 0.1),
  line('e2', '(7-8节)2-8周(双)/教师:王五', 0, 0.12),
])

const rows = result => result.candidates
  .map(c => [c.name, c.day, c.start, c.end, parsePdfWeeks(c.weeksText), c.teacher, c.room])
  .sort((a, b) => a[1] - b[1] || a[2] - b[2])

describe('parsePdfWeeks', () => {
  it('不连续周次保持精确，不按最小最大展开', () => {
    expect(parsePdfWeeks('1-4周,7-10周')).toEqual([1, 2, 3, 4, 7, 8, 9, 10])
    expect(parsePdfWeeks('1、3、5、8周')).toEqual([1, 3, 5, 8])
  })
  it('单双周按各自范围筛选', () => {
    expect(parsePdfWeeks('1-8周(单),10-16周(双)')).toEqual([1, 3, 5, 7, 10, 12, 14, 16])
  })
  it('看不懂的写法返回空，不猜', () => {
    expect(parsePdfWeeks('')).toEqual([])
    expect(parsePdfWeeks('全学期')).toEqual([])
    expect(parsePdfWeeks('10-3周')).toEqual([])
  })
})

describe('recognizePdfCourses', () => {
  it('按星期列逐条识别，并接上跨页内容', () => {
    const result = recognizePdfCourses([secondPage, firstPage]) // 传入顺序打乱也按页码处理
    expect(rows(result)).toEqual([
      ['高等数学', 0, 1, 2, [1, 2, 3, 4, 7, 8, 9, 10], '张三', 'A楼/101'],
      ['大学英语', 0, 3, 4, [1, 3, 5, 7, 9, 11, 13, 15], '李四', 'B楼/201'],
      ['体育', 0, 7, 8, [2, 4, 6, 8], '王五', ''],
      ['线性代数', 2, 5, 5, [3], '', ''],
    ])
    expect(result.inherited).toBe(true)
    const english = result.candidates.find(c => c.name === '大学英语')
    expect([...new Set(english.source.map(s => s.pageIndex))]).toEqual([0, 1])
  })

  it('页脚的未排定课程单独列出，不进课表', () => {
    const result = recognizePdfCourses([firstPage, secondPage])
    expect(result.candidates.some(c => c.name.includes('创新创业'))).toBe(false)
    expect(result.pending.some(p => p.rawText.includes('创新创业'))).toBe(true)
  })

  it('中间缺页时不继承前页列位置', () => {
    const result = recognizePdfCourses([firstPage, { ...secondPage, pageIndex: 2 }])
    expect(result.inherited).toBe(false)
    expect(result.candidates.some(c => c.name === '体育')).toBe(false)
  })

  it('页面比例不同的续页不继承列位置', () => {
    const result = recognizePdfCourses([firstPage, { ...secondPage, widthPt: 595 }])
    expect(result.candidates.some(c => c.name === '体育')).toBe(false)
  })

  it('没有星期表头的单页不产生课程', () => {
    const result = recognizePdfCourses([page(0, [line('x', '(1-2节)1-4周', 0, 0.2)])])
    expect(result.candidates).toEqual([])
    expect(result.pending).toHaveLength(1)
  })
})

describe('validatePdfCandidate', () => {
  const ok = { name: '高数', day: 0, start: 1, end: 2, weeksText: '1-16周' }
  it('字段齐全可以导入；老师教室可空', () => {
    expect(validatePdfCandidate(ok, DEFAULT_SETTINGS).reasons).toEqual([])
  })
  it('缺星期、缺周次、超出作息或学期都会拦下', () => {
    expect(validatePdfCandidate({ ...ok, day: '' }, DEFAULT_SETTINGS).reasons).toContain('缺星期')
    expect(validatePdfCandidate({ ...ok, weeksText: '' }, DEFAULT_SETTINGS).reasons).toContain('缺少有效周次')
    expect(validatePdfCandidate({ ...ok, end: 99 }, DEFAULT_SETTINGS).reasons.join()).toContain('作息')
    expect(validatePdfCandidate({ ...ok, weeksText: '1-30周' }, DEFAULT_SETTINGS).reasons.join()).toContain('学期周数')
  })
})

describe('mergePdfCourses', () => {
  const make = item => pdfCandidateCourse(item, DEFAULT_SETTINGS, 'hash')
  const math = make({ name: '高数', day: 0, start: 1, end: 2, weeksText: '1-4周', teacher: '张三', room: 'A101' })
  const mathWed = make({ name: '高数', day: 2, start: 3, end: 4, weeksText: '1-4周', teacher: '张三', room: 'A101' })

  it('同名同老师同教室同周次的多个时段合成一门课', () => {
    const added = mergePdfCourses([], [mathWed, math])
    expect(added).toHaveLength(1)
    expect(added[0].slots).toEqual([{ day: 0, start: 1, len: 2 }, { day: 2, start: 3, len: 2 }])
    expect(added[0].weeks).toEqual([1, 2, 3, 4])
  })

  it('同一份再导一次不增加课程', () => {
    const first = mergePdfCourses([], [math, mathWed]).map((c, i) => ({ ...c, id: `c${i}` }))
    expect(mergePdfCourses(first, [math, mathWed])).toEqual([])
  })

  it('已有手动课程按起止周比对，只补缺的周', () => {
    const manual = { id: 'm1', name: '高数', teacher: '张三', room: 'A101', ws: 1, we: 2, parity: null, slots: [{ day: 0, start: 1, len: 2 }] }
    const added = mergePdfCourses([manual], [math])
    expect(added).toHaveLength(1)
    expect(added[0].weeks).toEqual([3, 4])
  })

  it('新课程挑不同颜色，已有同名课沿用原颜色', () => {
    const english = make({ name: '英语', day: 1, start: 1, end: 2, weeksText: '1-4周' })
    const physics = make({ name: '物理', day: 3, start: 1, end: 2, weeksText: '1-4周' })
    const fresh = mergePdfCourses([], [math, english, physics])
    expect(new Set(fresh.map(c => c.hue)).size).toBe(3)
    const manual = { id: 'm1', name: '高数', hue: 25, ws: 1, we: 1, parity: null, slots: [{ day: 6, start: 1, len: 1 }] }
    expect(mergePdfCourses([manual], [math])[0].hue).toBe(25)
  })
})

describe('summarizePdfDraft', () => {
  const item = patch => ({ name: '高等数学', day: 0, start: 1, end: 2, weeksText: '1-16周', teacher: '张三', room: 'A101', source: [], ...patch })
  it('完整的直接可导入，缺信息的单列出来并写明缺什么', () => {
    const summary = summarizePdfDraft([item(), item({ name: '体育', day: '' }), item({ name: '英语', weeksText: '' })], DEFAULT_SETTINGS, [], 'hash')
    expect(summary.courses.map(c => c.name)).toEqual(['高等数学'])
    expect(summary.fixes.map(f => [f.item.name, f.reasons])).toEqual([['体育', ['缺星期']], ['英语', ['缺少有效周次']]])
    expect(summary).toMatchObject({ names: 1, meetings: 1, freshMeetings: 1, duplicateMeetings: 0 })
  })
  it('已经在课表里的上课时间不算新增', () => {
    const saved = mergePdfCourses([], [pdfCandidateCourse(item(), DEFAULT_SETTINGS, 'old')]).map((c, i) => ({ ...c, id: `c${i}` }))
    const summary = summarizePdfDraft([item(), item({ name: '英语', day: 1 })], DEFAULT_SETTINGS, saved, 'hash')
    expect(summary).toMatchObject({ names: 1, meetings: 2, freshMeetings: 1, duplicateMeetings: 1 })
  })
})

describe('validPdfRect', () => {
  it('只接受页面内、有面积的位置框', () => {
    expect(validPdfRect({ left: 0.1, top: 0.1, right: 0.2, bottom: 0.2 })).toBe(true)
    expect(validPdfRect({ left: 0.1, top: 0.1, right: 1.2, bottom: 0.2 })).toBe(false)
    expect(validPdfRect({ left: NaN, top: 0.1, right: 0.2, bottom: 0.2 })).toBe(false)
    expect(validPdfRect({ left: 0.2, top: 0.1, right: 0.2, bottom: 0.2 })).toBe(false)
  })
})
