import Image from 'next/image'
import Link from 'next/link'

type PlanKey = 'light' | 'standard' | 'pro'

type PlanCard = {
  id: PlanKey
  name: string
  subtitle: string
  summary: string
  highlights: string[]
}

type PriceRow = {
  plan: string
  monthly: string
  yearly: string
  additionalMonthly: string
  additionalYearly: string
}

type PlanFeatureRow = {
  feature: string
  light: string
  standard: string
  pro: string
}

type CompetitorRow = {
  axis: string
  service: string
  companyA: string
  companyB: string
}

type AdditionalOptionRow = {
  option: string
  price: string
  target: string
  detail: string
}

type AiFeatureCard = {
  plan: string
  catchcopy: string
  actions: string[]
  output: string
}

type BillingTermRow = {
  item: string
  detail: string
}

type PainPoint = {
  title: string
  detail: string
}

type OnboardingStep = {
  step: string
  title: string
  detail: string
}

const PLAN_STAFF_SHIFT_ITEMS: Record<PlanKey, string[]> = {
  light: ['勤怠打刻', '勤務実績確認'],
  standard: ['勤怠管理', 'シフト管理（手動作成）', 'シフト自動生成（ルールベース、予約考慮）'],
  pro: ['シフト最適化', 'シフト定期自動生成'],
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: 'light',
    name: 'ライト',
    subtitle: 'まずは現場を止めない最小構成',
    summary: '予約・顧客・写真カルテ・スマホ当日運用を低コストで開始。',
    highlights: ['予約管理', '顧客管理', '多頭飼い管理', '写真カルテ', '当日運用（スマホ完結）'],
  },
  {
    id: 'standard',
    name: 'スタンダード',
    subtitle: '現場の運用を安定化する主力プラン',
    summary: 'ライトに在庫・通知ログ・再販機能を加え、毎日の運用を整える。',
    highlights: ['在庫管理', '通知ログ', '空き枠再販（半自動）', 'LINE通知'],
  },
  {
    id: 'pro',
    name: 'プロ',
    subtitle: '多店舗統制と改善を進める上位プラン',
    summary: 'スタンダードの全機能に、監査・本部運用・予兆アラート高度化を追加。',
    highlights: ['監査ログ', '本部KPI', 'テンプレ配信/承認フロー', '予兆アラート高度化'],
  },
]

const PRICE_ROWS: PriceRow[] = [
  {
    plan: 'ライト',
    monthly: '2,480円',
    yearly: '25,296円',
    additionalMonthly: '1,984円',
    additionalYearly: '20,237円',
  },
  {
    plan: 'スタンダード',
    monthly: '3,980円',
    yearly: '40,596円',
    additionalMonthly: '3,184円',
    additionalYearly: '32,477円',
  },
  {
    plan: 'プロ',
    monthly: '7,980円',
    yearly: '81,396円',
    additionalMonthly: '6,384円',
    additionalYearly: '65,117円',
  },
]

const PLAN_FEATURE_ROWS: PlanFeatureRow[] = [
  { feature: '予約管理', light: '○', standard: '○', pro: '○' },
  { feature: '顧客管理', light: '○', standard: '○', pro: '○' },
  { feature: '多頭飼い管理', light: '○', standard: '○', pro: '○' },
  { feature: '写真カルテ', light: '○', standard: '○', pro: '○' },
  { feature: '動画カルテ（写真+動画タイムライン）', light: '○', standard: '○', pro: '○' },
  { feature: '当日運用（スマホ完結）', light: '○', standard: '○', pro: '○' },
  { feature: 'AI Assist（オプション）', light: '○', standard: '○', pro: '○' },
  { feature: 'AI Pro（オプション）', light: '○', standard: '○', pro: '○' },
  { feature: 'AI Pro+（オプション）', light: '○', standard: '○', pro: '○' },
  { feature: 'ペットホテル予約機能（オプション）', light: '-', standard: '○', pro: '○' },
  { feature: '在庫管理', light: '-', standard: '○', pro: '○' },
  { feature: '通知ログ', light: '-', standard: '○', pro: '○' },
  { feature: '空き枠再販（半自動）', light: '-', standard: '○', pro: '○' },
  { feature: 'LINE通知', light: '-', standard: '○', pro: '○' },
  { feature: '勤怠打刻（出勤/退勤/休憩）', light: '○', standard: '○', pro: '○' },
  { feature: '勤怠管理（確認・申請）', light: '○', standard: '○', pro: '○' },
  { feature: 'シフト管理', light: '-', standard: '○', pro: '○' },
  { feature: 'シフト自動生成（ルールベース、予約考慮）', light: '-', standard: '○', pro: '○' },
  { feature: 'シフト最適化', light: '-', standard: '-', pro: '○' },
  { feature: 'シフト定期自動生成', light: '-', standard: '-', pro: '○' },
  { feature: '監査ログ', light: '-', standard: '-', pro: '○' },
  { feature: '本部KPI', light: '-', standard: '-', pro: '○' },
  { feature: 'テンプレ配信・承認フロー', light: '-', standard: '-', pro: '○' },
  { feature: '予兆アラート高度化', light: '-', standard: '-', pro: '○' },
]

