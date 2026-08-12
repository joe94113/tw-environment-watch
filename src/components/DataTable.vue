<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  caption: { type: String, required: true },
  columns: { type: Array, required: true }, // [{ key, label, numeric? }]
  rows: { type: Array, required: true }, // [{ key: value, ... }]
})

const sortKey = ref(props.columns[0]?.key)
const sortDesc = ref(true)

const sortedRows = computed(() =>
  [...props.rows].sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-Hant')
    return sortDesc.value ? -cmp : cmp
  })
)

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDesc.value = !sortDesc.value
  } else {
    sortKey.value = key
    sortDesc.value = true
  }
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <caption class="sr-only">{{ caption }}</caption>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" scope="col">
            <button type="button" class="sort-btn" @click="toggleSort(col.key)">
              {{ col.label }}
              <span aria-hidden="true" class="sort-arrow">
                {{ sortKey === col.key ? (sortDesc ? '↓' : '↑') : '' }}
              </span>
              <span class="sr-only">
                {{ sortKey === col.key ? (sortDesc ? '，目前由大到小排序' : '，目前由小到大排序') : '，可排序' }}
              </span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in sortedRows" :key="row.id ?? i">
          <td v-for="col in columns" :key="col.key" :class="{ numeric: col.numeric }" :style="row[col.key + 'Style']">
            {{ row[col.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85rem;
}
th {
  background: var(--panel);
  text-align: left;
  border-bottom: 1px solid var(--line);
  padding: 0;
}
.sort-btn {
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.75rem;
  border: none;
  background: none;
  font: inherit;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
}
.sort-btn:hover {
  color: var(--accent);
}
.sort-arrow {
  display: inline-block;
  width: 0.8em;
}
td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--line);
}
td.numeric {
  font-family: var(--font-mono);
  text-align: right;
}
tbody tr:last-child td {
  border-bottom: none;
}
tbody tr:nth-child(even) {
  background: rgba(127, 140, 143, 0.08);
}
</style>
