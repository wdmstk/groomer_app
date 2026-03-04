-- ==============================
-- 初期管理者登録用SQL
-- ==============================
-- 前提:
-- 1) Supabase Authに対象ユーザーを作成済み
-- 2) そのユーザーのUUIDを取得済み

-- 使い方:
-- 下記の <<USER_ID>> と <<FULL_NAME>> と <<EMAIL>> を置き換えて実行

INSERT INTO staffs (user_id, full_name, email, role)
VALUES (
  '<<USER_ID>>',
  '和田 将威
  '',
  'admin'
)
ON CONFLICT (user_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = 'admin';