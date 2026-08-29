import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * The one end-to-end journey of spec §14: a folder, a deck, three cards, a
 * quiz, and the mastery that quiz leaves behind. Happy path only — every
 * refusal, empty state and edge case is covered by the unit and component
 * suites, which do not need a browser to say so.
 */

/** What bulk add is given, one line each, on its default pipe separator (§9). */
const CARDS = [
  { front: 'hablar', back: 'to speak' },
  { front: 'comer', back: 'to eat' },
  { front: 'vivir', back: 'to live' },
]

/**
 * A card answered once scores `100 × accuracy × 1/5 exposure`, and it was seen
 * seconds ago, so staleness is still 1: a get is 20 and a miss is 0 (§5.2).
 */
const SCORES_AFTER_ONE_QUIZ = ['0%', '20%', '20%']

/** The text of every match, trimmed and ordered, so a list can be compared. */
async function textsOf(page: Page, testId: string): Promise<string[]> {
  const texts = await page.getByTestId(testId).allInnerTexts()
  return texts.map((text) => text.trim()).sort()
}

test('creates a library, quizzes a deck and sees its mastery move', async ({ page }) => {
  const deckRow = page.getByTestId('deck-row')
  const progress = page.getByTestId('quiz-progress-count')

  /** Reveals the answer of whichever card is up, then grades it (§7.6). */
  async function flipAndGrade(got: boolean): Promise<void> {
    await page.getByTestId('quiz-card').click()
    await expect(page.getByTestId('quiz-grading')).toBeVisible()
    await page.getByTestId(got ? 'quiz-got' : 'quiz-missed').click()
  }

  await test.step('opens on the splash a first visit gets', async () => {
    await page.goto('./')
    await expect(page.getByTestId('library-splash')).toContainText('Cardio')
    await expect(page.getByTestId('folder-row')).toHaveCount(0)
  })

  await test.step('creates the folder Spanish from the splash and lands inside it', async () => {
    await page.getByTestId('splash-create').click()
    await page.getByTestId('name-input').fill('Spanish')
    await page.getByTestId('name-save').click()

    // A new folder opens on creation, holding nothing yet (ADR-056).
    await expect(page).toHaveURL(/#\/folders\//)
    await expect(page.getByRole('heading', { name: 'Spanish' })).toBeVisible()
    await expect(page.getByTestId('decks-empty')).toBeVisible()
  })

  await test.step('shows the folder in the list the splash gave way to', async () => {
    await page.getByTestId('breadcrumb-home').click()
    await expect(page.getByTestId('library-splash')).toBeHidden()
    await expect(page.getByTestId('folder-row')).toHaveCount(1)

    await page.getByRole('link', { name: 'Spanish' }).click()
    await expect(page).toHaveURL(/#\/folders\//)
  })

  await test.step('creates the deck Verbs inside it and lands inside that', async () => {
    await page.getByTestId('new-deck').click()
    await page.getByTestId('name-input').fill('Verbs')
    await page.getByTestId('name-save').click()

    // A new deck opens too, on the screen its cards are added from (ADR-056).
    await expect(page).toHaveURL(/#\/decks\//)
    await expect(page.getByRole('heading', { name: 'Verbs' })).toBeVisible()
    await expect(page.getByTestId('cards-empty')).toBeVisible()
  })

  await test.step('bulk-adds three cards', async () => {
    await page.getByTestId('bulk-add').click()
    await page.getByTestId('bulk-text').fill(CARDS.map((c) => `${c.front}|${c.back}`).join('\n'))
    await expect(page.getByTestId('bulk-summary')).toHaveText('3 cards ready, 0 lines skipped')
    await page.getByTestId('bulk-import').click()

    await expect(page.getByTestId('bulk-dialog')).toBeHidden()
    await expect(page.getByTestId('card-row')).toHaveCount(3)
    // Cards created in one batch share a timestamp, so the list has no order
    // worth asserting — only its contents.
    await expect.poll(() => textsOf(page, 'card-row-front')).toEqual(['comer', 'hablar', 'vivir'])
    await expect(page.getByTestId('mastery-badge')).toHaveText(['new', 'new', 'new'])
  })

  await test.step('shows the deck as three untried cards', async () => {
    await page.getByTestId('breadcrumb').getByRole('link', { name: 'Spanish' }).click()

    await expect(deckRow.getByTestId('deck-count')).toHaveText('3 cards')
    await expect(deckRow.getByTestId('mastery-headline')).toHaveText('0% mastered')
    await expect(deckRow.getByTestId('mastery-track')).toHaveAttribute(
      'aria-label',
      '0% mastered, 0 learning, 3 new',
    )
  })

  let missedFront = ''

  await test.step('quickstarts a quiz and answers all three cards', async () => {
    await deckRow.getByTestId('deck-quiz').click()
    await expect(page).toHaveURL(/#\/quiz\/run$/)

    // The queue is shuffled, so the path grades whatever comes up and reads the
    // last prompt back rather than assuming which card it is.
    await expect(progress).toHaveText('1 / 3')
    await flipAndGrade(true)
    await expect(progress).toHaveText('2 / 3')
    await flipAndGrade(true)
    await expect(progress).toHaveText('3 / 3')

    missedFront = (await page.getByTestId('quiz-prompt').innerText()).trim()
    await flipAndGrade(false)
  })

  await test.step('summarises the session as two got and one missed', async () => {
    await expect(page).toHaveURL(/#\/quiz\/summary$/)
    await expect(page.getByTestId('summary-answered')).toHaveText('3')
    await expect(page.getByTestId('summary-got')).toHaveText('2')
    await expect(page.getByTestId('summary-missed')).toHaveText('1')
    await expect(page.getByTestId('summary-accuracy')).toHaveText('67%')
    await expect(page.getByTestId('summary-missed-card')).toHaveText(missedFront)
  })

  await test.step('returns to a deck whose mastery has moved', async () => {
    await page.getByTestId('summary-done').click()
    await expect(page).toHaveURL(/#\/folders\//)

    // Nothing is mastered on one answer, but nothing is untried any more.
    await expect(deckRow.getByTestId('mastery-track')).toHaveAttribute(
      'aria-label',
      '0% mastered, 3 learning, 0 new',
    )

    await deckRow.getByTestId('deck-link').click()
    await expect(page.getByTestId('mastery-badge')).toHaveCount(3)
    await expect.poll(() => textsOf(page, 'mastery-badge')).toEqual(SCORES_AFTER_ONE_QUIZ)
  })
})
