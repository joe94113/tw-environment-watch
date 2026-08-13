import { createRouter, createWebHashHistory } from 'vue-router'
import AirQuality from '../views/AirQuality.vue'
import Earthquake from '../views/Earthquake.vue'

// 先用 hash mode（網址是 /#/earthquake），GitHub Pages 純靜態 host
// 不用額外處理重新整理 404 的問題，之後如果要讓兩頁能被搜尋引擎
// 個別索引，可以比照 toolbox 專案的做法換成 history mode + 404.html 轉址。
const SITE_NAME = '台灣環境監測'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
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
  ],
})

function setMetaDescription(content) {
  if (!content) return
  const tag = document.querySelector('meta[name="description"]')
  if (tag) tag.setAttribute('content', content)
}

// hash mode 下兩頁共用同一個 HTML，切頁時要自己更新標題跟描述，
// 否則分頁名稱、書籤、分享出去的連結全部都是同一組文字。
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title}｜${SITE_NAME}` : SITE_NAME
  setMetaDescription(to.meta.description)
})

export default router
