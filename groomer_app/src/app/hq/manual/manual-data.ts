export type HqManualSection = {
  id: string
  title: string
  path: string
  purpose: string
  procedures: string[]
  cautions: string[]
}

export type HqWorkflow = {
  id: string
  title: string
  goal: string
  sectionIds: string[]
}

export type HqGlossaryTerm = {
  term: string
  meaning: string
}

export type HqManualItemDetail = {
  item: string
  detail: string
}

export type HqManualSectionGuide = {
  flow: string[]
  itemDetails: HqManualItemDetail[]
}

export type HqManualCardGuide = {
  card: string
  focus: string
  usage: string
  decision: string
}

export type HqManualTabGuide = {
  tab: string
  when: string
  goal: string
  cards: HqManualCardGuide[]
}

export type HqManualSectionInsight = {
  pageGoal: string
  tabs: HqManualTabGuide[]
}

export const hqManualMeta = {
  updatedAt: '2026-03-21',
  targetVersion: 'groomer_app 0.0.1 / HQ Phase 1',
}

export const hqManualGlossary: HqGlossaryTerm[] = [
  { term: 'HQ', meaning: 'Headquarters の略。本部運用モード全体を指します。' },
  { term: 'owner', meaning: '店舗のオーナー権限。本部では閲覧・配信リクエスト作成・承認が可能です。' },
  { term: 'admin', meaning: '店舗の管理者権限。本部では閲覧のみ可能で、配信リクエスト作成・承認は不可です。' },
  { term: 'staff', meaning: 'スタッフ権限。本部機能（/hq 配下）にはアクセスできません。' },
  { term: 'hq_view', meaning: '本部画面の閲覧可否を表す Capability です。' },
  { term: 'hq_template_request', meaning: 'テンプレ配信リクエストを作成できる Capability です（owner のみ）。' },
  { term: 'hq_template_approve', meaning: 'テンプレ配信承認を記録できる Capability です（owner のみ）。' },
  { term: 'source_store_id', meaning: '配信元店舗ID。テンプレートの元データを持つ店舗です。' },
  { term: 'target_store_ids', meaning: '配信先店舗IDの配列。承認対象店舗でもあります。' },
  { term: 'overwrite_scope', meaning: '上書き範囲。`price_duration_only` または `full` を指定します。' },
  { term: 'price_duration_only', meaning: '価格・所要時間のみ上書きするモードです。' },
  { term: 'full', meaning: 'カテゴリや税設定などを含めて広範囲に上書きするモードです。' },
  { term: 'delivery_id', meaning: '配信リクエストを一意に識別するIDです。' },
  { term: 'status', meaning: '配信状態。`pending` / `applied` / `rejected` が使われます。' },
  { term: '承認結果', meaning: '各店舗が入力する承認または却下の結果です。配信全体の現在状態である status とは別物です。' },
  { term: 'pending', meaning: '承認待ち状態。全対象店舗の承認が揃うまで適用されません。' },
  { term: 'approved', meaning: '個別店舗の承認結果。全対象店舗で approved になると配信が適用されます。' },
  { term: 'rejected', meaning: '拒否状態。配信全体が中止され、再適用されません。' },
  { term: 'applied', meaning: '配信適用済み状態。対象店舗へテンプレ反映が完了しています。' },
  { term: 'applied_at', meaning: '配信が適用された日時（ISO文字列）です。' },
  { term: 'applied_summary', meaning: '適用結果サマリー。店舗別の反映結果を保持します。' },
  { term: 'last_error', meaning: '直近エラー内容。適用失敗や拒否理由が記録されます。' },
  { term: 'requested_by_user_id', meaning: '配信リクエストを作成したユーザーIDです。' },
  { term: 'approved_by_user_ids', meaning: '承認を実行したユーザーID配列です。' },
  { term: 'actor_scope', meaning: '監査ログの操作主体。HQ操作では `hq` が記録されます。' },
  { term: 'entity_type', meaning: '監査対象の種別。配信監査では `hq_menu_template_delivery` を使用します。' },
]

