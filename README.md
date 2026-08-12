# 台灣環境監測站

空氣品質、地震資料的公開儀表板。資料每 3 小時由 GitHub Actions 自動抓取更新，
純靜態網站部署在 GitHub Pages，沒有自己的後端伺服器。

## 目前狀態

- 已完成：空氣品質、地震兩個頁面（分頁切換），各自有大數字開場、地圖、圖例、可排序表格
- 已完成：台灣地圖元件（2D 平面 + 3D 立體擠出，可切換）
- 已完成：AQI 六級分級、地震震度分級邏輯（含文字安全對比色），都有測試
- 已完成：無障礙處理——地圖標示為裝飾用途，資料一律同時提供可鍵盤排序的表格
- 已完成：抓取資料的腳本
- 待完成：SEO / 分享預覽（等資料穩定產出後再處理，做法會跟 toolbox 專案一樣自動化）

## 資料策略：只往前累積，不回補歷史

一開始的計畫是連政府的歷史資料集一起回補，但那些資料集查起來太不穩定
（欄位、參數都對不太起來），所以改成**從上線那天開始，只靠排程往前累積**：

- 空氣品質依「年-月」分檔存放：`src/data/air-quality/2026-08.json`，
  避免單一檔案隨時間長到不合理的大小
- 地震資料量小，維持累積在單一檔案 `src/data/earthquakes.json`

## 設定步驟（第一次上手一定要做）

### 1. 申請兩把 API Key（免費）

- 空氣品質：https://data.moenv.gov.tw 註冊會員取得
- 地震：https://opendata.cwa.gov.tw 註冊會員取得

### 2. 本機開發用 .env

```bash
cp .env.example .env
# 打開 .env，把兩把 key 填進去
```

.env 已經被 .gitignore 排除，不會被 commit。**永遠不要把 key 直接寫進程式碼或貼到會被 commit 的檔案裡。**

### 3. 部署用的 GitHub Secrets

到 repo 的 Settings → Secrets and variables → Actions，新增兩個 Repository secret：

| Name | Value |
|---|---|
| MOENV_API_KEY | 你的環境部 API Key |
| CWA_API_KEY | 你的氣象署 API Key |

### 4. 本機手動測試抓資料

```bash
npm run fetch:air-quality
npm run fetch:earthquake
```

如果跑完顯示「0 個測站」或「0 筆」，代表 API 的回應格式跟腳本預期的不一樣
（環境部/氣象署平台偶爾會調整欄位），這時候：

1. 打開 `scripts/fetch-air-quality.js` 或 `scripts/fetch-earthquake.js`
2. 找到 `console.warn(...)` 那行，把完整的原始回應印出來看實際欄位長什麼樣子
3. 對照調整 `normalizeRecord` / `normalize` 函式裡的欄位名稱

### 5. 日常開發

```bash
npm install
npm run dev      # 本機開發
npm test         # 跑邏輯測試
```

## 部署

1. push 到 GitHub
2. repo 的 Settings → Pages → Build and deployment → Source 選 GitHub Actions
3. 之後 .github/workflows/deploy.yml 會：每 3 小時自動抓資料、commit 回 repo、
   跑測試、build、部署——三件事串在一起，不用手動介入

## 目錄結構

```
scripts/
  fetch-air-quality.js       # 每次排程：抓最新 AQI，寫入分月檔案
  fetch-earthquake.js        # 每次排程：抓最新地震，累積進單一檔案
  lib/
    json-store.js            # 讀寫 JSON 資料檔的小工具
    county-names.js           # 縣市名稱 -> 地圖代碼對照表（地震腳本用）
src/
  router/
    index.js                  # 空氣品質／地震兩個分頁的路由
  views/
    AirQuality.vue             # 空氣品質頁面
    Earthquake.vue               # 地震頁面
  data/
    taiwan-counties.topo.json   # 台灣縣市地圖（MIT 授權）
    air-quality-latest.json     # 最新 AQI 快照
    air-quality/2026-08.json    # 依月份累積的 AQI 歷史（範例檔名）
    earthquakes.json            # 累積的地震資料
    county-names.js               # 代碼 -> 名稱（畫面顯示用）
    county-name-to-id.js          # 名稱 -> 代碼（地圖上色用）
  components/
    TaiwanMap.vue              # 2D 平面地圖
    TaiwanMap3D.vue             # 3D 立體擠出地圖
    MapView.vue                  # 2D/3D 切換元件
    StatHero.vue                  # 大數字開場
    DataTable.vue                  # 可排序、無障礙的資料表格
  utils/
    aqi.js                       # AQI 分級邏輯（含測試）
    earthquake.js                  # 地震震度分級邏輯（含測試）
    aggregate-aqi.js                # 測站資料彙整成縣市層級（含測試）
```
