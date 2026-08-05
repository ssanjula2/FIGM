<template>
  <div class="data-grid">
    <div v-for="item in items" :key="item.id">
      <!-- Defect: FIGM-PERF-01 (Invariant object allocation in loop scope) -->
      <span :style="{ color: 'red', margin: '5px' }">{{ item.name }}</span>
      <!-- Defect: FIGM-PERF-02 (Un-dimensioned img) -->
      <img :src="item.icon" alt="Icon" />
    </div>
  </div>
</template>

<script>
export default {
  props: ['items']
}
</script>
