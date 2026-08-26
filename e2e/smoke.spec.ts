import { expect, test } from '@playwright/test'

// The full happy path lives in e2e/happy-path.spec.ts once the features exist
// (see .claude/plans/12-e2e-happy-path.md). This only proves the shell boots.
test('app shell loads and routes', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByTestId('brand')).toHaveText('Cardio')

  await page.getByTestId('nav-settings').click()
  await expect(page).toHaveURL(/#\/settings$/)
  await expect(page.getByTestId('placeholder')).toContainText('Settings')
})
