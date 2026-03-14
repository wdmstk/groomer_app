-- ==============================
-- Groomer App 推奨アクセス制御 (RLS + role)
-- ==============================

-- 1) スキーマ変更: staffsにuser_id/roleを追加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staffs' AND column_name = 'user_id') THEN
        ALTER TABLE staffs ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staffs' AND column_name = 'role') THEN
        ALTER TABLE staffs ADD COLUMN role text NOT NULL DEFAULT 'staff';
    END IF;
END $$;

-- roleのチェック制約（すでにある場合はスキップ）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'staffs_role_check') THEN
        ALTER TABLE staffs ADD CONSTRAINT staffs_role_check CHECK (role IN ('admin', 'staff'));
    END IF;
END $$;

-- user_idを一意に（1ユーザー=1スタッフ）
CREATE UNIQUE INDEX IF NOT EXISTS staffs_user_id_unique ON staffs(user_id);

-- 2) RLS有効化
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- 3) 共通関数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- セキュリティ定義者権限で実行して無限ループを回避
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM staffs
    WHERE staffs.user_id = auth.uid()
      AND staffs.role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- セキュリティ定義者権限で実行
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM staffs
    WHERE staffs.user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- 4) staffs: 管理者は全操作、非管理者は自分自身のみ操作可能
-- 注意: INSERTを許可するため、auth.uid() IS NOT NULL を条件に含める
CREATE POLICY staffs_admin_all ON staffs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY staffs_individual_all ON staffs
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id OR user_id IS NULL) 
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 5) customers: 管理者・スタッフ共に全操作可能（開発・運用利便性のため緩和）
CREATE POLICY customers_authenticated_all ON customers
  FOR ALL TO authenticated 
  USING (auth.uid() IS NOT NULL) 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6) pets: 管理者は全件、スタッフは全件参照可能
CREATE POLICY pets_admin_all ON pets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY pets_staff_all ON pets
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7) appointments: 管理者は全件、担当スタッフのみCRUD
CREATE POLICY appointments_admin_all ON appointments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY appointments_staff_all ON appointments
  FOR ALL USING (appointments.staff_id = public.current_staff_id())
  WITH CHECK (appointments.staff_id = public.current_staff_id());

-- 8) visits: 管理者は全件、担当スタッフのみCRUD
CREATE POLICY visits_admin_all ON visits
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY visits_staff_all ON visits
  FOR ALL USING (visits.staff_id = public.current_staff_id())
  WITH CHECK (visits.staff_id = public.current_staff_id());

-- 9) medical_records: 管理者は全件、担当スタッフのみCRUD
CREATE POLICY medical_records_admin_all ON medical_records
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY medical_records_staff_all ON medical_records
  FOR ALL USING (medical_records.staff_id = public.current_staff_id())
  WITH CHECK (medical_records.staff_id = public.current_staff_id());

-- 10) 既存のポリシーをクリアして再適用するためのクリーンアップSQL
-- SQL Editor で実行する際は、まずこれらを実行して競合を回避してください。
/*
DROP POLICY IF EXISTS staffs_admin_select ON staffs;
DROP POLICY IF EXISTS staffs_admin_insert ON staffs;
DROP POLICY IF EXISTS staffs_admin_update ON staffs;
DROP POLICY IF EXISTS staffs_admin_delete ON staffs;
DROP POLICY IF EXISTS staffs_all_admin ON staffs;
DROP POLICY IF EXISTS staffs_select_self ON staffs;
DROP POLICY IF EXISTS staffs_self_service ON staffs;
DROP POLICY IF EXISTS staffs_admin_all ON staffs;
DROP POLICY IF EXISTS staffs_individual_all ON staffs;

DROP POLICY IF EXISTS customers_admin_all ON customers;
DROP POLICY IF EXISTS customers_staff_all ON customers;
DROP POLICY IF EXISTS customers_all_admin ON customers;
DROP POLICY IF EXISTS customers_all_staff ON customers;
DROP POLICY IF EXISTS customers_authenticated_all ON customers;

DROP POLICY IF EXISTS pets_admin_all ON pets;
DROP POLICY IF EXISTS pets_staff_all ON pets;

DROP POLICY IF EXISTS appointments_admin_all ON appointments;
DROP POLICY IF EXISTS appointments_staff_all ON appointments;

DROP POLICY IF EXISTS visits_admin_all ON visits;
DROP POLICY IF EXISTS visits_staff_all ON visits;

DROP POLICY IF EXISTS medical_records_admin_all ON medical_records;
DROP POLICY IF EXISTS medical_records_staff_all ON medical_records;
*/
