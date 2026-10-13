// 生活服务：洗浴、电费（含明细）、校园卡（含充值）。
// 第一版只做界面：不接真实接口、不发起任何支付，全部显示「未连接 / 未绑定」，按钮点了提示即将支持。
// 演示模式（?demo=1）下 SV 有数据，按设计原型显示「已绑定」的样子；接入真实数据时沿用同一份界面。
import { useEffect, useRef, useState } from 'react'
import { useNav } from '../nav.jsx'
import { services as SV } from '../lib/demo.js'
import { useStore } from '../lib/store.js'
import { AMOUNT_MAX, BATH_RATE, ELEC_AMOUNTS, ELEC_RATE, TOPUP_AMOUNTS, amountOf, bathCost, cleanAmount, degOf, fmtAmount, fmtClock } from '../lib/services.js'
import { BackHeader, Icon, PushPage, Sheet } from '../ui.jsx'

// 还没接真实设备 / 账户，余额一律 0（演示模式用样例余额）
const BALANCE = SV?.balance ?? 0
const LINE = '1px solid oklch(0.92 0.01 250)'

export function ServicePages() {
  return (
    <>
      <BathPage />
      <ElecPage />
      <ElecLogPage />
      <CardPage />
      <TopupPage />
    </>
  )
}

/** 连接状态小胶囊：未连接 / 未绑定用灰色，ok（已连接 / 正常）用绿色 */
function StateChip({ label, ok, bg = ok ? 'oklch(0.965 0.03 155)' : 'oklch(0.95 0.01 250)', style }) {
  return (
    <span className="state-chip" style={{ background: bg, ...(ok && { color: 'oklch(0.42 0.08 155)' }), ...style }}>
      <span className="dot" style={ok ? { background: 'oklch(0.68 0.14 155)' } : undefined} />
      {label}
    </span>
  )
}

/** 寝室名：楼栋汉字 + 手写房号，如「东 3108」 */
function RoomName({ size, hand }) {
  return (
    <>
      <span style={{ fontSize: size, fontWeight: 700 }}>{SV.room[0]}</span>
      <span className="hand" style={{ fontSize: hand, lineHeight: 1 }}>{SV.room[1]}</span>
    </>
  )
}

function EmptyNote({ tip, size = 22, style }) {
  return (
    <div style={{ padding: '22px 0', textAlign: 'center', ...style }}>
      <div className="hand" style={{ fontSize: size, color: 'var(--ink-4)' }}>nothing yet ~</div>
      <div style={{ fontSize: size > 22 ? 13 : 12, color: 'var(--ink-3)', marginTop: size > 22 ? 6 : 4 }}>{tip}</div>
    </div>
  )
}

/* ---------- 洗浴 ---------- */

