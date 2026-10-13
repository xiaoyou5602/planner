import { beforeEach, describe, expect, it, vi } from 'vitest'

// 用内存版 Preferences 代替真机存储
const mem = new Map()
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: mem.has(key) ? mem.get(key) : null }),
    set: async ({ key, value }) => { mem.set(key, value) },
    remove: async ({ key }) => { mem.delete(key) },
  },
}))

const store = await import('./store.js')

beforeEach(async () => {
  mem.clear()
  await store.loadStore()
})

describe('store', () => {
  it('首次打开是空数据，不带任何示例课程', async () => {
    const s = store.getState()
    expect(s.courses).toEqual([])
    expect(s.events).toEqual([])
    expect(s.profile.name).toBe('')
    expect(s.settings.startDate).toBe(null)
  })

  it('写入后重新读取，数据还在', async () => {
    await store.update(s => ({ ...s, profile: { ...s.profile, name: 'toge' } }))
    await store.loadStore()
    expect(store.getState().profile.name).toBe('toge')
  })

  it('清空后重新读取是空的', async () => {
    await store.update(s => ({ ...s, courses: [{ id: 'c_1', name: '高数' }] }))
    await store.wipe()
    await store.loadStore()
    expect(store.getState().courses).toEqual([])
    expect(mem.size).toBe(0)
  })

  it('老数据缺字段时补默认值', () => {
    const s = store.normalize({ settings: { dur: 50 } })
    expect(s.settings.dur).toBe(50)
    expect(s.settings.brk).toBe(10)
    expect(s.palette.current).toBe('soft')
  })

  it('课程新建、修改、删除，重开后保持', async () => {
    const c = store.saveCourse({ name: '高数', slots: [{ day: 0, start: 1, len: 2 }, { day: 2, start: 3, len: 2 }] })
    expect(c.id).toMatch(/^c_/)
    store.saveCourse({ ...c, name: '高数 A' })
    store.saveEvent({ title: '社团', date: '2026-10-10', st: 1140, et: 1200 })
    await store.flushed()
    await store.loadStore()
    const s = store.getState()
    expect(s.courses).toHaveLength(1)
    expect(s.courses[0].name).toBe('高数 A')
    expect(s.courses[0].slots).toHaveLength(2)
    expect(s.events).toHaveLength(1)
    await store.deleteCourse(c.id)
    await store.deleteEvent(s.events[0].id)
    await store.loadStore()
    expect(store.getState().courses).toEqual([])
    expect(store.getState().events).toEqual([])
  })

  it('改设置只改给出的字段', async () => {
    await store.setSettings({ startDate: '2026-09-07' })
    await store.loadStore()
    expect(store.getState().settings.startDate).toBe('2026-09-07')
    expect(store.getState().settings.am).toBe(5)
  })

  it('存储里是坏 JSON 时退回空数据', async () => {
    mem.set('campus.v1', '{oops')
    await store.loadStore()
    expect(store.getState().courses).toEqual([])
  })

  it('改资料只改给出的字段，重开后保持', async () => {
    await store.setProfile({ name: '小林', avatar: 3 })
    await store.setProfile({ dorm: '东 3108' })
    await store.loadStore()
    expect(store.getState().profile).toEqual({ name: '小林', avatar: 3, dorm: '东 3108' })
  })

  it('自定义色卡：保存即使用，删掉正在用的退回奶油', async () => {
    await store.pickPalette('vivid')
    const key = store.addPalette({ label: '我的', list: ['#F4D8D8'] })
    await store.flushed()
    await store.loadStore()
    let pal = store.getState().palette
    expect(pal.current).toBe(key)
    expect(pal.custom[key].label).toBe('我的')
    await store.deletePalette(key)
    await store.loadStore()
    pal = store.getState().palette
    expect(pal.custom).toEqual({})
    expect(pal.current).toBe('soft')
  })

  it('删掉没在用的色卡，不影响当前选择', async () => {
    const a = store.addPalette({ label: 'A', list: ['#111111'] })
    await store.pickPalette('mist')
    await store.deletePalette(a)
    expect(store.getState().palette.current).toBe('mist')
  })

  it('整学期导入可合并，重复导入同一适配时替换旧版本', async () => {
    await store.saveCourse({ name: '手动课', slots: [{ day: 0, start: 1, len: 2 }], ws: 1, we: 16 })
    const imported = name => ({
      courses: [{ name, teacher: '', room: '', slots: [{ day: 1, start: 3, len: 2 }], weeks: [1, 3], ws: 1, we: 3, parity: 'odd', hue: 155, source: { key: 'TEST:a' } }],
      settingsPatch: { startDate: '2026-09-07', totalWeeks: 18 },
    })
    await store.applyScheduleImport(imported('导入课 A'), 'merge')
    expect(store.getState().courses.map(c => c.name)).toEqual(['手动课', '导入课 A'])
    await store.applyScheduleImport(imported('导入课 B'), 'merge')
    expect(store.getState().courses.map(c => c.name)).toEqual(['手动课', '导入课 B'])
    expect(store.getState().settings.totalWeeks).toBe(18)
  })

  it('替换导入只换课程和学期设置，保留资料与日程', async () => {
    await store.setProfile({ name: 'toge' })
    await store.saveEvent({ title: '考试', date: '2026-10-20', st: 600, et: 660 })
    await store.saveCourse({ name: '旧课', slots: [] })
    await store.applyScheduleImport({
      courses: [{ name: '新课', slots: [{ day: 0, start: 1, len: 1 }], weeks: [1], ws: 1, we: 1, parity: null, hue: 255 }],
      settingsPatch: { totalWeeks: 16 },
    }, 'replace')
    const state = store.getState()
    expect(state.courses.map(c => c.name)).toEqual(['新课'])
    expect(state.profile.name).toBe('toge')
    expect(state.events).toHaveLength(1)
  })

  it('替换课表时，新导入没有分季作息就清掉旧导入的作息', async () => {
    await store.setSettings({
      timeSlots: [{ number: 1, startTime: '08:00', endTime: '08:45' }],
      comboSchedule: {
        name: '旧分季作息',
        publicSchedules: [{ startDate: '2026-10-01', endDate: '2026-10-31', timeSlots: [] }],
      },
    })
    await store.applyScheduleImport({
      courses: [{ name: '新课', slots: [{ day: 0, start: 1, len: 1 }], weeks: [1], ws: 1, we: 1, parity: null, hue: 255 }],
      settingsPatch: { totalWeeks: 16 },
    }, 'replace')
    expect(store.getState().settings.timeSlots).toBe(null)
    expect(store.getState().settings.comboSchedule).toBe(null)
  })

  it('清空数据也清掉资料和自定义色卡', async () => {
    await store.setProfile({ name: '小林', dorm: '东 3108' })
    store.addPalette({ label: 'A', list: ['#111111'] })
    await store.wipe()
    await store.loadStore()
    const s = store.getState()
    expect(s.profile).toEqual({ name: '', avatar: 0, dorm: '' })
    expect(s.palette).toEqual({ current: 'soft', custom: {} })
  })
})
