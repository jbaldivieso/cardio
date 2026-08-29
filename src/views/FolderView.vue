<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Breadcrumb from '@/components/Breadcrumb.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DeckRow from '@/components/DeckRow.vue'
import MoveDialog from '@/components/MoveDialog.vue'
import NameDialog from '@/components/NameDialog.vue'
import type { Deck } from '@/domain/models'
import { deleteDeckPrompt } from '@/domain/prompts'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { useQuizStore } from '@/stores/quiz'

/** The decks of one folder (§7.2). `folderId` comes from the route. */
const props = defineProps<{ folderId: string }>()

type Dialog =
  | { kind: 'create' }
  | { kind: 'rename'; deck: Deck }
  | { kind: 'move'; deck: Deck }
  | { kind: 'delete'; deck: Deck }

const library = useLibraryStore()
const mastery = useMasteryStore()
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
const error = computed(() => library.error ?? mastery.error)

/**
 * A folder with no cards anywhere in it has nothing to configure a quiz over, so
 * the header does not offer one, on the same count its rows go by (ADR-054).
 */
const quizzable = computed(() => library.countsFor(props.folderId).cards > 0)

/** A deck can only be moved somewhere: with one folder there is nowhere, and no
 * Move on its row to press (§7.2). */
const movable = computed(() => library.folders.length > 1)

// The bars need each deck's cards, which are a read behind the decks themselves.
// The watch is on the decks still missing a summary rather than on the deck list,
// so one a write drops — a quiz answer, a card added — is read again while the
// screen stays where it is. Asking for nothing costs nothing, which is what ends
// the round trip once every deck is summarised.
watch(
  () => decks.value.filter((deck) => !mastery.deckSummary(deck.id)).map((deck) => deck.id),
  (missing) => void mastery.ensure(missing),
  { immediate: true },
)

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

    <div v-if="error" class="notification is-danger is-light" data-testid="library-error">
      {{ error }}
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
            v-if="quizzable"
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
        :movable="movable"
        :summary="mastery.deckSummary(deck.id)"
        @rename="openDialog({ kind: 'rename', deck })"
        @quiz="quizDeck(deck.id)"
        @move="openDialog({ kind: 'move', deck })"
        @delete="openDialog({ kind: 'delete', deck })"
      />

      <div v-if="decks.length === 0" class="notification" data-testid="decks-empty">
        <p class="has-text-weight-semibold">No decks in this folder yet.</p>
        <p>Decks hold flashcards. Create your first deck to start adding cards.</p>
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
