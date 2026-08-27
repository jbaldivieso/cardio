import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { combineSummaries, summarise } from '@/domain/aggregates'
import type { MasterySummary } from '@/domain/aggregates'
import type { Card } from '@/domain/models'
import { useErrorSurface } from '@/stores/errors'
import { useLibraryStore } from '@/stores/library'
import { repositories } from '@/stores/repositories'

/**
 * What every bar and badge on screen reads from: one memoised summary per deck
 * (§5.5), rolled up into folders on demand.
 *
 * The memo is the point. Banding a deck means reading all of its cards, which
 * is far too much to do while a row renders (§13), so a deck is read once and
 * kept until something writes to it. Whoever does that write calls
 * `invalidate` — see docs/decisions.md > ADR-032.
 */
export const useMasteryStore = defineStore('mastery', () => {
  const library = useLibraryStore()
  /** Summary per deck id. A missing entry means "not read yet", not "empty". */
  const summaries = ref<Record<string, MasterySummary>>({})
  /** The instant the cards on screen are banded against. */
  const now = ref(Date.now())
  /** Deck ids with a read in flight, so two screens cannot ask for one twice. */
  const reading = new Set<string>()
  /** Deck ids a write dropped while their read was still in flight (ADR-032). */
  const dropped = new Set<string>()
  const { error, attempt } = useErrorSurface()

  /**
   * Every folder's roll-up, in one pass over the decks, so a screenful of
   * folders costs one walk rather than one per row (§13).
   *
   * A folder whose decks have not all been read has no number yet: showing the
   * sum of the decks that happen to be loaded would put a figure on screen that
   * is wrong rather than merely late.
   */
  const folderSummaries = computed(() => {
    const parts: Record<string, MasterySummary[] | null> = {}
    for (const folder of library.folders) parts[folder.id] = []
    for (const deck of library.decks) {
      const part = parts[deck.folderId]
      if (part === undefined || part === null) continue
      const known = summaries.value[deck.id]
      if (known) part.push(known)
      else parts[deck.folderId] = null
    }
    return Object.fromEntries(
      Object.entries(parts).map(([folderId, part]) => [
        folderId,
        part === null ? undefined : combineSummaries(part),
      ]),
    )
  })

  function deckSummary(deckId: string): MasterySummary | undefined {
    return summaries.value[deckId]
  }

  function folderSummary(folderId: string): MasterySummary | undefined {
    return folderSummaries.value[folderId]
  }

  /** Re-reads the wall clock, so a screen bands its cards as it opens. */
  function tick(): void {
    now.value = Date.now()
  }

  /**
   * Summarises whichever of these decks has no summary yet, in one read. Decks
   * already known are left exactly as they are, cached object and all.
   */
  async function ensure(deckIds: string[]): Promise<void> {
    const missing = deckIds.filter((id) => !(id in summaries.value) && !reading.has(id))
    if (missing.length === 0) return

    missing.forEach((id) => reading.add(id))
    tick()
    try {
      await attempt(async () => {
        const cards = await repositories.cards.listByDecks(missing)
        // Seeded with every deck asked for, so a deck with no cards is summarised
        // as empty rather than left looking unread.
        const byDeck = new Map<string, Card[]>(missing.map((id) => [id, []]))
        for (const card of cards) byDeck.get(card.deckId)?.push(card)
        const next = { ...summaries.value }
        // A deck written to since this read began was read as it used to be, so
        // its summary is left unknown and the next `ensure` reads it again.
        for (const [id, deckCards] of byDeck) {
          if (dropped.has(id)) continue
          next[id] = summarise(deckCards, now.value)
        }
        summaries.value = next
      })
    } finally {
      // Cleared either way: a read that failed has to be allowed to happen again.
      missing.forEach((id) => {
        reading.delete(id)
        dropped.delete(id)
      })
    }
  }

  /**
   * Drops one deck's summary, because something has written to it — a card
   * added, edited or deleted, or a quiz answer recorded. The next `ensure`
   * reads that deck again and no other.
   */
  function invalidate(deckId: string): void {
    // A read in flight is about to write a summary that predates this write,
    // and there is no entry yet for the drop below to remove. Mark it instead,
    // so that read throws its result away rather than caching what is now old.
    if (reading.has(deckId)) dropped.add(deckId)
    if (!(deckId in summaries.value)) return
    summaries.value = Object.fromEntries(
      Object.entries(summaries.value).filter(([id]) => id !== deckId),
    )
  }

  return { now, error, deckSummary, folderSummary, ensure, invalidate, tick }
})