const COMPETITOR_ROWS: CompetitorRow[] = [
  { axis: '写真カルテの時系列管理', service: '◎', companyA: '△', companyB: '△' },
  { axis: '動画カルテ×AI一体運用', service: '◎', companyA: '△', companyB: '×' },
  { axis: '空き枠再販（半自動運用）', service: '◎', companyA: '△', companyB: '×' },
  { axis: 'LINE通知', service: '◎', companyA: '○', companyB: '△' },
  { axis: '当日運用のスマホ完結', service: '◎', companyA: '△', companyB: '○' },
  { axis: '多頭飼い管理', service: '◎', companyA: '○', companyB: '△' },
  { axis: '本部機能（KPI/配信/承認）', service: '○', companyA: '△', companyB: '×' },
  { axis: '監査ログ', service: '○', companyA: '△', companyB: '×' },
  { axis: '価格の始めやすさ', service: '◎', companyA: '○', companyB: '○' },
]

const STORAGE_ROWS = [
  { plan: 'ライト', included: '5GB', addon: '10GBあたり 300円/月' },
  { plan: 'スタンダード', included: '10GB', addon: '10GBあたり 300円/月' },
  { plan: 'プロ', included: '20GB', addon: '10GBあたり 300円/月' },
]

const STORAGE_ADDON_EXAMPLES = [
  { extra: '30GB', monthly: '900円/月' },
  { extra: '100GB', monthly: '3,000円/月' },
]

const ADDITIONAL_OPTION_ROWS: AdditionalOptionRow[] = [
  {
    option: 'AI Assist',
    price: '1,280円/月',
    target: '全プラン',
    detail: '自動サムネ・タグ・カルテ文・ショート動画生成',
  },
  {
    option: 'AI Pro',
    price: '1,980円/月',
    target: '全プラン',
    detail: 'AI Assist＋ 性格/行動分析、施術時間・追加料金の予測提案',
  },
  {
    option: 'AI Pro+',
    price: '2,480円/月',
    target: '全プラン',
    detail: 'AI Pro＋ 健康異常の気づき、月次レポート、教育ハイライト生成',
  },
  {
    option: 'ペットホテル予約機能',
    price: '1,500円/月',
    target: 'スタンダード / プロ',
    detail: 'ペットホテル予約機能の有効化',
  },
  {
    option: '通知強化',
    price: '500円/月',
    target: 'スタンダード / プロ',
    detail: '月次通知上限を 1,000通 から 3,000通 へ拡張',
  },
  {
    option: '初期設定代行（単発）',
    price: '19,800円',
    target: '全プラン',
    detail: '店舗情報・メニュー・初期設定の代行',
  },
  {
    option: '容量追加',
    price: '10GBあたり 300円/月',
    target: '全プラン',
    detail: '必要な容量だけ追加購入（10GB単位）',
  },
]

const AI_FEATURE_CARDS: AiFeatureCard[] = [
  {
    plan: 'AI Assist',
    catchcopy: '記録を速く、抜け漏れを減らす',
    actions: ['自動サムネイル生成', 'AIタグ付け', 'カルテ文の下書き生成', 'ショート動画生成'],
    output: 'スタッフの記録時間を短縮し、共有しやすいカルテを作成',
  },
  {
    plan: 'AI Pro',
    catchcopy: '次回提案の精度を高める',
    actions: ['性格/行動分析', '施術時間の予測提案', '毛玉リスクの提案', '追加料金リスクの提案'],
    output: '提案値をもとに、説明しやすい見積り・提案を実現',
  },
  {
    plan: 'AI Pro+',
    catchcopy: '継続改善と教育に活かす',
    actions: ['健康異常の気づき表示', '月次レポート生成', '教育用ハイライト生成'],
    output: '店舗全体の運用品質を可視化し、改善サイクルを回しやすくする',
  },
]

