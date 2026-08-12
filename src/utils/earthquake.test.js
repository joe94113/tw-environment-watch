import { describe, it, expect } from 'vitest'
import { getIntensityMeta, maxIntensityByCounty } from './earthquake.js'

describe('getIntensityMeta', () => {
  it('0 級是無感，沒有顏色', () => {
    const meta = getIntensityMeta(0)
    expect(meta.label).toBe('無感')
    expect(meta.color).toBe(null)
  })
  it('4 級是中震', () => {
    expect(getIntensityMeta(4).label).toBe('中震')
  })
  it('7 級是劇震', () => {
    expect(getIntensityMeta(7).label).toBe('劇震')
  })
  it('負數或非整數回傳 null', () => {
    expect(getIntensityMeta(-1)).toBe(null)
    expect(getIntensityMeta(3.5)).toBe(null)
  })
})

describe('maxIntensityByCounty', () => {
  it('同一縣市多筆資料取最大震度', () => {
    const result = maxIntensityByCounty([
      { countyId: '63000', intensity: 3 },
      { countyId: '63000', intensity: 5 },
      { countyId: '64000', intensity: 2 },
    ])
    expect(result).toEqual({ '63000': 5, '64000': 2 })
  })

  it('空陣列回傳空物件', () => {
    expect(maxIntensityByCounty([])).toEqual({})
  })
})
