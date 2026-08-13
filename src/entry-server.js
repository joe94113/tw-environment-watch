import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import App from './App.vue'
import { createAppRouter, pageTitle } from './router/index.js'

// prerender 腳本要照這份清單跑
export { ROUTE_PATHS } from './router/index.js'

/**
 * 給 scripts/prerender.js 用：把單一路由渲染成 HTML 字串，
 * 連同該頁的標題／描述一起回傳，好塞進 index.html 樣板。
 */
export async function render(url) {
  const app = createSSRApp(App)
  const router = createAppRouter()
  app.use(router)

  await router.push(url)
  await router.isReady()

  const html = await renderToString(app)
  const route = router.currentRoute.value

  return {
    html,
    title: pageTitle(route),
    description: route.meta.description ?? '',
  }
}
