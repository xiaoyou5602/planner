// 添加 / 编辑课程与日程（同一页，添加时顶部可切换）。
import { useState } from 'react'
import { useNav } from '../nav.jsx'
import { courseColors, pickFreeHue, PICK_HUES } from '../lib/palette.js'
import { getState, saveCourse, saveEvent, useStore } from '../lib/store.js'
import { courseWeeksText, maxLenFrom, slotClock, weeksHint } from '../lib/schedule.js'
import { WD, addDays, buildPeriods, currentWeek, fmtMin, mondayOf, parseISO, toISO, toMin, totalWeeksOf, weekDates, weekdayIdx } from '../lib/time.js'
import { BackHeader, Chips, PushPage, StepperRow } from '../ui.jsx'

const WD_OPTS = WD.map((w, i) => [i, w])
const PARITY_OPTS = [
  [null, '每周'],
  ['odd', '单周'],
  ['even', '双周'],
]
const REMIND_OPTS = [
  [0, '不提醒'],
  [1, '10 分钟前'],
  [2, '30 分钟前'],
]
const EV_STEP = 15

export function CoursePage() {
  const { params } = useNav()
  const p = params.course
  return (
    <PushPage id="course" z={13}>
      {p ? <Editor key={p.token} p={p} /> : <BackHeader title="添加" />}
    </PushPage>
  )
}

/** 按打开时的参数生成草稿；之后只改草稿，点「保存」才写入 */
function initDraft(p) {
  const { settings, courses, events } = getState()
  const today = new Date()
  const totalWeeks = totalWeeksOf(settings)
  const cur = Math.min(totalWeeks, currentWeek(settings.startDate, today))
  const week = p.week || cur
  const course = (p.mode === 'edit' && p.kind === 'course' && courses.find(c => c.id === p.id)) || null
  const ev = (p.mode === 'edit' && p.kind === 'event' && events.find(e => e.id === p.id)) || null
  const day = p.day ?? weekdayIdx(today)

  return {
    mode: p.mode,
    kind: p.kind || 'course',
    course: course
      ? { ...course, slots: course.slots.map(s => ({ ...s })) }
      : { name: '', room: '', teacher: '', note: '', slots: [{ day, start: 1, len: 2 }], ws: cur, we: Math.min(totalWeeks, Math.max(cur, 16)), parity: null, hue: pickFreeHue(courses) },
    ev: ev
      ? { ...ev, day: weekdayIdx(parseISO(ev.date)), mon: toISO(mondayOf(parseISO(ev.date))) }
      : { title: '', day, st: 1140, et: 1200, place: '', remind: 1, mon: toISO(weekDates(settings.startDate, week, today)[0]) },
  }
}

