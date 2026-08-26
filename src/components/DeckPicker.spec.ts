import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import DeckPicker from '@/components/DeckPicker.vue'
import type { Deck, Folder } from '@/domain/models'

describe('DeckPicker', () => {
  const spanish: Folder = { id: 'f-1', name: 'Spanish', createdAt: 1, updatedAt: 1 }
  const german: Folder = { id: 'f-2', name: 'German', createdAt: 1, updatedAt: 1 }

  const decks: Deck[] = [
    { id: 'd-1', folderId: 'f-1', name: 'Verbs', createdAt: 1, updatedAt: 1 },
    { id: 'd-2', folderId: 'f-1', name: 'Nouns', createdAt: 1, updatedAt: 1 },
    { id: 'd-3', folderId: 'f-2', name: 'Cases', createdAt: 1, updatedAt: 1 },
    { id: 'd-4', folderId: 'f-2', name: 'Empty', createdAt: 1, updatedAt: 1 },
  ]

  const cardCounts: Record<string, number> = { 'd-1': 12, 'd-2': 3, 'd-3': 7, 'd-4': 0 }

  function mountPicker(selected: string[] = []): VueWrapper {
    return mount(DeckPicker, {
      props: { folders: [spanish, german], decks, cardCounts, modelValue: selected },
    })
  }

  /** What the picker last asked the selection to become. */
  function selection(wrapper: VueWrapper): string[] | undefined {
    return wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string[] | undefined
  }

  function deckBox(wrapper: VueWrapper, deckId: string) {
    return wrapper.get(`[data-testid="deck-check-${deckId}"]`)
  }

  it('groups the decks under their folders', () => {
    const wrapper = mountPicker()

    const groups = wrapper.findAll('[data-testid="picker-folder"]')
    expect(groups).toHaveLength(2)
    expect(groups[0].text()).toContain('Spanish')
    expect(groups[0].text()).toContain('Verbs')
    expect(groups[1].text()).toContain('Cases')
  })

  it('shows how many cards each deck holds', () => {
    const wrapper = mountPicker()

    expect(wrapper.get('[data-testid="deck-cards-d-1"]').text()).toContain('12 cards')
    expect(wrapper.get('[data-testid="deck-cards-d-4"]').text()).toContain('0 cards')
  })

  it('checks the decks it was given', () => {
    const wrapper = mountPicker(['d-2'])

    expect((deckBox(wrapper, 'd-2').element as HTMLInputElement).checked).toBe(true)
    expect((deckBox(wrapper, 'd-1').element as HTMLInputElement).checked).toBe(false)
  })

  it('adds a deck when it is checked', async () => {
    const wrapper = mountPicker(['d-2'])

    await deckBox(wrapper, 'd-1').setValue(true)

    expect(selection(wrapper)).toEqual(['d-2', 'd-1'])
  })

  it('removes a deck when it is unchecked', async () => {
    const wrapper = mountPicker(['d-1', 'd-2'])

    await deckBox(wrapper, 'd-1').setValue(false)

    expect(selection(wrapper)).toEqual(['d-2'])
  })

  it('takes a whole folder with select-all', async () => {
    const wrapper = mountPicker([])

    await wrapper.get('[data-testid="folder-check-f-1"]').setValue(true)

    expect(selection(wrapper)).toEqual(['d-1', 'd-2'])
  })

  it('drops a whole folder with select-all, leaving the others alone', async () => {
    const wrapper = mountPicker(['d-1', 'd-2', 'd-3'])

    await wrapper.get('[data-testid="folder-check-f-1"]').setValue(false)

    expect(selection(wrapper)).toEqual(['d-3'])
  })

  it('shows a folder as fully selected only when all of its decks are', () => {
    const partly = mountPicker(['d-1'])
    const wholly = mountPicker(['d-1', 'd-2'])

    const partlyBox = partly.get('[data-testid="folder-check-f-1"]').element as HTMLInputElement
    const whollyBox = wholly.get('[data-testid="folder-check-f-1"]').element as HTMLInputElement
    expect(partlyBox.checked).toBe(false)
    expect(whollyBox.checked).toBe(true)
  })

  it('leaves out a folder with no decks in it', () => {
    const wrapper = mount(DeckPicker, {
      props: {
        folders: [spanish, german],
        decks: decks.filter((deck) => deck.folderId === 'f-1'),
        cardCounts,
        modelValue: [],
      },
    })

    expect(wrapper.findAll('[data-testid="picker-folder"]')).toHaveLength(1)
  })

  it('invites some decks when there are none at all', () => {
    const wrapper = mount(DeckPicker, {
      props: { folders: [], decks: [], cardCounts: {}, modelValue: [] },
    })

    expect(wrapper.get('[data-testid="picker-empty"]').text()).toContain('deck')
  })
})
