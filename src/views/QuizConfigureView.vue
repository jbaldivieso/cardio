<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import DeckPicker from '@/components/DeckPicker.vue'
import TierSlider from '@/components/TierSlider.vue'
import type { QuizDirection } from '@/domain/models'
import { QUIZ_SIZES } from '@/domain/quiz'
import type { QuizConfig, QuizSize, QuizTier } from '@/domain/quiz'
import { useLibraryStore } from '@/stores/library'
import { useQuizStore } from '@/stores/quiz'

/**
 * The custom quiz builder (spec §7.5). It opens on the launch context — the
 * folder or deck whose "Custom quiz" led here — and otherwise on the config
 * `cardio.quizConfig` remembers (§6.1).
 */
const library = useLibraryStore()
const quiz = useQuizStore()
const route = useRoute()
const router = useRouter()

const remembered = quiz.loadConfig()
const deckIds = ref<string[]>([])
const direction = ref<QuizDirection>(remembered.direction)
const tier = ref<QuizTier>(remembered.tier)
const size = ref<QuizSize>(remembered.size)
/** Set when a start found nothing to ask, which must explain rather than move. */
const emptyPool = ref(false)

function param(name: string): string | null {
  const value = route.query[name]
  return typeof value === 'string' ? value : null
}

const launchFolder = param('folder')
const launchDeck = param('deck')

onMounted(async () => {
  await library.load()
  // The launch context wins over what was remembered (§7.5); a remembered deck
  // that has since been deleted quietly drops out.
  if (launchFolder) deckIds.value = library.decksIn(launchFolder).map((deck) => deck.id)
  else if (launchDeck) deckIds.value = [launchDeck]
  else deckIds.value = remembered.deckIds.filter((id) => library.deck(id) !== undefined)
})

const cardCounts = computed(() =>
  Object.fromEntries(library.decks.map((deck) => [deck.id, library.cardCount(deck.id)])),
)

/** §7.5: a session needs at least one deck that actually holds a card. */
const canStart = computed(() => deckIds.value.some((id) => library.cardCount(id) > 0))

const config = computed<QuizConfig>(() => ({
  deckIds: deckIds.value,
  direction: direction.value,
  tier: tier.value,
  size: size.value,
}))

/** Where **Done** on the summary returns to (§6.6). */
const origin = computed<RouteLocationRaw>(() => {
  if (launchFolder) return { name: 'folder', params: { folderId: launchFolder } }
  if (launchDeck) return { name: 'deck', params: { deckId: launchDeck } }
  return { name: 'home' }
})

function sizeLabel(value: QuizSize): string {
  return value === 'all' ? 'All' : String(value)
}

async function startQuiz(): Promise<void> {
  if (!canStart.value) return
  emptyPool.value = false
  quiz.saveConfig(config.value)
  if (await quiz.launch(config.value, origin.value)) await router.push({ name: 'quiz-run' })
  // A launch also declines when the pool could not be read at all, and that is
  // a failure to report rather than an empty deck to explain (§7.5).
  else emptyPool.value = quiz.error === null
}
</script>

<template>
  <section>
    <h1 class="title is-4">Custom quiz</h1>

    <div class="field">
      <span id="quiz-direction-label" class="label is-size-6">Show first</span>
      <div class="buttons has-addons" role="group" aria-labelledby="quiz-direction-label">
        <button
          type="button"
          class="button cardio-action"
          :class="{ 'is-primary': direction === 'front' }"
          :aria-pressed="direction === 'front'"
          data-testid="direction-front"
          @click="direction = 'front'"
        >
          Front
        </button>
        <button
          type="button"
          class="button cardio-action"
          :class="{ 'is-primary': direction === 'back' }"
          :aria-pressed="direction === 'back'"
          data-testid="direction-back"
          @click="direction = 'back'"
        >
          Back
        </button>
      </div>
    </div>

    <TierSlider v-model="tier" />

    <div class="field">
      <span id="quiz-size-label" class="label is-size-6">Session size</span>
      <div class="buttons has-addons" role="group" aria-labelledby="quiz-size-label">
        <button
          v-for="option in QUIZ_SIZES"
          :key="String(option)"
          type="button"
          class="button cardio-action"
          :class="{ 'is-primary': size === option }"
          :aria-pressed="size === option"
          :data-testid="`size-${option}`"
          @click="size = option"
        >
          {{ sizeLabel(option) }}
        </button>
      </div>
    </div>

    <DeckPicker
      v-model="deckIds"
      :folders="library.folders"
      :decks="library.decks"
      :card-counts="cardCounts"
    />

    <p v-if="emptyPool" class="notification is-warning is-light" data-testid="quiz-empty">
      Those decks have no cards to quiz. Add some cards, or choose another deck.
    </p>

    <p
      v-if="library.error ?? quiz.error"
      class="notification is-danger is-light"
      data-testid="quiz-error"
    >
      {{ library.error ?? quiz.error }}
    </p>

    <p id="quiz-start-reason" class="is-size-7 has-text-grey mb-2">
      {{
        canStart
          ? 'Ready to start.'
          : 'Choose at least one deck that has a card in it to start a quiz.'
      }}
    </p>

    <button
      type="button"
      class="button is-primary cardio-action"
      :class="{ 'is-static': !canStart }"
      :aria-disabled="canStart ? 'false' : 'true'"
      aria-describedby="quiz-start-reason"
      data-testid="quiz-start"
      @click="startQuiz"
    >
      Start quiz
    </button>
  </section>
</template>
