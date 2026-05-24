import { useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { fhLabel, formatJpDate } from '../../utils/helpers'

export default function LeaveManagement() {
  const allLeaveRequests = useAppStore(s => s.allLeaveRequests)
  const loadAdminData = useAppStore(s => s.loadAdminData)
  const approveLeave = useAppStore(s => s.approveLeave)
  const rejectLeave = useAppStore(s => s.rejectLeave)
  const showToast = useAppStore(s => s.showToast)

  useEffect(() => { loadAdminData() }, [])

  const pending = allLeaveRequests.filter(r => r.confirmed === false)
  const confirmed = allLeaveRequests.filter(r => r.confirmed !== false)

  const handleApprove = async (id) => {
    await approveLeave(id)
    showToast('✅ 確認済みにしました')
  }

  const handleReject = async (id) => {
    await rejectLeave(id)
    showToast('差戻しました')
  }

  const detailStr = (r) => {
    const d = formatJpDate(r.date)
    const range = `${r.time_from?.slice(0,5)}〜${r.time_to?.slice(0,5)}`
    return `${d} ${range}（${fhLabel(r.hours)}）${r.note ? ` · ${r.note}` : ''}`
  }

  return (
    <div className="sc">
      <div className="slbl">確認待ち</div>
      <div className="pcard">
        {pending.length === 0
          ? <div className="empty">確認待ちの報告はありません</div>
          : pending.map(r => (
            <div key={r.id} className="pi">
              <div className="pav" style={{ background: `linear-gradient(135deg,${r.staff?.color_from||'#7c8ef7'},${r.staff?.color_to||'#b39dfa'})` }}>
                {r.staff?.name?.replace(/\s+/g, '')[0] || '?'}
              </div>
              <div className="pinfo">
                <div className="pnm">{r.staff?.name || '---'}</div>
                <div className="pdt">{detailStr(r)}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn-ap" onClick={() => handleApprove(r.id)}>確認済</button>
                <button className="btn-dn" onClick={() => handleReject(r.id)}>差戻し</button>
              </div>
            </div>
          ))
        }
      </div>

      <div className="slbl">確認済み・差戻し履歴</div>
      <div className="pcard">
        {confirmed.length === 0
          ? <div className="empty">履歴はありません</div>
          : confirmed.map(r => (
            <div key={r.id} className="pi">
              <div className="pav" style={{ background: `linear-gradient(135deg,${r.staff?.color_from||'#7c8ef7'},${r.staff?.color_to||'#b39dfa'})` }}>
                {r.staff?.name?.replace(/\s+/g, '')[0] || '?'}
              </div>
              <div className="pinfo">
                <div className="pnm">{r.staff?.name || '---'}</div>
                <div className="pdt">{detailStr(r)}</div>
              </div>
              {r.confirmed === true
                ? <span className="badge bg">確認済み</span>
                : <span className="badge br">差戻し</span>
              }
            </div>
          ))
        }
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