function BathPage() {
  const { toast } = useNav()
  // 洗浴设备还没接入，只有演示数据时算已连接；连上之后的计时、水流动效代码已经写好，接入时把这里换成真实状态
  const connected = !!SV
  const [on, setOn] = useState(false)
  const [sec, setSec] = useState(0)

  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setSec(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [on])

  const toggle = () => {
    if (!connected) return toast('还没连接洗浴设备')
    setSec(0)
    setOn(x => !x)
  }

  return (
    <PushPage id="bath">
      <BackHeader title="洗浴" right={<Icon name="scan" size={22} />} onRight={() => toast('扫码连接即将支持')} />
      <div className="page-scroll" style={{ paddingBottom: 'calc(36px + var(--sab))' }}>
        <div style={{ position: 'relative', margin: '28px 22px 0' }}>
          <div className={`card bath-card ${on ? 'on' : ''}`} style={{ padding: 22 }}>
            <div className="bath-flow" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {SV ? <RoomName size={22} hand={36} /> : <span style={{ fontSize: 22, fontWeight: 700 }}>未绑定寝室</span>}
              <StateChip label={SV ? '已连接' : '未连接'} ok={!!SV} style={{ marginLeft: 'auto' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{SV ? SV.addr : '绑定寝室、连接洗浴设备即将支持'}</div>
            {on && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 20 }}>
                <span className="hand" style={{ fontSize: 60, lineHeight: 1 }}>{fmtClock(sec)}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                  已用 <span className="hand" style={{ fontSize: 18, color: 'var(--ink)' }}>¥{bathCost(sec)}</span>
                </span>
              </div>
            )}
            <div style={{ height: 1, background: 'oklch(0.9 0.012 250)', margin: '18px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-3)' }}>
                <span>¥0.30 / 分钟</span>
                <span>余额 ¥{BALANCE.toFixed(2)}</span>
              </div>
              <div className={`bath-btn tap ${on ? 'on' : ''} ${connected ? '' : 'off'}`} onClick={toggle} role="button">
                <Icon name="droplet" size={20} />
                {on ? '结束' : '开始'}
              </div>
            </div>
          </div>
          <div className="tape" />
        </div>

        <div style={{ margin: '34px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>最近洗浴</span>
            {SV && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>全部</span>}
          </div>
          {SV ? (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
              {SV.bath.map((r, i) => (
                <div key={r.date + r.time} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < SV.bath.length - 1 ? LINE : 'none' }}>
                  <span className="hand" style={{ width: 62, fontSize: 18 }}>{r.date}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>
                    {r.time} · {r.min} 分钟
                  </span>
                  <span className="hand" style={{ fontSize: 18 }}>¥{(r.min * BATH_RATE).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote tip="还没有洗浴记录" />
          )}
        </div>
      </div>
    </PushPage>
  )
}

/* ---------- 金额选择（电费 / 校园卡充值共用） ---------- */

function AmountGrid({ amounts, sel, onPick, target, height, sub }) {
  const { openSheet } = useNav()
  const custom = !amounts.includes(sel)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
      {amounts.map(v => (
        <div key={v} className={`amt-tile ${v === sel ? 'on' : ''}`} style={{ height }} onClick={() => onPick(v)}>
          <span className="hand" style={{ fontSize: 24, lineHeight: 1.1 }}>¥{v}</span>
          {sub && <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{sub(v)}</span>}
        </div>
      ))}
      <div className={`amt-tile tap ${custom ? 'on' : ''}`} style={{ height }} onClick={() => openSheet('amt', { target, onOk: onPick })}>
        {custom ? (
          <span className="hand" style={{ fontSize: 24, lineHeight: 1.1 }}>¥{fmtAmount(sel)}</span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>其他金额</span>
        )}
      </div>
    </div>
  )
}

/** 「其他金额」弹层：数字键盘输入，单次最多 ¥1000 */
export function AmountSheet() {
  const { sheet, sheetData, closeSheet } = useNav()
  const [str, setStr] = useState('')
  const input = useRef(null)
  const open = sheet === 'amt'

  useEffect(() => {
    if (!open) {
      input.current?.blur()
      return
    }
    setStr('')
    // 等弹层滑上来再聚焦，避免键盘和动画抢着推页面
    const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(t)
  }, [open])

  const val = amountOf(str)
  const ok = () => {
    if (!val) return
    sheetData?.onOk?.(val)
    closeSheet()
  }

  return (
    <Sheet id="amt">
      <div className="sheet-title">{sheetData?.target === 'top' ? '校园卡充值金额' : '电费充值金额'}</div>
      <label className="amt-input">
        <span style={{ fontSize: 30 }}>¥</span>
        <input
          ref={input}
          type="text"
          inputMode="decimal"
          value={str}
          placeholder="0"
          onChange={e => setStr(cleanAmount(e.target.value))}
          onKeyDown={e => e.key === 'Enter' && ok()}
        />
      </label>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>单次最多 ¥{AMOUNT_MAX}</div>
      <div className={`btn-primary tap ${val ? '' : 'disabled'}`} onClick={ok} style={{ marginTop: 22 }}>
        确定
      </div>
    </Sheet>
  )
}

/* ---------- 电费 ---------- */

function ElecPage() {
  const { push, toast } = useNav()
  const [sel, setSel] = useState(50)
  return (
    <PushPage id="elec">
      <BackHeader title="电费" right={<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-2)' }}>明细</span>} onRight={() => push('elecLog')} />
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', padding: '0 22px calc(36px + var(--sab))' }}>
        <div className="card" style={{ marginTop: 30, padding: '22px 22px 20px', flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            {SV ? <RoomName size={20} hand={30} /> : <span style={{ fontSize: 20, fontWeight: 700 }}>未绑定寝室</span>}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>{SV ? SV.addr : '绑定寝室即将支持'}</span>
          </div>
          <div style={{ height: 1, background: 'oklch(0.92 0.01 250)', margin: '16px 0 14px' }} />
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>剩余电量</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            {/* 没有读数时只放一道灰色短横；荧光笔是垫在数字下沿的，垫在横线下面会和它分家 */}
            {SV ? (
              <span className="hand hl" style={{ fontSize: 72, lineHeight: 1, marginLeft: -4, '--hl-at': '66%' }}>{SV.elec.left}</span>
            ) : (
              <span className="hand" style={{ fontSize: 72, lineHeight: 1, color: 'var(--ink-4)' }}>--</span>
            )}
            <span style={{ fontSize: 16, fontWeight: 600 }}>度</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>{SV ? SV.elec.hint : '绑定寝室后显示剩余电量'}</div>
          <div className="tape" />
        </div>

        <div style={{ marginTop: 30, flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 6px' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>充值金额</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>¥{ELEC_RATE} / 度</span>
          </div>
          <AmountGrid amounts={ELEC_AMOUNTS} sel={sel} onPick={setSel} target="elec" height={68} sub={v => `约 ${degOf(v)} 度`} />
        </div>

        <div style={{ flex: 1, minHeight: 30 }} />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, flex: 'none' }}>校园卡余额 ¥{BALANCE.toFixed(2)}</div>
        <div className="btn-primary tap" style={{ gap: 6, flex: 'none' }} onClick={() => toast(SV ? '电费充值即将支持' : '还没绑定寝室，电费充值即将支持')}>
          支付 <span className="hand" style={{ fontSize: 22, fontWeight: 400 }}>¥{fmtAmount(sel)}</span>
        </div>
      </div>
    </PushPage>
  )
}

function ElecLogPage() {
  const [tab, setTab] = useState('use')
  return (
    <PushPage id="elecLog" z={12}>
      <BackHeader title="电费明细" />
      <div className="seg" style={{ display: 'flex', margin: '20px 22px 0', flex: 'none' }}>
        {[
          ['use', '用电'],
          ['pay', '充值'],
        ].map(([k, t]) => (
          <div key={k} className={`seg-item ${tab === k ? 'on' : ''}`} style={{ flex: 1, height: 36 }} onClick={() => setTab(k)}>
            {t}
          </div>
        ))}
      </div>
      <div className="page-scroll" style={{ paddingBottom: 40 }}>
        {!SV ? (
          <EmptyNote size={24} tip={tab === 'use' ? '绑定寝室后显示用电记录' : '还没有充值记录'} style={{ padding: '80px 0 0' }} />
        ) : tab === 'use' ? (
          <ElecUse e={SV.elec} />
        ) : (
          <ElecPays e={SV.elec} />
        )}
      </div>
    </PushPage>
  )
}

/** 用电：本月已用 + 近 7 天柱状图 + 每日列表（新的一天在上） */
function ElecUse({ e }) {
  const max = Math.max(...e.days.map(d => d.v))
  const avg = e.days.reduce((a, d) => a + d.v, 0) / e.days.length
  return (
    <>
      <div style={{ position: 'relative', margin: '26px 22px 0' }}>
        <div className="card" style={{ padding: '20px 20px 16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 12, color: 'var(--ink-3)' }}>
            <span>{new Date().getMonth() + 1} 月已用</span>
            <span style={{ marginLeft: 'auto' }}>约 ¥{(e.month * ELEC_RATE).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span className="hand hl" style={{ fontSize: 56, lineHeight: 1, marginLeft: -4, '--hl-at': '66%' }}>{e.month}</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>度</span>
          </div>
          <div style={{ height: 1, background: 'oklch(0.92 0.01 250)', margin: '16px 0 12px' }} />
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>近 7 天</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>日均 {avg.toFixed(1)} 度</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 8, height: 128, marginTop: 10 }}>
            {e.days.map(d => (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
                <span className="hand" style={{ fontSize: 14, lineHeight: 1, color: 'var(--ink-2)' }}>{d.v.toFixed(1)}</span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 26,
                    height: Math.round(16 + (d.v / max) * 76),
                    borderRadius: '8px 8px 4px 4px',
                    background: d.today ? 'oklch(0.93 0.1 100)' : 'oklch(0.93 0.035 230)',
                    border: '1.2px solid var(--line)',
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: d.today ? 800 : 500, color: d.today ? 'var(--ink)' : 'var(--ink-3)' }}>{d.wd}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tape" />
      </div>
      <div style={{ margin: '28px 28px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>每日用电</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {e.days.slice().reverse().map(d => (
            <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: LINE }}>
              <span className="hand" style={{ width: 52, fontSize: 18 }}>{d.date}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>{d.today ? '今天' : `周${d.wd}`}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>¥{(d.v * ELEC_RATE).toFixed(2)}</span>
              <span style={{ width: 64, textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                <span className="hand" style={{ fontSize: 18, fontWeight: 400 }}>{d.v.toFixed(1)}</span> 度
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/** 充值：本学期合计 + 记录列表 */
function ElecPays({ e }) {
  return (
    <div style={{ margin: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>充值记录</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>本学期共 ¥{e.payTotal.toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        {e.pays.map(p => (
          <div key={p.date + p.time} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: LINE }}>
            <span className="hand" style={{ width: 52, fontSize: 18 }}>{p.date}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>充值 · {p.via}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                {p.time} · +{(p.amount / ELEC_RATE).toFixed(1)} 度
              </div>
            </div>
            <span className="hand" style={{ fontSize: 22 }}>¥{p.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- 校园卡 ---------- */

function CardPage() {
  const { push, toast } = useNav()
  const name = useStore(s => s.profile.name).trim()
  const actions = [
    ['qr', '付款码'],
    ['bankLock', '挂失'],
    ['lock', '改密'],
  ]
  return (
    <PushPage id="card">
      <BackHeader title="校园卡" />
      <div className="page-scroll" style={{ paddingBottom: 'calc(36px + var(--sab))' }}>
        <div style={{ position: 'relative', margin: '28px 22px 0' }}>
          <div className="campus-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.06em' }}>校园卡</span>
              <StateChip label={SV ? '正常' : '未绑定'} ok={!!SV} bg="#fff" style={{ marginLeft: 'auto', padding: '4px 10px', gap: 5 }} />
            </div>
            <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--ink-2)' }}>余额</div>
            <div className="hand" style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
              <span style={{ fontSize: 26 }}>¥</span>
              <span style={{ fontSize: 58, lineHeight: 1 }}>{BALANCE.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10, fontSize: 13, color: '#46527A' }}>
              <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '未设置'}</span>
              <span className="hand" style={{ marginLeft: 'auto', fontSize: 17, flex: 'none' }}>{SV?.cardNo ?? 'No.—'}</span>
            </div>
          </div>
          <div className="tape" style={{ left: 'auto', right: 44, width: 76, marginLeft: 0, transform: 'rotate(4deg)', background: 'oklch(0.92 0.04 10 / .75)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, margin: '24px 22px 0' }}>
          <div className="btn-primary tap" style={{ flex: 1, height: 52, gap: 8 }} onClick={() => push('topup')}>
            <Icon name="wallet" size={20} />
            充值
          </div>
          {actions.map(([ic, label]) => (
            <div key={label} className="tap" onClick={() => toast(`${label}即将支持`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div className="round-btn" style={{ width: 52, height: 52 }}>
                <Icon name={ic} size={21} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ margin: '26px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>账单</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>本月支出 ¥{(SV?.bills.month ?? 0).toFixed(2)}</span>
          </div>
          {SV ? (
            SV.bills.groups.map((g, gi) => (
              <div key={g.label}>
                <div className="hand" style={{ fontSize: 16, color: 'var(--ink-3)', marginTop: gi ? 10 : 14 }}>{g.label}</div>
                {g.items.map(b => (
                  <div key={b.title + b.time} style={{ display: 'flex', alignItems: 'center', padding: '9px 0' }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{b.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 14 }}>{b.time}</span>
                    <span className="hand" style={{ width: 64, textAlign: 'right', fontSize: 19, color: b.amount > 0 ? 'oklch(0.5 0.1 155)' : undefined }}>
                      {b.amount > 0 ? `+${fmtAmount(b.amount)}` : `−${Math.abs(b.amount).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <EmptyNote tip="充值或消费后会显示在这里" />
          )}
        </div>
      </div>
    </PushPage>
  )
}

const PAYS = [
  ['wx', '微信支付'],
  ['ali', '支付宝'],
  ['bank', '银行卡'],
]

function TopupPage() {
  const { toast } = useNav()
  const name = useStore(s => s.profile.name).trim()
  const [sel, setSel] = useState(100)
  const [pay, setPay] = useState('wx')
  return (
    <PushPage id="topup" z={12}>
      <BackHeader title="充值" />
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', padding: '0 22px calc(36px + var(--sab))' }}>
        <div className="topup-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>校园卡</div>
            <div className="hand" style={{ fontSize: 15, color: '#46527A', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {SV?.cardNo ?? 'No.—'} · {name || '未设置'}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>当前余额</div>
            <div className="hand" style={{ fontSize: 24, lineHeight: 1.1 }}>¥{BALANCE.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ marginTop: 28, flex: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, padding: '0 6px' }}>充值金额</div>
          <AmountGrid amounts={TOPUP_AMOUNTS} sel={sel} onPick={setSel} target="top" height={60} />
        </div>

        <div style={{ marginTop: 28, flex: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, padding: '0 6px' }}>支付方式</div>
          <div className="list-group" style={{ marginTop: 12 }}>
            {PAYS.map(([k, label]) => (
              <div key={k} className="pay-row" onClick={() => setPay(k)}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                <span className={`radio ${pay === k ? 'on' : ''}`} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 30 }} />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, flex: 'none' }}>充值后余额 ¥{(BALANCE + sel).toFixed(2)}</div>
        <div className="btn-primary tap" style={{ gap: 6, flex: 'none' }} onClick={() => toast(SV ? '校园卡充值即将支持' : '校园卡还没绑定，充值即将支持')}>
          确认充值 <span className="hand" style={{ fontSize: 22, fontWeight: 400 }}>¥{fmtAmount(sel)}</span>
        </div>
      </div>
    </PushPage>
  )
}
