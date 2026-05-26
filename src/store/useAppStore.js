import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  todayStr, getMondayOfWeek, getCurrentFiscalYear,
  toHM, p2, calcWorkMins, formatWorkMins,
} from '../utils/helpers'

const days = ['日', '月', '火', '水', '木', '金', '土']

// ── 実際のDBスキーマ ──────────────────────────────────
// staff: id, name, short_name, role, pin, color_from, color_to,
//        leave_year, leave_carry, leave_used, created_at
// leave_reports: id, staff_id, date, time_from, time_to, hours, note,
//                confirmed(bool: false=待ち, true=承認, null=差戻し), created_at
// settings: key(text), value(text)
// attendance_logs: id, staff_id, date, clock_in, clock_out,
//                  break_start, break_end, break_minutes, status, created_at, updated_at

function buildLogs(att) {
  const logs = []
  if (att.clock_in)    logs.push({ t: '出勤',  v: toHM(att.clock_in),    ic: '🟢' })
  if (att.break_start) logs.push({ t: '中抜け', v: toHM(att.break_start), ic: '🟠' })
  if (att.break_end) {
    const mins = att.break_minutes || 0
    logs.push({ t: '戻り', v: toHM(att.break_end), ic: '🔵', sub: `${mins}分の中抜け` })
  }
  if (att.clock_out)   logs.push({ t: '退勤',  v: toHM(att.clock_out),   ic: '🔴' })
  return logs
}

function parseSettings(rows) {
  const map = { unit: 0.5, workH: 8, carryMax: 40, adminPin: '0000' }
  if (!rows) return map
  rows.forEach(r => {
    if (r.key === 'unit_hours')  map.unit     = parseFloat(r.value) || 0.5
    if (r.key === 'work_hours')  map.workH    = parseFloat(r.value) || 8
    if (r.key === 'carry_max')   map.carryMax = parseFloat(r.value) || 40
    if (r.key === 'admin_pin')   map.adminPin = r.value || '0000'
  })
  return map
}

