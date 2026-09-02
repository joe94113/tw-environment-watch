# 台灣環境監測站

全台空氣品質 AQI 與近期有感地震的公開儀表板。資料每 3 小時由 GitHub Actions
自動抓取更新，純靜態網站部署在 GitHub Pages，沒有自己的後端伺服器。

**線上版本：<https://joe94113.github.io/tw-environment-watch/>**

[![Update Data and Deploy](https://github.com/joe94113/tw-environment-watch/actions/workflows/deploy.yml/badge.svg)](https://github.com/joe94113/tw-environment-watch/actions/workflows/deploy.yml)

![畫面截圖](docs/screenshot.png)

## 功能

### 空氣品質

全台 80 多個測站的即時 AQI，涵蓋全部 22 個縣市。地圖上每個縣市取**該縣市最差的測站**
代表，而不是平均值——平均會把局部的空污稀釋掉，看起來一切正常。

下方表格列出每個測站的實際數值與分級，可以依測站、縣市、AQI、等級任一欄排序。

### 地震

最近一次顯著有感地震的規模、震央位置與發生時間（同時顯示「多久以前」與
實際時刻），各縣市最大震度以地圖呈現，下方是近期地震列表。

### 立體地圖

縣市的高度對應數值高低，滑鼠移過去會顯示該縣市的名稱與數值。可以拖曳旋轉、
滾輪縮放，也可以一鍵切換成 2D 平面地圖。

高度是**相對刻度**（跟著當下資料範圍伸縮，畫面角落會標出對應的數值範圍），
不是固定對應 AQI 0–500，理由見[設計決定](docs/design-notes.md)。

### 無障礙

地圖一律標示為裝飾用途，所有資料同時提供可鍵盤操作、可排序的表格；
分級除了顏色也一定有文字標籤，不依賴顏色或滑鼠也能取得完整資訊。

## 資料來源

| 資料 | 來源 | 資料集 |
|---|---|---|
| 空氣品質 AQI | [環境部環境資料開放平臺](https://data.moenv.gov.tw) | `aqx_p_432` 空氣品質指標（即時） |
| 地震 | [中央氣象署氣象資料開放平臺](https://opendata.cwa.gov.tw) | `E-A0015-001` 顯著有感地震報告 |
| 縣市地圖 | `src/data/taiwan-counties.topo.json` | TopoJSON，MIT 授權 |

更新頻率為每 3 小時（`.github/workflows/deploy.yml` 的 cron 設定）。

### 資料策略：只往前累積，不回補歷史

一開始的計畫是連政府的歷史資料集一起回補，但那些資料集查起來太不穩定
（欄位、參數都對不太起來），所以改成**從上線那天開始，只靠排程往前累積**：

- 空氣品質依「年-月」分檔存放（`src/data/air-quality/2026-09.json`），
  避免單一檔案隨時間長到不合理的大小；舊月份檔案不會再被改動
- 地震資料量小，維持累積在單一檔案 `src/data/earthquakes.json`

## 技術

Vue 3 + Vue Router、Vite、Three.js（3D 地圖）、D3 + TopoJSON（投影與地圖資料）、
Vitest。

路由使用 history mode，兩個頁面在建置時各自預先渲染成實體 HTML，因此有獨立的
網址、標題、描述與 canonical，初始 HTML 也帶有實際內容而不是空的容器。

## 本機開發

### 1. 申請兩把 API Key（免費）

- 空氣品質：<https://data.moenv.gov.tw> 註冊會員取得
- 地震：<https://opendata.cwa.gov.tw> 註冊會員取得

### 2. 建立 .env

```bash
cp .env.example .env
```

打開 `.env` 把兩把 key 填進去。`.env` 已被 `.gitignore` 排除。
**永遠不要把 key 直接寫進程式碼或貼到會被 commit 的檔案裡。**

### 3. 安裝與啟動

```bash
npm install
npm run dev
```

### 4. 手動抓一次資料

```bash
npm run fetch:air-quality
npm run fetch:earthquake
```

抓取腳本對 5xx、429、連線失敗會自動退避重試（1s → 2s → 4s）；4xx 則立刻放棄，
因為 API key 錯誤這類問題重試也沒用。

如果空品腳本顯示「回傳 0 筆」，它會**保留既有資料不覆寫**並以非零狀態結束。
這通常代表 API 回應格式跟腳本預期的不一樣（兩個平台偶爾會調整欄位），
把原始回應印出來對照，再調整 `normalizeRecord` / `normalize` 的欄位名稱。

## 測試

```bash
npm test
```

涵蓋 AQI 與震度分級、測站彙整成縣市、時間格式化、抓取重試邏輯。

## 自己架一份

以下是**在你自己的 repo 上跑起同一套東西**的步驟。只是想看成品的話直接開
[線上版本](https://joe94113.github.io/tw-environment-watch/)就好。

### 1. 建置是三個步驟

```bash
npm run build
```

會依序跑：

1. `vite build` — 一般的前端打包
2. `vite build --ssr` — 產生 Node 端可執行的版本
3. `node scripts/prerender.js` — 把每條路由各渲染成一份實體 HTML

**第三步是必要的，不是最佳化。** GitHub Pages 是純靜態 host，history mode 的
`/earthquake` 沒有對應檔案就只能靠 404.html 轉址，而那條路徑回的是 **HTTP 404**，
對 SEO 有害。預先產生 `dist/earthquake/index.html` 之後，Pages 就會以 200 回應。

只要純前端打包（不含預渲染）可以用 `npm run build:client`。

### 2. 開啟 GitHub Pages

你的 repo → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
沒設定的話 `actions/deploy-pages` 會失敗並回 404。

### 3. 設定 secrets

你的 repo → **Settings → Secrets and variables → Actions**，新增兩個：

| Name | Value |
|---|---|
| `MOENV_API_KEY` | 環境部 API Key |
| `CWA_API_KEY` | 氣象署 API Key |

### 4. 之後就自動了

`.github/workflows/deploy.yml` 每 3 小時（以及 push 到 `main` 時）會：
抓資料 → commit 回 repo → 跑測試 → 建置 → 部署。

上游 API 掛掉**不會**擋住部署：兩個抓取步驟設了 `continue-on-error`，網站會帶著
既有資料照常重建上線，失敗則以 workflow annotation 呈現。

## 專案結構

大部分檔案看名字就知道用途，這裡只列容易迷路的部分：

```
scripts/
  prerender.js              建置第三步：每條路由產生實體 HTML
  og-card.html              分享預覽圖的來源（產生指令寫在檔案頂端）
  lib/fetch-retry.js        會退避重試的 fetch
src/
  entry-server.js           預渲染用的進入點（對應 main.js）
  router/index.js           路由與各頁的標題／描述
  utils/                    分級、彙整、時間格式化，都有對應的 .test.js
  data/
    taiwan-counties.topo.json  縣市地圖
    air-quality-latest.json    最新 AQI 快照
    air-quality/YYYY-MM.json   依月份累積的 AQI 歷史
    earthquakes.json           累積的地震資料
```

## 設計決定

有幾個地方**看起來像 bug、其實是刻意的**（3D 高度為什麼是相對刻度、離島為什麼
畫成平的、顏色為什麼要先解析 CSS 變數等等）。改動前建議先看
**[docs/design-notes.md](docs/design-notes.md)**，免得把已經修好的問題又帶回來。

## 授權

程式碼採用 [MIT License](LICENSE)。地圖資料 `taiwan-counties.topo.json` 同為 MIT 授權；
空氣品質與地震資料的使用請依環境部、中央氣象署各自的開放資料條款。
