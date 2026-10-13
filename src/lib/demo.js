// 演示数据：网址带 ?demo=1 时整个 App 用假数据，存在单独的 campus.demo.v1 里（改了能留住），不读也不写本机存着的真数据。
// 给开发用的画布页（canvas.html）看「数据填满」的样子；样例照搬设计交接原型（校园后勤 原型.dc.html），
// 日期按今天往前推，任何时候打开都像「正在上学期中」。
import { WD, addDays, mondayOf, startOfDay, toISO } from './time.js'

export const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

// 原型节次 1–5 上午、7–10 下午、11–14 晚上（6 是午休占位）；App 里是连续编号，下午起减 1
const P = p => (p <= 5 ? p : p - 1)

// [课名, 教室, 老师, 周起, 周止, 色相, 单双周, [[星期 0-6, 原型起始节, 节数], ...]]
const COURSES = [
  ['高等数学 A(二)', '教三 201', '王建国', 1, 16, 255, null, [[0, 1, 2], [2, 3, 2]]],
  ['数据结构', '信息楼 B402', '李敏', 1, 18, 155, null, [[0, 7, 2], [3, 3, 3]]],
  ['形势与政策', '报告厅', '陈立', 5, 8, 75, null, [[0, 11, 2]]],
  ['大学英语(三)', '外语楼 305', 'Emma Liu', 1, 16, 20, null, [[1, 1, 2]]],
  ['线性代数', '教二 108', '周宁', 1, 12, 300, null, [[1, 3, 2], [4, 1, 2]]],
  ['中国近现代史纲要', '教一 402', '赵红', 1, 16, 50, null, [[1, 7, 3]]],
  ['大学物理', '理科楼 210', '孙浩', 3, 18, 210, null, [[2, 7, 3]]],
  ['程序设计实践', '机房 C3', '李敏', 1, 10, 185, null, [[2, 11, 3]]],
  ['体育(羽毛球)', '体育馆', '刘洋', 1, 16, 125, null, [[3, 1, 2]]],
  ['物理实验', '实验楼 305', '孙浩', 2, 18, 230, 'even', [[3, 7, 4]]],
  ['软件工程导论', '信息楼 A201', '吴凡', 1, 16, 0, null, [[4, 7, 2]]],
  ['创新创业讲座', '图书馆报告厅', '多位', 4, 9, 95, null, [[5, 3, 2]]],
]

/** 交给 store 的原始数据，store 会再按默认值补齐 */
export function demoState(today = new Date()) {
  const md = n => toISO(addDays(startOfDay(today), n))
  return {
    profile: { name: '林同学', avatar: 0, dorm: '东 3108' },
    // 开学日往前推 5 周，今天就是第 6 周
    settings: { startDate: toISO(addDays(mondayOf(today), -35)) },
    courses: COURSES.map(([name, room, teacher, ws, we, hue, parity, slots], i) => ({
      id: `demo_c${i}`,
      name,
      room,
      teacher,
      ws,
      we,
      parity,
      hue,
      note: '',
      slots: slots.map(([day, start, len]) => ({ day, start: P(start), len })),
    })),
    events: [
      { id: 'demo_e0', title: '社团例会', date: md(0), st: 1170, et: 1260, place: '学活 203', remind: 1 },
      { id: 'demo_e1', title: '交实验报告', date: md(2), st: 720, et: 750, place: '实验楼 305', remind: 1 },
    ],
  }
}

/** 洗浴 / 电费 / 校园卡的「已绑定」样例；这些还没接真实接口，没有演示数据时页面显示未绑定 */
export function demoServices(today = new Date()) {
  const md = n => {
    const d = addDays(today, n)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  const week = [4.8, 5.6, 3.9, 6.2, 5.1, 4.4, 5.3] // 近 7 天用电，最早一天在前
  return {
    room: ['东', '3108'],
    addr: '桃李园 · 东3号楼 · 1楼',
    balance: 86.5,
    cardNo: 'No.0427',
    sid: '2024010427',
    college: '计算机学院',
    bath: [
      { date: md(-1), time: '22:14', min: 12 },
      { date: md(-3), time: '21:40', min: 9 },
      { date: md(-5), time: '22:05', min: 15 },
    ],
    elec: {
      left: 32.6,
      hint: '按近 7 天用量，约可用 5 天',
      month: 42.6,
      days: week.map((v, i) => {
        const d = addDays(today, i - 6)
        return { date: md(i - 6), wd: i === 6 ? '今天' : WD[(d.getDay() + 6) % 7], v, today: i === 6 }
      }),
      pays: [
        { date: md(-3), time: '19:03', amount: 50, via: '校园卡' },
        { date: md(-15), time: '12:40', amount: 50, via: '微信' },
        { date: md(-27), time: '21:15', amount: 20, via: '校园卡' },
        { date: md(-31), time: '10:22', amount: 100, via: '支付宝' },
      ],
      payTotal: 220,
    },
    bills: {
      month: 412.3,
      groups: [
        { label: 'today', items: [{ title: '二食堂 · 午餐', time: '11:52', amount: -12.5 }, { title: '一楼超市', time: '08:10', amount: -3.3 }] },
        { label: md(-1), items: [{ title: '洗浴 · 东3108', time: '22:26', amount: -3.6 }, { title: '充值 · 微信', time: '19:03', amount: 100 }] },
      ],
    },
  }
}

export const services = DEMO ? demoServices() : null
