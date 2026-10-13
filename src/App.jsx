import { NavProvider, useNav } from './nav.jsx'
import { DetailCard } from './pages/DetailCard.jsx'
import { HomePage } from './pages/Home.jsx'
import { MePage } from './pages/Me.jsx'
import { SchedPage } from './pages/Sched.jsx'
import { Sheets, SubPages } from './pages/SubPages.jsx'
import { SheetBackdrop, TabBar, Toast } from './ui.jsx'

function Shell() {
  const { stack } = useNav()
  return (
    <div className="app">
      <div className={`root-layer ${stack.length ? 'pushed' : ''}`}>
        <HomePage />
        <SchedPage />
        <MePage />
        <TabBar />
        <div className="root-dim" />
      </div>
      <SubPages />
      <SheetBackdrop />
      <Sheets />
      <DetailCard />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  )
}
