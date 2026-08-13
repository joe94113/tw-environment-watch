import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createAppRouter } from './router/index.js'

// 這裡刻意用 createApp 而不是 createSSRApp + hydrate。預先渲染的 HTML 是
// 給爬蟲跟首屏看的，但 3D 地圖在 Node 裡渲染不出來（預渲染出的是 2D 版），
// 真的走 hydration 一定對不起來。直接掛載讓 Vue 重畫整塊，換來的是不會有
// hydration mismatch 的各種詭異狀況。
const app = createApp(App)
const router = createAppRouter()

app.use(router)
router.isReady().then(() => app.mount('#app'))
