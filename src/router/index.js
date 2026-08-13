import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import AirQuality from '../views/AirQuality.vue'
import Earthquake from '../views/Earthquake.vue'

// 從 hash mode 換成 history mode：/#/earthquake 對爬蟲來說不是獨立網址，
// Google 會當成跟首頁同一頁，兩頁沒辦法分別被索引。
//
// 純靜態 host 換 history mode 通常得靠 404.html 轉址，但那條路徑回的是
// HTTP 404，對 SEO 反而有害。這裡改成 build 時幫每條路由各自產生一份實體
// HTML（scripts/prerender.js），GitHub Pages 直接以 200 回應
// /tw-environment-watch/earthquake/，不需要轉址。404.html 只留給真的不
// 存在的路徑當保險。
export const SITE_NAME = '台灣環境監測'

const routes = [
  {
    path: '/',
    name: 'air-quality',
    component: AirQuality,
    meta: {
      title: '即時空氣品質 AQI',
      description:
        '全台各縣市即時空氣品質指標 AQI，資料來自環境部空氣品質監測網，每 3 小時自動更新，並以 3D 立體地圖呈現各縣市差異。',
    },
  },
  {
    path: '/earthquake',
    name: 'earthquake',
    component: Earthquake,
    meta: {
      title: '近期有感地震',
      description:
        '台灣近期顯著有感地震列表與各縣市最大震度，資料來自中央氣象署，每 3 小時自動更新，並以 3D 立體地圖呈現震度分布。',
    },
  },
]

// 預先渲染時要照這份清單一條一條產生 HTML
export const ROUTE_PATHS = routes.map((route) => route.path)

export function pageTitle(route) {
  return route?.meta?.title ? `${route.meta.title}｜${SITE_NAME}` : SITE_NAME
}

export function createAppRouter() {
  const router = createRouter({
    // 預先渲染是在 Node 裡跑的，沒有 window.history 可用
    history: import.meta.env.SSR
      ? createMemoryHistory(import.meta.env.BASE_URL)
      : createWebHistory(import.meta.env.BASE_URL),
    routes,
  })

  if (!import.meta.env.SSR) {
    // 換頁時要自己更新標題跟描述，否則分頁名稱、書籤、分享出去的連結
    // 都會停在進站那一頁的文字
    router.afterEach((to) => {
      document.title = pageTitle(to)
      const tag = document.querySelector('meta[name="description"]')
      if (tag && to.meta.description) tag.setAttribute('content', to.meta.description)
    })
  }

  return router
}
