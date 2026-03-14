export type DevManualSection = {
  id: string
  title: string
  path: string
  purpose: string
  procedures: string[]
  cautions: string[]
}

export type DevWorkflow = {
  id: string
  title: string
  goal: string
  sectionIds: string[]
}

export type DevGlossaryTerm = {
  term: string
  meaning: string
}

export type DevManualItemDetail = {
  item: string
  detail: string
}

export type DevManualSectionGuide = {
  flow: string[]
  itemDetails: DevManualItemDetail[]
}

export type DevManualCardGuide = {
  card: string
  focus: string
  usage: string
  decision: string
}

export type DevManualTabGuide = {
  tab: string
  when: string
  goal: string
  cards: DevManualCardGuide[]
}

export type DevManualSectionInsight = {
  pageGoal: string
  tabs: DevManualTabGuide[]
}

export const devManualMeta = {
  updatedAt: '2026-03-12',
  targetVersion: 'groomer_app 0.1.0 / Next.js 16.1.6',
}

export const devManualGlossary: DevGlossaryTerm[] = [
  { term: 'developer admin', meaning: 'サポート管理者。/dev 配下の管理機能へアクセスできる最上位権限です。' },
  { term: 'store_subscriptions', meaning: '店舗ごとの契約・課金状態を保持するテーブルです。' },
  { term: 'billing_status', meaning: '課金状態。active は利用可、past_due は猶予判定対象です。' },
  { term: 'trial_days / trial_started_at', meaning: '試用日数と開始日。trial_started_at + trial_days で試用期限を判定します。' },
  { term: 'grace_days / past_due_since', meaning: '支払い遅延時の猶予日数と遅延開始日時。past_due_since + grace_days で利用可否を判定します。' },
  { term: 'preferred_provider', meaning: '優先決済手段。stripe / komoju / 未選択を保持します。' },
  { term: 'Webhook', meaning: '決済サービスから課金状態変更を受け取る自動通知です。' },
  { term: 'idempotency_key', meaning: '同一操作の二重実行を防ぐ識別キーです。' },
  { term: 'Cron', meaning: '定期実行ジョブ。課金同期や通知などのバックグラウンド処理を行います。' },
  { term: 'job_runs', meaning: 'Cron 実行履歴。status、trigger、error、meta を監査します。' },
  { term: 'job_locks', meaning: 'Cron 多重実行防止ロック。期限切れ lock は手動解放対象です。' },
  { term: 'manual_rerun', meaning: '失敗した実行履歴を起点にした再実行トリガーです。' },
  { term: 'manual_direct', meaning: '失敗履歴に依存しない手動起動トリガーです。' },
  { term: 'support tickets', meaning: '店舗と開発側の問い合わせ管理。ステータス更新とコメント返信を行います。' },
  { term: 'RLS', meaning: 'Row Level Security。データアクセスを行単位で制御する仕組みです。' },
]

