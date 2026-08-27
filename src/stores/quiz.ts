import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Card, CardStats, QuizDirection } from '@/domain/models'
import { buildSession, defaultQuizConfig, parseQuizConfig, shuffle } from '@/domain/quiz'
import type { QuizConfig } from '@/domain/quiz'
import { useErrorSurface } from '@/stores/errors'
import { useMasteryStore } from '@/stores/mastery'
import { repositories } from '@/stores/repositories'

/** Where a session is in its life (spec §6.5). */
export type QuizPhase = 'configuring' | 'running' | 'complete'

/** One graded card, kept so the summary can list what was missed (§6.6). */
export interface QuizAnswer {
  card: Card
  got: boolean
}

export interface QuizSummary {
  answered: number
  got: number
  missed: number
  /** `round(100 * got / answered)`, 0 before anything is answered. */
  accuracy: number
  missedCards: Card[]
}

/** The pre-answer statistics of the card an undo would step back to (§6.5). */
interface UndoSnapshot {
  cardId: string
  stats: CardStats
}

/**
 * A plain copy of a card's statistics. The cards in this store are reactive, and
 * a proxy is neither safe to hold onto across a write nor structured-cloneable,
 * which is what IndexedDB needs when the undo writes it back.
 */
function cloneStats(stats: CardStats): CardStats {
  return {
    gets: stats.gets,
    misses: stats.misses,
    history: stats.history.map((attempt) => ({ at: attempt.at, got: attempt.got })),
    lastSeenAt: stats.lastSeenAt,
  }
}

/** Where **Done** on the summary goes when a session did not say (§6.6). */
const DEFAULT_ORIGIN: RouteLocationRaw = { name: 'home' }

/** Where the last custom config is remembered (spec §6.1). */
const QUIZ_CONFIG_KEY = 'cardio.quizConfig'

/**
 * One quiz run: the queue, where in it we are, and what has been graded.
 *
 * The store owns the clock and the RNG — `src/domain/quiz.ts` takes both as
 * parameters so it stays deterministic (ADR-015). Every answer is written
 * through the repository as it is given, so abandoning a session keeps the
 * answers already in it; the queue itself is memory-only and a reload loses it
 * by design (ADR-010).
 */
