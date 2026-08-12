// 環境部官方 AQI 六級分級標準（0-500），不是自訂的區間。
// 新聞常講的「紅害」對應 151-200、「紫爆」對應 201-300。
const AQI_LEVELS = [
  { max: 50, label: '良好', color: 'var(--aqi-good)', textColor: 'var(--aqi-good-text)' },
  { max: 100, label: '普通', color: 'var(--aqi-moderate)', textColor: 'var(--aqi-moderate-text)' },
  { max: 150, label: '對敏感族群不健康', color: 'var(--aqi-sensitive)', textColor: 'var(--aqi-sensitive-text)' },
  { max: 200, label: '對所有族群不健康（紅害）', color: 'var(--aqi-unhealthy)', textColor: 'var(--aqi-unhealthy-text)' },
  { max: 300, label: '非常不健康（紫爆）', color: 'var(--aqi-very-unhealthy)', textColor: 'var(--aqi-very-unhealthy-text)' },
  { max: Infinity, label: '危害', color: 'var(--aqi-hazardous)', textColor: 'var(--aqi-hazardous-text)' },
]

/**
 * 依 AQI 數值回傳對應等級的文字說明跟顏色。
 * 數值不合法（負數、非數字）回傳 null，畫面端可以顯示「無資料」。
 */
export function getAqiLevel(aqi) {
  if (typeof aqi !== 'number' || Number.isNaN(aqi) || aqi < 0) return null
  const level = AQI_LEVELS.find((l) => aqi <= l.max)
  return { value: aqi, label: level.label, color: level.color, textColor: level.textColor }
}
