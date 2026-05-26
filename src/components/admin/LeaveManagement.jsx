import { useEffect, useState } from 'react'
import useAppStore from '../../store/useAppStore'
import { fhLabel, fhS, formatJpDate } from '../../utils/helpers'

export default function LeaveManagement() {
  const allLeaveRequests  = useAppStore(s => s.allLeaveRequests)
  const allStaff          = useAppStore(s => s.allStaff)
  const loadAdminData     = useAppStore(s => s.loadAdminData)
  const approveLeave      = useAppStore(s => s.approveLeave)
  const rejectLeave       = useAppStore(s => s.rejectLeave)
  const updateLeaveUsed   = useAppStore(s => s.updateLeaveUsed)
  const updateLeaveCarry  = useAppStore(s => s.updateLeaveCarry)
  const showToast         = useAppStore(s => s.showToast)

  const [editedUsed,  setEditedUsed]  = useState({})
  const [editedCarry, setEditedCarry] = useState({})
  // savingKey: `${staffId}-used` or `${staffId}-carry`
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => { loadAdminData() }, [])

  useEffect(() => {
    const initUsed  = {}
    const initCarry = {}
    allStaff.forEach(s => {
      initUsed[s.id]  = s.leave_used  ?? 0
      initCarry[s.id] = s.leave_carry ?? 0
    })
    setEditedUsed(initUsed)
    setEditedCarry(initCarry)
  }, [allStaff])

  const pending   = allLeaveRequests.filter(r => r.confirmed === false)
  const confirmed = allLeaveRequests.filter(r => r.confirmed !== false)

  const handleApprove = async (id) => {
    await approveLeave(id)
    showToast('✅ 確認済みにしました')
  }
  const handleReject = async (id) => {
    await rejectLeave(id)
    showToast('差戻しました')
  }

  const handleSaveUsed = async (staffId) => {
    const key   = `${staffId}-used`
    const hours = parseFloat(editedUsed[staffId]) || 0
    setSavingKey(key)
    try {
      await updateLeaveUsed(staffId, hours)
      showToast('✅ 使用済み時間を更新しました')
    } catch {
      showToast('更新エラーが発生しました')
    } finally {
      setSavingKey(null)
    }
  }

  const handleSaveCarry = async (staffId) => {
    const key   = `${staffId}-carry`
    const hours = parseFloat(editedCarry[staffId]) || 0
    setSavingKey(key)
    try {
      await updateLeaveCarry(staffId, hours)
      showToast('✅ 繰越時間を更新しました')
    } catch {
      showToast('更新エラーが発生しました')
    } finally {
      setSavingKey(null)
    }
  }

  const detailStr = (r) => {
    const d     = formatJpDate(r.date)
    const range = `${r.time_from?.slice(0,5)}〜${r.time_to?.slice(0,5)}`
    return `${d} ${range}（${fhLabel(r.hours)}）${r.note ? ` · ${r.note}` : ''}`
  }

  const inputStyle = {
    width: 64, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--bd)',
    background: 'var(--bg)', color: 'var(--tx)', fontFamily: 'var(--fn)',
    fontSize: 13, textAlign: 'right',
  }
  const saveBtn = (disabled) => ({
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: disabled ? 'var(--bd)' : 'linear-gradient(135deg,var(--ac),var(--pu))',
    color: '#fff', fontFamily: 'var(--fn)', fontSize: 12,
    fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  })

  return (
    <div className="sc">

      {/* ── 有給残高管理 ── */}
      <div className="slbl">有給残高管理</div>
      <div className="pcard">
        {allStaff.length === 0
          ? <div className="empty">スタッフデータを読み込み中...</div>
          : allStaff.map(s => {
            const used      = editedUsed[s.id]  ?? s.leave_used  ?? 0
            const carry     = editedCarry[s.id] ?? s.leave_carry ?? 0
            const granted   = s.leave_year ?? 0
            const remaining = granted + carry - used
            const savingUsed  = savingKey === `${s.id}-used`
            const savingCarry = savingKey === `${s.id}-carry`
            return (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                {/* スタッフ名 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div className="pav" style={{
                    background: `linear-gradient(135deg,${s.color_from||'#7c8ef7'},${s.color_to||'#b39dfa'})`,
                  }}>
                    {s.name?.replace(/\s+/g, '')[0] || '?'}
                  </div>
                  <div className="pnm">{s.name}</div>
                </div>
                {/* 繰越・使用済み 入力行 */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8,
                  paddingLeft: 40, marginBottom: 6,
                }}>
                  {/* 繰越 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--mu)' }}>繰越</span>
                    <input
                      type="number"
                      value={carry}
                      min="0"
                      step="0.5"
                      style={inputStyle}
                      onChange={e => setEditedCarry(p => ({
                        ...p, [s.id]: parseFloat(e.target.value) || 0,
                      }))}
                    />
                    <span style={{ fontSize: 11, color: 'var(--mu)' }}>h</span>
                    <button
                      style={saveBtn(savingCarry)}
                      disabled={savingCarry}
                      onClick={() => handleSaveCarry(s.id)}
                    >
                      {savingCarry ? '...' : '保存'}
                    </button>
                  </div>
                  {/* 使用済み */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--mu)' }}>使用済み</span>
                    <input
                      type="number"
                      value={used}
                      min="0"
                      step="0.5"
                      style={inputStyle}
                      onChange={e => setEditedUsed(p => ({
                        ...p, [s.id]: parseFloat(e.target.value) || 0,
                      }))}
                    />
                    <span style={{ fontSize: 11, color: 'var(--mu)' }}>h</span>
                    <button
                      style={saveBtn(savingUsed)}
                      disabled={savingUsed}
                      onClick={() => handleSaveUsed(s.id)}
                    >
                      {savingUsed ? '...' : '保存'}
                    </button>
                  </div>
                </div>
                {/* 残高サマリ */}
                <div style={{
                  display: 'flex', gap: 12, paddingLeft: 40,
                  fontSize: 11, color: 'var(--mu)',
                }}>
                  <span>付与 <strong style={{ color: 'var(--tx)' }}>{fhS(granted)}h</strong></span>
                  <span>繰越 <strong style={{ color: 'var(--tx)' }}>{fhS(carry)}h</strong></span>
                  <span>使用 <strong style={{ color: 'var(--tx)' }}>{fhS(used)}h</strong></span>
                  <span>残高 <strong style={{ color: remaining < 0 ? '#f47a8a' : 'var(--ac)' }}>
                    {fhS(remaining)}h
                  </strong></span>
                </div>
              </div>
            )
          })
        }
      </div>

      {/* ── 確認待ち ── */}
      <div className="slbl" style={{ marginTop: 16 }}>確認待ち</div>
      <div className="pcard">
        {pending.length === 0
          ? <div className="empty">確認待ちの報告はありません</div>
          : pending.map(r => (
            <div key={r.id} className="pi">
              <div className="pav" style={{
                background: `linear-gradient(135deg,${r.staff?.color_from||'#7c8ef7'},${r.staff?.color_to||'#b39dfa'})`,
              }}>
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

      {/* ── 確認済み・差戻し履歴 ── */}
      <div className="slbl" style={{ marginTop: 16 }}>確認済み・差戻し履歴</div>
      <div className="pcard">
        {confirmed.length === 0
          ? <div className="empty">履歴はありません</div>
          : confirmed.map(r => (
            <div key={r.id} className="pi">
              <div className="pav" style={{
                background: `linear-gradient(135deg,${r.staff?.color_from||'#7c8ef7'},${r.staff?.color_to||'#b39dfa'})`,
              }}>
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
