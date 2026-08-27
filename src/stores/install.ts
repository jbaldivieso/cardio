import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Which set of install instructions is worth showing, or `null` for none
 * (spec §7.8, §12).
 *
 * `browser` is offered only once the browser has said the app is installable;
 * `ios` covers Safari on iOS, which installs from the Share sheet and fires no
 * such event.
 */
export type InstallHint = 'browser' | 'ios' | null

const STANDALONE_QUERY = '(display-mode: standalone)'

/**
 * Whether this is Safari on an iPhone or an iPad.
 *
 * iPadOS 13 and later report the desktop Mac user agent, so the only thing
 * separating an iPad from a Mac is that the iPad has a touch screen.
 */
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  return userAgent.includes('Macintosh') && maxTouchPoints > 1
}

/** Whether the app is being used from the home screen rather than a tab. */
function isStandalone(): boolean {
  try {
    return globalThis.matchMedia?.(STANDALONE_QUERY).matches ?? false
  } catch {
    return false
  }
}

/**
 * Whether this browser can install the app, and how it is done (§7.8).
 *
 * Created at boot in `main.ts`, not on the settings screen: `beforeinstallprompt`
 * fires once, moments after load, long before anyone opens Settings. The event is
 * only listened for, never deferred — `preventDefault()` would suppress the
 * browser's own install affordance, which is the very thing the hint points at.
 */
export const useInstallStore = defineStore('install', () => {
  const installed = ref(isStandalone())
  const promptable = ref(false)
  const ios = isIosBrowser(
    globalThis.navigator?.userAgent ?? '',
    globalThis.navigator?.maxTouchPoints ?? 0,
  )

  // Never removed: the store lives as long as the app does.
  globalThis.addEventListener?.('beforeinstallprompt', () => {
    promptable.value = true
  })
  globalThis.addEventListener?.('appinstalled', () => {
    installed.value = true
  })

  const hint = computed<InstallHint>(() => {
    if (installed.value) return null
    if (promptable.value) return 'browser'
    // Anywhere else — a desktop Firefox, a Chrome that has not offered — there
    // is no menu item to point at, so instructions would only mislead.
    return ios ? 'ios' : null
  })

  return { hint }
})
