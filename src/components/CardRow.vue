<script setup lang="ts">
import MarkdownText from '@/components/MarkdownText.vue'
import type { Card } from '@/domain/models'

/** One row of the deck screen (§7.3). The mastery badge arrives with item 09. */
defineProps<{ card: Card }>()

const emit = defineEmits<{ open: []; delete: [] }>()

/**
 * Tapping the row opens the editor, except on something that has its own job:
 * the row's own buttons, and any link the card's markdown put there.
 *
 * The row is deliberately not a `role="button"`: it contains real buttons and
 * whatever links the front's markdown rendered, and nesting interactive
 * elements inside one is worse for a screen reader than leaving the row as a
 * pointer shortcut. Edit is the accessible, focusable way to the same screen.
 */
function onRowClick(event: MouseEvent): void {
  if ((event.target as HTMLElement | null)?.closest('a, button')) return
  emit('open')
}
</script>

<template>
  <div
    class="box cardio-tappable is-flex is-flex-wrap-wrap is-align-items-center is-justify-content-space-between is-gap-2"
    data-testid="card-row"
    @click="onRowClick"
  >
    <MarkdownText
      :source="card.front"
      class="cardio-row-main cardio-clamp-2 is-flex-grow-1"
      data-testid="card-row-front"
    />
    <div class="is-flex is-flex-shrink-0 is-gap-1">
      <button
        type="button"
        class="button is-ghost cardio-action"
        data-testid="card-edit"
        @click="emit('open')"
      >
        Edit
      </button>
      <button
        type="button"
        class="button is-ghost has-text-danger cardio-action"
        data-testid="card-delete"
        @click="emit('delete')"
      >
        Delete
      </button>
    </div>
  </div>
</template>