export const devManualSections: DevManualSection[] = [
  {
    id: 'dev-access',
    title: '管理者アクセスと権限制御',
    path: '/dev/*',
    purpose: '管理者機能の利用条件とアクセス拒否時の基本動作を確認します。',
    procedures: [
      '管理者メニューを開き、対象機能への遷移可否を確認します。',
      'アクセス拒否時は「サポート管理者のみアクセス可能」の表示を確認します。',
      '権限・環境変数不足・ログイン状態を切り分けます。',
    ],
    cautions: [
      'owner/admin/staff 権限では /dev 配下にアクセスできません。',
      '誤って通常運用ユーザーへ管理者URLを共有しないでください。',
    ],
  },
  {
    id: 'dev-home',
    title: '開発者管理ページ一覧',
    path: '/dev',
    purpose: '管理者向け機能への導線を一元確認します。',
    procedures: [
      '開発者管理ページ一覧を開きます。',
      '目的に応じて サブスク課金管理 / 課金アラート / サポートチケット / Cron 監視 / 管理者マニュアルへ移動します。',
      '作業完了後は通常画面へ戻るかログアウトします。',
    ],
    cautions: [
      '一覧画面自体は操作ログとしての監査用途ではありません。',
      '遷移先ごとに更新系APIがあるため、対象画面を誤らないでください。',
    ],
  },
  {
    id: 'dev-subscriptions',
    title: 'サブスク課金管理',
    path: '/dev/subscriptions',
    purpose: 'store_subscriptions の契約情報を店舗単位で確認・更新します。',
    procedures: [
      '店舗一覧で対象店舗を選択します（PCは表、モバイルはカード）。',
      'plan_code / billing_status / trial_days / grace_days などを入力します。',
      '保存後、メッセージ表示と表示値で反映結果を確認します。',
    ],
    cautions: [
      '課金ステータス変更は業務画面の利用可否判定に直結します。',
      'trial_started_at と past_due_since の日付誤りは誤ブロックの原因になります。',
    ],
  },
  {
    id: 'dev-billing-alerts',
    title: '課金アラート監視',
    path: '/dev/billing-alerts',
    purpose: 'trialing / past_due / canceled と Webhook失敗を優先監視します。',
    procedures: [
      'アラート表で status、試用残日数、past_due_since を確認します。',
      'trialing は残日数 7日以下を優先して対応します。',
      'Webhook失敗行がある場合は再処理パネルで再実行します。',
    ],
    cautions: [
      '表示は store_subscriptions の現在値に依存します。',
      'Webhook失敗を放置すると billing_status 反映遅延が継続します。',
    ],
  },
  {
    id: 'dev-webhook-retry',
    title: 'Webhook失敗イベント再処理',
    path: '/dev/billing-alerts（再処理パネル）',
    purpose: 'failed の billing_webhook_events を個別再処理します。',
    procedures: [
      '失敗イベント表で provider / event_type / webhook_event_id / error を確認します。',
      '対象行の「再処理」を実行します。',
      '更新後に表を再確認し、failed が解消されたか確認します。',
    ],
    cautions: [
      '再処理は1件ずつ実行し、同時多重クリックを避けてください。',
      '恒久失敗は event_id と error_message を添えて調査チケット化してください。',
    ],
  },
  {
    id: 'dev-cron-overview',
    title: 'Cron監視（一覧・フィルタ）',
    path: '/dev/cron',
    purpose: 'Cron 実行履歴を status / job / trigger / 日付で追跡します。',
    procedures: [
      'ステータスタブ（失敗 / 実行中 / 成功）を選択します。',
      'job、trigger、requestedByUserId、開始日範囲で絞り込みます。',
      '該当行の詳細で lastError、meta、sourceJobRunId を確認します。',
    ],
    cautions: [
      '画面更新前の情報で判断しないよう、再読込後に操作してください。',
      '日付フィルタはUTC基準のISO文字列でAPIへ送信されます。',
    ],
  },
  {
    id: 'dev-cron-rerun',
    title: 'Cron再実行と直接実行',
    path: '/dev/cron（再実行エリア）',
    purpose: 'failed 実行の再実行と manual_direct 実行を安全に行います。',
    procedures: [
      'failed 行で「再実行」を開き、理由を記入して実行します。',
      'または手動実行カードでジョブと理由を指定し直接実行します。',
      'jobRunId を控え、選択ジョブ詳細で status と meta を追跡します。',
    ],
    cautions: [
      '同一ジョブの連続実行は lock 競合を誘発するため、結果確認後に次を実行してください。',
      '原因未特定のまま再実行を繰り返さないでください。',
    ],
  },
  {
    id: 'dev-cron-locks',
    title: 'job_locks監視と手動解放',
    path: '/dev/cron（job_locks）',
    purpose: '期限切れ lock を検知し、必要時に手動解放します。',
    procedures: [
      'job_locks を再読込し、expired の件数を確認します。',
      '対象 lock の jobRunId 詳細を開き、異常終了か確認します。',
      '問題なければ手動解放を実行し、監査履歴を確認します。',
    ],
    cautions: [
      'active lock を不用意に解放しないでください。',
      '手動解放後は関連ジョブが再起動される可能性を確認してください。',
    ],
  },
  {
    id: 'dev-support-tickets',
    title: 'サポートチケット（開発者）',
    path: '/dev/support-tickets',
    purpose: '店舗からの問い合わせを店舗単位で確認し、ステータス更新と返信を行います。',
    procedures: [
      '店舗セレクトで対象店舗を選択します。',
      'チケット一覧でカテゴリ、優先度、履歴を確認します。',
      'status 更新または返信コメント送信を実行し、更新結果を確認します。',
    ],
    cautions: [
      'コメント未入力で送信しないでください。',
      'status の誤更新は運用側の進捗認識に影響します。',
    ],
  },
  {
    id: 'billing-block-logic',
    title: '課金ブロック判定ロジック',
    path: '業務画面共通判定',
    purpose: 'ログイン後の利用可否判定（/billing-required 遷移条件）を理解します。',
    procedures: [
      '判定対象店舗の選定順（active_store_id → owner → admin → 先頭）を確認します。',
      'billing_status が active の場合は常に許可されることを確認します。',
      'past_due は past_due_since + grace_days、その他は trial_started_at + trial_days で判定します。',
    ],
    cautions: [
      '判定除外パス（/billing-required /billing /logout /dev）を把握してください。',
      '日付列の欠損は意図しない許可/拒否を招くため補完ルールを確認してください。',
    ],
  },
]

