// 政府開放資料的 API 偶爾會回 500，通常幾秒後就恢復。單次失敗就整個
// workflow 陣亡不划算：build 有 needs: update-data，抓資料失敗會連帶
// 讓建置跟部署整個被跳過。所以這裡先自己重試幾次。

// 「等一下可能就好」的狀況：伺服器端錯誤、逾時、被限流
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 會重試的 fetch，成功時回傳 Response。
 *
 * 只重試有機會自己好的狀況：RETRYABLE_STATUS 裡的狀態碼，以及連線層
 * 直接失敗（DNS、連線中斷，fetch 自己 throw）。
 *
 * 其他 4xx 一律立刻放棄 —— API key 打錯、網址寫錯這種問題重試一百次也
 * 一樣，只會拖長 workflow，還會把真正的設定錯誤埋在一堆重試訊息裡。
 *
 * fetchImpl / sleep 可以注入，測試才不用真的連網路、真的等待。
 */
export async function fetchWithRetry(url, options = {}) {
  const {
    label = 'API',
    retries = 3,
    baseDelayMs = 1000,
    fetchImpl = fetch,
    sleep = defaultSleep,
    log = console.warn,
  } = options

  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelayMs * 2 ** (attempt - 1) // 1s, 2s, 4s...
      log(`${label} 第 ${attempt} 次重試，等 ${delay}ms（上一次：${lastError.message}）`)
      await sleep(delay)
    }

    let res
    try {
      res = await fetchImpl(url)
    } catch (err) {
      // 連線都沒建立起來，等一下再試有機會成功
      lastError = err
      continue
    }

    if (res.ok) return res

    const error = new Error(`${label} 回傳錯誤：${res.status} ${res.statusText}`)
    if (!RETRYABLE_STATUS.has(res.status)) throw error
    lastError = error
  }

  throw new Error(`${label} 重試 ${retries} 次後仍然失敗：${lastError.message}`)
}
