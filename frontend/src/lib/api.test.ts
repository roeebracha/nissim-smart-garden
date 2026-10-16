import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, loadSuggestions } from './api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('loadSuggestions', () => {
  it('turns a missing suggestions route into an empty list', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'Cannot GET /suggestions?status=pending' }, 404),
    )
    await expect(loadSuggestions(fetchImpl, 'http://api')).resolves.toEqual({
      suggestions: [],
      approveAvailable: false,
    })
  })

  it('hides approval when the approve route is absent', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/suggestions?')) {
        return jsonResponse([{ id: 7, summary: 'Water later', status: 'pending' }])
      }
      return jsonResponse({ message: 'Cannot POST /suggestions/probe/approve' }, 404)
    })
    await expect(loadSuggestions(fetchImpl, 'http://api')).resolves.toEqual({
      suggestions: [{ id: 7, summary: 'Water later', status: 'pending' }],
      approveAvailable: false,
    })
  })

  it('keeps approval when the probe is handled by the route', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/suggestions?')) {
        return jsonResponse([{ id: 7, summary: 'Water later' }])
      }
      return jsonResponse({ message: 'id must be a number' }, 400)
    })
    const result = await loadSuggestions(fetchImpl, 'http://api')
    expect(result.approveAvailable).toBe(true)
  })
})

describe('createHttpClient approve', () => {
  it('POSTs /suggestions/:id/approve and does not call MQTT', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/suggestions/7/approve')) {
        return new Response(null, { status: 204 })
      }
      return jsonResponse({ message: 'missing' }, 500)
    })
    const client = createHttpClient('http://api', fetchImpl)
    await client.approve(7)

    expect(fetchImpl).toHaveBeenCalledWith('http://api/suggestions/7/approve', {
      method: 'POST',
    })
    const urls = fetchImpl.mock.calls.map((call) => String(call[0]))
    expect(urls.some((url) => url.includes('mqtt') || url.includes('/commands'))).toBe(false)
  })
})
