<script setup lang="ts">
import { computed, useId } from 'vue'
import MasteryBar from '@/components/MasteryBar.vue'
import type { MasterySummary } from '@/domain/aggregates'
import type { Folder } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/** One row of the home screen (§7.1). */
const props = defineProps<{
  folder: Folder
  deckCount: number
  cardCount: number
  /** Undefined until the folder's decks have been summarised (§5.5). */
  summary?: MasterySummary
}>()

const emit = defineEmits<{ rename: []; delete: []; quiz: [] }>()

/** A folder with no cards anywhere in it has nothing to quiz (ADR-031). */
const quizzable = computed(() => props.cardCount > 0)
const reasonId = useId()

function quiz(): void {
  if (quizzable.value) emit('quiz')
}
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
      <p class="is-size-7 has-text-grey" data-testid="folder-counts">
        {{ countLabel(deckCount, 'deck') }} · {{ countLabel(cardCount, 'card') }}
      </p>
    </div>
    <div class="is-flex is-flex-shrink-0 is-gap-1">
      <button
        type="button"
        class="button is-primary is-light cardio-action"
        :class="{ 'is-static': !quizzable }"
        :aria-disabled="quizzable ? 'false' : 'true'"
        :aria-describedby="reasonId"
        :title="quizzable ? undefined : 'This folder has no cards to quiz yet.'"
        data-testid="folder-quiz"
        @click="quiz"
      >
        Quiz
      </button>
      <button
        type="button"
        class="button is-ghost cardio-action"
        data-testid="folder-rename"
        @click="$emit('rename')"
      >
        Rename
      </button>
      <button
        type="button"
        class="button is-ghost has-text-danger cardio-action"
        data-testid="folder-delete"
        @click="$emit('delete')"
      >
        Delete
      </button>
    </div>
    <span :id="reasonId" class="is-sr-only">
      {{
        quizzable
          ? `Quiz every deck in ${folder.name}: ${countLabel(cardCount, 'card')}.`
          : 'This folder has no cards to quiz yet.'
      }}
    </span>
    <MasteryBar v-if="summary" :summary="summary" class="cardio-row-full mt-2" />
  </div>
</template>
