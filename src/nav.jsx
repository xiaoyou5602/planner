// 导航状态：主 tab、二级页栈、底部弹层、toast，以及安卓返回键。
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const NavCtx = createContext(null)

export const TABS = [
  ['home', '首页'],
  ['sched', '课表'],
  ['me', '我的'],
]

// 起始界面可由网址指定，给开发用的画布页（canvas.html）摆多个界面；App 里打开不带参数，照常是首页。
// ?tab=sched 选主 tab；?page=card,topup 依次压好二级页。课程页、编辑资料页要参数才有内容，默认给「新建」
const PAGE_DEFAULTS = { course: { mode: 'add' }, edit: {} }
function initialNav() {
  const q = new URLSearchParams(window.location.search)
  const t = q.get('tab')
  const stack = (q.get('page') || '').split(',').filter(Boolean)
  const params = {}
  for (const id of stack) if (PAGE_DEFAULTS[id]) params[id] = { ...PAGE_DEFAULTS[id], token: 0 }
  return { tab: TABS.some(([id]) => id === t) ? t : 'home', stack, params }
}

export function NavProvider({ children }) {
  const [start] = useState(initialNav)
  const [tab, setTab] = useState(start.tab)
  const [stack, setStack] = useState(start.stack)
  const [sheet, setSheet] = useState(null)
  // 二级页参数（如编辑哪门课）与弹层数据；关掉后不清空，退场动画期间内容不会突然消失
  const [params, setParams] = useState(start.params)
  const [sheetData, setSheetData] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastOn, setToastOn] = useState(false)
  const [toastAction, setToastAction] = useState(null)
  const toastTimer = useRef(0)

  const push = useCallback((id, p) => {
    if (p !== undefined) setParams(x => ({ ...x, [id]: { ...p, token: Date.now() } }))
    setStack(s => (s.includes(id) ? s : [...s, id]))
  }, [])
  const pop = useCallback(() => setStack(s => s.slice(0, -1)), [])
  const reset = useCallback(() => {
    setSheet(null)
    setStack([])
    setTab('home')
  }, [])
  const openSheet = useCallback((id, data = null) => {
    setSheetData(data)
    setSheet(id)
  }, [])
  const closeSheet = useCallback(() => setSheet(null), [])
  // action: { label, run }，例如导入后的「撤销」；带按钮时多留一会儿，方便点到
  const toast = useCallback((msg, action = null) => {
    clearTimeout(toastTimer.current)
    setToastMsg(msg)
    setToastAction(action)
    setToastOn(true)
    toastTimer.current = setTimeout(() => setToastOn(false), action ? 5000 : 1600)
  }, [])
  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current)
    setToastOn(false)
  }, [])

  // 安卓返回键：先关弹层，再退二级页，再回首页，最后退出 App
  const latest = useRef({})
  latest.current = { tab, stack, sheet }
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapApp.addListener('backButton', () => {
      const { tab, stack, sheet } = latest.current
      if (sheet) setSheet(null)
      else if (stack.length) setStack(s => s.slice(0, -1))
      else if (tab !== 'home') setTab('home')
      else CapApp.exitApp()
    })
    return () => {
      sub.then(h => h.remove())
    }
  }, [])

  const value = useMemo(
    () => ({ tab, setTab, stack, params, push, pop, reset, sheet, sheetData, openSheet, closeSheet, toast, hideToast, toastMsg, toastOn, toastAction }),
    [tab, stack, params, sheet, sheetData, toastMsg, toastOn, toastAction, push, pop, reset, openSheet, closeSheet, toast, hideToast],
  )
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>
}

export const useNav = () => useContext(NavCtx)
