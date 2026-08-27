<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
import { useThemeStore } from '@/stores/theme'

// Reading the store is what starts it: from here on it owns `data-theme` on
// `<html>` and follows the system setting while the preference says to (§11).
// The pre-paint script in index.html has already applied the same rule.
useThemeStore()
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
