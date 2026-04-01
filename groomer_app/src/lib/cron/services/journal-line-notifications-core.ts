export function buildJournalLineBody(params: {
  customerName: string
  petNames: string[]
  bodyText: string
}) {
  const petLine = params.petNames.length > 0 ? `${params.petNames.join('・')}ちゃん` : 'ペット'
  const comment = params.bodyText.trim().length > 0 ? params.bodyText.trim() : '本日のご様子を日誌に記録しました。'

  return `${params.customerName}様\n${petLine}の最新日誌をお届けします。\n\n${comment}\n\n詳しくはアプリの「日誌」からご確認ください。`
}
