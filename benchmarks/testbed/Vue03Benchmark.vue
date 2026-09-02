<!-- Defect: FIGM-VUE-03 -->
<template>
  <div />
</template>
<script setup>
const fullName = computed(() => {
  logCount.value = logCount.value + 1;
  return first.value + ' ' + last.value;
});
</script>
