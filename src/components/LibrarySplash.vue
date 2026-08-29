<script setup lang="ts">
/** What the home screen shows when there is nothing in the library yet (§7.1). */
defineEmits<{ create: [] }>()
</script>

<template>
  <div class="has-text-centered pt-4 pb-6" data-testid="library-splash">
    <div class="cardio-splash-logo mx-auto mb-4" data-testid="splash-logo" aria-hidden="true" />
    <h1 class="title is-1" data-testid="splash-title">Cardio</h1>
    <p class="subtitle is-4 has-text-grey" data-testid="splash-tagline">
      Flashcards for faster learning.
    </p>
    <button
      type="button"
      class="button is-primary is-medium cardio-action mt-5"
      data-testid="splash-create"
      @click="$emit('create')"
    >
      Create a folder
    </button>
    <p class="content has-text-grey mx-auto cardio-splash-hint mt-5" data-testid="splash-hint">
      Start with a folder. Folders hold decks. Decks hold flashcards.
    </p>
  </div>
</template>

<style scoped>
/* The hint is one sentence; on a wide screen it reads better as a short block
   under the button than as a single line spanning the whole page. */
.cardio-splash-hint {
  max-width: 26rem;
}

/*
 * The app's own icon, at the size the screen can afford to give it. A
 * background rather than an `<img>` because the two files differ by theme, and
 * the theme is an attribute the user can set — not `prefers-color-scheme` — so
 * `<picture>` cannot switch them and a pair of `<img>` elements would download
 * both. This way the browser fetches only the one it paints. It is decorative:
 * the title underneath says the same word (ADR-055).
 */
.cardio-splash-logo {
  width: clamp(12rem, 40vw, 20rem);
  aspect-ratio: 1;
  background: center / contain no-repeat url('/pwa-512x512.png');
  /* The light logo comes on its own green ground, so it needs the corner an
     installed icon would be given. iOS rounds at 22.4% of the width. */
  border-radius: 22.4%;
}

/* On a dark page the ground would be a bright slab, so the character stands on
   the page itself and there is no corner left to round. */
[data-theme='dark'] .cardio-splash-logo {
  background-image: url('/logo-dark-512.png');
  border-radius: 0;
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