export const useQuizStore = defineStore('quiz', () => {
  const phase = ref<QuizPhase>('configuring')
  const cards = ref<Card[]>([])
  const index = ref(0)
  const flipped = ref(false)
  const answers = ref<QuizAnswer[]>([])
  const direction = ref<QuizDirection>('front')
  /**
   * One entry, replaced by each answer and spent by an undo (§6.5). Shallow on
   * purpose: the snapshot is inert data that goes back to IndexedDB verbatim,
   * and a deep ref would hand the repository an uncloneable proxy.
   */
  const undoable = shallowRef<UndoSnapshot | null>(null)
  const origin = ref<RouteLocationRaw>(DEFAULT_ORIGIN)
  /**
   * True while a grade or an undo is being written. Both read the session,
   * await IndexedDB and only then move it, so without this a second grade
   * arriving first — a double tap, or Space re-activating the button the
   * pointer just used — would answer the same card twice.
   */
  const writing = ref(false)
  const { error, attempt } = useErrorSurface()
  // Every answer changes what the card's deck is worth, and the store holding
  // that summary has no other way of knowing (ADR-032).
  const mastery = useMasteryStore()

  const current = computed<Card | null>(() => cards.value[index.value] ?? null)
  const total = computed(() => cards.value.length)
  /** Human-facing position, as in "7 / 20". */
  const position = computed(() => Math.min(index.value + 1, total.value))
  const canUndo = computed(() => phase.value === 'running' && undoable.value !== null)

  const summary = computed<QuizSummary>(() => {
    const got = answers.value.filter((answer) => answer.got).length
    const answered = answers.value.length
    return {
      answered,
      got,
      missed: answered - got,
      accuracy: answered === 0 ? 0 : Math.round((100 * got) / answered),
      missedCards: answers.value.filter((answer) => !answer.got).map((answer) => answer.card),
    }
  })

  function run(queue: Card[]): void {
    cards.value = queue
    index.value = 0
    flipped.value = false
    answers.value = []
    undoable.value = null
    phase.value = 'running'
  }

  /**
   * Builds the queue and starts running it. `origin` is where **Done** returns
   * to; the entry points pass the screen the quiz was launched from (§6.6).
   */
  function start(pool: Card[], config: QuizConfig, from: RouteLocationRaw = DEFAULT_ORIGIN): void {
    const queue = buildSession(pool, config, Math.random, Date.now())
    // An empty queue is not a session. The configure screen explains why (§7.5).
    if (queue.length === 0) return
    direction.value = config.direction
    origin.value = from
    run(queue)
  }

  function flip(): void {
    flipped.value = true
  }

  /**
   * Grades the current card. The write happens before the queue advances, so a
   * failed write leaves the session exactly where it was.
   */
  async function answer(got: boolean): Promise<void> {
    const card = current.value
    // §7.6: the grading buttons are unreachable before the flip; this is the
    // same rule for the keyboard shortcuts and for anything calling in.
    if (writing.value || !flipped.value || card === null || phase.value !== 'running') return

    const snapshot: UndoSnapshot = { cardId: card.id, stats: cloneStats(card.stats) }
    writing.value = true
    const answered = await attempt(() => repositories.cards.recordAttempt(card.id, got, Date.now()))
    writing.value = false
    if (!answered) return

    mastery.invalidate(answered.deckId)
    cards.value = cards.value.map((entry) => (entry.id === answered.id ? answered : entry))
    answers.value = [...answers.value, { card: answered, got }]
    undoable.value = snapshot
    flipped.value = false
    if (index.value + 1 >= cards.value.length) {
      phase.value = 'complete'
      return
    }
    index.value += 1
  }

  /** Puts the previous card's statistics back exactly as they were (§6.5). */
  async function undo(): Promise<void> {
    const snapshot = undoable.value
    if (writing.value || !canUndo.value || snapshot === null) return

    writing.value = true
    const restored = await attempt(() =>
      repositories.cards.saveStats(snapshot.cardId, snapshot.stats),
    )
    writing.value = false
    if (!restored) return

    mastery.invalidate(restored.deckId)
    cards.value = cards.value.map((entry) => (entry.id === restored.id ? restored : entry))
    answers.value = answers.value.slice(0, -1)
    index.value = cards.value.findIndex((entry) => entry.id === restored.id)
    flipped.value = true
    undoable.value = null
  }

  /**
   * A second pass over exactly the cards just missed (§6.6): no tier and no
   * size, only the same direction and a fresh shuffle.
   */
  function quizMissed(): void {
    const missed = summary.value.missedCards
    if (missed.length === 0) return
    run(shuffle(missed, Math.random))
  }

  /**
   * Reads the pool for a config and starts running it. Answers `false` when
   * there was nothing to ask, which is the caller's cue to explain rather than
   * navigate (§7.5).
   */
  async function launch(config: QuizConfig, from: RouteLocationRaw): Promise<boolean> {
    const pool = await attempt(() => repositories.cards.listByDecks(config.deckIds))
    if (!pool) return false
    start(pool, config, from)
    return phase.value === 'running'
  }

  /** One tap from a deck or folder row: always the §6.1 defaults (§7.1, §7.2). */
  async function quickstart(deckIds: string[], from: RouteLocationRaw): Promise<boolean> {
    return launch(defaultQuizConfig(deckIds), from)
  }

  /** The config the configure screen opens with (§6.1). */
  function loadConfig(): QuizConfig {
    try {
      return parseQuizConfig(localStorage.getItem(QUIZ_CONFIG_KEY))
    } catch {
      // A storage the browser refuses to read (private mode, blocked cookies)
      // is a missing preference, not an error worth showing.
      return defaultQuizConfig()
    }
  }

  function saveConfig(config: QuizConfig): void {
    try {
      localStorage.setItem(QUIZ_CONFIG_KEY, JSON.stringify(config))
    } catch {
      // Remembering the last config is a convenience; a full or blocked store
      // must not stop a quiz from starting.
    }
  }

  /** Leaves the session. What was already answered stays answered (§6.5). */
  function abandon(): void {
    phase.value = 'configuring'
    cards.value = []
    answers.value = []
    index.value = 0
    flipped.value = false
    undoable.value = null
  }

  return {
    phase,
    cards,
    index,
    flipped,
    answers,
    direction,
    origin,
    error,
    current,
    total,
    position,
    canUndo,
    summary,
    start,
    launch,
    quickstart,
    loadConfig,
    saveConfig,
    flip,
    answer,
    undo,
    quizMissed,
    abandon,
  }
})
