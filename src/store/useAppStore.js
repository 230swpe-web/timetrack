import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  todayStr, getMondayOfWeek, getCurrentFiscalYear,
  formatJpDate, toHM, p2, calcWorkMins, formatWorkMins,
} from '../utils/helpers'

const days = ['日', '月', '火', '水', '木', '金', '土']

function buildLogs(att) {
  const logs = []
  if (att.clock_in) logs.push({ t: '出勤', v: toHM(att.clock_in), ic: '🟢' })
  if (att.break_start) logs.push({ t: '中抜け', v: toHM(att.break_start), ic: '🟠' })
  if (att.break_end) {
    const mins = att.break_minutes || 0
    logs.push({ t: '戻り', v: toHM(att.break_end), ic: '🔵', sub: `${mins}分の中抜け` })
  }
  if (att.clock_out) logs.push({ t: '退勤', v: toHM(att.clock_out), ic: '🔴' })
  return logs
}

const useAppStore = create((set, get) => ({
  screen: 'login',
  currentUser: null,
  attendance: null,
  attStatus: 'idle',
  todayLogs: [],
  weeklyRecords: [],
  leaveBalance: null,
  leaveRequests: [],
  allStaff: [],
  todayAttendance: [],
  allLeaveRequests: [],
  allLeaveBalances: {},
  settings: { unit: 0.5, workH: 8, carryMax: 40 },
  loading: false,
  toast: null,

  showToast: (msg, duration = 2500) => {
    set({ toast: msg })
    setTimeout(() => set({ toast: null }), duration)
  },

  setScreen: (screen) => set({ screen }),

  loginWithPin: async (pin) => {
    if (pin === '0000') {
      await get().loadAdminData()
      set({ screen: 'admin', currentUser: null })
      return { success: true, isAdmin: true }
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('pin', pin)
      .maybeSingle()

    if (error) {
      const msg = error.message || ''
      if (msg.includes('Invalid API key') || msg.includes('relation') || error.code === 'PGRST301') {
        return { success: false, dbError: true, message: 'DB接続エラー: Supabase設定を確認してください' }
      }
      return { success: false }
    }
    if (!data) return { success: false }

    set({ currentUser: data })
    await get().loadUserData(data.id)
    set({ screen: 'staff' })
    return { success: true, isAdmin: false }
  },

  loadUserData: async (staffId) => {
    const today = todayStr()
    const fiscalYear = getCurrentFiscalYear()
    const monday = getMondayOfWeek()
    const mondayStr = `${monday.getFullYear()}-${p2(monday.getMonth() + 1)}-${p2(monday.getDate())}`

    const [attRes, balRes, reqRes, weekRes, wlvRes] = await Promise.all([
      supabase.from('attendance_logs').select('*').eq('staff_id', staffId).eq('date', today).maybeSingle(),
      supabase.from('leave_balance').select('*').eq('staff_id', staffId).eq('fiscal_year', fiscalYear).maybeSingle(),
      supabase.from('leave_requests').select('*').eq('staff_id', staffId).order('date', { ascending: false }),
      supabase.from('attendance_logs').select('*').eq('staff_id', staffId).gte('date', mondayStr).lte('date', today).order('date', { ascending: true }),
      supabase.from('leave_requests').select('*').eq('staff_id', staffId).gte('date', mondayStr).lte('date', today).eq('status', 'approved'),
    ])

    const att = attRes.data || null
    const attStatus = att ? att.status : 'idle'
    const todayLogs = att ? buildLogs(att) : []

    const weeklyAttMap = {}
    ;(weekRes.data || []).forEach(r => { weeklyAttMap[r.date] = r })
    const weeklyLvMap = {}
    ;(wlvRes.data || []).forEach(r => { weeklyLvMap[r.date] = r })

    const weeklyRecords = []
    const cur = new Date(monday)
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    while (cur <= todayDate) {
      const ds = `${cur.getFullYear()}-${p2(cur.getMonth() + 1)}-${p2(cur.getDate())}`
      const label = `${p2(cur.getMonth() + 1)}/${p2(cur.getDate())}（${days[cur.getDay()]}）`
      const isToday = ds === today
      const wAtt = weeklyAttMap[ds]
      const wLv = weeklyLvMap[ds]
      let value = '---'
      let status = 'none'
      if (isToday) {
        status = 'today'
        if (wAtt?.clock_out) {
          const mins = calcWorkMins(wAtt)
          value = formatWorkMins(mins)
        }
      } else if (wLv && !wAtt) {
        status = 'leave'
        value = `${wLv.hours}時間`
      } else if (wAtt) {
        if (wLv) status = 'leave'
        else if ((wAtt.break_minutes || 0) > 0) status = 'break'
        else status = 'normal'
        if (wAtt.clock_out) {
          const mins = calcWorkMins(wAtt)
          value = formatWorkMins(mins)
        }
      }
      weeklyRecords.push({ day: label, value, status })
      cur.setDate(cur.getDate() + 1)
    }

    set({
      attendance: att,
      attStatus,
      todayLogs,
      weeklyRecords,
      leaveBalance: balRes.data || { granted_hours: 40, carry_over_hours: 0, used_hours: 0 },
      leaveRequests: reqRes.data || [],
    })
  },

  clockIn: async () => {
    const { currentUser, attendance } = get()
    const now = new Date()
    const today = todayStr()
    const hm = `${p2(now.getHours())}:${p2(now.getMinutes())}`

    let result
    if (attendance) {
      const { data } = await supabase.from('attendance_logs')
        .update({ clock_in: now.toISOString(), status: 'working', updated_at: now.toISOString() })
        .eq('id', attendance.id).select().single()
      result = data
    } else {
      const { data } = await supabase.from('attendance_logs')
        .insert({ staff_id: currentUser.id, date: today, clock_in: now.toISOString(), status: 'working' })
        .select().single()
      result = data
    }

    set({ attendance: result, attStatus: 'working', todayLogs: [{ t: '出勤', v: hm, ic: '🟢' }] })
  },

  breakStart: async () => {
    const { attendance, todayLogs } = get()
    if (!attendance) return
    const now = new Date()
    const hm = `${p2(now.getHours())}:${p2(now.getMinutes())}`

    const { data } = await supabase.from('attendance_logs')
      .update({ break_start: now.toISOString(), status: 'on_break', updated_at: now.toISOString() })
      .eq('id', attendance.id).select().single()

    set({ attendance: data, attStatus: 'on_break', todayLogs: [...todayLogs, { t: '中抜け', v: hm, ic: '🟠' }] })
  },

  breakEnd: async () => {
    const { attendance, todayLogs } = get()
    if (!attendance?.break_start) return
    const now = new Date()
    const hm = `${p2(now.getHours())}:${p2(now.getMinutes())}`
    const breakStart = new Date(attendance.break_start)
    const mins = Math.floor((now - breakStart) / 60000)
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
    const hm = `${p2(now.getHours())}:${p2(now.getMinutes())}`

    const { data } = await supabase.from('attendance_logs')
      .update({ clock_out: now.toISOString(), status: 'done', updated_at: now.toISOString() })
      .eq('id', attendance.id).select().single()

    set({ attendance: data, attStatus: 'done', todayLogs: [...todayLogs, { t: '退勤', v: hm, ic: '🔴' }] })
  },

  submitLeaveRequest: async ({ date, startTime, endTime, hours, note }) => {
    const { currentUser } = get()
    const { data, error } = await supabase.from('leave_requests')
      .insert({ staff_id: currentUser.id, date, start_time: startTime, end_time: endTime, hours, note, status: 'pending' })
      .select().single()

    if (error) throw error

    set(state => ({ leaveRequests: [data, ...state.leaveRequests] }))
    return data
  },

  loadAdminData: async () => {
    const today = todayStr()
    const fiscalYear = getCurrentFiscalYear()

    const [staffRes, attRes, lvRes, balRes, settingsRes] = await Promise.all([
      supabase.from('staff').select('*').order('display_order'),
      supabase.from('attendance_logs').select('*').eq('date', today),
      supabase.from('leave_requests').select('*, staff:staff_id(name, short_name, gradient_from, gradient_to, role)').order('created_at', { ascending: false }),
      supabase.from('leave_balance').select('*').eq('fiscal_year', fiscalYear),
      supabase.from('app_settings').select('*').eq('key', 'global_settings').maybeSingle(),
    ])

    const balMap = {}
    ;(balRes.data || []).forEach(b => { balMap[b.staff_id] = b })

    if (settingsRes.data?.value) {
      set({ settings: settingsRes.data.value })
    }

    set({
      allStaff: staffRes.data || [],
      todayAttendance: attRes.data || [],
      allLeaveRequests: lvRes.data || [],
      allLeaveBalances: balMap,
    })
  },

  approveLeave: async (requestId) => {
    const { allLeaveRequests, allLeaveBalances } = get()
    const req = allLeaveRequests.find(r => r.id === requestId)
    if (!req) return

    await supabase.from('leave_requests')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', requestId)

    const fiscalYear = getCurrentFiscalYear()
    const bal = allLeaveBalances[req.staff_id]
    if (bal) {
      const newUsed = (bal.used_hours || 0) + req.hours
      await supabase.from('leave_balance')
        .update({ used_hours: newUsed, updated_at: new Date().toISOString() })
        .eq('id', bal.id)

      set(state => ({
        allLeaveBalances: { ...state.allLeaveBalances, [req.staff_id]: { ...bal, used_hours: newUsed } },
      }))
    } else {
      await supabase.from('leave_balance')
        .insert({ staff_id: req.staff_id, fiscal_year: fiscalYear, granted_hours: 40, carry_over_hours: 0, used_hours: req.hours })
    }

    set(state => ({
      allLeaveRequests: state.allLeaveRequests.map(r => r.id === requestId ? { ...r, status: 'approved' } : r),
    }))
  },

  rejectLeave: async (requestId) => {
    await supabase.from('leave_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', requestId)

    set(state => ({
      allLeaveRequests: state.allLeaveRequests.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r),
    }))
  },

  saveGlobalSettings: async (newSettings) => {
    await supabase.from('app_settings')
      .upsert({ key: 'global_settings', value: newSettings, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    set({ settings: newSettings })
  },

  saveStaffSettings: async (updates) => {
    const { allStaff, allLeaveBalances } = get()
    const fiscalYear = getCurrentFiscalYear()

    for (const upd of updates) {
      await supabase.from('staff').update({
        name: upd.name,
        role: upd.role,
        pin: upd.pin,
      }).eq('id', upd.id)

      const bal = allLeaveBalances[upd.id]
      if (bal) {
        await supabase.from('leave_balance')
          .update({ granted_hours: upd.granted_hours, updated_at: new Date().toISOString() })
          .eq('id', bal.id)
      } else {
        await supabase.from('leave_balance')
          .insert({ staff_id: upd.id, fiscal_year: fiscalYear, granted_hours: upd.granted_hours, carry_over_hours: 0, used_hours: 0 })
      }
    }

    await get().loadAdminData()
  },

  logout: () => {
    set({
      screen: 'login',
      currentUser: null,
      attendance: null,
      attStatus: 'idle',
      todayLogs: [],
      weeklyRecords: [],
      leaveBalance: null,
      leaveRequests: [],
    })
  },
}))

export default useAppStore
