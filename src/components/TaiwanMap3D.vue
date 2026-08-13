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
  minHeight: { type: Number, default: 5 },
  // 相對於 420x520 的地圖底面積，再高就會變成一片採石場而不是地圖
  maxHeight: { type: Number, default: 70 },
  // 顯示在角落的高度刻度說明，例如 'AQI'、'震度'
  valueLabel: { type: String, default: '' },
  // (value) => 字串，決定提示框裡數值怎麼寫。不給就用 valueLabel + 數值。
  // 震度會需要它，因為 0 代表「無感」而不是「沒有資料」。
  formatValue: { type: Function, default: null },
})

const canvasEl = ref(null)
const scaleLabel = ref('')
const hover = ref(null) // { name, value, x, y }
// 取景範圍（只含本島），由 buildCountyGroup 累積、frameScene 使用
const frameBox = new THREE.Box3()
let renderer, scene, camera, controls, animationId, countyGroup
let resizeObserver
// 只對縣市實體做 raycast，描邊的 LineLoop 不參與
let pickTargets = []
let hoveredMesh = null
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

// 完整精度的海岸線資料點太密，擠出 3D 時每一小段海岸線都變成一面
// 朝向略有不同的牆，燈光照下去產生毛刺／刺蝟感。3D 用簡化過的版本，
// 2D 平面圖（TaiwanMap.vue）跟資料表格不受影響，繼續用完整精度。
//
// 但門檻不能開太大。實測 0.001 會把馬祖（連江縣）6 個部分全部壓成 0 寬度，
// 擠出來就是一片浮在海上的薄板；0.0002 保得住馬祖（3.8）跟澎湖（16.1），
// 點數 1092 也還在完整精度 3032 的三分之一左右，毛刺一樣壓得下來。
const simplifiedTopo = simplify(presimplify(topoData), 0.0002)

// 就算不簡化，本來就有幾個小島小到投影後不足 1 個單位（實測 5 個）。
// 這種環擠出來是一根沒有厚度的針，只會變成畫面上的雜訊，直接不畫。
const MIN_FOOTPRINT = 1

// 小琉球、蘭嶼、綠島這些碎塊投影後只有 2~4 個單位寬，擠到跟本島一樣高
// 就是一根浮在海上的針，只會變成畫面上的雜訊 —— 而且那麼細的柱子本來就
// 讀不出高度。小於這個尺寸的地塊一律畫成平的，等級交給顏色表示。
// 門檻取 10：最小的實心行政區嘉義市有 9.2，剛好還是留著高度的那一邊。
const FLAT_BELOW = 10

// 框景只看「本島」。離島散得很開（連島嶼在內整張圖是 420x520，本島本身
// 只有 158x296），全部算進去的話鏡頭得拉到很遠，台灣本體會縮成中間一小塊。
// 只用夠大的塊去算取景範圍，離島落在畫面邊緣或稍微外面，滾輪縮小就看得到。
const FRAME_MIN_FOOTPRINT = 20
const geo = topojson.feature(simplifiedTopo, simplifiedTopo.objects.map)
const projection = d3.geoMercator().fitSize([420, 520], geo)

function ringToPoints(ring) {
  return ring
    .map(([lon, lat]) => {
      const projected = projection([lon, lat])
      if (!projected) return null
      // 投影出來是螢幕座標（y 往下為南），底下 rotateX 會把 y 轉成世界的
      // -Z，相機又架在 +Z，不先把 y 反號的話整個島會南北顛倒（北部跑到
      // 畫面下方），但東西向還是正的，看起來就是一個鏡像的台灣。
      return new THREE.Vector2(projected[0] - 210, -(projected[1] - 260))
    })
    .filter(Boolean)
}

function ringExtent(points) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY, footprint: Math.max(maxX - minX, maxY - minY) }
}

function eachRing(callback) {
  for (const feature of geo.features) {
    const polygons =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const polygon of polygons) {
      const points = ringToPoints(polygon[0])
      if (points.length < 3) continue
      const extent = ringExtent(points)
      if (extent.footprint < MIN_FOOTPRINT) continue
      callback(feature, points, extent)
    }
  }
}

