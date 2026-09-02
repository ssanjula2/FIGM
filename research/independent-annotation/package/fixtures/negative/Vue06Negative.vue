<template>
  <button @click="increment">Count: {{ count }}</button>
</template>

<script>
// Clean: the Options API "methods" block uses a real (non-arrow) function, correctly bound to
// the component instance -- FIGM-VUE-06 must NOT fire.
export default {
  data() {
    return { count: 0 };
  },
  methods: {
    increment() {
      this.count++;
    },
  },
};
</script>
