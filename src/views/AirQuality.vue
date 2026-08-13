<script setup>
import { computed } from 'vue'
import MapView from '../components/MapView.vue'
import StatHero from '../components/StatHero.vue'
import DataTable from '../components/DataTable.vue'
import { getAqiLevel } from '../utils/aqi.js'
import { maxAqiByCounty, averageAqi } from '../utils/aggregate-aqi.js'
import { formatDateTime, formatRelative } from '../utils/datetime.js'
import latest from '../data/air-quality-latest.json'

const stations = latest.stations ?? []
const hasData = stations.length > 0

// 只寫「每 3 小時更新一次」使用者還是不知道手上這份是幾點的資料，
// 把 updatedAt 實際秀出來。抓不到時間就退回原本的說明文字。
const updatedLabel = computed(() => {
  const absolute = formatDateTime(latest.updatedAt)
  if (!absolute) return '資料每 3 小時更新一次'

  const relative = formatRelative(latest.updatedAt)
  return relative ? `${absolute} 更新（${relative}）` : `${absolute} 更新`
})

const countyAqi = computed(() => maxAqiByCounty(stations))
const avg = computed(() => averageAqi(stations))
const avgLevel = computed(() => (avg.value != null ? getAqiLevel(avg.value) : null))

function countyColor(id) {
  const level = getAqiLevel(countyAqi.value[id])
  return level ? level.color : null
}
// 沒有測站的縣市回 null 而不是 0：AQI 0 不是一個真實讀數，回 0 會讓
// 提示框寫成「AQI 0」，看起來像空氣好到爆表。null 會被當成沒有資料。
function countyValue(id) {
  return countyAqi.value[id] ?? null
}

const tableColumns = [
  { key: 'name', label: '測站' },
  { key: 'county', label: '縣市' },
  { key: 'aqi', label: 'AQI', numeric: true },
  { key: 'level', label: '等級' },
]
const tableRows = computed(() =>
  stations
    .filter((s) => s.aqi != null)
    .map((s) => {
      const level = getAqiLevel(s.aqi)
      return {
        id: s.id,
        name: s.name,
        county: s.county,
        aqi: s.aqi,
        aqiStyle: { color: level?.textColor, fontWeight: 600 },
        level: level?.label ?? '',
        levelStyle: { color: level?.textColor },
      }
    })
)
</script>

<template>
  <div class="page">
    <template v-if="hasData">
      <StatHero
        eyebrow="全台平均 AQI"
        :value="String(avg)"
        :label="updatedLabel"
        :accent-color="avgLevel?.textColor"
      />

      <!-- minSpan 60 大約是一個 AQI 等級的寬度：全台都在同一級的日子，
           地圖畫出來就該是平的，不該把幾點的差距放大成明顯高低 -->
      <MapView
        :county-value="countyValue"
        :county-color="countyColor"
        :min-span="60"
        value-label="AQI"
      />

      <div class="legend">
        <span v-for="lv in [
          ['良好','var(--aqi-good)'],['普通','var(--aqi-moderate)'],['敏感族群不良','var(--aqi-sensitive)'],
          ['紅害','var(--aqi-unhealthy)'],['紫爆','var(--aqi-very-unhealthy)'],['危害','var(--aqi-hazardous)']
        ]" :key="lv[0]" class="legend-item">
          <span class="dot" :style="{ background: lv[1] }" aria-hidden="true"></span>{{ lv[0] }}
        </span>
      </div>

      <h2 class="table-heading">各測站即時 AQI</h2>
      <DataTable caption="各測站即時空氣品質指標，可依欄位排序" :columns="tableColumns" :rows="tableRows" />
    </template>

    <div v-else class="empty">
      <p class="empty-title">還沒有資料</p>
      <p class="empty-body">
        GitHub Actions 排程還沒成功抓到資料，或是還沒執行過。
        確認 <code>MOENV_API_KEY</code> 有沒有在 GitHub Secrets 設定好，
        或先在本機跑 <code>npm run fetch:air-quality</code> 手動測試一次。
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin: 1rem 0 2rem;
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.table-heading {
  font-size: 1rem;
  margin: 0 0 0.75rem;
}
.empty {
  padding: 3rem 0;
  text-align: center;
}
.empty-title {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 1.3rem;
  margin: 0 0 0.5rem;
}
.empty-body {
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.7;
  max-width: 420px;
  margin: 0 auto;
}
.empty-body code {
  font-family: var(--font-mono);
  background: var(--panel);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-size: 0.85em;
}
</style>
