import { p2 } from './helpers'

export function getClosingPeriod(year, month) {
  const startYear  = month === 1 ? year - 1 : year
  const startMonth = month === 1 ? 12 : month - 1
  return {
    start:      `${startYear}-${p2(startMonth)}-26`,
    end:        `${year}-${p2(month)}-25`,
    startLabel: `${startMonth}月26日`,
    endLabel:   `${month}月25日`,
    title:      `${year}年${month}月分 (${startMonth}/26〜${month}/25) `,
  }
}

function calcWorkH(att) {
  if (!att?.clock_in || !att?.clock_out) return 0
  const mins = Math.floor(
    (new Date(att.clock_out) - new Date(att.clock_in)) / 60000
  ) - (att.break_minutes || 0)
  return Math.max(0, mins) / 60
}

function toHHMM(datetimeStr) {
  if (!datetimeStr) return ''
  const d = new Date(datetimeStr)
  if (isNaN(d)) return ''
  // JST固定で表示（UTC文字列の日付ズレ・端末設定の影響を受けない）
  return d.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function getDatesInPeriod(year, month) {
  const startYear  = month === 1 ? year - 1 : year
  const startMonth = month === 1 ? 12 : month - 1
  const dates = []
  const start = new Date(startYear, startMonth - 1, 26)
  const end   = new Date(year, month - 1, 25)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d))
  }
  return dates
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(d) {
  const m   = d.getMonth() + 1
  const day = d.getDate()
  const w   = WEEKDAYS[d.getDay()]
  return `${m}月${day}日(${w})`
}

function buildStaffRows(allStaff, attendance, leaveReports) {
  return allStaff.map(s => {
    const satts      = attendance.filter(a => a.staff_id === s.id)
    const sleave     = leaveReports.filter(r => r.staff_id === s.id)
    const workDays   = satts.filter(a => a.clock_in).length
    const workHours  = Math.round(satts.reduce((acc, a) => acc + calcWorkH(a), 0) * 10) / 10
    const leaveHours = sleave.reduce((acc, r) => acc + (r.hours || 0), 0)
    const remaining  = (s.leave_year || 0) + (s.leave_carry || 0) - (s.leave_used || 0)
    return { s, workDays, workHours, leaveHours, remaining }
  })
}

