<script setup>
import { computed } from 'vue'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import topoData from '../data/taiwan-counties.topo.json'

const props = defineProps({
  // (countyId) => 顏色字串 | null，用來畫縣市底色（choropleth）
  countyColor: { type: Function, default: () => null },
  // 座標點標記，例如測站或震央：{ id, lat, lon, color, radius, label }
  points: { type: Array, default: () => [] },
})

const emit = defineEmits(['point-click'])

const geo = topojson.feature(topoData, topoData.objects.map)
const projection = d3.geoMercator().fitSize([420, 520], geo)
const pathGenerator = d3.geoPath(projection)

const counties = computed(() =>
  geo.features.map((feature) => ({
    id: feature.properties.id,
    name: feature.properties.name,
    d: pathGenerator(feature),
    fill: props.countyColor(feature.properties.id),
  }))
)

const projectedPoints = computed(() =>
  props.points
    .map((p) => {
      const coords = projection([p.lon, p.lat])
      if (!coords) return null
      return { ...p, x: coords[0], y: coords[1] }
    })
    .filter(Boolean)
)
</script>

<template>
  <svg viewBox="0 0 420 520" class="map" role="img" aria-label="台灣地圖視覺化，完整數據請見下方表格">
    <path
      v-for="county in counties"
      :key="county.id"
      :d="county.d"
      :fill="county.fill || 'var(--panel)'"
      :class="{ active: county.fill }"
      aria-hidden="true"
    >
      <title>{{ county.name }}</title>
    </path>

    <circle
      v-for="p in projectedPoints"
      :key="p.id"
      :cx="p.x"
      :cy="p.y"
      :r="p.radius || 4"
      :fill="p.color"
      class="point"
      aria-hidden="true"
      @click="emit('point-click', p)"
    >
      <title>{{ p.label }}</title>
    </circle>
  </svg>
</template>

<style scoped>
.map {
  width: 100%;
  height: auto;
  max-height: 70vh;
}
path {
  stroke: var(--line);
  stroke-width: 0.6;
  transition: fill 0.4s ease;
}
path.active {
  stroke: var(--ink);
  stroke-width: 1;
}
.point {
  stroke: var(--paper);
  stroke-width: 1;
  cursor: pointer;
  transition: r 0.15s ease;
}
.point:hover {
  stroke: var(--ink);
}
</style>
