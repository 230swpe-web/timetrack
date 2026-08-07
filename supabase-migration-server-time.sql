-- ────────────────────────────────────────────────────────────────
-- 打刻時刻ズレ修正: サーバー時刻を返す RPC 関数
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ────────────────────────────────────────────────────────────────
-- 背景: 打刻時刻を端末(タブレット等)の時計から取得していたため、
--       端末の時計が狂っていると記録もズレていた。
--       この関数でSupabaseサーバーの正確な時刻(NTP同期済み)を返す。

CREATE OR REPLACE FUNCTION server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- アプリ(anonキー)から呼び出せるように権限を付与
GRANT EXECUTE ON FUNCTION server_now() TO anon;
GRANT EXECUTE ON FUNCTION server_now() TO authenticated;
