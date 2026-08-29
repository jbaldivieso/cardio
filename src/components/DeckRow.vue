<script setup lang="ts">
import { computed } from 'vue'
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

defineEmits<{ rename: []; move: []; delete: []; quiz: [] }>()

/**
 * An empty deck has nothing to quiz, so the row does not offer it at all
 * (docs/decisions.md > ADR-054). Move goes the same way when `movable` is false.
 */
const quizzable = computed(() => props.cardCount > 0)
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
          v-if="movable"
          type="button"
          class="dropdown-item"
          data-testid="deck-move"
          @click="$emit('move')"
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
      <p class="has-text-grey" data-testid="deck-count">
        {{ countLabel(cardCount, 'card') }}
      </p>
    </div>
    <div v-if="quizzable" class="is-flex is-flex-shrink-0 is-gap-1">
      <button
        type="button"
        class="button is-primary is-light cardio-action"
        data-testid="deck-quiz"
        @click="$emit('quiz')"
      >
        Quiz
      </button>
    </div>
    <MasteryBar v-if="summary" :summary="summary" class="cardio-row-full mt-2" />
  </div>
</template>
