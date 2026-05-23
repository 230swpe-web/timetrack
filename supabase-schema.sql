-- TimeTrack Supabase Schema
-- Run this in the Supabase SQL Editor

-- ── TABLES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'スタッフ',
  pin TEXT NOT NULL,
  gradient_from TEXT NOT NULL DEFAULT '#7c8ef7',
  gradient_to TEXT NOT NULL DEFAULT '#b39dfa',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  granted_hours NUMERIC NOT NULL DEFAULT 40,
  carry_over_hours NUMERIC NOT NULL DEFAULT 0,
  used_hours NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  break_minutes INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hours NUMERIC NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_staff" ON staff FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_balance" ON leave_balance FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_attendance" ON attendance_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_leaves" ON leave_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settings" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── INITIAL DATA ─────────────────────────────────────

INSERT INTO staff (name, short_name, role, pin, gradient_from, gradient_to, display_order) VALUES
  ('田中 花子', '田', 'リーダー',  '1234', '#7c8ef7', '#b39dfa', 1),
  ('鈴木 一郎', '鈴', 'スタッフ',  '2345', '#2dd4a0', '#7c8ef7', 2),
  ('佐藤 美咲', '佐', 'パート',    '3456', '#f7c85a', '#f47a8a', 3),
  ('山田 太郎', '山', 'スタッフ',  '4567', '#f47a8a', '#f7c85a', 4)
ON CONFLICT DO NOTHING;

-- Leave balances (current fiscal year 2025)
INSERT INTO leave_balance (staff_id, fiscal_year, granted_hours, carry_over_hours, used_hours)
SELECT id, 2025, 40, 8,  6   FROM staff WHERE pin = '1234' ON CONFLICT DO NOTHING;
INSERT INTO leave_balance (staff_id, fiscal_year, granted_hours, carry_over_hours, used_hours)
SELECT id, 2025, 40, 0,  4.5 FROM staff WHERE pin = '2345' ON CONFLICT DO NOTHING;
INSERT INTO leave_balance (staff_id, fiscal_year, granted_hours, carry_over_hours, used_hours)
SELECT id, 2025, 32, 16, 2   FROM staff WHERE pin = '3456' ON CONFLICT DO NOTHING;
INSERT INTO leave_balance (staff_id, fiscal_year, granted_hours, carry_over_hours, used_hours)
SELECT id, 2025, 40, 24, 8   FROM staff WHERE pin = '4567' ON CONFLICT DO NOTHING;

-- Default global settings
INSERT INTO app_settings (key, value) VALUES
  ('global_settings', '{"unit": 0.5, "workH": 8, "carryMax": 40}')
ON CONFLICT (key) DO NOTHING;
