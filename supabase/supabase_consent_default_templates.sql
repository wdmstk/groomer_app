-- =========================================================
-- Groomer App: Electronic Consent Default Template Auto Seed
-- Task: TASK-423
-- =========================================================
-- Purpose:
-- 1) Backfill standard consent template for existing stores
-- 2) Auto-seed the same template when a new store is created
-- =========================================================

begin;

create extension if not exists pgcrypto;

create or replace function public.seed_default_consent_template_for_store(target_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  template_name constant text := '施術同意書（標準）';
  template_title constant text := '施術同意書（標準版）';
  body_html_value constant text := $html$
<h1>施術同意書</h1>
<p>私は、{{store_name}}（以下「店舗」）に対して、以下の内容を確認・同意のうえ施術を依頼します。</p>
<h2>1. 施術内容と体調申告</h2>
<ul>
  <li>本日の施術対象: {{pet_name}}</li>
  <li>希望施術内容: {{service_name}}</li>
  <li>既往歴・持病・アレルギー・投薬状況を事前に申告し、未申告による不利益は依頼者の責任となることに同意します。</li>
  <li>体調不良、攻撃性、高齢、妊娠、治療中など施術リスクがある場合、店舗判断で施術中止・内容変更することに同意します。</li>
</ul>
<h2>2. 安全確保と緊急時対応</h2>
<ul>
  <li>施術中に健康上の異常が生じた場合、店舗が必要と判断したときは動物病院へ搬送し、応急処置・診療を優先することに同意します。</li>
  <li>緊急対応に伴う診療費・交通費等の実費は依頼者負担となることに同意します。</li>
</ul>
<h2>3. 仕上がり・免責</h2>
<ul>
  <li>毛玉、皮膚状態、犬の性格等により、希望どおりの仕上がりにならない場合があることを理解しています。</li>
  <li>通常の注意義務を尽くした上で発生した軽微な擦過傷、バリカン負け、ストレス反応等については、店舗に重過失がない限り免責となることに同意します。</li>
</ul>
<h2>4. 予約・キャンセル・連絡</h2>
<ul>
  <li>予約時間に遅刻した場合、施術内容の短縮または日時変更となる場合があることに同意します。</li>
  <li>無断キャンセルや直前キャンセル時の取り扱いは店舗規定に従うことに同意します。</li>
</ul>
<h2>5. 個人情報・記録利用</h2>
<ul>
  <li>顧客情報および施術記録（写真・施術メモ等）を、施術提供・問い合わせ対応・品質改善のために店舗が利用することに同意します。</li>
  <li>SNS/広告等の対外利用は、別途同意がある場合に限ることを理解しています。</li>
</ul>
<h2>6. 同意日・署名</h2>
<p>同意日: {{consent_date}}</p>
<p>上記内容を確認し、電子署名をもって同意します。</p>
$html$;
  body_text_value constant text := $txt$
施術同意書

私は、{{store_name}}（以下「店舗」）に対して、以下の内容を確認・同意のうえ施術を依頼します。

1. 施術内容と体調申告
- 本日の施術対象: {{pet_name}}
- 希望施術内容: {{service_name}}
- 既往歴・持病・アレルギー・投薬状況を事前に申告し、未申告による不利益は依頼者の責任となることに同意します。
- 体調不良、攻撃性、高齢、妊娠、治療中など施術リスクがある場合、店舗判断で施術中止・内容変更することに同意します。

2. 安全確保と緊急時対応
- 施術中に健康上の異常が生じた場合、店舗が必要と判断したときは動物病院へ搬送し、応急処置・診療を優先することに同意します。
- 緊急対応に伴う診療費・交通費等の実費は依頼者負担となることに同意します。

3. 仕上がり・免責
- 毛玉、皮膚状態、犬の性格等により、希望どおりの仕上がりにならない場合があることを理解しています。
- 通常の注意義務を尽くした上で発生した軽微な擦過傷、バリカン負け、ストレス反応等については、店舗に重過失がない限り免責となることに同意します。

4. 予約・キャンセル・連絡
- 予約時間に遅刻した場合、施術内容の短縮または日時変更となる場合があることに同意します。
- 無断キャンセルや直前キャンセル時の取り扱いは店舗規定に従うことに同意します。

5. 個人情報・記録利用
- 顧客情報および施術記録（写真・施術メモ等）を、施術提供・問い合わせ対応・品質改善のために店舗が利用することに同意します。
- SNS/広告等の対外利用は、別途同意がある場合に限ることを理解しています。

6. 同意日・署名
同意日: {{consent_date}}
上記内容を確認し、電子署名をもって同意します。
$txt$;
  existing_template_id uuid;
  inserted_template_id uuid;
  inserted_version_id uuid;
begin
  if target_store_id is null then
    return;
  end if;

  select id
    into existing_template_id
    from public.consent_templates
   where store_id = target_store_id
     and name = template_name
   order by created_at asc
   limit 1;

  if existing_template_id is not null then
    return;
  end if;

  insert into public.consent_templates (
    store_id,
    name,
    category,
    description,
    status
  )
  values (
    target_store_id,
    template_name,
    'grooming',
    '施術同意書の標準テンプレート（初期登録）',
    'draft'
  )
  returning id into inserted_template_id;

  insert into public.consent_template_versions (
    store_id,
    template_id,
    version_no,
    title,
    body_html,
    body_text,
    document_hash,
    published_at
  )
  values (
    target_store_id,
    inserted_template_id,
    1,
    template_title,
    body_html_value,
    body_text_value,
    encode(extensions.digest(convert_to(body_html_value, 'UTF8'), 'sha256'), 'hex'),
    now()
  )
  returning id into inserted_version_id;

  update public.consent_templates
     set current_version_id = inserted_version_id,
         status = 'published',
         updated_at = now()
   where id = inserted_template_id;
end;
$$;

do $$
declare
  store_row record;
begin
  for store_row in select id from public.stores
  loop
    perform public.seed_default_consent_template_for_store(store_row.id);
  end loop;
end $$;

create or replace function public.seed_default_consent_template_on_store_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_consent_template_for_store(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_default_consent_template_on_store_insert on public.stores;
create trigger trg_seed_default_consent_template_on_store_insert
after insert on public.stores
for each row execute function public.seed_default_consent_template_on_store_insert();

commit;
