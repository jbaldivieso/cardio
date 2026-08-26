<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DeckRow from '@/components/DeckRow.vue'
import MoveDialog from '@/components/MoveDialog.vue'
import NameDialog from '@/components/NameDialog.vue'
import type { Deck } from '@/domain/models'
import { deleteDeckPrompt } from '@/domain/prompts'
import { useLibraryStore } from '@/stores/library'

/** The decks of one folder (§7.2). `folderId` comes from the route. */
const props = defineProps<{ folderId: string }>()

type Dialog =
  | { kind: 'create' }
  | { kind: 'rename'; deck: Deck }
  | { kind: 'move'; deck: Deck }
  | { kind: 'delete'; deck: Deck }

const library = useLibraryStore()
const dialog = ref<Dialog | null>(null)

onMounted(() => library.load())

const folder = computed(() => library.folder(props.folderId))
const decks = computed(() => library.decksIn(props.folderId))

const deletePrompt = computed(() =>
  dialog.value?.kind === 'delete'
    ? deleteDeckPrompt(dialog.value.deck.name, library.cardCount(dialog.value.deck.id))
    : '',
)

async function submitName(name: string): Promise<void> {
  const open = dialog.value
  if (open?.kind === 'create') await library.createDeck(props.folderId, name)
  else if (open?.kind === 'rename') await library.renameDeck(open.deck.id, name)
  dialog.value = null
}

async function submitMove(target: string): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'move') return
  await library.moveDeck(open.deck.id, target)
  dialog.value = null
}

async function confirmDelete(): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'delete') return
  await library.removeDeck(open.deck.id)
  dialog.value = null
}
</script>

<template>
  <section>
    <Breadcrumb :trail="[{ label: folder?.name ?? 'Folder' }]" />

    <div v-if="library.error" class="notification is-danger is-light" data-testid="library-error">
      {{ library.error }}
    </div>

    <p v-if="library.loading" class="has-text-grey" data-testid="decks-loading">Loading…</p>

    <div v-else-if="!folder" class="notification" data-testid="folder-missing">
      <p class="has-text-weight-semibold">That folder is not here.</p>
      <p>It may have been deleted. Go back to Folders and pick another one.</p>
    </div>

    <template v-else>
      <div
        class="is-flex is-flex-wrap-wrap is-align-items-center is-justify-content-space-between is-gap-2 mb-4"
      >
        <h1 class="title is-4 mb-0">{{ folder.name }}</h1>
        <button
          type="button"
          class="button is-primary cardio-action"
          data-testid="new-deck"
          @click="dialog = { kind: 'create' }"
        >
          New deck
        </button>
      </div>

      <DeckRow
        v-for="deck in decks"
        :key="deck.id"
        :deck="deck"
        :card-count="library.cardCount(deck.id)"
        @rename="dialog = { kind: 'rename', deck }"
        @move="dialog = { kind: 'move', deck }"
        @delete="dialog = { kind: 'delete', deck }"
      />

      <div v-if="decks.length === 0" class="notification" data-testid="decks-empty">
        <p class="has-text-weight-semibold">No decks in this folder yet.</p>
        <p>A deck holds the cards you quiz on. Create your first deck to start adding cards.</p>
      </div>
    </template>

    <NameDialog
      v-if="dialog?.kind === 'create'"
      title="New deck"
      label="Deck name"
      confirm-label="Create"
      @submit="submitName"
      @cancel="dialog = null"
    />
    <NameDialog
      v-else-if="dialog?.kind === 'rename'"
      title="Rename deck"
      label="Deck name"
      :initial-name="dialog.deck.name"
      @submit="submitName"
      @cancel="dialog = null"
    />
    <MoveDialog
      v-else-if="dialog?.kind === 'move'"
      :deck-name="dialog.deck.name"
      :folders="library.folders"
      :current-folder-id="folderId"
      @submit="submitMove"
      @cancel="dialog = null"
    />
    <ConfirmDialog
      v-else-if="dialog?.kind === 'delete'"
      title="Delete deck"
      :message="deletePrompt"
      @confirm="confirmDelete"
      @cancel="dialog = null"
    />
  </section>
</template>
