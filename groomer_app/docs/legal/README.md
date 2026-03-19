# legal ドキュメント管理

このディレクトリは、`src/` と同階層で法務文書を管理するための保管場所です。

- `tokushoho.md`: 特定商取引法に基づく表記
- `privacy-policy.md`: プライバシーポリシー
- `terms-of-service.md`: 利用規約
- `security-description.md`: セキュリティ説明書（企業向け）
- `CHANGELOG.md`: 法務文書の改定履歴

運用ルール:
1. 公開前に法務レビューを実施する
2. 改定日を明記する
3. Web公開ページ（`src/app/legal/*`）との内容差分を都度同期する
4. 変更時は `CHANGELOG.md` を更新する
