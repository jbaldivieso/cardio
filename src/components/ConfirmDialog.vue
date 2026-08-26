<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

/**
 * The destructive confirmation of §4.4. The message names the counts; nothing
 * happens until `confirm` is clicked, and there is no undo behind it.
 */
withDefaults(defineProps<{ title: string; message: string; confirmLabel?: string }>(), {
  confirmLabel: 'Delete',
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal is-active" data-testid="confirm-dialog">
    <div class="modal-background" @click="emit('cancel')" />
    <div class="modal-card" role="alertdialog" aria-modal="true" :aria-label="title">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ title }}</p>
        <button
          type="button"
          class="delete cardio-close"
          aria-label="Close"
          @click="emit('cancel')"
        />
      </header>
      <section class="modal-card-body">
        <p data-testid="confirm-message">{{ message }}</p>
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end is-gap-2">
        <button
          type="button"
          class="button cardio-action"
          data-testid="confirm-cancel"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="button is-danger cardio-action"
          data-testid="confirm-accept"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </footer>
    </div>
  </div>
</template>
