import { describe, it, expect, vi } from 'vitest'
import { fetchWithRetry } from './fetch-retry.js'

const ok = { ok: true, status: 200 }
const fail = (status, statusText = '') => ({ ok: false, status, statusText })

// 測試不要真的等，把 sleep 換掉並記錄被要求等多久
function makeHarness(responses) {
  const delays = []
  const queue = [...responses]
  const fetchImpl = vi.fn(async () => {
    const next = queue.shift()
    if (next instanceof Error) throw next
    return next
  })
  return {
    fetchImpl,
    delays,
    options: {
      label: '測試 API',
      fetchImpl,
      sleep: async (ms) => { delays.push(ms) },
      log: () => {},
    },
  }
}

describe('fetchWithRetry', () => {
  it('第一次就成功時不重試', async () => {
    const h = makeHarness([ok])
    await expect(fetchWithRetry('u', h.options)).resolves.toBe(ok)
    expect(h.fetchImpl).toHaveBeenCalledTimes(1)
    expect(h.delays).toEqual([])
  })

  it('500 會重試，之後成功就回傳', async () => {
    const h = makeHarness([fail(500, 'Internal Server Error'), ok])
    await expect(fetchWithRetry('u', h.options)).resolves.toBe(ok)
    expect(h.fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('退避時間是 1s、2s、4s 遞增', async () => {
    const h = makeHarness([fail(500), fail(503), fail(502), ok])
    await fetchWithRetry('u', h.options)
    expect(h.delays).toEqual([1000, 2000, 4000])
  })

  it('連線層直接炸掉也會重試', async () => {
    const h = makeHarness([new Error('ECONNRESET'), ok])
    await expect(fetchWithRetry('u', h.options)).resolves.toBe(ok)
    expect(h.fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('429 被限流也算可重試', async () => {
    const h = makeHarness([fail(429, 'Too Many Requests'), ok])
    await expect(fetchWithRetry('u', h.options)).resolves.toBe(ok)
  })

  it('401 之類的 4xx 立刻放棄，不浪費時間重試', async () => {
    const h = makeHarness([fail(401, 'Unauthorized')])
    await expect(fetchWithRetry('u', h.options)).rejects.toThrow('401')
    expect(h.fetchImpl).toHaveBeenCalledTimes(1)
    expect(h.delays).toEqual([])
  })

  it('404 也不重試', async () => {
    const h = makeHarness([fail(404, 'Not Found')])
    await expect(fetchWithRetry('u', h.options)).rejects.toThrow('404')
    expect(h.fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('重試用完仍失敗就拋錯，並帶上最後一次的原因', async () => {
    const h = makeHarness([fail(500), fail(500), fail(500), fail(503, 'Service Unavailable')])
    await expect(fetchWithRetry('u', h.options)).rejects.toThrow(/重試 3 次後仍然失敗.*503/)
    expect(h.fetchImpl).toHaveBeenCalledTimes(4) // 第一次 + 3 次重試
  })

  it('retries 可以調整', async () => {
    const h = makeHarness([fail(500), fail(500)])
    await expect(fetchWithRetry('u', { ...h.options, retries: 1 })).rejects.toThrow()
    expect(h.fetchImpl).toHaveBeenCalledTimes(2)
  })
})
