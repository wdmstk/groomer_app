export type ManualSection = {
  id: string
  title: string
  path: string
  purpose: string
  procedures: string[]
  cautions: string[]
}

export type Workflow = {
  id: string
  title: string
  goal: string
  sectionIds: string[]
}

export type GlossaryTerm = {
  term: string
  meaning: string
}

export const manualMeta = {
  updatedAt: '2026-03-01',
  targetVersion: 'groomer_app 0.1.0 / Next.js 16.1.6',
}

export const manualGlossary: GlossaryTerm[] = [
  { term: 'owner / admin / staff', meaning: '店舗の操作権限です。owner が最上位で、admin、staff の順に権限が制限されます。' },
  { term: 'ダッシュボード', meaning: '当日の予約件数や売上見込みなど、運用状況をまとめて確認する画面です。' },
  { term: 'タブ', meaning: '同じ画面内で表示内容を切り替える見出し（例: 新規登録 / 一覧）です。' },
  { term: 'サブスク課金', meaning: '月額など継続請求の契約管理です。決済方法の設定や状態確認を行います。' },
  { term: 'billing_status', meaning: '課金状態を表す項目です。active は利用可能、状態により利用制限が発生します。' },
  { term: 'trial / trial_days', meaning: '試用期間とその日数です。期限を超えると課金状態に応じて利用制限されます。' },
  { term: 'past_due / grace_days', meaning: '支払い遅延状態と猶予日数です。猶予を過ぎると利用停止対象になります。' },
  { term: 'Stripe / KOMOJU', meaning: '決済サービス提供元です。Stripe は主にカード決済、KOMOJU はキャリア決済などに対応します。' },
  { term: 'Webhook', meaning: '決済サービス側の状態変化を、システムへ自動通知する仕組みです。' },
  { term: 'Checkout', meaning: '外部決済ページへ遷移して支払い情報を入力する処理です。' },
  { term: 'トークン (token)', meaning: 'URL内で使う一時的な識別子です。招待や予約キャンセルで本人確認に使います。' },
  { term: 'セッション (session)', meaning: 'ログイン状態を保持する情報です。ログアウトすると無効になります。' },
  { term: 'Cookie', meaning: 'ブラウザに保存される小さな設定情報です。アクティブ店舗などの状態保持に使います。' },
  { term: 'JST', meaning: '日本標準時（UTC+9）です。予約時刻・来店時刻の基準として使用します。' },
]

