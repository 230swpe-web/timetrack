/**
 * Supabase 初期データ投入スクリプト
 * 実行: node scripts/seed.mjs
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
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
  console.error('❌ 接続エラー:', pingErr.message)
  process.exit(1)
}
console.log('✅ Supabase 接続成功')

// ── スタッフ（有給残高はインライン列） ──────────────
const STAFF = [
  { name: '田中 花子', short_name: '田', role: 'リーダー', pin: '1234', color_from: '#7c8ef7', color_to: '#b39dfa', leave_year: 40, leave_carry: 8,  leave_used: 6   },
  { name: '鈴木 一郎', short_name: '鈴', role: 'スタッフ', pin: '2345', color_from: '#2dd4a0', color_to: '#7c8ef7', leave_year: 40, leave_carry: 0,  leave_used: 4.5 },
  { name: '佐藤 美咲', short_name: '佐', role: 'パート',   pin: '3456', color_from: '#f7c85a', color_to: '#f47a8a', leave_year: 32, leave_carry: 16, leave_used: 2   },
  { name: '山田 太郎', short_name: '山', role: 'スタッフ', pin: '4567', color_from: '#f47a8a', color_to: '#f7c85a', leave_year: 40, leave_carry: 24, leave_used: 8   },
]

// 既存スタッフを確認してから投入
console.log('\n📋 スタッフを投入中...')
const { data: existing } = await supabase.from('staff').select('id, pin')
const existingPins = (existing || []).map(s => s.pin)

let totalStaff = 0
for (const s of STAFF) {
  if (existingPins.includes(s.pin)) {
    // PIN一致するレコードを更新
    const match = existing.find(e => e.pin === s.pin)
    const { error } = await supabase.from('staff').update(s).eq('id', match.id)
    if (error) { console.error(`❌ スタッフ更新エラー (${s.name}):`, error.message); process.exit(1) }
  } else {
    const { error } = await supabase.from('staff').insert(s)
    if (error) { console.error(`❌ スタッフ挿入エラー (${s.name}):`, error.message); process.exit(1) }
  }
  totalStaff++
}
console.log(`✅ スタッフ ${totalStaff} 名を投入/更新しました`)

// ── グローバル設定（key-value rows） ─────────────────
console.log('\n⚙️  グローバル設定を投入中...')
const settingsRows = [
  { key: 'unit_hours', value: '0.5' },
  { key: 'work_hours', value: '8' },
  { key: 'carry_max',  value: '40' },
]
for (const row of settingsRows) {
  const { error } = await supabase.from('settings').upsert(row, { onConflict: 'key' })
  if (error) console.error(`❌ 設定投入エラー (${row.key}):`, error.message)
}
console.log('✅ グローバル設定を投入しました')

console.log('\n🎉 初期データ投入完了！')
console.log('\nスタッフPIN:')
STAFF.forEach(s => console.log(`  ${s.name}: ${s.pin}`))
console.log('  管理者: 0000')
