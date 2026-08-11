<template>
  <div class="banner">
    <!-- FIGM-A11Y-01: Non-interactive click listener -->
    <div class="banner-content" @click="notify">
      <!-- FIGM-PERF-02: Native img missing width/height -->
      <img src="/banner.jpg" alt="Banner" />
      <h2>{{ message }}</h2>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VueBanner',
  props: {
    message: String
  },
  methods: {
    notify() {
      console.log('Banner clicked');
    }
  }
}
</script>