export const hqManualSections: HqManualSection[] = [
  {
    id: 'hq-access',
    title: '本部アクセス条件と権限',
    path: '/hq/*',
    purpose: '本部機能の利用条件（プラン・ロール）とできる操作の境界を確認します。',
    procedures: [
      'ログイン後に /hq を開き、本部画面が表示されるか確認します。',
      '表示できない場合は store_memberships.role と plan_code を確認します。',
      'owner/admin/staff のいずれかで、閲覧・操作可否が想定どおりか確認します。',
    ],
    cautions: [
      'staff は本部機能を利用できません。',
      '本部機能はロール（owner/admin/staff）で制御され、staff はアクセスできません。',
    ],
  },
  {
    id: 'hq-dashboard',
    title: '本部ダッシュボード',
    path: '/hq',
    purpose: '複数店舗の予約・売上・監査ログを横断比較し、重点対応店舗を決めます。',
    procedures: [
      '集計期間（7/30/90日）を選択して比較軸を決めます。',
      '店舗比較テーブルで予約件数・完了率・キャンセル率・売上を確認します。',
      '権限監査サマリーと配信件数を見て、配信または個店改善へ進みます。',
    ],
    cautions: [
      '本画面は閲覧集計です。個店データの直接修正はできません。',
      '日次集計のため、直近更新が反映されるまでタイムラグがある場合があります。',
    ],
  },
  {
    id: 'hq-template-request',
    title: 'テンプレ配信リクエスト作成',
    path: '/hq/menu-templates',
    purpose: '配信元店舗のメニューをテンプレ化し、配信先店舗へ適用申請を作成します。',
    procedures: [
      '配信元店舗を選択します。',
      '上書き範囲を選択し、配信先店舗を複数選びます。',
      '配信リクエスト作成を実行し、delivery_id が表示されたことを確認します。',
    ],
    cautions: [
      'この操作は owner のみ可能です（admin は閲覧のみ）。',
      '配信先を0件で送信すると作成できません。',
    ],
  },
  {
    id: 'hq-option-labels',
    title: '横文字の選択肢早見表',
    path: '/hq/menu-templates , /hq/menu-template-deliveries',
    purpose: '本部画面で表示される英字選択肢の意味を、操作前に確認できるようにします。',
    procedures: [
      '配信リクエスト作成前に overwrite_scope の意味を確認します。',
      '承認操作前に承認と却下の意味を確認します。',
      '配信一覧確認時に status（pending/applied/rejected）の意味を確認します。',
    ],
    cautions: [
      'pending を「適用中」と誤認しないでください（正しくは承認待ち）。',
      'rejected は拒否で停止状態です。同じ delivery_id は適用されません。',
    ],
  },
  {
    id: 'hq-template-approval',
    title: 'テンプレ配信承認',
    path: '/hq/menu-template-deliveries',
    purpose: '配信リクエストの承認・却下を記録し、全対象店舗の承認が揃ったら配信を適用します。',
    procedures: [
      '配信リクエスト一覧で status=pending の対象を確認します。',
      '承認対象の storeId を選択し、承認または却下を実行します。',
      '全対象店舗の承認後に status=applied へ遷移したことを確認します。',
    ],
    cautions: [
      'admin は承認アクションを実行できません。',
      '却下すると配信は rejected になり、その delivery_id は適用されません。',
    ],
  },
  {
    id: 'hq-delivery-status',
    title: '配信ステータスの見方',
    path: 'hq_menu_template_deliveries',
    purpose: 'status と日時列を正しく読み取り、承認待ち・適用済み・失敗時の状態を判定します。',
    procedures: [
      'status 列で pending/applied/rejected を確認します。',
      'applied_at と created_at の差分を見て、反映までの時間を把握します。',
      'last_error がある場合は内容を確認し、再申請か個別修正を判断します。',
    ],
    cautions: [
      'pending は「処理中」ではなく「承認待ち」です。',
      'applied_summary の有無だけで成功判定せず、status も必ず確認してください。',
    ],
  },
  {
    id: 'hq-audit',
    title: '本部監査ログ確認',
    path: 'audit_logs（actor_scope=hq）',
    purpose: '本部操作の監査ログを確認し、誰がいつ何を実行したか追跡可能にします。',
    procedures: [
      '監査ログで actor_scope=hq と entity_type=hq_menu_template_delivery を条件に確認します。',
      'action と payload を照合し、request/approve/reject/apply の履歴を追跡します。',
      '差分（before/after）で状態遷移が想定どおりか確認します。',
    ],
    cautions: [
      '監査ログ欠落時は操作再実行の前に原因調査を優先してください。',
      'entity_id（delivery_id）を軸に時系列で確認しないと誤解しやすくなります。',
    ],
  },
  {
    id: 'hq-mode-navigation',
    title: '本部運用モードと導線',
    path: 'Sidebar（本部運用）',
    purpose: '店舗運用と本部運用の導線を分離し、誤遷移・誤操作を防ぎます。',
    procedures: [
      'サイドバーの運用モードが「本部運用」になっていることを確認します。',
      '本部メニュー（ダッシュボード/配信リクエスト/配信承認/本部マニュアル）から遷移します。',
      '本部作業完了後は必要に応じて店舗運用へ戻ります。',
    ],
    cautions: [
      'staff では本部モード切替を表示しません。',
      'URL直打ちだけで権限を回避できない前提で運用してください。',
    ],
  },
  {
    id: 'hq-troubleshooting',
    title: '本部運用トラブル対応',
    path: '/api/hq/*',
    purpose: '本部APIの代表的なエラー時に、原因切り分けと一次対応を標準化します。',
    procedures: [
      'HTTPステータス（401/403/400/500）と message を確認します。',
      '401 は再ログイン、403 はロール・プラン・対象店舗権限を確認します。',
      '500 は対象 delivery_id と request payload を添えて調査チケット化します。',
    ],
    cautions: [
      'エラー時に同一リクエストを連打しないでください。',
      '権限エラーをデータ欠損と誤認しないよう、先に role/capability を確認してください。',
    ],
  },
]

