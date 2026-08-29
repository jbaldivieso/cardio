<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TypedConfirmDialog from '@/components/TypedConfirmDialog.vue'
import { isStoragePersistent } from '@/db/persistence'
import type { LibraryCounts } from '@/domain/backup'
import {
  deleteEverythingPrompt,
  importPreview,
  repairNotes,
  replaceEverythingPrompt,
  storedPrompt,
} from '@/domain/prompts'
import { useBackupStore } from '@/stores/backup'
import { useInstallStore } from '@/stores/install'
import { useLibraryStore } from '@/stores/library'
import { THEME_PREFERENCES, useThemeStore } from '@/stores/theme'
import type { ThemePreference } from '@/stores/theme'

/**
 * Theme, backup and the danger zone (spec §7.8). The two irreversible actions —
 * replacing the library and deleting it — are the only ones in the app behind a
 * typed confirmation.
 */
const theme = useThemeStore()
const backup = useBackupStore()
const library = useLibraryStore()

/** Which irreversible action is waiting to be confirmed, if any. */
const confirming = ref<'replace' | 'delete' | null>(null)
const deleted = ref(false)
/** `null` until the browser has answered (§4.5). */
const persistent = ref<boolean | null>(null)
/** `false` until the library has been read once, so no count is quoted early. */
const loaded = ref(false)

// Which install instructions this browser can actually carry out, if any (§12).
const install = useInstallStore()
const version = __APP_VERSION__

const themeLabels: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

onMounted(async () => {
  // The backup store outlives this screen. A file validated on an earlier visit
  // would otherwise come back armed beside a file field that has forgotten its
  // name, and Merge would write a file the user never chose this time.
  backup.discard()
  await library.load()
  loaded.value = library.error === null
  persistent.value = await isStoragePersistent()
})

/**
 * What is stored, or `null` when the library could not be read. A failed read
 * leaves the lists empty, and quoting those zeros would promise the user there
 * is nothing to lose immediately before offering to delete everything.
 */
const totals = computed<LibraryCounts | null>(() => {
  if (!loaded.value || library.error !== null) return null
  return {
    folders: library.folders.length,
    decks: library.decks.length,
    cards: library.decks.reduce((sum, deck) => sum + library.cardCount(deck.id), 0),
  }
})

const error = computed(() => backup.error ?? library.error)
const repairs = computed(() => (backup.pending ? repairNotes(backup.pending.repairs) : []))

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]
  if (!chosen) return
  deleted.value = false
  await backup.read(chosen)
  // Clearing it means choosing the same file twice still re-reads it.
  input.value = ''
}

async function onConfirmed(): Promise<void> {
  const action = confirming.value
  confirming.value = null
  if (action === 'replace') await backup.replace()
  else if (action === 'delete') deleted.value = await backup.deleteEverything()
}
</script>

