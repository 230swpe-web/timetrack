import { p2 } from './helpers'

// —— 25日締め期間の計算 ————————————————————————————
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

// —— 勤怠1レコードの実働時間(h)を計算 ————————————————————————————
function calcWorkH(att) {
  if (!att?.clock_in || !att?.clock_out) return 0
  const mins = Math.floor(
    (new Date(att.clock_out) - new Date(att.clock_in)) / 60000
  ) - (att.break_minutes || 0)
  return Math.max(0, mins) / 60
}

// —— 時刻文字列を HH:MM 形式に変換 ————————————————————————————
function toHHMM(datetimeStr) {
  if (!datetimeStr) return ''
  const d = new Date(datetimeStr)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

// —— 期間内の日付一覧を生成 ————————————————————————————
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

// —— 曜日ラベル ————————————————————————————
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(d) {
  const m   = d.getMonth() + 1
  const day = d.getDate()
  const w   = WEEKDAYS[d.getDay()]
  return `${m}月${day}日(${w})`
}

// —— スタッフごとの月次サマリーを生成 ————————————————————————————
function buildStaffRows(allStaff, attendance, leaveReports) {
  return allStaff.map(s => {
    const satts      = attendance.filter(a => a.staff_id === s.id)
    const sleave     = leaveReports.filter(r => r.staff_id === s.id)
    const workDays   = satts.filter(a =>
