export function p2(n) {
  return String(n).padStart(2, '0')
}

export function fhLabel(h) {
  const m = Math.round(h * 60)
  const wh = Math.floor(m / 60)
  const wm = m % 60
  if (wh > 0 && wm > 0) return `${wh}時間${wm}分`
  if (wh > 0) return `${wh}時間`
  return `${wm}分`
}

export function fhS(h) {
  if (h === 0) return '0'
  const i = Math.floor(h)
  return Math.round((h - i) * 10) === 5 ? `${i}.5` : String(i)
}

export function genTimes() {
  const t = []
  for (let h = 7; h <= 21; h++) {
    t.push(`${p2(h)}:00`)
    t.push(`${p2(h)}:30`)
  }
  t.push('22:00')
  return t
}

// 日本時間(JST)基準の日付文字列 YYYY-MM-DD を返す
// base にサーバー時刻を渡せば、端末の時計や地域設定に依存しない
export function todayStr(base = new Date()) {
  return base.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

// タイムスタンプを日本時間(JST)の HH:MM で表示する
// 端末のタイムゾーン設定に関わらず常にJSTで表示される
export function toHM(isoString) {
  if (!isoString) return '--:--'
  const d = new Date(isoString)
  if (isNaN(d)) return '--:--'
  return d.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function formatJpDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function getMondayOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getCurrentFiscalYear() {
  const now = new Date()
  const month = now.getMonth() + 1
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1
}

export function calcWorkMins(att, now = new Date()) {
  if (!att?.clock_in) return 0
  const clockIn = new Date(att.clock_in)
  let endTime
  if (att.clock_out) {
    endTime = new Date(att.clock_out)
  } else if (att.status === 'on_break' && att.break_start) {
    endTime = new Date(att.break_start)
  } else {
    endTime = now
  }
  const totalMins = Math.floor((endTime - clockIn) / 60000)
  return Math.max(0, totalMins - (att.break_minutes || 0))
}

export function formatWorkMins(mins) {
  return `${Math.floor(mins / 60)}:${p2(mins % 60)}`
}
