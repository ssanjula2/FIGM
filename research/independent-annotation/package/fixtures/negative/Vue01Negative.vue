<template>
  <ul>
    <li v-for="todo in todos" :key="todo.id">{{ todo.text }}</li>
  </ul>
</template>

<script setup>
// Clean: :key is bound to a stable per-item identifier (todo.id), not the loop index --
// FIGM-VUE-01 must NOT fire.
defineProps({ todos: { type: Array, required: true } });
</script>
