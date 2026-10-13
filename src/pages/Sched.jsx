// 课表：7 列周网格，节次行 + 饭点分隔行，今天画圈，左右滑动 / 按钮切周。
import { useEffect, useRef, useState } from 'react'
import { useNav } from '../nav.jsx'
import { courseColors } from '../lib/palette.js'
import { gridRows, rangeText, weekBlocks } from '../lib/schedule.js'
import { useStore } from '../lib/store.js'
import { MON_EN, WD, currentWeek, fmtMin, toISO, totalWeeksOf, weekDates } from '../lib/time.js'
import { useNow } from '../ui.jsx'

const TODAY_FG = 'oklch(0.55 0.17 25)'
const TODAY_RING = 'oklch(0.6 0.17 25)'
const SWIPE = 60
const FIT = 13

const arrow = d => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
    {d}
  </svg>
)

export function SchedPage() {
  const { tab, push, openSheet } = useNav()
  const state = useStore()
  const { settings, palette } = state
  const now = useNow()
  const totalWeeks = totalWeeksOf(settings)
  const cur = Math.min(totalWeeks, currentWeek(settings.startDate, now))

  const [view, setView] = useState({ week: cur, dx: 0, anim: true })
  // 改了开学日期（或跨到新的一周）就回到本周
  useEffect(() => setView(v => ({ ...v, week: cur, dx: 0 })), [cur, totalWeeks])

  const jump = target => {
    const w = Math.max(1, Math.min(totalWeeks, target))
    if (w === view.week) return setView(v => ({ ...v, dx: 0, anim: true }))
    // 新的一周从滑动方向那侧滑进来
    setView({ week: w, dx: (w > view.week ? 1 : -1) * 90, anim: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setView(v => ({ ...v, dx: 0, anim: true }))))
  }

  // 横向拖动切周；竖向手势交给页面，拖动后吞掉那次点击
  const drag = useRef(null)
  const suppress = useRef(false)
  const onDown = e => {
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, moved: false, id: e.pointerId, el: e.currentTarget }
  }
  const onMove = e => {
    const g = drag.current
    if (!g) return
    const dx = e.clientX - g.x
    if (!g.moved) {
      if (Math.abs(e.clientY - g.y) > 10 && Math.abs(e.clientY - g.y) > Math.abs(dx)) {
        drag.current = null
        return
      }
      if (Math.abs(dx) <= 6) return
      g.moved = true
      g.el.setPointerCapture?.(g.id)
    }
    g.dx = dx
    setView(v => ({ ...v, dx, anim: false }))
  }
  const onUp = () => {
    const g = drag.current
    drag.current = null
    if (!g || !g.moved) return
    suppress.current = true
    setTimeout(() => (suppress.current = false), 60)
    if (g.dx < -SWIPE && view.week < totalWeeks) jump(view.week + 1)
    else if (g.dx > SWIPE && view.week > 1) jump(view.week - 1)
    else setView(v => ({ ...v, dx: 0, anim: true }))
  }

  const days = weekDates(settings.startDate, view.week, now)
  const todayISO = toISO(now)
  const isThisWeek = days.some(d => toISO(d) === todayISO)
  const grid = gridRows(settings, days[0])
  const blocks = weekBlocks(state, view.week, days, grid)
  // 超过 FIT 节时格高按 FIT 节算，多出来的上下滑，单节课的名字才放得下
  const scroll = grid.periods.length > FIT
  const tall = scroll ? `${(grid.periods.length / FIT) * 100}%` : '100%'
  const open = b => {
    if (suppress.current) return
    openSheet('detail', { kind: b.kind, id: b.id, slot: b.slot, date: b.date })
  }

  return (
    <div className={`page tab-page ${tab === 'sched' ? '' : 'off'}`}>
      <div className="status-gap" />
      <div style={{ padding: '8px 16px 12px 24px', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hand" style={{ fontSize: 40, lineHeight: 1 }}>
            Week <span className="hl" style={{ '--hl': 'oklch(0.93 0.1 100)', '--hl-at': '60%' }}>{view.week}</span>
          </div>
          <div style={{ fontSize: 12, color: '#5B6687', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isThisWeek ? '本周 · ' : ''}
            {rangeText(days)}
            {!settings.startDate && (
              <span className="tap" onClick={() => push('time')} style={{ marginLeft: 6, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                设置开学日期
              </span>
            )}
          </div>
        </div>
        {view.week !== cur && (
          <div
            className="tap"
            onClick={() => jump(cur)}
            style={{ height: 38, padding: '0 12px', border: '1.5px solid var(--ink)', borderRadius: 999, background: 'oklch(0.93 0.1 100)', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5, transform: 'rotate(-3deg)', flex: 'none' }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            回本周
          </div>
        )}
        <div className={`week-btn ${view.week <= 1 ? 'disabled' : 'tap'}`} onClick={() => view.week > 1 && jump(view.week - 1)} aria-label="上一周">
          {arrow(
            <>
              <path d="M19 12H5" />
              <polyline points="12 5 5 12 12 19" />
            </>,
          )}
        </div>
        <div className={`week-btn ${view.week >= totalWeeks ? 'disabled' : 'tap'}`} onClick={() => view.week < totalWeeks && jump(view.week + 1)} aria-label="下一周">
          {arrow(
            <>
              <path d="M5 12h14" />
              <polyline points="12 5 19 12 12 19" />
            </>,
          )}
        </div>
      </div>

      <div style={{ display: 'flex', padding: '0 8px 4px', flex: 'none' }}>
        <div className="hand" style={{ width: 30, flex: 'none', fontSize: 15, color: '#5B6687', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {MON_EN[days[0].getMonth()]}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))' }}>
          {days.map((d, i) => {
            const today = toISO(d) === todayISO
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', color: today ? TODAY_FG : 'var(--ink)' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{WD[i]}</span>
                <span className="hand day-num" style={{ color: today ? TODAY_FG : '#5B6687', '--ring': today ? TODAY_RING : 'transparent' }}>
                  {d.getDate() === 1 ? `${d.getMonth() + 1}月` : d.getDate()}
                  <span className="ring1" />
                  <span className="ring2" />
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', padding: '0 8px calc(var(--nav-bottom) + 72px)', position: 'relative' }}>
        <div className={scroll ? 'sched-scroll' : undefined} style={{ flex: 1, minWidth: 0, overflowY: scroll ? 'auto' : 'visible', overscrollBehavior: 'contain' }}>
          <div style={{ display: 'flex', height: tall }}>
            <div style={{ width: 30, flex: 'none', display: 'grid', gridTemplateRows: grid.template }}>
              {grid.rows.map((r, i) =>
                r.type === 'p' ? (
                  <div key={i} style={{ gridRow: i + 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                    <span className="hand" style={{ fontSize: 18, lineHeight: 1 }}>{r.p}</span>
                    <span style={{ fontSize: 9, color: 'var(--tab-ink)' }}>{fmtMin(r.start)}</span>
                  </div>
                ) : null,
              )}
            </div>
            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{ flex: 1, minWidth: 0, overflow: 'hidden', touchAction: 'pan-y' }}
            >
              <div
                className="week-grid"
                style={{
                  gridTemplateRows: grid.template,
                  transform: `translateX(${view.dx}px)`,
                  transition: view.anim ? 'transform .32s cubic-bezier(.2,.8,.2,1), opacity .32s' : 'none',
                  opacity: Math.max(0.5, 1 - Math.abs(view.dx) / 260),
                }}
              >
                {blocks.map(b => {
                  const c = b.kind === 'course' ? courseColors(palette, b.hue) : null
                  const w = 100 / b.lanes
                  return (
                    <div
                      key={b.key}
                      className={`blk ${b.kind}`}
                      onClick={() => open(b)}
                      style={{
                        gridColumn: b.day + 1,
                        gridRow: `${b.r1} / ${b.r2 + 1}`,
                        width: `calc(${w}% - 4px)`,
                        marginLeft: `calc(${w * b.lane}% + 2px)`,
                        ...(c && { background: c.bg, borderColor: c.bd }),
                      }}
                    >
                      <span className="n">{b.name}</span>
                      {b.room && <span className="r">{b.room}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        {!blocks.length && (
          <div className="empty-hand" style={{ position: 'absolute', left: 38, right: 8, top: '40%', pointerEvents: 'none' }}>
            free week ~
          </div>
        )}
      </div>

      <div
        className="tap"
        onClick={() => push('course', { mode: 'add', week: view.week })}
        aria-label="添加"
        style={{
          position: 'absolute', right: 20, bottom: 'calc(var(--nav-bottom) - 2px)', width: 58, height: 58, borderRadius: '50%',
          border: '1.2px solid var(--line)', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px oklch(0.6 0.03 250 / .14)', zIndex: 9,
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    </div>
  )
}
