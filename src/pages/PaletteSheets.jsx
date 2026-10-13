// 课程色卡：选预设 / 自定义色卡、新建（自己调色或导入 HEX）、删除自定义色卡。
// 选中、保存、删除都直接写进 store，课表、首页、详情卡跟着变。
import { useRef, useState } from 'react'
import { useNav } from '../nav.jsx'
import { DOT_HUES, MIX_DEFAULT, MIX_RANGE, PRESETS, PREVIEW, mixPalette, palColor, palLabel, parseHex, resolvePalette } from '../lib/palette.js'
import { addPalette, deletePalette, pickPalette, useStore } from '../lib/store.js'
import { Icon, Sheet } from '../ui.jsx'

const newDraft = () => ({ tab: 'mix', name: '', ...MIX_DEFAULT, code: '' })

export function PaletteSheets() {
  const { openSheet } = useNav()
  // 草稿和待删项放在这里而不是弹层数据里：切换弹层时退场动画中的内容不会突然变空
  const [draft, setDraft] = useState(newDraft)
  const [del, setDel] = useState(null)

  const openNew = () => {
    setDraft(newDraft())
    openSheet('palNew')
  }
  const askDelete = (key, label) => {
    setDel({ key, label })
    openSheet('palDel')
  }

  return (
    <>
      <PickSheet onNew={openNew} onDelete={askDelete} />
      <NewSheet draft={draft} setDraft={setDraft} />
      <DeleteSheet item={del} />
    </>
  )
}

