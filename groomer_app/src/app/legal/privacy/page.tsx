import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6 text-base leading-8 text-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">プライバシーポリシー</h1>
      <p>
        {LEGAL_NOTICE.operatorName}（以下「当運営者」といいます。）は、{LEGAL_NOTICE.serviceName}
        （以下「本サービス」といいます。）における利用者情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
      </p>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">1. 取得する情報</h2>
        <ul className="list-disc pl-6">
          <li>アカウント情報（メールアドレス等）</li>
          <li>店舗運用情報（予約、顧客、ペット、会計、カルテ等の入力データ）</li>
          <li>アクセスログ、端末情報、Cookie等の識別情報</li>
          <li>お問い合わせ時に提供される情報</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">2. 利用目的</h2>
        <ul className="list-disc pl-6">
          <li>本サービスの提供、保守、改善のため</li>
          <li>本人確認、認証、不正利用防止のため</li>
          <li>お問い合わせ対応、障害連絡、重要通知のため</li>
          <li>請求、決済、契約管理のため</li>
          <li>利用状況の分析および新機能開発のため</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">4. 第三者提供</h2>
        <p>
          当運営者は、法令に基づく場合を除き、本人の同意なく個人情報を第三者へ提供しません。ただし、決済代行、クラウド提供、通知配信等の業務委託に伴い、必要な範囲で委託先へ提供する場合があります。
        </p>
        <p>主な委託先（2026年3月17日 時点）:</p>
        <ul className="list-disc pl-6">
          <li>Supabase（認証・データベース・ストレージ）</li>
          <li>Stripe（決済）</li>
          <li>KOMOJU（決済）</li>
          <li>Resend（メール配信）</li>
          <li>LINE Messaging API（通知配信）</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. 委託先の管理</h2>
        <p>個人情報の取扱いを外部委託する場合、委託先を適切に選定し、契約等により必要かつ適切な監督を行います。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">6. 外国にある第三者への提供</h2>
        <p>
          クラウド利用等により、外国にある事業者へ個人情報の取扱いを委託・提供する場合があります。その場合、個人情報保護法に基づき必要な情報提供・措置を実施します。
        </p>
        <p>対象国・提供先: 日本、米国、その他委託先が定める提供地域（詳細は個別のサービス仕様・契約条件に従います）</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">7. Cookie等の利用</h2>
        <p>当サービスは Cookie 等を使用します。</p>
        <ul className="list-disc pl-6">
          <li>ログイン状態の維持</li>
          <li>利便性向上</li>
          <li>不正利用対策のためのアクセス制御</li>
        </ul>
        <p>2026年3月22日時点で、Google Analytics等の第三者アクセス解析ツールは導入していません。</p>
        <p>導入時は、取得項目・利用目的・オプトアウト方法を本ポリシーへ追記します。</p>
        <p>Cookieの無効化はブラウザ設定で可能ですが、一部機能が利用できない場合があります。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">8. 安全管理措置</h2>
        <p>漏えい、滅失または毀損の防止その他安全管理のため、組織的・人的・物理的・技術的措置を講じます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">9. 開示等の請求</h2>
        <p>本人は、法令に基づき、保有個人データの利用目的通知、開示、訂正、追加、削除、利用停止、消去、第三者提供停止を請求できます。</p>
        <p>請求窓口: {LEGAL_NOTICE.contactEmail}（補助窓口: ログイン後サポートチケット）</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">10. 保存期間</h2>
        <p>
          個人情報は、利用目的達成に必要な期間または法令で定める期間保存し、不要となった場合は適切に削除します。
        </p>
        <ul className="list-disc pl-6">
          <li>アカウント情報: 契約期間中および退会後90日間</li>
          <li>予約・顧客・ペット・カルテ情報: 契約期間中および退会後90日間</li>
          <li>請求・取引情報: 法令上必要な期間（原則7年）</li>
          <li>アクセスログ・監査ログ: 12か月</li>
          <li>バックアップデータ: 30日で世代更新</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">11. 退会後のデータ取扱い</h2>
        <p>
          退会後、運用データは原則90日以内に削除します。バックアップ上のデータは次回世代更新時（最長30日）に削除されます。
          法令上保存義務がある情報は当該期間保存し、期間満了後に削除または匿名化します。
        </p>
        <p>削除依頼は {LEGAL_NOTICE.contactEmail} またはログイン後サポートチケットから受け付けます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">12. 改定</h2>
        <p>本ポリシーは、法令改正やサービス内容の変更に応じて改定する場合があります。改定後はWebサイト上で公表し、効力発生日を明示します。</p>
      </section>

      <p className="text-sm text-gray-700">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}
