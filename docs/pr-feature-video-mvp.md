# PR: feature/video-mvp -> main

## Title
`feat: add video medical record mvp with line short share`

## Summary
既存の写真カルテを壊さずに、動画カルテMVPを追加しました。

## Changes
- `medical_record_videos` テーブル追加
- `pet-videos` Storageバケットポリシー追加
- 動画アップロードAPI追加 (`/api/upload/video`)
- 動画メタ登録/一覧API追加 (`/api/medical-records/videos`)
- 動画再生署名URL API追加 (`/api/medical-records/videos/[video_id]/play-url`)
- LINE短尺生成API追加 (`/api/medical-records/videos/[video_id]/line-short`)
- LINE動画送信API追加 (`/api/medical-records/videos/[video_id]/share-line`)
- カルテ一覧UIに写真+動画混在セクション追加
- 動画LINE送信ボタン + 再試行導線追加
- 容量判定を写真+動画合算に拡張（既存課金ロジックは未変更）
- `TASKS.md` にMVP〜Pro+の段階タスクを整備

## Backward Compatibility
- 既存 `medical_record_photos` / 既存写真アップロードAPIは未変更
- 既存の写真共有フローは維持
- 追加は新規テーブル/新規API/表示拡張のみ

## Validation
- 変更ファイル対象で `npm run lint:files -- ...` 実行済み

## Review Checklist
- [ ] 既存写真カルテの作成/編集/共有に回帰がない
- [ ] 動画アップロード〜再生まで通る
- [ ] 10〜20秒動画のみLINE短尺送信できる
- [ ] 失敗時に再試行できる
- [ ] 容量判定が写真+動画合算で動作する
- [ ] 容量超過時に既存追加容量導線へ遷移する

## Remaining MVP items
- 動画サムネイル自動生成ジョブ接続
- 混在一覧のE2E追加

## Merge Steps
1. CIとレビュー承認を確認
2. `main` 取り込み（rebase or merge）
3. migration適用順序確認
4. squash merge
5. デプロイ後に回帰確認（写真カルテ / 動画アップロード / LINE送信）
