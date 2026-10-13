// 洗浴 / 电费 / 校园卡的界面计算。第一版不接真实接口，这里只放价格常量和纯计算，方便单测。

export const ELEC_RATE = 0.538 // 元 / 度
export const BATH_RATE = 0.3 // 元 / 分钟
export const ELEC_AMOUNTS = [10, 20, 50, 100, 200]
export const TOPUP_AMOUNTS = [50, 100, 200, 300, 500]
export const AMOUNT_MAX = 1000

/** 「其他金额」输入框：只留数字和一个小数点，最多两位小数，超过上限按上限 */
export function cleanAmount(raw) {
  let v = String(raw).replace(/[^\d.]/g, '')
  const [a, b] = v.split('.')
  v = b !== undefined ? `${a}.${b.slice(0, 2)}` : a
  if (parseFloat(v) > AMOUNT_MAX) v = String(AMOUNT_MAX)
  return v
}

/** 输入框文字 → 金额；不是正数返回 0 */
export function amountOf(str) {
  const n = parseFloat(str)
  return n > 0 ? Math.round(n * 100) / 100 : 0
}

/** 充值金额大约能买多少度电（取整） */
export const degOf = amount => Math.round(amount / ELEC_RATE)

/** 洗浴计时 mm:ss */
export function fmtClock(sec) {
  const p = n => String(n).padStart(2, '0')
  return `${p(Math.floor(sec / 60))}:${p(sec % 60)}`
}

/** 洗浴已用金额，两位小数 */
export const bathCost = sec => ((sec / 60) * BATH_RATE).toFixed(2)

/** 金额显示：整数不带小数，其余保留原样（最多两位） */
export const fmtAmount = n => String(Math.round(n * 100) / 100)
