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

export type ManualItemDetail = {
  item: string
  detail: string
}

export type ManualSectionGuide = {
  flow: string[]
  itemDetails: ManualItemDetail[]
}

export type ManualCardGuide = {
  card: string
  focus: string
  usage: string
  decision: string
}

export type ManualTabGuide = {
  tab: string
  when: string
  goal: string
  cards: ManualCardGuide[]
}

export type ManualSectionInsight = {
  pageGoal: string
  tabs: ManualTabGuide[]
}

export const manualMeta = {
  updatedAt: '2026-03-21',
  targetVersion: 'groomer_app 0.0.1 / Next.js 16.1.6',
}

export const manualGlossary: GlossaryTerm[] = [
  { term: 'owner / admin / staff', meaning: '店舗の操作権限です。owner が最上位で、admin、staff の順に権限が制限されます。' },
  { term: 'ダッシュボード', meaning: '当日の予約件数や売上見込みなど、運用状況をまとめて確認する画面です。' },
  { term: 'タブ', meaning: '同じ画面内で表示内容を切り替える見出し（例: 新規登録 / 一覧）です。' },
  { term: '決済管理', meaning: '月額など継続請求の契約管理です。決済方法の設定や状態確認を行います。' },
  { term: '決済履歴', meaning: '課金状態の変更履歴、Webhook受信履歴、Checkout起動履歴を確認する画面です。' },
  { term: 'billing_status', meaning: '課金状態を表す項目です。active は利用可能、状態により利用制限が発生します。' },
  { term: 'trial / trial_days', meaning: '試用期間とその日数です。期限を超えると課金状態に応じて利用制限されます。' },
  { term: 'past_due / grace_days', meaning: '支払い遅延状態と猶予日数です。猶予を過ぎると利用停止対象になります。' },
  { term: 'Stripe / KOMOJU', meaning: '決済サービス提供元です。Stripe は主にカード決済、KOMOJU はキャリア決済などに対応します。' },
  { term: 'Webhook', meaning: '決済サービス側の状態変化を、システムへ自動通知する仕組みです。' },
  { term: 'Checkout', meaning: '外部決済ページへ遷移して支払い情報を入力する処理です。' },
  { term: 'status', meaning: '画面や一覧で使う状態欄です。処理の進み具合や利用可否を表し、画面ごとに意味が異なります。' },
  { term: 'LINE連携 / line_id', meaning: '顧客がLINEと連携済みかを表す項目です。連携済みなら line_id を使って通知送信できます。' },
  {
    term: 'LTV / LTVランク',
    meaning: '顧客の年間売上や来店回数から見た顧客価値の目安です。ゴールド / シルバー / ブロンズ / スタンダードで表示します。',
  },
  { term: 'member portal', meaning: '顧客向け会員ポータルです。会員証、来店履歴、次回予約導線を共有できます。' },
  { term: 'waitlist / 空き枠待ち', meaning: 'キャンセル枠や空き枠が出た際に優先案内する受付状態です。' },
  { term: 'storage policy', meaning: '容量超過時の動作方針です。block は保存停止、cleanup_orphans は孤立ファイル整理を優先します。' },
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
    path: '/settings?tab=setup-store',
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
      'owner 権限ユーザーは、サイドバーの「新しい店舗を追加」から同一アカウントで店舗を追加作成できます。',
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
      '「再来店フォロー」タブで、未着手件数・今日期限件数・離脱予兆（高/中）がある顧客を優先対応します。',
      '「空き枠再販」タブで、キャンセル枠に対する候補提示から送信起票・承認送信・受付完了までを実行します。',
    ],
    cautions: [
      '表示内容はアクティブ店舗のみです。',
      '再来店フォロー/空き枠再販は半自動運用です。候補抽出は自動ですが、起票・送信承認・状態更新は手動で行います。',
      '店舗切替直後は再読込後の店舗名を確認してください。',
    ],
  },
  {
    id: 'customers',
    title: '顧客管理',
    path: '/customers',
    purpose: '顧客情報を登録し、LINE連携状態・LTV・会員ポータル導線まで含めて管理します。',
    procedures: [
      '顧客一覧タブの「新規登録」から氏名、連絡先、属性情報を入力して登録します。',
      '顧客一覧タブで登録内容、LINE連携状態、LTVランク、会員ポータル発行状態を確認します。',
      '必要に応じて編集、空き枠待ち登録、会員ポータルURL発行を実行します。',
    ],
    cautions: [
      '氏名は必須です。',
      'タグはカンマ区切りで入力します。',
      'LTV表示は集計反映まで少し時間差が出る場合があります。',
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
      'スタッフ一覧タブの「新規登録」から氏名、メール、Auth User IDを入力して登録します。',
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
    title: '決済管理',
    path: '/billing?tab=management',
    purpose: '店舗の課金状態確認、決済開始、決済手段切替、返金/解約操作を行います。',
    procedures: [
      'owner 権限で決済管理ページを開き、現在の billing_status・試用終了予定・past_due猶予を確認します。',
      '「決済方法の選択」で Stripe（クレカ）または KOMOJU（キャリア決済）を選択し、Checkout を開始します。',
      '必要に応じて運用操作（優先決済手段切替 / refund_request / cancel_at_period_end / cancel_immediately）を実行します。',
      'プロバイダ別ステータスと最近のオペレーション履歴を確認します。',
    ],
    cautions: [
      'この画面は owner 権限のみ利用できます。',
      '課金状態は、未課金なら決済開始前、試用中なら無料利用期間中、利用可なら通常運用可能な状態です。',
      '支払い遅延・一時停止・解約済みは利用制限や確認が必要な状態として扱います。',
      '決済反映はWebhook経由のため、反映まで時間差が出る場合があります。',
    ],
  },
  {
    id: 'billing-history',
    title: '決済履歴',
    path: '/billing?tab=history',
    purpose: '課金状態の変更履歴、Webhook受信履歴、Checkout起動履歴を監査します。',
    procedures: [
      '決済履歴ページを開き、ステータス変更履歴（from/to/source/reason）を確認します。',
      'Webhook受信履歴で event_type・status・error を確認し、障害時は status=error の行を起点に provider・event_id・created_at を控えます。',
      'ステータス変更履歴で同時刻帯の source=webhook を確認し、Webhook受信後に billing_status が更新されたかを照合します。',
      'Checkout起動履歴で idempotency_key と session 状態を確認します。',
      '表示項目の意味: from=変更前、to=変更後、source=変更元、reason=理由、event_id=外部決済側イベントID、idempotency_key=重複実行防止キー。',
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
      '予約一覧タブの「新規登録」から顧客、ペット、担当、日時、メニューを入力して登録します。',
      '予約一覧タブで編集、申請確定（予約申請 -> 予約済）、削除を行います。',
      'カレンダータブで日付・担当ごとの予約状況を確認します。',
    ],
    cautions: [
      '開始/終了日時はJST想定で入力します。',
      '予約ステータスの目安: 予約申請=顧客申請直後、予約済=店舗確定済み、受付=来店受付済み、施術中=施術進行中、会計待ち=施術後未会計、完了=会計まで完了。',
      '顧客・ペット・スタッフ・メニューが未登録だと予約作成できません。',
    ],
  },
  {
    id: 'public-reserve',
    title: '公開予約フォーム（顧客向け）',
    path: '/reserve/[store_id]',
    purpose: '顧客が店舗公開URLから予約申請を送信します。',
    procedures: [
      '店舗側で店舗公開URL（/reserve/{store_id}）を顧客へ案内します。',
      '顧客がフォームで氏名・希望日時・ペット情報・施術メニューを入力して送信します。',
      '送信後は予約ステータス「予約申請」で登録されます。',
      '店舗側が予約一覧で「申請を確定」を実行すると「予約済」になります。',
    ],
    cautions: [
      '施術メニューは1件以上選択が必須です。',
      'フォーム送信後の内容変更・キャンセルは店舗へ直接連絡してもらう運用です。',
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
      '会計一覧タブの「新規登録」から予約を選択します。',
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
    id: 'ops-today',
    title: 'モバイル当日運用',
    path: '/ops/today',
    purpose: '当日予約のステータス更新をスマホ前提で実行します。',
    procedures: [
      '当日予約一覧を開始時刻順で確認します。',
      '状態ボタンで「受付 → 施術中 → 会計待ち → 完了」を順に進めます。',
      '必要に応じて会計・カルテ・顧客編集へ遷移します。',
      '完了後のみ差し戻し（完了 -> 会計待ち）を実行できます。',
    ],
    cautions: [
      '危険操作（完了/差し戻し）は確認ダイアログを確認して実行してください。',
      '進行ステータスの目安: 受付=来店チェック済み、施術中=施術開始済み、会計待ち=施術終了/会計待ち、完了=会計処理まで終了。',
      '未会計・カルテ未作成は警告表示されるため、終業前に解消してください。',
    ],
  },
  {
    id: 'dashboard-appointments-kpi',
    title: 'KPIレポート',
    path: '/dashboard/appointments-kpi',
    purpose: '予約運用のKPIを日次で確認します。',
    procedures: [
      '30日ウィンドウで受付件数、処理時間、再来店関連指標を確認します。',
      '直近7日チャートで増減傾向を把握します。',
      '遅延・見積誤差・差し戻し率が高い日の運用を見直します。',
    ],
    cautions: [
      '集計は日次バッチ結果を含むため、直近データは時間差が出る場合があります。',
      '店舗切替時は対象店舗のKPIであることを確認してください。',
    ],
  },
  {
    id: 'dashboard-notification-logs',
    title: '通知ログ',
    path: '/dashboard/notification-logs',
    purpose: '通知送信結果を検索・追跡します。',
    procedures: [
      '種別・チャネル・状態・キーワードでログを絞り込みます。',
      'failed/canceled を中心に失敗理由を確認します。',
      '対象顧客・予約・dedupe_key を控えて再送や運用対応へつなげます。',
    ],
    cautions: [
      '通知本文には個人情報が含まれるため、閲覧共有範囲を管理してください。',
      '送信ステータスの目安: queued=送信待ち、sent=送信成功、failed=送信失敗、canceled=送信中止。dedupe_key は重複送信防止の照合キーです。',
      '同一通知の再送前に dedupe_key と送信時刻を確認してください。',
    ],
  },
  {
    id: 'dashboard-audit-logs',
    title: '監査ログ',
    path: '/dashboard/audit-logs',
    purpose: '更新操作の履歴を監査します。',
    procedures: [
      'entity_type/action/検索語で対象操作を絞り込みます。',
      'before/after/payload を確認して変更差分を追跡します。',
      '必要に応じて操作時刻・操作者・対象IDを管理者へ共有します。',
    ],
    cautions: [
      '監査ログは改ざん防止のため運用上の正本です。削除前提で扱わないでください。',
      'member_portal_link など公開トークン系の記録は失効対応とセットで確認してください。',
    ],
  },
  {
    id: 'inventory',
    title: '在庫ダッシュボード',
    path: '/inventory',
    purpose: '不足・期限・入出庫状況を俯瞰し、在庫業務の入口として使います。',
    procedures: [
      '不足商品件数、期限切れ間近件数、本日入庫/出庫件数を確認します。',
      '不足アラートから在庫一覧または発注提案へ移動します。',
      '必要に応じて入庫登録/出庫登録を即時実行します。',
    ],
    cautions: [
      '在庫表示は movement 集計結果です。未登録の移動があると乖離します。',
      '不足判定は適正在庫基準のため、商品マスタの閾値整備が前提です。',
    ],
  },
  {
    id: 'inventory-products',
    title: '商品マスタ管理',
    path: '/inventory/products',
    purpose: '在庫管理の基礎となる商品情報を管理します。',
    procedures: [
      '商品名、単位、仕入先、適正在庫、発注点などを登録します。',
      '既存商品は一覧から編集し、運用終了品は無効化または削除します。',
      '登録後に在庫一覧/発注提案で計算結果を確認します。',
    ],
    cautions: [
      '単位変更は過去履歴の解釈に影響するため、運用ルールを統一してください。',
      '発注点・適正在庫が未設定だと不足判定の精度が下がります。',
    ],
  },
  {
    id: 'inventory-stocks',
    title: '在庫一覧',
    path: '/inventory/stocks',
    purpose: '現在庫と適正在庫を比較し、不足状況を確認します。',
    procedures: [
      '全件/不足のみを切り替えて対象商品を確認します。',
      '現在庫と適正在庫の差分を確認します。',
      '必要に応じてCSV出力して棚卸資料として利用します。',
    ],
    cautions: [
      '在庫数は入出庫登録に依存します。運用漏れがあると実在庫と一致しません。',
      'CSV出力時は共有先の取り扱い権限を確認してください。',
    ],
  },
  {
    id: 'inventory-inbounds',
    title: '入庫登録',
    path: '/inventory/inbounds',
    purpose: '仕入・返品受入などの入庫を登録します。',
    procedures: [
      '商品、数量、単価、理由、ロット、有効期限を入力して登録します。',
      '登録後に最新の入庫履歴に反映されたことを確認します。',
      '必要に応じて在庫一覧で増加分を確認します。',
    ],
    cautions: [
      '数量は正の値で入力してください。',
      '単価未入力が続くと在庫資産レポートの精度が下がります。',
    ],
  },
  {
    id: 'inventory-outbounds',
    title: '出庫登録',
    path: '/inventory/outbounds',
    purpose: '施術利用・店販売上・廃棄などの出庫を登録します。',
    procedures: [
      '商品、数量、出庫理由、実施日、備考を入力して登録します。',
      '登録後に最新の出庫履歴を確認します。',
      '不足警告が出た場合は発注提案へ進みます。',
    ],
    cautions: [
      '理由分類はレポート集計に使うため、運用ルールどおり選択してください。',
      '過大出庫を登録すると在庫が負になるため、登録前に数量確認が必要です。',
    ],
  },
  {
    id: 'inventory-stocktake',
    title: '棚卸',
    path: '/inventory/stocktake',
    purpose: '帳簿在庫と実在庫の差異を調整します。',
    procedures: [
      '商品を選択し、実在庫数量と理由を入力して差異を反映します。',
      '登録後に棚卸調整履歴を確認します。',
      '必要に応じて原因分析を行い入出庫運用を改善します。',
    ],
    cautions: [
      '棚卸調整は監査対象です。理由を具体的に残してください。',
      '短期間の連続調整は入力ミスの可能性があるため再確認してください。',
    ],
  },
  {
    id: 'inventory-history',
    title: '在庫履歴',
    path: '/inventory/history',
    purpose: '入庫・出庫・棚卸調整の履歴を時系列で確認します。',
    procedures: [
      '最新100件を日時順に確認します。',
      '区分・数量・理由を見て異常な変動を特定します。',
      '必要に応じて担当者へ事実確認を行います。',
    ],
    cautions: [
      '履歴は更新操作の証跡です。値だけでなく理由欄もセットで確認してください。',
      '商品名が不明な行は削除済み商品の可能性があるため、監査ログを併用してください。',
    ],
  },
  {
    id: 'inventory-reorder-suggestions',
    title: '発注提案一覧',
    path: '/inventory/reorder-suggestions',
    purpose: '不足リスクを基に発注候補を作成します。',
    procedures: [
      '優先度順の提案商品を確認します。',
      '仕入先ごとに対象商品を選び、数量・単価を調整します。',
      '選択商品から発注ドラフトを作成して発注管理へ引き継ぎます。',
    ],
    cautions: [
      '推奨数量は補助値です。実在庫・入荷予定を考慮して調整してください。',
      'チェックを外した商品はドラフトに含まれません。',
    ],
  },
  {
    id: 'inventory-purchase-orders',
    title: '発注管理',
    path: '/inventory/purchase-orders',
    purpose: '発注書の作成・状態管理・明細管理を行います。',
    procedures: [
      '仕入先、状態、日付、金額を入力して発注を作成します。',
      '一覧から状態を更新し、必要時は削除します。',
      '発注明細を追加・削除して内容を確定します。',
    ],
    cautions: [
      '状態(status)の目安: draft=下書き、ordered=発注済、received=入荷済、canceled=キャンセル。',
      'status=received への変更時は実入庫との整合を確認してください。',
      '明細の数量/単価は会計照合に使うため、確定前に再確認してください。',
    ],
  },
  {
    id: 'inventory-reports',
    title: '在庫レポート',
    path: '/inventory/reports',
    purpose: '30日単位の在庫推移とカテゴリ別利用量を確認します。',
    procedures: [
      '30日入庫量・出庫量・在庫資産概算・在庫ゼロ件数を確認します。',
      'カテゴリ別出庫量から消費傾向を把握します。',
      '不足リスクが高いカテゴリの補充計画を見直します。',
    ],
    cautions: [
      '在庫資産は入庫単価ベースの概算値です。',
      'カテゴリ未設定商品は「未分類」に集約されるため、商品マスタ整備が必要です。',
    ],
  },
  {
    id: 'settings-public-reserve',
    title: '公開予約設定',
    path: '/settings?tab=public-reserve',
    purpose: '公開予約の枠ルール・閾値・例外日を店舗ごとに設定します。',
    procedures: [
      '競合率/偏り率の警告閾値を設定します。',
      '公開日数、バッファ、営業時間、最小リード時間を設定します。',
      '除外日を1行1日で登録します。',
    ],
    cautions: [
      'owner/admin 以外は閲覧のみです。',
      '設定変更は公開予約枠に即時影響するため、変更日時を運用共有してください。',
    ],
  },
  {
    id: 'hotel',
    title: 'ペットホテル管理',
    path: '/hotel',
    purpose: '時間預かりと宿泊を同じ台帳で管理し、定員・送迎・料金内訳をまとめて確認します。',
    procedures: [
      '一覧または週カレンダーで対象日と定員状況を確認します。',
      '新規登録または編集で顧客、ペット、ステータス、予定/実績時刻、送迎有無、宿泊メニューを入力します。',
      '保存後に stay_code、料金合計、定員対象項目、ワクチン期限を確認します。',
    ],
    cautions: [
      'ホテル機能は対象プランかつホテルオプション有効店舗のみ利用できます。',
      '状態欄は「予約済み / チェックイン済み / チェックアウト済み / キャンセル / 無断キャンセル」と表示されます。',
      'counts_toward_capacity が有効な明細は定員計算に含まれます。',
    ],
  },
  {
    id: 'settings-storage',
    title: '容量設定',
    path: '/settings?tab=storage',
    purpose: '写真カルテなどの使用容量を確認し、超過時の動作と追加容量を管理します。',
    procedures: [
      '現在の使用量、基本上限、追加容量、使用率バーを確認します。',
      '必要に応じて超過時の動作方針、追加容量、カスタム上限を設定して保存します。',
      '容量不足が続く場合は追加課金を開始し、Webhook反映後に上限更新を確認します。',
    ],
    cautions: [
      'この画面は owner 権限のみ利用できます。',
      'usageWarning が表示される場合、使用量は概算または一部取得失敗の可能性があります。',
      'cleanup_orphans を選んでも参照中ファイルは削除されませんが、整理前に関係者へ共有してください。',
    ],
  },
  {
    id: 'support-tickets',
    title: '問い合わせチケット',
    path: '/support-tickets',
    purpose: '運用課題をチケット化し、開発側とのやり取りを記録します。',
    procedures: [
      '件名・詳細・カテゴリ・優先度を入力して起票します。',
      '一覧でステータスと履歴を確認します。',
      '必要に応じてコメントを追記します。',
    ],
    cautions: [
      '再現手順と発生時刻を含めると対応が早くなります。',
      '同一事象は既存チケットへ追記し、重複起票を避けてください。',
    ],
  },
  {
    id: 'hq',
    title: '本部ダッシュボード',
    path: '/hq',
    purpose: '複数店舗の30日実績を横断比較します。',
    procedures: [
      '対象店舗数、予約件数、売上、監査件数を確認します。',
      '店舗比較テーブルで完了率・キャンセル率・売上を比較します。',
      '権限監査サマリーで主要アクションを確認します。',
    ],
    cautions: [
      'owner/admin の所属店舗のみ対象です。',
      '本部表示は閲覧系集計です。個店修正は各店舗画面で実施してください。',
    ],
  },
  {
    id: 'hq-menu-templates',
    title: 'テンプレ配信リクエスト',
    path: '/hq/menu-templates',
    purpose: '施術メニューのテンプレ配信リクエストを作成します。',
    procedures: [
      'owner 対象店舗を確認します。',
      '配信リクエストフォームで配信元/配信先/上書き範囲を指定します。',
      '送信後は配信承認画面でステータスを確認します。',
    ],
    cautions: [
      'この操作は owner のみ可能です。',
      '配信元のサンプルメニュー内容を確認してから申請してください。',
    ],
  },
  {
    id: 'hq-menu-template-deliveries',
    title: 'テンプレ配信承認',
    path: '/hq/menu-template-deliveries',
    purpose: 'テンプレ配信リクエストの承認・適用を管理します。',
    procedures: [
      '配信リクエスト一覧で source/target/status を確認します。',
      '承認権限がある場合は承認アクションを実行します。',
      '適用時刻を確認して対象店舗へ展開結果を共有します。',
    ],
    cautions: [
      'admin は閲覧のみで承認不可です（権限条件に依存）。',
      '誤承認防止のため target_store_ids を確認してから実行してください。',
    ],
  },
  {
    id: 'invite-accept',
    title: '招待受諾',
    path: '/invite/[token]',
    purpose: '招待URLから店舗参加を受諾します。',
    procedures: [
      '招待URLを開き、ログインまたは新規登録を行います。',
      '受諾確認画面で内容を確認して参加を確定します。',
      '受諾後にスタッフ一覧で所属反映を確認します。',
    ],
    cautions: [
      '招待先メールアドレスとログインメールアドレスの一致が必須です。',
      '期限切れトークンは再発行が必要です。',
    ],
  },
  {
    id: 'billing-required',
    title: '課金設定必須画面',
    path: '/billing-required',
    purpose: '課金未設定または課金停止時の導線ページです。',
    procedures: [
      '表示メッセージを確認し、決済方法を選択します。',
      'Checkout 完了後、反映待ちのうえ通常画面へ戻ります。',
      '解消しない場合は owner/admin へ連絡します。',
    ],
    cautions: [
      'Webhook反映まで数分の遅延が出る場合があります。',
      '課金未解消のままでは業務画面へ遷移できません。',
    ],
  },
  {
    id: 'billing-success',
    title: '課金処理受付完了',
    path: '/billing/success',
    purpose: '決済処理受付後の待機ページです。',
    procedures: [
      '決済受付メッセージを確認します。',
      'ダッシュボードへ戻って利用可否を確認します。',
      '未反映時は課金設定必須画面へ戻って再確認します。',
    ],
    cautions: [
      'この画面表示時点では billing_status 反映前の可能性があります。',
      '連続決済操作は履歴確認後に実施してください。',
    ],
  },
  {
    id: 'member-portal-shared',
    title: '会員ポータル（顧客向け）',
    path: '/shared/member-portal/[token]',
    purpose: '顧客が会員証・次回予約・来店履歴を閲覧します。',
    procedures: [
      '受け取ったトークンURLを開きます。',
      '会員証、有効期限、次回予約、次回来店案内、履歴を確認します。',
      '必要に応じて同画面の予約ボタンから公開予約へ進みます。',
    ],
    cautions: [
      '無効/期限切れトークンでは閲覧できません。',
      '表示URLは本人用のため、第三者共有を避けてください。',
    ],
  },
  {
    id: 'medical-records-shared',
    title: '写真カルテ共有（顧客向け）',
    path: '/shared/medical-records/[token]',
    purpose: '共有リンクで施術前後写真を閲覧します。',
    procedures: [
      '共有URLを開きます。',
      '施術前・施術後の写真と撮影日時を確認します。',
      '必要に応じて店舗へ質問や追加依頼を行います。',
    ],
    cautions: [
      '期限切れまたは失効済みリンクは表示できません。',
      'URLを知る第三者が閲覧できるため、管理に注意してください。',
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
  {
    id: 'flow-ops-today',
    title: '当日運用フロー（モバイル）',
    goal: '当日予約の進行管理をモバイルで完結します。',
    sectionIds: ['dashboard', 'ops-today', 'payments', 'medical-records'],
  },
  {
    id: 'flow-dashboard-monitoring',
    title: '運用監視フロー',
    goal: '日次運用のKPI・通知・監査ログを確認します。',
    sectionIds: ['dashboard', 'dashboard-appointments-kpi', 'dashboard-notification-logs', 'dashboard-audit-logs'],
  },
  {
    id: 'flow-inventory',
    title: '在庫運用フロー',
    goal: '商品管理から入出庫、棚卸、発注、分析までを実施します。',
    sectionIds: ['inventory-products', 'inventory', 'inventory-inbounds', 'inventory-outbounds', 'inventory-stocktake', 'inventory-reorder-suggestions', 'inventory-purchase-orders', 'inventory-reports'],
  },
  {
    id: 'flow-public-reserve-settings',
    title: '公開予約設定フロー',
    goal: '公開枠の運用ルールを設定し、予約品質を維持します。',
    sectionIds: ['settings-public-reserve', 'public-reserve', 'appointments'],
  },
  {
    id: 'flow-hotel',
    title: 'ホテル運用フロー',
    goal: '預かり予約の登録から定員確認、チェックアウトまでを一貫して管理します。',
    sectionIds: ['customers', 'pets', 'hotel', 'payments'],
  },
  {
    id: 'flow-storage',
    title: '容量運用フロー',
    goal: '写真保存容量を監視し、超過前に方針設定と追加容量手配を行います。',
    sectionIds: ['medical-records', 'settings-storage', 'billing'],
  },
  {
    id: 'flow-support',
    title: '問い合わせ対応フロー',
    goal: '問い合わせ起票とコミュニケーションを記録しながら進めます。',
    sectionIds: ['support-tickets'],
  },
  {
    id: 'flow-hq',
    title: '本部運用フロー',
    goal: '本部視点で店舗比較し、テンプレ配信を統制します。',
    sectionIds: ['hq', 'hq-menu-templates', 'hq-menu-template-deliveries'],
  },
  {
    id: 'flow-token-shared',
    title: '共有リンク運用フロー',
    goal: '顧客向け共有ページを安全に案内します。',
    sectionIds: ['member-portal-shared', 'medical-records-shared', 'invite-accept'],
  },
  {
    id: 'flow-billing-blocked',
    title: '課金制限解除フロー',
    goal: '課金制限状態から業務画面へ復帰します。',
    sectionIds: ['billing-required', 'billing-success', 'billing', 'billing-history'],
  },
]

export const manualSectionGuides: Record<string, ManualSectionGuide> = {
  login: {
    flow: ['利用タイミング: 業務開始時。', '前提: アカウント作成済み。', '次に行う操作: 店舗未所属なら店舗セットアップ、所属済みならダッシュボード確認。'],
    itemDetails: [
      { item: 'メールアドレス', detail: '招待受諾時は、招待先と同じメールアドレスを入力します。' },
      { item: 'パスワード', detail: '登録時に設定した文字列を入力します。複数回失敗した場合は入力ミスを再確認します。' },
      { item: 'ログインボタン', detail: '認証成功後に自動遷移します。遷移先が想定外の場合は店舗所属状態を確認します。' },
    ],
  },
  signup: {
    flow: ['利用タイミング: 初回利用時。', '前提: 招待URLがある場合は先に開いておく。', '次に行う操作: ログイン後に店舗作成または招待受諾。'],
    itemDetails: [
      { item: 'メールアドレス', detail: '既存登録済みメールは使用できません。招待受諾予定なら招待先アドレスを使います。' },
      { item: 'パスワード', detail: '以降のログインで利用します。運用端末の共有を避け、個人単位で管理します。' },
      { item: '登録するボタン', detail: '押下後に登録処理を実行します。メール確認設定の有無で遷移先が変わります。' },
    ],
  },
  'setup-store': {
    flow: ['利用タイミング: 初回ログイン直後で店舗未所属のとき。', '前提: owner として店舗を作成する運用方針が決まっている。', '次に行う操作: メニュー・スタッフ・招待の初期設定。'],
    itemDetails: [
      { item: '店舗名', detail: '管理画面表示名として使われます。識別しやすい名称を設定します。' },
      { item: 'Webで店舗を作成', detail: '店舗本体と作成者の所属情報を同時に作成します。' },
      { item: '作成完了後の状態', detail: '作成者は owner 権限になります。サイドバー表示店舗名を確認してから運用開始します。' },
    ],
  },
  'store-switcher': {
    flow: ['利用タイミング: 複数店舗所属ユーザーが店舗をまたいで作業するとき。', '前提: 対象店舗へ所属済み。', '次に行う操作: 切替後に対象ページを再確認して入力開始。'],
    itemDetails: [
      { item: '店舗セレクト', detail: '選択した店舗が全画面のデータ取得対象になります。' },
      { item: '再読込', detail: '切替時に画面を再読込して店舗コンテキストを反映します。' },
      { item: '店舗名表示', detail: '保存前の最終確認ポイントです。誤店舗入力防止のチェックとして必ず見ます。' },
    ],
  },
  'multi-store-single-user': {
    flow: ['利用タイミング: 1アカウントで複数店舗を運用するとき。', '前提: owner 権限または招待受諾で複数店舗に所属している。', '次に行う操作: 店舗ごとに同一の締め手順を実施。'],
    itemDetails: [
      { item: '新しい店舗を追加', detail: '同一アカウントのまま別店舗を追加作成できます（ownerのみ）。' },
      { item: '招待URL受諾', detail: '既存店舗参加は同メールアドレスで受諾し、所属を追加します。' },
      { item: '店舗別確認', detail: '一覧画面で対象店舗のデータだけが表示されることを確認してから更新します。' },
    ],
  },
  dashboard: {
    flow: ['利用タイミング: 出勤直後と都度の進捗確認。', '前提: 正しい店舗に切り替え済み。', '次に行う操作: 予約・会計・カルテなど必要画面へ遷移。'],
    itemDetails: [
      { item: 'KPIカード', detail: '予約件数、来店済み件数、売上関連値を当日単位で確認できます。' },
      { item: '30分以内の予約', detail: '直近対応が必要な予約を優先表示します。' },
      { item: '未会計アラート', detail: '会計漏れ候補へ直接遷移し、締め漏れを防ぎます。' },
      { item: '再来店フォローを開く条件', detail: '未着手件数>0、今日期限>0、または離脱予兆（高/中）が出たときに優先して開きます。' },
      { item: '再来店フォローの半自動範囲', detail: '候補抽出は自動、キュー追加・担当割当・対応中/保留/不要/失注/予約化への更新は手動です。' },
      { item: '空き枠再販を開く条件', detail: 'キャンセルが発生し空き枠化したとき、または再販受付件数・予約化率が低下したときに開きます。' },
      { item: '空き枠再販の半自動範囲', detail: '候補提示は自動、送信起票・承認送信・受付完了/期限切れ/取り下げは手動です。accepted時は同枠の他候補が自動クローズされます。' },
    ],
  },
  customers: {
    flow: ['利用タイミング: 新規来店前の顧客登録、または既存顧客情報更新時。', '前提: 対象店舗が正しいことを確認済み。', '次に行う操作: ペット登録、予約登録へ進む。'],
    itemDetails: [
      { item: '氏名', detail: '必須項目です。検索や一覧表示の基準になります。' },
      { item: '連絡先', detail: '電話・メールなど、連絡導線として使う情報を入力します。' },
      { item: 'LINE連携状態', detail: 'line_id の有無で連携済み/未連携を判断します。LINE送信前に確認します。' },
      { item: 'LTVサマリー', detail: '年間売上、来店回数、平均単価、オプション利用率、LTVランクを確認できます。' },
      { item: '会員ポータル', detail: '顧客向け会員証URLを発行し、最終利用日時も確認できます。' },
      { item: 'タグ', detail: 'カンマ区切りで管理し、再来店施策や一覧フィルタに活用します。' },
    ],
  },
  pets: {
    flow: ['利用タイミング: 顧客に紐づくペットを追加・更新するとき。', '前提: 顧客情報が登録済み。', '次に行う操作: 予約登録、カルテ記録へ進む。'],
    itemDetails: [
      { item: '飼い主', detail: '既存顧客から選択します。ペット単体では登録できません。' },
      { item: '基本情報', detail: '犬種・性別・誕生日など、施術判断に必要な情報を保存します。' },
      { item: '健康情報', detail: '体重、ワクチン、持病、注意事項を運用ルールに沿って記録します。' },
    ],
  },
  staffs: {
    flow: ['利用タイミング: スタッフ追加、権限見直し、退職対応時。', '前提: owner/admin の運用権限がある。', '次に行う操作: 必要に応じて招待発行またはロール変更。'],
    itemDetails: [
      { item: '氏名・メール', detail: 'スタッフ識別と招待受諾時の照合に使います。' },
      { item: 'Auth User ID', detail: '認証ユーザーとの紐付けに使います。未連携時は確認して更新します。' },
      { item: 'ロール変更', detail: 'owner のみが実施できます。最後の owner は降格できません。' },
    ],
  },
  'store-invites': {
    flow: ['利用タイミング: 新規スタッフを店舗へ参加させるとき。', '前提: 招待発行者が owner または admin。', '次に行う操作: 受諾完了を確認してスタッフ一覧を更新。'],
    itemDetails: [
      { item: '招待メールアドレス', detail: '受諾時ログインアドレスとの一致が必須です。' },
      { item: '招待ロール', detail: 'admin または staff を選択します。owner は招待できません。' },
      { item: '招待URL', detail: '有効期限は7日間です。期限切れ時は再発行します。' },
    ],
  },
  billing: {
    flow: ['利用タイミング: 課金開始、遅延対応、解約判断時。', '前提: owner 権限でログイン済み。', '次に行う操作: 履歴画面で反映監査、必要ならサポート連携。'],
    itemDetails: [
      { item: 'billing_status表示', detail: '利用可否に直結する最重要項目です。trial期限や猶予日数と合わせて確認します。' },
      { item: '課金状態', detail: '未課金は決済未開始、試用中は無料利用期間中、利用可は通常運用可能、支払い遅延は猶予確認が必要、一時停止は一時的な利用制限、解約済みは契約終了状態です。' },
      { item: '決済方法選択', detail: 'Stripe/KOMOJUを選び、Checkoutへ遷移して決済を開始します。' },
      { item: '運用操作ボタン', detail: '優先決済手段切替、返金依頼、期間末解約、即時解約を実行します。' },
    ],
  },
  'billing-history': {
    flow: ['利用タイミング: 課金不整合や障害調査時。', '前提: owner 権限で対象店舗を選択済み。', '次に行う操作: provider/event_id を添えて管理者へ共有。'],
    itemDetails: [
      { item: 'ステータス変更履歴', detail: 'from/to/source/reason で状態遷移の妥当性を確認します。' },
      { item: '記号項目の意味', detail: 'from=変更前、to=変更後、source=変更元、reason=理由、event_id=外部決済側イベントID。' },
      { item: 'Webhook受信履歴', detail: 'status=error を起点に event_id と created_at を控えて調査します。' },
      { item: 'Checkout起動履歴', detail: 'idempotency_key と session 状態で二重実行や未完了を確認します。' },
    ],
  },
  'service-menus': {
    flow: ['利用タイミング: 施術メニュー新設・改定時。', '前提: 価格と税区分の運用ルールが確定済み。', '次に行う操作: 予約・会計画面で利用状態を確認。'],
    itemDetails: [
      { item: 'メニュー名', detail: '予約・会計・領収書に表示される名称です。店舗内で統一します。' },
      { item: '価格', detail: '会計金額の計算に使います。税込/税別運用と矛盾しない値を設定します。' },
      { item: '所要時間', detail: '予約枠計算に影響します。実運用の平均時間を基準に設定します。' },
    ],
  },
  appointments: {
    flow: ['利用タイミング: 予約登録・調整・確定を行うとき。', '前提: 顧客・ペット・スタッフ・メニューが登録済み。', '次に行う操作: 当日運用、会計、カルテ記録へ連携。'],
    itemDetails: [
      { item: '新規登録フォーム', detail: '顧客、ペット、担当、開始/終了、メニューを入力して予約作成します。' },
      { item: '申請を確定', detail: '公開予約の「予約申請」を店舗確定して「予約済」に更新します。' },
      { item: '予約ステータスの意味', detail: '予約申請=顧客申請、予約済=店舗確定、受付=来店チェック済み、施術中=施術進行中、会計待ち=施術後未会計、完了=会計完了。' },
      { item: 'カレンダータブ', detail: '日付・担当単位で重複や空き状況を確認します。' },
    ],
  },
  'public-reserve': {
    flow: ['利用タイミング: 顧客がWebから予約申請するとき。', '前提: 店舗側で公開URLを案内済み。', '次に行う操作: 店舗側が予約申請を確認して確定。'],
    itemDetails: [
      { item: '顧客情報入力', detail: '氏名と連絡先を入力します。店舗照会の基本情報になります。' },
      { item: 'ペット情報入力', detail: '対象ペットの識別情報を入力します。初回来店時のヒアリング負荷を減らします。' },
      { item: '施術メニュー選択', detail: '1件以上必須です。所要時間計算と受入可否判断に使います。' },
      { item: 'キャンセルURL表示', detail: '送信後に表示されるURLは顧客側で保管します。再表示はできません。' },
    ],
  },
  'public-reserve-cancel': {
    flow: ['利用タイミング: 顧客都合で公開予約を取り消すとき。', '前提: 予約送信時に発行されたキャンセルURLを保持している。', '次に行う操作: 店舗側でカレンダー・一覧反映を確認。'],
    itemDetails: [
      { item: 'キャンセルトークン', detail: 'URL内トークンで対象予約を特定します。無効期限・無効化状態に注意します。' },
      { item: 'キャンセル実行', detail: '実行後はステータスがキャンセルに更新されます。' },
      { item: '結果表示', detail: '失敗時はトークン不正や既キャンセルの可能性があるため再予約を案内します。' },
    ],
  },
  'medical-records': {
    flow: ['利用タイミング: 施術終了後の記録、または経過確認時。', '前提: 対象ペットと予約情報が特定できている。', '次に行う操作: 次回来店時の引継ぎ、必要に応じて共有リンク発行。'],
    itemDetails: [
      { item: '基本情報（ペット/担当/日時/メニュー）', detail: '履歴検索と担当引継ぎの軸となるため正確に入力します。' },
      { item: '皮膚状態・行動メモ', detail: '次回施術時に再利用するため、観察結果を具体的に記録します。' },
      { item: '写真', detail: '状態比較に使うため、撮影日と文脈が分かる形で保存します。' },
    ],
  },
  visits: {
    flow: ['利用タイミング: 来店実績の確認・補正時。', '前提: 会計確定データまたは手動登録情報が存在する。', '次に行う操作: 再来店分析や通知施策へ活用。'],
    itemDetails: [
      { item: '自動作成来店履歴', detail: '会計確定時に予約から自動生成されます。運用上は手動重複登録を避けます。' },
      { item: '手動登録', detail: '予約なし来店や過去補正で使用します。理由を備考に残す運用を推奨します。' },
      { item: '一覧編集', detail: '誤登録時に編集・削除できます。変更時は関連会計との整合を確認します。' },
    ],
  },
  payments: {
    flow: ['利用タイミング: 施術後の会計確定時。', '前提: 対象予約にメニューが設定済み。', '次に行う操作: 領収書発行と来店履歴確認。'],
    itemDetails: [
      { item: '予約選択', detail: '会計対象予約を選び、内訳を自動反映します。' },
      { item: '支払方法', detail: '現金・カードなど運用区分に合わせて入力し、日次集計に反映します。' },
      { item: '割引・備考', detail: '値引き理由や特記事項を残し、後日の照会に備えます。' },
      { item: '会計確定', detail: '保存後に来店履歴が自動作成され、領収書出力が可能になります。' },
    ],
  },
  receipts: {
    flow: ['利用タイミング: 会計確定後の控え発行時。', '前提: payment_id が存在し、会計データが確定している。', '次に行う操作: 印刷配布またはPDF保存（ブラウザ機能）。'],
    itemDetails: [
      { item: '宛名', detail: '顧客希望の名義に誤りがないか最終確認します。' },
      { item: '内訳/合計', detail: 'メニュー単価、税、割引、合計の整合を確認します。' },
      { item: '印刷ボタン', detail: 'ブラウザ印刷を起動します。用紙設定と余白を確認して出力します。' },
    ],
  },
  'ops-today': {
    flow: ['利用タイミング: 当日施術の進行管理時。', '前提: 当日予約が登録済み。', '次に行う操作: 会計/カルテ/顧客導線を使って処理完了。'],
    itemDetails: [
      { item: 'ステータス更新ボタン', detail: '「受付→施術中→会計待ち→完了」の直列で進行します。' },
      { item: '進行ステータスの意味', detail: '受付=来店チェック済み、施術中=施術開始済み、会計待ち=施術終了/会計待ち、完了=会計まで完了。' },
      { item: '差し戻し', detail: '完了時のみ会計待ちへ1段階戻せます。' },
      { item: '警告バッジ', detail: '未会計・カルテ未作成を検知し、締め漏れを防ぎます。' },
    ],
  },
  'dashboard-appointments-kpi': {
    flow: ['利用タイミング: 日次・週次レビュー時。', '前提: 予約実績データが蓄積済み。', '次に行う操作: 運用改善タスクへ反映。'],
    itemDetails: [
      { item: 'フォーム入力KPI', detail: '入力時間やクリック数を確認し、受付導線を改善します。' },
      { item: '施術時間KPI', detail: '見積との差を把握してメニュー時間設定を調整します。' },
      { item: '再来店/NoShow指標', detail: '再来店漏れや無断キャンセル傾向を追跡します。' },
    ],
  },
  'dashboard-notification-logs': {
    flow: ['利用タイミング: 通知失敗時の調査。', '前提: 対象期間の通知履歴がある。', '次に行う操作: 再送または顧客連絡へ切替。'],
    itemDetails: [
      { item: '絞り込みフォーム', detail: '種別・チャネル・状態・検索語で対象ログを圧縮します。' },
      { item: '送信ステータス', detail: 'sent/failed/queued/canceled を色付きで判別します。' },
      { item: '送信ステータスの意味', detail: 'queued=送信待ち、sent=送信成功、failed=送信失敗、canceled=送信中止。' },
      { item: 'dedupe_key', detail: '同一通知の重複送信を防ぐための一意キーです。再送時の照合に使います。' },
      { item: '失敗サマリー', detail: 'notification_type と失敗理由の件数を確認します。' },
    ],
  },
  'dashboard-audit-logs': {
    flow: ['利用タイミング: 変更履歴確認・障害調査時。', '前提: 対象店舗を選択済み。', '次に行う操作: 必要なら運用是正や権限見直し。'],
    itemDetails: [
      { item: '対象/操作フィルタ', detail: 'entity_type と action で履歴を絞り込みます。' },
      { item: 'before/after', detail: '更新前後の差分を確認します。' },
      { item: 'payload', detail: '操作理由や補足情報を JSON で確認します。' },
    ],
  },
  inventory: {
    flow: ['利用タイミング: 在庫業務の開始時。', '前提: 商品マスタ整備済み。', '次に行う操作: 入庫/出庫/発注提案へ遷移。'],
    itemDetails: [
      { item: '不足商品カード', detail: '適正在庫未満の商品件数を表示します。' },
      { item: '期限切れ間近カード', detail: '14日以内期限商品の対象数を表示します。' },
      { item: 'クイック導線', detail: '発注提案、入庫登録、出庫登録に即移動できます。' },
    ],
  },
  'inventory-products': {
    flow: ['利用タイミング: 商品追加・改定時。', '前提: 在庫運用ルールが定義済み。', '次に行う操作: 在庫計算/発注提案へ反映確認。'],
    itemDetails: [
      { item: '基本情報', detail: '商品名、カテゴリ、単位、仕入先を登録します。' },
      { item: '在庫パラメータ', detail: '適正在庫・発注点・リードタイムで提案精度を調整します。' },
      { item: '有効/無効', detail: '運用対象外の商品を無効化できます。' },
    ],
  },
  'inventory-stocks': {
    flow: ['利用タイミング: 在庫確認時。', '前提: 入出庫データが更新済み。', '次に行う操作: 不足商品への補充判断。'],
    itemDetails: [
      { item: '全件/不足のみ', detail: '閲覧対象を切り替え、対応優先度を整理します。' },
      { item: '現在庫/適正在庫', detail: '不足判定の根拠として比較表示します。' },
      { item: 'CSV出力', detail: '棚卸や発注会議向けにデータを出力します。' },
    ],
  },
  'inventory-inbounds': {
    flow: ['利用タイミング: 仕入受入時。', '前提: 商品がマスタ登録済み。', '次に行う操作: 在庫一覧で増加確認。'],
    itemDetails: [
      { item: '商品・数量', detail: 'どの商品をどれだけ入庫したかを記録します。' },
      { item: '単価・ロット・期限', detail: '仕入管理と期限管理のために入力します。' },
      { item: '入庫履歴', detail: '直近20件を確認して二重登録を防ぎます。' },
    ],
  },
  'inventory-outbounds': {
    flow: ['利用タイミング: 消費・販売・廃棄発生時。', '前提: 対象商品が在庫管理対象。', '次に行う操作: 在庫不足時は発注提案へ。'],
    itemDetails: [
      { item: '出庫理由', detail: '施術利用/店販売上/廃棄/その他から選択します。' },
      { item: '数量', detail: '実際の出庫数を入力し、在庫を減算します。' },
      { item: '出庫履歴', detail: '時系列で履歴確認し異常出庫を検出します。' },
    ],
  },
  'inventory-stocktake': {
    flow: ['利用タイミング: 定期棚卸または差異発見時。', '前提: 帳簿在庫が計算済み。', '次に行う操作: 差異原因の再発防止。'],
    itemDetails: [
      { item: '帳簿在庫表示', detail: '商品選択時に現在の帳簿在庫を参照できます。' },
      { item: '実在庫入力', detail: '実数を入力すると差分が自動調整されます。' },
      { item: '理由', detail: '監査対応のため調整理由を必ず残します。' },
    ],
  },
  'inventory-history': {
    flow: ['利用タイミング: 在庫変動の追跡時。', '前提: 入出庫または棚卸が実施済み。', '次に行う操作: 必要なら原因調査。'],
    itemDetails: [
      { item: '区分', detail: '入庫/出庫/棚卸調整を識別します。' },
      { item: '数量差分', detail: '正負付きで在庫増減を確認します。' },
      { item: '理由', detail: '運用背景を追跡し、異常値の説明に使います。' },
    ],
  },
  'inventory-reorder-suggestions': {
    flow: ['利用タイミング: 発注計画作成時。', '前提: 在庫と商品パラメータが更新済み。', '次に行う操作: 発注ドラフト生成。'],
    itemDetails: [
      { item: '優先度', detail: 'priority_rank が小さいほど対応優先です。' },
      { item: '選択チェック', detail: 'ドラフトに含める商品を制御します。' },
      { item: '推奨数量/単価', detail: '初期値を調整して実発注条件に合わせます。' },
    ],
  },
  'inventory-purchase-orders': {
    flow: ['利用タイミング: 発注実行時。', '前提: 仕入先と発注明細が確定。', '次に行う操作: 入荷後に在庫反映。'],
    itemDetails: [
      { item: '発注ヘッダ', detail: '発注番号、仕入先、日付、ステータスを管理します。' },
      { item: 'ステータス更新', detail: 'draft/ordered/received/canceled を更新します。' },
      { item: 'ステータスの意味', detail: 'draft=下書き、ordered=発注済、received=入荷済、canceled=キャンセル。' },
      { item: '発注明細', detail: '商品、数量、単価を行単位で追加・削除します。' },
    ],
  },
  'inventory-reports': {
    flow: ['利用タイミング: 月次レビュー時。', '前提: 30日分の移動データが存在。', '次に行う操作: 発注点や在庫方針を見直し。'],
    itemDetails: [
      { item: '30日入出庫量', detail: '最近の消費と補充バランスを確認します。' },
      { item: '在庫資産（概算）', detail: '入庫単価ベースで在庫金額を概算します。' },
      { item: 'カテゴリ別出庫量', detail: '消費カテゴリの偏りを把握します。' },
    ],
  },
  hotel: {
    flow: ['利用タイミング: 預かり予約登録、当日受入、チェックアウト時。', '前提: ホテル機能が有効で、対象顧客とペットが登録済み。', '次に行う操作: 会計または次回予約へ進む。'],
    itemDetails: [
      { item: '状態欄', detail: '予約済みは来店前の受付待ち、チェックイン済みは預かり中、チェックアウト済みは退店処理完了、キャンセルは事前取り消し、無断キャンセルは連絡なく来店しなかった状態です。' },
      { item: '予定/実績時刻', detail: 'planned_* は事前予定、actual_* は当日の実績です。滞在日数や台帳確認に使います。' },
      { item: '送迎フラグ', detail: 'pickup_required / dropoff_required で送迎の要否を記録します。' },
      { item: '定員対象', detail: 'counts_toward_capacity が有効な宿泊明細のみ定員計算へ含めます。' },
    ],
  },
  'settings-public-reserve': {
    flow: ['利用タイミング: 公開予約運用の調整時。', '前提: owner/admin 権限。', '次に行う操作: 公開予約フォーム挙動を確認。'],
    itemDetails: [
      { item: 'アラート閾値', detail: '競合率とスタッフ偏り率の警告ラインを設定します。' },
      { item: '公開枠ルール', detail: '公開日数、バッファ、営業時間、最小リード時間を設定します。' },
      { item: '例外日', detail: '繁忙日や休業日を公開対象から除外します。' },
    ],
  },
  'settings-storage': {
    flow: ['利用タイミング: 写真保存量の増加時、警告表示時、月次見直し時。', '前提: owner 権限で対象店舗を開いている。', '次に行う操作: 必要なら追加課金、または不要ファイル整理方針の共有。'],
    itemDetails: [
      { item: '現在の使用状況', detail: '対象バケット、プラン、使用量、上限、追加容量、使用率をまとめて確認します。' },
      { item: '超過時の動作', detail: 'block は追加保存停止、cleanup_orphans は孤立ファイルの整理を先に試みる方針です。' },
      { item: '追加容量', detail: 'extra_capacity_gb と Checkout により追加容量を申請します。決済完了後はWebhookで反映されます。' },
    ],
  },
  'support-tickets': {
    flow: ['利用タイミング: 事象報告や依頼が必要な時。', '前提: 問い合わせ権限あり。', '次に行う操作: コメントで追加情報を追記。'],
    itemDetails: [
      { item: '起票フォーム', detail: '件名、詳細、カテゴリ、優先度を入力します。' },
      { item: 'チケット一覧', detail: '状態と更新日時を確認し進捗管理します。' },
      { item: 'コメント投稿', detail: '追加情報を時系列で残します。' },
    ],
  },
  hq: {
    flow: ['利用タイミング: 本部観点の業績確認時。', '前提: owner/admin で複数店舗所属。', '次に行う操作: 個店への改善指示や配信判断。'],
    itemDetails: [
      { item: '全体KPIカード', detail: '店舗数、予約数、売上、監査件数を30日単位で表示します。' },
      { item: '店舗比較テーブル', detail: '完了率・キャンセル率・売上を店舗横断で比較します。' },
      { item: '権限監査サマリー', detail: '操作アクション上位を確認します。' },
    ],
  },
  'hq-menu-templates': {
    flow: ['利用タイミング: 本部テンプレ配信を申請する時。', '前提: owner 権限。', '次に行う操作: 配信承認画面で状況追跡。'],
    itemDetails: [
      { item: '管理可能店舗一覧', detail: 'ownerとして操作可能な店舗を確認します。' },
      { item: '配信リクエスト作成', detail: '配信元・配信先・上書き方針を指定して送信します。' },
      { item: '配信元サンプルメニュー', detail: '配信対象内容を事前確認します。' },
    ],
  },
  'hq-menu-template-deliveries': {
    flow: ['利用タイミング: テンプレ配信の承認/監視時。', '前提: 本部アクセス権限あり。', '次に行う操作: 適用結果を対象店舗へ共有。'],
    itemDetails: [
      { item: '承認アクション', detail: '承認可能ロールのみ実行できます。' },
      { item: '配信リクエスト一覧', detail: 'source/targets/scope/status を時系列で確認します。' },
      { item: '適用時刻', detail: '一覧の「適用」列を確認し反映完了を判定します。' },
    ],
  },
  'invite-accept': {
    flow: ['利用タイミング: 招待URL受領時。', '前提: 有効期限内トークン。', '次に行う操作: 受諾後にスタッフ画面で所属確認。'],
    itemDetails: [
      { item: 'トークン付きURL', detail: '招待先情報を識別するためURL改変せず開きます。' },
      { item: '認証状態', detail: '未ログインならログイン/登録を実行します。' },
      { item: '受諾実行', detail: '一致メールアドレスでのみ受諾可能です。' },
    ],
  },
  'billing-required': {
    flow: ['利用タイミング: 課金制限状態で業務画面に入れない時。', '前提: owner/admin が対応可能。', '次に行う操作: 決済後にダッシュボード復帰確認。'],
    itemDetails: [
      { item: '決済方法ボタン', detail: 'Stripe/KOMOJU の Checkout 開始導線です。' },
      { item: '反映案内', detail: 'Webhook反映待ちを明示します。' },
      { item: 'ログアウト', detail: '対応者交代時に安全にセッションを切ります。' },
    ],
  },
  'billing-success': {
    flow: ['利用タイミング: Checkout完了直後。', '前提: 決済処理が受付済み。', '次に行う操作: ダッシュボードで制限解除確認。'],
    itemDetails: [
      { item: 'ダッシュボードへ', detail: '通常画面へ戻って利用可否を確認します。' },
      { item: '決済画面へ戻る', detail: '未反映時に再確認するための戻り導線です。' },
      { item: '反映待ち案内', detail: '数秒〜数分の遅延を想定して待機します。' },
    ],
  },
  'member-portal-shared': {
    flow: ['利用タイミング: 顧客への会員URL案内後。', '前提: 有効な member_portal token。', '次に行う操作: 必要に応じて公開予約へ遷移。'],
    itemDetails: [
      { item: '会員証ヘッダ', detail: '顧客名、店舗名、有効期限を表示します。' },
      { item: '次回予約/来店履歴', detail: '最新予約と直近履歴を顧客向けに表示します。' },
      { item: '予約ボタン', detail: 'member_portal_token 付きで公開予約へ遷移します。' },
    ],
  },
  'medical-records-shared': {
    flow: ['利用タイミング: 写真カルテ共有URL案内後。', '前提: 有効な共有トークン。', '次に行う操作: 店舗へフィードバック。'],
    itemDetails: [
      { item: '共有期限', detail: '閲覧可能期限を表示します。' },
      { item: '施術前/施術後写真', detail: 'タイプ別に写真を分けて表示します。' },
      { item: '撮影日時', detail: '各写真のタイムスタンプを確認できます。' },
    ],
  },
  logout: {
    flow: ['利用タイミング: 業務終了時、または共用端末から離席するとき。', '前提: 必要な保存操作が完了している。', '次に行う操作: ログイン画面表示を確認して終了。'],
    itemDetails: [
      { item: 'サイドバーのログアウト', detail: '現在セッションを破棄して不正利用を防止します。' },
      { item: 'ログイン画面への遷移確認', detail: '遷移しない場合は再度実行し、ブラウザ戻るで画面再表示されないことを確認します。' },
    ],
  },
}

export const manualSectionInsights: Record<string, ManualSectionInsight> = {
  dashboard: {
    pageGoal: '開店前・営業中・締め処理の判断を時系列で行うページです。',
    tabs: [
      {
        tab: '概要',
        when: '開店前 / 営業中',
        goal: '当日の全体状況（予約・売上・直近対応）を確認します。',
        cards: [
          {
            card: 'KPIカード',
            focus: '予約件数、来店済み件数、売上見込み、確定売上。',
            usage: '見込みと確定の差が大きいときは未会計を優先します。',
            decision: '差が大きい: 会計確認。差が小さい: 通常運用を継続。',
          },
          {
            card: '30分以内の予約',
            focus: '直近で対応が必要な予約。',
            usage: '担当と準備状況を確認し遅延を防ぎます。',
            decision: '件数過多: 応援配置や順番調整を実施。',
          },
        ],
      },
      {
        tab: '当日運用',
        when: '営業中',
        goal: '遅延・差し戻し・未会計リスクを抑えます。',
        cards: [
          {
            card: '当日運用KPI',
            focus: '遅延件数、差し戻し回数。',
            usage: '/ops/today で該当予約を先に解消します。',
            decision: '増加傾向: 導線見直しと担当再配分を判断。',
          },
        ],
      },
      {
        tab: '再来店フォロー',
        when: '未着手件数が増えた時 / 今日期限が出た時 / 離脱予兆が高い時',
        goal: '候補を対応キューへ投入し、連絡と状態更新を回して予約化につなげます。',
        cards: [
          {
            card: '未着手候補',
            focus: '自動抽出された候補（前回来店日・推奨来店日・超過日数・連絡先）。',
            usage: 'キューに追加し、電話/LINE文面コピーで初回接触します。',
            decision: '優先順は「今日期限 > 超過日数大 > 高リスク」。',
          },
          {
            card: '対応キュー',
            focus: 'status、担当者、最終対応、履歴。',
            usage: '対応中・保留・不要・失注・予約化へ手動更新します。',
            decision: '7日以内に反応なし: 保留/失注へ更新し、予約化時は resolved_booked でクローズ。',
          },
        ],
      },
      {
        tab: '空き枠再販',
        when: 'キャンセル枠が出た時 / 再販予約化率が低下した時',
        goal: '空き枠候補への案内を起票し、承認送信と受付結果を管理して予約化します。',
        cards: [
          {
            card: 'SlotReofferPanel（候補/ログ）',
            focus: 'waitlist候補・履歴候補、送信ログ、受付状況。',
            usage: '候補選定 -> 起票 -> 承認送信 -> 受付完了/期限切れ/取り下げを実行します。',
            decision: 'accepted なら予約作成へ進み、同枠の他候補は自動クローズされます。',
          },
          {
            card: '運用ステータス/KPI',
            focus: '即時確定対象メニュー、公開予約KPI、再販受付件数、予約化率。',
            usage: '警告閾値超過時はテンプレ・対象・連絡チャネルを見直します。',
            decision: '競合失敗率や偏り率が高い時は公開予約設定/担当配分を調整。',
          },
        ],
      },
    ],
  },
  appointments: {
    pageGoal: '予約作成から確定、日次運用への引き渡しまでを管理します。',
    tabs: [
      {
        tab: '新規登録',
        when: '営業中',
        goal: '1件の予約を正確に作成します。',
        cards: [
          {
            card: '予約フォーム',
            focus: '顧客・ペット・担当・時刻・メニューの整合。',
            usage: '重複防止のため作成前に対象日時と担当空き枠を確認。',
            decision: '不足情報あり: 先に顧客/ペット/メニュー整備。',
          },
        ],
      },
      {
        tab: '予約一覧 / カレンダー',
        when: '営業中 / 締め',
        goal: '申請確定と過密調整を実施します。',
        cards: [
          {
            card: '予約一覧テーブル',
            focus: '予約申請、予約済、キャンセル状態。',
            usage: '予約申請は内容確認後に確定します。',
            decision: '保留案件: 顧客連絡後に確定可否を判断。',
          },
          {
            card: 'カレンダー表示',
            focus: '担当別重複、時間帯偏り。',
            usage: '過密時間は開始時刻/担当を調整します。',
            decision: '重複あり: 予約移動または受付制限。',
          },
        ],
      },
    ],
  },
  payments: {
    pageGoal: '会計確定と来店履歴生成を確実に行います。',
    tabs: [
      {
        tab: '新規登録 / 一覧',
        when: '施術後 / 締め',
        goal: '会計を確定し未会計を残さない運用にします。',
        cards: [
          {
            card: '会計登録フォーム',
            focus: '予約選択、支払方法、合計金額。',
            usage: '確定前に予約メニューとの金額整合を確認。',
            decision: '不一致: メニュー設定や割引入力を見直し。',
          },
          {
            card: '会計一覧',
            focus: '未会計、支払日、領収書出力。',
            usage: '締め前に未会計ゼロを確認。',
            decision: '未会計あり: 当日中に処理。',
          },
        ],
      },
    ],
  },
  'medical-records': {
    pageGoal: 'カルテを次回施術に活用できる品質で残します。',
    tabs: [
      {
        tab: '新規登録 / 一覧',
        when: '施術直後',
        goal: '観察結果と写真を一貫して記録します。',
        cards: [
          {
            card: 'カルテ登録フォーム',
            focus: '皮膚状態、行動、注意事項、写真。',
            usage: '次回担当者が読んで再現できる粒度で記載。',
            decision: '記録不足: 共有前に補記。',
          },
        ],
      },
    ],
  },
  inventory: {
    pageGoal: '在庫不足と期限リスクを日次で把握します。',
    tabs: [
      {
        tab: '在庫ダッシュボード',
        when: '開店前 / 締め',
        goal: '不足品と入出庫動向を確認します。',
        cards: [
          {
            card: '不足アラート',
            focus: '不足件数、対象品目。',
            usage: '発注提案か入庫登録に遷移して解消。',
            decision: '不足継続: 発注ドラフト作成。',
          },
        ],
      },
    ],
  },
  'inventory-reorder-suggestions': {
    pageGoal: '不足リスクを発注アクションへ変換します。',
    tabs: [
      {
        tab: '提案一覧',
        when: '締め / 週次',
        goal: '優先度順に発注対象を選定します。',
        cards: [
          {
            card: '仕入先別提案カード',
            focus: '推奨数量、単価、優先度。',
            usage: '必要量に調整してドラフト作成。',
            decision: '高リスク: 即日発注を優先。',
          },
        ],
      },
    ],
  },
  'settings-public-reserve': {
    pageGoal: '公開予約の安全性と受入品質を維持します。',
    tabs: [
      {
        tab: '閾値 / ルール / 例外日',
        when: '週次見直し',
        goal: '公開枠の競合率・偏り・除外日を調整します。',
        cards: [
          {
            card: '閾値設定',
            focus: '競合失敗率、スタッフ偏り率。',
            usage: '警告が多い場合は枠ルールを見直し。',
            decision: '警告頻発: 枠設定または人員配置を調整。',
          },
          {
            card: '例外日設定',
            focus: '繁忙日・休業日の除外。',
            usage: '誤受付防止のため事前登録。',
            decision: '混雑予定あり: 先に例外日登録。',
          },
        ],
      },
    ],
  },
  hotel: {
    pageGoal: 'ペットホテルの受入状況、定員、会計前提を1画面で把握します。',
    tabs: [
      {
        tab: '台帳 / 週カレンダー / 設定',
        when: '予約登録時 / 当日受入時 / 締め前',
        goal: '予約状況と定員への影響を見ながら受入判断します。',
        cards: [
          {
            card: '滞在一覧',
            focus: 'status、stay_code、予定/実績時刻、合計金額。',
            usage: '当日の受入順、未チェックアウト件数、無断キャンセルを確認。',
            decision: '定員超過懸念: 週カレンダーと明細を再確認。',
          },
          {
            card: '宿泊明細',
            focus: '宿泊メニュー、数量、単価、定員対象フラグ。',
            usage: '時間預かりと宿泊の料金根拠、定員消費の根拠として確認。',
            decision: '定員対象誤り: 明細設定を修正して再保存。',
          },
        ],
      },
    ],
  },
  'settings-storage': {
    pageGoal: '写真保存容量を見える化し、超過前に対処します。',
    tabs: [
      {
        tab: '現在の使用状況 / 超過時の動作 / 容量追加課金',
        when: '警告表示時 / 月次レビュー時',
        goal: '保存上限と対応方針を確認し、追加容量を手配します。',
        cards: [
          {
            card: '使用率バー',
            focus: '使用量、上限、追加容量、usageWarning。',
            usage: '90%超なら追加容量か不要ファイル整理を優先判断。',
            decision: '警告継続: 容量方針の見直しと関係者共有を実施。',
          },
          {
            card: '超過時の動作',
            focus: 'block / cleanup_orphans、カスタム上限。',
            usage: '運用に合わせて保存停止か整理優先かを選択。',
            decision: '写真保存を止められない場合: 先に追加容量を確保。',
          },
        ],
      },
    ],
  },
  'support-tickets': {
    pageGoal: '問い合わせをチケットで追跡し解決まで管理します。',
    tabs: [
      {
        tab: '起票 / 一覧',
        when: '事象発生時',
        goal: '起票、進捗更新、追加コメントを実施します。',
        cards: [
          {
            card: '起票フォーム',
            focus: '件名、再現手順、カテゴリ、優先度。',
            usage: '再現条件を具体的に書いて調査を短縮。',
            decision: '重大障害: urgentで即時起票。',
          },
        ],
      },
    ],
  },
}

export function getSectionGuide(id: string): ManualSectionGuide {
  return (
    manualSectionGuides[id] ?? {
      flow: ['このページの利用フロー情報は未定義です。'],
      itemDetails: [],
    }
  )
}

export function getSectionInsight(id: string, section: ManualSection): ManualSectionInsight {
  const insight = manualSectionInsights[id]
  if (insight) return insight
  return {
    pageGoal: `${section.title}の基本運用を安全に実施します。`,
    tabs: [
      {
        tab: '共通',
        when: '営業中',
        goal: section.purpose,
        cards: [
          {
            card: '操作手順',
            focus: section.procedures[0] ?? '画面の基本操作',
            usage: '手順を上から実施し、保存前に対象データを確認します。',
            decision: section.cautions[0] ?? '不明点は管理者へ確認してから実行します。',
          },
          {
            card: '注意点',
            focus: section.cautions.join(' / ') || '入力値の整合',
            usage: '注意点に該当する条件を事前に除外します。',
            decision: 'リスクが高い場合は実行を止めて確認します。',
          },
        ],
      },
    ],
  }
}

export function getSection(id: string) {
  return manualSections.find((section) => section.id === id)
}