<template>
  <section>
    <h1 class="title is-4">Settings</h1>

    <section class="block" aria-labelledby="settings-about">
      <h2 id="settings-about" class="title is-6">About</h2>
      <p class="mb-2" data-testid="about-mastery">
        Every card has a mastery score out of 100. 80 or more counts as mastered. The score
        increases as you get the card right. Your most recent answers count the most. It decreases
        over time if you do not see the card again.
      </p>
      <p class="has-text-grey" data-testid="app-version">Cardio {{ version }}</p>
    </section>

    <section class="block" aria-labelledby="settings-theme">
      <h2 id="settings-theme" class="title is-6">Theme</h2>
      <div class="buttons has-addons" role="group" aria-labelledby="settings-theme">
        <button
          v-for="option in THEME_PREFERENCES"
          :key="option"
          type="button"
          class="button cardio-action"
          :class="{ 'is-primary': theme.preference === option }"
          :aria-pressed="theme.preference === option"
          :data-testid="`theme-${option}`"
          @click="theme.setPreference(option)"
        >
          {{ themeLabels[option] }}
        </button>
      </div>
      <p>(System uses device's light or dark setting.)</p>
    </section>

    <section class="block" aria-labelledby="settings-storage">
      <h2 id="settings-storage" class="title is-6">Storage</h2>
      <p data-testid="storage-status">
        <template v-if="persistent === null">Checking with the browser…</template>
        <template v-else-if="persistent">
          Storage is persistent: this browser has agreed to keep your cards until you delete them.
        </template>
        <template v-else>
          Your browser may delete your cards if it runs short of space. Be sure to keep an exported
          backup.
        </template>
      </p>
    </section>

    <section class="block" aria-labelledby="settings-backup">
      <h2 id="settings-backup" class="title is-6">Backup</h2>
      <button
        type="button"
        class="button is-primary cardio-action"
        :disabled="backup.busy"
        data-testid="export-backup"
        @click="backup.exportBackup()"
      >
        Create backup
      </button>

      <div class="field mt-4">
        <span id="import-label" class="label is-size-6">Import a backup</span>
        <div class="file has-name is-fullwidth">
          <label class="file-label">
            <input
              id="import-file"
              class="file-input"
              type="file"
              accept="application/json,.json"
              aria-labelledby="import-label"
              :disabled="backup.busy"
              data-testid="import-file"
              @change="onFileChosen"
            />
            <span class="file-cta cardio-action">
              <span class="file-label">Choose a file…</span>
            </span>
            <span class="file-name" data-testid="import-filename">
              {{ backup.filename ?? 'No file chosen' }}
            </span>
          </label>
        </div>
      </div>

      <div v-if="backup.errors.length > 0" class="notification is-danger is-light">
        <p class="mb-2">That file cannot be imported:</p>
        <ul data-testid="import-errors">
          <li v-for="message in backup.errors" :key="message">{{ message }}</li>
        </ul>
      </div>

      <div v-if="backup.pending" class="notification is-info is-light">
        <p data-testid="import-preview">{{ importPreview(backup.pending.counts) }}</p>
        <ul v-if="repairs.length > 0" class="mt-2" data-testid="import-repairs">
          <li v-for="note in repairs" :key="note">{{ note }}</li>
        </ul>
        <div class="buttons mt-3">
          <button
            type="button"
            class="button is-primary cardio-action"
            :disabled="backup.busy"
            data-testid="import-merge"
            @click="backup.merge()"
          >
            Merge
          </button>
          <button
            type="button"
            class="button is-danger cardio-action"
            :disabled="backup.busy"
            data-testid="import-replace"
            @click="confirming = 'replace'"
          >
            Replace everything
          </button>
          <button type="button" class="button cardio-action" @click="backup.discard()">
            Cancel
          </button>
        </div>
      </div>

      <p v-if="backup.report" class="notification is-success is-light" data-testid="import-report">
        <template v-if="backup.report.mode === 'merge'">
          Merged: {{ backup.report.added }} added, {{ backup.report.skipped }} already here.
        </template>
        <template v-else> Replaced everything: {{ backup.report.added }} added. </template>
      </p>

      <p v-if="error" class="notification is-danger is-light" data-testid="backup-error">
        {{ error }}
      </p>
    </section>

    <section v-if="install.hint" class="block" aria-labelledby="settings-install">
      <h2 id="settings-install" class="title is-6">Install</h2>
      <p data-testid="install-hint">
        Cardio runs offline once installed.
        <template v-if="install.hint === 'ios'">Tap Share, then Add to Home Screen.</template>
        <template v-else-if="install.hint === 'macos-safari'">
          Open the File menu and choose Add to Dock.
        </template>
        <template v-else-if="install.hint === 'browser'">
          This browser offers to install it, from its menu or from the address bar.
        </template>
      </p>
    </section>

    <section class="block" aria-labelledby="settings-danger">
      <h2 id="settings-danger" class="title is-6">
        <span class="icon-text is-align-items-center">
          <span>Danger zone</span>
          <span class="icon is-small">
            <!-- Feather "alert-triangle" (feathericons.com), MIT. Inlined for
                 the same reason as the nav's gear: one icon, and nothing may
                 reach the network. -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        </span>
      </h2>
      <p class="mb-2" data-testid="danger-summary">
        {{ storedPrompt(totals) }}
      </p>
      <button
        type="button"
        class="button is-danger cardio-action"
        :disabled="backup.busy"
        data-testid="delete-all"
        @click="confirming = 'delete'"
      >
        Delete all data
      </button>
      <p v-if="deleted" class="notification is-success is-light mt-3" data-testid="delete-report">
        Everything was deleted. Create a folder to start again.
      </p>
    </section>
    <TypedConfirmDialog
      v-if="confirming === 'replace'"
      title="Replace everything?"
      :message="replaceEverythingPrompt(totals)"
      phrase="REPLACE"
      confirm-label="Replace everything"
      @confirm="onConfirmed"
      @cancel="confirming = null"
    />

    <TypedConfirmDialog
      v-if="confirming === 'delete'"
      title="Delete all data?"
      :message="deleteEverythingPrompt(totals)"
      phrase="DELETE"
      confirm-label="Delete everything"
      @confirm="onConfirmed"
      @cancel="confirming = null"
    />
  </section>
</template>
