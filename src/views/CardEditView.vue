<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import MarkdownText from '@/components/MarkdownText.vue'
import { FACE_MAX_LENGTH } from '@/domain/validation'
import { useCardsStore } from '@/stores/cards'

/**
 * The card editor (§7.4). `deckId` arrives on the create route, `cardId` on the
 * edit route, so which one is present decides the mode.
 */
const props = defineProps<{ deckId?: string; cardId?: string }>()

const cards = useCardsStore()
const router = useRouter()

const editing = computed(() => props.cardId !== undefined)
const front = ref('')
const back = ref('')
/** What is in the database; the difference from it is what "unsaved" means. */
const stored = ref({ front: '', back: '' })
const deckId = ref(props.deckId ?? '')
const loading = ref(true)
const missing = ref(false)
/** Set while the discard confirmation is up; resolving it answers the guard. */
const pendingLeave = ref<((leave: boolean) => void) | null>(null)

onMounted(async () => {
  if (props.cardId) {
    const card = await cards.find(props.cardId)
    if (card) {
      front.value = card.front
      back.value = card.back
      stored.value = { front: card.front, back: card.back }
      deckId.value = card.deckId
    } else {
      missing.value = true
    }
  }
  loading.value = false
})

function overLength(face: string): boolean {
  return face.trim().length > FACE_MAX_LENGTH
}

function faceValid(face: string): boolean {
  return face.trim().length > 0 && !overLength(face)
}

const valid = computed(() => faceValid(front.value) && faceValid(back.value))
const dirty = computed(() => front.value !== stored.value.front || back.value !== stored.value.back)

async function toDeck(): Promise<void> {
  await router.push({ name: 'deck', params: { deckId: deckId.value } })
}

/** `another` keeps the editor open for the next card in a run (§7.4). */
async function save(another: boolean): Promise<void> {
  if (!valid.value) return
  const faces = { front: front.value, back: back.value }
  const written = props.cardId
    ? await cards.update(props.cardId, faces)
    : await cards.create(deckId.value, faces)
  if (!written) return

  if (another) {
    front.value = ''
    back.value = ''
    stored.value = { front: '', back: '' }
    return
  }
  stored.value = { front: front.value, back: back.value }
  await toDeck()
}

// Leaving is one path, however it starts — the Cancel button, the nav bar, or
// the browser's back button all come through here.
onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return new Promise<boolean>((resolve) => {
    pendingLeave.value = resolve
  })
})

function answerLeave(leave: boolean): void {
  const resolve = pendingLeave.value
  pendingLeave.value = null
  resolve?.(leave)
}
</script>

<template>
  <section>
    <h1 class="title is-4">{{ editing ? 'Edit card' : 'New card' }}</h1>

    <div v-if="cards.error" class="notification is-danger is-light" data-testid="card-error">
      {{ cards.error }}
    </div>

    <p v-if="loading" class="has-text-grey" data-testid="card-loading">Loading…</p>

    <div v-else-if="missing" class="notification" data-testid="card-missing">
      <p class="has-text-weight-semibold">That card is not here.</p>
      <p>It may have been deleted.</p>
      <RouterLink class="button mt-3 cardio-action" :to="{ name: 'home' }"
        >Go to Folders</RouterLink
      >
    </div>

    <template v-else>
      <div class="columns">
        <div class="column">
          <div class="field">
            <label class="label" for="card-front-input">Front</label>
            <div class="control">
              <textarea
                id="card-front-input"
                v-model="front"
                class="textarea"
                rows="6"
                data-testid="card-front"
              />
            </div>
            <p
              class="help"
              :class="{ 'has-text-danger': overLength(front) }"
              data-testid="card-front-count"
            >
              {{ front.length }} / {{ FACE_MAX_LENGTH }}
            </p>
          </div>
          <p class="label is-size-7">Preview</p>
          <MarkdownText :source="front" class="box" data-testid="card-front-preview" />
        </div>

        <div class="column">
          <div class="field">
            <label class="label" for="card-back-input">Back</label>
            <div class="control">
              <textarea
                id="card-back-input"
                v-model="back"
                class="textarea"
                rows="6"
                data-testid="card-back"
              />
            </div>
            <p
              class="help"
              :class="{ 'has-text-danger': overLength(back) }"
              data-testid="card-back-count"
            >
              {{ back.length }} / {{ FACE_MAX_LENGTH }}
            </p>
          </div>
          <p class="label is-size-7">Preview</p>
          <MarkdownText :source="back" class="box" data-testid="card-back-preview" />
        </div>
      </div>

      <div class="is-flex is-flex-wrap-wrap is-gap-2">
        <button
          type="button"
          class="button is-primary cardio-action"
          :disabled="!valid"
          data-testid="card-save"
          @click="save(false)"
        >
          Save
        </button>
        <button
          v-if="!editing"
          type="button"
          class="button cardio-action"
          :disabled="!valid"
          data-testid="card-save-another"
          @click="save(true)"
        >
          Save and add another
        </button>
        <button
          type="button"
          class="button is-ghost cardio-action"
          data-testid="card-cancel"
          @click="toDeck"
        >
          Cancel
        </button>
      </div>
    </template>

    <ConfirmDialog
      v-if="pendingLeave"
      title="Discard changes"
      message="This card has unsaved changes. Leave without saving them?"
      confirm-label="Discard"
      @confirm="answerLeave(true)"
      @cancel="answerLeave(false)"
    />
  </section>
</template>
