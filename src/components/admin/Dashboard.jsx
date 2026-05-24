import { useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { toHM, fhLabel, fhS, p2 } from '../../utils/helpers'

function exportCSV(allStaff, todayAttendance, allLeaveRequests) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  let csv = '﻿'
  csv += `TimeTrack 勤怠レポート,${dateStr}\r\n\r\n`
  csv += '■ スタッフ別 有給残高\r\n'
  csv += '氏名,役職,今年度付与(h),繰越(h),使用済み(h),残高(h)\r\n'
  allStaff.forEach(s => {
    const granted = s.leave_year || 0
    const carry   = s.leave_carry || 0
    const used    = s.leave_used || 0
    const rem     = granted + carry - used
    csv += `${s.name},${s.role},${granted},${carry},${used},${rem}\r\n`
  })
  csv += '\r\n■ 有給報告履歴\r\n'
  csv += '氏名,役職,日付,時間帯,取得時間(h),備考,状態\r\n'
  allLeaveRequests.forEach(r => {
    const staffName = r.staff?.name || ''
    const staffRole = r.staff?.role || ''
    const status = r.confirmed === true ? '確認済み' : r.confirmed === null ? '差戻し' : '確認待ち'
    csv += `${staffName},${staffRole},${r.date},${r.time_from?.slice(0,5)}〜${r.time_to?.slice(0,5)},${r.hours},${r.note||''},${status}\r\n`
  })
  csv += '\r\n■ 本日の勤怠状況\r\n'
  csv += '氏名,役職,出勤,退勤,状況\r\n'
  allStaff.forEach(s => {
    const att = todayAttendance.find(a => a.staff_id === s.id)
    let status = '未打刻'
    if (att?.status === 'done') status = '退勤済み'
    else if (att?.status === 'on_break') status = '中抜け中'
    else if (att?.clock_in) status = '勤務中'
    csv += `${s.name},${s.role},${att?.clock_in ? toHM(att.clock_in) : '---'},${att?.clock_out ? toHM(att.clock_out) : '---'},${status}\r\n`
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `timetrack_${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}.csv`
  a.click()
}

function exportPDF(allStaff, todayAttendance, allLeaveRequests) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const w = window.open('', '_blank', 'width=900,height=700')
  let html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body{font-family:'Zen Maru Gothic',sans-serif;color:#222;padding:32px;max-width:860px;margin:0 auto}
    h1{font-size:22px;color:#4a3f9a;margin-bottom:4px}
    .sub{font-size:12px;color:#888;margin-bottom:28px}
    h2{font-size:15px;font-weight:700;color:#333;border-left:4px solid #b39dfa;padding-left:10px;margin:24px 0 12px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
    th{background:#f0eeff;padding:9px 12px;text-align:left;border:1px solid #ddd;font-weight:700;color:#4a3f9a}
    td{padding:8px 12px;border:1px solid #e8e8e8}
    tr:nth-child(even) td{background:#fafafa}
    .ok{color:#1ab889;font-weight:700}.wait{color:#d4a017;font-weight:700}.ng{color:#e05a70;font-weight:700}
    .footer{margin-top:32px;font-size:11px;color:#aaa;text-align:center}
  </style></head><body>
  <h1>⏱ TimeTrack 勤怠レポート</h1>
  <div class="sub">出力日時: ${dateStr}</div>
  <h2>スタッフ別 有給残高</h2>
  <table><tr><th>氏名</th><th>役職</th><th>今年度付与</th><th>繰越</th><th>使用済み</th><th>残高</th></tr>`

  allStaff.forEach(s => {
    const granted = s.leave_year || 0
    const carry   = s.leave_carry || 0
    const used    = s.leave_used || 0
    const rem     = granted + carry - used
    html += `<tr><td><b>${s.name}</b></td><td>${s.role}</td><td>${granted}h</td><td style="color:#b39dfa">${carry}h</td><td style="color:#d4a017">${used}h</td><td><b style="color:#1ab889">${rem}h</b></td></tr>`
  })

  html += `</table><h2>有給報告履歴</h2>
  <table><tr><th>氏名</th><th>日付</th><th>時間帯</th><th>時間</th><th>備考</th><th>状態</th></tr>`
  allLeaveRequests.forEach(r => {
    const cls   = r.confirmed === true ? 'ok' : r.confirmed === null ? 'ng' : 'wait'
    const label = r.confirmed === true ? '確認済み' : r.confirmed === null ? '差戻し' : '確認待ち'
    html += `<tr><td>${r.staff?.name || ''}</td><td>${r.date}</td><td>${r.time_from?.slice(0,5)}〜${r.time_to?.slice(0,5)}</td><td>${r.hours}h</td><td>${r.note||'-'}</td><td class="${cls}">${label}</td></tr>`
  })

  html += `</table><h2>本日の勤怠状況</h2>
  <table><tr><th>氏名</th><th>役職</th><th>出勤</th><th>退勤</th><th>状況</th></tr>`
  allStaff.forEach(s => {
    const att = todayAttendance.find(a => a.staff_id === s.id)
    let status = '未打刻'
    if (att?.status === 'done') status = '退勤済み'
    else if (att?.status === 'on_break') status = '中抜け中'
    else if (att?.clock_in) status = '勤務中'
    html += `<tr><td><b>${s.name}</b></td><td>${s.role}</td><td>${att?.clock_in ? toHM(att.clock_in) : '---'}</td><td>${att?.clock_out ? toHM(att.clock_out) : '---'}</td><td>${status}</td></tr>`
  })

  html += `</table><div class="footer">TimeTrack | ${dateStr} 出力</div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`
  w.document.write(html)
  w.document.close()
}

export default function Dashboard() {
  const allStaff = useAppStore(s => s.allStaff)
  const todayAttendance = useAppStore(s => s.todayAttendance)
  const allLeaveRequests = useAppStore(s => s.allLeaveRequests)
  const loadAdminData = useAppStore(s => s.loadAdminData)

  useEffect(() => { loadAdminData() }, [])

  const workingCount = todayAttendance.filter(a => a.clock_in && !a.clock_out).length
  const doneCount = todayAttendance.filter(a => a.clock_out).length
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

      <div className="slbl">エクスポート</div>
      <div className="export-row">
        <button className="btn-exp excel" onClick={() => exportCSV(allStaff, todayAttendance, allLeaveRequests)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
          Excel出力
        </button>
        <button className="btn-exp pdf" onClick={() => exportPDF(allStaff, todayAttendance, allLeaveRequests)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
          </svg>
          PDF出力
        </button>
      </div>

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
