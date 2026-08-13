import { describe, it, expect } from 'vitest'
import { formatDateTime, formatMonthDay, formatRelative } from './datetime.js'

describe('formatDateTime', () => {
  it('把 ISO 8601 轉成看得懂的格式', () => {
    expect(formatDateTime('2026-08-13T03:54:22+08:00')).toBe('2026/08/13 03:54')
  })

  it('月、日、時、分都補到兩位數', () => {
    expect(formatDateTime('2026-01-02T03:04:05+08:00')).toBe('2026/01/02 03:04')
  })

  it('半夜十二點是 00:00 不是 24:00', () => {
    expect(formatDateTime('2026-01-01T00:00:00+08:00')).toBe('2026/01/01 00:00')
  })

  it('不是 +08:00 的時間會換算成台灣時間', () => {
    // 2026-08-12 20:00 UTC 是台灣時間隔天凌晨 4 點
    expect(formatDateTime('2026-08-12T20:00:00Z')).toBe('2026/08/13 04:00')
  })

  it('解析不出來的值回傳空字串，不要顯示 Invalid Date', () => {
    expect(formatDateTime('不是時間')).toBe('')
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
  })
})

describe('formatMonthDay', () => {
  it('省略年份', () => {
    expect(formatMonthDay('2026-08-13T03:54:22+08:00')).toBe('08/13 03:54')
  })

  it('解析不出來的值回傳空字串', () => {
    expect(formatMonthDay('壞掉的值')).toBe('')
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-08-13T12:00:00+08:00')

  it('一分鐘內算剛剛', () => {
    expect(formatRelative('2026-08-13T11:59:30+08:00', now)).toBe('剛剛')
  })

  it('資料時間比現在新（時鐘誤差）也算剛剛，不會出現負數', () => {
    expect(formatRelative('2026-08-13T12:05:00+08:00', now)).toBe('剛剛')
  })

  it('未滿一小時顯示分鐘', () => {
    expect(formatRelative('2026-08-13T11:15:00+08:00', now)).toBe('45 分鐘前')
  })

  it('未滿一天顯示小時', () => {
    expect(formatRelative('2026-08-13T03:00:00+08:00', now)).toBe('9 小時前')
  })

  it('未滿三十天顯示天', () => {
    expect(formatRelative('2026-08-10T12:00:00+08:00', now)).toBe('3 天前')
  })

  it('超過三十天顯示月', () => {
    expect(formatRelative('2026-05-13T12:00:00+08:00', now)).toBe('3 個月前')
  })

  it('超過一年顯示年', () => {
    expect(formatRelative('2024-08-13T12:00:00+08:00', now)).toBe('2 年前')
  })

  it('解析不出來的值回傳空字串', () => {
    expect(formatRelative('壞掉的值', now)).toBe('')
  })
})
