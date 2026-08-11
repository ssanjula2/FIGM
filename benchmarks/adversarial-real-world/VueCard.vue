<template>
  <div class="vue-card">
    <!-- Anti-pattern 1: Non-interactive element click handler without key listener -->
    <div class="card-body" @click="handleCardClick">
      <!-- Anti-pattern 2: Native img tag missing explicit width/height -->
      <img src="/vue-logo.png" alt="Vue Logo" />
      <h3>{{ title }}</h3>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VueCard',
  props: {
    title: {
      type: String,
      required: true
    }
  },
  methods: {
    handleCardClick() {
      console.log('Card clicked', this.title);
    }
  }
}
</script>
