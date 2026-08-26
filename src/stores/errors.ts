import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * The one error surface every store shares: a message the screen can show, and
 * a wrapper that turns a rejected repository call into it.
 *
 * Nothing is applied optimistically anywhere, so a failed action leaves the
 * store's state exactly as it was and there is nothing to roll back.
 */
export interface ErrorSurface {
  error: Ref<string | null>
  attempt: <T>(work: () => Promise<T>) => Promise<T | undefined>
}

function messageOf(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : 'Something went wrong.'
}

export function useErrorSurface(): ErrorSurface {
  const error = ref<string | null>(null)

  async function attempt<T>(work: () => Promise<T>): Promise<T | undefined> {
    error.value = null
    try {
      return await work()
    } catch (cause) {
      error.value = messageOf(cause)
      return undefined
    }
  }

  return { error, attempt }
}
