<script setup lang="ts">
/**
 * Scaffold-only stand-in for a screen that has not been built yet. Delete each
 * usage as its plan item lands; delete this component when the last one goes.
 */
defineProps<{ title: string; planItem: string }>()
</script>

<template>
  <div class="content" data-testid="placeholder">
    <h1 class="title is-4">{{ title }}</h1>
    <div class="notification is-warning is-light">
      Not built yet — see <code>.claude/plans/{{ planItem }}</code> and <code>docs/spec.md</code>.
    </div>
    <slot />
  </div>
</template>
