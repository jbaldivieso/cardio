<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Breadcrumb from '@/components/Breadcrumb.vue'
import BulkAddDialog from '@/components/BulkAddDialog.vue'
import CardRow from '@/components/CardRow.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { ParsedCard } from '@/domain/bulkParse'
import type { Card } from '@/domain/models'
import { deleteCardPrompt } from '@/domain/prompts'
import { useCardsStore } from '@/stores/cards'
import { useLibraryStore } from '@/stores/library'

/** The cards of one deck (§7.3). `deckId` comes from the route. */
const props = defineProps<{ deckId: string }>()

type Dialog = { kind: 'bulk' } | { kind: 'delete'; card: Card }

const library = useLibraryStore()
const cards = useCardsStore()
const router = useRouter()
const dialog = ref<Dialog | null>(null)

// Both reads start together: the breadcrumb needs the library, the list needs
// this deck, and neither waits on the other.
onMounted(() => {
  void library.load()
  void cards.load(props.deckId)
})

const deck = computed(() => library.deck(props.deckId))
const folder = computed(() => (deck.value ? library.folder(deck.value.folderId) : undefined))
const loading = computed(() => library.loading || cards.loading)
const error = computed(() => library.error ?? cards.error)

// The folder crumb is only a link once the folder is known: a route built from
// a folderId that is not there yet cannot be resolved.
const trail = computed(() =>
  folder.value
    ? [
        {
          label: folder.value.name,
          to: { name: 'folder', params: { folderId: folder.value.id } },
        },
        { label: deck.value?.name ?? 'Deck' },
      ]
    : [{ label: deck.value?.name ?? 'Deck' }],
)

function openEditor(card: Card): void {
  void router.push({ name: 'card-edit', params: { cardId: card.id } })
}

async function importCards(parsed: ParsedCard[]): Promise<void> {
  await cards.createMany(props.deckId, parsed)
  dialog.value = null
}

async function confirmDelete(): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'delete') return
  await cards.remove(open.card.id)
  dialog.value = null
}
</script>

<template>
  <section>
    <Breadcrumb :trail="trail" />

    <div v-if="error" class="notification is-danger is-light" data-testid="library-error">
      {{ error }}
    </div>

    <p v-if="loading" class="has-text-grey" data-testid="cards-loading">Loading…</p>

    <div v-else-if="!deck" class="notification" data-testid="deck-missing">
      <p class="has-text-weight-semibold">That deck is not here.</p>
      <p>It may have been deleted. Go back to Folders and pick another one.</p>
    </div>

    <template v-else>
      <div
        class="is-flex is-flex-wrap-wrap is-align-items-center is-justify-content-space-between is-gap-2 mb-4"
      >
        <h1 class="title is-4 mb-0">{{ deck.name }}</h1>
        <div class="is-flex is-flex-wrap-wrap is-gap-2">
          <button
            type="button"
            class="button cardio-action"
            data-testid="bulk-add"
            @click="dialog = { kind: 'bulk' }"
          >
            Bulk add
          </button>
          <RouterLink
            class="button is-primary cardio-action"
            :to="{ name: 'card-new', params: { deckId } }"
            data-testid="new-card"
          >
            New card
          </RouterLink>
        </div>
      </div>

      <CardRow
        v-for="card in cards.cards"
        :key="card.id"
        :card="card"
        @open="openEditor(card)"
        @delete="dialog = { kind: 'delete', card }"
      />

      <div v-if="cards.cards.length === 0" class="notification" data-testid="cards-empty">
        <p class="has-text-weight-semibold">No cards in this deck yet.</p>
        <p>Add a card, or paste a batch of them with Bulk add.</p>
      </div>
    </template>

    <BulkAddDialog v-if="dialog?.kind === 'bulk'" @submit="importCards" @cancel="dialog = null" />
    <ConfirmDialog
      v-else-if="dialog?.kind === 'delete'"
      title="Delete card"
      :message="deleteCardPrompt()"
      @confirm="confirmDelete"
      @cancel="dialog = null"
    />
  </section>
</template>
