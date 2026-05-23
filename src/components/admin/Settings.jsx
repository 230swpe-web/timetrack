import { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'
import { getCurrentFiscalYear } from '../../utils/helpers'

export default function Settings() {
  const allStaff = useAppStore(s => s.allStaff)
  const allLeaveBalances = useAppStore(s => s.allLeaveBalances)
  const settings = useAppStore(s => s.settings)
  const saveGlobalSettings = useAppStore(s => s.saveGlobalSettings)
  const saveStaffSettings = useAppStore(s => s.saveStaffSettings)
  const loadAdminData = useAppStore(s => s.loadAdminData)
  const showToast = useAppStore(s => s.showToast)

  const [unit, setUnit] = useState(0.5)
  const [workH, setWorkH] = useState(8)
  const [carryMax, setCarryMax] = useState(40)
  const [staffEdits, setStaffEdits] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAdminData()
  }, [])

  useEffect(() => {
    setUnit(settings.unit || 0.5)
    setWorkH(settings.workH || 8)
    setCarryMax(settings.carryMax || 40)
  }, [settings])

  useEffect(() => {
    if (allStaff.length > 0) {
      setStaffEdits(allStaff.map(s => {
        const bal = allLeaveBalances[s.id]
        return {
          id: s.id,
          name: s.name,
          short_name: s.short_name,
          role: s.role,
          pin: s.pin,
          gradient_from: s.gradient_from,
          gradient_to: s.gradient_to,
          granted_hours: bal?.granted_hours ?? 40,
        }
      }))
    }
  }, [allStaff, allLeaveBalances])

  const updateStaff = (id, field, value) => {
    setStaffEdits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveGlobalSettings({ unit: parseFloat(unit) || 0.5, workH: parseFloat(workH) || 8, carryMax: parseFloat(carryMax) || 40 })

      const validEdits = staffEdits.filter(s => {
        if (!/^\d{4}$/.test(s.pin)) return false
        if (!s.name.trim()) return false
        return true
      })
      if (validEdits.length !== staffEdits.length) {
        showToast('⚠ PINは4桁の数字で入力してください')
        setSaving(false)
        return
      }

      await saveStaffSettings(validEdits)
      showToast('✅ 設定を保存しました')
    } catch {
      showToast('保存エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sc">
      <div className="set-section">
        <div className="set-section-title">📋 基本ルール</div>
        <div className="set-global-row">
          <div className="set-global-lbl">有給の最小単位</div>
          <input type="number" className="set-global-val" value={unit} step="0.5" min="0.5" max="8"
            onChange={e => setUnit(e.target.value)} />
          <div className="set-global-unit">時間</div>
        </div>
        <div className="set-global-row">
          <div className="set-global-lbl">1日の所定労働時間</div>
          <input type="number" className="set-global-val" value={workH} step="0.5" min="1" max="12"
            onChange={e => setWorkH(e.target.value)} />
          <div className="set-global-unit">時間</div>
        </div>
        <div className="set-global-row">
          <div className="set-global-lbl">繰越上限</div>
          <input type="number" className="set-global-val" value={carryMax} step="8" min="0"
            onChange={e => setCarryMax(e.target.value)} />
          <div className="set-global-unit">時間</div>
        </div>
      </div>

      <div className="set-section">
        <div className="set-section-title">👤 スタッフ管理</div>
        {staffEdits.map(s => (
          <div key={s.id} className="staff-edit-card">
            <div className="staff-edit-header">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${s.gradient_from},${s.gradient_to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {s.short_name}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: 'var(--mi)' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  className="set-val"
                  value={s.granted_hours}
                  min="0" max="200" step="4"
                  onChange={e => updateStaff(s.id, 'granted_hours', parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>h / 年</span>
              </div>
            </div>
            <div className="staff-edit-grid">
              <div>
                <label>氏名</label>
                <input type="text" value={s.name} onChange={e => updateStaff(s.id, 'name', e.target.value)} />
              </div>
              <div>
                <label>役職・ステータス</label>
                <input type="text" value={s.role} onChange={e => updateStaff(s.id, 'role', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="set-section">
        <div className="set-section-title">🔑 PIN管理</div>
        {staffEdits.map(s => (
          <div key={s.id} className="set-row">
            <div className="pav" style={{ background: `linear-gradient(135deg,${s.gradient_from},${s.gradient_to})`, width: 34, height: 34, fontSize: 12 }}>
              {s.short_name}
            </div>
            <div className="set-info">
              <div className="set-nm">{s.name}</div>
              <div className="set-sub">{s.role}</div>
            </div>
            <input
              type="text"
              className="set-val set-val-pin"
              value={s.pin}
              maxLength={4}
              placeholder="----"
              onChange={e => updateStaff(s.id, 'pin', e.target.value.replace(/\D/g, ''))}
            />
            <div className="set-unit" style={{ fontSize: 9, color: 'var(--mu)' }}>PIN</div>
          </div>
        ))}
      </div>

      <button className="btn-save" onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : '保存する'}
      </button>
      <div style={{ height: 24 }} />
    </div>
  )
}
