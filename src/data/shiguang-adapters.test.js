import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import catalog from './shiguang-adapters.json'

const appRoot = fileURLToPath(new URL('../..', import.meta.url))

describe('内置拾光适配目录', () => {
  it('只包含可用适配，复合 ID 不重复', () => {
    expect(catalog.adapters.length).toBe(272)
    expect(catalog.adapters.some(item => ['GENERAL_TOOL_01', 'GENERAL_TOOL_02'].includes(item.id))).toBe(false)
    const keys = catalog.adapters.map(item => `${item.schoolId}:${item.id}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('每个目录项都有真实脚本，且脚本语法可执行', () => {
    const checked = new Set()
    for (const adapter of catalog.adapters) {
      const file = join(appRoot, 'public', ...adapter.assetPath.split('/'))
      expect(existsSync(file), adapter.assetPath).toBe(true)
      if (checked.has(file)) continue
      expect(() => new vm.Script(readFileSync(file, 'utf8'), { filename: file })).not.toThrow()
      checked.add(file)
    }
    expect(checked.size).toBe(264)
  })

  it('固定记录上游版本和许可证', () => {
    expect(catalog.upstream.license).toBe('MIT')
    expect(catalog.upstream.commit).toMatch(/^[0-9a-f]{40}$/)
  })
})
