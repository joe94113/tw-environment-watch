<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="shell">
    <nav class="tabs" aria-label="主要頁面">
      <RouterLink to="/" class="tab" active-class="active">空氣品質</RouterLink>
      <RouterLink to="/earthquake" class="tab" active-class="active">地震</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}
.tabs {
  display: flex;
  gap: 0.5rem;
  max-width: 720px;
  margin: 0 auto;
  padding: 1.25rem 1.25rem 0;
}
.tab {
  padding: 0.5rem 1rem;
  border-radius: 6px 6px 0 0;
  text-decoration: none;
  font-size: 0.9rem;
  color: var(--ink-soft);
  border-bottom: 2px solid transparent;
}
.tab.active {
  color: var(--ink);
  font-weight: 700;
  border-bottom-color: var(--accent);
}
.tab:hover {
  color: var(--accent);
}
</style>
