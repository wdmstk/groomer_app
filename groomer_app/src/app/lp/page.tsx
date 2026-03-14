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
  { feature: '当日運用（スマホ完結）', light: '○', standard: '○', pro: '○' },
  { feature: '在庫管理', light: '-', standard: '○', pro: '○' },
  { feature: '通知ログ', light: '-', standard: '○', pro: '○' },
  { feature: '空き枠再販（半自動）', light: '-', standard: '○', pro: '○' },
  { feature: 'LINE通知', light: '-', standard: '○', pro: '○' },
  { feature: '監査ログ', light: '-', standard: '-', pro: '○' },
  { feature: '本部KPI', light: '-', standard: '-', pro: '○' },
  { feature: 'テンプレ配信・承認フロー', light: '-', standard: '-', pro: '○' },
  { feature: '予兆アラート高度化', light: '-', standard: '-', pro: '○' },
]

const COMPETITOR_ROWS: CompetitorRow[] = [
  { axis: '写真カルテの時系列管理', service: '◎', companyA: '△', companyB: '△' },
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
            スマホで回る。すぐ使える。
            <br className="hidden sm:block" />
            現場に合わせた3プラン
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            最安ではなく、ペットサロン業務に必要な機能をまとめて提供。写真カルテ、空き枠再販、LINE通知、当日運用まで一体で使えます。
          </p>
        </header>
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
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">プラン</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">月額（1店舗）</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">年額（15%OFF）</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">2店舗目以降（月額）</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">2店舗目以降（年額）</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_ROWS.map((row) => (
                  <tr key={row.plan} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">{row.plan}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.monthly}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.yearly}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.additionalMonthly}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.additionalYearly}</td>
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
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">オプション</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">料金</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">対象プラン</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">内容</th>
                </tr>
              </thead>
              <tbody>
                {ADDITIONAL_OPTION_ROWS.map((row) => (
                  <tr key={row.option} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">{row.option}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.price}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.target}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">※ ペットホテル予約機能と通知強化は、スタンダード/プロで利用できます。</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">プラン比較</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">機能</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">ライト</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">スタンダード</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">プロ</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURE_ROWS.map((row) => (
                  <tr key={row.feature} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2">{row.feature}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center">{row.light}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center">{row.standard}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm font-medium text-sky-700">スタンダードが最も選ばれています。</p>
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
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">プラン</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">標準容量</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">追加容量料金</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ROWS.map((row) => (
                  <tr key={row.plan} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">{row.plan}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.included}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.addon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">追加例</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">追加料金</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ADDON_EXAMPLES.map((row) => (
                  <tr key={row.extra} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2">{row.extra}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{row.monthly}</td>
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
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">業務特化で選ばれる理由</h2>
          <ul className="list-disc space-y-3 pl-5 text-sm text-slate-700">
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
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">比較項目</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">本サービス</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">A社</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold">B社</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_ROWS.map((row) => (
                  <tr key={row.axis} className="odd:bg-white even:bg-slate-50/40">
                    <td className="border-b border-slate-100 px-3 py-2">{row.axis}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center font-semibold text-sky-700">{row.service}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center">{row.companyA}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center">{row.companyB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white sm:p-10">
          <h2 className="text-2xl font-bold sm:text-3xl">まずは現場で使って確認してください</h2>
          <p className="mt-3 text-sm text-slate-200 sm:text-base">導入のしやすさと現場フィットを、無料期間でそのまま確認できます。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200">
              まずは30日無料で試す
            </Link>
            <Link href="/signup" className="rounded-xl border border-slate-500 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-300">
              初期設定を代行してすぐに運用開始
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-slate-600 sm:px-6 lg:px-8">
          <p>© Groomer App</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-sky-700 hover:underline">
              プライバシーポリシー
            </Link>
            <Link href="/legal/terms" className="hover:text-sky-700 hover:underline">
              利用規約
            </Link>
            <Link href="/legal/security" className="hover:text-sky-700 hover:underline">
              セキュリティポリシー
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
