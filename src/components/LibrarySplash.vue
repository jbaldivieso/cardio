<script setup lang="ts">
/** What the home screen shows when there is nothing in the library yet (§7.1). */
defineEmits<{ create: [] }>()
</script>

<template>
  <div class="has-text-centered py-6" data-testid="library-splash">
    <h1 class="title is-1" data-testid="splash-title">Cardio</h1>
    <p class="subtitle is-4 has-text-grey" data-testid="splash-tagline">
      Flashcards for faster learning
    </p>
    <p class="content has-text-grey mx-auto cardio-splash-hint" data-testid="splash-hint">
      Start with a folder. Folders hold decks, and decks hold your cards.
    </p>
    <button
      type="button"
      class="button is-primary is-medium cardio-action mt-6"
      data-testid="splash-create"
      @click="$emit('create')"
    >
      Create a folder
    </button>
  </div>
</template>

<style scoped>
/* The hint is one sentence; on a wide screen it reads better as a short block
   under the tagline than as a single line spanning the whole page. */
.cardio-splash-hint {
  max-width: 26rem;
}

/*
 * This is the only screen with no content of its own, so the name carries it:
 * up to twice the size Bulma's `is-1` gives a title. Bulma's title sizes are
 * fixed, which is the gap this fills — a flat 6rem overflows the container on a
 * 360px phone, and `.title` carries `word-break: break-word`, so "Cardio" would
 * split mid-word across two lines rather than shrink. The clamp scales it down
 * to `is-1`'s own 3rem instead, and reaches 6rem from about 533px up.
 *
 * The selector has to carry as much weight as Bulma's `.title.is-1` to win; a
 * bare `h1` loses to it even with the scoping attribute.
 */
.title.is-1 {
  font-size: clamp(3rem, 18vw, 6rem);
}
</style>