function Editor({ p }) {
  const { pop, toast, openSheet } = useNav()
  const [d, setD] = useState(() => initDraft(p))
  const settings = useStore(s => s.settings)
  const palette = useStore(s => s.palette)
  const periods = buildPeriods(settings)
  const total = periods.length
  const totalWeeks = totalWeeksOf(settings)

  const isAdd = d.mode === 'add'
  const isCourse = d.kind === 'course'
  const c = d.course
  const ev = d.ev
  const updC = patch => setD(x => ({ ...x, course: { ...x.course, ...patch } }))
  const updEv = patch => setD(x => ({ ...x, ev: { ...x.ev, ...patch } }))
  const updSlot = (i, patch) => updC({
    slots: c.slots.map((s, j) => {
      if (j !== i) return s
      const changedSection = Object.hasOwn(patch, 'start') || Object.hasOwn(patch, 'len')
      return { ...s, ...(changedSection ? { customStart: null, customEnd: null } : {}), ...patch }
    }),
  })
  const updWeekRule = patch => updC({ ...patch, weeks: null })

  const colors = courseColors(palette, c.hue)
  const title = isAdd ? '添加' : isCourse ? '课程详情' : '日程详情'
  const evDate = addDays(parseISO(ev.mon), ev.day)

  const save = () => {
    if (isCourse) {
      saveCourse({ ...c, name: c.name.trim() || '未命名课程', room: c.room.trim(), teacher: c.teacher.trim(), note: c.note.trim() })
      toast(isAdd ? '课程已添加' : '已保存')
    } else {
      const { day, mon, ...rest } = ev
      saveEvent({ ...rest, title: ev.title.trim() || '未命名日程', place: ev.place.trim(), date: toISO(evDate) })
      toast(isAdd ? '日程已添加' : '已保存')
    }
    pop()
  }

  // 删除先弹确认弹层，真正的删除在 Sheets 里的 delItem 弹层完成
  const remove = () => openSheet('delItem', isCourse ? { kind: 'course', id: c.id, name: c.name.trim() || '未命名课程' } : { kind: 'event', id: ev.id, name: ev.title.trim() || '未命名日程' })

  // 系统时钟选的时间可以精确到分钟；开始不早于结束，冲突时把另一头往后/往前推 1 小时
  const pickSt = v => {
    const st = toMin(v)
    updEv(st < ev.et ? { st } : { st, et: Math.min(1439, st + 60) })
  }
  const pickEt = v => {
    const et = toMin(v)
    if (et > ev.st) updEv({ et })
    else if (et > 0) updEv({ et, st: Math.max(0, et - 60) })
  }

  return (
    <>
      <BackHeader title={title} right="保存" onRight={save} />
      <div className="page-scroll" style={{ padding: '0 22px calc(40px + var(--sab))' }}>
        {isAdd && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, marginTop: 20, borderRadius: 999, border: '1.2px solid var(--line)', background: '#fff' }}>
            {[
              ['course', '课程'],
              ['event', '日程'],
            ].map(([k, label]) => (
              <div key={k} className={`kind-tab tap ${d.kind === k ? 'on' : ''}`} onClick={() => setD(x => ({ ...x, kind: k }))}>
                {label}
              </div>
            ))}
          </div>
        )}

        {isCourse ? (
          <>
            <div style={{ position: 'relative', marginTop: 26 }}>
              <div style={{ borderRadius: 24, background: colors.bg, border: `1.2px solid ${colors.bd}`, padding: '22px 22px 18px', transition: 'background .3s, border-color .3s' }}>
                <input className="bare-input" value={c.name} onChange={e => updC({ name: e.target.value })} placeholder="课程名称" style={{ width: '100%', fontSize: 24, fontWeight: 700 }} />
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#46527A', marginTop: 8 }}>
                  {c.slots.map(sl => `周${WD[sl.day]} ${slotClock(periods, sl)}`).join('　·　')}
                </div>
              </div>
              <div className="tape" />
            </div>

            <div className="box" style={{ marginTop: 14, overflow: 'hidden' }}>
              <label className="field-row">
                <span className="k">教室</span>
                <input value={c.room} onChange={e => updC({ room: e.target.value })} placeholder="如 教三 201" />
              </label>
              <label className="field-row">
                <span className="k">老师</span>
                <input value={c.teacher} onChange={e => updC({ teacher: e.target.value })} placeholder="选填" />
              </label>
              <label className="field-row" style={{ alignItems: 'flex-start', height: 'auto', padding: '15px 18px 14px' }}>
                <span className="k" style={{ lineHeight: '22px' }}>备注</span>
                <textarea value={c.note} onChange={e => updC({ note: e.target.value })} placeholder="作业、考试、要带的东西…" rows={2} />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', margin: '22px 0 10px 6px' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>上课时间</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 8 }}>每周 {c.slots.length} 次</span>
              <div
                className="tap"
                onClick={() => {
                  const last = c.slots[c.slots.length - 1]
                  updC({ slots: [...c.slots, { day: (last.day + 2) % 7, start: last.start, len: last.len }] })
                }}
                aria-label="再加一个时间段"
                style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', border: '1.2px solid var(--line)', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <line x1="12" y1="5" x2="12" y2="19" />
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.slots.map((sl, i) => {
                const start = Math.min(sl.start, total)
                const maxLen = maxLenFrom(periods, start)
                const setStart = v => updSlot(i, { start: v, len: Math.min(sl.len, maxLenFrom(periods, v)) })
                return (
                  <div key={i} className="box" style={{ padding: '12px 14px 4px' }}>
                    {c.slots.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 10px 4px' }}>
                    <span className="hand" style={{ fontSize: 17, color: 'var(--ink-2)' }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 8 }}>{slotClock(periods, sl)}</span>
                        <span className="tap" onClick={() => updC({ slots: c.slots.filter((_, j) => j !== i) })} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'oklch(0.52 0.15 25)', padding: '2px 4px' }}>
                          删除
                        </span>
                      </div>
                    )}
                    {sl.customStart && sl.customEnd && (
                      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--ink-3)', margin: '-4px 4px 8px' }}>
                        这是导入的准确钟点；调整节次后会改用当前作息。
                      </div>
                    )}
                    <Chips options={WD_OPTS} value={sl.day} onPick={v => updSlot(i, { day: v })} />
                    <StepperRow label="开始" prefix="第" num={start} unit="节" min={1} max={total} onChange={setStart} style={{ marginTop: 6 }} />
                    <StepperRow label="连上" num={Math.min(sl.len, maxLen)} unit="节" min={1} max={maxLen} onChange={v => updSlot(i, { start, len: v })} last />
                  </div>
                )
              })}
            </div>

            <div className="sec-title">周次</div>
            <div className="box" style={{ padding: '4px 14px 14px' }}>
              {Array.isArray(c.weeks) && c.weeks.length > 0 && (
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)', padding: '8px 2px 10px' }}>
                  导入周次：{courseWeeksText(c)}。调整下面任一项后会改成规则周次。
                </div>
              )}
              <StepperRow label="从" prefix="第" num={c.ws} unit="周" min={1} max={c.we} onChange={v => updWeekRule({ ws: v })} />
              <StepperRow label="到" prefix="第" num={c.we} unit="周" min={c.ws} max={totalWeeks} onChange={v => updWeekRule({ we: v })} last />
              <div style={{ marginTop: 4 }}>
                <Chips options={PARITY_OPTS} value={c.parity} onPick={v => updWeekRule({ parity: v })} />
              </div>
              {!Array.isArray(c.weeks) && (
                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 10, padding: '0 2px' }}>{weeksHint(c.ws, c.we, c.parity)}</div>
              )}
            </div>

            <div className="sec-title">颜色</div>
            <div style={{ display: 'flex', gap: 10, padding: '0 4px' }}>
              {PICK_HUES.map(h => {
                const hc = courseColors(palette, h)
                return (
                  <div key={h} className="tap" onClick={() => updC({ hue: h })} style={{ width: 42, height: 42, borderRadius: '50%', border: `2px solid ${h === c.hue ? 'var(--ink)' : 'transparent'}`, padding: 3 }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: hc.bg, border: `1.2px solid ${hc.bd}` }} />
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: 26, borderRadius: 24, background: '#fff', border: '1.2px solid var(--line)', padding: 22 }}>
              <input className="bare-input" value={ev.title} onChange={e => updEv({ title: e.target.value })} placeholder="日程标题" style={{ width: '100%', fontSize: 24, fontWeight: 700 }} />
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>
                {evDate.getMonth() + 1}月{evDate.getDate()}日 周{WD[ev.day]}
                <span className="hand" style={{ fontSize: 17, color: 'var(--ink)', marginLeft: 10 }}>
                  {fmtMin(ev.st)}–{fmtMin(ev.et)}
                </span>
              </div>
            </div>

            <div className="sec-title">时间</div>
            <div className="box" style={{ padding: '14px 14px 4px' }}>
              <Chips options={WD_OPTS} value={ev.day} onPick={v => updEv({ day: v })} />
              <StepperRow label="开始" value={fmtMin(ev.st)} num={ev.st} min={0} max={ev.et - EV_STEP} step={EV_STEP} onChange={v => updEv({ st: v })} style={{ marginTop: 6 }}>
                <TimeInput value={ev.st} onPick={pickSt} />
              </StepperRow>
              <StepperRow label="结束" value={fmtMin(ev.et)} num={ev.et} min={ev.st + EV_STEP} max={1439} step={EV_STEP} onChange={v => updEv({ et: v })} last>
                <TimeInput value={ev.et} onPick={pickEt} />
              </StepperRow>
            </div>

            <div className="box" style={{ marginTop: 14, overflow: 'hidden' }}>
              <label className="field-row">
                <span className="k">地点</span>
                <input value={ev.place} onChange={e => updEv({ place: e.target.value })} placeholder="选填" />
              </label>
            </div>

            <div className="sec-title">提醒</div>
            <Chips options={REMIND_OPTS} value={ev.remind} onPick={v => updEv({ remind: v })} height={40} radius={14} />
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, padding: '0 6px' }}>提醒即将支持，现在先记下你的选择，不会响铃。</div>
          </>
        )}

        {!isAdd && (
          <div
            className="tap"
            onClick={remove}
            style={{ marginTop: 30, height: 50, borderRadius: 999, border: '1.2px solid oklch(0.8 0.06 25)', color: 'oklch(0.52 0.15 25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, background: '#fff' }}
          >
            {isCourse ? '删除课程' : '删除日程'}
          </div>
        )}
      </div>
    </>
  )
}

/** 盖在时间数字上的透明时间输入框：点数字调起系统时钟 */
function TimeInput({ value, onPick }) {
  return (
    <input
      type="time"
      className="time-pick"
      value={fmtMin(value)}
      onClick={e => {
        try {
          e.currentTarget.showPicker?.()
        } catch {
          // 不支持 showPicker 的 WebView 点击本身也会弹出时钟
        }
      }}
      onChange={e => e.target.value && onPick(e.target.value)}
      aria-label="选择时间"
    />
  )
}
