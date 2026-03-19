import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function SecurityPolicyPage() {
  return (
    <div className="space-y-6 text-base leading-8 text-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">セキュリティ説明書（企業向け）</h1>
      <p>
        本書は、{LEGAL_NOTICE.operatorName}が提供するSaaS「{LEGAL_NOTICE.serviceName}
        」の情報セキュリティ管理体制を説明するものです。
      </p>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">1. 対象サービス</h2>
        <ul className="list-disc pl-6">
          <li>サービス名: {LEGAL_NOTICE.serviceName}</li>
          <li>提供形態: Webアプリ（SaaS）</li>
          <li>主な取扱情報: アカウント情報、予約情報、顧客情報、ペット情報、会計情報、カルテ情報、通知ログ、アクセスログ</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">2. データ保存場所</h2>
        <ul className="list-disc pl-6">
          <li>利用クラウド事業者: Supabase（認証・DB・ストレージ）、Vercel（アプリ配信基盤）</li>
          <li>保存リージョン（国・地域）: ＜ここに入力＞（Supabaseプロジェクト設定およびホスティング設定に従う）</li>
          <li>本番／バックアップの保存先: ＜ここに入力＞</li>
          <li>データ越境有無: あり（利用する外部サービスの提供地域に応じる）</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">3. バックアップ</h2>
        <ul className="list-disc pl-6">
          <li>バックアップ対象: DB・ストレージ内の本番データ、運用ログ</li>
          <li>取得頻度: 日次</li>
          <li>保持期間: 30日</li>
          <li>復旧目標（RPO/RTO）: RPO 24時間 / RTO 72時間</li>
          <li>復元テスト実施頻度: 四半期ごと（推奨）</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">4. 通信暗号化</h2>
        <ul className="list-disc pl-6">
          <li>外部通信: TLS（HTTPS）を使用</li>
          <li>管理画面・API通信: HTTPS経由で提供</li>
          <li>証明書管理方法: ホスティング基盤における証明書管理機能を利用（詳細: ＜ここに入力＞）</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">5. アクセス権限</h2>
        <ul className="list-disc pl-6">
          <li>権限管理方式: ロールベース（owner/admin/staff）および店舗スコープ制御</li>
          <li>管理者アカウント管理: Supabase Authを利用し、必要に応じて管理者権限を付与</li>
          <li>多要素認証（MFA）: ＜ここに入力＞</li>
          <li>退職・異動時の権限剥奪手順: ＜ここに入力＞</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">6. ログ管理</h2>
        <ul className="list-disc pl-6">
          <li>取得ログ: アクセスログ、認証ログ、操作ログ、エラーログ、監査ログ（audit_logs）、CSPレポート（security_csp_reports）等</li>
          <li>保存期間: ＜ここに入力＞</li>
          <li>改ざん防止策: ＜ここに入力＞</li>
          <li>監視・アラート: ＜ここに入力＞</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">7. 障害時対応</h2>
        <ul className="list-disc pl-6">
          <li>障害検知方法: ＜ここに入力＞</li>
          <li>初動対応フロー: ＜ここに入力＞</li>
          <li>影響調査・復旧手順: ＜ここに入力＞</li>
          <li>顧客通知方針（通知基準・期限）: ＜ここに入力＞</li>
          <li>再発防止策の実施方法: ＜ここに入力＞</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">8. 個人情報の取り扱い</h2>
        <ul className="list-disc pl-6">
          <li>個人情報保護法および関連法令を遵守</li>
          <li>取得目的の明確化と目的外利用の禁止</li>
          <li>第三者提供は法令上許容される場合または本人同意取得時に限定</li>
          <li>委託先管理および安全管理措置の実施</li>
          <li>詳細はプライバシーポリシー（/legal/privacy）を参照</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">9. 脆弱性・セキュリティ運用</h2>
        <ul className="list-disc pl-6">
          <li>OS・ミドルウェア・ライブラリのアップデート方針: 定期的な依存関係更新およびセキュリティパッチ適用</li>
          <li>脆弱性情報の収集元: 公開脆弱性情報（CVE等）、利用サービス提供元のアドバイザリ</li>
          <li>定期的な点検・診断: ＜ここに入力＞</li>
          <li>インシデント記録・是正管理: ＜ここに入力＞</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">10. お問い合わせ窓口</h2>
        <p>セキュリティ連絡先: {LEGAL_NOTICE.contactEmail}</p>
        <p>受付時間・対応言語: 平日10:00-18:00（日本時間） / 日本語</p>
      </section>

      <p className="text-sm text-gray-700">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}
