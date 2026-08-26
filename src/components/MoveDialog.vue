<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import type { Folder } from '@/domain/models'

/** Moves one deck to another folder (§7.2). */
const props = defineProps<{ deckName: string; folders: Folder[]; currentFolderId: string }>()

const emit = defineEmits<{ submit: [folderId: string]; cancel: [] }>()

const selectId = useId()
/** Everywhere the deck is not already. */
const targets = computed(() =>
  props.folders.filter((folder) => folder.id !== props.currentFolderId),
)
const target = ref(targets.value[0]?.id ?? '')

function submit(): void {
  if (target.value === '') return
  emit('submit', target.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal is-active" data-testid="move-dialog">
    <div class="modal-background" @click="emit('cancel')" />
    <form
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-label="Move deck"
      @submit.prevent="submit"
    >
      <header class="modal-card-head">
        <p class="modal-card-title">Move “{{ deckName }}”</p>
        <button
          type="button"
          class="delete cardio-close"
          aria-label="Close"
          @click="emit('cancel')"
        />
      </header>
      <section class="modal-card-body">
        <div v-if="targets.length === 0" class="notification is-light">
          There is nowhere else to put “{{ deckName }}”. Create another folder first.
        </div>
        <div v-else class="field">
          <label class="label" :for="selectId">Move to</label>
          <div class="control">
            <div class="select is-fullwidth">
              <select :id="selectId" v-model="target" data-testid="move-select">
                <option v-for="folder in targets" :key="folder.id" :value="folder.id">
                  {{ folder.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end is-gap-2">
        <button
          type="button"
          class="button cardio-action"
          data-testid="move-cancel"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="button is-primary cardio-action"
          :disabled="targets.length === 0"
          data-testid="move-save"
        >
          Move
        </button>
      </footer>
    </form>
  </div>
</template>
