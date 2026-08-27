import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { THEME_KEY, useThemeStore } from '@/stores/theme'

/** A `matchMedia` whose result the test controls, and can change under the app. */
function stubMatchMedia(dark: boolean): (next: boolean) => void {
  let matches = dark
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('dark') ? matches : false
    },
    media: query,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  }))
  return (next: boolean) => {
    matches = next
    for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent)
  }
}

function theme(): string | undefined {
  return document.documentElement.dataset.theme
}

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.theme
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('the stored preference', () => {
    it('follows the system by default', () => {
      expect(useThemeStore().preference).toBe('system')
    })

    it('opens on the choice the last visit stored', () => {
      localStorage.setItem(THEME_KEY, 'dark')

      expect(useThemeStore().preference).toBe('dark')
    })

    it('falls back to following the system when the stored value is not a theme', () => {
      localStorage.setItem(THEME_KEY, 'aubergine')

      expect(useThemeStore().preference).toBe('system')
    })

    it('falls back to following the system when storage cannot be read at all', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })

      expect(useThemeStore().preference).toBe('system')
    })
  })

  describe('choosing a theme', () => {
    it('applies the choice to the document immediately', async () => {
      const store = useThemeStore()

      store.setPreference('dark')
      await nextTick()

      expect(theme()).toBe('dark')
    })

    it('remembers the choice for the next visit', () => {
      useThemeStore().setPreference('light')

      expect(localStorage.getItem(THEME_KEY)).toBe('light')
    })

    it('keeps working when the browser refuses to store the choice', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      const store = useThemeStore()

      store.setPreference('dark')
      await nextTick()

      expect(store.preference).toBe('dark')
      expect(theme()).toBe('dark')
    })
  })

  describe('following the system', () => {
    it('resolves to dark when the system is dark', async () => {
      stubMatchMedia(true)

      useThemeStore()
      await nextTick()

      expect(theme()).toBe('dark')
    })

    it('resolves to light when the system is light', async () => {
      useThemeStore()
      await nextTick()

      expect(theme()).toBe('light')
    })

    it('flips with the system while the preference is to follow it', async () => {
      const setSystemDark = stubMatchMedia(false)
      useThemeStore()
      await nextTick()

      setSystemDark(true)
      await nextTick()

      expect(theme()).toBe('dark')
    })

    it('ignores the system once a theme has been chosen', async () => {
      const setSystemDark = stubMatchMedia(false)
      const store = useThemeStore()
      store.setPreference('light')
      await nextTick()

      setSystemDark(true)
      await nextTick()

      expect(theme()).toBe('light')
      expect(store.resolved).toBe('light')
    })

    it('follows the system again when the preference goes back to it', async () => {
      stubMatchMedia(true)
      const store = useThemeStore()
      store.setPreference('light')
      await nextTick()

      store.setPreference('system')
      await nextTick()

      expect(theme()).toBe('dark')
    })

    it('treats a browser without matchMedia as a light one', async () => {
      vi.stubGlobal('matchMedia', undefined)

      useThemeStore()
      await nextTick()

      expect(theme()).toBe('light')
    })
  })
})