// 本島在投影平面上的範圍，模組載入時算一次（只跟地理形狀有關，跟資料無關）。
// 用來判斷一塊地是不是離島 —— 離島一律畫平的，理由見 buildCountyGroup。
const MAIN_ISLAND = (() => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  eachRing((feature, points, extent) => {
    if (extent.footprint < FRAME_MIN_FOOTPRINT) return
    minX = Math.min(minX, extent.minX)
    maxX = Math.max(maxX, extent.maxX)
    minY = Math.min(minY, extent.minY)
    maxY = Math.max(maxY, extent.maxY)
  })
  return { minX, maxX, minY, maxY }
})()

function isOffshore(extent) {
  const cx = (extent.minX + extent.maxX) / 2
  const cy = (extent.minY + extent.maxY) / 2
  return cx < MAIN_ISLAND.minX || cx > MAIN_ISLAND.maxX || cy < MAIN_ISLAND.minY || cy > MAIN_ISLAND.maxY
}

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

function describeValue(value) {
  if (props.formatValue) return props.formatValue(value)
  if (typeof value !== 'number' || !Number.isFinite(value)) return '無資料'
  const label = props.valueLabel ? `${props.valueLabel} ` : ''
  return `${label}${value}`
}

function buildCountyGroup() {
  const group = new THREE.Group()
  const domain = computeDomain()
  frameBox.makeEmpty()
  pickTargets = []

  eachRing((feature, points2D, extent) => {
    const id = feature.properties.id
    const color = resolveColor(props.countyColor(id))

    // 離島一律畫平的。金門、澎湖、馬祖離本島很遠又只有十幾個單位大，擠到
    // 跟本島同高就變成一片浮在海上的棕色木板，比資料本身還搶眼。壓平之後
    // 它們的數值改由顏色分級表達，跟本島上同樣小的嘉義市、基隆市不衝突
    // ——那兩個在本島範圍內，高度照常畫。
    const flatten = extent.footprint < FLAT_BELOW || isOffshore(extent)
    const partHeight = flatten ? props.minHeight : heightOf(props.countyValue(id), domain)

    const shape = new THREE.Shape(points2D)
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: partHeight, bevelEnabled: false })
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
    mesh.userData.valueText = describeValue(props.countyValue(id))
    group.add(mesh)
    pickTargets.push(mesh)

    if (extent.footprint >= FRAME_MIN_FOOTPRINT) {
      geometry.computeBoundingBox()
      frameBox.union(geometry.boundingBox)
    }

    // 相鄰縣市常常是同一個等級同一個顏色，沒有邊界線會糊成一大塊，
    // 在頂面邊緣描一圈線，縣市界線跟高低落差才分得出來。
    const ring = new THREE.BufferGeometry().setFromPoints(
      points2D.map((p) => new THREE.Vector3(p.x, p.y, partHeight + 0.2))
    )
    ring.rotateX(-Math.PI / 2)
    group.add(new THREE.LineLoop(ring, outlineMaterial))
  })

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

// 預設視角方向（從南方斜上方看），仰角約 38 度
const VIEW_DIRECTION = new THREE.Vector3(0, 0.62, 0.79).normalize()
const FIT_PADDING = 1.12

/**
 * 依實際畫出來的量體把鏡頭拉到「剛好框得住」的距離。
 *
 * 之前是寫死 camera.position + target，結果高度一改（或換成手機的窄畫布）
 * 就框不準：上面空一大片、南部又被切在畫面外。
 *
 * 這裡不是用外接球去算距離。台灣本島是 158 寬 x 296 深的長條，外接球的
 * 半徑得取對角線的一半，整個島會縮在畫面中間只佔三成，四周全是空白。
 * 改成把外接框的 8 個角投影到目前鏡頭的座標軸上，直接算出「這個角度下
 * 剛好塞滿」的距離，同樣不會切到邊，但畫面利用率高很多。
 */
