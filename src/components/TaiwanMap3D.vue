<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { presimplify, simplify } from 'topojson-simplify'
import topoData from '../data/taiwan-counties.topo.json'

const props = defineProps({
  // (countyId) => 數值，決定該縣市擠出的高度（例如 AQI 數值、地震震度）
  countyValue: { type: Function, default: () => 0 },
  // (countyId) => 顏色字串
  countyColor: { type: Function, default: () => '#9aa5a8' },
  // countyValue 的正規化上限，達到這個值時擠出高度會是 maxHeight
  maxValue: { type: Number, default: 100 },
  maxHeight: { type: Number, default: 55 },
})

const canvasEl = ref(null)
let renderer, scene, camera, controls, animationId, countyGroup
let resizeObserver

// 完整精度的海岸線資料點太密，擠出 3D 時每一小段海岸線都變成一面
// 朝向略有不同的牆，燈光照下去產生毛刺／刺蝟感。3D 用簡化過的版本，
// 2D 平面圖（TaiwanMap.vue）跟資料表格不受影響，繼續用完整精度。
const simplifiedTopo = simplify(presimplify(topoData), 0.001)
const geo = topojson.feature(simplifiedTopo, simplifiedTopo.objects.map)
const projection = d3.geoMercator().fitSize([420, 520], geo)

function buildCountyGroup() {
  const group = new THREE.Group()

  for (const feature of geo.features) {
    const id = feature.properties.id
    const rawValue = props.countyValue(id) || 0
    const height = Math.max(1.5, (rawValue / props.maxValue) * props.maxHeight)
    const color = props.countyColor(id) || '#9aa5a8'

    const polygons =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates

    for (const polygon of polygons) {
      const outer = polygon[0]
      const points2D = outer
        .map(([lon, lat]) => {
          const projected = projection([lon, lat])
          if (!projected) return null
          return new THREE.Vector2(projected[0] - 210, projected[1] - 260)
        })
        .filter(Boolean)

      if (points2D.length < 3) continue

      const shape = new THREE.Shape(points2D)
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      // ExtrudeGeometry 預設往 +Z 擠出（螢幕外），轉 90 度讓它變成「往上」
      geometry.rotateX(-Math.PI / 2)

      const material = new THREE.MeshStandardMaterial({ color, flatShading: true })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.countyId = id
      mesh.userData.countyName = feature.properties.name
      group.add(mesh)
    }
  }

  return group
}

function rebuildCounties() {
  if (!scene) return
  if (countyGroup) scene.remove(countyGroup)
  countyGroup = buildCountyGroup()
  scene.add(countyGroup)
}

function initScene() {
  const el = canvasEl.value
  const width = el.clientWidth
  const height = el.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe7ebec)

  camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000)
  camera.position.set(0, 260, 340)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.maxPolarAngle = Math.PI / 2.1
  controls.minDistance = 120
  controls.maxDistance = 700
  controls.enableDamping = true

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(150, 300, 200)
  scene.add(sun)

  rebuildCounties()

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  resizeObserver = new ResizeObserver(() => {
    const w = el.clientWidth
    const h = el.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  resizeObserver.observe(el)
}

onMounted(initScene)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
})

// countyValue/countyColor 是函式，父層通常會換整個函式參照來觸發更新
watch(() => [props.countyValue, props.countyColor], rebuildCounties)
</script>

<template>
  <div ref="canvasEl" class="canvas-host" role="img" aria-label="3D 立體地圖視覺化，完整數據請見下方表格">
    <p class="hint" aria-hidden="true">拖曳旋轉、滾輪縮放</p>
  </div>
</template>

<style scoped>
.canvas-host {
  position: relative;
  width: 100%;
  height: 60vh;
  min-height: 420px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--line);
}
.canvas-host :deep(canvas) {
  display: block;
}
.hint {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  margin: 0;
  padding: 0.3rem 0.7rem;
  background: rgba(246, 248, 248, 0.85);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--ink-soft);
  pointer-events: none;
}
</style>