const BILLING_TERM_ROWS: BillingTermRow[] = [
  {
    item: '更新ルール',
    detail: '月額・年額プランは、停止手続きがない限り自動更新されます。',
  },
  {
    item: '解約締切',
    detail: '次回更新日の前日23:59（日本時間）までに手続きすると、次回更新以降の課金が停止されます。',
  },
  {
    item: '返金ポリシー',
    detail: 'デジタルサービスの性質上、提供開始後の返金は原則不可です。',
  },
  {
    item: '返金例外',
    detail: '二重課金・当社起因の重複請求・法令上返金義務がある場合は返金対応します（請求日から30日以内に申請）。',
  },
  {
    item: '課金タイミング',
    detail: '申込時に初回決済。以後は契約日基準で自動決済されます（毎月同日 / 毎年同日）。',
  },
  {
    item: '契約条件の確認先',
    detail: '詳細条文は「利用規約」「特定商取引法に基づく表記」をご確認ください。',
  },
]

const PAIN_POINTS: PainPoint[] = [
  {
    title: '予約対応が電話・LINE・紙で分散',
    detail: '対応履歴が分かれ、引き継ぎや折返しの漏れが発生しやすい状態を解消します。',
  },
  {
    title: 'カルテ記録に時間がかかる',
    detail: '写真と動画を同じ時系列で扱い、AI補助で記録の負担を下げます。',
  },
  {
    title: 'キャンセル枠の再販が追いつかない',
    detail: '空き枠再販と通知導線で、機会損失を抑える運用を組み込みます。',
  },
  {
    title: '会計・在庫・監査が分断',
    detail: '日次運用の数字を一本化し、店舗運用と本部管理の両方で確認しやすくします。',
  },
]

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 'STEP 1',
    title: '無料トライアル開始',
    detail: '店舗情報と基本設定を登録し、現場端末でそのまま使い始めます。',
  },
  {
    step: 'STEP 2',
    title: '既存データ取り込み',
    detail: '顧客・ペット・メニューを移行し、予約/カルテ運用へ切り替えます。',
  },
  {
    step: 'STEP 3',
    title: '本運用と改善',
    detail: '通知・再販・AI活用を段階的に有効化し、運用指標を改善します。',
  },
]

