<script setup lang="ts">
import type { Deck } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/**
 * One row of the folder screen (§7.2). The quickstart Quiz button (item 08) and
 * the mastery bar (item 09) land beside the count.
 */
defineProps<{ deck: Deck; cardCount: number }>()

defineEmits<{ rename: []; move: []; delete: [] }>()
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
  </div>
</template>
