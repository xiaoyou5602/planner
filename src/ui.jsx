// 通用界面组件：图标、二级页外框、顶栏、弹层、toast、底部导航。
import { useEffect, useState } from 'react'
import { TABS, useNav } from './nav.jsx'

export const ICONS = {
  back: 'icons/arrow-left.svg',
  chevron: 'icons/feather/chevron-right.svg',
  chevronLeft: 'icons/feather/chevron-left.svg',
  file: 'icons/circum/file-text.svg',
  fileSmall: 'icons/feather/file-text.svg',
  plus: 'icons/feather/plus.svg',
  lock: 'icons/feather/lock.svg',
  water: 'icons/water.svg',
  bolt: 'icons/bolt.svg',
  scan: 'icons/scan-line.svg',
  qr: 'icons/qr.svg',
  wallet: 'icons/line/wallet.svg',
  bankLock: 'icons/line/bank-lock.svg',
  palette: 'icons/circum/palette.svg',
  import: 'icons/circum/import.svg',
  droplet: 'icons/circum/droplet.svg',
}

// url() 写在 CSS 变量里时，相对路径会按「使用它的样式文件」所在目录解析（打包后是 assets/），
// 所以这里先按页面地址算成完整网址再交给样式。
const iconUrl = name => new URL(ICONS[name], document.baseURI).href

export function Icon({ name, size = 20, color, style, className = '' }) {
  return (
    <i
      className={`icon ${className}`}
      style={{ '--src': `url("${iconUrl(name)}")`, '--size': `${size}px`, color, ...style }}
      aria-hidden
    />
  )
}

/** 二级页外框：根据所在栈的位置决定在右侧外 / 顶层 / 被压在下面 */
export function PushPage({ id, z = 11, children }) {
  const { stack } = useNav()
  const d = stack.indexOf(id)
  const cls = d < 0 ? '' : d === stack.length - 1 ? 'in top' : 'in under'
  return (
    <div className={`page push-page ${cls}`} style={{ zIndex: z }} aria-hidden={d !== stack.length - 1}>
      <div className="status-gap" />
      {children}
    </div>
  )
}

export function BackHeader({ title, right, onRight }) {
  const { pop } = useNav()
  return (
    <div className="back-header">
      <div className="round-btn tap" onClick={pop} role="button" aria-label="返回">
        <Icon name="back" size={20} />
      </div>
      <div className="title">{title}</div>
      <div className={`side ${onRight ? 'tap' : ''}`} onClick={onRight}>
        {right}
      </div>
    </div>
  )
}

export function Sheet({ id, children }) {
  const { sheet } = useNav()
  return (
    <div className={`sheet ${sheet === id ? 'on' : ''}`} aria-hidden={sheet !== id}>
      <div className="grip" />
      {children}
    </div>
  )
}

export function SheetBackdrop() {
  const { sheet, closeSheet } = useNav()
  return <div className={`sheet-backdrop ${sheet ? 'on' : ''}`} onClick={closeSheet} />
}

export function Toast() {
  const { toastMsg, toastOn, toastAction, hideToast } = useNav()
  return (
    <div className={`toast ${toastOn ? 'on' : ''} ${toastAction ? 'has-action' : ''}`} role="status">
      {toastMsg}
      {toastAction && (
        <span className="toast-action tap" role="button" onClick={() => { hideToast(); toastAction.run() }}>
          {toastAction.label}
        </span>
      )}
    </div>
  )
}

export function TabBar() {
  const { tab, setTab } = useNav()
  const idx = TABS.findIndex(([k]) => k === tab)
  return (
    <div className="tab-bar">
      <div className="pill" style={{ transform: `translateX(${idx * 70}px)` }} />
      {TABS.map(([k, label]) => (
        <div key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
          {label}
        </div>
      ))}
    </div>
  )
}

const MINUS = <line x1="5" y1="12" x2="19" y2="12" />
const PLUS = (
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <line x1="12" y1="5" x2="12" y2="19" />
  </>
)

/** 圆形 −/+ 按钮；到头时变淡且点不动 */
export function StepBtn({ plus, onClick, disabled, size = 32 }) {
  return (
    <div
      className={`step-btn ${disabled ? 'disabled' : 'tap'}`}
      style={{ width: size, height: size }}
      onClick={disabled ? undefined : onClick}
      role="button"
      aria-label={plus ? '加' : '减'}
    >
      <svg viewBox="0 0 24 24">{plus ? PLUS : MINUS}</svg>
    </div>
  )
}

/**
 * 加减行：左边标签，右边 − 数值 +。
 * value 是要显示的内容（可带 Sunshiney 数字），step 在 [min, max] 内加减。
 * children 会盖在数值上（如透明的时间输入框，点数值调起系统时钟）。
 */
export function StepperRow({ label, value, unit, prefix, onChange, num, min, max, step = 1, last, style, children }) {
  return (
    <div className={`stepper-row ${last ? 'last' : ''}`} style={style}>
      <span className="label">{label}</span>
      <StepBtn disabled={num <= min} onClick={() => onChange(Math.max(min, num - step))} />
      <span className="val">
        {prefix}
        {prefix ? ' ' : ''}
        <span className="hand num">{value ?? num}</span>
        {unit ? ` ${unit}` : ''}
        {children}
      </span>
      <StepBtn plus disabled={num >= max} onClick={() => onChange(Math.min(max, num + step))} />
    </div>
  )
}

/** 一排等宽小选项（星期、单双周、提醒等），选中为深色实心 */
export function Chips({ options, value, onPick, cols, height = 36, radius = 12 }) {
  return (
    <div className="chips" style={{ gridTemplateColumns: `repeat(${cols || options.length},minmax(0,1fr))` }}>
      {options.map(([k, label]) => (
        <div key={String(k)} className={`chip tap ${k === value ? 'on' : ''}`} style={{ height, borderRadius: radius }} onClick={() => onPick(k)}>
          {label}
        </div>
      ))}
    </div>
  )
}

/** 胶囊开关 */
export function Toggle({ on }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`}>
      <div className="knob" />
    </div>
  )
}

/** 当前时间，每 20 秒刷新一次；App 从后台回来时立刻刷新 */
export function useNow(ms = 20000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const t = setInterval(tick, ms)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ms])
  return now
}
