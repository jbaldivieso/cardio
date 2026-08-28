<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'

/**
 * The overflow menu a row's less-used actions sit behind (§7.1, §7.2): a trigger
 * marked with Feather's "more-horizontal", and a panel holding whatever buttons
 * the row puts in the slot.
 *
 * A disclosure rather than an ARIA `menu`: the slot holds ordinary buttons that
 * Tab walks in order, and promising `role="menu"` would promise arrow-key
 * navigation this does not implement (docs/decisions.md > ADR-052).
 */
defineProps<{
  /** What the trigger is called, e.g. `More actions for “Verbs”`. */
  label: string
  /** What a test reaches the trigger by; the panel takes `<testid>-panel`. */
  testid: string
}>()

const open = ref(false)
const panelId = useId()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

function close(): void {
  open.value = false
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Node | null
  // The press that opened the menu bubbles here too, so anything inside the
  // component is left to the handlers that own it.
  if (target && root.value?.contains(target)) return
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  close()
  // Escape closed something the user was in, so the focus goes back to the
  // control that opened it rather than to the top of the document.
  trigger.value?.focus()
}

/**
 * A press inside the panel has done whatever it was going to do, so the menu
 * gets out of the way — unless the item was gated, where nothing happened and
 * the reason beside it is still worth reading.
 */
function onPanelClick(event: MouseEvent): void {
  if ((event.target as HTMLElement | null)?.closest('[aria-disabled="true"]')) return
  close()
}

// Listening only while open keeps a screen of rows from holding a document
// listener each.
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="dropdown" :class="{ 'is-active': open }">
    <div class="dropdown-trigger">
      <button
        ref="trigger"
        type="button"
        class="button is-ghost cardio-action"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="open ? panelId : undefined"
        :aria-label="label"
        :title="label"
        :data-testid="testid"
        @click="open = !open"
      >
        <span class="icon">
          <!-- Feather "more-horizontal" (feathericons.com), MIT. Inlined for the
               same reason as the nav's gear: nothing may reach the network. -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </span>
      </button>
    </div>
    <div
      v-if="open"
      :id="panelId"
      class="dropdown-menu"
      :data-testid="`${testid}-panel`"
      @click="onPanelClick"
    >
      <div class="dropdown-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Bulma's dropdown is `display: inline-flex` and aligns its trigger to the top
   of the line; beside a row's title it should sit on the text's own baseline
   band, which is what centring the trigger inside the line box gives. */
.dropdown {
  vertical-align: middle;
}

/* Spec §7's 44 px target, applied here rather than by every row that fills the
   slot: Bulma's dropdown item is padding-sized and lands a few pixels short.
   `:deep` because the items are slotted, so they carry the row's scope. */
.dropdown-content :deep(.dropdown-item) {
  display: flex;
  min-height: 44px;
  align-items: center;
}
</style>