export const hqWorkflows: HqWorkflow[] = [
  {
    id: 'daily-hq-monitoring',
    title: '本部日次モニタリング',
    goal: '全店舗の業績・監査・配信状態を毎日確認し、優先対応を決めます。',
    sectionIds: ['hq-access', 'hq-mode-navigation', 'hq-dashboard', 'hq-delivery-status', 'hq-audit'],
  },
  {
    id: 'template-distribution',
    title: 'テンプレ配信運用フロー',
    goal: '作成から承認・適用までの流れを、権限境界を守って実施します。',
    sectionIds: ['hq-template-request', 'hq-option-labels', 'hq-template-approval', 'hq-delivery-status', 'hq-audit'],
  },
  {
    id: 'incident-response',
    title: '障害一次対応フロー',
    goal: '本部APIエラー発生時に、再現情報を残して迅速に切り分けます。',
    sectionIds: ['hq-troubleshooting', 'hq-audit', 'hq-template-request', 'hq-template-approval'],
  },
  {
    id: 'onboarding-hq',
    title: '本部運用オンボーディング',
    goal: '新任担当者が本部運用の前提と基本操作を短時間で把握します。',
    sectionIds: ['hq-access', 'hq-mode-navigation', 'hq-dashboard', 'hq-template-request'],
  },
]

