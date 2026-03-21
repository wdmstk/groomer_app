import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function TokushoPage() {
  return (
    <div className="space-y-6 text-base leading-8 text-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">特定商取引法に基づく表記</h1>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">販売事業者</h2>
        <p>{LEGAL_NOTICE.operatorName}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">運営統括責任者</h2>
        <p>＜ここに入力（本名を推奨）＞</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">所在地</h2>
        <p>
          ※事業者の住所については、個人情報保護および安全管理のため、Webサイト上では非公開としております。住所の開示が必要な場合は、下記お問い合わせ窓口よりご請求ください。請求を受けた場合、遅滞なく開示いたします。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">お問い合わせ窓口</h2>
        <p>メールアドレス: {LEGAL_NOTICE.contactEmail}</p>
        <p>お問い合わせフォーム: ログイン後サポートチケット（/support-tickets）</p>
        <p>電話番号: 請求があった場合に遅滞なく開示いたします</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">販売価格</h2>
        <p>料金ページ（/lp）に表示する金額のとおりです。主な価格は以下のとおりです。</p>
        <ul className="list-disc pl-6">
          <li>ライト: 月額 2,480円 / 年額 25,296円</li>
          <li>スタンダード: 月額 3,980円 / 年額 40,596円</li>
          <li>プロ: 月額 7,980円 / 年額 81,396円</li>
          <li>2店舗目以降（追加店舗）: 各プランの追加店舗価格を適用</li>
          <li>容量追加: 10GBあたり 300円/月</li>
          <li>初期設定代行（単発）: 19,800円</li>
        </ul>
        <p>※ 上記は 2026年3月17日 時点の表示です。最新価格は料金ページを優先します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">商品代金以外の必要料金</h2>
        <ul className="list-disc pl-6">
          <li>インターネット接続料金・通信料金（利用者負担）</li>
          <li>銀行振込手数料（銀行振込を選択した場合）</li>
          <li>必要に応じてオプション利用料（料金ページ記載）</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">支払方法・支払時期</h2>
        <ul className="list-disc pl-6">
          <li>クレジットカード決済（Stripe）</li>
          <li>KOMOJU経由の決済手段（契約設定に応じる）</li>
          <li>月額課金: 申込時に初回決済、以後は契約更新日に自動決済</li>
          <li>年額課金: 申込時に決済、以後は1年ごとの更新日に自動決済</li>
          <li>単発売切（該当機能がある場合）: 購入手続完了時</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">役務の提供時期</h2>
        <p>アカウント登録および決済確認後、直ちに利用可能（メンテナンス時を除く）</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">返品・キャンセル・解約</h2>
        <p>
          デジタルサービスの性質上、サービス提供開始後の返品・返金は原則として受け付けません。ただし、二重課金、当社起因の重複請求、
          法令上返金義務がある場合は返金対応します。返金申請は請求日から30日以内に受け付けます。
        </p>
        <p className="mt-2">
          月額・年額プランの解約は、ログイン後に「決済管理（`/billing`） {'>'} 運用操作 {'>'} 期間終了で解約」を実行し、
          次回更新日の前日23:59までに手続を完了することで次回更新以降の課金停止となります。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">動作環境</h2>
        <p>最新版の主要ブラウザ（Google Chrome / Safari / Microsoft Edge / Firefox）を推奨します。</p>
      </section>

      <p className="text-sm text-gray-700">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}
