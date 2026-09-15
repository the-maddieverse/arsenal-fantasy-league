import { useCallback, useState } from 'react'

export function useAsyncState<T>(initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (runner: () => Promise<T>) => {
    setLoading(true)
    setError(null)
    try {
      const result = await runner()
      setData(result)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, run, setData }
}
