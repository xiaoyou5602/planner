import { describe, expect, it } from 'vitest'
import { courseColors, mixPalette, palLabel, parseHex, resolvePalette } from './palette.js'

describe('palette', () => {
  it('从各种文本里提取 HEX，去重并转大写', () => {
    expect(parseHex('#f4d8d8 #D8E6F4, e2f0d6 #F4D8D8')).toEqual(['#F4D8D8', '#D8E6F4', '#E2F0D6'])
    expect(parseHex('{"colors":["#aabbcc","#112233"]}')).toEqual(['#AABBCC', '#112233'])
    expect(parseHex(':root{--a:#ABCDEF;--b:#abc}')).toEqual(['#ABCDEF'])
    expect(parseHex('没有颜色')).toEqual([])
    expect(parseHex('')).toEqual([])
  })

  it('自己调色：描边比底色暗 0.19、浓 0.03，色调偏移生效', () => {
    const p = mixPalette('自调', { L: 0.92, C: 0.05, H: 30 })
    expect(p).toEqual({ label: '自调', bg: [0.92, 0.05], bd: [0.73, 0.08], shift: 30 })
    expect(courseColors({ current: 'u1', custom: { u1: p } }, 255)).toEqual({ bg: 'oklch(0.92 0.05 285)', bd: 'oklch(0.73 0.08 285)' })
  })

  it('明度很低时描边不低于 0.5', () => {
    expect(mixPalette('x', { L: 0.6, C: 0.05, H: 0 }).bd[0]).toBe(0.5)
  })

  it('导入色卡按色相顺序取色，描边用 color-mix 压暗', () => {
    const pal = { current: 'u1', custom: { u1: { label: 'x', list: ['#111111', '#222222'] } } }
    expect(courseColors(pal, 255)).toEqual({ bg: '#111111', bd: 'color-mix(in oklch, #111111 60%, #2E3A5C)' })
    expect(courseColors(pal, 155).bg).toBe('#222222')
  })

  it('当前色卡被删掉时退回奶油', () => {
    expect(resolvePalette({ current: 'u_gone', custom: {} }).label).toBe('奶油')
  })

  it('色卡名最多 8 个字，去掉首尾空格', () => {
    expect(palLabel('  一二三四五六七八九十 ')).toBe('一二三四五六七八')
  })
})
