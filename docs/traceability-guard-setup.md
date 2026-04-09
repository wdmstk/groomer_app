# Traceability Guard 必須化手順

`Traceability Guard`（`.github/workflows/traceability-guard.yml`）を
PRマージ前の必須チェックに設定する手順です。

対象リポジトリ:
- `wdmstk/groomer_app`

必須化したいチェック:
- `Traceability Guard / verify`

## 1. GitHub UIで設定（推奨）
1. GitHubで `wdmstk/groomer_app` を開く。
2. `Settings` -> `Branches` -> `Branch protection rules` を開く。
3. `main`（必要なら `master` も）に対するルールを `Add rule` / `Edit`。
4. `Require status checks to pass before merging` をON。
5. ステータスチェック一覧から `Traceability Guard / verify` を選択。
6. `Save changes`。

補足:
- 選択肢に出ない場合は、先に1回ワークフローを通してチェック名を生成する。

## 2. GitHub CLIで設定（代替）
前提:
- `gh auth login` 済み
- 管理権限トークン（repo/admin:repo_hook 相当）を利用可能

確認:
```bash
gh auth status
```

既存ルール確認:
```bash
gh api repos/wdmstk/groomer_app/branches/main/protection
```

`main` に必須チェックを設定（例）:
```bash
gh api \
  -X PUT \
  repos/wdmstk/groomer_app/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks.strict=true \
  -f required_status_checks.contexts[]="Traceability Guard / verify" \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f restrictions=
```

## 3. 動作確認
1. PRを作成。
2. `Traceability Guard / verify` が実行されることを確認。
3. 失敗時にマージ不可になることを確認。

