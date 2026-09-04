<template>
  <div />
</template>
<script setup>
const sortedItems = computed(() => [...items.value].sort());
function addItem(x) {
  sortedItems.value.push(x);
}
</script>
