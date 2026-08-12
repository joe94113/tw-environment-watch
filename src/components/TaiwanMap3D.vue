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
  // 高度不是對「0~滿分」正規化，而是對「這批資料實際的範圍」拉伸，
  // 詳細理由看下面 computeDomain()。minSpan 是這個範圍的最小寬度。
  minSpan: { type: Number, default: 1 },
  // 指標的零點有意義時（例如震度 0 就是沒感覺）把下界釘在這個值，
  // 不要浮動；AQI 沒有這種零點，維持 null 讓下界跟著資料跑。
  domainMin: { type: Number, default: null },
  minHeight: { type: Number, default: 6 },
  maxHeight: { type: Number, default: 95 },
  // 顯示在角落的高度刻度說明，例如 'AQI'、'震度'
  valueLabel: { type: String, default: '' },
})

const canvasEl = ref(null)
const scaleLabel = ref('')
let renderer, scene, camera, controls, animationId, countyGroup
let resizeObserver

// 完整精度的海岸線資料點太密，擠出 3D 時每一小段海岸線都變成一面
// 朝向略有不同的牆，燈光照下去產生毛刺／刺蝟感。3D 用簡化過的版本，
// 2D 平面圖（TaiwanMap.vue）跟資料表格不受影響，繼續用完整精度。
const simplifiedTopo = simplify(presimplify(topoData), 0.001)
const geo = topojson.feature(simplifiedTopo, simplifiedTopo.objects.map)
const projection = d3.geoMercator().fitSize([420, 520], geo)

const DEFAULT_COLOR = '#9aa5a8'

// countyColor 回傳的是 CSS 變數字串（例如 'var(--aqi-moderate)'）。2D 的 SVG
// 直接塞進 fill 就會由瀏覽器解析，但 THREE.Color 看不懂 var()，解析失敗會
// 靜靜地 fallback 成白色 —— 所以先前 3D 地圖上每個縣市其實都是同一片白，
// 分級顏色完全沒有畫出來。這裡先自己把變數查成實際色碼再交給 three。
// 專案只有單一淺色主題（style.css 寫死 color-scheme: light），查到的值不會
// 中途改變，可以放心快取。
const cssVarCache = new Map()

function resolveColor(value) {
  if (typeof value !== 'string' || value === '') return DEFAULT_COLOR

  const varName = value.trim().match(/^var\(\s*(--[\w-]+)/)?.[1]
  if (!varName) return value

  if (!cssVarCache.has(varName)) {
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    cssVarCache.set(varName, resolved || DEFAULT_COLOR)
  }
  return cssVarCache.get(varName)
}

const outlineMaterial = new THREE.LineBasicMaterial({
  color: 0x2f3739,
  transparent: true,
  opacity: 0.45,
})

/**
 * 決定高度要對應到哪一段數值範圍。
 *
 * 早期版本是固定的 (value / 300) * maxHeight，結果全台 AQI 平常都落在
 * 40~100 之間，換算出來每個縣市高度只差幾個單位，在 420x520 的地圖上
 * 根本看不出來，整塊像一片平板。改成用「當下這批資料的實際 min~max」
 * 去拉伸，縣市之間的高低差才會明顯。
 *
 * 但純照實際範圍拉滿會有反效果：如果今天全台都是 60~62，2 點的差距
 * 會被畫成一座山，看起來像空品差很多。所以再加一個 minSpan 下限把範圍
 * 撐開，平靜的一天畫出來就真的比較平。
 */
function computeDomain() {
  const values = geo.features
    .map((f) => props.countyValue(f.properties.id))
    .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)

  if (values.length === 0) return null

  const pinned = props.domainMin != null
  let lo = pinned ? props.domainMin : Math.min(...values)
  let hi = Math.max(...values)

  if (hi - lo < props.minSpan) {
    if (pinned) {
      hi = lo + props.minSpan
    } else {
      const mid = (lo + hi) / 2
      lo = mid - props.minSpan / 2
      hi = mid + props.minSpan / 2
    }
  }

  return { lo, hi }
}

function heightOf(value, domain) {
  if (!domain) return props.minHeight
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return props.minHeight

  const t = Math.min(1, Math.max(0, (value - domain.lo) / (domain.hi - domain.lo)))
  return props.minHeight + t * (props.maxHeight - props.minHeight)
}

