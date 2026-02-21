import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWithRetry } from '../../lib/fetch-with-retry'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function createMockResponse(status: number, data: any, ok?: boolean) {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data on successful response', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: 'test' }))

    const result = await fetchWithRetry('/api/test')
    expect(result).toEqual({ data: 'test' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('includes credentials and content-type headers', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(200, {}))

    await fetchWithRetry('/api/test')

    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }))
  })

  it('merges custom headers', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(200, {}))

    await fetchWithRetry('/api/test', {
      headers: { 'Authorization': 'Bearer token' },
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
      }),
    }))
  })

  it('does not retry on 4xx client errors', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(400, { error: 'Bad Request' }))

    await expect(fetchWithRetry('/api/test')).rejects.toThrow('Bad Request')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 401 Unauthorized', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(401, { error: 'Unauthorized' }))

    await expect(fetchWithRetry('/api/test')).rejects.toThrow('Unauthorized')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 403 Forbidden', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(403, { error: 'Forbidden' }))

    await expect(fetchWithRetry('/api/test')).rejects.toThrow('Forbidden')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 404 Not Found', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(404, { error: 'Not found' }))

    await expect(fetchWithRetry('/api/test')).rejects.toThrow('Not found')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries on 5xx server errors and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(createMockResponse(500, { error: 'Server Error' }))
      .mockResolvedValueOnce(createMockResponse(200, { data: 'recovered' }))

    // Use very short retry delay for test speed
    const result = await fetchWithRetry('/api/test', {}, 3, 1)
    expect(result).toEqual({ data: 'recovered' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries multiple times on repeated server errors then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(createMockResponse(500, { error: 'Error' }))
      .mockResolvedValueOnce(createMockResponse(500, { error: 'Error' }))
      .mockResolvedValueOnce(createMockResponse(200, { data: 'ok' }))

    const result = await fetchWithRetry('/api/test', {}, 3, 1)
    expect(result).toEqual({ data: 'ok' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting all retries on server errors', async () => {
    mockFetch.mockResolvedValue(createMockResponse(500, { error: 'Server Error' }))

    await expect(fetchWithRetry('/api/test', {}, 2, 1)).rejects.toThrow()
    // 1 initial + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('handles json parse failure in error response gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    })

    await expect(fetchWithRetry('/api/test')).rejects.toThrow('Request failed')
  })

  it('respects custom retry count of 0 (no retries)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(500, { error: 'Error' }))

    await expect(fetchWithRetry('/api/test', {}, 0, 1)).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries on network errors (Failed to fetch)', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(createMockResponse(200, { data: 'ok' }))

    const result = await fetchWithRetry('/api/test', {}, 3, 1)
    expect(result).toEqual({ data: 'ok' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry on non-network, non-server errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Some other error'))

    await expect(fetchWithRetry('/api/test', {}, 3, 1)).rejects.toThrow('Some other error')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
