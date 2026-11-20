import { describe, it, expect } from 'vitest'
import {
  formatMoney, parseMoney, invoiceStatus, subscriptionStatus, paymentMethodLabel, periodLabel, formatDate,
  usageProgress, formatQuantity, bannerFor, planPayload, emptyPlan, formatDateTime, eventLabel, errorMessage,
} from '../billing'

describe('billing helpers', () => {
  it('formats and parses CLP pesos', () => {
    expect(formatMoney(152420)).toBe('$ 152.420')
    expect(formatMoney(-11454)).toBe('-$ 11.454')
    expect(formatMoney(1250, 'USD')).toBe('USD 12,50')
    expect(formatMoney(null)).toBe('—')
    expect(parseMoney('$ 1.500')).toBe(1500)
    expect(parseMoney('')).toBeNull()
    expect(Number.isNaN(parseMoney('abc'))).toBe(true)
  })

  it('labels statuses with severity', () => {
    expect(invoiceStatus('overdue')).toEqual({ label: 'Vencida', severity: 'danger' })
    expect(invoiceStatus('paid').severity).toBe('success')
    expect(subscriptionStatus('past_due').label).toBe('Con deuda vencida')
    expect(subscriptionStatus(null).label).toBe('Sin suscripción')
    expect(paymentMethodLabel('automatic')).toBe('Enlace de pago')
    expect(eventLabel('issued')).toBe('Emitida')
  })

  it('formats local dates and periods without time zone shifts', () => {
    expect(formatDate('2026-11-01')).toBe('01-11-2026')
    expect(periodLabel('2026-11-01', '2026-11-30')).toBe('01-11-2026 al 30-11-2026')
    expect(formatDateTime('2026-12-01T02:00:00Z')).toBe('30-11-2026')   // Santiago UTC-3
  })

  it('computes consumption vs included', () => {
    const meter = { valued_by_cost: false }
    expect(usageProgress({ meter, quantity: 80, cost: 0, included_quantity: 100, markup_percent: null })).toEqual({ percent: 80, level: 'warning', over: false })
    expect(usageProgress({ meter, quantity: 150, cost: 0, included_quantity: 100, markup_percent: null }).over).toBe(true)
    expect(usageProgress({ meter, quantity: 5, cost: 0, included_quantity: 0, markup_percent: null })).toEqual({ percent: null, level: 'over', over: true })
    expect(usageProgress({ meter: { valued_by_cost: true }, quantity: 4, cost: 1000, included_quantity: 2400, markup_percent: 20 }).percent).toBe(50)
  })

  it('formats quantities with units', () => {
    expect(formatQuantity(150, 'mensaje')).toBe('150 mensajes')
    expect(formatQuantity(1, 'minuto')).toBe('1 minuto')
    expect(formatQuantity(12.5, 'GB')).toBe('12,5 GB')
    expect(formatQuantity(3, 'usuario')).toBe('3 usuarios')
    expect(formatQuantity(4.2, 'USD')).toBe('US$ 4,2')
  })

  it('maps the subscription status to a banner', () => {
    expect(bannerFor('active')).toBeNull()
    expect(bannerFor('past_due')?.severity).toBe('warning')
    expect(bannerFor('suspended')?.title).toBe('Espacio en solo lectura')
  })

  it('builds the plan payload', () => {
    const form = { ...emptyPlan(), key: ' pro ', name: 'Pro', base_price: 99999.6 as any, meters: [
      { meter: 'ai.cost', included_quantity: 1000, unit_price: 50, markup_percent: 20 },
      { meter: 'sms.messages', included_quantity: 10, unit_price: 12, markup_percent: 5 },
      { meter: '', included_quantity: 0, unit_price: 0, markup_percent: null },
    ] }
    const catalog = [
      { key: 'ai.cost', label: 'IA', unit: 'USD', aggregation: 'sum' as const, valued_by_cost: true },
      { key: 'sms.messages', label: 'SMS', unit: 'mensaje', aggregation: 'sum' as const, valued_by_cost: false },
    ]
    const p = planPayload(form, catalog)
    expect(p.key).toBe('pro')
    expect(p.base_price).toBe(100000)
    expect(p.meters).toEqual([
      { meter: 'ai.cost', included_quantity: 1000, unit_price: 0, markup_percent: 20 },
      { meter: 'sms.messages', included_quantity: 10, unit_price: 12, markup_percent: null },
    ])
  })

  it('extracts API error messages', () => {
    expect(errorMessage({ data: { errors: { key: ['Ya existe'] } } }, 'x')).toBe('Ya existe')
    expect(errorMessage({}, 'Falló')).toBe('Falló')
  })
})
