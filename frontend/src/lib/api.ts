import type { GardenClient, ReadingPoint, Suggestion, SuggestionResult } from './types'

const APPROVE_PROBE_PATH = '/suggestions/probe/approve'

// The browser only calls HTTP. It never publishes an MQTT command.
export function createHttpClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): GardenClient {
  const base = baseUrl.replace(/\/$/, '')

  return {
    getPlanters: () => getJson(fetchImpl, `${base}/planters`),
    getActuators: () => getJson(fetchImpl, `${base}/actuators`),
    getReadings: (sensorId, since) => {
      const query = new URLSearchParams({
        sensorId: String(sensorId),
        since,
      })
      return getJson<ReadingPoint[]>(fetchImpl, `${base}/readings?${query}`)
    },
    getSuggestions: () => loadSuggestions(fetchImpl, base),
    approve: async (id) => {
      const response = await fetchImpl(`${base}/suggestions/${id}/approve`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Approve failed (${response.status})`)
      }
    },
  }
}

export async function loadSuggestions(
  fetchImpl: typeof fetch,
  base: string,
): Promise<SuggestionResult> {
  let response: Response
  try {
    response = await fetchImpl(`${base}/suggestions?status=pending`)
  } catch {
    return { suggestions: [], approveAvailable: false }
  }

  if (!response.ok) {
    return { suggestions: [], approveAvailable: false }
  }

  const suggestions = parseSuggestions(await response.json())
  const approveAvailable = await approveRouteExists(fetchImpl, base)
  return { suggestions, approveAvailable }
}

async function approveRouteExists(
  fetchImpl: typeof fetch,
  base: string,
): Promise<boolean> {
  // `probe` is not a numeric id, so a mounted approve handler rejects it
  // before it can update a row. Nest's default 404 ("Cannot POST") means
  // the route is not registered.
  try {
    const response = await fetchImpl(`${base}${APPROVE_PROBE_PATH}`, {
      method: 'POST',
    })
    if (response.status !== 404) return true
    const message = await response.text()
    return !message.includes('Cannot POST')
  } catch {
    return false
  }
}

async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

function parseSuggestions(body: unknown): Suggestion[] {
  if (!Array.isArray(body)) return []
  return body.filter(isSuggestion)
}

function isSuggestion(value: unknown): value is Suggestion {
  if (value === null || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'number' && typeof row.summary === 'string'
}
