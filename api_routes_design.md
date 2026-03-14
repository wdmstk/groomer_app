# API Routes 設計

Next.jsのAPI Routes (`src/app/api` 以下) を利用して、バックエンドロジックとSupabaseとの連携を実装します。各APIは認証ミドルウェアによって保護され、必要に応じてバリデーションを行います。

## 共通設計

*   **認証**: すべての保護されたAPIエンドポイントは、Supabase Authのセッションを検証するミドルウェア（または各Routeハンドラ内で認証チェック）を通してアクセス制御を行います。認証されていないリクエストは `401 Unauthorized` を返します。
*   **エラーハンドリング**: 発生したエラーは適切にキャッチし、意味のあるエラーメッセージとHTTPステータスコード（例: `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`）を返します。
*   **バリデーション**: リクエストボディやクエリパラメータは、Zodなどのライブラリを使用してバリデーションを行います。
*   **データベース操作**: `lib/supabase/server.ts` で初期化されたSupabaseクライアントを使用して、データベース操作を行います。

## エンドポイント一覧

### 1. 認証関連 (Auth)

*   **`POST /api/auth/login`**
    *   **目的**: ユーザーログイン。
    *   **リクエスト**: `email`, `password`
    *   **処理**: Supabase Authでサインインし、セッションを確立します。
    *   **レスポンス**: 成功 (`200 OK`) ならユーザー情報、失敗 (`401 Unauthorized`, `400 Bad Request`) ならエラーメッセージ。
*   **`POST /api/auth/logout`**
    *   **目的**: ユーザーログアウト。
    *   **処理**: Supabase Authでサインアウトし、セッションを破棄します。
    *   **レスポンス**: 成功 (`200 OK`)。

### 2. 顧客管理 (Customers)

*   **`GET /api/customers`**
    *   **目的**: 顧客一覧の取得。
    *   **クエリ**: `page`, `limit`, `search`, `rank`, `tag` など（オプション）
    *   **処理**: Supabaseから顧客データをフェッチします。RLSを考慮し、アクセス権限のある顧客のみを返します。
    *   **レスポンス**: 顧客データの配列。
*   **`POST /api/customers`**
    *   **目的**: 新規顧客の登録。
    *   **リクエスト**: `full_name`, `address`, `phone_number`, `email`, `line_id`, `how_to_know`, `rank`, `tags`
    *   **処理**: 顧客情報をSupabaseに挿入します。
    *   **レスポンス**: 登録された顧客情報。
*   **`GET /api/customers/[customer_id]`**
    *   **目的**: 特定顧客の詳細情報の取得。
    *   **処理**: `customer_id` に基づいてSupabaseから顧客データをフェッチします。
    *   **レスポンス**: 特定顧客のデータ。
*   **`PUT /api/customers/[customer_id]`**
    *   **目的**: 特定顧客情報の更新。
    *   **リクエスト**: `full_name`, `address`, `phone_number`, `email`, `line_id`, `how_to_know`, `rank`, `tags` (一部またはすべて)
    *   **処理**: `customer_id` に基づいて顧客情報を更新します。
    *   **レスポンス**: 更新された顧客情報。
*   **`DELETE /api/customers/[customer_id]`**
    *   **目的**: 特定顧客の削除。
    *   **処理**: `customer_id` に基づいて顧客情報を削除します。関連するペット、予約、カルテなどもカスケード削除または論理削除を検討します。
    *   **レスポンス**: 成功 (`200 OK`)。

### 3. ペット管理 (Pets - 顧客に紐づく)

*   **`GET /api/customers/[customer_id]/pets`**
    *   **目的**: 特定顧客のペット一覧の取得。
    *   **処理**: `customer_id` に基づいてSupabaseからペットデータをフェッチします。
    *   **レスポンス**: ペットデータの配列。
*   **`POST /api/customers/[customer_id]/pets`**
    *   **目的**: 特定顧客への新規ペット登録。
    *   **リクエスト**: `name`, `breed`, `gender`, `date_of_birth`, `weight`, `vaccine_date`, `chronic_diseases`, `notes`
    *   **処理**: `customer_id` に紐づけてペット情報をSupabaseに挿入します。
    *   **レスポンス**: 登録されたペット情報。
*   **`GET /api/customers/[customer_id]/pets/[pet_id]`**
    *   **目的**: 特定顧客の特定ペット詳細情報の取得。
    *   **処理**: `customer_id` と `pet_id` に基づいてSupabaseからペットデータをフェッチします。
    *   **レスポンス**: 特定ペットのデータ。
*   **`PUT /api/customers/[customer_id]/pets/[pet_id]`**
    *   **目的**: 特定顧客の特定ペット情報の更新。
    *   **リクエスト**: `name`, `breed`, `gender`, `date_of_birth`, `weight`, `vaccine_date`, `chronic_diseases`, `notes` (一部またはすべて)
    *   **処理**: `customer_id` と `pet_id` に基づいてペット情報を更新します。
    *   **レスポンス**: 更新されたペット情報。
