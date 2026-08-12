<script setup>
defineProps({
  eyebrow: { type: String, required: true },
  value: { type: String, required: true },
  unit: { type: String, default: '' },
  label: { type: String, required: true },
  accentColor: { type: String, default: 'var(--accent)' },
})
</script>

<template>
  <div class="hero">
    <p class="eyebrow">{{ eyebrow }}</p>
    <p class="value" :style="{ color: accentColor }">
      {{ value }}<span class="unit">{{ unit }}</span>
    </p>
    <p class="label">{{ label }}</p>
  </div>
</template>

<style scoped>
.hero {
  padding: 1.5rem 0 2rem;
}
.eyebrow {
  margin: 0 0 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.value {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: clamp(3.5rem, 12vw, 6rem);
  line-height: 1;
  letter-spacing: -0.02em;
}
.unit {
  font-size: 0.35em;
  font-weight: 500;
  margin-left: 0.3rem;
  color: var(--ink-soft);
}
.label {
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
  color: var(--ink-soft);
}
</style>
