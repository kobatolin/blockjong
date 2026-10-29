/** Read-only backend config client; failure is non-fatal. */
export interface ServerMode {
  id: string
  name: string
  rows: number
  cols: number
  suits: string[]
  copies: number
}

export interface ServerConfig {
  version: string
  modes: ServerMode[]
  rules: { flowerMatch: string; dragSegment: string }
  assetsBase: string
}

export async function fetchConfig(): Promise<ServerConfig | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch('/api/config', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    return (await response.json()) as ServerConfig
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}
