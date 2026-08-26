<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FolderRow from '@/components/FolderRow.vue'
import NameDialog from '@/components/NameDialog.vue'
import type { Folder } from '@/domain/models'
import { deleteFolderPrompt } from '@/domain/prompts'
import { useLibraryStore } from '@/stores/library'

/** The home screen: every folder, with what it holds (§7.1). */
type Dialog =
  { kind: 'create' } | { kind: 'rename'; folder: Folder } | { kind: 'delete'; folder: Folder }

const library = useLibraryStore()
const dialog = ref<Dialog | null>(null)

onMounted(() => library.load())

const deletePrompt = computed(() =>
  dialog.value?.kind === 'delete'
    ? deleteFolderPrompt(dialog.value.folder.name, library.countsFor(dialog.value.folder.id))
    : '',
)

async function submitName(name: string): Promise<void> {
  const open = dialog.value
  if (open?.kind === 'create') await library.createFolder(name)
  else if (open?.kind === 'rename') await library.renameFolder(open.folder.id, name)
  dialog.value = null
}

async function confirmDelete(): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'delete') return
  await library.removeFolder(open.folder.id)
  dialog.value = null
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
        @click="dialog = { kind: 'create' }"
      >
        New folder
      </button>
    </div>

    <div v-if="library.error" class="notification is-danger is-light" data-testid="library-error">
      {{ library.error }}
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
        @rename="dialog = { kind: 'rename', folder }"
        @delete="dialog = { kind: 'delete', folder }"
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
      @submit="submitName"
      @cancel="dialog = null"
    />
    <NameDialog
      v-else-if="dialog?.kind === 'rename'"
      title="Rename folder"
      label="Folder name"
      :initial-name="dialog.folder.name"
      @submit="submitName"
      @cancel="dialog = null"
    />
    <ConfirmDialog
      v-else-if="dialog?.kind === 'delete'"
      title="Delete folder"
      :message="deletePrompt"
      @confirm="confirmDelete"
      @cancel="dialog = null"
    />
  </section>
</template>
