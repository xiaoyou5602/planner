// 编辑资料：头像底色、名字、寝室；学号 / 学院要等教务系统绑定，先只读显示「未绑定」。
import { useState } from 'react'
import { useNav } from '../nav.jsx'
import { getState, setProfile } from '../lib/store.js'
import { services as SV } from '../lib/demo.js'
import { BackHeader, PushPage } from '../ui.jsx'
import { AVATAR_COLORS, initialOf } from './Me.jsx'

export function EditPage() {
  const { params } = useNav()
  const p = params.edit
  return (
    <PushPage id="edit">
      {p ? <EditForm key={p.token} /> : <BackHeader title="编辑资料" />}
    </PushPage>
  )
}

function EditForm() {
  const { pop, toast, openSheet } = useNav()
  // 打开时拷一份草稿，点「保存」才写入；直接返回就是放弃修改
  const [d, setD] = useState(() => ({ ...getState().profile }))
  const upd = patch => setD(x => ({ ...x, ...patch }))

  const save = () => {
    setProfile({ name: d.name.trim(), avatar: d.avatar, dorm: d.dorm.trim() })
    toast('已保存')
    pop()
  }

  return (
    <>
      <BackHeader title="编辑资料" right="保存" onRight={save} />
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', padding: '0 22px calc(36px + var(--sab))' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 34, flex: 'none' }}>
          <div className="avatar" style={{ width: 104, height: 104, fontSize: 42, background: AVATAR_COLORS[d.avatar] || AVATAR_COLORS[0] }}>
            {initialOf(d.name)}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {AVATAR_COLORS.map((c, i) => (
              <div
                key={c}
                className="tap"
                onClick={() => upd({ avatar: i })}
                role="button"
                aria-label={`头像底色 ${i + 1}`}
                style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${i === d.avatar ? 'var(--ink)' : 'transparent'}`, padding: 3 }}
              >
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: c, border: '1px solid var(--line)' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="box" style={{ marginTop: 30, overflow: 'hidden', flex: 'none' }}>
          <label className="field-row" style={{ height: 56 }}>
            <span className="k">名字</span>
            <input value={d.name} onChange={e => upd({ name: e.target.value })} maxLength={12} placeholder="输入名字" />
          </label>
          <div className="field-row" style={{ height: 56 }}>
            <span className="k">学号</span>
            <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>{SV?.sid ?? '未绑定'}</span>
          </div>
          <div className="field-row" style={{ height: 56 }}>
            <span className="k">学院</span>
            <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>{SV?.college ?? '未绑定'}</span>
          </div>
          <label className="field-row" style={{ height: 56 }}>
            <span className="k">寝室</span>
            <input value={d.dorm} onChange={e => upd({ dorm: e.target.value })} maxLength={20} placeholder="如 东 3108" />
          </label>
        </div>
        <div style={{ margin: '12px 6px 0', fontSize: 12, color: 'var(--ink-3)', flex: 'none' }}>学号、学院会在绑定教务系统后同步，不可修改</div>

        {/* 内容不满一屏时把按钮顶到底部，键盘弹出 / 屏幕矮时跟着内容往下排，不会盖住输入框 */}
        <div style={{ flex: 1, minHeight: 30 }} />
        <div className="btn-danger tap" onClick={() => openSheet('wipe')} style={{ flex: 'none' }}>
          清空数据
        </div>
      </div>
    </>
  )
}
