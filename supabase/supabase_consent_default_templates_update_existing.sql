-- =========================================================
-- Groomer App: Existing Store Consent Template Upgrade
-- Task: TASK-434
-- =========================================================
-- Purpose:
-- 1) Upgrade existing stores that already have the standard consent template
-- 2) Publish the new full-version body as a new template version
-- =========================================================

begin;

create extension if not exists pgcrypto;

create or replace function public.upgrade_full_consent_template_for_store(target_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  template_name constant text := '施術同意書（標準）';
  template_title constant text := '施術同意書（標準版）';
  body_html_value constant text := $html$
<p>私は、{{store_name}}（以下「店舗」）に対して、以下の内容を確認・同意のうえ施術を依頼します。</p>
<h2>1. 顧客情報</h2>
<ul>
  <li>顧客名: {{customer_name}}</li>
  <li>住所: {{customer_address}}</li>
  <li>電話番号: {{customer_phone}}</li>
</ul>
<h2>2. ペット情報</h2>
<ul>
  <li>ペット名: {{pet_name}}</li>
  <li>種類（犬/猫）: {{pet_species}}</li>
  <li>犬種/猫種: {{pet_breed}}</li>
  <li>年齢: {{pet_age}}</li>
  <li>性別: {{pet_gender}}</li>
</ul>
<h2>3. 本日の施術内容</h2>
<ul>
  <li>施術対象ペット: {{pet_name}}</li>
  <li>希望施術内容: {{service_name}}</li>
</ul>
<h2>4. 健康状態の申告</h2>
<p>以下について、飼い主が正確に申告することを確認します。</p>
<ul>
  <li>持病（心臓病、てんかん、皮膚病、呼吸器疾患など）</li>
  <li>アレルギー（シャンプー成分・薬剤・食物など）</li>
  <li>予防接種状況（狂犬病・混合ワクチン）</li>
  <li>ノミ・ダニの有無</li>
  <li>妊娠の可能性</li>
  <li>服薬中の薬</li>
  <li>過去のトリミング中のトラブル（噛む・暴れる・失神など）</li>
  <li>皮膚の炎症・外傷の有無</li>
  <li>高齢によるリスク</li>
</ul>
<p>未申告または虚偽申告によって生じた不利益について、店舗は責任を負わないことに同意します。</p>
<h2>5. 施術に伴うリスクの理解</h2>
<p>以下のリスクがあることを理解し、同意します。</p>
<ul>
  <li>施術中のストレスによる体調悪化</li>
  <li>高齢・持病・短頭種など特有のリスク</li>
  <li>皮膚の赤み・かゆみ・軽度の出血</li>
  <li>バリカン負け</li>
  <li>毛玉処理による短い仕上がり・皮膚負担</li>
  <li>暴れる・噛むなどの行動による施術中断</li>
  <li>予期せぬ事故（転倒・爪割れ・興奮による怪我）</li>
  <li>店舗判断により施術を中止・変更する場合があること</li>
</ul>
<h2>6. 毛玉・もつれに関する同意</h2>
<ul>
  <li>毛玉が多い場合、追加料金が発生すること</li>
  <li>皮膚への負担が大きく、希望より短い仕上がりになる可能性</li>
  <li>毛玉処理に伴う皮膚トラブルのリスク</li>
</ul>
<h2>7. 仕上がりに関する同意</h2>
<ul>
  <li>毛質・毛量・健康状態により希望スタイルを再現できない場合がある</li>
  <li>写真を用いたスタイル指定は「近づける」対応である</li>
  <li>イメージ違いによる返金は不可</li>
</ul>
<h2>8. 緊急時の対応</h2>
<ul>
  <li>施術中に異常が見られた場合、施術を中断する</li>
  <li>必要に応じて動物病院へ連絡・搬送する</li>
  <li>診療費・交通費は飼い主負担</li>
  <li>緊急連絡先に連絡がつかない場合、店舗の判断に委ねる</li>
</ul>
<h2>9. 予約・キャンセル</h2>
<ul>
  <li>遅刻時は施術内容の短縮または日時変更となる場合がある</li>
  <li>無断キャンセル・直前キャンセルは店舗規定に従う</li>
</ul>
<h2>10. 個人情報・記録利用</h2>
<ul>
  <li>顧客情報および施術記録（写真・施術メモ等）は、施術提供・問い合わせ対応・品質改善のために利用</li>
  <li>SNS・広告等への掲載は、別途同意がある場合に限る</li>
  <li>SNS利用の選択: {{sns_usage_preference}}</li>
</ul>
<h2>11. 免責事項</h2>
<ul>
  <li>通常の注意義務を尽くした上で発生した軽微な傷・バリカン負け・ストレス反応について店舗に責任を求めない</li>
  <li>既存の皮膚病・疾患の悪化について店舗は責任を負わない</li>
  <li>飼い主の申告漏れによるトラブルは免責</li>
  <li>自宅での管理不足による悪化は対象外</li>
</ul>
<h2>12. 同意および電子署名</h2>
<p>同意日: {{consent_date}}</p>
<p>上記内容を確認し、電子署名をもって同意します。</p>
<ul>
  <li>署名者名: {{customer_name}}</li>
  <li>署名方式: 電子署名（手書き）</li>
  <li>署名日時: {{consent_date}}</li>
  <li>IPアドレス・端末情報（自動記録）</li>
</ul>
$html$;
  body_text_value constant text := $txt$
私は、{{store_name}}（以下「店舗」）に対して、以下の内容を確認・同意のうえ施術を依頼します。

1. 顧客情報
- 顧客名: {{customer_name}}
- 住所: {{customer_address}}
- 電話番号: {{customer_phone}}

2. ペット情報
- ペット名: {{pet_name}}
- 種類（犬/猫）: {{pet_species}}
- 犬種/猫種: {{pet_breed}}
- 年齢: {{pet_age}}
- 性別: {{pet_gender}}

3. 本日の施術内容
- 施術対象ペット: {{pet_name}}
- 希望施術内容: {{service_name}}

4. 健康状態の申告
以下について、飼い主が正確に申告することを確認します。
- 持病（心臓病、てんかん、皮膚病、呼吸器疾患など）
- アレルギー（シャンプー成分・薬剤・食物など）
- 予防接種状況（狂犬病・混合ワクチン）
- ノミ・ダニの有無
- 妊娠の可能性
- 服薬中の薬
- 過去のトリミング中のトラブル（噛む・暴れる・失神など）
- 皮膚の炎症・外傷の有無
- 高齢によるリスク
未申告または虚偽申告によって生じた不利益について、店舗は責任を負わないことに同意します。

5. 施術に伴うリスクの理解
以下のリスクがあることを理解し、同意します。
- 施術中のストレスによる体調悪化
- 高齢・持病・短頭種など特有のリスク
- 皮膚の赤み・かゆみ・軽度の出血
- バリカン負け
- 毛玉処理による短い仕上がり・皮膚負担
- 暴れる・噛むなどの行動による施術中断
- 予期せぬ事故（転倒・爪割れ・興奮による怪我）
- 店舗判断により施術を中止・変更する場合があること

6. 毛玉・もつれに関する同意
- 毛玉が多い場合、追加料金が発生すること
- 皮膚への負担が大きく、希望より短い仕上がりになる可能性
- 毛玉処理に伴う皮膚トラブルのリスク

7. 仕上がりに関する同意
- 毛質・毛量・健康状態により希望スタイルを再現できない場合がある
- 写真を用いたスタイル指定は「近づける」対応である
- イメージ違いによる返金は不可

8. 緊急時の対応
- 施術中に異常が見られた場合、施術を中断する
- 必要に応じて動物病院へ連絡・搬送する
- 診療費・交通費は飼い主負担
- 緊急連絡先に連絡がつかない場合、店舗の判断に委ねる

9. 予約・キャンセル
- 遅刻時は施術内容の短縮または日時変更となる場合がある
- 無断キャンセル・直前キャンセルは店舗規定に従う

10. 個人情報・記録利用
- 顧客情報および施術記録（写真・施術メモ等）は、施術提供・問い合わせ対応・品質改善のために利用
- SNS・広告等への掲載は、別途同意がある場合に限る
- SNS利用の選択: {{sns_usage_preference}}

11. 免責事項
- 通常の注意義務を尽くした上で発生した軽微な傷・バリカン負け・ストレス反応について店舗に責任を求めない
- 既存の皮膚病・疾患の悪化について店舗は責任を負わない
- 飼い主の申告漏れによるトラブルは免責
- 自宅での管理不足による悪化は対象外

12. 同意および電子署名
同意日: {{consent_date}}
上記内容を確認し、電子署名をもって同意します。
- 署名者名: {{customer_name}}
- 署名方式: 電子署名（手書き）
- 署名日時: {{consent_date}}
- IPアドレス・端末情報（自動記録）
$txt$;
  existing_template_id uuid;
  current_version_no integer;
  current_body_text text;
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

  if existing_template_id is null then
    perform public.seed_default_consent_template_for_store(target_store_id);
    return;
  end if;

  select ctv.version_no, ctv.body_text
    into current_version_no, current_body_text
    from public.consent_templates ct
    left join public.consent_template_versions ctv
      on ctv.id = ct.current_version_id
   where ct.id = existing_template_id;

  if coalesce(current_body_text, '') = body_text_value then
    return;
  end if;

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
    existing_template_id,
    coalesce(current_version_no, 0) + 1,
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
   where id = existing_template_id;
end;
$$;

do $$
declare
  store_row record;
begin
  for store_row in select id from public.stores
  loop
    perform public.upgrade_full_consent_template_for_store(store_row.id);
  end loop;
end $$;

commit;
