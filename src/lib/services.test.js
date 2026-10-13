import { describe, expect, it } from 'vitest'
import { amountOf, bathCost, cleanAmount, degOf, fmtAmount, fmtClock } from './services.js'

describe('其他金额输入', () => {
  it('去掉非数字字符，只留一个小数点和两位小数', () => {
    expect(cleanAmount('¥1a2')).toBe('12')
    expect(cleanAmount('12.345')).toBe('12.34')
    expect(cleanAmount('1.2.3')).toBe('1.2')
    expect(cleanAmount('.5')).toBe('.5')
  })
  it('超过 1000 按 1000', () => {
    expect(cleanAmount('1200')).toBe('1000')
    expect(cleanAmount('1000.5')).toBe('1000')
    expect(cleanAmount('999.99')).toBe('999.99')
  })
  it('空 / 0 / 只有小数点都不算有效金额', () => {
    expect(amountOf('')).toBe(0)
    expect(amountOf('0')).toBe(0)
    expect(amountOf('.')).toBe(0)
    expect(amountOf('0.00')).toBe(0)
    expect(amountOf('.5')).toBe(0.5)
    expect(amountOf('12.30')).toBe(12.3)
  })
})

describe('换算与显示', () => {
  it('充值金额约等于多少度', () => {
    expect(degOf(10)).toBe(19)
    expect(degOf(50)).toBe(93)
    expect(degOf(200)).toBe(372)
  })
  it('洗浴计时与费用', () => {
    expect(fmtClock(0)).toBe('00:00')
    expect(fmtClock(75)).toBe('01:15')
    expect(fmtClock(3600)).toBe('60:00')
    expect(bathCost(0)).toBe('0.00')
    expect(bathCost(600)).toBe('3.00')
  })
  it('金额显示', () => {
    expect(fmtAmount(50)).toBe('50')
    expect(fmtAmount(12.5)).toBe('12.5')
  })
})
