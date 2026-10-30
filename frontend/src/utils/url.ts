/** URL state for `?mode=...&seed=...` and clipboard helpers. */
import { MODE_IDS } from '@/core/kinds'
import { parseSeedInput } from '@/core/seed'
import type { Layout, ModeId } from '@/core/types'

export interface UrlState {
  mode: ModeId | null
  seed: number | null
  layout?: Layout
}

export function parseUrlState(search?: string): UrlState {
  const source =
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  const params = new URLSearchParams(source)
  const rawMode = params.get('mode')
  const mode =
    rawMode && (MODE_IDS as readonly string[]).includes(rawMode)
      ? (rawMode as ModeId)
      : null

  const rawSeed = params.get('seed')
  let seed: number | null = null
  if (rawSeed !== null && rawSeed !== '') {
    const parsed = parseSeedInput(rawSeed)
    if (parsed.ok) seed = parsed.seed
  }
  const rawLayout = params.get('layout')
  const layout: Layout | undefined =
    rawLayout === 'wide' || rawLayout === 'tall' ? rawLayout : undefined
  return layout ? { mode, seed, layout } : { mode, seed }
}

export function writeUrlState(mode: ModeId, seed: number, layout: Layout): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('mode', mode)
  url.searchParams.set('seed', String(seed >>> 0))
  url.searchParams.set('layout', layout)
  window.history.replaceState({}, '', url)
}

export function buildShareUrl(
  mode: ModeId,
  seed: number,
  layout: Layout,
  base?: string,
): string {
  const fallback = typeof window !== 'undefined' ? window.location.href : 'http://localhost/'
  const url = new URL(base ?? fallback)
  url.searchParams.set('mode', mode)
  url.searchParams.set('seed', String(seed >>> 0))
  url.searchParams.set('layout', layout)
  return url.toString()
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall back to a temporary textarea
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}
