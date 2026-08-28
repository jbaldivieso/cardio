<script setup lang="ts">
/** What the home screen shows when there is nothing in the library yet (§7.1). */
defineEmits<{ create: [] }>()
</script>

<template>
  <div class="has-text-centered py-6" data-testid="library-splash">
    <h1 class="title is-1" data-testid="splash-title">Cardio</h1>
    <p class="subtitle is-4 has-text-grey" data-testid="splash-tagline">
      Flashcards for faster learning
    </p>
    <button
      type="button"
      class="button is-primary is-medium cardio-action"
      data-testid="splash-create"
      @click="$emit('create')"
    >
      Create a folder
    </button>
  </div>
</template>
