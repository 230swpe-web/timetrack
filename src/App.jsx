import { useEffect } from 'react'
import useAppStore from './store/useAppStore'
import Login from './components/Login'
import StaffScreen from './components/StaffScreen'
import AdminScreen from './components/AdminScreen'

export default function App() {
  const screen = useAppStore(s => s.screen)
  const toast = useAppStore(s => s.toast)

  return (
    <>
      {screen === 'login' && <Login />}
      {screen === 'staff' && <StaffScreen />}
      {screen === 'admin' && <AdminScreen />}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