*   **`DELETE /api/customers/[customer_id]/pets/[pet_id]`**
    *   **目的**: 特定顧客の特定ペットの削除。
    *   **処理**: `customer_id` と `pet_id` に基づいてペット情報を削除します。関連するカルテなどもカスケード削除または論理削除を検討します。
    *   **レスポンス**: 成功 (`200 OK`)。

### 4. 予約管理 (Appointments)

*   **`GET /api/appointments`**
    *   **目的**: 予約一覧の取得（カレンダー表示用など）。
    *   **クエリ**: `start_date`, `end_date`, `staff_id`, `customer_id`, `status` など（オプション）
    *   **処理**: 指定期間の予約データをSupabaseからフェッチします。スタッフごとの空き枠管理ロジックもここで提供できます。
    *   **レスポンス**: 予約データの配列。
*   **`POST /api/appointments`**
    *   **目的**: 新規予約の登録。
    *   **リクエスト**: `customer_id`, `pet_id`, `staff_id`, `start_time`, `end_time`, `menu`, `duration`, `notes`
    *   **処理**: 予約情報をSupabaseに挿入します。予約重複チェック、スタッフの空き状況チェックなどのビジネスロジックを実行します。成功した場合、Resendによるメール通知、LINE Messaging APIによるLINE通知をトリガーします。
    *   **レスポンス**: 登録された予約情報。
*   **`GET /api/appointments/[appointment_id]`**
    *   **目的**: 特定予約の詳細情報の取得。
    *   **処理**: `appointment_id` に基づいてSupabaseから予約データをフェッチします。
    *   **レスポンス**: 特定予約のデータ。
*   **`PUT /api/appointments/[appointment_id]`**
    *   **目的**: 特定予約情報の更新（日時変更、ステータス変更、キャンセルなど）。
    *   **リクエスト**: `customer_id`, `pet_id`, `staff_id`, `start_time`, `end_time`, `menu`, `duration`, `status`, `notes` (一部またはすべて)
    *   **処理**: `appointment_id` に基づいて予約情報を更新します。ステータスが変更された場合、関連する通知（キャンセル通知など）をトリガーします。
    *   **レスポンス**: 更新された予約情報。
*   **`DELETE /api/appointments/[appointment_id]`**
    *   **目的**: 特定予約の削除。
    *   **処理**: `appointment_id` に基づいて予約情報を削除します。
    *   **レスポンス**: 成功 (`200 OK`)。

### 5. カルテ管理 (Medical Records - ペットに紐づく)

*   **`GET /api/customers/[customer_id]/pets/[pet_id]/medical-records`**
    *   **目的**: 特定ペットのカルテ一覧の取得。
    *   **処理**: `customer_id` と `pet_id` に基づいてSupabaseからカルテデータをフェッチします。
    *   **レスポンス**: カルテデータの配列。
*   **`POST /api/customers/[customer_id]/pets/[pet_id]/medical-records`**
    *   **目的**: 特定ペットへの新規カルテ登録。
    *   **リクエスト**: `staff_id`, `record_date`, `menu`, `duration`, `shampoo_used`, `skin_condition`, `behavior_notes`, `photos`, `caution_notes`
    *   **処理**: `pet_id` に紐づけてカルテ情報をSupabaseに挿入します。
    *   **レスポンス**: 登録されたカルテ情報。
*   **`GET /api/medical-records/[record_id]` (または `/api/customers/[customer_id]/pets/[pet_id]/medical-records/[record_id]`)**
    *   **目的**: 特定カルテの詳細情報の取得。
    *   **処理**: `record_id` に基づいてSupabaseからカルテデータをフェッチします。
    *   **レスポンス**: 特定カルテのデータ。
*   **`PUT /api/medical-records/[record_id]`**
    *   **目的**: 特定カルテ情報の更新。
    *   **リクエスト**: `staff_id`, `record_date`, `menu`, `duration`, `shampoo_used`, `skin_condition`, `behavior_notes`, `photos`, `caution_notes` (一部またはすべて)
    *   **処理**: `record_id` に基づいてカルテ情報を更新します。
    *   **レスポンス**: 更新されたカルテ情報。
*   **`DELETE /api/medical-records/[record_id]`**
    *   **目的**: 特定カルテの削除。
    *   **処理**: `record_id` に基づいてカルテ情報を削除します。
    *   **レスポンス**: 成功 (`200 OK`)。

### 6. スタッフ管理 (Staffs)

*   **`GET /api/staffs`**
    *   **目的**: スタッフ一覧の取得。
    *   **処理**: Supabaseからスタッフデータをフェッチします。
    *   **レスポンス**: スタッフデータの配列。
