// 点课程 / 日程弹出的简略详情卡（浮在底部导航之上），可进入编辑。
import { useRef } from 'react'
import { useNav } from '../nav.jsx'
import { courseColors } from '../lib/palette.js'
import { courseWeeksText, periodLabel, slotClock } from '../lib/schedule.js'
import { useStore } from '../lib/store.js'
import { WD, buildPeriods, fmtMin, parseISO, weekdayIdx } from '../lib/time.js'

const REMIND = ['不提醒', '提前 10 分钟', '提前 30 分钟']

export function DetailCard() {
  const { sheet, sheetData, closeSheet, push, toast } = useNav()
  const state = useStore()
  const on = sheet === 'detail'

  // 关闭或删除后仍保留上一次的内容，让退场动画不至于变空白
  const last = useRef(null)
  const content = sheetData && build(state, sheetData)
  if (content) last.current = content
  const c = content || last.current

  const edit = () => {
    if (!sheetData) return
    closeSheet()
    setTimeout(() => push('course', { mode: 'edit', kind: sheetData.kind, id: sheetData.id }), 180)
  }

  return (
    <div className={`detail-card ${on ? 'on' : ''}`} aria-hidden={!on}>
      {c && (
        <div className="inner">
          <div style={{ fontSize: 23, fontWeight: 700, overflowWrap: 'anywhere' }}>
            <span style={{ background: `linear-gradient(transparent 55%, ${c.soft} 55%)`, padding: '0 4px' }}>{c.name}</span>
          </div>
          <div className="rows">
            {c.rows.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <div className="btn-ghost tap" style={{ height: 48 }} onClick={edit}>
              编辑
            </div>
            {c.kind === 'course' ? (
              <div className="btn-primary tap" style={{ height: 48, fontSize: 15 }} onClick={() => toast('调课即将支持')}>
                调课
              </div>
            ) : (
              <div className="btn-primary tap" style={{ height: 48, fontSize: 15 }} onClick={closeSheet}>
                好的
              </div>
            )}
          </div>
          <div className="tape" />
        </div>
      )}
    </div>
  )
}

function Row({ k, v }) {
  return (
    <>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </>
  )
}

function build(state, { kind, id, slot, date }) {
  if (kind === 'course') {
    const c = state.courses.find(x => x.id === id)
    if (!c) return null
    const sl = c.slots[slot] || c.slots[0]
    const periods = buildPeriods(state.settings, date)
    const weeks = courseWeeksText(c)
    const rows = [
      [
        'time',
        <>
          周{WD[sl.day]} · {periodLabel(sl)} · <span className="hand" style={{ fontSize: 17 }}>{slotClock(periods, sl)}</span>
        </>,
      ],
    ]
    if (c.room) rows.push(['room', c.room])
    if (c.teacher) rows.push(['teacher', c.teacher])
    if (c.credit) rows.push(['credit', c.credit])
    rows.push(['weeks', weeks])
    if (c.note) rows.push(['note', c.note])
    return { kind, name: c.name, soft: courseColors(state.palette, c.hue).bg, rows }
  }
  const ev = state.events.find(x => x.id === id)
  if (!ev) return null
  const d = parseISO(ev.date)
  const rows = [
    [
      'time',
      <>
        {d.getMonth() + 1}月{d.getDate()}日 周{WD[weekdayIdx(d)]} · <span className="hand" style={{ fontSize: 17 }}>{fmtMin(ev.st)}–{fmtMin(ev.et)}</span>
      </>,
    ],
  ]
  if (ev.place) rows.push(['place', ev.place])
  rows.push(['remind', ev.remind ? `${REMIND[ev.remind]}（即将支持）` : REMIND[0]])
  return { kind, name: ev.title, soft: 'oklch(0.96 0.05 100)', rows }
}
