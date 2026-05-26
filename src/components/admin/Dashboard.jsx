import { useEffect, useState } from 'react'
import useAppStore from '../../store/useAppStore'
import { toHM, fhLabel } from '../../utils/helpers'
import { getClosingPeriod, exportExcel, exportPDF } from '../../utils/export'

// 直近12ヶ月の選択肢を生成
function buildMonthOptions() {
  const now = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return opts
}

export default function Dashboard() {
  const allStaff         = useAppStore(s => s.allStaff)
  const todayAttendance  = useAppStore(s => s.todayAttendance)
  const allLeaveRequests = useAppStore(s => s.allLeaveRequests)
  const loadAdminData    = useAppStore(s => s.loadAdminData)
  const loadExportData   = useAppStore(s => s.loadExportData)

  const now = new Date()
  const [exportYear,  setExportYear]  = useState(now.getFullYear())
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1)
  const [exporting,   setExporting]   = useState(null) // 'excel' | 'pdf' | null

  useEffect(() => { loadAdminData() }, [])

  const monthOptions = buildMonthOptions()
  const period = getClosingPeriod(exportYear, exportMonth)

  const handleMonthChange = (e) => {
    const [y, m] = e.target.value.split('-').map(Number)
    setExportYear(y)
    setExportMonth(m)
  }

  const handleExcel = async () => {
    setExporting('excel')
    try {
      const { attendance, leaveReports } = await loadExportData(exportYear, exportMonth)
      await exportExcel(allStaff, attendance, leaveReports, exportYear, exportMonth)
    } finally {
      setExporting(null)
    }
  }

  const handlePDF = async () => {
    setExporting('pdf')
    try {
      const { attendance, leaveReports } = await loadExportData(exportYear, exportMonth)
      exportPDF(allStaff, attendance, leaveReports, exportYear, exportMonth)
    } finally {
      setExporting(null)
    }
  }

  const workingCount = todayAttendance.filter(a => a.clock_in && !a.clock_out).length
  const doneCount    = todayAttendance.filter(a => a.clock_out).length
  const pendingCount = allLeaveRequests.filter(r => r.confirmed === false).length

  return (
    <div className="sc">
      <div className="astats">
        <div className="astat">
          <div className="astat-v" style={{ color: 'var(--gr)' }}>{workingCount}</div>
          <div className="astat-l">勤務中</div>
        </div>
        <div className="astat">
          <div className="astat-v" style={{ color: 'var(--mu)' }}>{doneCount}</div>
          <div className="astat-l">退勤済み</div>
        </div>
        <div className="astat">
          <div className="astat-v" style={{ color: 'var(--yw)' }}>{pendingCount}</div>
          <div className="astat-l">確認待ち</div>
        </div>
      </div>

      {/* ── エクスポート ── */}
      <div className="slbl">エクスポート</div>

      {/* 月選択 */}
      <div style={{ marginBottom: 10 }}>
        <select
          value={`${exportYear}-${exportMonth}`}
          onChange={handleMonthChange}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            border: '1px solid var(--bd)', background: 'var(--bg)',
            color: 'var(--tx)', fontFamily: 'var(--fn)', fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {monthOptions.map(({ year, month }) => {
            const p = getClosingPeriod(year, month)
            return (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>
                {year}年{month}月分（{p.startLabel}〜{p.endLabel}）
              </option>
            )
          })}
        </select>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 5, paddingLeft: 2 }}>
          集計期間: {period.startLabel}〜{period.endLabel}（25日締め）
        </div>
      </div>

      {/* エクスポートボタン */}
      <div className="export-row">
        <button
          className="btn-exp excel"
          onClick={handleExcel}
          disabled={!!exporting}
          style={{ opacity: exporting ? 0.6 : 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
          {exporting === 'excel' ? '生成中...' : 'Excel出力'}
        </button>
        <button
          className="btn-exp pdf"
          onClick={handlePDF}
          disabled={!!exporting}
          style={{ opacity: exporting ? 0.6 : 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
          </svg>
          {exporting === 'pdf' ? '生成中...' : 'PDF出力'}
        </button>
      </div>

      {/* ── 本日のスタッフ ── */}
      <div className="slbl">本日のスタッフ</div>
      {allStaff.map(s => {
        const att = todayAttendance.find(a => a.staff_id === s.id)
        const rem = (s.leave_year || 0) + (s.leave_carry || 0) - (s.leave_used || 0)

        let badge, times
        if (att?.status === 'on_break') {
          badge = <span className="badge bo">中抜け中</span>
          times = `出勤 ${toHM(att.clock_in)} → 中抜け ${toHM(att.break_start)}`
        } else if (att?.status === 'done') {
          badge = <span className="badge bm">退勤済み</span>
          times = `${toHM(att.clock_in)} → ${toHM(att.clock_out)}`
        } else if (att?.clock_in) {
          badge = <span className="badge bg">勤務中</span>
          times = `出勤 ${toHM(att.clock_in)}`
        } else {
          badge = <span className="badge by">未打刻</span>
          times = '本日の打刻なし'
        }

        return (
          <div key={s.id} className="sc-card">
            <div className="sav" style={{ background: `linear-gradient(135deg,${s.color_from},${s.color_to})` }}>
              {s.name?.replace(/\s+/g, '')[0] || '?'}
            </div>
            <div className="si">
              <div className="snm">{s.name}</div>
              <div className="srole">{s.role}</div>
              <div className="stm">{times} · 有給残 {fhLabel(rem)}</div>
            </div>
            {badge}
          </div>
        )
      })}

      <div style={{ height: 20 }} />
    </div>
  )
}
