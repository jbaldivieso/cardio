<script setup lang="ts">
/**
 * "7 / 20" and the bar beside it (spec §7.6). The count is the live region:
 * the bar's own value is announced inconsistently, and the position is the
 * part a screen reader user actually needs on each answer.
 */
defineProps<{ position: number; total: number }>()
</script>

<template>
  <div class="mb-4" data-testid="quiz-progress">
    <p class="has-text-grey mb-1" aria-live="polite" data-testid="quiz-progress-count">
      {{ position }} / {{ total }}
    </p>
    <progress
      class="progress is-small is-primary"
      :value="position"
      :max="total"
      aria-label="Quiz progress"
    >
      {{ position }} / {{ total }}
    </progress>
  </div>
</template>
