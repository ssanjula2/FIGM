<!-- Defect: FIGM-VUE-02 -->
<template>
  <li v-for="user in users" :key="user.id" v-if="user.isActive">{{ user.name }}</li>
</template>
