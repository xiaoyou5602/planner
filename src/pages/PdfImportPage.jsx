// 导入 PDF 课表：选文件 → 自动读完 → 小课表预览 → 一个按钮导入，导完能撤销。
import { useEffect, useMemo, useRef, useState } from 'react'
import { mergePdfCourses, parsePdfWeeks, recognizePdfCourses, summarizePdfDraft, validatePdfCandidate } from '../lib/pdfCourses.js'
import { courseWeeksText, gridRows, periodLabel } from '../lib/schedule.js'
import { applyPdfImport, removeCourses, useStore } from '../lib/store.js'
import { WD, buildPeriods } from '../lib/time.js'
import { useNav } from '../nav.jsx'
import { BackHeader, Chips, PushPage, Sheet, StepperRow } from '../ui.jsx'

const FIX_SHEET = 'pdfFix'
const WARN = 'oklch(0.52 0.15 25)'
const WD_OPTS = WD.map((w, i) => [i, w])

export function PdfImportPage() {
  const { stack } = useNav()
  return (
    <PushPage id="pdfImport">
      <BackHeader title="导入 PDF 课表" />
      {/* 每次进来都是全新的一页，离开就丢掉上次的读取结果 */}
      {stack.includes('pdfImport') && <PdfImportBody />}
    </PushPage>
  )
}

function PdfImportBody() {
  const { reset, setTab, toast, openSheet } = useNav()
  const settings = useStore(s => s.settings)
  const existing = useStore(s => s.courses)
  const [phase, setPhase] = useState({ name: 'idle' })
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const picker = useRef(null)
  const run = useRef(0)

  const pick = () => {
    if (picker.current) picker.current.value = '' // 同一个文件再选一次也能触发
    picker.current?.click()
  }
  const onFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    const id = ++run.current
    setPhase({ name: 'reading', page: 0, total: 0 })
    try {
      const { readPdfFile } = await import('../lib/pdfFile.js')
      const doc = await readPdfFile(file, (page, total) => id === run.current && setPhase({ name: 'reading', page, total }))
      if (id !== run.current) return
      const recognized = recognizePdfCourses(doc.pages)
      setItems(recognized.candidates.map((item, i) => ({ ...item, key: `r${i}` })))
      const hasText = doc.pages.some(page => page.blocks.length)
      setPhase({ name: 'result', doc, pending: recognized.pending, hasText })
    } catch (error) {
      if (id === run.current) setPhase({ name: 'error', message: error?.message || '读取失败，请换一个文件试试' })
    }
  }
  useEffect(() => () => { run.current++ }, [])

  const doc = phase.doc
  const summary = useMemo(() => summarizePdfDraft(items, settings, existing, doc?.sha256 || ''), [items, settings, existing, doc])

  const editItem = (item, reasons) => openSheet(FIX_SHEET, {
    item,
    reasons,
    onSave: next => setItems(list => list.map(x => (x.key === item.key ? next : x))),
    onDrop: () => setItems(list => list.filter(x => x.key !== item.key)),
  })
  const addFromText = pendingItem => {
    const item = { key: `m${Date.now()}`, name: '', day: '', start: '', end: '', weeksText: '', teacher: '', room: '', rawText: pendingItem.rawText, source: pendingItem.source }
    setItems(list => [...list, item])
    editItem(item, [])
  }

  const doImport = async () => {
    if (busy || !summary.freshMeetings) return
    setBusy(true)
    try {
      const outcome = await applyPdfImport(summary.courses)
      reset()
      setTab('sched')
      toast(`已导入 ${summary.names} 门课`, {
        label: '撤销',
        run: async () => {
          await removeCourses(outcome.ids)
          toast('已撤销这次导入')
        },
      })
    } catch (error) {
      toast(error?.message || '保存失败，请再试一次')
      setBusy(false)
    }
  }

  return (
    <div className="page-scroll" style={{ padding: '16px 22px calc(36px + var(--sab))' }}>
      <input ref={picker} type="file" accept="application/pdf,.pdf" onChange={onFile} style={{ display: 'none' }} />

      {phase.name === 'idle' && (
        <>
          <div className="box" style={{ padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>选教务系统导出的 PDF 课表</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 8 }}>
              在手机上读取，不会上传。读完先给你看一眼课表，再决定导不导。
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-3)', marginTop: 8 }}>
              能长按选中文字的 PDF 才能读；扫描件、截图转的 PDF 暂时不行。
            </div>
          </div>
          <div className="btn-primary tap" style={{ marginTop: 18 }} onClick={pick}>选择 PDF</div>
        </>
      )}

      {phase.name === 'reading' && (
        <div className="box" role="status" style={{ padding: 18, fontSize: 15, fontWeight: 700 }}>
          {phase.total ? `正在读第 ${phase.page + 1} / ${phase.total} 页…` : '正在打开文件…'}
        </div>
      )}

      {phase.name === 'error' && (
        <>
          <div className="box" role="alert" style={{ padding: 18, fontSize: 14, lineHeight: 1.7 }}>{phase.message}</div>
          <div className="btn-primary tap" style={{ marginTop: 18 }} onClick={pick}>换一个文件</div>
        </>
      )}

      {phase.name === 'result' && (
        <Result
          doc={doc}
          hasText={phase.hasText}
          pending={phase.pending}
          summary={summary}
          settings={settings}
          busy={busy}
          onImport={doImport}
          onPick={pick}
          onFix={editItem}
          onAddFromText={addFromText}
        />
      )}
    </div>
  )
}

