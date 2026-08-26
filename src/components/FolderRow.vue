<script setup lang="ts">
import type { Folder } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/** One row of the home screen (§7.1). The mastery bar arrives with item 09. */
defineProps<{
  folder: Folder
  deckCount: number
  cardCount: number
  /** False for Unsorted, which cannot be deleted (§4.2). */
  deletable: boolean
}>()

defineEmits<{ rename: []; delete: [] }>()
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
        class="button is-ghost cardio-action"
        data-testid="folder-rename"
        @click="$emit('rename')"
      >
        Rename
      </button>
      <button
        v-if="deletable"
        type="button"
        class="button is-ghost has-text-danger cardio-action"
        data-testid="folder-delete"
        @click="$emit('delete')"
      >
        Delete
      </button>
    </div>
  </div>
</template>
