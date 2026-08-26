<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import MarkdownText from '@/components/MarkdownText.vue'
import type { Card, QuizDirection } from '@/domain/models'

/**
 * The flip surface of the quiz (spec §7.6). It owns no state: the store holds
 * `flipped`, this emits the intent.
 *
 * The whole card is the flip target, but it is a plain container rather than a
 * button — a card face renders markdown that may contain its own links, and
 * nesting those inside a button is the problem docs/decisions.md > ADR-027
 * already settled for the card row. Space and Enter reach it through the
 * document-level shortcuts below instead; ADR-030 has the reasoning.
 */
const props = withDefaults(
  defineProps<{
    card: Card
    direction: QuizDirection
    flipped: boolean
    /** False while a dialog is on top, so its keys are not the quiz's keys. */
    keyboardActive?: boolean
  }>(),
  { keyboardActive: true },
)

const emit = defineEmits<{ flip: []; grade: [got: boolean] }>()

/** The face the quiz asks with; the other one is the answer. */
const prompt = computed(() => (props.direction === 'front' ? props.card.front : props.card.back))
const answer = computed(() => (props.direction === 'front' ? props.card.back : props.card.front))
const answerLabel = computed(() => (props.direction === 'front' ? 'Back' : 'Front'))

/** §7.6: the reveal is announced, not just drawn. */
const announcement = computed(() => (props.flipped ? `${answerLabel.value}: ${answer.value}` : ''))

function reveal(): void {
  if (!props.flipped) emit('flip')
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.keyboardActive || event.metaKey || event.ctrlKey || event.altKey) return

  if (!props.flipped) {
    if (event.key !== ' ' && event.key !== 'Enter') return
    // Space would otherwise scroll the page out from under the card.
    event.preventDefault()
    emit('flip')
    return
  }

  if (event.key === '1' || event.key === 'ArrowLeft') emit('grade', false)
  else if (event.key === '2' || event.key === 'ArrowRight') emit('grade', true)
  else return
  event.preventDefault()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="cardio-quiz">
    <div
      class="cardio-flip"
      :class="{ 'is-flipped': flipped }"
      data-testid="quiz-card"
      @click="reveal"
    >
      <div class="cardio-flip-face cardio-flip-prompt box" :aria-hidden="flipped">
        <div class="cardio-flip-scroll" data-testid="quiz-prompt">
          <MarkdownText :source="prompt" />
        </div>
        <p class="has-text-grey is-size-7 mt-3" data-testid="quiz-reveal-hint">
          Tap to reveal · Space or Enter
        </p>
      </div>

      <div class="cardio-flip-face cardio-flip-answer box" :aria-hidden="!flipped">
        <div class="cardio-flip-scroll">
          <p class="heading has-text-grey is-size-7" data-testid="quiz-label-front">Front</p>
          <div data-testid="quiz-face-front"><MarkdownText :source="card.front" /></div>
          <hr class="my-3" />
          <p class="heading has-text-grey is-size-7" data-testid="quiz-label-back">Back</p>
          <div data-testid="quiz-face-back"><MarkdownText :source="card.back" /></div>
        </div>
      </div>
    </div>

    <div v-if="flipped" class="is-flex is-gap-2 mt-4" data-testid="quiz-grading">
      <button
        type="button"
        class="button is-danger is-light is-flex-grow-1 cardio-action"
        data-testid="quiz-missed"
        @click="emit('grade', false)"
      >
        Missed it <span class="has-text-grey ml-2 is-size-7">1</span>
      </button>
      <button
        type="button"
        class="button is-success is-flex-grow-1 cardio-action"
        data-testid="quiz-got"
        @click="emit('grade', true)"
      >
        Got it <span class="has-text-grey ml-2 is-size-7">2</span>
      </button>
    </div>

    <p class="is-sr-only" aria-live="polite" data-testid="quiz-announcement">{{ announcement }}</p>
  </div>
</template>

<style scoped>
/*
 * The one place in the app with hand-written 3D: two faces stacked in the same
 * grid cell, the container rotated to swap them over --cardio-flip-duration,
 * which prefers-reduced-motion collapses to 0 (src/styles/main.scss).
 */
.cardio-flip {
  display: grid;
  cursor: pointer;
  perspective: 1200px;
  transform-style: preserve-3d;
  transition: transform var(--cardio-flip-duration) ease;
}

.cardio-flip.is-flipped {
  transform: rotateY(180deg);
}

.cardio-flip-face {
  display: flex;
  min-width: 0;
  flex-direction: column;
  /* Both faces occupy the same cell, so the card does not jump on the flip. */
  grid-area: 1 / 1;
  backface-visibility: hidden;
}

.cardio-flip-answer {
  transform: rotateY(180deg);
}

/* Long content scrolls inside the card; the page itself never does (§7.6). */
.cardio-flip-scroll {
  min-width: 0;
  max-height: 60dvh;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