function Result({ doc, hasText, pending, summary, settings, busy, onImport, onPick, onFix, onAddFromText }) {
  const { push } = useNav()
  const nothing = !summary.courses.length && !summary.fixes.length
  if (nothing) {
    return (
      <>
        <div className="box" style={{ padding: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{hasText ? '没在这份 PDF 里认出课表' : '这份 PDF 读不出文字'}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 8 }}>
            {hasText ? '目前只认得「横着是星期、竖着是节次」、并写明「(1-2节)」的课表。' : '它可能是扫描件或图片转的 PDF，暂时只能手动添加课程。'}
          </div>
        </div>
        {hasText && <Leftovers pending={pending} onAddFromText={onAddFromText} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
          <div className="btn-ghost tap" onClick={onPick}>换一个文件</div>
          <div className="btn-primary tap" onClick={() => push('course', { mode: 'add', week: 1 })}>手动加课</div>
        </div>
      </>
    )
  }

  const label = !summary.courses.length
    ? '先把下面的课补全'
    : summary.freshMeetings
      ? `导入 ${summary.names} 门课`
      : '这些课已经都在课表里了'
  return (
    <>
      <div className="box" style={{ padding: '16px 18px' }}>
        <div className="hand" style={{ fontSize: 20, color: 'var(--ink-2)' }}>preview</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          读到 {new Set(summary.courses.map(c => c.name)).size} 门课
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.fileName} · {doc.pageCount} 页
        </div>
      </div>

      {summary.courses.length > 0 && <WeekPreview courses={summary.courses} settings={settings} />}

      {summary.fixes.length > 0 && (
        <>
          <div style={{ margin: '22px 6px 9px', fontSize: 15, fontWeight: 700 }}>还差一点信息</div>
          <div className="list-group" style={{ overflow: 'hidden' }}>
            {summary.fixes.map(({ item, reasons }) => (
              <div key={item.key} className="list-row tall tap" onClick={() => onFix(item, reasons)} style={{ height: 'auto', minHeight: 58, padding: '10px 14px 10px 16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{item.name || '未命名课程'}</div>
                  <div style={{ fontSize: 11.5, color: WARN, marginTop: 3 }}>{reasons.join('、')}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', flex: 'none' }}>补全 ›</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '8px 6px 0' }}>补全前不会导入，不影响上面这些课。</div>
        </>
      )}

      <Leftovers pending={pending} onAddFromText={onAddFromText} />

      {summary.duplicateMeetings > 0 && summary.freshMeetings > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '18px 6px 0' }}>
          其中 {summary.duplicateMeetings} 个上课时间已经在课表里，不会重复添加。
        </div>
      )}
      <div className={`btn-primary tap ${summary.freshMeetings && !busy ? '' : 'disabled'}`} style={{ marginTop: 18 }} onClick={onImport}>
        {busy ? '正在导入…' : label}
      </div>
      <div className="btn-ghost tap" style={{ marginTop: 10 }} onClick={onPick}>换一个文件</div>
    </>
  )
}

/** PDF 里认不出时间的内容：默认收起，一行字带过 */
function Leftovers({ pending, onAddFromText }) {
  const [open, setOpen] = useState(false)
  if (!pending.length) return null
  return (
    <div className="box" style={{ marginTop: 18, padding: '12px 16px' }}>
      <div className="tap" onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--ink-2)' }}>
        <span style={{ flex: 1 }}>另有 {pending.length} 段内容没写上课时间，不会放进课表</span>
        <span style={{ display: 'inline-block', transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .2s' }}>›</span>
      </div>
      {open && pending.map((item, i) => (
        <div key={i} style={{ borderTop: '1px solid var(--rule)', marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 160, overflowY: 'auto' }}>{item.rawText}</div>
          <span className="tap" onClick={() => onAddFromText(item)} style={{ display: 'inline-block', marginTop: 6, fontSize: 12.5, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}>
            照着这段加一门课
          </span>
        </div>
      ))}
    </div>
  )
}

/** 和课表页同样的格子，把整学期出现过的上课时间都画出来；点一格看详情 */
function WeekPreview({ courses, settings }) {
  const [picked, setPicked] = useState(null)
  const grid = gridRows(settings)
  const total = grid.periods.length
  const shown = useMemo(() => mergePdfCourses([], courses), [courses])
  // 整学期叠在一张图上，同一天时间重叠的多是不同周轮流上的课：并成一格，点开逐门列出
  const meetings = shown.flatMap(course => course.slots
    .filter(slot => slot.start <= total)
    .map(slot => ({ course, slot, day: slot.day, r1: grid.rowOf[slot.start], r2: grid.rowOf[Math.min(slot.start + slot.len - 1, total)] })))
    .sort((a, b) => a.day - b.day || a.r1 - b.r1)
  const blocks = []
  for (const m of meetings) {
    const last = blocks.at(-1)
    if (last && last.day === m.day && m.r1 <= last.r2) {
      last.r2 = Math.max(last.r2, m.r2)
      last.entries.push(m)
    } else blocks.push({ key: `${m.day}:${m.r1}`, day: m.day, r1: m.r1, r2: m.r2, lane: 0, lanes: 1, entries: [m] })
  }
  const current = blocks.find(b => b.key === picked)
  const describe = ({ course, slot }) => [course.name, `周${WD[slot.day]} ${periodLabel(slot)}`, courseWeeksText(course), course.teacher, course.room].filter(Boolean).join(' · ')
  return (
    <>
      <div className="box" style={{ marginTop: 14, padding: '10px 8px 8px 4px' }}>
        <div style={{ display: 'flex', paddingLeft: 24 }}>
          {WD.map(d => <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 800, paddingBottom: 4 }}>{d}</div>)}
        </div>
        <div style={{ display: 'flex', height: total * 30 }}>
          <div style={{ width: 24, flex: 'none', display: 'grid', gridTemplateRows: grid.template }}>
            {grid.rows.map((r, i) => (r.type === 'p'
              ? <div key={i} className="hand" style={{ gridRow: i + 1, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.p}</div>
              : null))}
          </div>
          <div className="week-grid" style={{ flex: 1, minWidth: 0, gridTemplateRows: grid.template }}>
            {blocks.map(b => {
              const w = 100 / b.lanes
              return (
                <div
                  key={b.key}
                  className="blk"
                  onClick={() => setPicked(k => (k === b.key ? null : b.key))}
                  style={{
                    gridColumn: b.day + 1,
                    gridRow: `${b.r1} / ${b.r2 + 1}`,
                    width: `calc(${w}% - 4px)`,
                    marginLeft: `calc(${w * b.lane}% + 2px)`,
                    background: picked === b.key ? 'var(--yellow)' : 'oklch(0.975 0.03 100)',
                    borderColor: 'var(--ink-3)',
                    padding: '4px 3px',
                  }}
                >
                  <span className="n" style={{ fontSize: 10 }}>{b.entries.length > 1 ? `${b.entries.length} 门课` : b.entries[0].course.name}</span>
                  {b.entries.length > 1 && <span className="r" style={{ fontSize: 9 }}>点开看</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: current ? 'var(--ink)' : 'var(--ink-3)', margin: '8px 6px 0', minHeight: 40 }}>
        {current
          ? current.entries.map((entry, i) => <div key={i} style={{ marginTop: i ? 6 : 0 }}>{describe(entry)}</div>)
          : '整学期的课都画在这一张里；点一格看周次、老师和教室。导入后还能在课表里改。'}
      </div>
    </>
  )
}

/** 补全一门课：从底部弹出，填好才能保存 */
export function PdfFixSheet() {
  const { sheet, sheetData, closeSheet, push } = useNav()
  const settings = useStore(s => s.settings)
  const isOpen = sheet === FIX_SHEET
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    if (!isOpen || !sheetData?.item) return
    const item = sheetData.item
    const start = Number(item.start) || 1
    setDraft({ ...item, start, end: Math.max(start, Number(item.end) || start) })
  }, [isOpen, sheetData])

  if (!draft) return <Sheet id={FIX_SHEET} />
  const total = buildPeriods(settings).length
  const { reasons } = validatePdfCandidate(draft, settings)
  const weeks = parsePdfWeeks(draft.weeksText)
  const set = patch => setDraft(d => ({ ...d, ...patch }))
  const outOfSettings = reasons.some(r => r.includes('超出'))
  const save = () => {
    if (reasons.length) return
    sheetData.onSave({ ...draft, day: Number(draft.day) })
    closeSheet()
  }
  const field = { width: '100%', height: 42, borderBottom: '1.2px solid var(--line)', fontSize: 14 }

  return (
    <Sheet id={FIX_SHEET}>
      <div className="sheet-title">补全这门课</div>
      {draft.rawText && (
        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--ink-3)', marginTop: 6, maxHeight: 72, overflowY: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          PDF 原文：{draft.rawText}
        </div>
      )}
      <div style={{ maxHeight: '58vh', overflowY: 'auto', marginTop: 8 }}>
        <input className="bare-input" style={field} value={draft.name} placeholder="课程名" onChange={e => set({ name: e.target.value })} />
        <div style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 8px' }}>星期几</div>
        <Chips options={WD_OPTS} value={draft.day === '' ? null : Number(draft.day)} onPick={v => set({ day: v })} />
        <StepperRow label="从" prefix="第" num={draft.start} unit="节" min={1} max={Math.max(total, draft.start)} onChange={v => set({ start: v, end: Math.max(v, draft.end) })} style={{ marginTop: 6 }} />
        <StepperRow label="到" prefix="第" num={draft.end} unit="节" min={draft.start} max={Math.max(total, draft.end)} onChange={v => set({ end: v })} last />
        <input className="bare-input" style={{ ...field, marginTop: 10 }} value={draft.weeksText} placeholder="第几周上，如 1-16 或 1-8,10-16(单)" onChange={e => set({ weeksText: e.target.value })} />
        <div style={{ fontSize: 11.5, color: weeks.length || !draft.weeksText ? 'var(--ink-3)' : WARN, marginTop: 5 }}>
          {weeks.length ? `共 ${weeks.length} 周：第 ${weeks.join('、')} 周` : draft.weeksText ? '看不懂这个写法，试试 1-16 或 1,3,5' : '多段用逗号隔开；只上单周就在后面加 (单)'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
          <input className="bare-input" style={field} value={draft.teacher} placeholder="老师（可不填）" onChange={e => set({ teacher: e.target.value })} />
          <input className="bare-input" style={field} value={draft.room} placeholder="教室（可不填）" onChange={e => set({ room: e.target.value })} />
        </div>
      </div>
      {reasons.length > 0 && (
        <div style={{ fontSize: 12, color: WARN, marginTop: 12 }}>
          还差：{reasons.join('、')}
          {outOfSettings && (
            <span className="tap" onClick={() => { closeSheet(); push('time') }} style={{ marginLeft: 8, fontWeight: 700, textDecoration: 'underline', color: 'var(--ink)' }}>去改上课时间</span>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10, marginTop: 16 }}>
        <div className="btn-ghost tap" onClick={() => { sheetData.onDrop(); closeSheet() }}>不要这门</div>
        <div className={`btn-primary tap ${reasons.length ? 'disabled' : ''}`} onClick={save}>保存</div>
      </div>
    </Sheet>
  )
}
