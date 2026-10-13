import { beforeEach, describe, expect, it, vi } from 'vitest'

// 内存版 Preferences；failNext 让下一次写入失败，模拟存储出错
const mem = new Map()
let failNext = false
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: mem.has(key) ? mem.get(key) : null }),
    set: async ({ key, value }) => {
      if (failNext) { failNext = false; throw new Error('disk full') }
      mem.set(key, value)
    },
    remove: async ({ key }) => { mem.delete(key) },
  },
}))

const store = await import('./store.js')
const { pdfCandidateCourse } = await import('./pdfCourses.js')

const course = (name, day) => pdfCandidateCourse({ name, day, start: 1, end: 2, weeksText: '1-8周', teacher: '', room: '' }, store.DEFAULT_SETTINGS, 'hash')

beforeEach(async () => {
  mem.clear()
  failNext = false
  await store.loadStore()
})

describe('applyPdfImport', () => {
  it('追加课程，保留原有手动课程，重开后还在', async () => {
    await store.update(s => ({ ...s, courses: [{ id: 'mine', name: '自习', ws: 1, we: 20, parity: null, hue: 30, note: '别删', slots: [{ day: 5, start: 1, len: 2 }] }] }))
    const outcome = await store.applyPdfImport([course('高数', 0), course('英语', 1)])
    expect(outcome).toMatchObject({ added: 2, courses: 2 })
    expect(outcome.ids).toHaveLength(2)
    await store.loadStore()
    const names = store.getState().courses.map(c => c.name)
    expect(names).toEqual(['自习', '高数', '英语'])
    expect(store.getState().courses[0]).toMatchObject({ id: 'mine', note: '别删', hue: 30 })
  })

  it('重复导入同样内容不增加', async () => {
    await store.applyPdfImport([course('高数', 0)])
    expect(await store.applyPdfImport([course('高数', 0)])).toMatchObject({ added: 0, courses: 0 })
    expect(store.getState().courses).toHaveLength(1)
  })

  it('写入失败时报错并撤回本次新增', async () => {
    failNext = true
    await expect(store.applyPdfImport([course('高数', 0)])).rejects.toThrow('保存失败')
    expect(store.getState().courses).toEqual([])
    await store.loadStore()
    expect(store.getState().courses).toEqual([])
    // 失败后还能继续正常保存
    expect(await store.applyPdfImport([course('高数', 0)])).toMatchObject({ added: 1, courses: 1 })
  })

  it('信息不完整的课程不会写入', async () => {
    const bad = { ...course('高数', 0), weeks: [] }
    await expect(store.applyPdfImport([bad])).rejects.toThrow()
    expect(store.getState().courses).toEqual([])
  })

  it('撤销只删掉这次导入新建的课程', async () => {
    await store.update(s => ({ ...s, courses: [{ id: 'mine', name: '自习', ws: 1, we: 20, parity: null, hue: 30, note: '', slots: [{ day: 5, start: 1, len: 2 }] }] }))
    const outcome = await store.applyPdfImport([course('高数', 0), course('英语', 1)])
    await store.removeCourses(outcome.ids)
    await store.loadStore()
    expect(store.getState().courses.map(c => c.id)).toEqual(['mine'])
  })
})
