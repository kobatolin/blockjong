/**
 * Seed parsing/formatting.
 *
 * A seed is an unsigned 32-bit integer. The menu accepts decimal or `0x`
 * hexadecimal; an empty string means "pick a random seed".
 */

export const SEED_MAX = 0xffffffff

export type SeedParseResult =
  | { ok: true; seed: number | null }
  | { ok: false; error: string }

const ERROR_MESSAGE = '请输入 0–4294967295 的整数，或 0x 开头的 1–8 位十六进制'

export function parseSeedInput(raw: string): SeedParseResult {
  const text = raw.trim()
  if (text === '') return { ok: true, seed: null }

  const hexMatch = /^0x([0-9a-f]{1,8})$/i.exec(text)
  if (hexMatch) {
    return { ok: true, seed: Number.parseInt(hexMatch[1], 16) >>> 0 }
  }

  if (/^\d{1,10}$/.test(text)) {
    const seed = Number(text)
    if (Number.isSafeInteger(seed) && seed >= 0 && seed <= SEED_MAX) {
      return { ok: true, seed }
    }
  }

  return { ok: false, error: ERROR_MESSAGE }
}

/** `12345` -> `#00003039` (always 8 uppercase hex digits). */
export function formatSeed(seed: number): string {
  return `#${(seed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

/** `12345` -> `0x00003039`, the string copied by the seed chip. */
export function formatSeedHex(seed: number): string {
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

/** Decimal form used in share URLs. */
export function seedToParam(seed: number): string {
  return String(seed >>> 0)
}

/**
 * Cryptographically strong seed when available. The fallback is only for
 * exotic runtimes without Web Crypto and is not used in supported browsers.
 */
export function randomSeed(): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const buffer = new Uint32Array(1)
    cryptoApi.getRandomValues(buffer)
    return buffer[0] >>> 0
  }
  const time = Date.now() >>> 0
  const precision = Math.floor((globalThis.performance?.now() ?? 0) * 1000) >>> 0
  return (time ^ precision) >>> 0
}
