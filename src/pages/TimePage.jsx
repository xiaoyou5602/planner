// 上课时间：开学日期、各段节数、时长 / 课间、午饭晚饭休息，下方实时预览每节时间。
import { setSettings, useStore } from '../lib/store.js'
import { WD, addDays, buildPeriods, currentWeek, fmtMin, mondayOf, parseISO, periodBreaks, toISO, totalWeeksOf, weekdayIdx } from '../lib/time.js'
import { BackHeader, Icon, PushPage, StepBtn, StepperRow, Toggle } from '../ui.jsx'

const p2 = n => String(n).padStart(2, '0')
const ROW = { height: 50, padding: '0 14px 0 18px' }

export function TimePage() {
  const s = useStore(st => st.settings)
  const courses = useStore(st => st.courses)
  const today = new Date()
  const start = parseISO(s.startDate)
  const week = currentWeek(s.startDate, today)
  const imported = Array.isArray(s.timeSlots) && s.timeSlots.length > 0
  const periods = buildPeriods(s)
  const total = periods.length
  const manualTotal = s.am + s.pm + s.eve
  const set = patch => setSettings(imported ? { ...patch, timeSlots: null, comboSchedule: null } : patch)

  // 三段节数加起来至少 1 节
  const segMin = key => (manualTotal - s[key] <= 0 ? 1 : 0)

  const startNote = !start
    ? '还没设置，暂按第 1 周显示'
    : weekdayIdx(start)
      ? `第 1 周从 ${mondayOf(start).getMonth() + 1}/${mondayOf(start).getDate()} 周一算起`
      : ''

  const openPicker = e => {
    try {
      e.currentTarget.showPicker?.()
    } catch {
      // 部分 WebView 不支持 showPicker，点击本身也会弹出日期选择
    }
  }

  // 超出当天节数的课程会被裁掉，提醒一下
  const overflow = courses.filter(c => c.slots.some(sl => sl.start + sl.len - 1 > total)).length

  const segs = [
    ['上午', periods.filter(p => p.seg === 'am')],
    ['下午', periods.filter(p => p.seg === 'pm')],
    ['晚上', periods.filter(p => p.seg === 'eve')],
  ]
  const breaks = periodBreaks(periods)
  const lunchRange = breaks.lunch ? `${fmtMin(breaks.lunch[0])}–${fmtMin(breaks.lunch[1])}` : '上午或下午没有课'
  const dinnerRange = breaks.dinner ? `${fmtMin(breaks.dinner[0])}–${fmtMin(breaks.dinner[1])}` : '晚上没有课'

  const meals = [
    ['午饭', 'lunchOn', 'lunchMin', lunchRange],
    ['晚饭', 'dinnerOn', 'dinnerMin', dinnerRange],
  ]

  return (
    <PushPage id="time">
      <BackHeader title="上课时间" />
      <div className="page-scroll" style={{ paddingBottom: 'calc(28px + var(--sab))' }}>
        <label className="box tap" style={{ position: 'relative', margin: '18px 22px 0', padding: '0 18px', height: 64, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>开学日期</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              本周是第 {week} 周　{startNote}
            </div>
          </div>
          {start ? (
            <>
              <span className="hand" style={{ fontSize: 20 }}>
                {start.getFullYear()}.{p2(start.getMonth() + 1)}.{p2(start.getDate())}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>周{WD[weekdayIdx(start)]}</span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>去选择</span>
          )}
          <Icon name="chevron" size={16} color="var(--ink-3)" />
          <input
            type="date"
            value={s.startDate || ''}
            min={toISO(addDays(today, -365))}
            max={toISO(addDays(today, 120))}
            onClick={openPicker}
            onChange={e => e.target.value && setSettings({ startDate: e.target.value })}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </label>

        <div className="box" style={{ margin: '14px 22px 0', overflow: 'hidden' }}>
          <StepperRow label="学期总周数" num={totalWeeksOf(s)} unit="周" min={1} max={60} onChange={v => setSettings({ totalWeeks: v })} style={ROW} last />
        </div>

        {imported ? (
          <div className="box" style={{ margin: '14px 22px 0', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>正在使用教务导入作息</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  共 {total} 节{s.comboSchedule?.publicSchedules?.length ? ` · ${s.comboSchedule.publicSchedules.length} 套分季作息` : ''}
                </div>
              </div>
              <div className="tap" onClick={() => setSettings({ timeSlots: null, comboSchedule: null })} style={{ height: 36, padding: '0 13px', border: '1.2px solid var(--line)', borderRadius: 999, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
                改为手动
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="box" style={{ margin: '14px 22px 0', overflow: 'hidden' }}>
              <StepperRow label="上午" num={s.am} unit="节" min={segMin('am')} max={6} onChange={v => set({ am: v })} style={ROW} />
              <StepperRow label="下午" num={s.pm} unit="节" min={segMin('pm')} max={6} onChange={v => set({ pm: v })} style={ROW} />
              <StepperRow label="晚上" num={s.eve} unit="节" min={segMin('eve')} max={5} onChange={v => set({ eve: v })} style={ROW} />
              <StepperRow label="每节时长" num={s.dur} unit="分钟" min={30} max={120} step={5} onChange={v => set({ dur: v })} style={ROW} />
              <StepperRow label="课间休息" num={s.brk} unit="分钟" min={0} max={30} step={5} onChange={v => set({ brk: v })} style={ROW} last />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', margin: '20px 28px 0' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>饭点休息</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>关闭则按课间休息衔接</span>
            </div>
            <div style={{ margin: '10px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {meals.map(([label, onKey, minKey, range]) => {
                const on = s[onKey]
                return (
                  <div key={onKey} style={{ background: '#fff', border: '1.2px solid var(--line)', borderRadius: 18, padding: '12px 12px 10px 14px', minWidth: 0 }}>
                    <div className="tap" onClick={() => set({ [onKey]: !on })} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{label}</span>
                      <Toggle on={on} />
                    </div>
                    {on && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
                        <StepBtn size={28} disabled={s[minKey] <= 30} onClick={() => set({ [minKey]: Math.max(30, s[minKey] - 5) })} />
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                          <span className="hand" style={{ fontSize: 19, color: 'var(--ink)' }}>{s[minKey]}</span> 分钟
                        </span>
                        <StepBtn size={28} plus disabled={s[minKey] >= 180} onClick={() => set({ [minKey]: Math.min(180, s[minKey] + 5) })} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {on ? range : '按课间休息衔接'}
                    </div>
                </div>
                )
              })}
            </div>
          </>
        )}

        <div style={{ margin: '18px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', padding: '0 6px' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>预览</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>每天 {total} 节</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 10 }}>
            {segs.map(([label, items]) => (
              <div key={label} style={{ borderRadius: 16, background: 'oklch(0.97 0.012 230)', padding: '10px 10px 8px', minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                {items.map(it => (
                  <div key={it.p} style={{ display: 'flex', alignItems: 'baseline', gap: 5, padding: '2px 0', whiteSpace: 'nowrap' }}>
                    <span className="hand" style={{ fontSize: 14, width: 14, color: 'var(--ink-3)' }}>{it.p}</span>
                    <span style={{ fontSize: 10.5, color: '#46527A', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMin(it.start)}–{fmtMin(it.end)}
                    </span>
                  </div>
                ))}
                {!items.length && <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '2px 0' }}>没有课</div>}
              </div>
            ))}
          </div>
          {overflow > 0 && (
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'oklch(0.55 0.15 25)', marginTop: 12, padding: '0 6px' }}>
              有 {overflow} 门课的节次超出了每天 {total} 节，超出的部分在课表里暂时不显示。
            </div>
          )}
        </div>
      </div>
    </PushPage>
  )
}
