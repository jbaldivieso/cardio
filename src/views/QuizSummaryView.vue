<script setup lang="ts">
import { useRouter } from 'vue-router'
import MarkdownText from '@/components/MarkdownText.vue'
import { useQuizStore } from '@/stores/quiz'

/** What a finished session came to (spec §6.6, §7.7). */
const quiz = useQuizStore()
const router = useRouter()

async function quizMissed(): Promise<void> {
  quiz.quizMissed()
  await router.push({ name: 'quiz-run' })
}

/** Done returns to the screen the quiz was launched from (§6.6). */
async function done(): Promise<void> {
  const origin = quiz.origin
  quiz.abandon()
  await router.push(origin)
}
</script>

<template>
  <section v-if="quiz.phase === 'complete'" class="section">
    <h1 class="title is-4 mb-2" data-testid="summary-headline">{{ quiz.signoff?.headline }}</h1>
    <p class="subtitle is-6" data-testid="summary-verdict">{{ quiz.signoff?.verdict }}</p>

    <div class="level is-mobile mb-4" data-testid="summary-totals">
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Answered</p>
          <p class="title is-5" data-testid="summary-answered">{{ quiz.summary.answered }}</p>
        </div>
      </div>
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Got</p>
          <p class="title is-5 has-text-success" data-testid="summary-got">
            {{ quiz.summary.got }}
          </p>
        </div>
      </div>
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Missed</p>
          <p class="title is-5 has-text-danger" data-testid="summary-missed">
            {{ quiz.summary.missed }}
          </p>
        </div>
      </div>
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Accuracy</p>
          <p class="title is-5" data-testid="summary-accuracy">{{ quiz.summary.accuracy }}%</p>
        </div>
      </div>
    </div>

    <template v-if="quiz.summary.missedCards.length > 0">
      <h2 class="title is-6">Missed</h2>
      <ul class="mb-5">
        <li
          v-for="card in quiz.summary.missedCards"
          :key="card.id"
          class="box py-3"
          data-testid="summary-missed-card"
        >
          <div class="cardio-clamp-2 cardio-row-main">
            <MarkdownText :source="card.front" />
          </div>
        </li>
      </ul>
    </template>

    <div class="is-flex is-flex-wrap-wrap is-gap-2">
      <button
        v-if="quiz.summary.missedCards.length > 0"
        type="button"
        class="button is-primary cardio-action"
        data-testid="summary-quiz-missed"
        @click="quizMissed"
      >
        Quiz the missed cards
      </button>
      <button type="button" class="button cardio-action" data-testid="summary-done" @click="done">
        Done
      </button>
    </div>
  </section>

  <section v-else class="section">
    <div class="content" data-testid="summary-none">
      <h1 class="title is-4">No results yet</h1>
      <p>Finish a quiz and its results appear here.</p>
      <RouterLink class="button is-primary cardio-action" :to="{ name: 'home' }">
        Back to folders
      </RouterLink>
    </div>
  </section>
</template>