function frameScene() {
  if (!countyGroup || !camera || !controls) return

  const box = frameBox.isEmpty() ? new THREE.Box3().setFromObject(countyGroup) : frameBox
  if (box.isEmpty()) return

  const center = box.getCenter(new THREE.Vector3())
  const radius = box.getSize(new THREE.Vector3()).length() / 2

  const corners = []
  for (let i = 0; i < 8; i++) {
    corners.push(
      new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      )
    )
  }

  // 保留使用者目前轉到的角度，只重算中心點跟距離
  const dir = camera.position.clone().sub(controls.target)
  if (dir.lengthSq() < 1e-6) dir.copy(VIEW_DIRECTION)
  dir.normalize()

  // 鏡頭的水平／垂直軸；俯視到接近正上方時 cross 會退化，退回一組固定軸
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir)
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
  right.normalize()
  const up = new THREE.Vector3().crossVectors(dir, right).normalize()

  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const tanH = tanV * camera.aspect

  // 先抓距離、再把投影後的內容置中，來回幾次收斂。
  //
  // 只算一次會偏：斜著看的時候，畫面上緣對應的是遠端的角、下緣對應的是
  // 近端的角，近的那一角透視放大得多，光是「把外接框中心對準畫面中心」
  // 會讓島整個偏下（實測上緣空 140px、下緣只剩 30px）。
  const target = center.clone()
  let distance = 0
  const offset = new THREE.Vector3()

  for (let iteration = 0; iteration < 4; iteration++) {
    distance = 0
    for (const corner of corners) {
      offset.copy(corner).sub(target)
      const depth = offset.dot(dir)
      distance = Math.max(
        distance,
        (Math.abs(offset.dot(right)) * FIT_PADDING) / tanH + depth,
        (Math.abs(offset.dot(up)) * FIT_PADDING) / tanV + depth
      )
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const corner of corners) {
      offset.copy(corner).sub(target)
      const depthFromCamera = distance - offset.dot(dir)
      if (depthFromCamera <= 1e-6) continue
      const px = offset.dot(right) / depthFromCamera
      const py = offset.dot(up) / depthFromCamera
      minX = Math.min(minX, px); maxX = Math.max(maxX, px)
      minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
    if (!Number.isFinite(minX)) break

    target.addScaledVector(right, ((minX + maxX) / 2) * distance)
    target.addScaledVector(up, ((minY + maxY) / 2) * distance)
  }

  controls.target.copy(target)
  camera.position.copy(target).addScaledVector(dir, distance)

  const camToCenter = camera.position.distanceTo(center)
  camera.near = Math.max(0.1, camToCenter - radius * 1.2)
  camera.far = camToCenter + radius * 1.2
  camera.updateProjectionMatrix()

  controls.minDistance = distance * 0.3
  controls.maxDistance = distance * 3
  controls.update()
}

function rebuildCounties() {
  if (!scene) return
  if (countyGroup) {
    scene.remove(countyGroup)
    disposeGroup(countyGroup)
  }
  // 舊的 mesh 連同 material 都被 dispose 了，指標不能留著
  hoveredMesh = null
  hover.value = null
  countyGroup = buildCountyGroup()
  scene.add(countyGroup)
  frameScene()
}

// 滑過的縣市稍微打亮，讓游標跟提示框指的是哪一塊沒有懸念
function setHovered(mesh) {
  if (hoveredMesh === mesh) return
  hoveredMesh?.material.emissive.setHex(0x000000)
  hoveredMesh = mesh
  hoveredMesh?.material.emissive.setHex(0x2b2b2b)
}

