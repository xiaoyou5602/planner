import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const hostSource = readFileSync(new URL('../../public/school-import-host.js', import.meta.url), 'utf8')
const zhengfangSource = readFileSync(new URL('../../public/open-source/shiguang/resources/zhengfang_jiaowu/zhengfang_01.js', import.meta.url), 'utf8')
const aufeSource = readFileSync(new URL('../../public/open-source/shiguang/resources/AUFE/aufe_01.js', import.meta.url), 'utf8')

function makeRuntime(answer) {
  const messages = []
  const context = vm.createContext({
    URL,
    JSON,
    Promise,
    Date,
    console: { log() {}, error() {} },
  })
  context.window = context
  context.location = { href: 'https://jw.example.edu/page' }
  context.CampusImportHost = {
    postMessage(raw) {
      const message = JSON.parse(raw)
      messages.push(message)
      if (message.id) {
        const value = answer(message)
        context.__campusImportResolve(message.runId, message.id, true, value)
      }
    },
  }
  vm.runInContext(hostSource, context)
  return { context, messages }
}

describe('Android 教务适配脚本宿主', () => {
  it('正方适配提示页面不对并结束后，会通知原生恢复执行按钮', async () => {
    const { context, messages } = makeRuntime(message => message.method === 'showAlert')
    context.jQuery = {}
    context.fetch = async () => ({ text: async () => '<html>这不是课表查询页</html>' })
    context.__campusInstallImportHost(1)
    await context.__campusImportRun(zhengfangSource)
    expect(messages.filter(message => message.method === 'showAlert')).toHaveLength(2)
    expect(messages.at(-1)).toMatchObject({ runId: 1, method: 'notifyTaskFinished' })
  })

  it('安徽财经适配取消后可在同一页面再次执行，不会重复声明全局变量', async () => {
    const { context, messages } = makeRuntime(() => false)
    context.__campusInstallImportHost(1)
    await context.__campusImportRun(aufeSource)
    context.__campusInstallImportHost(2)
    await context.__campusImportRun(aufeSource)
    expect(messages.filter(message => message.method === 'notifyTaskFailed')).toEqual([])
    expect(messages.filter(message => message.method === 'notifyTaskFinished').map(message => message.runId)).toEqual([1, 2])
  })
})
