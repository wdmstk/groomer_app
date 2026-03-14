import { LEGAL_NOTICE } from '@/app/legal/legal-notice'

export default function SecurityPolicyPage() {
  return (
    <div className="space-y-5 text-sm leading-7 text-slate-700 sm:text-base">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">セキュリティポリシー</h1>
      <p>
        {LEGAL_NOTICE.operatorName}は、{LEGAL_NOTICE.serviceName}
        の情報資産を保護するため、以下の方針に基づきセキュリティ対策を実施します。
      </p>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">1. 管理体制</h2>
        <p>情報セキュリティ責任者を定め、リスク評価、対策実施、見直しを継続的に行います。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">2. アクセス制御</h2>
        <p>業務上必要な最小権限に基づくアクセス制御を実施し、認証情報の適切な管理を徹底します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">3. データ保護</h2>
        <p>通信経路の暗号化、保存データの保護、バックアップ運用により、情報漏えい・改ざん・消失リスクを低減します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">4. 脆弱性対策</h2>
        <p>ソフトウェア更新、脆弱性情報の監視、設定見直しを行い、既知の脅威に対する防御を継続します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">5. 監視とログ管理</h2>
        <p>アクセスログや操作ログを適切に記録し、不審な挙動の検知および追跡可能性を確保します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">6. インシデント対応</h2>
        <p>セキュリティインシデント発生時は、被害拡大防止、原因調査、再発防止を迅速に実施し、必要に応じて関係者へ通知します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">7. 外部委託先管理</h2>
        <p>外部サービス・委託先の選定時に安全性を確認し、必要な契約・管理措置を講じます。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">8. 継続的改善</h2>
        <p>法令、技術動向、事故例を踏まえ、セキュリティ対策を継続的に見直し改善します。</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">9. お問い合わせ窓口</h2>
        <p>事業者名: {LEGAL_NOTICE.operatorName}</p>
        <p>メールアドレス: {LEGAL_NOTICE.contactEmail}</p>
      </section>

      <p className="text-xs text-slate-500">最終更新日: {LEGAL_NOTICE.lastUpdated}</p>
    </div>
  )
}

