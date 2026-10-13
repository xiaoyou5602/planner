// Android 教务 WebView 的拾光桥接宿主。每次执行都安装一套独立运行环境，避免适配脚本重复声明全局变量。
(() => {
  window.__campusInstallImportHost = runId => {
    const pending = new Map()
    let serial = 0

    window.__campusImportResolve = (replyRunId, id, ok, value) => {
      if (replyRunId !== runId) return
      const item = pending.get(id)
      if (!item) return
      pending.delete(id)
      ok ? item.resolve(value) : item.reject(new Error(String(value || '导入失败')))
    }

    const post = (method, args = [], id = null) => {
      window.CampusImportHost.postMessage(JSON.stringify({ runId, id, method, args }))
    }
    const request = (method, args = []) => new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${++serial}`
      pending.set(id, { resolve, reject })
      post(method, args, id)
    })
    const oneWay = (method, args = []) => post(method, args)

    const promises = {
      showAlert: (title, content, confirmText) => request('showAlert', [title, content, confirmText]),
      showPrompt: async (title, tip, defaultText, validatorName) => {
        let value = defaultText || ''
        while (true) {
          value = await request('showPrompt', [title, tip, value])
          const localValidator = window.__campusImportValidator?.(validatorName)
          const validator = localValidator || window[validatorName]
          if (value === null || !validatorName || typeof validator !== 'function') return value
          const problem = validator(value)
          if (!problem) return value
          await request('showAlert', ['输入有误', String(problem), '重新输入'])
        }
      },
      showSingleSelection: (title, items, selected = -1) => request('showSingleSelection', [title, items, selected]),
      saveImportedCourses: json => request('saveImportedCourses', [json]),
      savePresetTimeSlots: json => request('savePresetTimeSlots', [json]),
      saveCourseConfig: json => request('saveCourseConfig', [json]),
      saveComboSchedule: json => request('saveComboSchedule', [json]),
    }
    const sync = {
      showToast: message => oneWay('showToast', [message]),
      notifyTaskCompletion: () => oneWay('notifyTaskCompletion'),
    }
    window.shiguangBridgePromise = promises
    window.AndroidBridgePromise = promises
    window.shiguangBridge = sync
    window.AndroidBridge = sync

    window.__campusImportRun = async source => {
      try {
        // direct eval 让每次调用拥有独立词法作用域，同时保留适配内部异步函数的闭包。
        // resolver 让以字符串传入的校验函数（如 validateDate）仍能从该局部作用域找到。
        const instrumented = `
          window.__campusImportValidator = name => {
            try { return eval(name) } catch (_) { return null }
          }
        ` + source
        const result = eval(instrumented)
        await Promise.resolve(result)
        oneWay('notifyTaskFinished')
      } catch (error) {
        oneWay('notifyTaskFailed', [error?.message || String(error)])
      }
    }
  }
})()