export const manualSections: ManualSection[] = [
  {
    id: 'login',
    title: 'ログイン',
    path: '/login',
    purpose: 'メールアドレスとパスワードで管理画面にサインインします。',
    procedures: [
      'メールアドレスとパスワードを入力します。',
      '「ログイン」を押します。',
      '店舗所属があればダッシュボードへ移動します。',
      '招待リンク付きの場合は招待受諾画面に進みます。',
    ],
    cautions: [
      '入力が誤っている場合はエラーメッセージが表示されます。',
      '招待受諾は、招待メールアドレスとログインメールアドレスが一致している必要があります。',
    ],
  },
  {
    id: 'signup',
    title: '新規登録',
    path: '/signup',
    purpose: '運用ユーザーを作成します。',
    procedures: [
      'メールアドレスとパスワードを入力します。',
      '「登録する」を押します。',
      '通常登録はログイン画面またはダッシュボードへ進みます。',
      '招待リンク経由登録は招待受諾フローを優先して進みます。',
    ],
    cautions: [
      '既存メールアドレスでは登録できません。',
      'メール確認設定の有無により、登録後の遷移先が異なる場合があります。',
    ],
  },
  {
    id: 'setup-store',
    title: '店舗セットアップ',
    path: '/dashboard/setup-store',
    purpose: '初回利用時に店舗を新規作成します。',
    procedures: [
      '店舗未所属状態でダッシュボードを開きます。',
      '「Webで店舗を作成」を押します。',
      '店舗名を入力して作成します。',
      '作成後、作成者は owner 権限で店舗に所属します。',
    ],
    cautions: [
      '店舗名は必須です。',
      '作成時にスタッフ情報も自動作成されます。',
    ],
  },
  {
    id: 'store-switcher',
    title: '店舗切替',
    path: 'サイドバー上部',
    purpose: '同一ユーザーで複数店舗を管理する際に、作業対象店舗を切り替えます。',
    procedures: [
      'サイドバー上部の店舗セレクトで対象店舗を選択します。',
      '切替後に画面が再読込され、表示データが切り替わります。',
      '作業前にサイドバーの店舗名表示を確認します。',
    ],
    cautions: [
      '所属店舗が1件のみの場合、店舗切替UIは表示されません。',
      '誤った店舗で入力すると別店舗データとして保存されます。',
    ],
  },
  {
    id: 'multi-store-single-user',
    title: '1ユーザー複数店舗運用',
    path: '全画面共通',
    purpose: '1つのログインアカウントで複数店舗を安全に運用する手順です。',
    procedures: [
      'owner 権限ユーザーは、ダッシュボード右上の「新しい店舗を追加」から同一アカウントで店舗を追加作成できます。',
      '追加作成後は作成した店舗へ owner 権限で自動所属し、作業対象店舗として切替可能になります。',
      '既存店舗に参加する場合は、同じメールアドレス宛の招待URL受諾でも所属を追加できます。',
      '店舗Aで作業を始める前に、サイドバーの店舗名が店舗Aになっていることを確認します。',
      '顧客・ペット・予約・会計などの入力を完了します。',
      '店舗Bへ移る際は、サイドバーの店舗切替で店舗Bへ変更します。',
      '店舗Bで一覧を開き、店舗Aデータが表示されないことを確認してから作業します。',
      '日次締め時に、各店舗で同じ手順を繰り返します。',
    ],
    cautions: [
      '追加作成は owner 権限ユーザーのみ実行できます。',
      'データは店舗単位で分離されます。店舗選択ミスが最も多い運用事故です。',
      'ブラウザタブを複数開く場合、どのタブがどの店舗かを明確にしてください。',
    ],
  },
  {
    id: 'dashboard',
    title: 'ダッシュボード',
    path: '/dashboard',
    purpose: '当日の運用状況を確認し、各機能へ移動します。',
    procedures: [
      '本日の予約件数、来店済み件数、売上見込み、確定売上を確認します。',
      '「30分以内の予約」で直近対応を確認します。',
      '「未会計アラート」から会計画面へ移動します。',
      '予約一覧リンクから顧客・ペット・カルテの詳細を開きます。',
    ],
    cautions: [
      '表示内容はアクティブ店舗のみです。',
      '店舗切替直後は再読込後の店舗名を確認してください。',
    ],
  },
  {
    id: 'customers',
    title: '顧客管理',
    path: '/customers',
    purpose: '顧客情報を登録・編集・削除します。',
    procedures: [
      '新規登録タブで氏名、連絡先、属性情報を入力して登録します。',
      '顧客一覧タブで登録内容を確認します。',
      '必要に応じて編集または削除を実行します。',
    ],
    cautions: [
      '氏名は必須です。',
      'タグはカンマ区切りで入力します。',
    ],
  },
  {
    id: 'pets',
    title: 'ペット管理',
    path: '/pets',
    purpose: 'ペット基本情報と健康メモを管理します。',
    procedures: [
      '飼い主を選択し、ペット情報を入力して登録します。',
      '体重、ワクチン日、持病、注意事項を必要に応じて入力します。',
      '一覧から編集または削除を行います。',
    ],
    cautions: [
      '飼い主が未登録の場合は先に顧客登録を行ってください。',
      '持病はカンマ区切りで入力します。',
    ],
  },
  {
    id: 'staffs',
    title: 'スタッフ管理',
    path: '/staffs',
    purpose: 'スタッフプロフィール管理と権限変更を行います。',
    procedures: [
      '新規登録タブで氏名、メール、Auth User IDを入力して登録します。',
      'スタッフ一覧で既存スタッフ情報を確認します。',
      'owner ユーザーは一覧から権限（owner/admin/staff）を変更できます。',
      '不要なスタッフ情報は削除します。',
    ],
    cautions: [
      '権限の正本は store_memberships です。',
      '最後の owner は降格できません。',
    ],
  },
  {
    id: 'store-invites',
    title: 'スタッフ招待',
    path: '/staffs（招待セクション）',
    purpose: 'スタッフを対象店舗へ参加させます。',
    procedures: [
      'スタッフ管理画面の招待セクションでメールとロールを入力します。',
      '招待URLを発行し、対象スタッフへ共有します。',
      'スタッフがURLを開き、ログインまたは新規登録後に招待を受諾します。',
      '受諾後、店舗所属とスタッフ情報が自動連携されます。',
    ],
    cautions: [
      '招待URL作成は owner/admin のみ可能です。',
      '招待可能ロールは admin / staff のみです（owner は招待できません）。',
      '招待URLの有効期限は作成から7日間です。',
      '招待メールアドレスとログインメールアドレスが一致しないと受諾できません。',
    ],
  },
  {
    id: 'billing',
    title: 'サブスク課金',
    path: '/billing',
    purpose: '店舗の課金状態確認、決済開始、決済手段切替、返金/解約操作を行います。',
    procedures: [
      'owner 権限でサブスク課金ページを開き、現在の billing_status・試用終了予定・past_due猶予を確認します。',
      '「決済方法の選択」で Stripe（クレカ）または KOMOJU（キャリア決済）を選択し、Checkout を開始します。',
      '必要に応じて運用操作（優先決済手段切替 / refund_request / cancel_at_period_end / cancel_immediately）を実行します。',
      'プロバイダ別ステータスと最近のオペレーション履歴を確認します。',
    ],
    cautions: [
      'この画面は owner 権限のみ利用できます。',
      '試用期限切れ・past_due・canceled は要対応アラート表示になります。',
      '決済反映はWebhook経由のため、反映まで時間差が出る場合があります。',
    ],
  },
  {
    id: 'billing-history',
    title: '課金履歴',
    path: '/billing/history',
    purpose: '課金状態の変更履歴、Webhook受信履歴、Checkout起動履歴を監査します。',
    procedures: [
      '課金履歴ページを開き、ステータス変更履歴（from/to/source/reason）を確認します。',
      'Webhook受信履歴で event_type・status・error を確認し、障害時は status=error の行を起点に provider・event_id・created_at を控えます。',
      'ステータス変更履歴で同時刻帯の source=webhook を確認し、Webhook受信後に billing_status が更新されたかを照合します。',
      'Checkout起動履歴で idempotency_key と session 状態を確認します。',
    ],
    cautions: [
      'この画面は owner 権限のみ利用できます。',
      '障害調査時は provider と created_at を起点に時系列で確認してください。',
      '詳細調査が必要な場合は、provider・event_id・created_at を控えて管理者へ共有してください。',
    ],
  },
  {
    id: 'service-menus',
    title: '施術メニュー管理',
    path: '/service-menus',
    purpose: '予約と会計で使う施術メニューを管理します。',
    procedures: [
      'メニュー名、価格、所要時間を入力して登録します。',
      '課税設定や表示順を必要に応じて設定します。',
      '一覧から編集または削除します。',
    ],
    cautions: [
      '価格・税設定は会計に直結します。',
      '無効化したメニューの扱いは運用ルールを決めてください。',
    ],
  },
  {
    id: 'appointments',
    title: '予約管理',
    path: '/appointments',
    purpose: '予約の作成・更新・一覧確認・カレンダー確認を行います。',
    procedures: [
      '画面右上の「顧客予約URLをコピー」で公開予約URLを取得できます。',
      '新規登録タブで顧客、ペット、担当、日時、メニューを入力して登録します。',
      '予約一覧タブで編集、申請確定（予約申請 -> 予約済）、削除を行います。',
      'カレンダータブで日付・担当ごとの予約状況を確認します。',
    ],
    cautions: [
      '開始/終了日時はJST想定で入力します。',
      '顧客・ペット・スタッフ・メニューが未登録だと予約作成できません。',
    ],
  },
  {
    id: 'public-reserve',
    title: '公開予約フォーム（顧客向け）',
    path: '/reserve/[store_id]',
    purpose: '顧客が店舗公開URLから予約申請を送信します。',
    procedures: [
      '店舗側で予約管理画面の「顧客予約URLをコピー」から URL を案内します。',
      '顧客がフォームで氏名・希望日時・ペット情報・施術メニューを入力して送信します。',
      '送信後は予約ステータス「予約申請」で登録されます。',
      '店舗側が予約一覧で「申請を確定」を実行すると「予約済」になります。',
    ],
    cautions: [
      '施術メニューは1件以上選択が必須です。',
      'フォーム送信後に表示されるキャンセルURLは顧客側で保管が必要です。',
    ],
  },
  {
    id: 'public-reserve-cancel',
    title: '公開予約キャンセル',
    path: '/reserve/cancel?token=...',
    purpose: '顧客が発行済みキャンセルURLから予約申請をキャンセルします。',
    procedures: [
      '顧客がキャンセルURLを開き、キャンセル処理を実行します。',
      '対象予約のステータスがキャンセルに更新されます。',
      '店舗側は予約一覧・カレンダーで反映を確認します。',
    ],
    cautions: [
      '有効なキャンセルトークンが必要です。',
      'キャンセル済み予約の再利用はできないため、再予約が必要です。',
    ],
  },
  {
    id: 'medical-records',
    title: 'ペットカルテ管理',
    path: '/medical-records',
    purpose: '施術記録と健康状態の履歴を管理します。',
    procedures: [
      'ペット、担当、日時、施術メニューを入力します。',
      '皮膚状態、行動メモ、注意事項を記録します。',
      '写真URLを必要に応じて登録し、一覧で編集または削除します。',
    ],
    cautions: [
      '履歴データのため、記録内容は具体的に入力してください。',
      '写真URLは複数入力時にカンマ区切りで入力します。',
    ],
  },
  {
    id: 'visits',
    title: '来店履歴',
    path: '/visits',
    purpose: '来店実績を確認・管理します。',
    procedures: [
      '会計確定時に該当予約から来店履歴が自動作成されます。',
      '必要に応じて手動で来店履歴を登録します。',
      '一覧から内容確認、編集、削除を行います。',
    ],
    cautions: [
      '会計連動分との二重登録に注意してください。',
      '予約なし来店は予約IDなしで運用できます。',
    ],
  },
  {
    id: 'payments',
    title: '会計管理',
    path: '/payments',
    purpose: '予約メニュー連動の会計登録と確定を行います。',
    procedures: [
      '新規登録タブで予約を選択します。',
      '支払方法、割引、備考を入力します。',
      '金額確認後に会計確定して保存します。',
      '会計一覧から領収書表示へ進みます。',
    ],
    cautions: [
      '予約メニュー未設定の予約は会計登録できません。',
      '会計確定時に来店履歴が自動作成されます。',
    ],
  },
  {
    id: 'receipts',
    title: '領収書表示',
    path: '/receipts/[payment_id]',
    purpose: '会計データを印刷用レイアウトで表示します。',
    procedures: [
      '会計一覧の「印刷」から対象領収書を開きます。',
      '宛名、支払情報、内訳、合計を確認します。',
      '印刷ボタンでブラウザ印刷します。',
    ],
    cautions: [
      '印刷前に金額と宛名を最終確認してください。',
      '内訳が空の場合は予約メニュー設定を確認してください。',
    ],
  },
  {
    id: 'logout',
    title: 'ログアウト',
    path: '/logout',
    purpose: 'セッションを終了します。',
    procedures: [
      'サイドバー最下部の「ログアウト」を押します。',
      'ログイン画面に戻ることを確認します。',
    ],
    cautions: ['共用端末では業務終了ごとにログアウトしてください。'],
  },
]