export const devWorkflows: DevWorkflow[] = [
  {
    id: 'daily-monitoring',
    title: '日次監視フロー',
    goal: '課金異常・Cron異常・問い合わせを日次で点検し、重大障害を早期検知します。',
    sectionIds: ['dev-home', 'dev-billing-alerts', 'dev-webhook-retry', 'dev-cron-overview', 'dev-support-tickets'],
  },
  {
    id: 'billing-control',
    title: '課金状態制御フロー',
    goal: '契約情報の更新から利用可否判定の整合確認までを実施します。',
    sectionIds: ['dev-subscriptions', 'billing-block-logic', 'dev-billing-alerts'],
  },
  {
    id: 'cron-recovery',
    title: 'Cron復旧フロー',
    goal: '失敗ジョブの分析、再実行、lock解放、再確認を順に行います。',
    sectionIds: ['dev-cron-overview', 'dev-cron-rerun', 'dev-cron-locks'],
  },
  {
    id: 'access-and-safety',
    title: '権限と安全運用フロー',
    goal: '管理者アクセス条件を守り、誤操作と誤共有を防止します。',
    sectionIds: ['dev-access', 'dev-home'],
  },
]

const devSectionGuides: Record<string, DevManualSectionGuide> = {
  'dev-access': {
    flow: ['利用タイミング: 管理者機能の初回利用時。', '前提: developer admin としてログイン済み。', '次に行う操作: 目的画面へ移動。'],
    itemDetails: [
      { item: 'アクセス拒否表示', detail: '権限不足時は red メッセージで拒否が表示されます。' },
      { item: 'requireDeveloperAdmin', detail: '各 /dev ページで権限判定を行う共通ガードです。' },
      { item: '共有制限', detail: '管理者URLの外部共有を禁止し、運用ユーザーと分離します。' },
    ],
  },
  'dev-subscriptions': {
    flow: ['利用タイミング: 契約状態変更、障害対応、検証環境調整時。', '前提: store_subscriptions が参照可能。', '次に行う操作: 課金アラートで結果監視。'],
    itemDetails: [
      { item: '店舗サマリー表', detail: '店舗ステータス、課金ステータス、決済手段、試用終了予定を一覧表示します。' },
      { item: '編集フォーム', detail: 'plan_code、billing_status、trial/grace、期間、メモを更新します。' },
      { item: 'ホテルオプション', detail: 'hotel_option_enabled を切替し、ホテル機能解放可否を制御します。' },
      { item: '保存先API', detail: 'POST /api/dev/subscriptions/[store_id] で更新されます。' },
    ],
  },
  'dev-billing-alerts': {
    flow: ['利用タイミング: 日次点検、月末課金期間、障害発生時。', '前提: billing_status 取得が正常。', '次に行う操作: 必要なら再処理/契約修正。'],
    itemDetails: [
      { item: '重要行抽出', detail: 'trialing は残日数7日以下のみ表示されます。' },
      { item: 'ステータス列', detail: 'trialing / past_due / canceled を重点監視します。' },
      { item: 'Webhook失敗パネル', detail: 'failed イベントがある場合に再処理UIを表示します。' },
    ],
  },
  'dev-webhook-retry': {
    flow: ['利用タイミング: Webhook failed 検出時。', '前提: billing_webhook_events に failed レコードあり。', '次に行う操作: 再処理後の課金状態確認。'],
    itemDetails: [
      { item: '再処理API', detail: 'POST /api/admin/billing/webhook-events/retry を呼び出します。' },
      { item: '処理中状態', detail: '対象行ボタンは実行中表示になり多重送信を抑止します。' },
      { item: '刷新', detail: '成功時は router.refresh() で最新状態へ更新します。' },
    ],
  },
  'dev-cron-overview': {
    flow: ['利用タイミング: Cron失敗調査時。', '前提: /api/admin/cron/job-runs が利用可能。', '次に行う操作: 必要に応じ再実行/lock確認。'],
    itemDetails: [
      { item: 'ステータスタブ', detail: 'failed / running / succeeded を即時切替します。' },
      { item: '検索条件', detail: 'job, trigger, requestedByUserId, 開始日 From/To を指定できます。' },
      { item: '選択ジョブ詳細', detail: 'status、trigger、lastError、meta、sourceJobRunId を確認できます。' },
    ],
  },
  'dev-cron-rerun': {
    flow: ['利用タイミング: failed 復旧、または定期ジョブの緊急手動起動時。', '前提: 対象ジョブ名と実行理由が明確。', '次に行う操作: jobRunId を追跡して完了確認。'],
    itemDetails: [
      { item: 'failed再実行', detail: 'sourceJobRunId を付与して rerun を起票します。' },
      { item: 'manual_direct', detail: '失敗履歴なしで直接ジョブ起動します。' },
      { item: '実行理由', detail: '監査性のため reason を必ず入力します。' },
    ],
  },
  'dev-cron-locks': {
    flow: ['利用タイミング: lock滞留が疑われる時。', '前提: /api/admin/cron/job-locks が利用可能。', '次に行う操作: 必要なら手動解放。'],
    itemDetails: [
      { item: 'expired判定', detail: 'expiresAt <= 現在時刻 の lock を期限切れとして表示します。' },
      { item: '手動解放', detail: 'DELETE /api/admin/cron/job-locks で jobRunId 指定解放します。' },
      { item: '監査履歴連携', detail: '選択ジョブ詳細で manual lock releases を確認できます。' },
    ],
  },
  'dev-support-tickets': {
    flow: ['利用タイミング: 店舗問い合わせ対応時。', '前提: 対象店舗スレッド取得済み。', '次に行う操作: status更新かコメント返信。'],
    itemDetails: [
      { item: '店舗切替', detail: 'threads API から店舗と open件数を取得して切替えます。' },
      { item: 'チケット更新', detail: 'PATCH /api/dev/support-tickets で status/comment を更新します。' },
      { item: '履歴表示', detail: 'イベント種別、投稿者スコープ、コメントを時系列表示します。' },
    ],
  },
  'billing-block-logic': {
    flow: ['利用タイミング: /billing-required 遷移調査時。', '前提: 対象店舗の subscription 情報が取得可能。', '次に行う操作: 契約情報修正または決済誘導。'],
    itemDetails: [
      { item: '許可条件', detail: 'billing_status=active は常時許可です。' },
      { item: 'past_due条件', detail: 'past_due_since + grace_days 超過でブロックします。' },
      { item: '試用条件', detail: 'trial_started_at + trial_days 超過でブロックします。' },
      { item: '除外パス', detail: '/billing-required /billing /logout /dev はブロック対象外です。' },
    ],
  },
}

