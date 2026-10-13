import { Capacitor } from '@capacitor/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import catalog from '../data/shiguang-adapters.json'
import { adapterEntryLabel, adapterFlow, genericSystemName, isGenericSchoolAdapter, isShareCodeAdapter } from '../lib/importAdapterFlow.js'
import { importSummaryText, prepareShiguangImport } from '../lib/importSchedule.js'
import { SchoolImportNative } from '../lib/schoolImportNative.js'
import { applyScheduleImport, getState, useStore } from '../lib/store.js'
import { useNav } from '../nav.jsx'
import { BackHeader, PushPage, Sheet } from '../ui.jsx'

const SHEET_ID = 'schoolImport'

const SHARE_ADAPTERS = catalog.adapters.filter(isShareCodeAdapter)
const GENERIC_ADAPTERS = catalog.adapters.filter(isGenericSchoolAdapter)
const SCHOOL_ADAPTERS = catalog.adapters.filter(item => !isShareCodeAdapter(item) && !isGenericSchoolAdapter(item))

// 同一所学校有几个入口时，列表里才写出入口差别
const MULTI_ENTRY = (() => {
  const count = {}
  for (const item of SCHOOL_ADAPTERS) count[item.schoolName] = (count[item.schoolName] || 0) + 1
  return new Set(Object.keys(count).filter(name => count[name] > 1))
})()

const SHARE_SUBTITLE = {
  WakeUp: '粘贴分享口令',
  星链课表: '粘贴分享码',
}

function validUrl(value) {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : null
  } catch {
    return null
  }
}

function SectionTitle({ children, first }) {
  return <div style={{ margin: first ? '4px 6px 9px' : '24px 6px 9px', fontSize: 15, fontWeight: 700 }}>{children}</div>
}

function Row({ title, subtitle, onClick, right = '›', rowRef }) {
  return (
    <div ref={rowRef} className="list-row tall tap" onClick={onClick} style={{ height: 'auto', minHeight: 60, padding: '10px 14px 10px 16px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
        )}
      </div>
      <span style={{ fontSize: 18, color: 'var(--ink-4)', flex: 'none' }}>{right}</span>
    </div>
  )
}

