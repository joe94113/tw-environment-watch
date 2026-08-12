import { describe, it, expect } from 'vitest'
import { maxAqiByCounty, averageAqi } from './aggregate-aqi.js'

describe('maxAqiByCounty', () => {
  it('同縣市多個測站取最高值', () => {
    const result = maxAqiByCounty([
      { county: '臺北市', aqi: 80 },
      { county: '臺北市', aqi: 120 },
      { county: '高雄市', aqi: 60 },
    ])
    expect(result).toEqual({ '63000': 120, '64000': 60 })
  })

  it('忽略沒有 aqi 或縣市對不到代碼的測站', () => {
    const result = maxAqiByCounty([
      { county: '臺北市', aqi: null },
      { county: '不存在的縣市', aqi: 100 },
    ])
    expect(result).toEqual({})
  })

  it('「台」「臺」兩種寫法都能對應到同一個縣市代碼', () => {
    const result = maxAqiByCounty([{ county: '台北市', aqi: 88 }])
    expect(result).toEqual({ '63000': 88 })
  })

  it('空陣列回傳空物件', () => {
    expect(maxAqiByCounty([])).toEqual({})
  })
})

describe('averageAqi', () => {
  it('算出平均值並四捨五入', () => {
    expect(averageAqi([{ aqi: 100 }, { aqi: 101 }])).toBe(101)
  })
  it('沒有資料回傳 null', () => {
    expect(averageAqi([])).toBe(null)
    expect(averageAqi([{ aqi: null }])).toBe(null)
  })
})
