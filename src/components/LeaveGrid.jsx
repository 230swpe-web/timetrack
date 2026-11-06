import { fhS } from '../utils/helpers'

// 有給B案：1マス＝1時間、横1段＝1日（8時間）のマス目で残りを見せる
// 使った分は「1日目」の左から順に消していく（紙の表と同じ順番）

const HOURS_PER_DAY = 8

export function daysLabel(hours) {
  const h = Math.max(0, hours)
  const d = Math.floor(h / HOURS_PER_DAY)
  const r = Math.round((h - d * HOURS_PER_DAY) * 2) / 2
  if (d === 0) return `${fhS(r)}時間`
  if (r === 0) return `${d}日`
  return `${d}日と${fhS(r)}時間`
}

function buildRows(granted, carry) {
  const rows = []
  const gRows = Math.ceil(granted / HOURS_PER_DAY)
  for (let i = 0; i < gRows; i++) {
    rows.push({ label: `${i + 1}日目`, cap: Math.min(HOURS_PER_DAY, granted - i * HOURS_PER_DAY), carry: false })
  }
  const cRows = Math.ceil(carry / HOURS_PER_DAY)
  for (let j = 0; j < cRows; j++) {
    rows.push({ label: cRows > 1 ? `繰越${j + 1}` : '繰越', cap: Math.min(HOURS_PER_DAY, carry - j * HOURS_PER_DAY), carry: true })
  }
  return rows
}

export default function LeaveGrid({ granted = 0, carry = 0, used = 0, compact = false }) {
  const rows = buildRows(granted, carry)
  let left = used

  return (
    <div className={`lg${compact ? ' lg-c' : ''}`}>
      {!compact && (
        <div className="lg-head">
          <span>1マス＝1時間　横1段＝1日（8時間）</span>
        </div>
      )}
      {rows.map((row, ri) => (
        <div key={ri} className="lg-row">
          <div className={`lg-lbl${row.carry ? ' carry' : ''}`}>{row.label}</div>
          <div className="lg-cells">
            {Array.from({ length: HOURS_PER_DAY }).map((_, k) => {
              const capCell = Math.max(0, Math.min(1, row.cap - k)) // このマスの大きさ（1 / 0.5 / 0）
              if (capCell === 0) return <div key={k} className="lg-cell none" />
              const u = Math.max(0, Math.min(capCell, left))
              left -= capCell
              const state = u >= capCell ? 'used' : u > 0 ? 'half' : 'free'
              const cls = `lg-cell ${state}${row.carry ? ' carry' : ''}${capCell < 1 ? ' small' : ''}`
              return <div key={k} className={cls}>{state === 'used' ? '×' : ''}</div>
            })}
          </div>
        </div>
      ))}
      {!compact && (
        <div className="lg-legend">
          <span><i className="lg-cell free" />まだ使える</span>
          <span><i className="lg-cell used" />使った</span>
          {carry > 0 && <span><i className="lg-cell free carry" />去年からの繰越</span>}
        </div>
      )}
      {!compact && <div className="lg-note">1分〜30分の遅れ・早退は0.5時間（マス半分）として引きます</div>}
    </div>
  )
}
