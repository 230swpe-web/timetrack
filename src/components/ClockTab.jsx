import { useClock } from '../hooks/useClock'
import useAppStore from '../store/useAppStore'
import { toHM, calcWorkMins, formatWorkMins, p2 } from '../utils/helpers'

export default function ClockTab() {
  const { timeStr, dateStr, now } = useClock()
  const attendance = useAppStore(s => s.attendance)
  const attStatus = useAppStore(s => s.attStatus)
  const todayLogs = useAppStore(s => s.todayLogs)
  const weeklyRecords = useAppStore(s => s.weeklyRecords)
  const clockIn = useAppStore(s => s.clockIn)
  const breakStart = useAppStore(s => s.breakStart)
  const breakEnd = useAppStore(s => s.breakEnd)
  const clockOut = useAppStore(s => s.clockOut)
  const showToast = useAppStore(s => s.showToast)

  const workMins = attendance ? calcWorkMins(attendance, now) : 0
  const workStr = attStatus === 'idle' ? '-:--' : formatWorkMins(workMins)

  const isOnBreak = attStatus === 'on_break'
  const breakElapsed = isOnBreak && attendance?.break_start
    ? Math.floor((now - new Date(attendance.break_start)) / 60000)
    : 0
  const breakSince = attendance?.break_start ? toHM(attendance.break_start) : '--:--'

  const handleAction = async (type) => {
    try {
      if (type === 'in') await clockIn()
      else if (type === 'nkout') await breakStart()
      else if (type === 'nkin') await breakEnd()
      else if (type === 'out') await clockOut()
      showToast(
        type === 'in' ? '🟢 出勤しました' :
        type === 'nkout' ? '🟠 中抜けを開始しました' :
        type === 'nkin' ? '🔵 戻りました' :
        '🔴 退勤しました'
      )
    } catch {
      showToast('エラーが発生しました')
    }
  }

  const chipColor = (val, color) => val !== '--:--' && val !== '-:--' ? color : 'var(--mu)'

  return (
    <div className="sc">
      <div className="big-time">
        <div className="big-time-val">{timeStr}</div>
        <div className="big-time-date">{dateStr}</div>
      </div>

      <div className="chips">
        <div className="chip">
          <div className="chip-l">出勤</div>
          <div className="chip-v" style={{ color: attendance?.clock_in ? 'var(--gr)' : 'var(--mu)' }}>
            {attendance?.clock_in ? toHM(attendance.clock_in) : '--:--'}
          </div>
        </div>
        <div className="chip">
          <div className="chip-l">中抜け</div>
          <div className="chip-v" style={{ color: attendance?.break_start ? 'var(--or)' : 'var(--mu)' }}>
            {attendance?.break_start ? toHM(attendance.break_start) : '--:--'}
          </div>
        </div>
        <div className="chip">
          <div className="chip-l">戻り</div>
          <div className="chip-v" style={{ color: attendance?.break_end ? 'var(--gr)' : 'var(--mu)' }}>
            {attendance?.break_end ? toHM(attendance.break_end) : '--:--'}
          </div>
        </div>
        <div className="chip">
          <div className="chip-l">勤務計</div>
          <div className="chip-v" style={{ color: attStatus !== 'idle' && attStatus !== 'done' ? 'var(--gr)' : 'var(--mu)' }}>
            {workStr}
          </div>
        </div>
      </div>

      {isOnBreak && (
        <div className="nk-bar">
          <div className="nk-dot" />
          <div className="nk-txt">中抜け中</div>
          <div className="nk-since">{breakSince} から（{breakElapsed}分）</div>
        </div>
      )}

      <div className="btn-grid">
        {attStatus === 'idle' && (
          <button className="cbtn in cbtn-full" onClick={() => handleAction('in')}>🟢　出勤する</button>
        )}
        {(attStatus === 'working' || attStatus === 'back') && (
          <>
            <button className="cbtn nk-out" onClick={() => handleAction('nkout')}>🟠　中抜けする</button>
            <button className="cbtn out" onClick={() => handleAction('out')}>🔴　退勤する</button>
          </>
        )}
        {attStatus === 'on_break' && (
          <button className="cbtn nk-in cbtn-full" onClick={() => handleAction('nkin')}>🟢　戻る（中抜け終了）</button>
        )}
        {attStatus === 'done' && (
          <button className="cbtn done">✅　本日の勤務終了</button>
        )}
      </div>

      <div className="slbl">今日の打刻</div>
      <div className="log-box">
        {todayLogs.length === 0
          ? <div className="empty">まだ打刻がありません</div>
          : todayLogs.map((log, i) => (
            <div key={i} className="lr">
              <span className="lr-ic">{log.ic}</span>
              <span className="lr-t">{log.t}</span>
              <span className="lr-v">{log.v}</span>
              {log.sub && <span className="lr-r" style={{ fontSize: 11, color: 'var(--mu)' }}>{log.sub}</span>}
            </div>
          ))
        }
      </div>

      <div className="slbl">今週の記録</div>
      <div className="log-box">
        {weeklyRecords.length === 0
          ? <div className="empty">記録がありません</div>
          : weeklyRecords.map((r, i) => {
            let badge, color = 'var(--tx)'
            if (r.status === 'today') { badge = <span className="badge bm">本日</span>; color = 'var(--mu)' }
            else if (r.status === 'leave') { badge = <span className="badge bb">時間有給</span>; color = 'var(--ac)' }
            else if (r.status === 'break') { badge = <span className="badge bo">中抜けあり</span>; color = 'var(--or)' }
            else if (r.status === 'normal') { badge = <span className="badge bg">正常</span> }
            else { badge = null; color = 'var(--mu)' }
            return (
              <div key={i} className="lr">
                <span className="lr-t">{r.day}</span>
                <span className="lr-v" style={{ color }}>{r.value}</span>
                <span className="lr-r">{badge}</span>
              </div>
            )
          })
        }
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
