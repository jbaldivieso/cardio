<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
</script>

<template>
  <div class="cardio-app">
    <AppNav />
    <main class="cardio-main section">
      <div class="container">
        <RouterView />
      </div>
    </main>
  </div>
</template>
