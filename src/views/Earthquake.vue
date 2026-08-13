<script setup>
import { computed } from 'vue'
import MapView from '../components/MapView.vue'
import StatHero from '../components/StatHero.vue'
import DataTable from '../components/DataTable.vue'
import { getIntensityMeta, maxIntensityByCounty } from '../utils/earthquake.js'
import { formatDateTime, formatRelative } from '../utils/datetime.js'
import store from '../data/earthquakes.json'

const earthquakes = store.earthquakes ?? []
const hasData = earthquakes.length > 0
const latest = earthquakes[0] ?? null

const latestCountyIntensity = computed(() => {
  if (!latest) return {}
  return maxIntensityByCounty(
    latest.counties.map((c) => ({ countyId: c.countyId, intensity: c.intensity }))
  )
})

function countyColor(id) {
  const level = getIntensityMeta(latestCountyIntensity.value[id])
  return level ? level.color : null
}
function countyValue(id) {
  return latestCountyIntensity.value[id] ?? 0
}

// 震度的 0 是「這次沒感覺」，是有意義的讀數，不能顯示成「沒有資料」
function formatIntensity(value) {
  const meta = getIntensityMeta(value)
  if (!meta) return '無資料'
  return value === 0 ? '無感' : `震度 ${value}・${meta.label}`
}

// 「最近一次地震」讀者真正在意的是「多久以前」，所以相對時間放前面，
// 絕對時間放括號裡備查。相對時間在頁面載入時算，不會自己跳動。
const latestWhen = computed(() => {
  if (!latest) return ''
  const relative = formatRelative(latest.time)
  const absolute = formatDateTime(latest.time)
  return relative ? `${relative}（${absolute}）` : absolute
})

const maxIntensityOfLatest = computed(() => {
  if (!latest) return null
  const values = latest.counties.map((c) => c.intensity)
  return values.length ? Math.max(...values) : null
})

const tableColumns = [
  { key: 'time', label: '時間' },
  { key: 'location', label: '地點' },
  { key: 'magnitude', label: '規模', numeric: true },
  { key: 'depth', label: '深度(km)', numeric: true },
  { key: 'maxIntensity', label: '最大震度' },
]
const tableRows = computed(() =>
  earthquakes.map((eq) => {
    const values = eq.counties.map((c) => c.intensity)
    const max = values.length ? Math.max(...values) : 0
    const meta = getIntensityMeta(max)
    return {
      id: eq.id,
      time: formatDateTime(eq.time),
      // 顯示值已經不能拿來排序了，原始 ISO 字串留給 DataTable 當排序依據
      timeSort: eq.time,
      location: eq.location,
      magnitude: eq.magnitude,
      depth: eq.depth,
      maxIntensity: meta?.label ?? '無感',
      maxIntensityStyle: { color: meta?.textColor },
    }
  })
)
</script>

<template>
  <div class="page">
    <template v-if="hasData">
      <StatHero
        eyebrow="最近一次地震"
        :value="`M${latest.magnitude}`"
        :label="`${latest.location}．${latestWhen}`"
        :accent-color="getIntensityMeta(maxIntensityOfLatest)?.textColor"
      />

      <!-- 震度 0 是「沒感覺」，是有意義的零點，所以下界釘死在 0，
           高度才會忠實反映震度大小，而不是跟著當次地震的最小震度浮動 -->
      <MapView
        :county-value="countyValue"
        :county-color="countyColor"
        :domain-min="0"
        :min-span="3"
        value-label="震度"
        :format-value="formatIntensity"
      />

      <div class="legend">
        <span v-for="lv in [
          ['微震／輕震','var(--quake-1)'],['弱震','var(--quake-2)'],['中震','var(--quake-3)'],
          ['強震／烈震','var(--quake-4)'],['劇震','var(--quake-5)']
        ]" :key="lv[0]" class="legend-item">
          <span class="dot" :style="{ background: lv[1] }" aria-hidden="true"></span>{{ lv[0] }}
        </span>
      </div>

      <h2 class="table-heading">近期地震列表</h2>
      <DataTable caption="近期顯著有感地震列表，可依欄位排序" :columns="tableColumns" :rows="tableRows" />
    </template>

    <div v-else class="empty">
      <p class="empty-title">還沒有資料</p>
      <p class="empty-body">
        GitHub Actions 排程還沒成功抓到資料，或是還沒執行過。
        確認 <code>CWA_API_KEY</code> 有沒有在 GitHub Secrets 設定好，
        或先在本機跑 <code>npm run fetch:earthquake</code> 手動測試一次。
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