function buildCountyGroup() {
  const group = new THREE.Group()
  const domain = computeDomain()

  for (const feature of geo.features) {
    const id = feature.properties.id
    const height = heightOf(props.countyValue(id), domain)
    const color = resolveColor(props.countyColor(id))

    const polygons =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates

    for (const polygon of polygons) {
      const outer = polygon[0]
      const points2D = outer
        .map(([lon, lat]) => {
          const projected = projection([lon, lat])
          if (!projected) return null
          // 投影出來是螢幕座標（y 往下為南），底下 rotateX 會把 y 轉成世界的
          // -Z，相機又架在 +Z，不先把 y 反號的話整個島會南北顛倒（北部跑到
          // 畫面下方），但東西向還是正的，看起來就是一個鏡像的台灣。
          return new THREE.Vector2(projected[0] - 210, -(projected[1] - 260))
        })
        .filter(Boolean)

      if (points2D.length < 3) continue

      const shape = new THREE.Shape(points2D)
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      // ExtrudeGeometry 預設往 +Z 擠出（螢幕外），轉 90 度讓它變成「往上」
      geometry.rotateX(-Math.PI / 2)

      const material = new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 0.85,
        metalness: 0,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.countyId = id
      mesh.userData.countyName = feature.properties.name
      group.add(mesh)

      // 相鄰縣市常常是同一個等級同一個顏色，沒有邊界線會糊成一大塊，
      // 在頂面邊緣描一圈線，縣市界線跟高低落差才分得出來。
      const ring = new THREE.BufferGeometry().setFromPoints(
        points2D.map((p) => new THREE.Vector3(p.x, p.y, height + 0.2))
      )
      ring.rotateX(-Math.PI / 2)
      group.add(new THREE.LineLoop(ring, outlineMaterial))
    }
  }

  if (domain && props.valueLabel) {
    scaleLabel.value = `高度對應 ${props.valueLabel} ${Math.round(domain.lo)}–${Math.round(domain.hi)}`
  } else {
    scaleLabel.value = ''
  }

  return group
}

function disposeGroup(group) {
  group.traverse((obj) => {
    obj.geometry?.dispose()
    // 描邊共用同一個 material，留給 onBeforeUnmount 處理
    if (obj.material && obj.material !== outlineMaterial) obj.material.dispose()
  })
}

function rebuildCounties() {
  if (!scene) return
  if (countyGroup) {
    scene.remove(countyGroup)
    disposeGroup(countyGroup)
  }
  countyGroup = buildCountyGroup()
  scene.add(countyGroup)
}

function initScene() {
  const el = canvasEl.value
  const width = el.clientWidth
  const height = el.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(resolveColor('var(--bg)'))

  camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000)
  camera.position.set(0, 240, 360)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  // 柱子變高之後，視覺重心跟著往上跑，鏡頭焦點也抬高一點才不會偏下
  controls.target.set(0, 20, 0)
  controls.maxPolarAngle = Math.PI / 2.1
  controls.minDistance = 120
  controls.maxDistance = 700
  controls.enableDamping = true

  // 環境光壓低、主光加強並且從側邊斜打，柱子的側面才會跟頂面明顯分層。
  // 光源太平均的話高度差只剩輪廓可以判斷，會更看不出來。
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c9ba0, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 1.15)
  sun.position.set(-220, 300, 120)
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
  if (countyGroup) disposeGroup(countyGroup)
  outlineMaterial.dispose()
  controls?.dispose()
  renderer?.dispose()
})

// countyValue/countyColor 是函式，父層通常會換整個函式參照來觸發更新
watch(() => [props.countyValue, props.countyColor], rebuildCounties)
</script>

<template>
  <div ref="canvasEl" class="canvas-host" role="img" aria-label="3D 立體地圖視覺化，完整數據請見下方表格">
    <p class="hint" aria-hidden="true">拖曳旋轉、滾輪縮放</p>
    <p v-if="scaleLabel" class="scale" aria-hidden="true">{{ scaleLabel }}</p>
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
.hint,
.scale {
  position: absolute;
  bottom: 0.75rem;
  margin: 0;
  padding: 0.3rem 0.7rem;
  background: rgba(246, 248, 248, 0.85);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--ink-soft);
  pointer-events: none;
}
.hint {
  left: 0.75rem;
}
.scale {
  right: 0.75rem;
  font-family: var(--font-mono);
}
</style>
