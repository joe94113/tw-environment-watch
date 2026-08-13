// Build 的第三步：把每條路由各自渲染成一份實體 HTML。
//
// 目的有兩個：
// 1. GitHub Pages 是純靜態 host，history mode 的 /earthquake 沒有對應檔案
//    就只能靠 404.html 轉址，而那條路徑回的是 HTTP 404，對 SEO 有害。
//    先產生 earthquake/index.html，Pages 就會用 200 直接回應。
// 2. 純前端渲染的初始 HTML 裡沒有任何內容。Googlebot 跑得動 JS，但先給
//    它現成的內容一定比較穩，社群平台的預覽卡片也才抓得到描述。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')

// canonical 永遠指向正式站，跟這次 build 的 base 無關（本機 build 時
// GITHUB_PAGES_BASE 是空的，拿它來組會產出少一層路徑的錯誤網址）
const SITE_URL = 'https://joe94113.github.io/tw-environment-watch/'

const { render, ROUTE_PATHS } = await import(
  pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href
)

const template = await readFile(join(distDir, 'index.html'), 'utf8')

function replaceTag(html, pattern, replacement) {
  if (!pattern.test(html)) {
    throw new Error(`預期的樣板片段不存在，無法注入：${pattern}`)
  }
  return html.replace(pattern, replacement)
}

// 內容是自己產生的，但還是要跳脫，資料來源畢竟是外部 API
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

for (const path of ROUTE_PATHS) {
  const { html, title, description } = await render(path)

  const canonical = path === '/' ? SITE_URL : `${SITE_URL}${path.replace(/^\//, '')}/`

  let page = template
  page = replaceTag(page, /<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`)
  page = replaceTag(
    page,
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/,
    `<meta name="description" content="${escapeAttr(description)}" />`
  )
  page = replaceTag(
    page,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`
  )
  page = replaceTag(
    page,
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`
  )
  page = replaceTag(page, /<div id="app"><\/div>/, `<div id="app">${html}</div>`)

  const outFile =
    path === '/' ? join(distDir, 'index.html') : join(distDir, path.replace(/^\//, ''), 'index.html')

  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, page, 'utf8')
  console.log(`prerendered ${path} -> ${outFile.replace(root, '.')}`)
}

// 真的不存在的路徑走這裡。內容用首頁那份，使用者至少看得到東西，
// 而已經有實體檔案的兩條路由不會經過這裡，所以不影響 SEO。
await writeFile(join(distDir, '404.html'), await readFile(join(distDir, 'index.html'), 'utf8'), 'utf8')
console.log('wrote 404.html fallback')
