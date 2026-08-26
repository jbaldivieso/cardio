/**
 * Bulk card entry (spec §9): one card per line, `front<sep>back`.
 *
 * Deliberately unforgiving in one direction only — a line it cannot read is
 * reported by number and contributes no card, but blank lines are just blank.
 */

export interface ParsedCard {
  front: string
  back: string
}

export interface BulkError {
  /** 1-based, counted over the raw input so it matches what the user sees. */
  line: number
  reason: string
}

export interface BulkResult {
  cards: ParsedCard[]
  errors: BulkError[]
}

/** A tab is invisible in a message, so it gets a name instead. */
function separatorLabel(separator: string): string {
  return separator === '\t' ? 'tab' : `“${separator}”`
}

export function parseBulk(text: string, separator: string): BulkResult {
  const cards: ParsedCard[] = []
  const errors: BulkError[] = []

  text.split('\n').forEach((raw, index) => {
    const line = index + 1
    // \r survives a paste from a Windows file and would end up inside the back.
    const content = raw.replace(/\r$/, '')
    if (content.trim().length === 0) return

    const at = content.indexOf(separator)
    if (at === -1) {
      errors.push({ line, reason: `No ${separatorLabel(separator)} on this line.` })
      return
    }

    // Only the first separator splits, so the back may contain more of them.
    const front = content.slice(0, at).trim()
    const back = content.slice(at + separator.length).trim()
    if (front.length === 0) {
      errors.push({ line, reason: 'The front is empty.' })
      return
    }
    if (back.length === 0) {
      errors.push({ line, reason: 'The back is empty.' })
      return
    }

    cards.push({ front, back })
  })

  return { cards, errors }
}
