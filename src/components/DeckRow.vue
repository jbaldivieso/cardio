<script setup lang="ts">
import { computed, useId } from 'vue'
import ActionMenu from '@/components/ActionMenu.vue'
import MasteryBar from '@/components/MasteryBar.vue'
import type { MasterySummary } from '@/domain/aggregates'
import type { Deck } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/**
 * One row of the folder screen (§7.2). Quiz is the action the row is for, so it
 * sits out on the row; rename, move and delete are behind the overflow menu
 * beside the name (ADR-052).
 */
const props = defineProps<{
  deck: Deck
  cardCount: number
  /** False when this is the only folder there is, so there is nowhere to go. */
  movable: boolean
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
const moveReasonId = useId()

function quiz(): void {
  if (quizzable.value) emit('quiz')
}

function move(): void {
  if (props.movable) emit('move')
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
      <ActionMenu :label="`More actions for ${deck.name}`" testid="deck-menu">
        <button
          type="button"
          class="dropdown-item"
          data-testid="deck-rename"
          @click="$emit('rename')"
        >
          Rename
        </button>
        <button
          type="button"
          class="dropdown-item"
          :class="{ 'has-text-grey': !movable }"
          :aria-disabled="movable ? 'false' : 'true'"
          :aria-describedby="movable ? undefined : moveReasonId"
          :title="movable ? undefined : 'There is no other folder to move this deck to.'"
          data-testid="deck-move"
          @click="move"
        >
          Move
        </button>
        <button
          type="button"
          class="dropdown-item has-text-danger"
          data-testid="deck-delete"
          @click="$emit('delete')"
        >
          Delete
        </button>
      </ActionMenu>
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
    </div>
    <span v-if="!movable" :id="moveReasonId" class="is-sr-only">
      There is no other folder to move this deck to. Create one first.
    </span>
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
