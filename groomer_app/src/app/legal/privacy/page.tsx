import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-5 text-sm leading-7 text-slate-700 sm:text-base">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">プライバシーポリシー</h1>
      <p>
        {LEGAL_NOTICE.operatorName}（以下「当運営者」といいます。）は、{LEGAL_NOTICE.serviceName}
        （以下「本サービス」といいます。）における利用者情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
      </p>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. 取得する情報</h2>
        <ul className="list-disc pl-6">
          <li>アカウント情報（メールアドレス等）</li>
          <li>店舗運用情報（予約、顧客、ペット、会計、カルテ等の入力データ）</li>
          <li>アクセスログ、端末情報、Cookie等の識別情報</li>
          <li>お問い合わせ時に提供される情報</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. 利用目的</h2>
        <ul className="list-disc pl-6">
          <li>本サービスの提供、保守、改善のため</li>
          <li>本人確認、認証、不正利用防止のため</li>
          <li>お問い合わせ対応、障害連絡、重要通知のため</li>
          <li>請求、決済、契約管理のため</li>
          <li>利用状況の分析および新機能開発のため</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. 第三者提供</h2>
        <p>
          当運営者は、法令に基づく場合を除き、本人の同意なく個人情報を第三者へ提供しません。ただし、決済、クラウド運用、通知配信等の業務委託に伴い、必要な範囲で委託先へ情報を提供することがあります。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. 安全管理</h2>
        <p>当運営者は、不正アクセス、漏えい、改ざん、滅失を防止するため、アクセス制御、暗号化、監視、バックアップ等の合理的な安全管理措置を講じます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. 保有期間</h2>
        <p>利用者情報は、利用目的の達成に必要な期間または法令で定められた期間保有し、不要となった情報は適切な方法で削除または匿名化します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. 開示等の請求</h2>
        <p>利用者は、法令に基づき、自己情報の開示、訂正、利用停止等を請求できます。請求は下記窓口までご連絡ください。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. 改定</h2>
        <p>本ポリシーは、法令改正やサービス変更に応じて改定することがあります。重要な変更は本サービス上で告知します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">8. お問い合わせ窓口</h2>
        <p>事業者名: {LEGAL_NOTICE.operatorName}</p>
        <p>メールアドレス: {LEGAL_NOTICE.contactEmail}</p>
      </section>

      <p className="text-xs text-slate-500">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}

