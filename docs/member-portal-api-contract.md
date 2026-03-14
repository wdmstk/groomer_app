# Member Portal API Contract (Phase 1)

## 1) 発行 API
- Method/Path: `POST /api/customers/[customer_id]/member-portal-link`
- Auth: 店舗所属スタッフ（owner/admin/staff）
- Behavior:
  - 対象顧客の既存 `member_portal_links`（`revoked_at is null`）を先に revoke
  - 新規 token を発行して `member_portal_links` へ保存
  - レスポンスで `portalUrl` と `expiresAt` を返す
- Main status:
  - `200`: 発行成功
  - `401`: 未認証
  - `403`: 所属なし
  - `404`: 対象顧客なし
  - `500`: DB更新失敗

## 2) 検証 API
- Method/Path: `GET /api/public/member-portal/[token]`
- Auth: 不要（公開 token）
- Behavior:
  - token hash で `member_portal_links` を照合
  - revoke / 期限切れ / 正常アクセスを監査ログに記録
  - 顧客向けレスポンスはホワイトリスト項目のみ返却
- Main status:
  - `200`: 検証成功
  - `400`: token 形式不正
  - `404`: token 不在
  - `410`: revoke 済み or 有効期限切れ
  - `500`: サーバーエラー

## 3) Revoke API
- Method/Path: `POST /api/customers/[customer_id]/member-portal-link/revoke`
- Auth: 店舗所属スタッフ（owner/admin/staff）
- Behavior:
  - 対象顧客の有効リンクを revoke
  - 監査ログ `action=revoked` を記録
- Main status:
  - `200`: revoke成功（対象なしはメッセージ返却）
  - `401`: 未認証
  - `403`: 所属なし
  - `404`: 対象顧客なし
  - `500`: DB更新失敗

## 補足（Phase 1 運用ルール）
- 有効期限: `90日固定`
- 自動延長: なし
- 同時有効リンク: `1件`（DB制約 + 発行時 revoke）
- レート制限: proxy で `IP` と `IP+token` の2段制御
- 次回予約確認の最小導線:
  - 会員証トップに `次回予約` セクションを表示
  - 予約行動は `この内容で予約する` CTA で公開予約フォームへ遷移
- 長期未利用 auto revoke:
  - Phase 1 では導入しない
  - `90日固定期限` のみで失効させる
- 次回来店案内:
  - 次回予約がない場合、来店履歴（直近）を基準に目安日を表示
- 通知最適化:
  - 会員ポータル内のお知らせ表示は「重要度上位のみ最大2件」に制限
- LINE Login 連携判断:
  - Phase 1 は連携しない（公開 token 運用を継続）
- 公開 token 本人識別:
  - token は `base64url` 形式の長尺ランダム値
  - 検証前に token 形式チェック（不正形式は `400`）
  - API/ページ応答は `no-store` + `noindex`

## 監査ログ（運用判断）
- 記録イベント:
  - 発行: `action=created`
  - revoke: `action=revoked`
  - アクセス成功: `action=accessed`
  - 期限切れアクセス: `action=access_expired`
  - revoke済みアクセス: `action=access_revoked`
- 主要 payload:
  - `token_id`
  - `ip_hash`
  - `ua_hash`
  - `result`
- 保持期間:
  - 90日保持
  - 日次 cron `purge-member-portal-access-logs` で削除
