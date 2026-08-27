<script setup lang="ts">
import { computed } from 'vue'
import { band, mastery } from '@/domain/mastery'
import type { CardStats, MasteryBand } from '@/domain/models'

/**
 * One card's mastery on the deck screen (§7.3): `new` until it has been
 * answered, then its score as a whole percentage.
 *
 * `now` is a prop rather than a `Date.now()` call so that every badge on a
 * screen is scored at the same instant, and so the score is assertable against
 * the spec §5.4 vectors without faking the clock.
 */
const props = defineProps<{ stats: CardStats; now: number }>()

/** Bulma's own tag colours, which its `data-theme` swaps for us (ADR-011). */
const TAGS: Record<MasteryBand, string> = {
  new: '',
  learning: 'is-warning',
  mastered: 'is-success',
}

const currentBand = computed(() => band(props.stats, props.now))
const label = computed(() =>
  currentBand.value === 'new' ? 'new' : `${mastery(props.stats, props.now)}%`,
)
</script>

<template>
  <span class="tag" :class="TAGS[currentBand]" data-testid="mastery-badge">{{ label }}</span>
</template>
