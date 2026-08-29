<script setup lang="ts">
import { computed } from 'vue'
import ActionMenu from '@/components/ActionMenu.vue'
import MasteryBar from '@/components/MasteryBar.vue'
import type { MasterySummary } from '@/domain/aggregates'
import type { Folder } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/**
 * One row of the home screen (§7.1). Quiz is the action the row is for, so it
 * sits out on the row; rename and delete are behind the overflow menu beside
 * the name (ADR-052).
 */
const props = defineProps<{
  folder: Folder
  deckCount: number
  cardCount: number
  /** Undefined until the folder's decks have been summarised (§5.5). */
  summary?: MasterySummary
}>()

defineEmits<{ rename: []; delete: []; quiz: [] }>()

/**
 * A folder with no cards anywhere in it has nothing to quiz, so the row does not
 * offer it at all (docs/decisions.md > ADR-054).
 */
const quizzable = computed(() => props.cardCount > 0)
</script>

<template>
  <div
    class="box is-flex is-flex-wrap-wrap is-align-items-center is-justify-content-space-between is-gap-2"
    data-testid="folder-row"
  >
    <div class="cardio-row-main is-flex-grow-1">
      <RouterLink
        class="is-size-5 has-text-weight-semibold"
        :to="{ name: 'folder', params: { folderId: folder.id } }"
        data-testid="folder-link"
      >
        {{ folder.name }}
      </RouterLink>
      <ActionMenu :label="`More actions for ${folder.name}`" testid="folder-menu">
        <button
          type="button"
          class="dropdown-item"
          data-testid="folder-rename"
          @click="$emit('rename')"
        >
          Rename
        </button>
        <button
          type="button"
          class="dropdown-item has-text-danger"
          data-testid="folder-delete"
          @click="$emit('delete')"
        >
          Delete
        </button>
      </ActionMenu>
      <p class="is-size-7 has-text-grey" data-testid="folder-counts">
        {{ countLabel(deckCount, 'deck') }} · {{ countLabel(cardCount, 'card') }}
      </p>
    </div>
    <div v-if="quizzable" class="is-flex is-flex-shrink-0 is-gap-1">
      <button
        type="button"
        class="button is-primary is-light cardio-action"
        data-testid="folder-quiz"
        @click="$emit('quiz')"
      >
        Quiz
      </button>
    </div>
    <MasteryBar v-if="summary" :summary="summary" class="cardio-row-full mt-2" />
  </div>
</template>