*   **`POST /api/staffs`**
    *   **目的**: 新規スタッフの登録。
    *   **リクエスト**: `full_name`, `email`
    *   **処理**: スタッフ情報をSupabaseに挿入します。必要であればSupabase Authへのユーザー登録も同時に行い、役割を設定します。
    *   **レスポンス**: 登録されたスタッフ情報。
*   **`GET /api/staffs/[staff_id]`**
    *   **目的**: 特定スタッフの詳細情報の取得。
    *   **処理**: `staff_id` に基づいてSupabaseからスタッフデータをフェッチします。
    *   **レスポンス**: 特定スタッフのデータ。
*   **`PUT /api/staffs/[staff_id]`**
    *   **目的**: 特定スタッフ情報の更新。
    *   **リクエスト**: `full_name`, `email` (一部またはすべて)
    *   **処理**: `staff_id` に基づいてスタッフ情報を更新します。
    *   **レスポンス**: 更新されたスタッフ情報。
*   **`DELETE /api/staffs/[staff_id]`**
    *   **目的**: 特定スタッフの削除。
    *   **処理**: `staff_id` に基づいてスタッフ情報を削除します。
    *   **レスポンス**: 成功 (`200 OK`)。

### 7. ファイルアップロード (Upload)

*   **`POST /api/upload`**
    *   **目的**: Supabase Storageへのファイルアップロード。
    *   **リクエスト**: `FormData` (ファイルデータ、バケット名、フォルダパスなど)
    *   **処理**: 受け取ったファイルをSupabase Storageにアップロードし、公開URL（または署名付きURL）を返します。
    *   **レスポンス**: アップロードされたファイルのURL。

### 8. 通知 (Notify)

*   **`POST /api/notify/email`**
    *   **目的**: Resendを使ったメール送信。
    *   **リクエスト**: `to`, `subject`, `body` (またはテンプレート名とデータ)
    *   **処理**: Resend APIを呼び出してメールを送信します。
    *   **レスポンス**: 成功 (`200 OK`)。
*   **`POST /api/notify/line`**
    *   **目的**: LINE Messaging APIを使ったメッセージ送信。
    *   **リクエスト**: `to` (LINE User ID), `message`
    *   **処理**: LINE Messaging APIを呼び出してメッセージを送信します。
    *   **レスポンス**: 成功 (`200 OK`)。

## 予約ロジックの詳細（`POST /api/appointments` の例）

1.  **リクエストバリデーション**: 入力データ (`customer_id`, `pet_id`, `staff_id`, `start_time`, `end_time`, `menu`, `duration`) をZodなどで厳密に検証します。
2.  **スタッフ空き状況チェック**: `staff_id` と `start_time`、`end_time` を使用して、指定されたスタッフがその時間帯に他の予約と重複していないかSupabaseの `appointments` テーブルを検索します。重複がある場合は `409 Conflict` を返します。
3.  **予約登録**: バリデーションと空き状況チェックを通過した場合、`appointments` テーブルに新しい予約レコードを挿入します。
4.  **通知トリガー**: 予約が正常に登録された後、以下の通知を非同期でトリガーします。
    *   **メール通知**: Resend (`/api/notify/email`) を呼び出し、顧客へ予約完了メールを送信します。
    *   **LINE通知**: LINE Messaging API (`/api/notify/line`) を呼び出し、顧客へ予約完了LINEメッセージを送信します（LINE IDが登録されている場合）。
5.  **レスポンス**: 登録された予約情報をクライアントに返します。

## スケジュールされた予約リマインド

予約前日のリマインド通知は、Vercel Cron JobsとAPI Routesを組み合わせて実現します。

*   **`GET /api/cron/remind-appointments`** (Vercel Cron Jobsから呼び出される)
    *   **目的**: 翌日以降の予約に対してリマインド通知を送信。
    *   **処理**: 
        1.  Supabaseの `appointments` テーブルから、翌日に予定されている「予約済」ステータスの予約をフェッチします。
        2.  各予約について、顧客のメールアドレスがあればResend (`/api/notify/email`) を呼び出し、LINE IDがあればLINE Messaging API (`/api/notify/line`) を呼び出してリマインドメッセージを送信します。
        3.  通知の送信履歴を別途記録することも検討します。
    *   **レスポンス**: 処理結果を返します。

Vercel Cron Jobsの設定例 (next.config.mjs または vercel.json):

```json
{
  "crons": [
    {
      "path": "/api/cron/remind-appointments",
      "schedule": "0 1 * * *" // 毎日午前1時 (UTC) に実行
    }
  ]
}
```

このAPI Routesの設計により、アプリケーションのバックエンド処理が明確に定義され、フロントエンドからのデータ操作や外部サービス連携が効率的に行えるようになります。