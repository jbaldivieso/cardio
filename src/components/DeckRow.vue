<script setup lang="ts">
import { computed, useId } from 'vue'
import MasteryBar from '@/components/MasteryBar.vue'
import type { MasterySummary } from '@/domain/aggregates'
import type { Deck } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/**
 * One row of the folder screen (§7.2). The quickstart Quiz button and the
 * mastery bar sit beside the count.
 */
const props = defineProps<{
  deck: Deck
  cardCount: number
  /** Undefined until the deck has been summarised (§5.5). */
  summary?: MasterySummary
}>()

const emit = defineEmits<{ rename: []; move: []; delete: []; quiz: [] }>()

/**
 * An empty deck cannot be quizzed (§7.2). The button says so through
 * `aria-disabled` rather than the `disabled` attribute, which would take it out
 * of the tab order and its reason with it (docs/decisions.md > ADR-031).
 */
const quizzable = computed(() => props.cardCount > 0)
const reasonId = useId()

function quiz(): void {
  if (quizzable.value) emit('quiz')
}
</script>

<template>
  <div
    class="box is-flex is-flex-wrap-wrap is-align-items-center is-justify-content-space-between is-gap-2"
    data-testid="deck-row"
  >
    <div class="cardio-row-main is-flex-grow-1">
      <RouterLink
        class="is-size-5 has-text-weight-semibold"
        :to="{ name: 'deck', params: { deckId: deck.id } }"
        data-testid="deck-link"
      >
        {{ deck.name }}
      </RouterLink>
      <p class="is-size-7 has-text-grey" data-testid="deck-count">
        {{ countLabel(cardCount, 'card') }}
      </p>
    </div>
    <div class="is-flex is-flex-shrink-0 is-gap-1">
      <button
        type="button"
        class="button is-primary is-light cardio-action"
        :class="{ 'is-static': !quizzable }"
        :aria-disabled="quizzable ? 'false' : 'true'"
        :aria-describedby="reasonId"
        :title="quizzable ? undefined : 'This deck has no cards to quiz yet.'"
        data-testid="deck-quiz"
        @click="quiz"
      >
        Quiz
      </button>
      <button
        type="button"
        class="button is-ghost cardio-action"
        data-testid="deck-rename"
        @click="$emit('rename')"
      >
        Rename
      </button>
      <button
        type="button"
        class="button is-ghost cardio-action"
        data-testid="deck-move"
        @click="$emit('move')"
      >
        Move
      </button>
      <button
        type="button"
        class="button is-ghost has-text-danger cardio-action"
        data-testid="deck-delete"
        @click="$emit('delete')"
      >
        Delete
      </button>
    </div>
    <span :id="reasonId" class="is-sr-only">
      {{
        quizzable
          ? `Quiz this deck: ${countLabel(cardCount, 'card')}.`
          : 'This deck has no cards to quiz yet.'
      }}
    </span>
    <MasteryBar v-if="summary" :summary="summary" class="cardio-row-full mt-2" />
  </div>
</template>
