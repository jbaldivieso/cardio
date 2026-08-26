import { describe, expect, it } from 'vitest'
import { parseBulk } from '@/domain/bulkParse'
import { FACE_MAX_LENGTH } from '@/domain/validation'

describe('parseBulk', () => {
  it('turns one delimited line into one card', () => {
    expect(parseBulk('ser|to be', '|')).toEqual({
      cards: [{ front: 'ser', back: 'to be' }],
      errors: [],
    })
  })

  it('trims the whitespace around both faces', () => {
    expect(parseBulk('  ser  |  to be  ', '|').cards).toEqual([{ front: 'ser', back: 'to be' }])
  })

  it('reads every line of a batch', () => {
    const { cards } = parseBulk('ser|to be\nir|to go', '|')

    expect(cards).toEqual([
      { front: 'ser', back: 'to be' },
      { front: 'ir', back: 'to go' },
    ])
  })

  it('skips blank and whitespace-only lines without complaining', () => {
    const { cards, errors } = parseBulk('ser|to be\n\n   \nir|to go', '|')

    expect(cards).toHaveLength(2)
    expect(errors).toEqual([])
  })

  it('splits on the first separator only, so the back may contain it', () => {
    expect(parseBulk('a|b|c', '|').cards).toEqual([{ front: 'a', back: 'b|c' }])
  })

  it('reports a line with no separator, by its 1-based number', () => {
    const { cards, errors } = parseBulk('ser|to be\nnonsense', '|')

    expect(cards).toHaveLength(1)
    expect(errors).toEqual([{ line: 2, reason: 'No “|” on this line.' }])
  })

  it('reports an empty front', () => {
    const { cards, errors } = parseBulk('|to be', '|')

    expect(cards).toEqual([])
    expect(errors).toEqual([{ line: 1, reason: 'The front is empty.' }])
  })

  it('reports an empty back', () => {
    const { cards, errors } = parseBulk('ser|   ', '|')

    expect(cards).toEqual([])
    expect(errors).toEqual([{ line: 1, reason: 'The back is empty.' }])
  })

  it('numbers errors by the line of the input, blank lines included', () => {
    const { errors } = parseBulk('\n\nnonsense', '|')

    expect(errors).toEqual([{ line: 3, reason: 'No “|” on this line.' }])
  })

  it('splits on a tab', () => {
    expect(parseBulk('ser\tto be', '\t').cards).toEqual([{ front: 'ser', back: 'to be' }])
  })

  it('splits on a double colon', () => {
    expect(parseBulk('ser::to be', '::').cards).toEqual([{ front: 'ser', back: 'to be' }])
  })

  it('names the separator it was looking for when it is missing', () => {
    expect(parseBulk('nonsense', '::').errors).toEqual([
      { line: 1, reason: 'No “::” on this line.' },
    ])
  })

  it('calls a tab by its name rather than printing one', () => {
    expect(parseBulk('nonsense', '\t').errors).toEqual([
      { line: 1, reason: 'No tab on this line.' },
    ])
  })

  it('handles carriage returns from a pasted Windows file', () => {
    expect(parseBulk('ser|to be\r\nir|to go', '|').cards).toEqual([
      { front: 'ser', back: 'to be' },
      { front: 'ir', back: 'to go' },
    ])
  })

  it('reports a front longer than the limit, by its line number', () => {
    const result = parseBulk(`ser|to be\n${'x'.repeat(FACE_MAX_LENGTH + 1)}|too long`, '|')

    expect(result.cards).toEqual([{ front: 'ser', back: 'to be' }])
    expect(result.errors).toEqual([
      { line: 2, reason: `The front is longer than ${FACE_MAX_LENGTH} characters.` },
    ])
  })

  it('reports a back longer than the limit', () => {
    const result = parseBulk(`ser|${'x'.repeat(FACE_MAX_LENGTH + 1)}`, '|')

    expect(result.cards).toEqual([])
    expect(result.errors).toEqual([
      { line: 1, reason: `The back is longer than ${FACE_MAX_LENGTH} characters.` },
    ])
  })

  it('accepts a face of exactly the limit', () => {
    const result = parseBulk(`${'x'.repeat(FACE_MAX_LENGTH)}|to be`, '|')

    expect(result.errors).toEqual([])
    expect(result.cards).toHaveLength(1)
  })

  it('parses 500 lines in one pass', () => {
    const text = Array.from({ length: 500 }, (_, i) => `front ${i}|back ${i}`).join('\n')

    const { cards, errors } = parseBulk(text, '|')

    expect(cards).toHaveLength(500)
    expect(errors).toEqual([])
    expect(cards[499]).toEqual({ front: 'front 499', back: 'back 499' })
  })

  it('finds nothing in an empty paste', () => {
    expect(parseBulk('', '|')).toEqual({ cards: [], errors: [] })
  })
})
