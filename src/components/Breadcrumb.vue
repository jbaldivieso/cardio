<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/** One step of the trail. The last one is the current page and is never a link. */
interface Crumb {
  label: string
  to?: RouteLocationRaw
}

/**
 * `Folders / Spanish / Verbs` (§7.2, §7.3). The root crumb is always home, so
 * callers pass only what sits below it.
 */
const props = defineProps<{ trail: Crumb[] }>()

function isLast(index: number): boolean {
  return index === props.trail.length - 1
}
</script>

<template>
  <nav class="breadcrumb" aria-label="Breadcrumb" data-testid="breadcrumb">
    <ul>
      <li>
        <RouterLink :to="{ name: 'home' }" data-testid="breadcrumb-home">Folders</RouterLink>
      </li>
      <li v-for="(crumb, index) in trail" :key="index" :class="{ 'is-active': isLast(index) }">
        <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
        <a v-else aria-current="page">{{ crumb.label }}</a>
      </li>
    </ul>
  </nav>
</template>
