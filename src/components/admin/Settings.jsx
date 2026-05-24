import { useState, useEffect } from 'react'
import useAppStore from '../../store/useAppStore'

const DEFAULT_STAFF = [
  { name: '田中 花子', short_name: '田', role: 'リーダー', pin: '1234', color_from: '#7c8ef7', color_to: '#b39dfa', granted_hours: 40 },
  { name: '鈴木 一郎', short_name: '鈴', role: 'スタッフ',  pin: '2345', color_from: '#2dd4a0', color_to: '#7c8ef7', granted_hours: 40 },
  { name: '佐藤 美咲', short_name: '佐', role: 'パート',    pin: '3456', color_from: '#f7c85a', color_to: '#f47a8a', granted_hours: 32 },
  { name: '山田 太郎', short_name: '山', role: 'スタッフ',  pin: '4567', color_from: '#f47a8a', color_to: '#f7c85a', granted_hours: 40 },
]

const EMPTY_NEW_STAFF = { name: '', role: '', pin: '', grantedHours: 40 }

function makeEdits(staff) {
  return staff.map(s => ({
    id: s.id || null,
    name: s.name,
    short_name: s.short_name,
    role: s.role,
    pin: s.pin,
    color_from: s.color_from,
    color_to: s.color_to,
    granted_hours: s.leave_year ?? s.granted_hours ?? 40,
  }))
}

