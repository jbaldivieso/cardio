<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'

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

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

// On the document rather than the dialog: Escape has to work wherever the focus
// went after the modal opened.
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  input.value?.focus()
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal is-active" data-testid="typed-confirm-dialog">
    <div class="modal-background" @click="emit('cancel')" />
    <form
      class="modal-card"
      role="alertdialog"
      aria-modal="true"
      :aria-label="title"
      @submit.prevent="submit"
    >
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
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end is-gap-2">
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
      </footer>
    </form>
  </div>
</template>
