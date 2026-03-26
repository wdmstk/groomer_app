# ペットサロンSaaS比較メモ（2026-03-26）

## 1. 目的
- 今後の追加機能・改善検討のベースとして、主要3サービスを同一観点で比較する。
- 対象: 本システム / CHERIEE / ONE HOME PLUS。

## 2. 比較ルール（同じ土俵）
- 一般的なペットサロンSaaSで必要な機能を先に定義し、その観点で比較する。
- 各社とも「明示確認できる情報」のみで評価する。
- 評価記号:
  - `◎`: 機能が明確に確認できる
  - `○`: 近い機能が確認できる
  - `△`: 一部・連携・条件付き・予定
  - `-`: 確認できない

## 3. 暫定評価（◎○△-）
| # | 機能 | 本システム | CHERIEE | ONE HOME PLUS |
|---|---|---:|---:|---:|
| 1 | Web予約 | ◎ | ◎ | ◎ |
| 2 | LINE予約/LINE連携 | ◎ | ◎ | ◎ |
| 3 | 予約台帳・スタッフ別表示 | ◎ | ◎ | ◎ |
| 4 | 空き枠最適化（死枠削減） | ○ | ○ | ◎ |
| 5 | 予約変更/キャンセル導線 | ◎ | ○ | ◎ |
| 6 | 顧客管理（飼い主） | ◎ | ◎ | ◎ |
| 7 | ペット管理（多頭・注意事項） | ◎ | ◎ | ◎ |
| 8 | 電子カルテ | ◎ | ◎ | ◎ |
| 9 | 写真共有 | ◎ | ◎ | ◎ |
| 10 | 動画共有/動画カルテ | ◎ | ○ | ○ |
| 11 | 日誌共有 | ○ | ◎ | ◎ |
| 12 | POS会計 | ◎ | △ | △ |
| 13 | 在庫管理/在庫連動 | ◎ | - | - |
| 14 | 無断キャンセル対応（請求/記録） | ◎ | △ | △ |
| 15 | リマインド通知（LINE/メール） | ◎ | ○ | ◎ |
| 16 | 権限管理（owner/admin/staff等） | ◎ | △ | ◎ |
| 17 | 多店舗対応 | ◎ | ○ | ◎ |
| 18 | シフト管理 | - | - | ◎ |
| 19 | 勤怠管理 | - | - | ◎ |
| 20 | CTI（着信連携） | - | - | ◎ |
| 21 | 電子同意書 | - | - | ◎ |
| 22 | 集客機能（ポータル等） | - | - | ◎ |
| 23 | AI機能（分析/自動タグ等） | ◎ | - | △ |
| 24 | 監査ログ/操作履歴 | ◎ | - | △ |
| 25 | API/外部連携（決済・会計等） | ◎ | ○ | △ |
| 26 | サポート体制（導入/運用） | ○ | ◎ | ◎ |
| 27 | 料金透明性（初期/従量/解約条件） | ◎ | ◎ | ◎ |
| 28 | セキュリティ/権限制御 | ◎ | △ | △ |
| 29 | モバイル対応（iOS/Android/タブレット） | ○ | ○ | ◎ |
| 30 | データ移行（既存台帳/CSV） | △ | ○ | ○ |

## 4. 差異サマリー（改善検討向け）
- 本システムが優位:
  - POS会計の深さ（会計・取消・在庫連動・運用統制）
  - 動画カルテ/AI活用
  - 監査・権限制御・多店舗統制
- ONE HOME PLUSが優位:
  - CTI、シフト、勤怠、電子同意書、集客ポータルなど「現場運用機能」
  - 予約導線の運用最適化訴求
- CHERIEEが優位:
  - 予約/LINE/カルテの導入しやすさ
  - 料金ページの明確さ、Square連携訴求

## 5. 本システム側の参照（機能確認に使用）
- POS確定API: `/groomer_app/src/app/api/pos/orders/[order_id]/confirm/route.ts`
- POS取消API: `/groomer_app/src/app/api/pos/orders/[order_id]/void/route.ts`
- POS在庫連動: `/groomer_app/src/lib/pos/inventory.ts`
- 公開予約API: `/groomer_app/src/app/api/public/reserve/[store_id]/route.ts`
- 空き枠API: `/groomer_app/src/app/api/public/reserve/[store_id]/slots/route.ts`
- 動画カルテ共有: `/groomer_app/src/app/api/medical-records/videos/[video_id]/share-line/route.ts`
- AI関連画面: `/groomer_app/src/app/medical-records/page.tsx`

## 6. 外部参照URL
- CHERIEE 公式: https://services.cheriee.jp/
- CHERIEE 予約機能: https://services.cheriee.jp/features/reservation/
- CHERIEE 顧客管理/カルテ: https://services.cheriee.jp/features/crm
- CHERIEE 料金: https://services.cheriee.jp/price
- ONE HOME PLUS 公式LP: https://lp.onehomeplus.jp/

## 7. 注意
- 料金透明性は、料金表・オプション料金・容量追加単価の公開を主評価とする。
- 本システムの解約条件は料金表本体ではなく利用規約側で確認する。
- 本メモは 2026-03-26 時点の確認情報に基づく暫定版。
- `△` と `-` の項目は、導入検討時にデモ/問い合わせで再確認すること。
