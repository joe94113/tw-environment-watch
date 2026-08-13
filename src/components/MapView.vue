<script setup>
import { ref, defineAsyncComponent } from 'vue'
import TaiwanMap from './TaiwanMap.vue'

// 3D 元件用非同步載入，切到 2D 時就不用載入 three.js 那包，
// 對只想看 2D 的人（或載入 3D 失敗時）比較友善。
const TaiwanMap3D = defineAsyncComponent(() => import('./TaiwanMap3D.vue'))

const props = defineProps({
  countyColor: { type: Function, default: () => null },
  countyValue: { type: Function, default: () => 0 },
  minSpan: { type: Number, default: 1 },
  domainMin: { type: Number, default: null },
  minHeight: { type: Number, default: 5 },
  maxHeight: { type: Number, default: 70 },
  valueLabel: { type: String, default: '' },
  formatValue: { type: Function, default: null },
  points: { type: Array, default: () => [] },
})

// 預先渲染是在 Node 裡跑的，WebGL 畫不出來，所以 SSR 時輸出 2D 版本。
// 這樣爬蟲跟首屏拿到的是真的有內容的 SVG 地圖，不是一個空 div；
// 瀏覽器端掛載後就換回 3D。
const mode = ref(import.meta.env.SSR ? '2d' : '3d')
</script>

<template>
  <div class="map-view">
    <button type="button" class="toggle" @click="mode = mode === '3d' ? '2d' : '3d'">
      切換成{{ mode === '3d' ? '2D 平面地圖' : '3D 立體地圖' }}
    </button>

    <Suspense v-if="mode === '3d'">
      <TaiwanMap3D
        :county-color="countyColor"
        :county-value="countyValue"
        :min-span="minSpan"
        :domain-min="domainMin"
        :min-height="minHeight"
        :max-height="maxHeight"
        :value-label="valueLabel"
        :format-value="formatValue"
      />
      <template #fallback>
        <div class="loading">載入 3D 地圖中…</div>
      </template>
    </Suspense>

    <TaiwanMap v-else :county-color="countyColor" :points="points" />
  </div>
</template>

<style scoped>
.map-view {
  position: relative;
}
.toggle {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink-soft);
  font-size: 0.8rem;
  cursor: pointer;
}
.toggle:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.loading {
  height: 60vh;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
  font-size: 0.9rem;
  border: 1px solid var(--line);
  border-radius: 8px;
}
</style>
