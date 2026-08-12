import { COUNTY_NAME_TO_ID } from '../data/county-name-to-id.js'

function normalizeCountyName(name) {
  return String(name ?? '').trim()
}

function lookupCountyId(rawName) {
  const name = normalizeCountyName(rawName)
  if (COUNTY_NAME_TO_ID[name]) return COUNTY_NAME_TO_ID[name]
  // 「臺」「台」兩種寫法都試一次，API 回傳有時候會混用
  const swapped = name.includes('臺') ? name.replace(/臺/g, '台') : name.replace(/台/g, '臺')
  if (COUNTY_NAME_TO_ID[swapped]) return COUNTY_NAME_TO_ID[swapped]
  return null
}

/**
 * 把測站清單依縣市彙整，每個縣市取「最差（最高）」的 AQI 代表該縣市，
 * 這樣地圖顯示的是保守／保護性的數字，不是被好站稀釋掉的平均值。
 * 回傳 { countyId: aqi }。
 */
export function maxAqiByCounty(stations) {
  const result = {}
  const unmatched = new Set()

  for (const s of stations) {
    if (s.aqi == null) continue
    const countyId = lookupCountyId(s.county)
    if (!countyId) {
      unmatched.add(s.county)
      continue
    }
    if (result[countyId] === undefined || s.aqi > result[countyId]) {
      result[countyId] = s.aqi
    }
  }

  if (unmatched.size > 0 && typeof console !== 'undefined') {
    console.warn(
      '[aggregate-aqi] 這些縣市名稱對不到地圖代碼，地圖上不會顯示這些測站的顏色：',
      [...unmatched]
    )
  }

  return result
}

/**
 * 全部測站的平均 AQI，四捨五入成整數，沒有資料時回傳 null。
 */
export function averageAqi(stations) {
  const values = stations.map((s) => s.aqi).filter((v) => v != null)
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}
