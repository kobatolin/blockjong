import { describe, expect, it } from 'vitest'
import {
  SEED_MAX,
  formatSeed,
  formatSeedHex,
  parseSeedInput,
  randomSeed,
  seedToParam,
} from '@/core/seed'

describe('seed parsing', () => {
  it('treats an empty or whitespace input as random', () => {
    expect(parseSeedInput('')).toEqual({ ok: true, seed: null })
    expect(parseSeedInput('   ')).toEqual({ ok: true, seed: null })
  })

  it('parses decimal seeds', () => {
    expect(parseSeedInput('12345')).toEqual({ ok: true, seed: 12345 })
    expect(parseSeedInput(' 000123 ')).toEqual({ ok: true, seed: 123 })
  })

  it('parses hex seeds with either case', () => {
    expect(parseSeedInput('0x1F')).toEqual({ ok: true, seed: 31 })
    expect(parseSeedInput('0XA1B2C3D4')).toEqual({ ok: true, seed: 2712847316 })
  })

  it('accepts the boundaries and zero', () => {
    expect(parseSeedInput('0')).toEqual({ ok: true, seed: 0 })
    expect(parseSeedInput(`0x${SEED_MAX.toString(16)}`)).toEqual({
      ok: true,
      seed: SEED_MAX,
    })
    expect(parseSeedInput(String(SEED_MAX))).toEqual({ ok: true, seed: SEED_MAX })
  })

  it('rejects out-of-range and malformed values', () => {
    for (const raw of ['4294967296', '-1', '+1', 'abc', '0xG', '0x', '0x123456789', '1.5']) {
      expect(parseSeedInput(raw).ok).toBe(false)
    }
  })
})

describe('seed formatting', () => {
  it('formats eight uppercase hex digits', () => {
    expect(formatSeed(0x3039)).toBe('#00003039')
    expect(formatSeed(0xffffffff)).toBe('#FFFFFFFF')
    expect(formatSeedHex(0x3039)).toBe('0x00003039')
    expect(seedToParam(0x3039)).toBe('12345')
  })

  it('generates a uint32 seed', () => {
    for (let i = 0; i < 20; i += 1) {
      const seed = randomSeed()
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThanOrEqual(SEED_MAX)
    }
  })
})