function updateHover(event) {
  if (!camera || !renderer) return

  const rect = renderer.domElement.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  pointer.x = (offsetX / rect.width) * 2 - 1
  pointer.y = -(offsetY / rect.height) * 2 + 1

  // matrixWorld 平常是 renderer.render() 幫忙更新的，但那掛在
  // requestAnimationFrame 上。分頁在背景時 rAF 會被節流甚至停掉，這時候
  // 拿到的還是舊矩陣，raycast 會全部射空。這裡自己更新一次，picking 就
  // 不必依賴「剛好已經畫過一張」。
  camera.updateMatrixWorld()

  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(pickTargets, false)[0]

  if (!hit) {
    clearHover()
    return
  }

  setHovered(hit.object)
  hover.value = {
    name: hit.object.userData.countyName,
    value: hit.object.userData.valueText,
    // 夾在容器內，貼著左右邊緣的縣市才不會把提示框推到看不見的地方
    x: Math.min(Math.max(offsetX, 60), rect.width - 60),
    y: offsetY,
  }
}

function clearHover() {
  setHovered(null)
  hover.value = null
}

function initScene() {
  const el = canvasEl.value
  // 容器還沒完成版面配置時會量到 0。先給 1 避免產生一張沒有寬度的畫布，
  // 真正的尺寸交給下面的 ResizeObserver（observe() 當下就會呼叫一次）。
  const width = el.clientWidth || 1
  const height = el.clientHeight || 1

  scene = new THREE.Scene()
  scene.background = new THREE.Color(resolveColor('var(--bg)'))

  camera = new THREE.PerspectiveCamera(45, width / height || 1, 0.1, 4000)
  // 只是給 frameScene 一個起始方向，實際距離由它算
  camera.position.copy(VIEW_DIRECTION).multiplyScalar(500)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.maxPolarAngle = Math.PI / 2.1
  controls.enableDamping = true
  // minDistance/maxDistance 由 frameScene 依實際量體設定

  // 環境光壓低、主光加強並且從側邊斜打，柱子的側面才會跟頂面明顯分層。
  // 光源太平均的話高度差只剩輪廓可以判斷，會更看不出來。
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c9ba0, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 1.15)
  sun.position.set(-220, 300, 120)
  scene.add(sun)

  rebuildCounties()

  // pointer 事件同時涵蓋滑鼠跟觸控；手機上點一下也看得到是哪個縣市
  renderer.domElement.addEventListener('pointermove', updateHover)
  renderer.domElement.addEventListener('pointerdown', updateHover)
  renderer.domElement.addEventListener('pointerleave', clearHover)

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  resizeObserver = new ResizeObserver(() => {
    const w = el.clientWidth
    const h = el.clientHeight
    // 容器還沒完成版面配置時會量到 0，setSize(0, h) 會留下一張沒有寬度的
    // 畫布，而且 aspect 變成 0／NaN 之後投影矩陣就壞了，直接跳過這一次
    if (w === 0 || h === 0) return

    camera.aspect = w / h
    renderer.setSize(w, h)
    // 畫布比例變了，可視範圍跟著變，重新框一次才不會又切到南部
    frameScene()
  })
  resizeObserver.observe(el)
}

onMounted(initScene)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  resizeObserver?.disconnect()
  renderer?.domElement.removeEventListener('pointermove', updateHover)
  renderer?.domElement.removeEventListener('pointerdown', updateHover)
  renderer?.domElement.removeEventListener('pointerleave', clearHover)
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

    <div
      v-if="hover"
      class="tooltip"
      :style="{ left: hover.x + 'px', top: hover.y + 'px' }"
      aria-hidden="true"
    >
      <span class="tooltip-name">{{ hover.name }}</span>
      <span class="tooltip-value">{{ hover.value }}</span>
    </div>
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
.tooltip {
  position: absolute;
  /* 定位點是游標，往上挪開一段才不會被自己的手指或游標蓋住 */
  transform: translate(-50%, calc(-100% - 0.75rem));
  padding: 0.35rem 0.6rem;
  border-radius: 5px;
  background: var(--ink);
  color: var(--panel);
  font-size: 0.78rem;
  line-height: 1.35;
  white-space: nowrap;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  z-index: 3;
}
.tooltip-value {
  font-family: var(--font-mono);
  opacity: 0.85;
}
</style>
