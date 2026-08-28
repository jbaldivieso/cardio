<script setup lang="ts">
import { computed } from 'vue'
import { segmentWidths } from '@/domain/aggregates'
import type { MasterySummary } from '@/domain/aggregates'
import { masteryHeadline, masteryLabel } from '@/domain/prompts'

/**
 * The three-segment bar of §7.9: how much of a deck or folder is mastered,
 * still being learned, and never tried, plus the headline percentage.
 *
 * The summary is handed in already computed — the store memoises one per deck
 * (§5.5), so no row ever bands a card while it renders (§13).
 */
const props = defineProps<{ summary: MasterySummary }>()

const SEGMENTS = [
  { band: 'mastered', colour: 'has-background-success' },
  // The palette's chartreuse accent (ADR-048), not a Bulma tag colour: the
  // bright edge of what is still being learned, ahead of the mastered green.
  { band: 'learning', colour: 'cardio-mastery-accent' },
  // The same neutral as the empty track: the untried share reads as the part
  // of the bar that has not been filled in yet.
  { band: 'new', colour: 'cardio-mastery-unfilled' },
] as const

const segments = computed(() => {
  const widths = segmentWidths(props.summary)
  return SEGMENTS.map((segment) => ({ ...segment, width: widths[segment.band] }))
})

const headline = computed(() => masteryHeadline(props.summary))
const label = computed(() => masteryLabel(props.summary))
</script>

<template>
  <div class="is-flex is-align-items-center is-gap-2" data-testid="mastery-bar">
    <div
      class="cardio-mastery-track cardio-mastery-unfilled is-flex-grow-1"
      role="img"
      :aria-label="label"
      data-testid="mastery-track"
    >
      <div
        v-for="segment in segments"
        :key="segment.band"
        :class="segment.colour"
        :style="{ width: `${segment.width}%` }"
        :data-testid="`mastery-${segment.band}`"
      />
    </div>
    <span class="is-size-7 has-text-grey is-flex-shrink-0" data-testid="mastery-headline">
      {{ headline }}
    </span>
  </div>
</template>

<style scoped>
/* Bulma has no background helper for its border grey, and `has-background` is
   96% lightness against a 100% `.box` — a track nobody can see. This is still
   a Bulma token, so the theme swaps it for us (ADR-011, ADR-044). */
.cardio-mastery-unfilled {
  background-color: var(--bulma-border);
}

/* A stacked bar of a fixed height is the one thing Bulma's progress element
   cannot do: it draws a single value, not three shares of a whole. */
.cardio-mastery-track {
  display: flex;
  height: 0.5rem;
  overflow: hidden;
  border-radius: 9999px;
}
</style>
