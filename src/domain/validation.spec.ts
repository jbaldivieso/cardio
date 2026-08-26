import { describe, expect, it } from 'vitest'
import {
  FACE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  ValidationError,
  validateFace,
  validateName,
} from '@/domain/validation'

describe('validateName', () => {
  it('returns the name with surrounding whitespace removed', () => {
    expect(validateName('  Spanish  ')).toBe('Spanish')
  })

  it('rejects a name that is empty once trimmed', () => {
    expect(() => validateName('   ')).toThrow(ValidationError)
  })

  it('accepts a name of exactly the maximum length', () => {
    const name = 'a'.repeat(NAME_MAX_LENGTH)

    expect(validateName(name)).toBe(name)
  })

  it('measures the length after trimming', () => {
    const name = 'a'.repeat(NAME_MAX_LENGTH)

    expect(validateName(`  ${name}  `)).toBe(name)
  })

  it('rejects a name one character over the maximum', () => {
    expect(() => validateName('a'.repeat(NAME_MAX_LENGTH + 1))).toThrow(/80/)
  })

  it('reports which field failed', () => {
    expect(() => validateName('')).toThrow(expect.objectContaining({ field: 'name' }))
  })
})

describe('validateFace', () => {
  it('returns the face with surrounding whitespace removed', () => {
    expect(validateFace('  ¿Cómo estás?  ', 'front')).toBe('¿Cómo estás?')
  })

  it('keeps newlines inside a face', () => {
    expect(validateFace('- one\n- two', 'back')).toBe('- one\n- two')
  })

  it('rejects a face that is empty once trimmed', () => {
    expect(() => validateFace('\n \t ', 'front')).toThrow(ValidationError)
  })

  it('accepts a face of exactly the maximum length', () => {
    const face = 'a'.repeat(FACE_MAX_LENGTH)

    expect(validateFace(face, 'back')).toBe(face)
  })

  it('rejects a face one character over the maximum', () => {
    expect(() => validateFace('a'.repeat(FACE_MAX_LENGTH + 1), 'back')).toThrow(/4000/)
  })

  it('reports which face failed', () => {
    expect(() => validateFace('', 'back')).toThrow(expect.objectContaining({ field: 'back' }))
  })
})

describe('ValidationError', () => {
  it('is named so a caller can tell it from a programming error', () => {
    expect(new ValidationError('name', 'nope').name).toBe('ValidationError')
  })
})