function planCardClass(planId: PlanKey): string {
  if (planId === 'pro') return 'border-slate-900 bg-slate-900 text-white shadow-xl'
  if (planId === 'standard') return 'border-sky-200 bg-white text-slate-900 shadow-lg'
  return 'border-slate-200 bg-white text-slate-900 shadow-sm'
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_#f8fafc_45%,_#ffffff_100%)] text-slate-900">
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
          <p className="mb-3 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-wide text-sky-700">
            ペットサロン向け業務SaaS
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            写真だけで終わらない。
            <br className="hidden sm:block" />
            動画カルテ×AIで、提案までつながる
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            最安ではなく、ペットサロン業務に必要な機能をまとめて提供。写真+動画カルテ、空き枠再販、LINE通知、AI Assist/Pro/Pro+による提案支援、当日運用まで一体で使えます。
          </p>
        </header>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold sm:text-2xl">こんな課題をまとめて解消</h2>
          <p className="mt-2 text-sm text-slate-600">
            予約・カルテ・会計・通知を分断せず、現場運用を一つの流れで回せるように設計しています。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {PAIN_POINTS.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold sm:text-2xl">カルテ＋AIでできること</h2>
          <p className="mt-2 text-sm text-slate-600">
            動画カルテを土台に、AIが「記録」「予測」「改善」を段階的に支援します。AI結果は提案として扱い、手入力運用も併用できます。
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {AI_FEATURE_CARDS.map((item) => (
              <article key={item.plan} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold tracking-wide text-sky-700">{item.plan}</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{item.catchcopy}</h3>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {item.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs font-medium text-slate-600">{item.output}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            ※ AIの分析は業務支援のための提案です。医療判断を行うものではありません。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold sm:text-2xl">カルテ＋AIを支える実運用画面</h2>
          <p className="mt-1 text-sm text-slate-600">カルテ画面とAI運用画面を中心に、実際の操作画面で確認できます。</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src="/lp/medical-records-list.png"
                alt="カルテ一覧の実画面"
                width={640}
                height={360}
                className="h-40 w-full object-cover object-top"
              />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">カルテ一覧（写真＋動画）</h3>
            <p className="mt-1 text-sm text-slate-700">施術記録を一覧化し、次回来店時の確認と引き継ぎをスムーズにします。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src="/lp/medical-records-ai-filter.png"
                alt="カルテのAI解析絞り込み画面"
                width={640}
                height={360}
                className="h-40 w-full object-cover object-top"
              />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">AI解析ステータス管理</h3>
            <p className="mt-1 text-sm text-slate-700">AIタグや解析状態で絞り込み、要確認カルテを優先して確認できます。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src="/lp/medical-records-modal.png"
                alt="カルテ新規作成モーダルの実画面"
                width={640}
                height={360}
                className="h-40 w-full object-cover object-top"
              />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">カルテ作成（動画導線あり）</h3>
            <p className="mt-1 text-sm text-slate-700">施術前・施術後・施術動画の3導線を1画面で扱い、記録漏れを減らします。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src="/lp/billing-ai-plan.png"
                alt="AIプラン切替を含む課金管理画面"
                width={640}
                height={360}
                className="h-40 w-full object-cover object-top"
              />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">AIプラン運用</h3>
            <p className="mt-1 text-sm text-slate-700">AI Assist/Pro/Pro+の契約状態を確認し、店舗運用に合わせて切替できます。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src="/lp/dashboard-followups.png"
                alt="再来店フォローと予兆一覧の管理画面"
                width={640}
                height={360}
                className="h-40 w-full object-cover object-top"
              />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">再来店フォローと予兆</h3>
            <p className="mt-1 text-sm text-slate-700">AIで優先顧客と対応状況を一覧化し、見落としを減らす運用を支援します。</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src="/lp/hotel-list.png"
                alt="ペットホテル台帳の一覧画面"
                width={1280}
                height={360}
                className="h-40 w-full object-cover object-top"
              />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">ホテル連携運用</h3>
            <p className="mt-1 text-sm text-slate-700">ホテル台帳とも連携し、カルテ・予約・会計を分断せずに店舗全体で運用できます。</p>
          </article>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 sm:grid-cols-3 sm:px-6 lg:px-8">
        {PLAN_CARDS.map((plan) => (
          <article key={plan.id} className={`rounded-2xl border p-6 ${planCardClass(plan.id)}`}>
            <p className="text-xs font-semibold tracking-widest opacity-70">{plan.name}</p>
            <h2 className="mt-2 text-xl font-bold">{plan.subtitle}</h2>
            <p className="mt-3 text-sm opacity-90">{plan.summary}</p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
              {plan.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {PLAN_STAFF_SHIFT_ITEMS[plan.id].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">価格表</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">プラン</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">月額（1店舗）</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">年額（15%OFF）</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">2店舗目以降（月額）</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">2店舗目以降（年額）</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_ROWS.map((row) => (
                  <tr key={row.plan} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2 font-medium text-slate-900">{row.plan}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.monthly}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.yearly}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.additionalMonthly}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.additionalYearly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">追加オプション</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">オプション</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">料金</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">対象プラン</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">内容</th>
                </tr>
              </thead>
              <tbody>
                {ADDITIONAL_OPTION_ROWS.map((row) => (
                  <tr key={row.option} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2 font-medium text-slate-900">{row.option}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.price}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.target}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">※ AIプランは全プランで追加可能です。ペットホテル予約機能と通知強化は、スタンダード/プロで利用できます。</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">プラン比較</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">機能</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-center font-semibold">ライト</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-center font-semibold">スタンダード</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-center font-semibold">プロ</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURE_ROWS.map((row) => (
                  <tr key={row.feature} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.feature}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center">{row.light}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center">{row.standard}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm font-medium text-sky-700">スタンダードが最も選ばれています。</p>
          <p className="mt-1 text-xs text-slate-500">※「オプション」表記の機能は別料金で追加できます。</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">カルテ写真・動画の保存容量と追加容量課金</h2>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              写真カルテ・動画カルテの保存に使う容量は、プランごとに標準で含まれています。必要な分だけ追加できるので、容量不足の不安を抑えながら運用できます。
            </p>
            <p>
              写真中心の店舗は標準容量で十分に運用しやすく、動画を多く使う店舗だけが自然に追加課金するシンプルな仕組みです。
            </p>
            <p>容量と追加課金は店舗ごとに管理されるため、多店舗運用でも管理しやすい設計です。</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">プラン</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">標準容量</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">追加容量料金</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ROWS.map((row) => (
                  <tr key={row.plan} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2 font-medium text-slate-900">{row.plan}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.included}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.addon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">追加例</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">追加料金</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ADDON_EXAMPLES.map((row) => (
                  <tr key={row.extra} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.extra}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>動画カルテを使うほど、施術記録の価値が積み上がる</li>
            <li>プロは標準容量が大きく、追加課金が発生しにくい</li>
            <li>写真中心の店舗は、追加料金ゼロで十分に運用しやすい</li>
            <li>10GBあたり300円/月の分かりやすい価格設定</li>
          </ul>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">FAQ</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div>
                <p className="font-medium text-slate-900">Q. 容量が足りなくなったらどうなりますか？</p>
                <p className="mt-1">A. 追加容量を購入すると、自動で容量が反映されます。</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Q. 追加容量はいつでも変更できますか？</p>
                <p className="mt-1">A. はい。店舗の運用に合わせて、必要な分だけ増やせます（店舗ごとに管理されます）。</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Q. 動画を使わない場合は追加料金はかかりますか？</p>
                <p className="mt-1">A. かかりません。標準容量の範囲内なら追加料金は不要です。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">解約・請求条件（重要）</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">項目</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">内容</th>
                </tr>
              </thead>
              <tbody>
                {BILLING_TERM_ROWS.map((row) => (
                  <tr key={row.item} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2 font-medium text-slate-900">{row.item}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            最新の契約条件は
            {' '}
            <Link href="/legal/terms" className="underline hover:text-slate-700">
              利用規約
            </Link>
            ・
            <Link href="/legal/tokusho" className="underline hover:text-slate-700">
              特定商取引法に基づく表記
            </Link>
            を優先します。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">業務特化で選ばれる理由</h2>
          <ul className="list-disc space-y-3 pl-5 text-sm text-slate-700">
            <li>写真と動画を同じカルテ時系列で管理でき、引き継ぎの解像度を上げやすい</li>
            <li>AI Assist/Pro/Pro+で、タグ付け・要点整理・提案づくりを段階的に強化できる</li>
            <li>写真カルテを時系列で管理でき、次回来店時の引き継ぎがしやすい</li>
            <li>空き枠再販（半自動）でキャンセル枠の機会損失を減らせる</li>
            <li>LINE通知を業務に組み込み、連絡の抜け漏れを抑えやすい</li>
            <li>当日運用をスマホで完結し、現場での操作負担を下げられる</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">競合比較（本サービス vs A社 vs B社）</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-2.5 py-2 font-semibold">比較項目</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-center font-semibold">本サービス</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-center font-semibold">A社</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-center font-semibold">B社</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_ROWS.map((row) => (
                  <tr key={row.axis} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-2.5 py-2">{row.axis}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center font-semibold text-sky-700">{row.service}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center">{row.companyA}</td>
                    <td className="border-b border-slate-100 px-2.5 py-2 text-center">{row.companyB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">導入までの流れ</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {ONBOARDING_STEPS.map((item) => (
              <article key={item.step} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold tracking-wide text-sky-700">{item.step}</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">導入オファー</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>30日無料（初月無料）</li>
            <li>初期設定代行（19,800円）</li>
            <li>乗り換えサポート（データ移行）</li>
            <li>紹介制度（紹介者1ヶ月無料）</li>
          </ul>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">
            <p>
              無料トライアル終了日の翌日 0:00（日本時間）に、選択プランの料金で自動課金されます。
              継続を希望しない場合は、終了日前日 23:59 までに解約手続を完了してください。
            </p>
            <p className="mt-2">
              請求は初回決済日を起算日とする契約日基準（毎月同日 / 毎年同日）です。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white sm:p-10">
          <h2 className="text-2xl font-bold sm:text-3xl">まずは現場で使って確認してください</h2>
          <p className="mt-3 text-sm text-slate-200 sm:text-base">
            導入のしやすさと現場フィットを、無料期間でそのまま確認できます。動画カルテとAI提案の使い勝手まで、実運用でお試しください。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200">
              まずは30日無料で試す
            </Link>
            <Link href="/signup" className="rounded-xl border border-slate-500 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-300">
              初期設定を代行してすぐに運用開始
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-300">
            お申し込み前に
            {' '}
            <Link href="/legal/terms" className="underline hover:text-white">
              利用規約
            </Link>
            ・
            <Link href="/legal/privacy" className="underline hover:text-white">
              プライバシーポリシー
            </Link>
            ・
            <Link href="/legal/tokusho" className="underline hover:text-white">
              特定商取引法に基づく表記
            </Link>
            をご確認ください。
          </p>
        </div>
      </section>

    </main>
  )
}
