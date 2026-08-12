// 每日（或更頻繁）由 GitHub Actions 排程執行一次。
// 資料來源：環境部環境資料開放平臺，aqx_p_432（空氣品質指標 AQI，即時）
// API 文件：https://data.moenv.gov.tw/paradigm
//
// 歷史資料改成「從上線那天開始累積」，不再回補政府的歷史資料集
// （那個資料集查起來太不穩定）。為了避免單一檔案隨時間無限長大，
// 依「年-月」分檔存放：src/data/air-quality/2026-08.json 這樣，
// 舊的月份檔案不會再被改動，新的一個月會自動開一個新檔案。

import { readJson, writeJson, todayISO } from './lib/json-store.js'

const API_KEY = process.env.MOENV_API_KEY
if (!API_KEY) {
  console.error('缺少 MOENV_API_KEY 環境變數，請先在 .env 或 GitHub Secrets 設定')
  process.exit(1)
}

const LATEST_PATH = 'src/data/air-quality-latest.json'

function monthlyPath(dateISO) {
  return `src/data/air-quality/${dateISO.slice(0, 7)}.json` // 2026-08.json
}

async function fetchAqi() {
  const url = `https://data.moenv.gov.tw/api/v2/aqx_p_432?limit=1000&api_key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`AQI API 回傳錯誤：${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  const records = json.records ?? json
  if (!Array.isArray(records) || records.length === 0) {
    // 拿到 0 筆通常代表欄位/回應格式跟預期不一樣，把原始回應印出來方便對照
    console.warn('API 回傳看起來是空的，原始回應：', JSON.stringify(json).slice(0, 500))
  }
  return records
}

function normalizeRecord(r) {
  const aqi = Number(r.aqi)
  return {
    id: r.siteid ?? r.sitename,
    name: r.sitename,
    county: r.county,
    lon: Number(r.longitude),
    lat: Number(r.latitude),
    aqi: Number.isFinite(aqi) ? aqi : null,
    publishedAt: r.publishtime,
  }
}

async function main() {
  const raw = await fetchAqi()
  const stations = raw.map(normalizeRecord).filter((s) => s.lon && s.lat)

  writeJson(LATEST_PATH, {
    updatedAt: new Date().toISOString(),
    stations,
  })

  const today = todayISO()
  const path = monthlyPath(today)
  const monthData = readJson(path, { dates: {} })
  monthData.dates[today] = Object.fromEntries(
    stations.filter((s) => s.aqi !== null).map((s) => [s.id, s.aqi])
  )
  writeJson(path, monthData)

  console.log(`更新完成：${stations.length} 個測站，寫入 ${path}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
