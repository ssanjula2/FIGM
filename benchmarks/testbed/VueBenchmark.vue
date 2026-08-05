<template>
  <div class="vue-benchmark">
    <!-- Defect: FIGM-PERF-02 (Un-dimensioned img) -->
    <img :src="userAvatar" alt="User Avatar" />

    <!-- Defect: FIGM-A11Y-01 (span v-on:click without keydown or tabindex) -->
    <span v-on:click="toggleMenu">Toggle Navigation Menu</span>

    <!-- Defect: FIGM-PERF-01 (Invariant object allocation in loop scope) -->
    <div v-for="item in products" :key="item.id">
      <span :style="{ color: 'blue', padding: '4px' }">{{ item.title }}</span>
    </div>

    <!-- Defect: FIGM-A11Y-03 (Dynamic status element missing aria-live) -->
    <div id="status" class="status-banner">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script>
export default {
  props: ['products', 'userAvatar'],
  data() {
    return {
      statusMessage: 'Ready'
    }
  },
  mounted() {
    // Defect: FIGM-PERF-03 (addEventListener without paired removal)
    window.addEventListener('resize', this.onResize);
  },
  methods: {
    onResize() {
      console.log('Resizing Vue component');
    },
    toggleMenu() {
      this.statusMessage = 'Menu Toggled';
    }
  }
}
</script>
