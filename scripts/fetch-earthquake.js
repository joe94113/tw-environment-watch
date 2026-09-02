// 每日（或更頻繁）由 GitHub Actions 排程執行。
// 資料來源：中央氣象署氣象資料開放平臺，E-A0015-001（顯著有感地震報告）
// API 文件：https://opendata.cwa.gov.tw/dist/opendata-swagger.html
//
// 回傳格式、欄位名稱是依 CWA 這個資料集長年穩定的結構寫的
// （records.Earthquake[].EarthquakeInfo / Intensity.ShakingArea），
// 沒有 key 沒辦法實際呼叫驗證，第一次跑如果解析不到資料，
// 先 console.log(raw) 把實際回傳結構印出來對照調整。

import { readJson, writeJson } from './lib/json-store.js'
import { fetchWithRetry } from './lib/fetch-retry.js'
import { COUNTY_NAME_TO_ID } from './lib/county-names.js'

const API_KEY = process.env.CWA_API_KEY
if (!API_KEY) {
  console.error('缺少 CWA_API_KEY 環境變數，請先在 .env 或 GitHub Secrets 設定')
  process.exit(1)
}

const DATA_PATH = 'src/data/earthquakes.json'

async function fetchEarthquakes() {
  const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${API_KEY}&format=JSON`
  const res = await fetchWithRetry(url, { label: '地震 API' })
  const json = await res.json()
  return json.records?.Earthquake ?? []
}

// AreaIntensity 是像「4級」「5弱」「5強」這種字串，
// 簡化成 0-7 的整數（弱/強不細分），對應 utils/earthquake.js 的 getIntensityMeta。
function parseIntensityLevel(areaIntensity) {
  const match = String(areaIntensity ?? '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

function normalize(record) {
  const info = record.EarthquakeInfo
  const shakingAreas = record.Intensity?.ShakingArea ?? []

  const counties = shakingAreas
    .map((area) => ({
      countyId: COUNTY_NAME_TO_ID[area.CountyName],
      intensity: parseIntensityLevel(area.AreaIntensity),
    }))
    .filter((a) => a.countyId)

  return {
    id: record.EarthquakeNo,
    time: info?.OriginTime,
    magnitude: info?.EarthquakeMagnitude?.MagnitudeValue,
    depth: info?.FocalDepth,
    location: info?.Epicenter?.Location,
    lon: info?.Epicenter?.EpicenterLongitude,
    lat: info?.Epicenter?.EpicenterLatitude,
    counties,
    reportUrl: record.Web,
  }
}

async function main() {
  const raw = await fetchEarthquakes()

  // 空結果在這裡不會毀資料（下面是併進既有 store，沒有新的就等於沒動作），
  // 所以不像空品那支要中止，但還是留個記號，免得 API 默默壞掉沒人發現。
  if (raw.length === 0) {
    console.log('::warning::地震 API 回傳 0 筆資料，這次沒有新增任何地震')
  }

  const fresh = raw.map(normalize)

  const store = readJson(DATA_PATH, { earthquakes: [] })
  const existingIds = new Set(store.earthquakes.map((e) => e.id))

  let added = 0
  for (const eq of fresh) {
    if (!existingIds.has(eq.id)) {
      store.earthquakes.push(eq)
      existingIds.add(eq.id)
      added++
    }
  }

  store.earthquakes.sort((a, b) => new Date(b.time) - new Date(a.time))
  writeJson(DATA_PATH, store)

  console.log(`新增 ${added} 筆地震資料，目前共 ${store.earthquakes.length} 筆`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
