import { createRouter, createWebHashHistory } from 'vue-router'
import AirQuality from '../views/AirQuality.vue'
import Earthquake from '../views/Earthquake.vue'

// 先用 hash mode（網址是 /#/earthquake），GitHub Pages 純靜態 host
// 不用額外處理重新整理 404 的問題，之後如果要讓兩頁能被搜尋引擎
// 個別索引，可以比照 toolbox 專案的做法換成 history mode + 404.html 轉址。
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'air-quality', component: AirQuality, meta: { title: '空氣品質' } },
    { path: '/earthquake', name: 'earthquake', component: Earthquake, meta: { title: '地震' } },
  ],
})

export default router
