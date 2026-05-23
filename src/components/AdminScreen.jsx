import { useState } from 'react'
import useAppStore from '../store/useAppStore'
import Dashboard from './admin/Dashboard'
import LeaveManagement from './admin/LeaveManagement'
import Settings from './admin/Settings'

export default function AdminScreen() {
  const [tab, setTab] = useState('dash')
  const logout = useAppStore(s => s.logout)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="hdr">
        <div className="hav" style={{ background: 'linear-gradient(135deg,#7c8ef7,#b39dfa)' }}>管</div>
        <div>
          <div className="hnm">管理者</div>
          <div className="hrl">TimeTrack</div>
        </div>
        <div className="hdr-r">
          <button className="btn-lo" onClick={logout}>退出</button>
        </div>
      </div>

      <div className="atabs">
        {[['dash','ダッシュボード'],['leave','有給管理'],['set','⚙ 設定']].map(([key, label]) => (
          <div
            key={key}
            className={`atab${tab === key ? ' on' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'dash' && <Dashboard />}
        {tab === 'leave' && <LeaveManagement />}
        {tab === 'set' && <Settings />}
      </div>
    </div>
  )
}
