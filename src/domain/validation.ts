/**
 * The invariants of spec §4.2, as pure functions so that both the repositories
 * (src/db) and, later, backup import can enforce exactly the same rules.
 */

/** Folder and deck names: trimmed, 1..80 characters. */
export const NAME_MAX_LENGTH = 80

/** Card faces: trimmed, 1..4000 characters each. */
export const FACE_MAX_LENGTH = 4000

/** Which face of a card is being validated. */
export type FaceField = 'front' | 'back'

/**
 * A value or a reference broke an invariant. Distinct from a programming error
 * so callers can surface `message` to the user and keep going.
 */
export class ValidationError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

/** Returns the trimmed name, or throws if it breaks §4.2. */
export function validateName(raw: string): string {
  const name = raw.trim()
  if (name.length === 0) throw new ValidationError('name', 'Name cannot be empty.')
  if (name.length > NAME_MAX_LENGTH) {
    throw new ValidationError('name', `Name cannot be longer than ${NAME_MAX_LENGTH} characters.`)
  }
  return name
}

/** Returns the trimmed face, or throws if it breaks §4.2. */
export function validateFace(raw: string, field: FaceField): string {
  const face = raw.trim()
  const label = field === 'front' ? 'Front' : 'Back'
  if (face.length === 0) throw new ValidationError(field, `${label} cannot be empty.`)
  if (face.length > FACE_MAX_LENGTH) {
    throw new ValidationError(
      field,
      `${label} cannot be longer than ${FACE_MAX_LENGTH} characters.`,
    )
  }
  return face
}
