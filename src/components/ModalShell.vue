<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

/**
 * The chrome every modal in the app shares: the Bulma modal card, its title and
 * close button, a click on the backdrop, and Escape wherever the focus went.
 *
 * The three dialogs differ only in what goes in the body and the footer, so
 * that is all they carry. Kept in one place because focus, Escape and the modal
 * markup are the parts that have to behave the same in all of them.
 */
withDefaults(
  defineProps<{
    title: string
    /** What an e2e test reaches this dialog by. */
    testid: string
    /** `alertdialog` for the destructive ones, which interrupt (§4.4, §7.8). */
    role?: 'dialog' | 'alertdialog'
    /** A card that is a form submits on Enter; one that is a div does not. */
    form?: boolean
  }>(),
  { role: 'dialog', form: false },
)

const emit = defineEmits<{ cancel: []; submit: [] }>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

// On the document rather than the dialog: Escape has to work wherever the focus
// went after the modal opened.
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="modal is-active" :data-testid="testid">
    <div class="modal-background" @click="emit('cancel')" />
    <component
      :is="form ? 'form' : 'div'"
      class="modal-card"
      :role="role"
      aria-modal="true"
      :aria-label="title"
      @submit.prevent="emit('submit')"
    >
      <header class="modal-card-head">
        <p class="modal-card-title">{{ title }}</p>
        <button
          type="button"
          class="delete cardio-close"
          aria-label="Close"
          @click="emit('cancel')"
        />
      </header>
      <section class="modal-card-body">
        <slot />
      </section>
      <footer class="modal-card-foot is-justify-content-flex-end is-gap-2">
        <slot name="footer" />
      </footer>
    </component>
  </div>
</template>