export const devSectionInsights: Record<string, DevManualSectionInsight> = {
  'dev-subscriptions': {
    pageGoal: '契約情報を変更し、利用可否へ反映される前提データを正しく保ちます。',
    tabs: [
      {
        tab: '店舗サマリー',
        when: '更新対象選定時',
        goal: '対象店舗と現状態を確認します。',
        cards: [
          {
            card: '一覧テーブル',
            focus: '課金ステータス、決済手段、プラン、試用終了予定。',
            usage: '異常行をクリックして下段フォームへ遷移します。',
            decision: '異常が複数店舗: 優先度を決めて順次更新。',
          },
        ],
      },
      {
        tab: '編集フォーム',
        when: '状態修正時',
        goal: '契約情報を安全に更新します。',
        cards: [
          {
            card: '契約パラメータ',
            focus: 'billing_status、trial/grace、period、notes。',
            usage: '変更理由をメモに残し、日付整合を確認して保存。',
            decision: '判定影響あり: 変更後に /billing-required 遷移を確認。',
          },
        ],
      },
    ],
  },
  'dev-cron-overview': {
    pageGoal: 'ジョブ失敗の特定から詳細分析までを1画面で完結します。',
    tabs: [
      {
        tab: 'フィルタ',
        when: '調査開始時',
        goal: '対象ジョブを最小集合に絞り込みます。',
        cards: [
          {
            card: '検索条件',
            focus: 'status、job、trigger、requestedByUserId、期間。',
            usage: '失敗タブから開始し、期間とjobを狭めます。',
            decision: '件数過多: 先に期間を絞る。',
          },
        ],
      },
      {
        tab: '選択ジョブ詳細',
        when: '原因分析時',
        goal: 'error/meta/source を確認して復旧方法を決めます。',
        cards: [
          {
            card: 'meta / lastError',
            focus: '失敗内訳、外部依存エラー、再実行可否。',
            usage: '既知エラーか判定し、rerun か恒久対応かを決定。',
            decision: '外部障害: 待機。内部不整合: データ修正。',
          },
        ],
      },
    ],
  },
  'dev-support-tickets': {
    pageGoal: '問い合わせを解決まで追跡し、店舗との応答を残します。',
    tabs: [
      {
        tab: '店舗選択',
        when: '問い合わせ確認開始時',
        goal: '対象店舗のチケット群を表示します。',
        cards: [
          {
            card: '店舗セレクト',
            focus: 'open件数、店舗名。',
            usage: 'open件数が多い店舗を優先して確認。',
            decision: '緊急がある店舗: 先に対応。',
          },
        ],
      },
      {
        tab: 'チケット一覧',
        when: '個別対応時',
        goal: 'status更新とコメント返信を実施します。',
        cards: [
          {
            card: 'チケットカード',
            focus: 'priority、status、履歴、返信欄。',
            usage: '履歴確認後に status 更新、必要なら返信投稿。',
            decision: '追加情報不足: waiting_user へ変更。',
          },
        ],
      },
    ],
  },
}

export function getDevSectionGuide(id: string): DevManualSectionGuide {
  return (
    devSectionGuides[id] ?? {
      flow: ['このページの利用フロー情報は未定義です。'],
      itemDetails: [],
    }
  )
}

export function getDevSectionInsight(id: string, section: DevManualSection): DevManualSectionInsight {
  const insight = devSectionInsights[id]
  if (insight) return insight
  return {
    pageGoal: `${section.title}の基本運用を安全に実施します。`,
    tabs: [
      {
        tab: '共通',
        when: '管理作業時',
        goal: section.purpose,
        cards: [
          {
            card: '操作手順',
            focus: section.procedures[0] ?? '画面の基本操作',
            usage: '手順を上から実施し、更新後に再読込で反映を確認します。',
            decision: section.cautions[0] ?? '不明点は実行前に確認します。',
          },
          {
            card: '注意点',
            focus: section.cautions.join(' / ') || '入力値の整合',
            usage: 'リスク条件を事前に除外してから実行します。',
            decision: '重大影響の可能性がある場合は停止して確認します。',
          },
        ],
      },
    ],
  }
}

export function getDevSection(id: string) {
  return devManualSections.find((section) => section.id === id)
}
