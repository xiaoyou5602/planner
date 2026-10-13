import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './store.js'
import { importSummaryText, prepareShiguangImport } from './importSchedule.js'

const source = { schoolId: 'TEST', schoolName: '测试大学', adapterId: 'test_01', adapterName: '本科教务', maintainer: 'tester' }

describe('拾光整学期导入', () => {
  it('合并同课程的多个上课时间，并保留不连续周次', () => {
    const prepared = prepareShiguangImport({
      config: { semesterStartDate: '2026-09-07', semesterTotalWeeks: 18 },
      timeSlots: [
        { number: 1, startTime: '08:00', endTime: '08:45' },
        { number: 2, startTime: '08:55', endTime: '09:40' },
      ],
      courses: [
        { name: '设计史', teacher: '林老师', position: 'A101', day: 1, startSection: 1, endSection: 2, weeks: [1, 2, 4, 7] },
        { name: '设计史', teacher: '林老师', position: 'A101', day: 3, startSection: 1, endSection: 2, weeks: [1, 2, 4, 7] },
      ],
    }, DEFAULT_SETTINGS, source)
    expect(prepared.courses).toHaveLength(1)
    expect(prepared.courses[0].slots).toHaveLength(2)
    expect(prepared.courses[0].weeks).toEqual([1, 2, 4, 7])
    expect(prepared.courses[0].source.key).toBe('TEST:test_01')
    expect(prepared.settingsPatch).toMatchObject({ startDate: '2026-09-07', totalWeeks: 18 })
    expect(prepared.summary.timeSlots).toBe(2)
  })

  it('自定义时间保留准确钟点，同时映射到课表格子', () => {
    const prepared = prepareShiguangImport({
      courses: [{ name: '讲座', day: 5, weeks: [2, 3], isCustomTime: true, customStartTime: '13:20', customEndTime: '15:05' }],
    }, DEFAULT_SETTINGS, source)
    const slot = prepared.courses[0].slots[0]
    expect(slot.day).toBe(4)
    expect(slot.customStart).toBe('13:20')
    expect(slot.customEnd).toBe('15:05')
    expect(slot.start).toBeGreaterThan(0)
    expect(slot.len).toBeGreaterThan(0)
  })

  it('跳过坏课程，全部无效时明确失败', () => {
    expect(() => prepareShiguangImport({ courses: [{ name: '', weeks: [] }] }, DEFAULT_SETTINGS, source)).toThrow('已跳过')
  })

  it('摘要包含学期和作息', () => {
    expect(importSummaryText({ courses: 6, meetings: 9, totalWeeks: 18, startDate: '2026-09-07', timeSlots: 12, clockRange: '08:00–21:30', comboSchedules: 0 }))
      .toContain('6 门课程 · 9 个上课时间 · 18 周')
  })

  it.each([null, undefined, ''])('未提供课间时长（%s）时不把旧作息覆盖成 0', defaultBreakDuration => {
    const prepared = prepareShiguangImport({
      config: { defaultBreakDuration },
      courses: [{ name: '设计史', day: 1, startSection: 1, endSection: 2, weeks: [1] }],
    }, { ...DEFAULT_SETTINGS, brk: 15 }, source)
    expect(prepared.settingsPatch).not.toHaveProperty('brk')
  })
})
