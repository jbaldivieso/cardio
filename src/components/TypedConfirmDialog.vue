<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import ModalShell from '@/components/ModalShell.vue'

/**
 * The confirmation for the two actions that take the whole library with them:
 * "Replace everything" and "Delete all data" (§7.8, §10). Typing the phrase is
 * the point — these are the only things in the app a mis-tap cannot undo.
 */
const props = withDefaults(
  defineProps<{
    title: string
    message: string
    /** What the user has to type, exactly, before the action unlocks. */
    phrase: string
    confirmLabel?: string
  }>(),
  { confirmLabel: 'Confirm' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const inputId = useId()
const input = ref<HTMLInputElement | null>(null)
const typed = ref('')
const matches = computed(() => typed.value.trim() === props.phrase)

function submit(): void {
  if (!matches.value) return
  emit('confirm')
}

onMounted(() => input.value?.focus())
</script>

<template>
  <ModalShell
    :title="title"
    testid="typed-confirm-dialog"
    role="alertdialog"
    form
    @cancel="emit('cancel')"
    @submit="submit"
  >
    <p data-testid="typed-confirm-message">{{ message }}</p>
    <div class="field mt-4">
      <label class="label" :for="inputId">
        Type <code data-testid="typed-confirm-phrase">{{ phrase }}</code> to confirm
      </label>
      <div class="control">
        <input
          :id="inputId"
          ref="input"
          v-model="typed"
          class="input"
          type="text"
          autocomplete="off"
          data-testid="typed-confirm-input"
        />
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="button cardio-action"
        data-testid="typed-confirm-cancel"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="button is-danger cardio-action"
        :disabled="!matches"
        data-testid="typed-confirm-accept"
      >
        {{ confirmLabel }}
      </button>
    </template>
  </ModalShell>
</template>