export const workflows: Workflow[] = [
  {
    id: 'flow-initial',
    title: '初期設定フロー',
    goal: 'アカウント作成から最初の運用開始までを完了します。',
    sectionIds: ['signup', 'login', 'setup-store', 'service-menus', 'staffs', 'store-invites'],
  },
  {
    id: 'flow-multi-store-single-user',
    title: '複数店舗運用フロー（1ユーザー）',
    goal: '1つのアカウントで複数店舗を安全に切り替えて運用します。',
    sectionIds: ['store-switcher', 'multi-store-single-user', 'dashboard', 'appointments'],
  },
  {
    id: 'flow-reception',
    title: '受付・予約フロー',
    goal: '顧客登録から予約確定までを行います。',
    sectionIds: ['customers', 'pets', 'appointments'],
  },
  {
    id: 'flow-treatment',
    title: '施術記録フロー',
    goal: '施術対応とカルテ記録を正しく残します。',
    sectionIds: ['appointments', 'medical-records', 'visits'],
  },
  {
    id: 'flow-web-reserve',
    title: '公開予約運用フロー',
    goal: '顧客の予約申請を受け付け、店舗側で確定・必要時キャンセル処理を行います。',
    sectionIds: ['appointments', 'public-reserve', 'public-reserve-cancel'],
  },
  {
    id: 'flow-payment',
    title: '会計・領収書フロー',
    goal: '会計確定から領収書発行までを完了します。',
    sectionIds: ['payments', 'receipts', 'visits'],
  },
  {
    id: 'flow-billing-owner',
    title: '課金運用フロー（owner）',
    goal: '課金開始・運用操作・履歴監査までを実施します。',
    sectionIds: ['billing', 'billing-history'],
  },
  {
    id: 'flow-close',
    title: '締め処理フロー',
    goal: '店舗切替確認とログアウトで安全に業務を終了します。',
    sectionIds: ['store-switcher', 'dashboard', 'logout'],
  },
]

export function getSection(id: string) {
  return manualSections.find((section) => section.id === id)
}
