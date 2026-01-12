/**
 * Fetches data from an API endpoint with automatic retry logic and better error handling
 * 
 * @param url - The API endpoint URL
 * @param options - Fetch options (same as standard fetch)
 * @param retries - Number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in milliseconds (default: 1000)
 * @returns Promise that resolves to the response data or throws an error
 */
export async function fetchWithRetry<T = any>(
  url: string,
  options: RequestInit = {},
  retries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // If response is ok, parse and return
      if (response.ok) {
        const data = await response.json()
        return data as T
      }

      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      // For server errors (5xx) or network errors, retry
      if (attempt < retries) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }))
        lastError = new Error(errorData.error || `Server error (${response.status})`)
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
        continue
      }

      // Last attempt failed
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(errorData.error || `Request failed with status ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on network errors if it's the last attempt
      if (attempt < retries && lastError.message.includes('Failed to fetch')) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
        continue
      }

      // If it's not a retryable error or we've exhausted retries, throw
      if (attempt === retries || !lastError.message.includes('Failed to fetch')) {
        throw lastError
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error occurred')
}
