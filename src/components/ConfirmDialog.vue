<script setup lang="ts">
import ModalShell from '@/components/ModalShell.vue'

/**
 * The destructive confirmation of §4.4. The message names the counts; nothing
 * happens until `confirm` is clicked, and there is no undo behind it.
 */
withDefaults(defineProps<{ title: string; message: string; confirmLabel?: string }>(), {
  confirmLabel: 'Delete',
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ModalShell :title="title" testid="confirm-dialog" role="alertdialog" @cancel="emit('cancel')">
    <p data-testid="confirm-message">{{ message }}</p>

    <template #footer>
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
    </template>
  </ModalShell>
</template>
