<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { NAME_MAX_LENGTH } from '@/domain/validation'

/**
 * The create-and-rename modal. Mounted only while it is open, so the parent's
 * `v-if` is the whole of its visibility state.
 */
const props = withDefaults(
  defineProps<{
    title: string
    label?: string
    initialName?: string
    confirmLabel?: string
    /** Why the last submit was refused, if it was. */
    error?: string | null
  }>(),
  { label: 'Name', initialName: '', confirmLabel: 'Save', error: null },
)

const emit = defineEmits<{ submit: [name: string]; cancel: [] }>()

const inputId = useId()
const input = ref<HTMLInputElement | null>(null)
const name = ref(props.initialName)
const trimmed = computed(() => name.value.trim())

function submit(): void {
  if (trimmed.value.length === 0) return
  emit('submit', trimmed.value)
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
  <div class="modal is-active" data-testid="name-dialog">
    <div class="modal-background" @click="emit('cancel')" />
    <form
      class="modal-card"
      role="dialog"
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
        <div class="field">
          <label class="label" :for="inputId">{{ label }}</label>
          <div class="control">
            <input
              :id="inputId"
              ref="input"
              v-model="name"
              class="input"
              type="text"
              :maxlength="NAME_MAX_LENGTH"
              data-testid="name-input"
            />
          </div>
        </div>

        <div v-if="error" class="notification is-danger is-light" data-testid="name-error">
          {{ error }}
        </div>
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end is-gap-2">
        <button
          type="button"
          class="button cardio-action"
          data-testid="name-cancel"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="button is-primary cardio-action"
          :disabled="trimmed.length === 0"
          data-testid="name-save"
        >
          {{ confirmLabel }}
        </button>
      </footer>
    </form>
  </div>
</template>