export function SchoolImportPage() {
  const { pop, toast, openSheet } = useNav()
  const existingCount = useStore(s => s.courses.length)
  const [query, setQuery] = useState('')
  const [schoolsOpen, setSchoolsOpen] = useState(false)
  const [preview, setPreview] = useState(null)
  const [replaceArmed, setReplaceArmed] = useState(false)
  const finderRef = useRef(null)
  const searchRef = useRef(null)

  const schoolAdapters = useMemo(() => {
    const key = query.trim().toLocaleLowerCase('zh-CN')
    if (!key) return SCHOOL_ADAPTERS
    return SCHOOL_ADAPTERS.filter(item => [item.schoolName, item.name].some(value => String(value || '').toLocaleLowerCase('zh-CN').includes(key)))
  }, [query])

  // 展开学校查找时，把点的那一行移到顶上，搜索框就在它正下方
  useEffect(() => {
    if (!schoolsOpen) return
    finderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const t = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(t)
  }, [schoolsOpen])

  const open = adapter => openSheet(SHEET_ID, {
    adapter,
    onImported: prepared => {
      setReplaceArmed(false)
      setPreview({ adapter, prepared })
    },
  })

  const apply = async mode => {
    if (!preview) return
    await applyScheduleImport(preview.prepared, mode)
    toast(mode === 'replace' ? '已替换为导入课表' : '课表已合并')
    pop()
  }

  return (
    <PushPage id="schoolImport">
      <BackHeader title="从 App 或教务导入" />
      <div className="page-scroll" style={{ padding: '16px 22px calc(36px + var(--sab))' }}>
        {preview ? (
          <ImportPreview
            preview={preview}
            existingCount={existingCount}
            replaceArmed={replaceArmed}
            onCancel={() => { setPreview(null); setReplaceArmed(false) }}
            onMerge={() => apply('merge')}
            onReplace={() => replaceArmed ? apply('replace') : setReplaceArmed(true)}
          />
        ) : (
          <>
            <SectionTitle first>从课表 App 导入</SectionTitle>
            <div className="list-group" style={{ overflow: 'hidden' }}>
              {SHARE_ADAPTERS.map(adapter => {
                const flow = adapterFlow(adapter)
                return <Row key={adapter.id} title={flow.sourceName} subtitle={SHARE_SUBTITLE[flow.sourceName]} onClick={() => open(adapter)} />
              })}
            </div>

            <SectionTitle>通用教务系统</SectionTitle>
            <div className="list-group" style={{ overflow: 'hidden' }}>
              {GENERIC_ADAPTERS.map(adapter => (
                <Row key={`${adapter.schoolId}:${adapter.id}`} title={genericSystemName(adapter)} subtitle="填学校教务网址" onClick={() => open(adapter)} />
              ))}
            </div>

            <SectionTitle>已适配的学校</SectionTitle>
            <div className="list-group" style={{ overflow: 'hidden' }}>
              <Row
                rowRef={finderRef}
                title="搜索学校"
                subtitle={`${SCHOOL_ADAPTERS.length} 个学校入口，找到就不用填网址`}
                right={<span style={{ display: 'inline-block', transform: `rotate(${schoolsOpen ? 90 : 0}deg)`, transition: 'transform .2s' }}>›</span>}
                onClick={() => setSchoolsOpen(value => !value)}
              />
            </div>

            {schoolsOpen && (
              <>
                <div className="box" style={{ marginTop: 12, height: 50, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <input
                    ref={searchRef}
                    className="bare-input"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
                    enterKeyHint="search"
                    placeholder="输入学校名"
                    style={{ width: '100%', fontSize: 14 }}
                  />
                  {query && <span className="tap" onClick={() => setQuery('')} style={{ fontSize: 12, color: 'var(--ink-3)', padding: 8, flex: 'none' }}>清除</span>}
                </div>
                {schoolAdapters.length > 0 ? (
                  <div className="list-group" style={{ overflow: 'hidden', marginTop: 10 }}>
                    {schoolAdapters.map(adapter => {
                      const tags = [MULTI_ENTRY.has(adapter.schoolName) && adapterEntryLabel(adapter), adapter.category === 'POSTGRADUATE' && '研究生'].filter(Boolean)
                      return <Row key={`${adapter.schoolId}:${adapter.id}`} title={adapter.schoolName} subtitle={tags.join(' · ')} onClick={() => open(adapter)} />
                    })}
                  </div>
                ) : (
                  <div style={{ marginTop: 22, textAlign: 'center', fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-3)' }}>
                    没找到这所学校，请使用通用教务系统导入
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PushPage>
  )
}

/** 点任一导入方式后从底部弹出：说明、填网址、打开教务窗口都在这里完成 */
export function SchoolImportSheet() {
  const { sheet, sheetData, closeSheet, toast } = useNav()
  const isOpen = sheet === SHEET_ID
  const adapter = sheetData?.adapter
  const flow = adapter ? adapterFlow(adapter) : null
  const shareCode = flow?.kind === 'share-code'
  const generic = isGenericSchoolAdapter(adapter)
  const needsUrl = Boolean(adapter) && !shareCode && !adapter.importUrl
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      input.current?.blur()
      return
    }
    setUrl(adapter?.importUrl || '')
    if (!needsUrl) return
    // 等弹层滑上来再聚焦，避免键盘和动画抢着推页面
    const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(t)
  }, [isOpen, sheetData])

  if (!adapter) return <Sheet id={SHEET_ID} />

  const title = shareCode ? `从 ${flow.sourceName} 导入` : generic ? genericSystemName(adapter) : adapter.schoolName
  const entry = !shareCode && !generic && MULTI_ENTRY.has(adapter.schoolName) ? adapterEntryLabel(adapter) : ''
  const insecure = !shareCode && url.trim().startsWith('http://')
  const urlOk = Boolean(validUrl(url.trim()))

  const launch = async () => {
    if (running) return
    const target = validUrl(url.trim())
    if (!target) return toast('请填写有效的教务网址')
    if (!Capacitor.isNativePlatform()) return toast('教务登录导入需要在安卓 App 中使用')
    setRunning(true)
    try {
      const result = await SchoolImportNative.open({
        url: target,
        assetPath: adapter.assetPath,
        title: shareCode ? adapter.name : `${adapter.schoolName} · ${adapter.name}`,
        mode: flow.kind,
        instructions: flow.instructions,
      })
      if (result?.cancelled || !result?.data) return
      const prepared = prepareShiguangImport(JSON.parse(result.data), getState().settings, {
        schoolId: adapter.schoolId,
        schoolName: adapter.schoolName,
        adapterId: adapter.id,
        adapterName: adapter.name,
        maintainer: adapter.maintainer,
      })
      closeSheet()
      sheetData?.onImported?.(prepared)
    } catch (error) {
      toast(error?.message || '课表导入失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Sheet id={SHEET_ID}>
      <div className="sheet-title">{title}</div>
      {entry && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{entry}</div>}
      <div className="sheet-sub">
        {shareCode
          ? flow.instructions
          : needsUrl
            ? '填学校教务系统的登录网址。登录后进到「我的课表」页面，再点导入。'
            : '会打开学校教务登录页，登录后按页面提示导入。'}
      </div>
      {needsUrl && (
        <input
          ref={input}
          value={url}
          onChange={event => setUrl(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && launch()}
          type="url"
          inputMode="url"
          enterKeyHint="go"
          placeholder="https://jwxt.你的学校.edu.cn/"
          className="bare-input"
          style={{ width: '100%', height: 46, borderBottom: '1.2px solid var(--line)', marginTop: 12, fontSize: 14 }}
        />
      )}
      {insecure && (
        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: 'oklch(0.5 0.14 45)', marginTop: 10 }}>
          这个网址没有加密（http），同一网络里的人可能看到登录内容，确认是学校官网再继续。
        </div>
      )}
      {!shareCode && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 12 }}>在单独的窗口里登录，账号密码不会保存。</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10, marginTop: 20 }}>
        <div className="btn-ghost tap" onClick={closeSheet}>取消</div>
        <div className={`btn-primary tap ${urlOk ? '' : 'disabled'}`} onClick={launch}>
          {running ? '正在打开…' : flow.actionLabel}
        </div>
      </div>
    </Sheet>
  )
}

function ImportPreview({ preview, existingCount, replaceArmed, onCancel, onMerge, onReplace }) {
  const { adapter, prepared } = preview
  const samples = prepared.courses.slice(0, 6)
  return (
    <>
      <div className="box" style={{ padding: '18px' }}>
        <div className="hand" style={{ fontSize: 20, color: 'var(--ink-2)' }}>preview</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 5 }}>{adapter.schoolName}</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 8 }}>{importSummaryText(prepared.summary)}</div>
        {prepared.warnings.length > 0 && (
          <div style={{ fontSize: 11, lineHeight: 1.55, color: 'oklch(0.52 0.15 25)', marginTop: 10 }}>
            另有 {prepared.warnings.length} 条无效数据已跳过。
          </div>
        )}
      </div>

      <div style={{ margin: '20px 6px 9px', fontSize: 15, fontWeight: 700 }}>课程预览</div>
      <div className="list-group">
        {samples.map((course, index) => (
          <div key={`${course.name}:${index}`} className="list-row tall" style={{ height: 'auto', minHeight: 60, padding: '9px 16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{course.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                {course.teacher || '未写老师'} · {course.room || '未写教室'} · {course.slots.length} 个时间
              </div>
            </div>
          </div>
        ))}
      </div>
      {prepared.courses.length > samples.length && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 8 }}>还有 {prepared.courses.length - samples.length} 门课程</div>
      )}

      <div className="box" style={{ marginTop: 18, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)' }}>
          当前已有 {existingCount} 门课程。合并会保留手动课程，并自动替换同一适配上次导入的内容；替换会清掉当前课程，但保留日程、个人资料和色卡。
        </div>
        {replaceArmed && (
          <div style={{ fontSize: 12, lineHeight: 1.55, color: 'oklch(0.52 0.15 25)', marginTop: 9 }}>
            再点一次「确认替换」才会清掉当前课程。
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 14 }}>
          <div className="btn-ghost tap" onClick={onCancel}>返回重选</div>
          <div className="btn-primary tap" onClick={onMerge}>合并（推荐）</div>
          <div className={`tap ${replaceArmed ? 'btn-danger solid' : 'btn-ghost'}`} onClick={onReplace} style={{ gridColumn: '1 / -1', height: 46 }}>
            {replaceArmed ? '确认替换当前课程' : '替换当前课程'}
          </div>
        </div>
      </div>
    </>
  )
}
