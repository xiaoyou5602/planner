const SHARE_CODE_FLOWS = {
  'GLOBAL_TOOLS:WakeUp': {
    kind: 'share-code',
    sourceName: 'WakeUp',
    actionLabel: '粘贴分享内容并导入',
    shortActionLabel: '输入口令',
    instructions: '先在 WakeUp 里复制课表分享口令；可以复制完整分享文案，不用自己截取口令。',
  },
  'GLOBAL_TOOLS:StarLink': {
    kind: 'share-code',
    sourceName: '星链课表',
    actionLabel: '粘贴分享内容并导入',
    shortActionLabel: '输入分享码',
    instructions: '先在星链课表里复制课表分享内容；可以粘贴完整文案，应用会自动提取分享码。',
  },
}

export function adapterFlow(adapter) {
  const key = `${adapter?.schoolId || ''}:${adapter?.id || ''}`
  return SHARE_CODE_FLOWS[key] || {
    kind: 'school-web',
    actionLabel: '打开教务系统',
    shortActionLabel: adapter?.importUrl ? '打开' : '填网址',
    instructions: adapter?.description || '',
  }
}

export function isShareCodeAdapter(adapter) {
  return adapterFlow(adapter).kind === 'share-code'
}

// 不绑定具体学校、需要自己填教务网址的系统级适配（正方、青果、URP、超星等）
export function isGenericSchoolAdapter(adapter) {
  return adapter?.category === 'GENERAL_TOOL' && !isShareCodeAdapter(adapter)
}

export function genericSystemName(adapter) {
  return String(adapter?.schoolName || adapter?.name || '').replace(/\s*[-·]\s*通用教务$/, '')
}

// 同一所学校有多个入口时用来区分：去掉重复的校名，只留「校内入口」「Webvpn入口」这类差别
export function adapterEntryLabel(adapter) {
  const name = String(adapter?.name || '').trim()
  const school = String(adapter?.schoolName || '').trim()
  if (!school || !name.startsWith(school)) return name
  const rest = name.slice(school.length).replace(/^[\s\-·:：]+/, '').trim()
  return rest || name
}
