import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isIosBrowser, useInstallStore } from '@/stores/install'

describe('isIosBrowser', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  // iPadOS 13 and later claim to be a desktop Mac; only the touch points differ.
  const IPAD =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

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

  function stubNavigator(userAgent: string, maxTouchPoints = 0): void {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints })
  }

  const CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

  beforeEach(() => {
    setActivePinia(createPinia())
    stubMatchMedia()
    stubNavigator(FIREFOX)
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

  it('says nothing in a browser that cannot install it', () => {
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
