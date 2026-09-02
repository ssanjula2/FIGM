<template>
  <div />
</template>
<script setup>
const props = defineProps(['todo']);
function complete() {
  props.todo.done = true;
}
</script>
