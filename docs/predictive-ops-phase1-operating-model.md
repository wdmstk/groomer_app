# 予測型オペレーション Phase 1 運用定義

## 目的

- 高精度モデル導入前に、運用で使える予兆アラートを段階的に定着させる。

## 対象テーマ

- Phase 1 の初期テーマは `無断キャンセル予兆` とする。

## 短中期の運用定義

1. 短期（導入〜4週）
- `predictive_store_daily_features` を日次確認し、店舗単位の無断キャンセル率を監視する。
- 閾値超過日は `dashboard` の当日運用タブで注意喚起する（画面実装は次フェーズ）。

2. 中期（5〜12週）
- `predictive_customer_daily_features` を使い、顧客単位の簡易スコア（高/中/低）を日次算出する。
- 高リスク顧客には前日リマインド連絡の優先対象フラグを付与する。

## 判定ルール（初期）

- 店舗アラート: `no_show_count / appointments_count >= 0.10`
- 顧客高リスク: 直近30日で `no_show_count >= 1` かつ `canceled_count >= 2`
- 顧客中リスク: 直近30日で `canceled_count >= 2`

## 役割

- 店舗 owner/admin: 閾値調整、対象顧客フォロー運用
- staff: 当日リマインド実行
- 本部（将来）: 閾値初期値の配布と横断レビュー

## 正本

- イベント定義: `メモ/予約KPIイベント定義.md`
- SQL基盤: `supabase_predictive_ops_base_views.sql`
