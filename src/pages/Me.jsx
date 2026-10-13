import { useNav } from '../nav.jsx'
import { useStore } from '../lib/store.js'
import { WD, buildPeriods, parseISO, weekdayIdx } from '../lib/time.js'
import { Icon } from '../ui.jsx'

// 头像底色，与原型一致
export const AVATAR_COLORS = ['oklch(0.93 0.045 230)', 'oklch(0.95 0.06 100)', 'oklch(0.93 0.04 10)', 'oklch(0.93 0.045 155)', 'oklch(0.92 0.04 300)']

/** 头像上的首字；按字符取，名字以表情开头也不会截成半个 */
export const initialOf = name => [...name.trim()][0] || '?'

export function MePage() {
  const { tab, push, openSheet } = useNav()
  const profile = useStore(s => s.profile)
  const settings = useStore(s => s.settings)
  const name = profile.name.trim()
  const start = parseISO(settings.startDate)
  const periodCount = buildPeriods(settings).length
  const p2 = n => String(n).padStart(2, '0')

  return (
    <div className={`page tab-page ${tab === 'me' ? '' : 'off'}`}>
      <div className="status-gap" />
      <div className="page-scroll" style={{ paddingBottom: 'calc(var(--nav-bottom) + 80px)' }}>
        <div style={{ padding: '12px 20px 0 26px', display: 'flex', alignItems: 'center' }}>
          <div className="page-title">我的</div>
          <div className="tap" onClick={() => openSheet('pal')} title="课程色卡" style={{ marginLeft: 'auto', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="palette" size={22} color="var(--ink-3)" />
          </div>
        </div>

        <div
          className="tap"
          onClick={() => push('edit', {})}
          style={{ margin: '24px 26px 0', display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 22, borderBottom: '1.2px dashed oklch(0.86 0.01 250)' }}
        >
          <div className="avatar" style={{ width: 66, height: 66, fontSize: 28, background: AVATAR_COLORS[profile.avatar] || AVATAR_COLORS[0] }}>
            {initialOf(name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '未设置名字'}</div>
            <div className="hand" style={{ fontSize: 17, color: 'var(--ink-3)', marginTop: 2 }}>that's me ~</div>
          </div>
          <div style={{ height: 34, padding: '0 14px', border: '1.2px solid var(--line)', borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>编辑</div>
        </div>

        <div style={{ margin: '28px 22px 0' }}>
          <div className="group-title">上课时间</div>
          <div className="list-group">
            <div className="list-row tap" onClick={() => push('time')}>
              <span className="label">开学日期</span>
              {start ? (
                <span className="hand" style={{ fontSize: 18, color: 'var(--ink-2)' }}>
                  {start.getFullYear()}.{p2(start.getMonth() + 1)}.{p2(start.getDate())} <span style={{ fontFamily: 'var(--font)', fontSize: 12 }}>周{WD[weekdayIdx(start)]}</span>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>未设置</span>
              )}
              <Icon name="chevron" className="chev" />
            </div>
            <div className="list-row tap" onClick={() => push('time')}>
              <span className="label">每天课程</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <span className="hand" style={{ fontSize: 18 }}>{periodCount}</span> 节
              </span>
              <Icon name="chevron" className="chev" />
            </div>
            <div className="list-row tap" onClick={() => push('time')}>
              <span className="label">时长 / 课间</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <span className="hand" style={{ fontSize: 18 }}>{settings.dur}</span> / <span className="hand" style={{ fontSize: 18 }}>{settings.brk}</span> 分钟
              </span>
              <Icon name="chevron" className="chev" />
            </div>
          </div>
        </div>

        <div style={{ margin: '28px 22px 0' }}>
          <div className="group-title">导入课表</div>
          <div className="list-group">
            <div className="list-row tall tap" onClick={() => push('schoolImport')}>
              <Icon name="import" size={21} />
              <span className="label">从 App 或教务导入</span>
              <span className="meta">WakeUp、正方等</span>
              <Icon name="chevron" className="chev" />
            </div>
            <div className="list-row tall tap" onClick={() => push('pdfImport')}>
              <Icon name="file" size={21} />
              <span className="label">导入 PDF 课表</span>
              <span className="meta">教务导出的 PDF</span>
              <Icon name="chevron" className="chev" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