export default function Settings() {
  const allStaff = useAppStore(s => s.allStaff)
  const settings = useAppStore(s => s.settings)
  const saveGlobalSettings = useAppStore(s => s.saveGlobalSettings)
  const saveStaffSettings = useAppStore(s => s.saveStaffSettings)
  const changeAdminPin = useAppStore(s => s.changeAdminPin)
  const addStaff = useAppStore(s => s.addStaff)
  const loadAdminData = useAppStore(s => s.loadAdminData)
  const showToast = useAppStore(s => s.showToast)

  const [unit, setUnit] = useState(0.5)
  const [workH, setWorkH] = useState(8)
  const [carryMax, setCarryMax] = useState(40)
  const [staffEdits, setStaffEdits] = useState(makeEdits(DEFAULT_STAFF))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 管理者PIN変更
  const [curPin, setCurPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [cfmPin, setCfmPin] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  // スタッフ追加
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState(EMPTY_NEW_STAFF)
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    loadAdminData().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setUnit(settings.unit ?? 0.5)
    setWorkH(settings.workH ?? 8)
    setCarryMax(settings.carryMax ?? 40)
  }, [settings])

  useEffect(() => {
    if (allStaff.length > 0) {
      setStaffEdits(makeEdits(allStaff))
    }
  }, [allStaff])

  const updateStaff = (idx, field, value) => {
    setStaffEdits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const handleSave = async () => {
    const invalid = staffEdits.find(s => !/^\d{4}$/.test(s.pin) || !s.name.trim())
    if (invalid) {
      showToast(`⚠ ${invalid.name || '名無し'}：PINは4桁の数字で入力してください`)
      return
    }
    setSaving(true)
    try {
      await saveGlobalSettings({
        unit: parseFloat(unit) || 0.5,
        workH: parseFloat(workH) || 8,
        carryMax: parseFloat(carryMax) || 40,
      })
      if (allStaff.length > 0) {
        await saveStaffSettings(staffEdits.filter(s => s.id))
      }
      showToast('✅ 設定を保存しました')
    } catch (e) {
      showToast(`保存エラー: ${e.message || '不明なエラー'}`)
    } finally {
      setSaving(false)
    }
  }

  const handlePinChange = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      showToast('⚠ 新しいPINは4桁の数字で入力してください')
      return
    }
    if (newPin !== cfmPin) {
      showToast('⚠ 新しいPINと確認用PINが一致しません')
      return
    }
    setPinSaving(true)
    try {
      await changeAdminPin(curPin, newPin)
      setCurPin('')
      setNewPin('')
      setCfmPin('')
      showToast('✅ 管理者PINを変更しました')
    } catch (e) {
      showToast(`⚠ ${e.message || 'PIN変更エラー'}`)
    } finally {
      setPinSaving(false)
    }
  }

  const handleAddStaff = async () => {
    if (!newStaff.name.trim()) {
      showToast('⚠ 氏名を入力してください')
      return
    }
    if (!/^\d{4}$/.test(newStaff.pin)) {
      showToast('⚠ PINは4桁の数字で入力してください')
      return
    }
    setAddSaving(true)
    try {
      await addStaff({
        name: newStaff.name.trim(),
        role: newStaff.role.trim() || 'スタッフ',
        pin: newStaff.pin,
        grantedHours: parseFloat(newStaff.grantedHours) || 40,
      })
      setNewStaff(EMPTY_NEW_STAFF)
      setShowAddStaff(false)
      showToast('✅ スタッフを追加しました')
    } catch (e) {
      showToast(`追加エラー: ${e.message || '不明なエラー'}`)
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <div className="sc">
      {/* ── 基本ルール ── */}
      <div className="set-section">
        <div className="set-section-title">📋 基本ルール</div>
        <div className="set-global-row">
          <div className="set-global-lbl">有給の最小単位</div>
          <input type="number" className="set-global-val" value={unit}
            step="0.5" min="0.5" max="8" onChange={e => setUnit(e.target.value)} />
          <div className="set-global-unit">時間</div>
        </div>
        <div className="set-global-row">
          <div className="set-global-lbl">1日の所定労働時間</div>
          <input type="number" className="set-global-val" value={workH}
            step="0.5" min="1" max="12" onChange={e => setWorkH(e.target.value)} />
          <div className="set-global-unit">時間</div>
        </div>
        <div className="set-global-row">
          <div className="set-global-lbl">繰越上限</div>
          <input type="number" className="set-global-val" value={carryMax}
            step="8" min="0" onChange={e => setCarryMax(e.target.value)} />
          <div className="set-global-unit">時間</div>
        </div>
      </div>

      {/* ── スタッフ管理 ── */}
      <div className="set-section">
        <div className="set-section-title" style={{ justifyContent: 'space-between' }}>
          <span>👤 スタッフ管理</span>
          <button
            onClick={() => setShowAddStaff(v => !v)}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: 'none', background: 'linear-gradient(135deg,var(--ac),var(--pu))',
              color: '#fff', fontSize: 18, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, flexShrink: 0,
            }}
            title="スタッフを追加"
          >+</button>
        </div>

        {/* スタッフ追加フォーム */}
        {showAddStaff && (
          <div className="staff-edit-card" style={{ marginBottom: 12, border: '1px solid var(--pu)', background: 'rgba(124,142,247,.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pu)', marginBottom: 12 }}>＋ 新しいスタッフ</div>
            <div className="staff-edit-grid" style={{ marginBottom: 8 }}>
              <div>
                <label>氏名</label>
                <input type="text" placeholder="例：山本 次郎" value={newStaff.name}
                  onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label>役職・ステータス</label>
                <input type="text" placeholder="例：スタッフ" value={newStaff.role}
                  onChange={e => setNewStaff(p => ({ ...p, role: e.target.value }))} />
              </div>
            </div>
            <div className="staff-edit-grid">
              <div>
                <label>PIN（4桁）</label>
                <input type="text" placeholder="0000" maxLength={4} value={newStaff.pin}
                  onChange={e => setNewStaff(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div>
                <label>有給時間 / 年</label>
                <input type="number" min="0" max="200" step="4" value={newStaff.grantedHours}
                  onChange={e => setNewStaff(p => ({ ...p, grantedHours: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleAddStaff}
                disabled={addSaving}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,var(--ac),var(--pu))',
                  color: '#fff', fontFamily: 'var(--fn)', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >{addSaving ? '追加中...' : '追加する'}</button>
              <button
                onClick={() => { setShowAddStaff(false); setNewStaff(EMPTY_NEW_STAFF) }}
                style={{
                  padding: '10px 16px', borderRadius: 10,
                  border: '1px solid var(--bd)', background: 'transparent',
                  color: 'var(--mu)', fontFamily: 'var(--fn)', fontSize: 13,
                  cursor: 'pointer',
                }}
              >キャンセル</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="empty" style={{ padding: '20px 0' }}>読み込み中...</div>
        ) : staffEdits.map((s, idx) => (
          <div key={idx} className="staff-edit-card">
            <div className="staff-edit-header">
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg,${s.color_from},${s.color_to})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0, color: '#fff',
              }}>
                {s.name?.replace(/\s+/g, '')[0] || '?'}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, fontFamily: 'var(--mi)' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  className="set-val"
                  value={s.granted_hours}
                  min="0" max="200" step="4"
                  onChange={e => updateStaff(idx, 'granted_hours', parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>h / 年</span>
              </div>
            </div>
            <div className="staff-edit-grid">
              <div>
                <label>氏名</label>
                <input type="text" value={s.name}
                  onChange={e => updateStaff(idx, 'name', e.target.value)} />
              </div>
              <div>
                <label>役職・ステータス</label>
                <input type="text" value={s.role}
                  onChange={e => updateStaff(idx, 'role', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PIN管理 ── */}
      <div className="set-section">
        <div className="set-section-title">🔑 PIN管理</div>
        {loading ? (
          <div className="empty" style={{ padding: '20px 0' }}>読み込み中...</div>
        ) : staffEdits.map((s, idx) => (
          <div key={idx} className="set-row">
            <div className="pav" style={{
              background: `linear-gradient(135deg,${s.color_from},${s.color_to})`,
              width: 34, height: 34, fontSize: 12,
            }}>
              {s.name?.replace(/\s+/g, '')[0] || '?'}
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
              onChange={e => updateStaff(idx, 'pin', e.target.value.replace(/\D/g, ''))}
            />
            <div className="set-unit" style={{ fontSize: 9, color: 'var(--mu)' }}>PIN</div>
          </div>
        ))}
      </div>

      {/* ── 管理者PIN変更 ── */}
      <div className="set-section">
        <div className="set-section-title">🛡 管理者PIN変更</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label>現在のPIN</label>
            <input
              type="password"
              maxLength={4}
              placeholder="現在のPINを入力"
              value={curPin}
              onChange={e => setCurPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label>新しいPIN（4桁）</label>
            <input
              type="password"
              maxLength={4}
              placeholder="新しいPINを入力"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label>新しいPIN（確認）</label>
            <input
              type="password"
              maxLength={4}
              placeholder="もう一度入力"
              value={cfmPin}
              onChange={e => setCfmPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button
            onClick={handlePinChange}
            disabled={pinSaving || !curPin || !newPin || !cfmPin}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,var(--ac),var(--pu))',
              color: '#fff', fontFamily: 'var(--fn)', fontSize: 14,
              fontWeight: 700, cursor: 'pointer',
              opacity: (pinSaving || !curPin || !newPin || !cfmPin) ? 0.5 : 1,
            }}
          >{pinSaving ? '変更中...' : 'PINを変更する'}</button>
        </div>
      </div>

      <button className="btn-save" onClick={handleSave} disabled={saving || loading}>
        {saving ? '保存中...' : '保存する'}
      </button>
      <div style={{ height: 24 }} />
    </div>
  )
}
