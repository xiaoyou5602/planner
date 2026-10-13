import { useNav } from '../nav.jsx'
import { services as SV } from '../lib/demo.js'
import { homeState } from '../lib/schedule.js'
import { useStore } from '../lib/store.js'
import { MON_EN_SHORT, WD_EN, fmtMin, weekdayIdx } from '../lib/time.js'
import { Icon, useNow } from '../ui.jsx'

export function HomePage() {
  const { tab, push, openSheet } = useNav()
  const state = useStore()
  const now = useNow()
  const h = homeState(state, now)
  const dateLine = `${WD_EN[weekdayIdx(now)]} ${MON_EN_SHORT[now.getMonth()]} ${now.getDate()} · week ${h.week}`
  const detail = x => openSheet('detail', { kind: x.kind, id: x.id, slot: x.slot, date: x.date })

  const onCard = () => {
    if (h.mode === 'empty') push('course', { mode: 'add' })
    else if (h.next) detail(h.next)
    else if (h.tmr) detail(h.tmr)
    else push('course', { mode: 'add' })
  }

  const tmrLine = h.tmr && (
    <>
      <div style={{ height: 1, background: 'oklch(0.92 0.01 250)', margin: '18px 0 14px' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 'none' }}>{h.tmr.label}</span>
        <span className="hand" style={{ fontSize: 20, flex: 'none' }}>{fmtMin(h.tmr.start)}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.tmr.name}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 'none' }}>{h.tmr.room}</span>
      </div>
    </>
  )

  return (
    <div className={`page tab-page ${tab === 'home' ? '' : 'off'}`}>
      <div className="status-gap" />
      <div style={{ padding: '12px 26px 0', display: 'flex', alignItems: 'flex-end', gap: 12, flex: 'none' }}>
        <div className="page-title" style={{ flex: 'none' }}>首页</div>
        <div className="hand" style={{ marginLeft: 'auto', fontSize: 19, color: 'var(--ink-3)', paddingBottom: 3 }}>{dateLine}</div>
      </div>

      <div style={{ position: 'relative', margin: '26px 22px 0', flex: 'none' }}>
        <div className="card tap" style={{ padding: '24px 22px 22px' }} onClick={onCard}>
          {h.mode === 'next' && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="hand" style={{ fontSize: 20, color: 'var(--ink-2)' }}>next up</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{h.countdown}</span>
              </div>
              <div className="hand" style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                <span className="hl" style={{ fontSize: 76, lineHeight: 0.95, marginLeft: -4, '--hl-at': '66%' }}>{fmtMin(h.next.start)}</span>
                <span style={{ fontSize: 22, color: 'var(--ink-3)' }}>– {fmtMin(h.next.end)}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, lineHeight: 1.3, textWrap: 'pretty', overflowWrap: 'anywhere' }}>{h.next.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                {h.next.room && <span>{h.next.room}</span>}
                {h.next.teacher && <span>{h.next.teacher}</span>}
                <span>{h.next.periods}</span>
              </div>
            </>
          )}
          {h.mode === 'done' && (
            <>
              <div className="hand" style={{ fontSize: 20, color: 'var(--ink-2)' }}>all done ~</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, lineHeight: 1.3 }}>今天的课上完啦</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{h.count} 节都上完了，早点休息</div>
              {tmrLine}
            </>
          )}
          {h.mode === 'free' && (
            <>
              <div className="hand" style={{ fontSize: 20, color: 'var(--ink-2)' }}>free day</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, lineHeight: 1.3 }}>
                <span className="hl" style={{ marginLeft: -4 }}>今天没有课</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{h.freeTip}</div>
              {tmrLine}
            </>
          )}
          {h.mode === 'empty' && (
            <>
              <div className="hand" style={{ fontSize: 20, color: 'var(--ink-2)' }}>hello ~</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, lineHeight: 1.3 }}>还没有课程</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>点这里添加第一门课，首页会提醒你下一节</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, height: 40, padding: '0 18px', borderRadius: 999, background: 'var(--ink)', color: 'var(--paper)', fontSize: 14, fontWeight: 700 }}>
                添加课程
              </div>
            </>
          )}
          <div className="tape" />
        </div>
      </div>

      <div style={{ margin: '30px 28px 0', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>今天</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{h.count ? `共 ${h.count} 节 · 还剩 ${h.remain} 节` : '没有课'}</span>
          {!state.settings.startDate && h.mode !== 'empty' && (
            <span className="tap" onClick={() => push('time')} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 2 }}>
              设置开学日期
              <Icon name="chevron" size={13} />
            </span>
          )}
        </div>
        {!h.all.length && (
          <div className="hand" style={{ marginTop: 14, fontSize: 22, color: 'var(--ink-4)' }}>nothing here ~</div>
        )}
        <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10, flex: 1 }}>
          {h.all.map(x => {
            const done = x.st === 'done'
            return (
              <div key={`${x.kind}${x.id}#${x.slot ?? ''}`} className="tap" onClick={() => detail(x)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', opacity: done ? 0.45 : 1, flex: 'none' }}>
                <span className="hand" style={{ width: 46, flex: 'none', fontSize: 18, color: 'var(--ink-2)' }}>{fmtMin(x.start)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done ? 'line-through' : 'none' }}>
                  {x.name}
                </span>
                <span style={{ flex: 'none', fontSize: 12, color: 'var(--ink-3)', maxWidth: '40%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {x.kind === 'event' ? x.room || '日程' : x.room}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, margin: '12px 22px 0', marginBottom: 'calc(var(--nav-bottom) + 78px)', flex: 'none' }}>
        <ServiceTile bg="oklch(0.96 0.025 230)" onClick={() => push('bath')}>
          <Icon name="water" size={24} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>洗浴</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{SV ? SV.room.join('') : '未绑定'}</span>
          </div>
        </ServiceTile>
        <ServiceTile bg="oklch(0.97 0.035 100)" onClick={() => push('elec')}>
          <Icon name="bolt" size={24} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>电费</span>
            <span className="hand" style={{ fontSize: 15, color: 'var(--ink-2)' }}>{SV ? `${SV.elec.left}°` : '—'}</span>
          </div>
        </ServiceTile>
        <ServiceTile bg="oklch(0.965 0.02 10)" onClick={() => push('card')}>
          <span className="hand" style={{ fontSize: 20, lineHeight: '24px' }}>¥{(SV?.balance ?? 0).toFixed(2)}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>校园卡</span>
        </ServiceTile>
      </div>
    </div>
  )
}

function ServiceTile({ bg, onClick, children }) {
  return (
    <div
      className="tap"
      onClick={onClick}
      style={{ height: 76, borderRadius: 18, background: bg, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
    >
      {children}
    </div>
  )
}
