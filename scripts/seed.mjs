/**
 * Supabase 初期データ投入スクリプト
 * 実行: node scripts/seed.mjs
 *
 * 事前に supabase-schema.sql を Supabase SQL Editor で実行してください。
 * .env の VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が正しく設定されている必要があります。
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// .env を手動パース（dotenv なしで動く）
const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ .env に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません')
  process.exit(1)
}

console.log(`🔗 接続先: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── 接続テスト ───────────────────────────────────────
const { error: pingErr } = await supabase.from('staff').select('id').limit(1)
if (pingErr) {
  if (pingErr.message?.includes('Invalid API key')) {
    console.error('❌ API キーが無効です。Supabase ダッシュボードで確認してください:')
    console.error(`   https://supabase.com/dashboard/project/${SUPABASE_URL.split('//')[1].split('.')[0]}/settings/api`)
  } else if (pingErr.message?.includes('relation') || pingErr.code === '42P01') {
    console.error('❌ テーブルが存在しません。先に supabase-schema.sql を SQL Editor で実行してください。')
  } else {
    console.error('❌ 接続エラー:', pingErr.message)
  }
  process.exit(1)
}
console.log('✅ Supabase 接続成功')

// ── スタッフ ─────────────────────────────────────────
const STAFF = [
  { name: '田中 花子', short_name: '田', role: 'リーダー', pin: '1234', gradient_from: '#7c8ef7', gradient_to: '#b39dfa', display_order: 1 },
  { name: '鈴木 一郎', short_name: '鈴', role: 'スタッフ', pin: '2345', gradient_from: '#2dd4a0', gradient_to: '#7c8ef7', display_order: 2 },
  { name: '佐藤 美咲', short_name: '佐', role: 'パート',   pin: '3456', gradient_from: '#f7c85a', gradient_to: '#f47a8a', display_order: 3 },
  { name: '山田 太郎', short_name: '山', role: 'スタッフ', pin: '4567', gradient_from: '#f47a8a', gradient_to: '#f7c85a', display_order: 4 },
]

console.log('\n📋 スタッフを投入中...')
const { data: insertedStaff, error: staffErr } = await supabase
  .from('staff')
  .upsert(STAFF, { onConflict: 'pin', ignoreDuplicates: false })
  .select()

if (staffErr) { console.error('❌ スタッフ投入エラー:', staffErr.message); process.exit(1) }
console.log(`✅ スタッフ ${insertedStaff.length} 名を投入/更新しました`)

// ── 有給残高 ──────────────────────────────────────────
const FISCAL_YEAR = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
const BALANCES = [
  { pin: '1234', granted_hours: 40, carry_over_hours: 8,  used_hours: 6   },
  { pin: '2345', granted_hours: 40, carry_over_hours: 0,  used_hours: 4.5 },
  { pin: '3456', granted_hours: 32, carry_over_hours: 16, used_hours: 2   },
  { pin: '4567', granted_hours: 40, carry_over_hours: 24, used_hours: 8   },
]

const staffMap = Object.fromEntries(insertedStaff.map(s => [s.pin, s.id]))
const balanceRows = BALANCES.map(b => ({
  staff_id: staffMap[b.pin],
  fiscal_year: FISCAL_YEAR,
  granted_hours: b.granted_hours,
  carry_over_hours: b.carry_over_hours,
  used_hours: b.used_hours,
})).filter(b => b.staff_id)

console.log('\n📊 有給残高を投入中...')
const { data: insertedBal, error: balErr } = await supabase
  .from('leave_balance')
  .upsert(balanceRows, { onConflict: 'staff_id,fiscal_year', ignoreDuplicates: false })
  .select()

if (balErr) { console.error('❌ 有給残高投入エラー:', balErr.message); process.exit(1) }
console.log(`✅ 有給残高 ${insertedBal.length} 件を投入/更新しました`)

// ── グローバル設定 ────────────────────────────────────
console.log('\n⚙️  グローバル設定を投入中...')
const { error: settingsErr } = await supabase
  .from('app_settings')
  .upsert({ key: 'global_settings', value: { unit: 0.5, workH: 8, carryMax: 40 } }, { onConflict: 'key' })

if (settingsErr) { console.error('❌ 設定投入エラー:', settingsErr.message) }
else console.log('✅ グローバル設定を投入しました')

console.log('\n🎉 初期データ投入完了！')
console.log('\nスタッフPIN:')
STAFF.forEach(s => console.log(`  ${s.name}: ${s.pin}`))
console.log('  管理者: 0000')
