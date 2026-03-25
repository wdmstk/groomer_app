# POS UATチェックリスト（TASK-POS-006）

## 目的
- パイロット導入前に、通常会計・取消・在庫連動・レジ締めの実運用可否を確認する。

## 前提
- `supabase/supabase_pos_core.sql` が適用済み
- `/payments` の POS会計（β）パネルが利用可能
- テスト対象店舗で `inventory_items` が登録済み

## 実施記録
- 対象店舗: `DEV-PILOT-01`（開発環境リハーサル）
- 実施日: `2026-03-25`
- 実施者: POS導入チーム（開発）
- 判定: `conditional`
- 備考: 自動テスト中心の事前UAT。実店舗パイロット（2営業日）で最終サインオフを行う。

## 自動テスト証跡（2026-03-25）
- `npm test -- tests/pos.inventory.test.ts tests/pos.session-close.test.ts` : `pass (2/2)`
- `npx playwright test --project=chromium e2e/payments-list.spec.ts` : `pass (3/3)`

## 実施結果サマリ
| 項目 | 結果 (`pass`/`fail`/`conditional`) | 証跡（画面/SQL/ログ） | メモ |
|---|---|---|---|
| 開局 | conditional | `POST /api/pos/sessions/open` 実装確認 | 実店舗オペレーションで再確認 |
| 通常会計（POS） | conditional | `POST /api/pos/orders` / `confirm` 実装確認 | E2Eは環境前提差異で再実行要 |
| 在庫連動（出庫） | pass | `npm test -- tests/pos.inventory.test.ts` | notesキー重複防止を確認 |
| 取消（void） | conditional | `/api/pos/orders/[order_id]/void` 実装確認 | 返品オペレーションの実地確認待ち |
| 在庫連動（戻し） | pass | `npm test -- tests/pos.inventory.test.ts` | 取消戻しの重複起票防止を確認 |
| 現金入出金 | conditional | `POST /api/pos/cash-drawer-events` 実装確認 | 実運用オペレーション確認待ち |
| 日次締め | pass | `npm test -- tests/pos.session-close.test.ts` | 集計ロジック単体テスト合格 |
| 権限/スコープ | conditional | RLS設計/APIガード確認 | 実店舗アカウントで最終確認待ち |

## シナリオ
1. 開局
- [ ] `/payments` で「開局」できる
- [ ] 同時に2回目の開局が `POS_SESSION_ALREADY_OPEN` で拒否される

2. 通常会計（POS）
- [ ] 予約・顧客・商品を選び会計確定できる
- [ ] 領収書へ遷移し `payments` が `支払済` で作成される
- [ ] `pos_orders.session_id` が開局中セッションに紐づく

3. 在庫連動（出庫）
- [ ] POS会計で `inventory_movements` に `outbound` が作成される
- [ ] `notes` が `POS_OUTBOUND:<order_id>:<line_id>` 形式で記録される
- [ ] 同一操作再試行で重複起票されない

4. 取消（void）
- [ ] 領収書画面から取消できる
- [ ] `pos_orders.status=void` と `pos_refunds` 記録を確認できる
- [ ] `payments.status=取消` に更新される

5. 在庫連動（戻し）
- [ ] 取消で `inventory_movements` に `inbound` が作成される
- [ ] `notes` が `POS_VOID_REVERT:<order_id>:<line_id>` 形式で記録される
- [ ] 同一取消再試行で重複起票されない

6. 現金入出金
- [ ] `cash_in` / `cash_out` / `adjustment` を登録できる
- [ ] クローズ済みセッションでは登録不可になる

7. 日次締め
- [ ] 実残高を入力して締め処理できる
- [ ] サマリ（売上合計・現金期待額・差異）が表示される
- [ ] セッションが `closed` になり再締め不可になる

8. 権限/スコープ
- [ ] 他店舗データへアクセスできない（RLS）
- [ ] 監査ログに `pos_session` / `pos_order` / `cash_drawer_event` 操作が残る

## 受入判定基準
- `fail` が 0 件
- `conditional` は期限付きの是正計画がある
- 主要業務（開局・会計・取消・締め）がすべて `pass`
- 本チェックが開発環境リハーサルの場合、最終判定は `conditional` とし、実店舗パイロット完了後に再判定する

## サインオフ
- 店舗責任者: 未サイン（実店舗パイロット後）
- 導入担当: POS導入チーム（開発）
- 承認日: 未確定
