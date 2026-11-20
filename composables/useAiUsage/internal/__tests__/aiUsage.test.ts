import { describe, it, expect } from 'vitest'
import {
  featureLabel, formatUsd, compactNumber, unitsLabel, shiftMonth, monthLabel, monthKey, barHeights, budgetState, parsePrice,
} from '../aiUsage'

describe('aiUsage helpers', () => {
  it('labels features, falling back to a readable key', () => {
    expect(featureLabel('call_summary')).toBe('Resumen de llamadas')
    expect(featureLabel('live_copilot')).toBe('Copiloto en vivo')
    expect(featureLabel('custom_thing')).toBe('Custom thing')
    expect(featureLabel(null)).toBe('Sin clasificar')
  })

  it('formats USD with adaptive precision', () => {
    expect(formatUsd(0.0042)).toBe('US$ 0,0042')
    expect(formatUsd(12.5)).toBe('US$ 12,50')
    expect(formatUsd(null)).toBe('—')
  })

  it('compacts numbers and summarizes units', () => {
    expect(compactNumber(1_250_000)).toBe('1,3 M')
    expect(compactNumber(15_300)).toBe('15,3 mil')
    expect(compactNumber(950)).toBe('950')
    expect(unitsLabel({ input_tokens: 1000, output_tokens: 500, audio_seconds: 90, tts_chars: 0 })).toBe('1.500 tokens · 1,5 min de audio')
    expect(unitsLabel({})).toBe('—')
  })

  it('navigates months', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-11', 2)).toBe('2027-01')
    expect(monthLabel('2026-11')).toBe('Noviembre 2026')
    expect(monthKey(new Date(2026, 2, 15))).toBe('2026-03')
  })

  it('scales bars and computes budget levels', () => {
    expect(barHeights([0, 5, 10])).toEqual([0, 50, 100])
    expect(barHeights([0, 0])).toEqual([0, 0])
    expect(budgetState(79, 100)).toEqual({ percent: 79, level: 'ok' })
    expect(budgetState(80, 100)?.level).toBe('warning')
    expect(budgetState(130, 100)?.level).toBe('over')
    expect(budgetState(10, null)).toBeNull()
  })

  it('parses price inputs', () => {
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('1,5')).toBe(1.5)
    expect(parsePrice('-1')).toBeUndefined()
    expect(parsePrice('abc')).toBeUndefined()
  })
})
