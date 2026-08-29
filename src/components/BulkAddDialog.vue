<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { parseBulk } from '@/domain/bulkParse'
import type { ParsedCard } from '@/domain/bulkParse'
import { countLabel } from '@/domain/prompts'

/** Paste a batch of cards into one deck (§9). */
withDefaults(defineProps<{ error?: string | null }>(), { error: null })

const emit = defineEmits<{ submit: [cards: ParsedCard[]]; cancel: [] }>()

const separators = [
  { value: '|', label: 'Pipe  |' },
  { value: '\t', label: 'Tab' },
  { value: '::', label: 'Double colon  ::' },
]

const separatorId = useId()
const textId = useId()
const text = ref('')
const separator = ref(separators[0].value)

const result = computed(() => parseBulk(text.value, separator.value))
const summary = computed(
  () =>
    `${countLabel(result.value.cards.length, 'card')} ready, ` +
    `${countLabel(result.value.errors.length, 'line')} skipped`,
)

function submit(): void {
  if (result.value.cards.length === 0) return
  emit('submit', result.value.cards)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal is-active" data-testid="bulk-dialog">
    <div class="modal-background" @click="emit('cancel')" />
    <form
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-label="Bulk add cards"
      @submit.prevent="submit"
    >
      <header class="modal-card-head">
        <p class="modal-card-title">Bulk add</p>
        <button
          type="button"
          class="delete cardio-close"
          aria-label="Close"
          @click="emit('cancel')"
        />
      </header>
      <section class="modal-card-body">
        <div class="field">
          <label class="label" :for="separatorId">Separator</label>
          <div class="control">
            <div class="select">
              <select :id="separatorId" v-model="separator" data-testid="bulk-separator">
                <option v-for="option in separators" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label" :for="textId">Cards</label>
          <div class="control">
            <textarea
              :id="textId"
              v-model="text"
              class="textarea"
              rows="8"
              placeholder="ser|to be"
              data-testid="bulk-text"
            />
          </div>
          <p class="help">
            One card per line, front then back. A card face cannot span lines — add those
            individually.
          </p>
        </div>

        <div v-if="error" class="notification is-danger is-light" data-testid="bulk-error">
          {{ error }}
        </div>

        <p class="has-text-weight-semibold" data-testid="bulk-summary">{{ summary }}</p>

        <ul v-if="result.errors.length > 0" class="content" data-testid="bulk-errors">
          <li v-for="failure in result.errors" :key="failure.line">
            Line {{ failure.line }} — {{ failure.reason }}
          </li>
        </ul>
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end is-gap-2">
        <button
          type="button"
          class="button cardio-action"
          data-testid="bulk-cancel"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="button is-primary cardio-action"
          :disabled="result.cards.length === 0"
          data-testid="bulk-import"
        >
          Import
        </button>
      </footer>
    </form>
  </div>
</template>