export async function exportExcel(allStaff, attendance, leaveReports, year, month) {
  const XLSX = await import('xlsx')
 const { startMonth } = getClosingPeriod(year, month)
 const startYear = month === 1 ? year - 1 : year
  const dates     = getDatesInPeriod(year, month)
  const today     = new Date()
  const todayStr  = `${today.getFullYear()}-${p2(today.getMonth()+1)}-${p2(today.getDate())} ${p2(today.getHours())}:${p2(today.getMinutes())}`
  const periodStr = `${startYear}年${startMonth}月26日〜${year}年${month}月25日`

  const staffCount = allStaff.length
  const totalCols  = 1 + staffCount * 3
  const lastCol    = totalCols - 1

  const row1 = Array(totalCols).fill('')
  row1[0] = '出退勤明細簿'

  const row2 = Array(totalCols).fill('')
  row2[0] = '店舗名:SWITCH.HAIR'
  row2[lastCol] = `作成日:${todayStr}`

  const row3 = Array(totalCols).fill('')
  row3[0] = 'page:1'
  row3[lastCol] = `期間:${periodStr}`

  const row4 = Array(totalCols).fill('')
  allStaff.forEach((s, i) => {
    row4[1 + i * 3] = s.name
  })

  const dateRows = dates.map(d => {
    const dateStr = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`
    const row = Array(totalCols).fill('')
    row[0] = formatDateLabel(d)
    allStaff.forEach((s, i) => {
      // clock_in(UTC文字列)の前方一致は日付がズレるため、date カラムで判定する
      const att = attendance.find(a =>
        a.staff_id === s.id &&
        a.clock_in &&
        a.date === dateStr
      )
      if (att) {
        row[1 + i * 3]     = toHHMM(att.clock_in)
        row[1 + i * 3 + 1] = '～'
        row[1 + i * 3 + 2] = toHHMM(att.clock_out)
      }
    })
    return row
  })

  const summaryRow = Array(totalCols).fill('')
  allStaff.forEach((s, i) => {
    const satts     = attendance.filter(a => a.staff_id === s.id && a.clock_in)
    const workDays  = satts.length
    const restDays  = dates.length - workDays
    const totalMins = satts.reduce((acc, a) => {
      if (!a.clock_in || !a.clock_out) return acc
      return acc + Math.floor((new Date(a.clock_out) - new Date(a.clock_in)) / 60000) - (a.break_minutes || 0)
    }, 0)
    const hh = Math.floor(totalMins / 60)
    const mm = p2(totalMins % 60)
    summaryRow[1 + i * 3] = `出勤日数 ${workDays}日\n休暇日数 ${restDays}日\n合計時間 ${hh}:${mm}`
  })

  const aoa = [row1, row2, row3, row4, ...dateRows, summaryRow]
  const ws  = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = [
    { wch: 12 },
    ...Array.from({ length: staffCount }, () => [
      { wch: 8 }, { wch: 3 }, { wch: 8 }
    ]).flat()
  ]

  ws['!pageSetup'] = {
    paperSize:   9,
    orientation: 'landscape',
    fitToPage:   true,
    fitToWidth:  1,
    fitToHeight: 0,
  }

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '出勤明細簿')
  XLSX.writeFile(wb, `timetrack_${year}${p2(month)}.xlsx`)
}

export function exportPDF(allStaff, attendance, leaveReports, year, month) {
  const { title } = getClosingPeriod(year, month)
  const rows      = buildStaffRows(allStaff, attendance, leaveReports)
  const sortedLv  = [...leaveReports].sort((a, b) => a.date > b.date ? 1 : -1)
  const today     = new Date().toLocaleDateString('ja-JP')

  const summaryRows = rows.map(({ s, workDays, workHours, leaveHours, remaining }) => `
    <tr>
      <td><b>${s.name}</b></td>
      <td>${s.role}</td>
      <td class="num">${workDays}日</td>
      <td class="num">${workHours}h</td>
      <td class="num">${leaveHours}h</td>
      <td class="num" style="color:#9b8eea">${s.leave_year || 0}h</td>
      <td class="num" style="color:#9b8eea">${s.leave_carry || 0}h</td>
      <td class="num" style="color:#d4a017">${s.leave_used || 0}h</td>
      <td class="num"><b style="color:${remaining < 0 ? '#e05a70' : '#1ab889'}">${remaining}h</b></td>
    </tr>`).join('')

  const leaveRowsHtml = sortedLv.length === 0
    ? '<tr><td colspan="6" style="text-align:center;color:#aaa">この期間の有給報告はありません</td></tr>'
    : sortedLv.map(r => {
        const cls   = r.confirmed === true ? 'ok' : r.confirmed === null ? 'ng' : 'wait'
        const label = r.confirmed === true ? '確認済み' : r.confirmed === null ? '差戻し' : '確認待ち'
        const name  = allStaff.find(s => s.id === r.staff_id)?.name || r.staff?.name || ''
        return `<tr>
          <td><b>${name}</b></td>
          <td>${r.date}</td>
          <td>${(r.time_from || '').slice(0,5)}〜${(r.time_to || '').slice(0,5)}</td>
          <td class="num">${r.hours}h</td>
          <td>${r.note || '—'}</td>
          <td class="${cls}">${label}</td>
        </tr>`
      }).join('')

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 12mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif; color: #222; font-size: 10px; }
  h1  { font-size: 15px; color: #4a3f9a; margin-bottom: 2px; }
  .sub{ font-size: 9px; color: #777; margin-bottom: 12px; }
  h2  { font-size: 10px; font-weight: 700; color: #333; border-left: 3px solid #b39dfa; padding-left: 6px; margin: 12px 0 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #f0eeff; padding: 4px 7px; text-align: left; border: 1px solid #ccc; font-weight: 700; color: #4a3f9a; white-space: nowrap; }
  td { padding: 3px 7px; border: 1px solid #e0e0e0; white-space: nowrap; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; }
  .ok  { color: #1ab889; font-weight: 700; }
  .wait{ color: #d4a017; font-weight: 700; }
  .ng  { color: #e05a70; font-weight: 700; }
  .footer { margin-top: 10px; font-size: 8px; color: #bbb; text-align: right; }
</style></head><body>
<h1>⏱ TimeTrack 勤怠レポート</h1>
<div class="sub">${title}　出力日: ${today}</div>
<h2>スタッフ別 月次サマリー</h2>
<table>
  <thead><tr>
    <th>氏名</th><th>役職</th><th>出勤日数</th><th>総実働時間</th>
    <th>有給取得時間</th><th>今年度付与</th><th>繰越</th><th>使用済み</th><th>有給残高</th>
  </tr></thead>
  <tbody>${summaryRows}</tbody>
</table>
<h2>有給報告履歴（期間内）</h2>
<table>
  <thead><tr>
    <th>氏名</th><th>日付</th><th>時間帯</th><th>時間</th><th>備考</th><th>状態</th>
  </tr></thead>
  <tbody>${leaveRowsHtml}</tbody>
</table>
<div class="footer">TimeTrack | ${title}</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=750')
  w.document.write(html)
  w.document.close()
}　
