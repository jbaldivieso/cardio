<script setup lang="ts">
import { computed } from 'vue'
import type { Deck, Folder } from '@/domain/models'
import { countLabel } from '@/domain/prompts'

/**
 * Which decks a custom quiz draws from (spec §7.5): every deck, grouped under
 * its folder, with a select-all per folder. The selection is the caller's
 * state; this only ever asks for the next one.
 */
const props = defineProps<{
  folders: Folder[]
  decks: Deck[]
  /** Cards per deck id, so a deck can say how much it would contribute. */
  cardCounts: Record<string, number>
  modelValue: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [deckIds: string[]] }>()

/** Only folders that hold something: an empty one has nothing to offer here. */
const groups = computed(() =>
  props.folders
    .map((folder) => ({
      folder,
      decks: props.decks.filter((deck) => deck.folderId === folder.id),
    }))
    .filter((group) => group.decks.length > 0),
)

function isChecked(deckId: string): boolean {
  return props.modelValue.includes(deckId)
}

/** Indeterminate is deliberately not used: half a folder reads as unchecked. */
function isFolderChecked(deckIds: string[]): boolean {
  return deckIds.every((deckId) => isChecked(deckId))
}

function toggleDeck(deckId: string, checked: boolean): void {
  emit(
    'update:modelValue',
    checked
      ? [...props.modelValue, deckId]
      : props.modelValue.filter((selected) => selected !== deckId),
  )
}

function toggleFolder(deckIds: string[], checked: boolean): void {
  const others = props.modelValue.filter((selected) => !deckIds.includes(selected))
  emit('update:modelValue', checked ? [...others, ...deckIds] : others)
}
</script>

<template>
  <fieldset class="field">
    <legend class="label is-size-6">Decks</legend>

    <div v-if="groups.length === 0" class="notification is-light" data-testid="picker-empty">
      There are no decks to quiz yet. Add a deck and some cards first.
    </div>

    <div
      v-for="group in groups"
      :key="group.folder.id"
      class="box p-4 mb-3"
      data-testid="picker-folder"
    >
      <label class="checkbox is-flex is-align-items-center cardio-action has-text-weight-semibold">
        <input
          type="checkbox"
          class="mr-2"
          :checked="isFolderChecked(group.decks.map((deck) => deck.id))"
          :data-testid="`folder-check-${group.folder.id}`"
          @change="
            toggleFolder(
              group.decks.map((deck) => deck.id),
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        {{ group.folder.name }}
      </label>

      <ul class="ml-5 mt-2">
        <li v-for="deck in group.decks" :key="deck.id">
          <label class="checkbox is-flex is-align-items-center cardio-action">
            <input
              type="checkbox"
              class="mr-2"
              :checked="isChecked(deck.id)"
              :data-testid="`deck-check-${deck.id}`"
              @change="toggleDeck(deck.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="cardio-row-main">
              {{ deck.name }}
              <span class="has-text-grey ml-2" :data-testid="`deck-cards-${deck.id}`">
                {{ countLabel(cardCounts[deck.id] ?? 0, 'card') }}
              </span>
            </span>
          </label>
        </li>
      </ul>
    </div>
  </fieldset>
</template>
