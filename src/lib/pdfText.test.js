import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readPdfPages } from './pdfText.js'
import { parsePdfWeeks, recognizePdfCourses } from './pdfCourses.js'
import { makeTimetablePdf } from './timetablePdfFixture.js'

const cMapUrl = fileURLToPath(new URL('../../node_modules/pdfjs-dist/cmaps/', import.meta.url))

// 和 pdfCourses.test.js 同一份假课表，这次画进真正的 PDF：列中心 0.16 起，每列宽 0.12
const x = day => 0.16 + 0.12 * day - 0.05
const firstPage = [
  { text: '2099-2100学年第1学期', x: 0.02, top: 0.05 },
  { text: '测试课表', x: 0.43, top: 0.05, size: 24 },
  { text: '时间段', x: 0.02, top: 0.11, size: 12 },
  { text: '节次', x: 0.07, top: 0.11, size: 12 },
  ...'一二三四五六日'.split('').map((d, i) => ({ text: `星期${d}`, x: 0.16 + 0.12 * i - 0.02, top: 0.11, size: 12 })),
  { text: '高等数学', x: x(0), top: 0.2, size: 9 },
  { text: '(1-2节)1-4周,7-10周', x: x(0), top: 0.22 },
  { text: '/场地:A楼/101/教', x: x(0), top: 0.24 },
  { text: '师:张三', x: x(0), top: 0.26 },
  { text: '大学英语', x: x(0), top: 0.3, size: 9 },
  { text: '(3-4节)1-16周(单)/场', x: x(0), top: 0.32 },
  { text: '地:B楼/', x: x(0), top: 0.34 },
  { text: '线性代数', x: x(2), top: 0.2, size: 9 },
  { text: '(5节)3周', x: x(2), top: 0.22 },
  { text: '其他课程:创新创业 未排定', x: 0.05, top: 0.9 },
]
// 续页没有星期表头：英语的教室接在这页开头，后面还有一门新课
const secondPage = [
  { text: '201/教师:李四', x: x(0), top: 0.05 },
  { text: '体育', x: x(0), top: 0.1, size: 9 },
  { text: '(7-8节)2-8周(双)/教', x: x(0), top: 0.12 },
  { text: '师:王五', x: x(0), top: 0.14 },
]
const expected = [
  ['高等数学', 0, 1, 2, [1, 2, 3, 4, 7, 8, 9, 10], '张三', 'A楼/101'],
  ['大学英语', 0, 3, 4, [1, 3, 5, 7, 9, 11, 13, 15], '李四', 'B楼/201'],
  ['体育', 0, 7, 8, [2, 4, 6, 8], '王五', ''],
  ['线性代数', 2, 5, 5, [3], '', ''],
]
const rows = result => result.candidates
  .map(c => [c.name, c.day, c.start, c.end, parsePdfWeeks(c.weeksText), c.teacher, c.room])
  .sort((a, b) => a[1] - b[1] || a[2] - b[2])

describe('readPdfPages', () => {
  it('读出每一行文字和它在页面上的位置', async () => {
    const { pageCount, pages } = await readPdfPages(makeTimetablePdf([firstPage, secondPage]), { cMapUrl })
    expect(pageCount).toBe(2)
    const monday = pages[0].blocks.find(block => block.text === '星期一')
    expect(monday.rects).toHaveLength(1)
    expect(monday.rects[0].left).toBeCloseTo(0.14, 2)
    expect(monday.rects[0].top).toBeCloseTo(0.11, 2)
    expect(pages[0].blocks.map(block => block.text)).toContain('(1-2节)1-4周,7-10周')
  })

  it('竖着存、旋转 90° 显示的页面，位置和直接横放的一样', async () => {
    const rotated = await readPdfPages(makeTimetablePdf([firstPage]), { cMapUrl })
    const flat = await readPdfPages(makeTimetablePdf([firstPage], { rotated: false }), { cMapUrl })
    expect(rotated.pages[0].rotation).toBe(90)
    expect(rotated.pages[0].widthPt).toBe(842)
    rotated.pages[0].blocks.forEach((block, i) => {
      for (const key of ['left', 'top', 'right', 'bottom']) expect(block.rects[0][key]).toBeCloseTo(flat.pages[0].blocks[i].rects[0][key], 4)
    })
  })

  it('从 PDF 文件一路识别出课程，跨页内容接得上', async () => {
    const { pages } = await readPdfPages(makeTimetablePdf([firstPage, secondPage]), { cMapUrl })
    const result = recognizePdfCourses(pages)
    expect(rows(result)).toEqual(expected)
    expect(result.pending.map(item => item.name)).toEqual(['其他课程（未排定时间）'])
  })

  it('页数超过上限时先停下，不把整份读完', async () => {
    const onPage = []
    await expect(readPdfPages(makeTimetablePdf([firstPage, secondPage]), { cMapUrl, maxPages: 1, onPage: i => onPage.push(i) })).rejects.toMatchObject({ name: 'TooManyPagesError' })
    expect(onPage).toEqual([])
  })

  it('不是 PDF 时报错，不返回空结果', async () => {
    await expect(readPdfPages(new TextEncoder().encode('not a pdf'), { cMapUrl })).rejects.toThrow()
  })
})

// toge 的真实课表不进 Git。本机验证：
// PDF_SAMPLE=<课表.pdf> PDF_SAMPLE_EXPECTED=<人工核对的 courses-private.json> npx vitest run src/lib/pdfText.test.js
const sample = process.env.PDF_SAMPLE, sampleExpected = process.env.PDF_SAMPLE_EXPECTED
describe.skipIf(!sample || !sampleExpected)('真实课表样本', () => {
  it('识别结果与人工核对逐条一致', async () => {
    const { pages } = await readPdfPages(new Uint8Array(fs.readFileSync(sample)), { cMapUrl })
    const result = recognizePdfCourses(pages)
    const norm = value => String(value ?? '').normalize('NFKC').replace(/\s/g, '')
    const actual = result.candidates.map(c => JSON.stringify([norm(c.name), c.day + 1, c.start, c.end, parsePdfWeeks(c.weeksText), norm(c.teacher), norm(c.room)])).sort()
    const target = JSON.parse(fs.readFileSync(sampleExpected, 'utf8')).records
      .map(c => JSON.stringify([norm(c.name), c.day, c.startSection, c.endSection, c.weeks, norm(c.teacher), norm(c.room)])).sort()
    expect(actual).toEqual(target)
  })
})
