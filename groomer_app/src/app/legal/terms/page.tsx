import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function TermsPage() {
  return (
    <div className="space-y-5 text-sm leading-7 text-slate-700 sm:text-base">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">利用規約</h1>
      <p>
        本利用規約（以下「本規約」）は、{LEGAL_NOTICE.operatorName}（以下「当運営者」）が提供する
        {LEGAL_NOTICE.serviceName}
        （以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意のうえ本サービスを利用するものとします。
      </p>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. 適用</h2>
        <p>本規約は、利用者と当運営者との間の本サービス利用に関わる一切の関係に適用されます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. アカウント管理</h2>
        <ul className="list-disc pl-6">
          <li>利用者は、自己の責任でアカウント情報を管理するものとします。</li>
          <li>アカウントの不正使用により生じた損害について、当運営者は故意または重過失がある場合を除き責任を負いません。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. 禁止事項</h2>
        <ul className="list-disc pl-6">
          <li>法令または公序良俗に反する行為</li>
          <li>不正アクセス、脆弱性探索、過度な負荷を与える行為</li>
          <li>第三者の権利侵害または名誉毀損行為</li>
          <li>本サービス運営を妨害する行為</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. 料金と支払い</h2>
        <p>有料機能の料金、課金方法、更新条件は本サービス上に表示する内容に従います。利用者は定められた期日までに支払うものとします。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. サービス変更・停止</h2>
        <p>当運営者は、保守、障害対応、その他運用上の理由により、本サービスの全部または一部を変更・中断・終了できるものとします。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. 知的財産権</h2>
        <p>本サービスに関する著作権その他の知的財産権は、当運営者または正当な権利者に帰属します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. 免責</h2>
        <p>当運営者は、本サービスの完全性、正確性、継続性を保証するものではありません。利用者に生じた損害について、当運営者の故意または重過失がある場合を除き責任を負いません。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">8. 規約変更</h2>
        <p>当運営者は、必要に応じて本規約を変更できます。変更後の規約は本サービス上に表示した時点で効力を生じます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">9. 準拠法・裁判管轄</h2>
        <p>本規約は日本法に準拠し、本サービスに関して紛争が生じた場合、当運営者所在地を管轄する裁判所を第一審の専属的合意管轄とします。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">10. お問い合わせ</h2>
        <p>事業者名: {LEGAL_NOTICE.operatorName}</p>
        <p>メールアドレス: {LEGAL_NOTICE.contactEmail}</p>
      </section>

      <p className="text-xs text-slate-500">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}

