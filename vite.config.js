import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 的專案頁面網址會是 https://<user>.github.io/<repo>/，
// 打包資源路徑要對應加上 /<repo>/ 前綴，由 GitHub Actions 在 build 時
// 透過 GITHUB_PAGES_BASE 環境變數注入，本機開發不用管，預設 '/'
export default defineConfig({
  plugins: [vue()],
  base: process.env.GITHUB_PAGES_BASE || '/',
})
