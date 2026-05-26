import { p2 } from './helpers'

// ── 25日締め期間の計算 ──────────────────────────────────
export function getClosingPeriod(year, month) {
  const startYear  = month === 1 ? year - 1 : year
  const startMonth = month === 1 ? 12 : month - 1
  return {
    start:      `${startYear}-${p2(startMonth)}-26`,
    end:        `${year}-${p2(month)}-25`,
    startLabel: `${startMonth}月26日`,
    endLabel:   `${month}月25日`,
    title:      `${year}年${month}月分（${startMonth}/26〜${month}/25）`,
  }
}

// ── 勤怠1レコードの実働時間(h)を計算 ─────────────────────
function calcWorkH(att) {
  if (!att?.clock_in || !att?.clock_out) return 0
  const mins = Math.floor(
    (new Date(att.clock_out) - new Date(att.clock_in)) / 60000
  ) - (att.break_minutes || 0)
  return Math.max(0, mins) / 60
}

// ── スタッフごとの月次サマリー行を生成 ────────────────────
function buildStaffRows(allStaff, attendance, leaveReports) {
  return allStaff.map(s => {
    const satts  = attendance.filter(a => a.staff_id === s.id)
    const sleave = leaveReports.filter(r => r.staff_id === s.id)
    const workDays   = satts.filter(a => a.clock_in).length
    const workHours  = Math.round(satts.reduce((acc, a) => acc + calcWorkH(a), 0) * 10) / 10
    const leaveHours = sleave.reduce((acc, r) => acc + (r.hours || 0), 0)
    const remaining  = (s.leave_year || 0) + (s.leave_carry || 0) - (s.leave_used || 0)
    return { s, workDays, workHours, leaveHours, remaining }
  })
}

// ── Excel (xlsx) エクスポート ──────────────────────────────
export async function exportExcel(allStaff, attendance, leaveReports, year, month) {
  const XLSX = await import('xlsx')
  const { title, startLabel, endLabel } = getClosingPeriod(year, month)
  const rows = buildStaffRows(allStaff, attendance, leaveReports)

  // ヘッダー込みの2Dデータを構築（A1から）
  const aoa = [
    ['TimeTrack 勤怠レポート', '', '', '', '', '', '', '', ''],
    [title, '', '', '', '', '', '', '', ''],
    [],
    ['氏名', '役職', '出勤日数', '総実働時間(h)', '有給取得時間(h)',
     '今年度付与(h)', '繰越(h)', '使用済み(h)', '有給残高(h)'],
    ...rows.map(({ s, workDays, workHours, leaveHours, remaining }) => [
      s.name,
      s.role,
      workDays,
      workHours,
      leaveHours,
      s.leave_year  || 0,
      s.leave_carry || 0,
      s.leave_used  || 0,
      remaining,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // 列幅（A4横向きで全9列が収まるよう調整）
  ws['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 13 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
  ]

  // A4横向き・横1ページ固定
  ws['!pageSetup'] = {
    paperSize:   9,           // A4
    orientation: 'landscape',
    fitToPage:   true,
    fitToWidth:  1,
    fitToHeight: 0,
  }

  // タイトル行を太字・大きく見せるためにセルスタイルは省略（SheetJS CE非対応）
  // セル結合: タイトル行(A1:I1), 期間行(A2:I2)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${month}月分`)
  XLSX.writeFile(wb, `timetrack_${year}${p2(month)}.xlsx`)
}

// ── PDF エクスポート（印刷ダイアログ経由） ────────────────
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
      <td class="num">${s.leave_year || 0}h</td>
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
  body { font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic Pro',
         'Meiryo', sans-serif; color: #222; font-size: 10px; }
  h1  { font-size: 15px; color: #4a3f9a; margin-bottom: 2px; }
  .sub{ font-size: 9px; color: #777; margin-bottom: 12px; }
  h2  { font-size: 10px; font-weight: 700; color: #333;
        border-left: 3px solid #b39dfa; padding-left: 6px; margin: 12px 0 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th  { background: #f0eeff; padding: 4px 7px; text-align: left;
        border: 1px solid #ccc; font-weight: 700; color: #4a3f9a; white-space: nowrap; }
  td  { padding: 3px 7px; border: 1px solid #e0e0e0; white-space: nowrap; }
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
