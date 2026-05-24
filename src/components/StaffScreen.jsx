import { useState } from 'react'
import useAppStore from '../store/useAppStore'
import ClockTab from './ClockTab'
import LeaveTab from './LeaveTab'

export default function StaffScreen() {
  const [tab, setTab] = useState('clock')
  const currentUser = useAppStore(s => s.currentUser)
  const logout = useAppStore(s => s.logout)

  const grad = `linear-gradient(135deg, ${currentUser.color_from}, ${currentUser.color_to})`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="hdr">
        <div className="hav" style={{ background: grad }}>{currentUser.name?.replace(/\s+/g, '')[0] || '?'}</div>
        <div>
          <div className="hnm">{currentUser.name}</div>
          <div className="hrl">{currentUser.role || 'スタッフ'}</div>
        </div>
        <div className="hdr-r">
          <button className="btn-lo" onClick={logout}>退出</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'clock' && <ClockTab />}
        {tab === 'leave' && <LeaveTab />}
      </div>

      <div className="bnav">
        <div className={`ni${tab === 'clock' ? ' on' : ''}`} onClick={() => setTab('clock')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          打刻
        </div>
        <div className={`ni${tab === 'leave' ? ' on' : ''}`} onClick={() => setTab('leave')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          有給
        </div>
      </div>
    </div>
  )
}
