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
import { useMasteryStore } from '@/stores/mastery'
import { useQuizStore } from '@/stores/quiz'

/** The cards of one deck (§7.3). `deckId` comes from the route. */
const props = defineProps<{ deckId: string }>()

type Dialog = { kind: 'bulk' } | { kind: 'delete'; card: Card }

const library = useLibraryStore()
const cards = useCardsStore()
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

// Both reads start together: the breadcrumb needs the library, the list needs
// this deck, and neither waits on the other.
onMounted(() => {
  void library.load()
  void cards.load(props.deckId)
  // Every badge on the screen is scored at the moment the screen opened.
  mastery.tick()
})

/** §7.3's Quiz action: the same one-tap quickstart as the deck's row (§6.1). */
const quizzable = computed(() => cards.cards.length > 0)

async function quizDeck(): Promise<void> {
  if (!quizzable.value) return
  const from = { name: 'deck', params: { deckId: props.deckId } }
  if (await quiz.quickstart([props.deckId], from)) await router.push({ name: 'quiz-run' })
}

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

// A refused import keeps the dialog and the paste, so a batch someone spent time
// assembling is not lost to one bad line (ADR-025).
async function importCards(parsed: ParsedCard[]): Promise<void> {
  const created = await cards.createMany(props.deckId, parsed)
  if (created) openDialog(null)
  else dialogError.value = cards.error
}

async function confirmDelete(): Promise<void> {
  const open = dialog.value
  if (open?.kind !== 'delete') return
  await cards.remove(open.card.id)
  // A confirmation holds nothing the user typed, so it closes either way.
  openDialog(null)
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
            class="button is-primary is-light cardio-action"
            :class="{ 'is-static': !quizzable }"
            :aria-disabled="quizzable ? 'false' : 'true'"
            aria-describedby="deck-quiz-reason"
            :title="quizzable ? undefined : 'This deck has no cards to quiz yet.'"
            data-testid="deck-quiz"
            @click="quizDeck"
          >
            Quiz
          </button>
          <RouterLink
            class="button cardio-action"
            :to="{ name: 'quiz-configure', query: { deck: deckId } }"
            data-testid="deck-custom-quiz"
          >
            Custom quiz
          </RouterLink>
          <button
            type="button"
            class="button cardio-action"
            data-testid="bulk-add"
            @click="openDialog({ kind: 'bulk' })"
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
        <span id="deck-quiz-reason" class="is-sr-only">
          {{ quizzable ? 'Quiz this deck.' : 'This deck has no cards to quiz yet.' }}
        </span>
      </div>

      <CardRow
        v-for="card in cards.cards"
        :key="card.id"
        :card="card"
        :now="mastery.now"
        @open="openEditor(card)"
        @delete="openDialog({ kind: 'delete', card })"
      />

      <div v-if="cards.cards.length === 0" class="notification" data-testid="cards-empty">
        <p class="has-text-weight-semibold">No cards in this deck yet.</p>
        <p>Add a card, or paste a batch of them with Bulk add.</p>
      </div>
    </template>

    <BulkAddDialog
      v-if="dialog?.kind === 'bulk'"
      :error="dialogError"
      @submit="importCards"
      @cancel="openDialog(null)"
    />
    <ConfirmDialog
      v-else-if="dialog?.kind === 'delete'"
      title="Delete card"
      :message="deleteCardPrompt()"
      @confirm="confirmDelete"
      @cancel="openDialog(null)"
    />
  </section>
</template>
