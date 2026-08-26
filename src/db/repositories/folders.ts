import { db, UNSORTED_FOLDER_ID } from '@/db'
import type { CardioDb } from '@/db'
import { durableWrite } from '@/db/persistence'
import { byName } from '@/db/sorting'
import type { Folder } from '@/domain/models'
import { validateName, ValidationError } from '@/domain/validation'

/** What deleting a folder would take with it — the counts the confirm dialog names (§4.4). */
export interface FolderContents {
  decks: number
  cards: number
}

export interface FolderRepo {
  list(): Promise<Folder[]>
  get(id: string): Promise<Folder | undefined>
  create(name: string, now: number): Promise<Folder>
  rename(id: string, name: string, now: number): Promise<Folder>
  /** Hard, cascading delete (§4.4). Silent when the folder is already gone. */
  remove(id: string): Promise<void>
  contents(id: string): Promise<FolderContents>
}

export function createFolderRepo(database: CardioDb = db): FolderRepo {
  return {
    async list(): Promise<Folder[]> {
      return (await database.folders.toArray()).sort(byName)
    },

    get(id: string): Promise<Folder | undefined> {
      return database.folders.get(id)
    },

    async create(name: string, now: number): Promise<Folder> {
      const folder: Folder = {
        id: crypto.randomUUID(),
        name: validateName(name),
        createdAt: now,
        updatedAt: now,
      }
      await durableWrite(database, () => database.folders.add(folder))
      return folder
    },

    async rename(id: string, name: string, now: number): Promise<Folder> {
      const validated = validateName(name)
      return durableWrite(database, () =>
        database.transaction('rw', database.folders, async () => {
          const folder = await database.folders.get(id)
          if (!folder) throw new ValidationError('id', 'That folder no longer exists.')
          const renamed: Folder = { ...folder, name: validated, updatedAt: now }
          await database.folders.put(renamed)
          return renamed
        }),
      )
    },

    async remove(id: string): Promise<void> {
      if (id === UNSORTED_FOLDER_ID) {
        throw new ValidationError('id', 'The Unsorted folder cannot be deleted.')
      }
      await durableWrite(database, () =>
        database.transaction('rw', database.folders, database.decks, database.cards, async () => {
          const deckIds = await database.decks.where('folderId').equals(id).primaryKeys()
          await database.cards.where('deckId').anyOf(deckIds).delete()
          await database.decks.bulkDelete(deckIds)
          await database.folders.delete(id)
        }),
      )
    },

    async contents(id: string): Promise<FolderContents> {
      const deckIds = await database.decks.where('folderId').equals(id).primaryKeys()
      const cards = await database.cards.where('deckId').anyOf(deckIds).count()
      return { decks: deckIds.length, cards }
    },
  }
}

/** The repository the app uses; tests build their own against a throwaway database. */
export const folderRepo = createFolderRepo()
