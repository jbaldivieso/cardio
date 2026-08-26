<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FolderRow from '@/components/FolderRow.vue'
import NameDialog from '@/components/NameDialog.vue'
import type { Folder } from '@/domain/models'
import { deleteFolderPrompt } from '@/domain/prompts'
import { useLibraryStore } from '@/stores/library'
import { useMasteryStore } from '@/stores/mastery'
import { useQuizStore } from '@/stores/quiz'

/** The home screen: every folder, with what it holds (§7.1). */
type Dialog =
  { kind: 'create' } | { kind: 'rename'; folder: Folder } | { kind: 'delete'; folder: Folder }

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

// The bars need every deck's cards, which are a read behind the folders. The
// watch is on the decks still missing a summary rather than on the deck list, so
// one a write drops — a quiz answer, a card added — is read again while the
// screen stays where it is. Asking for nothing costs nothing, which is what ends
// the round trip once every deck is summarised.
watch(
  () => library.decks.filter((deck) => !mastery.deckSummary(deck.id)).map((deck) => deck.id),
  (missing) => void mastery.ensure(missing),
  { immediate: true },
)

const error = computed(() => library.error ?? mastery.error)

const deletePrompt = computed(() =>
  dialog.value?.kind === 'delete'
    ? deleteFolderPrompt(dialog.value.folder.name, library.countsFor(dialog.value.folder.id))
    : '',
)

// A refused write leaves the dialog up with the name still in it, so the typing
// is not thrown away along with the attempt (ADR-025).
async function submitName(name: string): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'create' && open?.kind !== 'rename') return
  const saved =
    open.kind === 'create'
      ? await library.createFolder(name)
      : await library.renameFolder(open.folder.id, name)
  if (saved) openDialog(null)
  else dialogError.value = library.error
}

/** Quickstart across every deck in the folder, on the §6.1 defaults (§7.1). */
async function quizFolder(folderId: string): Promise<void> {
  const deckIds = library.decksIn(folderId).map((deck) => deck.id)
  if (await quiz.quickstart(deckIds, { name: 'home' })) await router.push({ name: 'quiz-run' })
}

async function confirmDelete(): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'delete') return
  await library.removeFolder(open.folder.id)
  // A confirmation holds nothing the user typed, so it closes either way and
  // lets the screen's error banner explain a failure.
  openDialog(null)
}
</script>

<template>
  <section>
    <div
      class="is-flex is-flex-wrap-wrap is-align-items-center is-justify-content-space-between is-gap-2 mb-4"
    >
      <h1 class="title is-4 mb-0">Folders</h1>
      <button
        type="button"
        class="button is-primary cardio-action"
        data-testid="new-folder"
        @click="openDialog({ kind: 'create' })"
      >
        New folder
      </button>
    </div>

    <div v-if="error" class="notification is-danger is-light" data-testid="library-error">
      {{ error }}
    </div>

    <p v-if="library.loading" class="has-text-grey" data-testid="folders-loading">Loading…</p>

    <template v-else>
      <FolderRow
        v-for="folder in library.folders"
        :key="folder.id"
        :folder="folder"
        :deck-count="library.countsFor(folder.id).decks"
        :card-count="library.countsFor(folder.id).cards"
        :deletable="library.canDeleteFolder(folder.id)"
        :summary="mastery.folderSummary(folder.id)"
        @quiz="quizFolder(folder.id)"
        @rename="openDialog({ kind: 'rename', folder })"
        @delete="openDialog({ kind: 'delete', folder })"
      />

      <div v-if="library.folders.length === 0" class="notification" data-testid="folders-empty">
        <p class="has-text-weight-semibold">No folders yet.</p>
        <p>
          A folder holds decks, and a deck holds your cards. Create your first folder to get
          started.
        </p>
      </div>
    </template>

    <NameDialog
      v-if="dialog?.kind === 'create'"
      title="New folder"
      label="Folder name"
      confirm-label="Create"
      :error="dialogError"
      @submit="submitName"
      @cancel="openDialog(null)"
    />
    <NameDialog
      v-else-if="dialog?.kind === 'rename'"
      title="Rename folder"
      label="Folder name"
      :initial-name="dialog.folder.name"
      :error="dialogError"
      @submit="submitName"
      @cancel="openDialog(null)"
    />
    <ConfirmDialog
      v-else-if="dialog?.kind === 'delete'"
      title="Delete folder"
      :message="deletePrompt"
      @confirm="confirmDelete"
      @cancel="openDialog(null)"
    />
  </section>
</template>
