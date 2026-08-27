import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isIosBrowser, isMacSafariWithDock, useInstallStore } from '@/stores/install'

describe('isIosBrowser', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  // iPadOS 13 and later claim to be a desktop Mac; only the touch points differ.
  const IPAD =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
  const CHROME_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1'
  const INSTAGRAM =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 295.0.0.27.109'
  const WEBVIEW =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

  it('recognises an iPhone', () => {
    expect(isIosBrowser(IPHONE, 5)).toBe(true)
  })

  it('recognises an iPad claiming to be a Mac', () => {
    expect(isIosBrowser(IPAD, 5)).toBe(true)
  })

  it('does not mistake a Mac for an iPad', () => {
    expect(isIosBrowser(IPAD, 0)).toBe(false)
  })

  it('does not mistake an Android phone for an iPhone', () => {
    expect(isIosBrowser(ANDROID, 5)).toBe(false)
  })

  it('recognises Chrome on iOS, which has the same Share sheet', () => {
    expect(isIosBrowser(CHROME_IOS, 5)).toBe(true)
  })

  // An app that embeds a web view reports iOS but offers no Share sheet, so
  // Add to Home Screen is not a thing its user can do (ADR-045).
  it('does not offer the Share sheet inside an in-app browser', () => {
    expect(isIosBrowser(INSTAGRAM, 5)).toBe(false)
  })

  it('does not offer the Share sheet inside a bare web view', () => {
    expect(isIosBrowser(WEBVIEW, 5)).toBe(false)
  })
})

describe('isMacSafariWithDock', () => {
  const SAFARI_17 =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const SAFARI_16 =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
  const CHROME_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

  it('recognises the Safari that has Add to Dock', () => {
    expect(isMacSafariWithDock(SAFARI_17, 0)).toBe(true)
  })

  it('says no to the Safari before Add to Dock existed', () => {
    expect(isMacSafariWithDock(SAFARI_16, 0)).toBe(false)
  })

  it('does not mistake Chrome on a Mac for Safari', () => {
    expect(isMacSafariWithDock(CHROME_MAC, 0)).toBe(false)
  })

  it('leaves an iPad to the iOS branch', () => {
    expect(isMacSafariWithDock(SAFARI_17, 5)).toBe(false)
  })
})

describe('useInstallStore', () => {
  /** A `matchMedia` that answers whichever queries the test says match. */
  function stubMatchMedia(matching: string[] = []): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matching.some((entry) => query.includes(entry)),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
  }

  function stubNavigator(userAgent: string, maxTouchPoints = 0, standalone?: boolean): void {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints, standalone })
  }

  const CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const MAC_SAFARI =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

  beforeEach(() => {
    setActivePinia(createPinia())
    stubMatchMedia()
    stubNavigator(FIREFOX)
  })

  // `stubGlobal` outlives `restoreMocks`, so a navigator left in place would
  // reach every test added to this file afterwards.
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('points at the browser menu once the browser offers to install the app', () => {
    stubNavigator(CHROME)
    const install = useInstallStore()

    globalThis.dispatchEvent(new Event('beforeinstallprompt'))

    expect(install.hint).toBe('browser')
  })

  it('points an iPhone at Add to Home Screen, which fires no such event', () => {
    stubNavigator(IPHONE, 5)

    expect(useInstallStore().hint).toBe('ios')
  })

  it('points macOS Safari at Add to Dock, which fires no such event either', () => {
    stubNavigator(MAC_SAFARI)

    expect(useInstallStore().hint).toBe('macos-safari')
  })

  it('says nothing in a browser that cannot install it', () => {
    expect(useInstallStore().hint).toBe(null)
  })

  // iOS before 16.4 answers `navigator.standalone` and nothing else, and the
  // iOS branch has no event to correct it with.
  it('says nothing to an iPhone already on the home screen', () => {
    stubNavigator(IPHONE, 5, true)

    expect(useInstallStore().hint).toBe(null)
  })

  it('says nothing when the app is already running installed', () => {
    stubMatchMedia(['display-mode: standalone'])
    stubNavigator(CHROME)
    const install = useInstallStore()

    globalThis.dispatchEvent(new Event('beforeinstallprompt'))

    expect(install.hint).toBe(null)
  })

  it('stops hinting the moment the browser installs it', () => {
    stubNavigator(CHROME)
    const install = useInstallStore()
    globalThis.dispatchEvent(new Event('beforeinstallprompt'))

    globalThis.dispatchEvent(new Event('appinstalled'))

    expect(install.hint).toBe(null)
  })
})
