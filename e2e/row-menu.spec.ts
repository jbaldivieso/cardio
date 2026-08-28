import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * A row's overflow menu opens onto the screen, at both viewports the suite
 * runs (§7.1, §7.2). This needs a browser: the panel's position comes from
 * Bulma's stylesheet and the width of a name rendered in the app's own font,
 * neither of which a component test in jsdom has.
 *
 * The regression it guards: the trigger sits immediately after the row's name,
 * so its left edge moves with the name's length. Bulma pins an open panel to
 * that left edge, which put the panel's right edge past a 393 px viewport for a
 * name of a dozen or so characters — part of the menu unreachable, and the page
 * scrolling sideways (ADR-053).
 */

/** A name long enough that its trigger lands in the right-hand third of a phone row. */
const LONG_NAME = 'Kitchen Vocabulary'

/** A name short enough that its trigger stays hard left, the other end of the range. */
const SHORT_NAME = 'Verbs'

/** The panel is on screen, and opening it has not widened the document. */
async function expectPanelOnScreen(page: Page, panel: Locator): Promise<void> {
  await expect(panel).toBeVisible()

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const box = await panel.boundingBox()
  expect(box).not.toBeNull()

  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)

  // The panel is positioned, so one hanging off the right edge is not clipped:
  // it lengthens the page and takes a horizontal scrollbar with it.
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth)
}

test('opens a row overflow menu onto the screen, whatever the row is called', async ({ page }) => {
  await test.step('opens a folder row menu beside a long name', async () => {
    await page.goto('./')
    await page.getByTestId('splash-create').click()
    await page.getByTestId('name-input').fill(LONG_NAME)
    await page.getByTestId('name-save').click()
    await expect(page.getByRole('link', { name: LONG_NAME })).toBeVisible()

    await page.getByTestId('folder-menu').click()
    await expectPanelOnScreen(page, page.getByTestId('folder-menu-panel'))
    await expect(page.getByTestId('folder-rename')).toBeVisible()
    await expect(page.getByTestId('folder-delete')).toBeVisible()
  })

  await test.step('opens a deck row menu beside a long name', async () => {
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: LONG_NAME }).click()

    for (const name of [LONG_NAME, SHORT_NAME]) {
      await page.getByTestId('new-deck').click()
      await page.getByTestId('name-input').fill(name)
      await page.getByTestId('name-save').click()
      await expect(page.getByRole('link', { name })).toBeVisible()
    }

    const row = page.getByTestId('deck-row').filter({ hasText: LONG_NAME })
    await row.getByTestId('deck-menu').click()
    await expectPanelOnScreen(page, row.getByTestId('deck-menu-panel'))
    await expect(row.getByTestId('deck-rename')).toBeVisible()
    await expect(row.getByTestId('deck-delete')).toBeVisible()
  })

  await test.step('opens a deck row menu beside a short one, the other end of the range', async () => {
    await page.keyboard.press('Escape')

    const row = page.getByTestId('deck-row').filter({ hasText: SHORT_NAME })
    await row.getByTestId('deck-menu').click()
    await expectPanelOnScreen(page, row.getByTestId('deck-menu-panel'))
  })
})
