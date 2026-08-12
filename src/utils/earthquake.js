// 對應中央氣象署地震震度分級（簡化版，0-7 級）。
// 顏色用單一色相由淺到深，跟 AQI 的六色分級語意刻意區隔，避免使用者混淆兩種指標。
const INTENSITY_LEVELS = [
  { max: 0, label: '無感', color: null, textColor: null },
  { max: 2, label: '微震／輕震', color: 'var(--quake-1)', textColor: 'var(--quake-1-text)' },
  { max: 3, label: '弱震', color: 'var(--quake-2)', textColor: 'var(--quake-2-text)' },
  { max: 4, label: '中震', color: 'var(--quake-3)', textColor: 'var(--quake-3-text)' },
  { max: 6, label: '強震／烈震', color: 'var(--quake-4)', textColor: 'var(--quake-4-text)' },
  { max: Infinity, label: '劇震', color: 'var(--quake-5)', textColor: 'var(--quake-5-text)' },
]

/**
 * 依震度等級（0-7 的整數）回傳對應說明跟顏色。
 * 不合法的數字回傳 null。
 */
export function getIntensityMeta(level) {
  if (!Number.isInteger(level) || level < 0) return null
  const found = INTENSITY_LEVELS.find((l) => level <= l.max)
  return { level, label: found.label, color: found.color, textColor: found.textColor }
}

/**
 * 一組「縣市代碼 -> 震度」的資料裡，找出每個縣市的最大震度，
 * 用在地圖 choropleth 上色（同一縣市可能有多個測站，取最大值代表該縣市）。
 */
export function maxIntensityByCounty(stationIntensities) {
  const result = {}
  for (const { countyId, intensity } of stationIntensities) {
    if (result[countyId] === undefined || intensity > result[countyId]) {
      result[countyId] = intensity
    }
  }
  return result
}
