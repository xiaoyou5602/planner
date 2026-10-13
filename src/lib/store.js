// 全部数据存在手机本地（Capacitor Preferences；浏览器里退化为 localStorage）。
// 一个 key 存整份 JSON，读写都经过这里，「清空数据」只需删这一个 key。
import { Preferences } from '@capacitor/preferences'
import { useSyncExternalStore } from 'react'
import { DEMO, demoState } from './demo.js'
import { mergePdfCourses, validatePdfCandidate } from './pdfCourses.js'

// 演示模式（?demo=1）存在另一个 key：改了能留住，又碰不到真数据；清空后下次打开回到样例
const KEY = DEMO ? 'campus.demo.v1' : 'campus.v1'

export const DEFAULT_SETTINGS = {
  startDate: null, // 开学日期 'YYYY-MM-DD'，没设时按第 1 周
  totalWeeks: 20,
  am: 5,
  pm: 4,
  eve: 4,
  dur: 45, // 每节分钟数
  brk: 10, // 课间分钟数
  lunchOn: true,
  lunchMin: 95,
  dinnerOn: true,
  dinnerMin: 90,
  timeSlots: null, // 教务导入的显式节次 [{number,startTime,endTime}]
  comboSchedule: null, // 部分学校的分季作息
}

export const DEFAULT_PROFILE = { name: '', avatar: 0, dorm: '' }

/**
 * courses: [{ id, name, room, teacher, ws, we, parity: null|'odd'|'even', hue, note,
 *             slots: [{ day: 0-6, start: 节次, len: 节数 }] }]
 * events:  [{ id, title, date: 'YYYY-MM-DD', st: 分钟, et: 分钟, place, remind: 0|1|2 }]
 * palette: { current: 预设或自定义 key, custom: { [key]: {label, bg, bd, shift} | {label, list} } }
 */
export function emptyState() {
  return {
    version: 1,
    profile: { ...DEFAULT_PROFILE },
    settings: { ...DEFAULT_SETTINGS },
    courses: [],
    events: [],
    palette: { current: 'soft', custom: {} },
  }
}

// 旧数据缺字段时用默认值补齐，避免以后加字段把老数据读坏
export function normalize(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  return {
    version: 1,
    profile: { ...base.profile, ...(raw.profile || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    courses: Array.isArray(raw.courses) ? raw.courses : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    palette: { ...base.palette, ...(raw.palette || {}), custom: { ...((raw.palette || {}).custom || {}) } },
  }
}

let state = emptyState()
const listeners = new Set()
let saving = Promise.resolve()

function emit() {
  listeners.forEach(fn => fn())
}

const writeAll = value => Preferences.set({ key: KEY, value })

function persist() {
  const json = JSON.stringify(state)
  // 串行写入，保证最后一次写入落盘的是最新状态
  saving = saving.then(() => writeAll(json)).catch(err => console.error('保存失败', err))
  return saving
}

/** PDF is append-only. Report write errors and remove only this failed batch from memory. */
export async function applyPdfImport(courses) {
  const settings = state.settings
  for (const course of courses) {
    for (const slot of course.slots || []) {
      const checked = validatePdfCandidate({ ...course, day: slot.day, start: slot.start, end: slot.start + slot.len - 1, weeksText: course.weeks?.join(',') }, settings)
      if (checked.reasons.length) throw new Error('课程信息已变化，请重新核对预览')
    }
    if (!course.slots?.length || !course.weeks?.length) throw new Error('课程信息不完整')
  }
  const added = mergePdfCourses(state.courses, courses).map(course => ({ ...course, id: genId('c') }))
  const meetings = added.reduce((sum, course) => sum + course.slots.length, 0)
  if (!added.length) return { added: 0, courses: 0, ids: [] }
  state = { ...state, courses: [...state.courses, ...added] }
  const snapshot = JSON.stringify(state)
  emit()
  const write = saving.then(() => writeAll(snapshot))
  saving = write.catch(() => {})
  try {
    await write
    return { added: meetings, courses: added.length, ids: added.map(course => course.id) }
  } catch {
    // Other updates may have happened during the write: keep those, undo only our objects.
    const failed = new Set(added)
    state = { ...state, courses: state.courses.filter(course => !failed.has(course)) }
    emit()
    // Follow any queued snapshots with the corrected state, so they cannot resurrect the failed batch.
    const repaired = JSON.stringify(state)
    const repair = saving.then(() => writeAll(repaired))
    saving = repair.catch(() => {})
    await saving
    throw new Error('课程保存失败，本次新增已撤回，请重试')
  }
}

export async function loadStore() {
  try {
    const { value } = await Preferences.get({ key: KEY })
    state = normalize(value ? JSON.parse(value) : DEMO ? demoState() : null)
  } catch (err) {
    console.error('读取本地数据失败，使用空数据', err)
    state = emptyState()
  }
  emit()
  return state
}

export const getState = () => state

/** 等所有还没落盘的写入完成 */
export const flushed = () => saving

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** update(s => ({ ...s, profile: {...} })) —— 传入新状态的生成函数 */
export function update(fn) {
  state = normalize(fn(state))
  emit()
  return persist()
}

export async function wipe() {
  state = emptyState()
  emit()
  await saving
  saving = Preferences.remove({ key: KEY }).catch(err => console.error('清空失败', err))
  return saving
}

// 画布里多个框共用一份演示数据：别的框改了，这里跟着变（浏览器存储 key 带 CapacitorStorage. 前缀）
if (DEMO && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', e => {
    if (!e.key?.endsWith(`.${KEY}`)) return
    state = normalize(e.newValue ? JSON.parse(e.newValue) : null)
    emit()
  })
}