const hqSectionGuides: Record<string, HqManualSectionGuide> = {
  'hq-access': {
    flow: ['利用タイミング: 本部機能を初回利用する時。', '前提: ログイン済み。', '次に行う操作: 本部ダッシュボードで対象店舗を確認。'],
    itemDetails: [
      { item: 'ロール境界', detail: 'owner/admin は閲覧可能、staff は本部アクセス不可です。' },
      { item: 'Capability', detail: '画面/APIともに hq_view / hq_template_request / hq_template_approve を基準に判定します。' },
      { item: 'プラン境界', detail: '現行実装では本部機能の可否はプランではなくロールと Capability で判定します。' },
    ],
  },
  'hq-dashboard': {
    flow: ['利用タイミング: 日次/週次の店舗レビュー時。', '前提: owner/admin で本部アクセス可能。', '次に行う操作: 配信判断または個店アクション起票。'],
    itemDetails: [
      { item: '集計期間切替', detail: '7/30/90日で比較期間を変更できます。' },
      { item: '店舗比較テーブル', detail: '予約件数、完了率、キャンセル率、売上、監査ログ件数を横断比較します。' },
      { item: '権限監査サマリー', detail: 'action ごとの件数上位を確認し、異常な操作偏りを検知します。' },
    ],
  },
  'hq-template-request': {
    flow: ['利用タイミング: 本部テンプレ配信の起点作成時。', '前提: owner 権限かつ配信元/配信先が確定。', '次に行う操作: 配信承認ページで承認進捗を追跡。'],
    itemDetails: [
      { item: '配信元店舗', detail: '選択すると配信先候補が再計算されます。' },
      { item: '配信先店舗', detail: 'チェック形式で1件以上選択が必須です。' },
      {
        item: '上書き範囲',
        detail:
          'price_duration_only（価格・所要時間のみ上書き）または full（カテゴリ・税設定等を含めて広範囲に上書き）を指定します。',
      },
      { item: '作成API', detail: 'POST /api/hq/menu-templates が delivery レコードを作成します。' },
    ],
  },
  'hq-option-labels': {
    flow: ['利用タイミング: 配信作成/承認/進捗確認の直前。', '前提: 本部メニュー画面を開いている。', '次に行う操作: 実際の選択肢を誤りなく選んで実行。'],
    itemDetails: [
      { item: 'overwrite_scope=price_duration_only', detail: '価格（price）と所要時間（duration）のみを上書きします。' },
      { item: 'overwrite_scope=full', detail: 'メニュー属性を広範囲に上書きします（価格・時間以外も対象）。' },
      { item: '承認', detail: '対象店舗が配信内容に同意した記録として保存されます。' },
      { item: '却下', detail: '配信を進めない判断として記録され、配信全体は停止します。' },
      { item: 'status=pending', detail: '承認待ち。全対象店舗の承認がまだ揃っていません。' },
      { item: 'status=applied', detail: '適用済み。テンプレ配信が対象店舗に反映済みです。' },
      { item: 'status=rejected', detail: '拒否済み。却下により配信は実行されません。' },
    ],
  },
  'hq-template-approval': {
    flow: ['利用タイミング: 配信承認判断時。', '前提: owner 権限で対象店舗の承認能力あり。', '次に行う操作: 全承認後の applied 結果確認。'],
    itemDetails: [
      { item: '承認/却下ボタン', detail: '承認は配信を進める判断、却下は配信を止める判断として記録されます。' },
      { item: '承認記録', detail: 'hq_menu_template_delivery_approvals に upsert されます。' },
      { item: '全承認条件', detail: 'targets に並ぶ全店舗が承認済みになると適用処理に進みます。' },
      { item: '承認API', detail: 'POST /api/hq/menu-template-deliveries/[delivery_id]/approve を使用します。' },
    ],
  },
  'hq-delivery-status': {
    flow: ['利用タイミング: 承認/適用進捗を確認する時。', '前提: 配信リクエスト一覧を表示可能。', '次に行う操作: pending 停滞や rejected の対応判断。'],
    itemDetails: [
      { item: 'status=pending', detail: '承認待ち。対象店舗の承認が未完了です。' },
      { item: 'status=applied', detail: '配信反映完了。applied_at と applied_summary が更新されます。' },
      { item: 'status=rejected', detail: '拒否で停止。last_error に理由が入る場合があります。' },
    ],
  },
  'hq-audit': {
    flow: ['利用タイミング: 操作追跡や監査報告時。', '前提: audit_logs が参照可能。', '次に行う操作: delivery_id 単位で履歴整合を確認。'],
    itemDetails: [
      { item: 'actor_scope', detail: '本部操作は actor_scope=hq で記録されます。' },
      { item: 'entity_type', detail: '配信関連は hq_menu_template_delivery が設定されます。' },
      { item: 'action', detail: 'requested / approval_recorded / waiting_remaining_approvals / rejected / applied を確認します。' },
    ],
  },
  'hq-troubleshooting': {
    flow: ['利用タイミング: APIエラー発生時。', '前提: エラーメッセージを取得済み。', '次に行う操作: ロール・プラン・対象店舗・JSON入力を順に確認。'],
    itemDetails: [
      { item: '401', detail: '未ログイン。再ログイン後に再試行します。' },
      { item: '403', detail: '権限不足または pro 条件未満です。role/capability/plan を確認します。' },
      { item: '400', detail: '入力不正。配信元店舗/配信先店舗/承認または却下の指定を見直します。' },
      { item: '500', detail: 'サーバー側失敗。delivery_id と message を添えて調査へ連携します。' },
    ],
  },
}

