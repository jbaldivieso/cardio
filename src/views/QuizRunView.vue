<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import QuizCard from '@/components/QuizCard.vue'
import QuizProgress from '@/components/QuizProgress.vue'
import { useQuizStore } from '@/stores/quiz'

/**
 * The running quiz (spec §7.6). All of the state is the store's; this wires it
 * to the card and handles the one thing a screen owns — leaving.
 */
const quiz = useQuizStore()
const router = useRouter()

/** Where the navigation that triggered the confirmation was heading. */
const leavingTo = ref<RouteLocationNormalized | null>(null)

async function onGrade(got: boolean): Promise<void> {
  await quiz.answer(got)
  // Answering the last card completes the session (§6.5); the summary is the
  // only place that has anything left to show.
  if (quiz.phase === 'complete') await router.push({ name: 'quiz-summary' })
}

/**
 * The exit button navigates like any other link; the guard below is what asks.
 * One confirmation path covers the button, the back button and the nav bar.
 */
function exit(): void {
  router.push(quiz.origin)
}

function confirmLeave(): void {
  const to = leavingTo.value
  leavingTo.value = null
  // Answers already given stay recorded — only the queue is discarded (§6.5).
  quiz.abandon()
  if (to) router.push(to)
}

onBeforeRouteLeave((to) => {
  if (quiz.phase !== 'running') return true
  leavingTo.value = to
  return false
})
</script>

<template>
  <section v-if="quiz.phase === 'running' && quiz.current" class="section">
    <div class="is-flex is-justify-content-space-between is-align-items-center mb-2">
      <h1 class="title is-6 mb-0">Quiz</h1>
      <button
        type="button"
        class="button is-ghost cardio-action"
        data-testid="quiz-exit"
        @click="exit"
      >
        Exit
      </button>
    </div>

    <QuizProgress :position="quiz.position" :total="quiz.total" />

    <QuizCard
      :card="quiz.current"
      :direction="quiz.direction"
      :flipped="quiz.flipped"
      :keyboard-active="leavingTo === null"
      @flip="quiz.flip()"
      @grade="onGrade"
    />

    <p v-if="quiz.error" class="notification is-danger is-light mt-4" data-testid="quiz-error">
      {{ quiz.error }}
    </p>

    <div v-if="quiz.canUndo" class="mt-4">
      <button
        type="button"
        class="button is-ghost cardio-action"
        data-testid="quiz-undo"
        @click="quiz.undo()"
      >
        Undo last answer
      </button>
    </div>
  </section>

  <section v-else class="section">
    <div class="content" data-testid="quiz-none">
      <h1 class="title is-4">No quiz running</h1>
      <p>
        A quiz lives only while you are taking it, so a reload ends it. Start another one from a
        deck or folder.
      </p>
      <RouterLink class="button is-primary cardio-action" :to="{ name: 'home' }">
        Back to folders
      </RouterLink>
    </div>
  </section>

  <ConfirmDialog
    v-if="leavingTo"
    title="Leave this quiz?"
    message="The rest of this quiz is discarded. Answers you have already given are kept."
    confirm-label="Leave quiz"
    @confirm="confirmLeave"
    @cancel="leavingTo = null"
  />
</template>
