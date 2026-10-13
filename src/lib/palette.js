// 课程色卡：每门课只存一个色相 hue，真正的底色和描边由当前色卡算出来。
// 预设数值来自原型 PALS；自定义色卡存在 store.palette.custom 里。

export const PRESETS = {
  soft: { label: '奶油', bg: [0.93, 0.035], bd: [0.74, 0.06] },
  vivid: { label: '汽水', bg: [0.89, 0.075], bd: [0.66, 0.11] },
  mist: { label: '雾灰', bg: [0.945, 0.018], bd: [0.78, 0.03] },
  warm: { label: '晚霞', bg: [0.92, 0.05], bd: [0.72, 0.08], warm: true },
}

// 「导入色卡」按这个顺序把 HEX 列表分配给色相
export const HUES = [255, 155, 20, 300, 210, 75, 50, 185, 125, 230, 0, 95]

// 添加课程页可选的 6 个颜色
export const PICK_HUES = [255, 155, 25, 300, 80, 200]

export function resolvePalette(pal) {
  const key = pal?.current
  return PRESETS[key] || pal?.custom?.[key] || PRESETS.soft
}

function hueOf(p, h) {
  if (p.warm) return 10 + ((h * 0.37) % 110)
  if (p.shift) return (h + p.shift) % 360
  return h
}

/** 某色相在色卡下的颜色。which: 'bg' 底色 | 'bd' 描边 */
export function palColor(p, h, which) {
  if (p.list?.length) {
    const i = HUES.indexOf(h)
    const hex = p.list[(i < 0 ? Math.round(h / 30) : i) % p.list.length]
    return which === 'bg' ? hex : `color-mix(in oklch, ${hex} 60%, #2E3A5C)`
  }
  const [l, c] = p[which]
  return `oklch(${l} ${c} ${hueOf(p, h).toFixed(0)})`
}

export function courseColors(pal, hue) {
  const p = resolvePalette(pal)
  return { bg: palColor(p, hue, 'bg'), bd: palColor(p, hue, 'bd') }
}

/** 新课程默认挑一个现有课程用得最少的颜色 */
export function pickFreeHue(courses) {
  const used = new Map(PICK_HUES.map(h => [h, 0]))
  courses.forEach(c => used.has(c.hue) && used.set(c.hue, used.get(c.hue) + 1))
  return PICK_HUES.reduce((best, h) => (used.get(h) < used.get(best) ? h : best), PICK_HUES[0])
}

// 色卡格子上的 5 个小圆点用这几个色相
export const DOT_HUES = [255, 155, 25, 300, 80]

// 新建色卡时的预览课程块
export const PREVIEW = [
  ['高数', 255],
  ['数据结构', 155],
  ['英语', 20],
  ['线代', 300],
  ['物理', 210],
  ['近代史', 50],
]

// 「自己调色」三个滑块的范围，和原型一致
export const MIX_RANGE = { L: [0.84, 0.97], C: [0.01, 0.12], H: [0, 359] }
export const MIX_DEFAULT = { L: 0.92, C: 0.05, H: 0 }

const r3 = x => Math.round(x * 1000) / 1000

/** 按滑块生成色卡：底色 oklch(L C hue+H)，描边 L-0.19、C+0.03 */
export function mixPalette(label, { L, C, H }) {
  return { label, bg: [r3(L), r3(C)], bd: [r3(Math.max(0.5, L - 0.19)), r3(C + 0.03)], shift: Math.round(H) % 360 }
}

/** 从任意文本（HEX 列表、JSON、CSS）里提取 #RRGGBB，去重、转大写 */
export function parseHex(text) {
  const found = String(text || '').match(/#?\b[0-9a-f]{6}\b/gi) || []
  return [...new Set(found.map(x => '#' + x.replace('#', '').toUpperCase()))]
}

/** 色卡名最多 8 个字 */
export const palLabel = name => [...name.trim()].slice(0, 8).join('')
