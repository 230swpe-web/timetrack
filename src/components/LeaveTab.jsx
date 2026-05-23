import { useState, useEffect } from 'react'
import useAppStore from '../store/useAppStore'
import { fhS, fhLabel, genTimes, todayStr, formatJpDate } from '../utils/helpers'

export default function LeaveTab() {
  const leaveBalance = useAppStore(s => s.leaveBalance)
  const leaveRequests = useAppStore(s => s.leaveRequests)
  const settings = useAppStore(s => s.settings)
  const submitLeaveRequest = useAppStore(s => s.submitLeaveRequest)
  const showToast = useAppStore(s => s.showToast)

  const today = todayStr()
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const times = genTimes()

  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const rawMins = (eh * 60 + em) - (sh * 60 + sm)
  const unitMins = (settings?.unit || 0.5) * 60
  const snappedMins = rawMins > 0 ? Math.round(rawMins / unitMins) * unitMins : 0
  const hours = snappedMins / 60

  const bal = leaveBalance || { granted_hours: 0, carry_over_hours: 0, used_hours: 0 }
  const remaining = bal.granted_hours + bal.carry_over_hours - bal.used_hours

  const warnMsg = hours > 0 && hours > remaining
    ? `⚠ 残高不足（残り ${fhLabel(remaining)}）` : ''

  const handleSubmit = async () => {
    if (rawMins <= 0) { showToast('終了時刻は開始時刻より後にしてください'); return }
    if (hours > remaining) { showToast('有給残高が不足しています'); return }
    setSubmitting(true)
    try {
      await submitLeaveRequest({ date, startTime, endTime, hours, note })
      showToast(`✅ ${formatJpDate(date)} ${startTime}〜${endTime}（${fhLabel(hours)}）を報告しました`)
      setNote('')
    } catch {
      showToast('送信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  const statusBadge = (status) => {
    if (status === 'approved') return <span className="badge bg">確認済み</span>
    if (status === 'rejected') return <span className="badge br">差戻し</span>
    return <span className="badge by">確認待ち</span>
  }

  return (
    <div className="sc">
      <div className="leave-bal card-bloom">
        <div className="lb-lbl">有給残高</div>
        <div className="lb-main">
          <div className="lb-num">{fhS(remaining)}</div>
          <div className="lb-unit">時間</div>
          {bal.carry_over_hours > 0 && (
            <div className="lb-carry">繰越 {fhS(bal.carry_over_hours)}h 含む</div>
          )}
        </div>
        <div className="lb-row">
          <div className="lb-item">
            <div className="lb-il">繰越</div>
            <div className="lb-iv carry">
              {bal.carry_over_hours > 0 ? `${fhS(bal.carry_over_hours)}h` : 'なし'}
            </div>
          </div>
          <div className="lb-item">
            <div className="lb-il">今年度付与</div>
            <div className="lb-iv">{fhS(bal.granted_hours)}h</div>
          </div>
          <div className="lb-item">
            <div className="lb-il">使用済み</div>
            <div className="lb-iv used">{fhS(bal.used_hours)}h</div>
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="fc-title">有給報告</div>
        <div className="ffull">
          <label>日付</label>
          <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="frow">
          <div>
            <label>開始時刻</label>
            <select value={startTime} onChange={e => setStartTime(e.target.value)}>
              {times.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>終了時刻</label>
            <select value={endTime} onChange={e => setEndTime(e.target.value)}>
              {times.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="dur-box">
          <div className="dur-l">取得時間</div>
          <div className="dur-v">{snappedMins > 0 ? fhLabel(hours) : '--'}</div>
        </div>
        <div className="warn">{warnMsg}</div>
        <div className="ffull">
          <label>備考（任意）</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="例：通院のため" />
        </div>
        <button className="btn-sub" onClick={handleSubmit} disabled={submitting || snappedMins <= 0}>
          {submitting ? '送信中...' : '報告する'}
        </button>
      </div>

      <div className="hist-card">
        <div className="hist-title">報告履歴</div>
        {leaveRequests.length === 0
          ? <div className="empty">報告履歴はありません</div>
          : leaveRequests.map(req => {
            const detail = `${req.start_time?.slice(0,5)}〜${req.end_time?.slice(0,5)}（${fhLabel(req.hours)}）`
            return (
              <div key={req.id} className="hr-row">
                <div className="hr-info">
                  <div className="hr-date">{formatJpDate(req.date)}</div>
                  <div className="hr-detail">{detail}{req.note ? ` · ${req.note}` : ''}</div>
                </div>
                <span className="hr-h">{fhLabel(req.hours)}</span>
                {statusBadge(req.status)}
              </div>
            )
          })
        }
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
