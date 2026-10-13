import { afterAll, describe, expect, it, vi } from 'vitest'

// 用内存版 Preferences 代替真机存储，并预先放一份「真数据」
const REAL = JSON.stringify({ profile: { name: 'toge' } })
const mem = new Map([['campus.v1', REAL]])
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: mem.has(key) ? mem.get(key) : null }),
    set: async ({ key, value }) => { mem.set(key, value) },
    remove: async ({ key }) => { mem.delete(key) },
  },
}))

// 模拟网址带 ?demo=1 打开
vi.stubGlobal('window', { location: { search: '?demo=1' } })
afterAll(() => vi.unstubAllGlobals())

const store = await import('./store.js')
const { DEMO, services } = await import('./demo.js')

describe('演示模式', () => {
  it('第一次打开是样例数据，不是本机存的真数据', async () => {
    expect(DEMO).toBe(true)
    const s = await store.loadStore()
    expect(s.profile.name).toBe('林同学')
    expect(s.courses.length).toBeGreaterThan(0)
    expect(s.courses.every(c => c.slots.every(x => x.start + x.len - 1 <= 13))).toBe(true)
    expect(services.elec.days).toHaveLength(7)
  })

  it('在假数据里改的会存下来，重新打开还在，真数据不动', async () => {
    await store.setProfile({ name: '改个名' })
    await store.flushed()
    await store.loadStore()
    expect(store.getState().profile.name).toBe('改个名')
    expect(mem.get('campus.v1')).toBe(REAL)
  })

  it('清空只删假数据，下次打开回到样例，真数据不动', async () => {
    await store.wipe()
    await store.flushed()
    expect(mem.has('campus.demo.v1')).toBe(false)
    expect(mem.get('campus.v1')).toBe(REAL)
    expect((await store.loadStore()).profile.name).toBe('林同学')
  })
})