export function setProfile(patch) {
  return update(s => ({ ...s, profile: { ...s.profile, ...patch } }))
}

/** 切换当前色卡（预设 key 或自定义 key） */
export function pickPalette(key) {
  return update(s => ({ ...s, palette: { ...s.palette, current: key } }))
}

/** 保存自定义色卡并立刻使用，返回它的 key */
export function addPalette(pal) {
  const key = genId('u')
  update(s => ({ ...s, palette: { current: key, custom: { ...s.palette.custom, [key]: pal } } }))
  return key
}

/** 删除自定义色卡；删的是正在用的，就退回默认「奶油」 */
export function deletePalette(key) {
  return update(s => {
    const { [key]: _, ...custom } = s.palette.custom
    return { ...s, palette: { current: s.palette.current === key ? 'soft' : s.palette.current, custom } }
  })
}

export function setSettings(patch) {
  return update(s => ({ ...s, settings: { ...s.settings, ...patch } }))
}

function importFingerprint(course) {
  return JSON.stringify([
    course.name, course.teacher, course.room, course.weeks || [course.ws, course.we, course.parity],
    course.slots?.map(slot => [slot.day, slot.start, slot.len, slot.customStart, slot.customEnd]),
  ])
}

/** 预览确认后才会调用。replace 只替换课程和学期/作息，不动资料、日程、色卡。 */
export function applyScheduleImport(prepared, mode = 'merge') {
  const imported = prepared.courses.map(course => ({ ...course, id: genId('c') }))
  return update(s => {
    let courses = imported
    if (mode !== 'replace') {
      const sourceKeys = new Set(imported.map(course => course.source?.key).filter(Boolean))
      const incoming = new Set(imported.map(importFingerprint))
      const kept = s.courses.filter(course => {
        if (course.source?.key && sourceKeys.has(course.source.key)) return false
        return !incoming.has(importFingerprint(course))
      })
      courses = [...kept, ...imported]
    }
    const clearedImportedSchedule = mode === 'replace' ? { timeSlots: null, comboSchedule: null } : {}
    return { ...s, courses, settings: { ...s.settings, ...clearedImportedSchedule, ...prepared.settingsPatch } }
  })
}

// 有 id 就替换，没有就新建；list 是 'courses' 或 'events'
function upsert(list, prefix, item) {
  const id = item.id || genId(prefix)
  const next = { ...item, id }
  update(s => {
    const arr = s[list]
    const i = arr.findIndex(x => x.id === id)
    return { ...s, [list]: i < 0 ? [...arr, next] : arr.map(x => (x.id === id ? next : x)) }
  })
  return next
}

function removeFrom(list, id) {
  return update(s => ({ ...s, [list]: s[list].filter(x => x.id !== id) }))
}

/** Undo for an import: drops exactly the courses it created. */
export function removeCourses(ids) {
  const drop = new Set(ids)
  return update(s => ({ ...s, courses: s.courses.filter(course => !drop.has(course.id)) }))
}

export const saveCourse = c => upsert('courses', 'c', c)
export const deleteCourse = id => removeFrom('courses', id)
export const saveEvent = ev => upsert('events', 'e', ev)
export const deleteEvent = id => removeFrom('events', id)

export function useStore(selector = s => s) {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function genId(prefix) {
  const r = globalThis.crypto?.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${r}`
}
