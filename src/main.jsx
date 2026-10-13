import { registerPlugin } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { loadStore } from './lib/store.js'
import './styles.css'

// 系统开屏由原生一直挡着，首页画好后报到一次就撤掉；浏览器里没有这个插件，忽略即可
const AppReady = registerPlugin('AppReady')

// 先读完本地数据再渲染，避免空状态一闪而过
loadStore().finally(() => {
  // 首页一渲染就会替换掉 #root 里的静态小本子
  createRoot(document.getElementById('root')).render(<App />)
  requestAnimationFrame(() => {
    try {
      AppReady.ready().catch(() => {})
    } catch {}
  })
})
