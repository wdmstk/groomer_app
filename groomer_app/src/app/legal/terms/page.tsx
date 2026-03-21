import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function TermsPage() {
  return (
    <div className="space-y-6 text-base leading-8 text-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">利用規約</h1>
      <p>
        本利用規約（以下「本規約」）は、{LEGAL_NOTICE.operatorName}（以下「当運営者」）が提供する
        {LEGAL_NOTICE.serviceName}
        （以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意のうえ本サービスを利用するものとします。
      </p>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">1. 適用</h2>
        <p>本規約は、利用者と当運営者との間の本サービス利用に関わる一切の関係に適用されます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">2. アカウント管理</h2>
        <ul className="list-disc pl-6">
          <li>利用者は、自己の責任でアカウント情報を管理するものとします。</li>
          <li>アカウントの不正使用により生じた損害について、当運営者は故意または重過失がある場合を除き責任を負いません。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">3. 禁止事項</h2>
        <ul className="list-disc pl-6">
          <li>法令または公序良俗に反する行為</li>
          <li>不正アクセス、脆弱性探索、過度な負荷を与える行為</li>
          <li>第三者の権利侵害または名誉毀損行為</li>
          <li>本サービス運営を妨害する行為</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">4. 料金・支払</h2>
        <p>有料プランの料金、課金方式（月額課金／買い切り）、支払時期は、別途定める料金ページのとおりとします。</p>
        <p>月額課金および年額課金は、契約期間満了時に利用者による停止手続がない限り自動更新されます。</p>
        <p>既払料金は、法令上必要な場合を除き返金しません。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. サービス変更・停止</h2>
        <p>当運営者は、保守、障害対応、その他運用上の理由により、本サービスの全部または一部を変更・中断・終了できるものとします。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">6. 予約・施術トラブルの責任分界</h2>
        <p>
          当運営者は、利用者と第三者（飼い主等）との間で生じた予約、施術、料金、返金、キャンセル、遅刻、無断キャンセル、
          ダブルブッキング等の紛争について、当運営者の故意または重過失がある場合を除き責任を負いません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">7. ユーザーデータと写真・動画の権利</h2>
        <p>
          利用者が本サービスに登録・保存した写真、動画、文章その他のデータの権利は、利用者または正当な権利者に留保されます。
          利用者は、当運営者に対し、本サービス提供、保守、障害対応、不正利用対策、品質改善のために必要な範囲で当該データを利用する
          非独占的な利用権を許諾するものとします。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">8. 知的財産権</h2>
        <p>本サービスに関する著作権その他の知的財産権は、当運営者または正当な権利者に帰属します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">9. 免責</h2>
        <p>当運営者は、本サービスが特定目的への適合性、完全性、継続性を有することを保証しません。</p>
        <p>
          決済代行会社、クラウド基盤、通信事業者その他第三者サービスの障害、停止、仕様変更に起因して本サービスの全部または一部が
          利用不能となった場合、当運営者の故意または重過失がある場合を除き責任を負いません。
        </p>
        <p>
          当運営者の責任は、当運営者の故意または重過失による場合を除き、利用者に現実に生じた通常損害に限られ、かつ当該損害発生月以前1か月分の利用料金相当額を上限とします。
        </p>
        <p>消費者契約法その他の法令により制限される場合、本条は当該法令に従います。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">10. 利用制限・停止・異議申立て</h2>
        <p>
          当運営者は、規約違反、不正利用、料金未払、セキュリティ上の懸念がある場合に、事前通知なく利用制限またはアカウント停止を行うことがあります。
          利用者は、通知日から7日以内に、サポート窓口へ異議申立てができます。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">11. 規約変更</h2>
        <p>当運営者は、必要に応じて本規約を変更できます。変更後の規約は本サービス上に表示した時点で効力を生じます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">12. 準拠法・裁判管轄</h2>
        <p>
          本規約は日本法に準拠し、本サービスに関して紛争が生じた場合、東京地方裁判所または東京簡易裁判所を第一審の専属的合意管轄裁判所とします。ただし、法令に別段の定めがある場合はこの限りではありません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">13. お問い合わせ</h2>
        <p>事業者名: {LEGAL_NOTICE.operatorName}</p>
        <p>メールアドレス: {LEGAL_NOTICE.contactEmail}</p>
      </section>

      <p className="text-sm text-gray-700">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}
