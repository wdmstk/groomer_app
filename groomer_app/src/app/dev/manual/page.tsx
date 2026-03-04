import { Card } from '@/components/ui/Card'
import { requireDeveloperAdmin } from '@/lib/auth/developer-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DevManualPage() {
  const auth = await requireDeveloperAdmin()
  if (!auth.ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">管理者マニュアル</h1>
        <Card>
          <p className="text-sm text-red-700">このページは開発者管理者のみアクセスできます。</p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">管理者マニュアル</h1>
        <p className="text-sm text-gray-600">
          サブスク課金管理画面の各項目と、ログイン時の利用可否判定ロジックの詳細です。
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">基本仕様</h2>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p>
            この管理画面は開発者管理者専用です。店舗の <code>owner</code> / <code>admin</code> 権限ではアクセスできません。
          </p>
          <p>
            ログイン済みユーザーが業務画面へアクセスしたとき、課金状態と試用期間を判定し、条件を満たさない場合は
            <code>/billing-required</code> へ遷移します。
          </p>
          <p>
            owner は <code>/billing</code> と <code>/billing/history</code> で課金状態確認・操作・監査ができます。
            非ownerにはサイドバー表示されません。
          </p>
          <p>
            ブロック判定は <code>billing_status</code> ごとに異なります。<code>active</code> は常に利用可能、
            <code>past_due</code> は <code>past_due_since + grace_days</code> 超過で停止、
            その他ステータスは試用期限超過で停止です。
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">入力項目の詳細</h2>
        <div className="mt-4 space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-semibold text-gray-900">plan_code</p>
            <p>
              契約プランを識別するコードです。表示・管理用の文字列で、判定ロジックでは直接参照しません。
              例: <code>free</code> / <code>basic</code> / <code>pro</code>
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">billing_status</p>
            <p>
              利用可否判定に使う最重要項目です。<code>active</code> のときは試用期限に関係なく利用可能です。
              それ以外（<code>inactive</code>, <code>trialing</code>, <code>past_due</code>,
              <code>paused</code>, <code>canceled</code>）は、試用期限を超えるとブロック対象です。
            </p>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>
                <code>inactive</code>: 契約未開始または課金設定未完了の状態。試用終了後は利用停止対象です。
              </p>
              <p>
                <code>trialing</code>: 試用運用中の状態。試用期限内は利用可能、期限超過で停止対象です。
              </p>
              <p>
                <code>active</code>: 課金契約が有効な状態。試用期限に関係なく利用可能です。
              </p>
              <p>
                <code>past_due</code>: 支払い遅延・失敗などで請求が未回収の状態。猶予日数超過で停止対象です。
              </p>
              <p>
                <code>paused</code>: 管理上の一時停止状態。試用終了後は停止対象です。
              </p>
              <p>
                <code>canceled</code>: 契約終了状態。試用終了後は停止対象です。
              </p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900">billing_cycle</p>
            <p>
              請求周期の管理項目です。<code>monthly</code> / <code>yearly</code> / <code>custom</code>
              を保持します。現時点では利用可否判定には使わず、運用情報として保持します。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">amount_jpy</p>
            <p>
              契約金額（円）です。0以上の整数のみ保存できます。判定には使いませんが、請求確認時の参照値になります。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">trial_days</p>
            <p>
              試用期間の日数です。デフォルトは30日で、0以上3650以下を指定できます。将来の運用方針変更に合わせ、
              店舗単位で自由に変更可能です。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">grace_days</p>
            <p>
              <code>past_due</code> 状態時の猶予日数です。0以上365以下で設定できます。
              判定は <code>past_due_since + grace_days</code> で行います。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">trial_started_at</p>
            <p>
              試用開始日です。判定ではこの日付に <code>trial_days</code> を加算して試用終了日を算出します。
              未設定時は保存時当日が自動設定されます。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">past_due_since</p>
            <p>
              <code>past_due</code> 開始日時です。未設定時は判定時の当日を基準に扱われるため、
              実運用では開始日時を明示設定してください。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">current_period_start / current_period_end</p>
            <p>
              現在契約期間の開始・終了日です。主に運用確認用で、現時点のアクセス判定には使用しません。
              将来、厳密な請求期間制御を実装する際の基礎データとして保持します。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">preferred_provider</p>
            <p>
              優先決済手段です。<code>stripe</code> / <code>komoju</code> / null を保持します。
              owner画面から切替可能です。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">next_billing_date</p>
            <p>
              次回請求予定日です。請求オペレーション上の参照値です。アクセス判定には使いません。
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">notes</p>
            <p>
              任意メモです。請求失敗理由、個別対応履歴、例外対応期限など、運用管理情報を記録できます。
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">判定フロー詳細</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>ログイン済みユーザーの所属店舗を取得し、判定対象店舗を1つ選定します。</li>
          <li>選定順は「active_store_id Cookie一致 → owner権限店舗 → admin権限店舗 → 先頭」です。</li>
          <li>対象店舗の <code>store_subscriptions</code> を取得します。</li>
          <li><code>billing_status === active</code> なら利用を許可します。</li>
          <li>
            <code>billing_status === past_due</code> の場合は
            <code>past_due_since + grace_days</code> を超えたら <code>/billing-required</code> へ遷移します。
          </li>
          <li>
            それ以外は <code>trial_started_at + trial_days</code> を試用終了日として算出します。
          </li>
          <li>本日が試用終了日以上なら <code>/billing-required</code> へ遷移します。</li>
          <li>
            ただし <code>/billing-required</code>, <code>/billing</code>, <code>/logout</code>, <code>/dev</code> 系は
            課金ブロック除外パスです。
          </li>
        </ol>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900">用語集（横文字の説明）</h2>
        <dl className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">billing_status</dt>
            <dd className="mt-1">課金状態の判定項目です。active は利用可、past_due などは条件次第で利用制限されます。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">past_due</dt>
            <dd className="mt-1">支払い遅延状態です。past_due_since から grace_days を超えると停止対象です。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">trial_days / trial_started_at</dt>
            <dd className="mt-1">試用日数と試用開始日です。trial_started_at + trial_days で期限を判定します。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">preferred_provider</dt>
            <dd className="mt-1">優先決済手段です。stripe または komoju を設定します。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">Webhook</dt>
            <dd className="mt-1">外部決済サービスからの自動通知です。決済結果の反映に使用します。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">Checkout</dt>
            <dd className="mt-1">支払い手続きのために外部決済ページへ遷移する処理です。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">idempotency_key</dt>
            <dd className="mt-1">同じ操作の二重実行を防ぐ識別キーです。Checkout履歴などで追跡します。</dd>
          </div>
          <div className="rounded border p-2">
            <dt className="font-semibold text-gray-900">Cron</dt>
            <dd className="mt-1">定期実行ジョブです。試用切替・リマインド・状態同期を自動実行します。</dd>
          </div>
        </dl>
      </Card>
    </section>
  )
}
