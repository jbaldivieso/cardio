import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Which set of install instructions is worth showing (spec §7.8, §12); `null`
 * for none.
 *
 * `browser` is offered only once the browser has said the app is installable.
 * `ios` and `macos-safari` cover the two places installing works with no such
 * event: the iOS Share sheet and Safari's File > Add to Dock.
 */
export type InstallHint = 'browser' | 'ios' | 'macos-safari'

const STANDALONE_QUERY = '(display-mode: standalone)'

/** Apps whose embedded web view reports iOS but shows no browser chrome. */
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|GSA\/|Line\/|MicroMessenger|Twitter|Snapchat/

/** The first Safari with File > Add to Dock. */
const SAFARI_WITH_DOCK = 17

/**
 * Whether this is a full browser on an iPhone or an iPad — one with the Share
 * sheet that Add to Home Screen lives in.
 *
 * Two things are being excluded. A web view embedded in another app carries an
 * iOS user agent but no browser chrome, and it is named either by the host app
 * or by the absence of `Safari/`. And iPadOS 13 and later report the desktop Mac
 * user agent, so the only thing separating an iPad from a Mac is the touch
 * screen.
 */
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  if (IN_APP_BROWSER.test(userAgent) || !userAgent.includes('Safari/')) return false
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  return userAgent.includes('Macintosh') && maxTouchPoints > 1
}

/**
 * Whether this is a macOS Safari new enough for File > Add to Dock.
 *
 * Safari fires no `beforeinstallprompt`, so without this the one desktop
 * browser that installs the app outside Chrome's family would be told nothing.
 * An iPad reports the same user agent and belongs to `isIosBrowser`, so the
 * touch screen rules it out first.
 */
export function isMacSafariWithDock(userAgent: string, maxTouchPoints: number): boolean {
  if (maxTouchPoints > 1 || !userAgent.includes('Macintosh')) return false
  if (!userAgent.includes('Safari/') || /Chrome\/|Chromium|Edg\/|OPR\//.test(userAgent)) {
    return false
  }
  const version = /Version\/(\d+)/.exec(userAgent)
  return version !== null && Number(version[1]) >= SAFARI_WITH_DOCK
}

/** Whether the app is being used from the home screen rather than a tab. */
function isStandalone(): boolean {
  // iOS before 16.4 answers this and not the media query.
  const legacy = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined
  if (legacy?.standalone === true) return true
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
  const userAgent = globalThis.navigator?.userAgent ?? ''
  const touchPoints = globalThis.navigator?.maxTouchPoints ?? 0
  const ios = isIosBrowser(userAgent, touchPoints)
  const macSafari = isMacSafariWithDock(userAgent, touchPoints)

  // Never removed: the store lives as long as the app does.
  globalThis.addEventListener?.('beforeinstallprompt', () => {
    promptable.value = true
  })
  globalThis.addEventListener?.('appinstalled', () => {
    installed.value = true
  })

  const hint = computed<InstallHint | null>(() => {
    if (installed.value) return null
    if (promptable.value) return 'browser'
    if (ios) return 'ios'
    if (macSafari) return 'macos-safari'
    // Anywhere else — a desktop Firefox, a Chrome that has not offered — there
    // is no affordance to point at, so instructions would only mislead.
    return null
  })

  return { hint }
})
