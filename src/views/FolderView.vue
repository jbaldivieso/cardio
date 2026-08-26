<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Breadcrumb from '@/components/Breadcrumb.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DeckRow from '@/components/DeckRow.vue'
import MoveDialog from '@/components/MoveDialog.vue'
import NameDialog from '@/components/NameDialog.vue'
import type { Deck } from '@/domain/models'
import { deleteDeckPrompt } from '@/domain/prompts'
import { useLibraryStore } from '@/stores/library'
import { useQuizStore } from '@/stores/quiz'

/** The decks of one folder (§7.2). `folderId` comes from the route. */
const props = defineProps<{ folderId: string }>()

type Dialog =
  | { kind: 'create' }
  | { kind: 'rename'; deck: Deck }
  | { kind: 'move'; deck: Deck }
  | { kind: 'delete'; deck: Deck }

const library = useLibraryStore()
const quiz = useQuizStore()
const router = useRouter()
const dialog = ref<Dialog | null>(null)
/** Why the open dialog's last submit was refused. Cleared whenever one opens. */
const dialogError = ref<string | null>(null)

function openDialog(next: Dialog | null): void {
  dialogError.value = null
  dialog.value = next
}

onMounted(() => library.load())

const folder = computed(() => library.folder(props.folderId))
const decks = computed(() => library.decksIn(props.folderId))

const deletePrompt = computed(() =>
  dialog.value?.kind === 'delete'
    ? deleteDeckPrompt(dialog.value.deck.name, library.cardCount(dialog.value.deck.id))
    : '',
)

// A refused write leaves the dialog up with the name still in it (ADR-025).
async function submitName(name: string): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'create' && open?.kind !== 'rename') return
  const saved =
    open.kind === 'create'
      ? await library.createDeck(props.folderId, name)
      : await library.renameDeck(open.deck.id, name)
  if (saved) openDialog(null)
  else dialogError.value = library.error
}

async function submitMove(target: string): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'move') return
  const moved = await library.moveDeck(open.deck.id, target)
  if (moved) openDialog(null)
  else dialogError.value = library.error
}

/** One tap, the §6.1 defaults, straight into the session (§7.2). */
async function quizDeck(deckId: string): Promise<void> {
  const from = { name: 'folder', params: { folderId: props.folderId } }
  if (await quiz.quickstart([deckId], from)) await router.push({ name: 'quiz-run' })
}

async function confirmDelete(): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'delete') return
  await library.removeDeck(open.deck.id)
  // A confirmation holds nothing the user typed, so it closes either way.
  openDialog(null)
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
        <div class="is-flex is-flex-shrink-0 is-gap-2">
          <RouterLink
            class="button cardio-action"
            :to="{ name: 'quiz-configure', query: { folder: folderId } }"
            data-testid="folder-custom-quiz"
          >
            Custom quiz
          </RouterLink>
          <button
            type="button"
            class="button is-primary cardio-action"
            data-testid="new-deck"
            @click="openDialog({ kind: 'create' })"
          >
            New deck
          </button>
        </div>
      </div>

      <DeckRow
        v-for="deck in decks"
        :key="deck.id"
        :deck="deck"
        :card-count="library.cardCount(deck.id)"
        @rename="openDialog({ kind: 'rename', deck })"
        @quiz="quizDeck(deck.id)"
        @move="openDialog({ kind: 'move', deck })"
        @delete="openDialog({ kind: 'delete', deck })"
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
      :error="dialogError"
      @submit="submitName"
      @cancel="openDialog(null)"
    />
    <NameDialog
      v-else-if="dialog?.kind === 'rename'"
      title="Rename deck"
      label="Deck name"
      :initial-name="dialog.deck.name"
      :error="dialogError"
      @submit="submitName"
      @cancel="openDialog(null)"
    />
    <MoveDialog
      v-else-if="dialog?.kind === 'move'"
      :deck-name="dialog.deck.name"
      :folders="library.folders"
      :current-folder-id="folderId"
      :error="dialogError"
      @submit="submitMove"
      @cancel="openDialog(null)"
    />
    <ConfirmDialog
      v-else-if="dialog?.kind === 'delete'"
      title="Delete deck"
      :message="deletePrompt"
      @confirm="confirmDelete"
      @cancel="openDialog(null)"
    />
  </section>
</template>
