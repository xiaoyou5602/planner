import { describe, expect, it } from 'vitest'
import catalog from '../data/shiguang-adapters.json'
import { adapterEntryLabel, adapterFlow, genericSystemName, isGenericSchoolAdapter, isShareCodeAdapter } from './importAdapterFlow.js'

describe('课表适配入口', () => {
  it('WakeUp 与星链走分享内容输入，不打开 API 根页面', () => {
    const wakeUp = catalog.adapters.find(item => item.schoolId === 'GLOBAL_TOOLS' && item.id === 'WakeUp')
    const starLink = catalog.adapters.find(item => item.schoolId === 'GLOBAL_TOOLS' && item.id === 'StarLink')

    expect(wakeUp).toBeTruthy()
    expect(starLink).toBeTruthy()
    expect(adapterFlow(wakeUp).kind).toBe('share-code')
    expect(adapterFlow(starLink).kind).toBe('share-code')
    expect(isShareCodeAdapter(wakeUp)).toBe(true)
  })

  it('学校适配仍走教务网页，并保留填网址入口', () => {
    const fixedUrl = { schoolId: 'AUFE', id: 'AUFE_01', importUrl: 'http://all.aufe.edu.cn' }
    const manualUrl = { schoolId: 'GLOBAL_TOOLS', id: 'zhengfang_01', importUrl: '' }

    expect(adapterFlow(fixedUrl)).toMatchObject({ kind: 'school-web', shortActionLabel: '打开' })
    expect(adapterFlow(manualUrl)).toMatchObject({ kind: 'school-web', shortActionLabel: '填网址' })
    expect(isShareCodeAdapter(fixedUrl)).toBe(false)
  })
})

describe('通用教务适配', () => {
  it('从目录中单独挑出正方、青果、URP、超星，不含分享码和学校适配', () => {
    const generic = catalog.adapters.filter(isGenericSchoolAdapter)
    const names = generic.map(genericSystemName).sort()

    expect(names).toEqual(['URP教务', '正方教务', '超星教务系统', '青果教务'].sort())
    expect(generic.every(item => !item.importUrl)).toBe(true)
    expect(catalog.adapters.filter(item => item.schoolId === 'GLOBAL_TOOLS').some(isGenericSchoolAdapter)).toBe(false)
    expect(isGenericSchoolAdapter({ schoolId: 'AUFE', id: 'AUFE_01', category: 'BACHELOR_AND_ASSOCIATE' })).toBe(false)
  })
})

describe('同校多入口的区分名', () => {
  it('去掉重复的校名，只留入口差别；去完为空或不以校名开头时保留原名', () => {
    expect(adapterEntryLabel({ schoolName: '安徽财经大学', name: '安徽财经大学Webvpn入口' })).toBe('Webvpn入口')
    expect(adapterEntryLabel({ schoolName: '北方工业大学', name: '北方工业大学-教务系统' })).toBe('教务系统')
    expect(adapterEntryLabel({ schoolName: '安徽中医药高等专科学校', name: '安徽中医药高等专科学校' })).toBe('安徽中医药高等专科学校')
    expect(adapterEntryLabel({ schoolName: '呼和浩特民族学院', name: '通过 WebVPN 登录' })).toBe('通过 WebVPN 登录')
  })
})
