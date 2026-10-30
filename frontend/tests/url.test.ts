import { describe, expect, it } from 'vitest'
import { buildShareUrl, parseUrlState } from '@/utils/url'

describe('URL state', () => {
  it('parses mode and decimal seed', () => {
    expect(parseUrlState('?mode=full&seed=12345')).toEqual({
      mode: 'full',
      seed: 12345,
    })
  })

  it('parses hex seeds and zero', () => {
    expect(parseUrlState('?mode=easy&seed=0x1F')).toEqual({
      mode: 'easy',
      seed: 31,
    })
    expect(parseUrlState('?seed=0')).toEqual({ mode: null, seed: 0 })
  })

  it('ignores invalid mode and seed values', () => {
    expect(parseUrlState('?mode=nightmare&seed=abc')).toEqual({
      mode: null,
      seed: null,
    })
    expect(parseUrlState('?seed=4294967296')).toEqual({
      mode: null,
      seed: null,
    })
  })

  it('parses an explicit layout and ignores invalid ones', () => {
    expect(parseUrlState('?mode=medium&seed=1&layout=tall')).toEqual({
      mode: 'medium',
      seed: 1,
      layout: 'tall',
    })
    expect(parseUrlState('?mode=medium&seed=1&layout=diagonal')).toEqual({
      mode: 'medium',
      seed: 1,
    })
  })

  it('builds a shareable URL', () => {
    const url = buildShareUrl(
      'full',
      12345,
      'tall',
      'http://localhost:8000/?debug=1',
    )
    expect(url).toContain('mode=full')
    expect(url).toContain('seed=12345')
    expect(url).toContain('layout=tall')
    expect(url).toContain('debug=1')
  })
})
