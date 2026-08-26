import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { UNSORTED_FOLDER_ID } from '@/db'
import { byName } from '@/db/sorting'
import type { Deck, Folder } from '@/domain/models'
import { useErrorSurface } from '@/stores/errors'
import { repositories } from '@/stores/repositories'

/** What deleting a folder would take with it, and what its row shows (§7.1). */
export interface FolderCounts {
  decks: number
  cards: number
}

/**
 * Folders, their decks and the size of each deck: everything the home and folder
 * screens list. The store owns the clock — repositories take `now` as an
 * argument so the domain and the database layer stay deterministic.
 */
export const useLibraryStore = defineStore('library', () => {
  const folders = ref<Folder[]>([])
  const decks = ref<Deck[]>([])
  /** Cards per deck id. Counted at load time rather than per render (§13). */
  const cardCounts = ref<Record<string, number>>({})
  const loading = ref(false)
  const { error, attempt } = useErrorSurface()

  /** One pass over the decks, so a folder list of any length costs one walk. */
  const folderCounts = computed(() => {
    const counts: Record<string, FolderCounts> = {}
    for (const folder of folders.value) {
      counts[folder.id] = { decks: 0, cards: 0 }
    }
    for (const deck of decks.value) {
      const entry = (counts[deck.folderId] ??= { decks: 0, cards: 0 })
      entry.decks += 1
      entry.cards += cardCounts.value[deck.id] ?? 0
    }
    return counts
  })

  function countsFor(folderId: string): FolderCounts {
    return folderCounts.value[folderId] ?? { decks: 0, cards: 0 }
  }

  function decksIn(folderId: string): Deck[] {
    return decks.value.filter((deck) => deck.folderId === folderId)
  }

  function cardCount(deckId: string): number {
    return cardCounts.value[deckId] ?? 0
  }

  function folder(id: string): Folder | undefined {
    return folders.value.find((entry) => entry.id === id)
  }

  function deck(id: string): Deck | undefined {
    return decks.value.find((entry) => entry.id === id)
  }

  /** Unsorted is the one folder the UI must not offer to delete (§4.2). */
  function canDeleteFolder(folderId: string): boolean {
    return folderId !== UNSORTED_FOLDER_ID
  }

  async function load(): Promise<void> {
    loading.value = true
    await attempt(async () => {
      const [folderRows, deckRows] = await Promise.all([
        repositories.folders.list(),
        repositories.decks.list(),
      ])
      const counts: Record<string, number> = {}
      await Promise.all(
        deckRows.map(async (deck) => {
          counts[deck.id] = await repositories.decks.cardCount(deck.id)
        }),
      )
      folders.value = folderRows
      decks.value = deckRows
      cardCounts.value = counts
    })
    loading.value = false
  }

  async function createFolder(name: string): Promise<Folder | undefined> {
    return attempt(async () => {
      const folder = await repositories.folders.create(name, Date.now())
      folders.value = [...folders.value, folder].sort(byName)
      return folder
    })
  }

  async function renameFolder(id: string, name: string): Promise<Folder | undefined> {
    return attempt(async () => {
      const renamed = await repositories.folders.rename(id, name, Date.now())
      folders.value = folders.value
        .map((folder) => (folder.id === id ? renamed : folder))
        .sort(byName)
      return renamed
    })
  }

  /** Cascades in the database (§4.4); this drops the same rows from the state. */
  async function removeFolder(id: string): Promise<void> {
    await attempt(async () => {
      await repositories.folders.remove(id)
      const orphaned = new Set(decksIn(id).map((deck) => deck.id))
      folders.value = folders.value.filter((folder) => folder.id !== id)
      decks.value = decks.value.filter((deck) => deck.folderId !== id)
      cardCounts.value = Object.fromEntries(
        Object.entries(cardCounts.value).filter(([deckId]) => !orphaned.has(deckId)),
      )
    })
  }

  async function createDeck(folderId: string, name: string): Promise<Deck | undefined> {
    return attempt(async () => {
      const created = await repositories.decks.create(folderId, name, Date.now())
      decks.value = [...decks.value, created].sort(byName)
      cardCounts.value = { ...cardCounts.value, [created.id]: 0 }
      return created
    })
  }

  async function renameDeck(id: string, name: string): Promise<Deck | undefined> {
    return attempt(async () => {
      const renamed = await repositories.decks.rename(id, name, Date.now())
      decks.value = decks.value.map((entry) => (entry.id === id ? renamed : entry)).sort(byName)
      return renamed
    })
  }

  /** The deck keeps its cards; only which folder's counts they land in changes. */
  async function moveDeck(id: string, folderId: string): Promise<Deck | undefined> {
    return attempt(async () => {
      const moved = await repositories.decks.move(id, folderId, Date.now())
      decks.value = decks.value.map((entry) => (entry.id === id ? moved : entry)).sort(byName)
      return moved
    })
  }

  /** Cascades to the deck's cards in the database (§4.4). */
  async function removeDeck(id: string): Promise<void> {
    await attempt(async () => {
      await repositories.decks.remove(id)
      decks.value = decks.value.filter((entry) => entry.id !== id)
      cardCounts.value = Object.fromEntries(
        Object.entries(cardCounts.value).filter(([deckId]) => deckId !== id),
      )
    })
  }

  return {
    folders,
    decks,
    loading,
    error,
    countsFor,
    decksIn,
    cardCount,
    canDeleteFolder,
    folder,
    deck,
    load,
    createFolder,
    renameFolder,
    removeFolder,
    createDeck,
    renameDeck,
    moveDeck,
    removeDeck,
  }
})
