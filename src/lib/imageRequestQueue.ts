function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isTransientImageError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /upstream service temporarily unavailable|temporarily unavailable|no available accounts|http 429|http 503/i.test(message)
}

export async function withImageRequestQueue<T>(run: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await run()
    } catch (err) {
      lastError = err
      if (attempt >= retries || !isTransientImageError(err)) throw err
      await delay(1200 * (attempt + 1))
    }
  }
  throw lastError
}
