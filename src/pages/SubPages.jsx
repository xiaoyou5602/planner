// 二级页与弹层。
import { useNav } from '../nav.jsx'
import { deleteCourse, deleteEvent, wipe } from '../lib/store.js'
import { Sheet } from '../ui.jsx'
import { CoursePage } from './CoursePage.jsx'
import { EditPage } from './EditPage.jsx'
import { PaletteSheets } from './PaletteSheets.jsx'
import { SchoolImportPage, SchoolImportSheet } from './SchoolImportPage.jsx'
import { PdfFixSheet, PdfImportPage } from './PdfImportPage.jsx'
import { AmountSheet, ServicePages } from './ServicePages.jsx'
import { TimePage } from './TimePage.jsx'

export function SubPages() {
  return (
    <>
      <ServicePages />
      <TimePage />
      <CoursePage />
      <EditPage />
      <SchoolImportPage />
      <PdfImportPage />
    </>
  )
}

export function Sheets() {
  const { closeSheet, reset, toast, pop, sheetData } = useNav()
  const doWipe = async () => {
    await wipe()
    reset()
    toast('数据已清空')
  }
  const del = sheetData?.kind === 'event' ? '日程' : '课程'
  const doDelete = () => {
    if (!sheetData) return
    if (sheetData.kind === 'event') deleteEvent(sheetData.id)
    else deleteCourse(sheetData.id)
    closeSheet()
    pop()
    toast('已删除')
  }
  return (
    <>
      <Sheet id="wipe">
        <div className="sheet-title">确定清空所有数据？</div>
        <div className="sheet-sub">课程、日程、个人资料和绑定信息都会被删除，清空后无法恢复。</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 22 }}>
          <div className="btn-ghost tap" onClick={closeSheet}>取消</div>
          <div className="btn-danger solid tap" onClick={doWipe}>清空</div>
        </div>
      </Sheet>
      <Sheet id="delItem">
        <div className="sheet-title">确定删除这个{del}？</div>
        <div className="sheet-sub">
          「{sheetData?.name}」{sheetData?.kind === 'event' ? '' : '的所有上课时间'}都会从课表里删掉，删除后无法恢复。
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 22 }}>
          <div className="btn-ghost tap" onClick={closeSheet}>
            取消
          </div>
          <div className="btn-danger solid tap" onClick={doDelete}>
            删除
          </div>
        </div>
      </Sheet>
      <PaletteSheets />
      <AmountSheet />
      <SchoolImportSheet />
      <PdfFixSheet />
    </>
  )
}