export const hqSectionInsights: Record<string, HqManualSectionInsight> = {
  'hq-dashboard': {
    pageGoal: '本部視点で店舗比較し、改善対象と配信対象を即断できる状態にします。',
    tabs: [
      {
        tab: 'KPIカード',
        when: '日次レビュー開始時',
        goal: '期間全体の異常傾向を先に把握します。',
        cards: [
          {
            card: '対象店舗数/予約件数/売上/監査ログ件数',
            focus: '全体ボリュームと急変の有無。',
            usage: '前回確認時との差分を見て異常有無を判断します。',
            decision: '急変あり: 店舗比較テーブルで原因店舗を絞り込みます。',
          },
        ],
      },
      {
        tab: '店舗比較',
        when: '原因店舗の特定時',
        goal: '店舗間の成績差と監査差を同時に確認します。',
        cards: [
          {
            card: '店舗比較テーブル',
            focus: '完了率・キャンセル率・売上構成比・監査件数。',
            usage: '高キャンセル率や監査偏りがある店舗を優先します。',
            decision: '改善必要: 個店運用へ連携かテンプレ配信を検討します。',
          },
        ],
      },
    ],
  },
  'hq-template-request': {
    pageGoal: '誤配信を防ぎつつ、配信リクエストを一貫した形式で作成します。',
    tabs: [
      {
        tab: '配信リクエスト作成',
        when: 'テンプレ展開時',
        goal: '配信元・配信先・上書き範囲を正確に指定します。',
        cards: [
          {
            card: 'フォーム',
            focus: '配信元店舗 / 配信先店舗 / 上書き範囲。',
            usage: '入力後に作成し、delivery_id を控えます。',
            decision: '対象誤りの疑い: 作成前に選択をやり直します。',
          },
        ],
      },
      {
        tab: '配信元サンプルメニュー',
        when: '展開前の整合確認時',
        goal: '配信元データが意図どおりか確認します。',
        cards: [
          {
            card: '先頭20件テーブル',
            focus: 'メニュー名、カテゴリ、価格、所要時間。',
            usage: 'テンプレ基準値として妥当か確認します。',
            decision: '不整合あり: 先に配信元店舗でメニュー修正します。',
          },
        ],
      },
    ],
  },
  'hq-template-approval': {
    pageGoal: '承認待ちの停滞を防ぎ、適用完了までを追跡します。',
    tabs: [
      {
        tab: '承認アクション',
        when: 'pending 対応時',
        goal: '対象店舗ごとの承認結果を記録します。',
        cards: [
          {
            card: '承認/却下操作',
            focus: '対象店舗（ID）選択、コメント、承認/却下。',
            usage: '承認は配信を進める判断、却下は配信を止める判断として記録されます。',
            decision: '懸念あり: 却下を選び、理由を明記します。',
          },
        ],
      },
      {
        tab: '配信リクエスト一覧',
        when: '進捗・結果確認時',
        goal: 'status と日時を見て全体進行を把握します。',
        cards: [
          {
            card: '一覧テーブル',
            focus: 'delivery_id、status、created_at、applied_at。',
            usage: 'status は pending=承認待ち、applied=適用済み、rejected=拒否済みとして読み取ります。',
            decision: '長期停滞: 対象店舗の承認状況を個別確認します。',
          },
        ],
      },
    ],
  },
  'hq-option-labels': {
    pageGoal: '英字選択肢の意味をその場で確認し、選択ミスを防ぎます。',
    tabs: [
      {
        tab: '配信リクエスト選択肢',
        when: '配信作成直前',
        goal: 'overwrite_scope を目的に合わせて選べるようにします。',
        cards: [
          {
            card: 'overwrite_scope',
            focus: 'price_duration_only / full の違い。',
            usage: '変更範囲を狭くしたい場合は price_duration_only を選びます。',
            decision: '広範囲反映が必要な場合のみ full を選択します。',
          },
        ],
      },
      {
        tab: '承認・進捗選択肢',
        when: '承認操作時と一覧確認時',
        goal: '承認/却下 と status の意味を取り違えないようにします。',
        cards: [
          {
            card: '承認・却下 / status',
            focus: '承認・却下という操作結果と、配信一覧の現在状態の違い。',
            usage: '承認/却下は操作内容、status は承認待ち・適用済み・拒否済みなどの現在状態として読み分けます。',
            decision: '状態確認は status、実行判断は承認/却下を基準にします。',
          },
        ],
      },
    ],
  },
}

export function getHqSectionGuide(id: string): HqManualSectionGuide {
  return (
    hqSectionGuides[id] ?? {
      flow: ['このページの利用フロー情報は未定義です。'],
      itemDetails: [],
    }
  )
}

export function getHqSectionInsight(id: string, section: HqManualSection): HqManualSectionInsight {
  const insight = hqSectionInsights[id]
  if (insight) return insight
  return {
    pageGoal: `${section.title}の基本運用を安全に実施します。`,
    tabs: [
      {
        tab: '共通',
        when: '本部作業時',
        goal: section.purpose,
        cards: [
          {
            card: '操作手順',
            focus: section.procedures[0] ?? '画面の基本操作',
            usage: '手順を上から実施し、結果表示と最新状態を確認します。',
            decision: section.cautions[0] ?? '不明点は実行前に確認します。',
          },
          {
            card: '注意点',
            focus: section.cautions.join(' / ') || '権限・入力値の整合',
            usage: '実行前にリスク条件を除外します。',
            decision: '重大影響の可能性がある場合は停止して確認します。',
          },
        ],
      },
    ],
  }
}

export function getHqSection(id: string) {
  return hqManualSections.find((section) => section.id === id)
}
