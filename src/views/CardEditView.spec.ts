import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { FACE_MAX_LENGTH } from '@/domain/validation'
import { routes } from '@/router'
import { repositories } from '@/stores/repositories'
import { useTestDatabase } from '@/test/repositories'

describe('CardEditView', () => {
  useTestDatabase()
  let router: Router
  let deckId: string

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes })
    const folder = await repositories.folders.create('Spanish', 1000)
    deckId = (await repositories.decks.create(folder.id, 'Verbs', 1000)).id
  })

  /**
   * Mounted through a RouterView at its real route: the editor's unsaved-changes
   * guard is a route guard, so it only exists on a screen the router rendered.
   */
  async function mountEditor(where: { deckId?: string; cardId?: string }): Promise<VueWrapper> {
    const host = defineComponent({ render: () => h(RouterView) })
    await router.push(
      where.cardId ? `/cards/${where.cardId}/edit` : `/decks/${where.deckId}/cards/new`,
    )
    await router.isReady()
    const wrapper = mount(host, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  async function type(wrapper: VueWrapper, front: string, back: string) {
    await wrapper.get('[data-testid="card-front"]').setValue(front)
    await wrapper.get('[data-testid="card-back"]').setValue(back)
  }

  function saveButton(wrapper: VueWrapper) {
    return wrapper.get('[data-testid="card-save"]')
  }

  describe('creating', () => {
    it('cannot save while both faces are empty', async () => {
      const wrapper = await mountEditor({ deckId })

      expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('cannot save while only the front is filled in', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', '   ')

      expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('cannot save a face longer than the limit', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'x'.repeat(FACE_MAX_LENGTH + 1), 'to be')

      expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('can save once both faces have content', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')

      expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    })

    it('previews each face as it is typed', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, '**ser**', '_to be_')

      expect(wrapper.get('[data-testid="card-front-preview"]').html()).toContain(
        '<strong>ser</strong>',
      )
      expect(wrapper.get('[data-testid="card-back-preview"]').html()).toContain('<em>to be</em>')
    })

    it('counts the characters of each face', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')

      expect(wrapper.get('[data-testid="card-front-count"]').text()).toContain(
        `3 / ${FACE_MAX_LENGTH}`,
      )
    })

    it('counts what will be stored, ignoring surrounding whitespace', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, '  ser  ', 'to be')

      expect(wrapper.get('[data-testid="card-front-count"]').text()).toContain(
        `3 / ${FACE_MAX_LENGTH}`,
      )
    })

    it('keeps Save enabled and the counter within the limit for a padded face', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, `${'x'.repeat(FACE_MAX_LENGTH)}   `, 'to be')

      expect(wrapper.get('[data-testid="card-front-count"]').text()).toContain(
        `${FACE_MAX_LENGTH} / ${FACE_MAX_LENGTH}`,
      )
      expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    })

    it('saves the card and goes back to the deck', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')
      await saveButton(wrapper).trigger('click')

      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('deck'))
      expect(await repositories.cards.listByDeck(deckId)).toHaveLength(1)
    })

    it('clears the fields and stays put for the next card', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')
      await wrapper.get('[data-testid="card-save-another"]').trigger('click')

      await vi.waitFor(async () =>
        expect(await repositories.cards.listByDeck(deckId)).toHaveLength(1),
      )
      expect((wrapper.get('[data-testid="card-front"]').element as HTMLTextAreaElement).value).toBe(
        '',
      )
      expect(router.currentRoute.value.name).not.toBe('deck')
    })
  })

  describe('editing', () => {
    it('starts from the stored faces', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)

      const wrapper = await mountEditor({ cardId: card.id })

      expect((wrapper.get('[data-testid="card-front"]').element as HTMLTextAreaElement).value).toBe(
        'ser',
      )
    })

    it('saves the edit and goes back to the deck', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      const wrapper = await mountEditor({ cardId: card.id })

      await type(wrapper, 'ser', 'to be, permanently')
      await saveButton(wrapper).trigger('click')

      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('deck'))
      expect((await repositories.cards.get(card.id))?.back).toBe('to be, permanently')
    })

    it('offers no "save and add another" when editing', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)

      const wrapper = await mountEditor({ cardId: card.id })

      expect(wrapper.find('[data-testid="card-save-another"]').exists()).toBe(false)
    })

    it('says so, rather than crashing, when the card does not exist', async () => {
      const wrapper = await mountEditor({ cardId: 'missing' })

      expect(wrapper.get('[data-testid="card-missing"]').text()).toContain('card')
    })

    it('reports a failed read as an error, not as a missing card', async () => {
      const card = await repositories.cards.create(deckId, { front: 'ser', back: 'to be' }, 1000)
      vi.spyOn(repositories.cards, 'get').mockRejectedValueOnce(new Error('The database is gone.'))

      const wrapper = await mountEditor({ cardId: card.id })

      expect(wrapper.get('[data-testid="card-error"]').text()).toBe('The database is gone.')
      expect(wrapper.find('[data-testid="card-missing"]').exists()).toBe(false)
    })
  })

  describe('leaving', () => {
    it('asks before throwing away unsaved changes', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')
      await wrapper.get('[data-testid="card-cancel"]').trigger('click')

      expect(wrapper.get('[data-testid="confirm-message"]').text()).toContain('unsaved')
      expect(router.currentRoute.value.name).not.toBe('deck')
    })

    it('leaves once the discard is confirmed', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')
      await wrapper.get('[data-testid="card-cancel"]').trigger('click')
      await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('deck'))
      expect(await repositories.cards.listByDeck(deckId)).toEqual([])
    })

    it('stays when the discard is dismissed', async () => {
      const wrapper = await mountEditor({ deckId })

      await type(wrapper, 'ser', 'to be')
      await wrapper.get('[data-testid="card-cancel"]').trigger('click')
      await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

      expect(router.currentRoute.value.name).not.toBe('deck')
      expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
    })

    it('leaves straight away when nothing was typed', async () => {
      const wrapper = await mountEditor({ deckId })

      await wrapper.get('[data-testid="card-cancel"]').trigger('click')

      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('deck'))
    })
  })
})
