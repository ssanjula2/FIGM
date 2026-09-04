<template>
  <div class="vue-benchmark">
    <img :src="userAvatar" alt="User Avatar" />

    <span v-on:click="toggleMenu">Toggle Navigation Menu</span>

    <div v-for="item in products" :key="item.id">
      <span :style="{ color: 'blue', padding: '4px' }">{{ item.title }}</span>
    </div>

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
