import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

/** What the user chose (spec §11). `system` is the default. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** What that choice comes out as on `<html data-theme>`, which Bulma reads. */
export type ResolvedTheme = 'light' | 'dark'

/** Where the choice lives between visits (§11). */
export const THEME_KEY = 'cardio.theme'

/** In the order the settings screen offers them. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isPreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
}

/**
 * The stored choice, or `system`. Anything else in that key — a value from a
 * future version, a half-written string, a browser that refuses storage — is a
 * missing preference rather than an error to show.
 */
function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function darkMediaQuery(): MediaQueryList | null {
  try {
    return globalThis.matchMedia?.(DARK_QUERY) ?? null
  } catch {
    return null
  }
}

/**
 * The theme, from the preference in `localStorage` to the `data-theme` attribute
 * Bulma switches on (§11).
 *
 * `index.html` applies the same rule before first paint so there is no flash of
 * the wrong palette; from the first tick onwards this store owns the attribute,
 * and the two must keep agreeing. A browser that cannot say what the system
 * prefers is treated as a light one, exactly as that script treats it.
 */
export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readPreference())
  const query = darkMediaQuery()
  const systemDark = ref(query?.matches ?? false)

  // Never removed: the store lives as long as the app does, and §11 asks the
  // theme to keep following the system while the preference says to.
  query?.addEventListener?.('change', (event: MediaQueryListEvent) => {
    systemDark.value = event.matches
  })

  const resolved = computed<ResolvedTheme>(() => {
    if (preference.value === 'system') return systemDark.value ? 'dark' : 'light'
    return preference.value
  })

  watchEffect(() => {
    document.documentElement.dataset.theme = resolved.value
  })

  function setPreference(next: ThemePreference): void {
    preference.value = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Remembering the theme is a convenience; a blocked or full store must
      // not stop this visit from honouring the choice.
    }
  }

  return { preference, resolved, setPreference }
})
