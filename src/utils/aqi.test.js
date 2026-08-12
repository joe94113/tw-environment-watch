import { describe, it, expect } from 'vitest'
import { getAqiLevel } from './aqi.js'

describe('getAqiLevel', () => {
  it('50 以下是良好', () => {
    expect(getAqiLevel(35).label).toBe('良好')
  })
  it('51-100 是普通', () => {
    expect(getAqiLevel(80).label).toBe('普通')
  })
  it('151-200 是對所有族群不健康（紅害）', () => {
    expect(getAqiLevel(180).label).toContain('紅害')
  })
  it('201-300 是非常不健康（紫爆）', () => {
    expect(getAqiLevel(250).label).toContain('紫爆')
  })
  it('301 以上是危害', () => {
    expect(getAqiLevel(350).label).toBe('危害')
  })
  it('邊界值 50 算良好，51 算普通', () => {
    expect(getAqiLevel(50).label).toBe('良好')
    expect(getAqiLevel(51).label).toBe('普通')
  })
  it('負數或非數字回傳 null', () => {
    expect(getAqiLevel(-5)).toBe(null)
    expect(getAqiLevel(NaN)).toBe(null)
    expect(getAqiLevel('80')).toBe(null)
  })
})