function PickSheet({ onNew, onDelete }) {
  const palette = useStore(s => s.palette)
  const all = [...Object.entries(PRESETS), ...Object.entries(palette.custom)]
  // 当前色卡已不存在时实际用的是奶油，高亮也跟着落在奶油上
  const current = PRESETS[palette.current] || palette.custom[palette.current] ? palette.current : 'soft'
  return (
    <Sheet id="pal">
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 18 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>课程色卡</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>当前 · {resolvePalette(palette).label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 16 }}>
        {all.map(([key, p]) => {
          const custom = !PRESETS[key]
          return (
            <div key={key} className={`pal-tile tap ${custom ? 'custom' : ''} ${key === current ? 'on' : ''}`} onClick={() => pickPalette(key)}>
              <Dots p={p} />
              <span className="name">{p.label}</span>
              {custom && (
                <div
                  className="pal-del"
                  role="button"
                  aria-label={`删除色卡 ${p.label}`}
                  onClick={e => {
                    e.stopPropagation()
                    onDelete(key, p.label)
                  }}
                >
                  <svg viewBox="0 0 24 24">
                    <line x1="7" y1="7" x2="17" y2="17" />
                    <line x1="17" y1="7" x2="7" y2="17" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
        <div className="pal-tile add tap" onClick={onNew}>
          <Icon name="plus" size={18} color="#5B6687" />
          新建 / 导入
        </div>
      </div>
    </Sheet>
  )
}

function Dots({ p }) {
  return (
    <div style={{ display: 'flex', paddingLeft: 3, flex: 'none' }}>
      {DOT_HUES.map(h => (
        <span key={h} style={{ width: 18, height: 18, borderRadius: '50%', background: palColor(p, h, 'bg'), border: `1px solid ${palColor(p, h, 'bd')}`, marginLeft: -4 }} />
      ))}
    </div>
  )
}

const pct = (v, [lo, hi]) => String(Math.round(((v - lo) / (hi - lo)) * 100))

function NewSheet({ draft: d, setDraft }) {
  const { openSheet, toast } = useNav()
  const fileRef = useRef(null)
  const upd = patch => setDraft(x => ({ ...x, ...patch }))

  const isMix = d.tab === 'mix'
  const hexes = parseHex(d.code)
  const label = palLabel(d.name)
  const pal = isMix ? mixPalette(label, d) : hexes.length ? { label, list: hexes } : null
  const ok = !!pal && !!label

  const save = () => {
    if (!pal) return toast('没有识别到颜色')
    if (!label) return toast('给色卡起个名字吧')
    addPalette(pal)
    openSheet('pal')
    toast('已添加色卡')
  }

  const onFile = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    f.text()
      .then(t => setDraft(x => ({ ...x, code: t, name: x.name || f.name.replace(/\.[^.]+$/, '') })))
      .catch(() => toast('读取文件失败'))
  }

  const sliders = [
    ['明度', 'L', 0.005, pct(d.L, MIX_RANGE.L)],
    ['浓度', 'C', 0.005, pct(d.C, MIX_RANGE.C)],
    ['色调', 'H', 1, `${d.H}°`],
  ]

  return (
    <Sheet id="palNew">
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
        <div className="tap" onClick={() => openSheet('pal')} role="button" aria-label="返回色卡" style={{ width: 32, height: 32, marginLeft: -6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevronLeft" size={18} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 700 }}>新建色卡</span>
      </div>

      <div className="seg" style={{ display: 'flex', marginTop: 14 }}>
        {[
          ['mix', '自己调色'],
          ['code', '导入色卡'],
        ].map(([k, t]) => (
          <div key={k} className={`seg-item ${d.tab === k ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => upd({ tab: k })}>
            {t}
          </div>
        ))}
      </div>

      <div className="box" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, padding: 14, borderRadius: 18, minHeight: 76, alignContent: 'center' }}>
        {pal ? (
          PREVIEW.map(([name, h]) => (
            <div key={name} style={{ height: 44, padding: '0 12px', borderRadius: 11, background: palColor(pal, h, 'bg'), border: `1.2px solid ${palColor(pal, h, 'bd')}`, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
              {name}
            </div>
          ))
        ) : (
          <div style={{ width: '100%', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>粘贴色卡代码后在这里预览</div>
        )}
      </div>

      <label className="field-row pal-name">
        <span className="k">名称</span>
        <input value={d.name} onChange={e => upd({ name: e.target.value })} placeholder="给色卡起个名字" />
      </label>

      {isMix ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, padding: '0 4px' }}>
          {sliders.map(([t, k, step, show]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, fontSize: 13, fontWeight: 600, flex: 'none' }}>{t}</span>
              <input type="range" className="pal-range" min={MIX_RANGE[k][0]} max={MIX_RANGE[k][1]} step={step} value={d[k]} onChange={e => upd({ [k]: Number(e.target.value) })} />
              <span className="hand" style={{ width: 34, textAlign: 'right', fontSize: 16, color: 'var(--ink-2)', flex: 'none' }}>
                {show}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <>
          <textarea className="box pal-code" value={d.code} onChange={e => upd({ code: e.target.value })} placeholder="粘贴色卡代码，如 #F4D8D8 #D8E6F4 #E2F0D6 …" />
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, padding: '0 4px' }}>
            <span style={{ fontSize: 12, color: d.code && !hexes.length ? 'oklch(0.55 0.15 25)' : 'var(--ink-3)' }}>
              {!d.code ? '支持 HEX 颜色列表或 .json / .txt / .css 文件' : hexes.length ? `识别到 ${hexes.length} 种颜色` : '没有识别到颜色'}
            </span>
            <div className="tap" onClick={() => fileRef.current?.click()} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#5B6687', flex: 'none' }}>
              <Icon name="fileSmall" size={15} color="#5B6687" />
              从文件导入
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".json,.txt,.css,application/json,text/plain,text/css" onChange={onFile} style={{ display: 'none' }} />
        </>
      )}

      <div className={`btn-primary tap ${ok ? '' : 'disabled'}`} onClick={save} style={{ marginTop: 18 }}>
        保存并使用
      </div>
    </Sheet>
  )
}

function DeleteSheet({ item }) {
  const { openSheet, toast } = useNav()
  const doDelete = () => {
    if (item) deletePalette(item.key)
    openSheet('pal')
    toast('已删除色卡')
  }
  return (
    <Sheet id="palDel">
      <div className="sheet-title">确定删除这个色卡？</div>
      <div className="sheet-sub">「{item?.label}」删除后无法恢复；如果正在用它，课程会换回「奶油」色卡。</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 22 }}>
        <div className="btn-ghost tap" onClick={() => openSheet('pal')}>
          取消
        </div>
        <div className="btn-danger solid tap" onClick={doDelete}>
          删除
        </div>
      </div>
    </Sheet>
  )
}
