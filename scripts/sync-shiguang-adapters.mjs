import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const source = resolve(process.argv[2] || '')
const rootIndex = join(source, 'index', 'root_index.yaml')
const resources = join(source, 'resources')

if (!process.argv[2] || !existsSync(rootIndex) || !existsSync(resources)) {
  console.error('用法：node scripts/sync-shiguang-adapters.mjs <shiguang_warehouse 本地目录>')
  process.exit(1)
}

function scalar(text) {
  const value = text.trim()
  if (!value) return ''
  if (value.startsWith('"')) {
    const match = value.match(/^"(?:\\.|[^"\\])*"/)
    if (!match) throw new Error(`无法解析 YAML 字符串：${value}`)
    return JSON.parse(match[0])
  }
  if (value.startsWith("'")) {
    const end = value.lastIndexOf("'")
    return value.slice(1, end).replaceAll("''", "'")
  }
  return value.replace(/\s+#.*$/, '').trim()
}

// 上游的两个索引文件只使用扁平对象列表；这里刻意只解析这部分，避免引入 YAML 运行时依赖。
function parseList(file, firstKey) {
  const lines = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
  const rows = []
  let current = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const item = line.match(/^\s*-\s+([a-z_]+):\s*(.*)$/i)
    const field = line.match(/^\s+([a-z_]+):\s*(.*)$/i)
    const match = item || field
    if (!match) continue
    const [, key, raw] = match
    if (item) {
      if (current) rows.push(current)
      current = {}
    }
    if (!current || (item && key !== firstKey)) continue
    if (raw.trim() === '|') {
      const indent = line.search(/\S/)
      const parts = []
      while (i + 1 < lines.length) {
        const next = lines[i + 1]
        const nextIndent = next.search(/\S/)
        if (next.trim() && nextIndent <= indent) break
        i++
        parts.push(next.trim())
      }
      current[key] = parts.join('\n').trim()
    } else {
      current[key] = scalar(raw)
    }
  }
  if (current) rows.push(current)
  return rows
}

function safeAssetPath(folder, asset) {
  const full = resolve(resources, folder, asset)
  const rel = relative(resources, full)
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) throw new Error(`非法适配脚本路径：${folder}/${asset}`)
  return { full, rel: rel.split(sep).join('/') }
}

function normalizedJavaScript(file) {
  const lines = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')
  return `${lines.map((line) => line.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '')}\n`
}

const schools = parseList(rootIndex, 'id')
const excluded = new Set(['GENERAL_TOOL_01', 'GENERAL_TOOL_02'])
const adapters = []
const copied = new Set()
const publicRoot = join(appRoot, 'public', 'open-source', 'shiguang')

for (const school of schools) {
  const folder = school.resource_folder
  const yaml = join(resources, folder, 'adapters.yaml')
  if (!existsSync(yaml)) throw new Error(`索引中的学校缺少 adapters.yaml：${folder}`)
  for (const adapter of parseList(yaml, 'adapter_id')) {
    if (excluded.has(adapter.adapter_id)) continue
    const asset = safeAssetPath(folder, adapter.asset_js_path)
    if (!existsSync(asset.full)) throw new Error(`适配脚本不存在：${asset.rel}`)
    const target = join(publicRoot, 'resources', ...asset.rel.split('/'))
    mkdirSync(dirname(target), { recursive: true })
    if (!copied.has(asset.rel)) {
      writeFileSync(target, normalizedJavaScript(asset.full), 'utf8')
      copied.add(asset.rel)
    }
    adapters.push({
      id: adapter.adapter_id,
      name: adapter.adapter_name,
      category: adapter.category,
      importUrl: adapter.import_url || '',
      maintainer: adapter.maintainer,
      description: adapter.description,
      schoolId: school.id,
      schoolName: school.name,
      initial: school.initial,
      assetPath: `open-source/shiguang/resources/${asset.rel}`,
    })
  }
}

adapters.sort((a, b) => {
  const aTool = a.schoolId === 'GLOBAL_TOOLS' ? 0 : 1
  const bTool = b.schoolId === 'GLOBAL_TOOLS' ? 0 : 1
  return aTool - bTool || a.initial.localeCompare(b.initial, 'zh-CN') || a.schoolName.localeCompare(b.schoolName, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN')
})

const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const committedAt = execFileSync('git', ['-C', source, 'show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }).trim()
const catalog = {
  schemaVersion: 1,
  upstream: {
    name: 'shiguang_warehouse',
    url: 'https://github.com/XingHeYuZhuan/shiguang_warehouse',
    license: 'MIT',
    commit,
    committedAt,
  },
  adapters,
}

mkdirSync(join(appRoot, 'src', 'data'), { recursive: true })
mkdirSync(publicRoot, { recursive: true })
writeFileSync(join(appRoot, 'src', 'data', 'shiguang-adapters.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
writeFileSync(join(publicRoot, 'manifest.json'), `${JSON.stringify(catalog.upstream, null, 2)}\n`, 'utf8')
copyFileSync(join(source, 'LICENSE'), join(publicRoot, 'LICENSE.txt'))
writeFileSync(
  join(publicRoot, 'NOTICE.txt'),
  `拾光课程表适配仓库（shiguang_warehouse）\n上游：${catalog.upstream.url}\n版本：${commit}\n提交时间：${committedAt}\n许可证：MIT；各适配器维护者信息保存在应用内目录及 catalog。\n`,
  'utf8',
)

console.log(`已同步 ${adapters.length} 个可用适配、${copied.size} 个脚本；排除了 2 个开发测试适配。`)
