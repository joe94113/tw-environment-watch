// 氣象署回傳的是 ISO 8601（例如 2026-08-13T03:54:22+08:00），直接顯示很難讀。
// 這裡統一轉成台灣人一眼看得懂的格式。
//
// 時區固定用 Asia/Taipei，不跟著瀏覽器所在時區跑：地震報告講的是台灣當地
// 時間，人在日本或美國的使用者看到的也該是同一個時刻，不然對不上新聞。
const TAIPEI = 'Asia/Taipei'

// 用 formatToParts 自己組字串，而不是直接吃 toLocaleString 的輸出：
// 不同執行環境的 ICU 版本對 zh-TW 的排版細節（分隔符、有沒有「上午」）
// 不一定一致，自己組才能保證格式固定、測試也才穩。
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TAIPEI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// new Date(null) 是 1970 epoch 而不是 Invalid Date，少了這道 null 檢查，
// 沒有時間的資料會顯示成 1970/01/01，比空白還糟。
function toDate(value) {
  if (value == null || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function taipeiParts(value) {
  const date = toDate(value)
  if (!date) return null

  const parts = {}
  for (const part of partsFormatter.formatToParts(date)) parts[part.type] = part.value
  return parts
}

/**
 * 完整日期時間，例如 '2026/08/13 03:54'。
 * 秒數對閱讀沒幫助就不顯示，需要精確到秒的人可以點氣象署原始報告。
 * 解析不出來的值回傳空字串，畫面上就是留白，不會顯示 Invalid Date。
 */
export function formatDateTime(value) {
  const p = taipeiParts(value)
  if (!p) return ''
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`
}

/**
 * 只有月日跟時間，例如 '08/13 03:54'，用在空間比較擠的地方。
 */
export function formatMonthDay(value) {
  const p = taipeiParts(value)
  if (!p) return ''
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`
}

/**
 * 相對時間，例如 '3 小時前'。用在「最近一次地震」這種讀者真正在意
 * 「多久以前」而不是「幾點幾分」的位置。
 *
 * now 可以注入，測試才不用依賴系統時間。
 */
export function formatRelative(value, now = new Date()) {
  const date = toDate(value)
  if (!date) return ''

  const diffMs = now.getTime() - date.getTime()
  // 資料時間比現在還新（時鐘誤差、或剛發布的報告）就當作剛剛
  if (diffMs < 60_000) return '剛剛'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} 分鐘前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 個月前`

  return `${Math.floor(days / 365)} 年前`
}