const useAppStore = create((set, get) => ({
  screen:            'login',
  currentUser:       null,
  attendance:        null,
  attStatus:         'idle',
  todayLogs:         [],
  weeklyRecords:     [],
  leaveRequests:     [],
  allStaff:          [],
  todayAttendance:   [],
  allLeaveRequests:  [],
  settings:          { unit: 0.5, workH: 8, carryMax: 40 },
  loading:           false,
  toast:             null,
  _staffChannel:     null,

  showToast: (msg, duration = 2500) => {
    set({ toast: msg })
    setTimeout(() => set({ toast: null }), duration)
  },

  // ── ログイン画面の初期データ取得（PIN候補表示用） ──────
  loadLoginData: async () => {
    const [staffRes, pinRes] = await Promise.all([
      supabase.from('staff').select('id, name, pin, color_from, color_to').order('created_at'),
      supabase.from('settings').select('value').eq('key', 'admin_pin').maybeSingle(),
    ])
    set(state => ({
      allStaff: staffRes.data || [],
      settings: { ...state.settings, adminPin: pinRes.data?.value || '0000' },
    }))
  },

  // ── ログイン ────────────────────────────────────────
  loginWithPin: async (pin) => {
    const { data: adminPinRow } = await supabase
      .from('settings').select('value').eq('key', 'admin_pin').maybeSingle()
    const adminPin = adminPinRow?.value || '0000'

    if (pin === adminPin) {
      await get().loadAdminData()
      set({ screen: 'admin', currentUser: null })
      return { success: true, isAdmin: true }
    }

    const { data, error } = await supabase
      .from('staff').select('*').eq('pin', pin).maybeSingle()

    if (error) {
      const msg = error.message || ''
      if (msg.includes('Invalid API key'))
        return { success: false, dbError: true, message: 'DB接続エラー: APIキーを確認してください' }
      if (msg.includes('relation') || error.code === 'PGRST205')
        return { success: false, dbError: true, message: 'DBテーブルが存在しません' }
      return { success: false }
    }
    if (!data) return { success: false }

    set({ currentUser: data })
    await get().loadUserData(data.id)
    set({ screen: 'staff' })
    get().subscribeToCurrentUser()
    return { success: true, isAdmin: false }
  },

  // ── リアルタイム購読（管理者が有給時間を変更したとき即時反映） ──
  subscribeToCurrentUser: () => {
    const { currentUser } = get()
    if (!currentUser?.id) return
    get().unsubscribeFromCurrentUser()
    const channel = supabase
      .channel(`staff-user-${currentUser.id}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'staff',
        filter: `id=eq.${currentUser.id}`,
      }, (payload) => {
        if (payload.new) {
          set(state => ({ currentUser: { ...state.currentUser, ...payload.new } }))
        }
      })
      .subscribe()
    set({ _staffChannel: channel })
  },

  unsubscribeFromCurrentUser: () => {
    const { _staffChannel } = get()
    if (_staffChannel) {
      supabase.removeChannel(_staffChannel)
      set({ _staffChannel: null })
    }
  },

  refreshCurrentUser: async () => {
    const { currentUser } = get()
    if (!currentUser?.id) return
    const { data } = await supabase.from('staff').select('*').eq('id', currentUser.id).single()
    if (data) set({ currentUser: data })
  },

  // ── スタッフデータ読み込み ──────────────────────────
  loadUserData: async (staffId) => {
    const today = todayStr()
    const monday = getMondayOfWeek()
    const mondayStr = `${monday.getFullYear()}-${p2(monday.getMonth()+1)}-${p2(monday.getDate())}`

    const [attRes, reqRes, weekAttRes, weekLvRes] = await Promise.all([
      supabase.from('attendance_logs').select('*').eq('staff_id', staffId).eq('date', today).maybeSingle(),
      supabase.from('leave_reports').select('*').eq('staff_id', staffId).order('date', { ascending: false }),
      supabase.from('attendance_logs').select('*').eq('staff_id', staffId).gte('date', mondayStr).lte('date', today).order('date'),
      supabase.from('leave_reports').select('*').eq('staff_id', staffId).gte('date', mondayStr).lte('date', today).eq('confirmed', true),
    ])

    const att       = attRes.data || null
    const attStatus = att ? att.status : 'idle'
    const todayLogs = att ? buildLogs(att) : []

    // 週間レコード
    const weekAttMap = {}
    ;(weekAttRes.data || []).forEach(r => { weekAttMap[r.date] = r })
    const weekLvMap = {}
    ;(weekLvRes.data || []).forEach(r => { weekLvMap[r.date] = r })

    const weeklyRecords = []
    const cur = new Date(monday)
    const todayDate = new Date(); todayDate.setHours(0,0,0,0)
    while (cur <= todayDate) {
      const ds    = `${cur.getFullYear()}-${p2(cur.getMonth()+1)}-${p2(cur.getDate())}`
      const label = `${p2(cur.getMonth()+1)}/${p2(cur.getDate())}（${days[cur.getDay()]}）`
      const isToday = ds === today
      const wAtt  = weekAttMap[ds]
      const wLv   = weekLvMap[ds]
      let value = '---', status = 'none'

      if (isToday) {
        status = 'today'
        if (wAtt?.clock_out) value = formatWorkMins(calcWorkMins(wAtt))
      } else if (wLv && !wAtt) {
        status = 'leave'; value = `${wLv.hours}時間`
      } else if (wAtt) {
        status = wLv ? 'leave' : (wAtt.break_minutes||0) > 0 ? 'break' : 'normal'
        if (wAtt.clock_out) value = formatWorkMins(calcWorkMins(wAtt))
      }
      weeklyRecords.push({ day: label, value, status })
      cur.setDate(cur.getDate() + 1)
    }

    set({ attendance: att, attStatus, todayLogs, weeklyRecords, leaveRequests: reqRes.data || [] })
  },

  // ── 打刻 ────────────────────────────────────────────
  clockIn: async () => {
    const { currentUser, attendance } = get()
    const now = new Date()
    const hm  = `${p2(now.getHours())}:${p2(now.getMinutes())}`
    let result
    if (attendance) {
      const { data } = await supabase.from('attendance_logs')
        .update({ clock_in: now.toISOString(), status: 'working', updated_at: now.toISOString() })
        .eq('id', attendance.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('attendance_logs')
        .insert({ staff_id: currentUser.id, date: todayStr(), clock_in: now.toISOString(), status: 'working' })
        .select().single()
      result = data
    }
    set({ attendance: result, attStatus: 'working', todayLogs: [{ t: '出勤', v: hm, ic: '🟢' }] })
  },

  breakStart: async () => {
    const { attendance, todayLogs } = get()
    if (!attendance) return
    const now = new Date()
    const hm  = `${p2(now.getHours())}:${p2(now.getMinutes())}`
    const { data } = await supabase.from('attendance_logs')
      .update({ break_start: now.toISOString(), status: 'on_break', updated_at: now.toISOString() })
      .eq('id', attendance.id).select().single()
    set({ attendance: data, attStatus: 'on_break', todayLogs: [...todayLogs, { t: '中抜け', v: hm, ic: '🟠' }] })
  },

  breakEnd: async () => {
    const { attendance, todayLogs } = get()
    if (!attendance?.break_start) return
    const now  = new Date()
    const hm   = `${p2(now.getHours())}:${p2(now.getMinutes())}`
    const mins = Math.floor((now - new Date(attendance.break_start)) / 60000)
    const totalMins = (attendance.break_minutes || 0) + mins
    const { data } = await supabase.from('attendance_logs')
      .update({ break_end: now.toISOString(), break_minutes: totalMins, status: 'back', updated_at: now.toISOString() })
      .eq('id', attendance.id).select().single()
    set({ attendance: data, attStatus: 'back', todayLogs: [...todayLogs, { t: '戻り', v: hm, ic: '🔵', sub: `${mins}分の中抜け` }] })
  },

  clockOut: async () => {
    const { attendance, todayLogs } = get()
    if (!attendance) return
    const now = new Date()
    const hm  = `${p2(now.getHours())}:${p2(now.getMinutes())}`
    const { data } = await supabase.from('attendance_logs')
      .update({ clock_out: now.toISOString(), status: 'done', updated_at: now.toISOString() })
      .eq('id', attendance.id).select().single()
    set({ attendance: data, attStatus: 'done', todayLogs: [...todayLogs, { t: '退勤', v: hm, ic: '🔴' }] })
  },

  // ── 有給申請 ─────────────────────────────────────────
  submitLeaveRequest: async ({ date, startTime, endTime, hours, note }) => {
    const { currentUser } = get()
    const { data, error } = await supabase.from('leave_reports')
      .insert({
        staff_id:  currentUser.id,
        date,
        time_from: startTime,
        time_to:   endTime,
        hours,
        note,
        confirmed: false,
      })
      .select().single()
    if (error) throw error
    set(state => ({ leaveRequests: [data, ...state.leaveRequests] }))
    return data
  },

  // ── エクスポート用データ取得（25日締め期間） ──────────
  loadExportData: async (year, month) => {
    const startYear  = month === 1 ? year - 1 : year
    const startMonth = month === 1 ? 12 : month - 1
    const start      = `${startYear}-${p2(startMonth)}-26`
    const end        = `${year}-${p2(month)}-25`
    const [attRes, lvRes] = await Promise.all([
      supabase.from('attendance_logs')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('staff_id'),
      supabase.from('leave_reports')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date'),
    ])
    return {
      attendance:   attRes.data || [],
      leaveReports: lvRes.data  || [],
    }
  },

  // ── 管理者データ ─────────────────────────────────────
  loadAdminData: async () => {
    const today = todayStr()
    const [staffRes, attRes, lvRes, settingsRes] = await Promise.all([
      supabase.from('staff').select('*').order('created_at'),
      supabase.from('attendance_logs').select('*').eq('date', today),
      supabase.from('leave_reports')
        .select('*, staff:staff_id(name, short_name, color_from, color_to, role)')
        .order('created_at', { ascending: false }),
      supabase.from('settings').select('*'),
    ])
    set({
      allStaff:         staffRes.data  || [],
      todayAttendance:  attRes.data    || [],
      allLeaveRequests: lvRes.data     || [],
      settings:         parseSettings(settingsRes.data),
    })
  },

  // confirmed=true → 承認、null → 差戻し、false → 待ち
  approveLeave: async (requestId) => {
    const { allLeaveRequests } = get()
    const req = allLeaveRequests.find(r => r.id === requestId)
    if (!req) return
    await supabase.from('leave_reports').update({ confirmed: true }).eq('id', requestId)
    // leave_used を加算
    await supabase.from('staff')
      .update({ leave_used: supabase.rpc ? undefined : undefined }) // supabase RPC使えないので別途取得
      .eq('id', req.staff_id)
    // 現在の leave_used を取得して加算
    const { data: staffData } = await supabase.from('staff').select('leave_used').eq('id', req.staff_id).single()
    if (staffData) {
      await supabase.from('staff').update({ leave_used: (staffData.leave_used || 0) + req.hours }).eq('id', req.staff_id)
    }
    set(state => ({
      allLeaveRequests: state.allLeaveRequests.map(r =>
        r.id === requestId ? { ...r, confirmed: true } : r
      ),
      allStaff: state.allStaff.map(s =>
        s.id === req.staff_id ? { ...s, leave_used: (s.leave_used || 0) + req.hours } : s
      ),
    }))
  },

  rejectLeave: async (requestId) => {
    await supabase.from('leave_reports').update({ confirmed: null }).eq('id', requestId)
    set(state => ({
      allLeaveRequests: state.allLeaveRequests.map(r =>
        r.id === requestId ? { ...r, confirmed: null } : r
      ),
    }))
  },

  // ── 設定 ────────────────────────────────────────────
  saveGlobalSettings: async (newSettings) => {
    const rows = [
      { key: 'unit_hours', value: String(newSettings.unit) },
      { key: 'work_hours', value: String(newSettings.workH) },
      { key: 'carry_max',  value: String(newSettings.carryMax) },
    ]
    for (const row of rows) {
      await supabase.from('settings').upsert(row, { onConflict: 'key' })
    }
    set({ settings: newSettings })
  },

  saveStaffSettings: async (updates) => {
    for (const upd of updates) {
      if (!upd.id) continue
      await supabase.from('staff').update({
        name:       upd.name,
        short_name: upd.name.replace(/\s+/g, '')[0] || upd.short_name || '?',
        role:       upd.role,
        pin:        upd.pin,
        leave_year: upd.granted_hours,
      }).eq('id', upd.id)
    }
    await get().loadAdminData()
  },

  // ── 使用済み時間の手動更新 ───────────────────────────
  updateLeaveUsed: async (staffId, hours) => {
    await supabase.from('staff').update({ leave_used: hours }).eq('id', staffId)
    set(state => ({
      allStaff: state.allStaff.map(s =>
        s.id === staffId ? { ...s, leave_used: hours } : s
      ),
    }))
  },

  // ── 繰越時間の手動更新 ───────────────────────────────
  updateLeaveCarry: async (staffId, hours) => {
    await supabase.from('staff').update({ leave_carry: hours }).eq('id', staffId)
    set(state => ({
      allStaff: state.allStaff.map(s =>
        s.id === staffId ? { ...s, leave_carry: hours } : s
      ),
    }))
  },

  // ── 毎年5月25日の有給使用済み自動リセット ──────────────
  checkAndResetLeaveUsed: async () => {
    const today = new Date()
    const year  = today.getFullYear()
    const resetThisYear = new Date(year, 4, 25) // 5月25日（月は0始まり）

    if (today < resetThisYear) return // まだリセット日を過ぎていない

    // 前回リセット日をDBから取得
    const { data: row } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'leave_reset_date')
      .maybeSingle()

    if (row?.value) {
      const lastReset = new Date(row.value)
      if (lastReset >= resetThisYear) return // 今年度はリセット済み
    }

    // leave_used を全スタッフ 0 にリセット（leave_reports は保持）
    await supabase.from('staff')
      .update({ leave_used: 0 })
      .gte('created_at', '2000-01-01')

    // リセット日を記録（二重リセット防止）
    const resetDateStr = `${year}-05-25`
    await supabase.from('settings')
      .upsert({ key: 'leave_reset_date', value: resetDateStr }, { onConflict: 'key' })

    // ストア内の allStaff も即時反映
    set(state => ({
      allStaff: state.allStaff.map(s => ({ ...s, leave_used: 0 })),
    }))
  },

  changeAdminPin: async (currentPin, newPin) => {
    const { settings } = get()
    const storedPin = settings.adminPin || '0000'
    if (currentPin !== storedPin) throw new Error('現在のPINが正しくありません')
    await supabase.from('settings').upsert({ key: 'admin_pin', value: newPin }, { onConflict: 'key' })
    set(state => ({ settings: { ...state.settings, adminPin: newPin } }))
  },

  addStaff: async ({ name, role, pin, grantedHours }) => {
    const short_name = name.replace(/\s+/g, '')[0] || '?'
    const palette = [
      { color_from: '#7c8ef7', color_to: '#b39dfa' },
      { color_from: '#2dd4a0', color_to: '#7c8ef7' },
      { color_from: '#f7c85a', color_to: '#f47a8a' },
      { color_from: '#f47a8a', color_to: '#f7c85a' },
      { color_from: '#fb9c5a', color_to: '#b39dfa' },
      { color_from: '#b39dfa', color_to: '#2dd4a0' },
    ]
    const { allStaff } = get()
    const { color_from, color_to } = palette[allStaff.length % palette.length]
    const { data, error } = await supabase.from('staff').insert({
      name, short_name, role, pin, color_from, color_to,
      leave_year: grantedHours ?? 80, leave_carry: 0, leave_used: 0,
    }).select().single()
    if (error) throw error
    await get().loadAdminData()
    return data
  },

  logout: () => {
    get().unsubscribeFromCurrentUser()
    set({
      screen:        'login',
      currentUser:   null,
      attendance:    null,
      attStatus:     'idle',
      todayLogs:     [],
      weeklyRecords: [],
      leaveRequests: [],
    })
  },
}))

export default useAppStore
