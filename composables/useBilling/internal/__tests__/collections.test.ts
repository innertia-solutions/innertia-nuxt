import { describe, it, expect } from 'vitest'
import {
  adjustmentPayload, adjustmentValue, adjustmentStatus, creditNotePayload, reissuePayload, mappingError, allocationPreview,
  transactionStatus, matchReasonLabel, scoreSeverity, reportCell, isNumericColumn, parseReminderDays, yearToDate,
  activityLabel, movementLabel, eventLabel, importStatus, type AdjustmentForm,
} from '../billing'

const adj = (over: Partial<AdjustmentForm> = {}): AdjustmentForm => ({
  scope: 'space', tenant_key: 'rancagua', type: 'discount', mode: 'amount', value: '10.000', recurring: true,
  starts_at: '2026-11-01', ends_at: '2026-12-31', reason: ' Lanzamiento ', ...over,
})

describe('cobranza: ajustes y notas de crédito', () => {
  it('arma el payload de un ajuste por espacio y valida', () => {
    expect(adjustmentPayload(adj(), 'c1').payload).toEqual({
      tenant_key: 'rancagua', type: 'discount', amount: 10000, recurring: true, starts_at: '2026-11-01', ends_at: '2026-12-31', reason: 'Lanzamiento',
    })
    expect(adjustmentPayload(adj({ reason: '' }), 'c1').error).toBe('El motivo es obligatorio.')
    expect(adjustmentPayload(adj({ value: '0' }), 'c1').error).toBe('Ingresa un monto válido.')
    expect(adjustmentPayload(adj({ mode: 'percent', value: '120' }), 'c1').error).toContain('porcentaje')
    expect(adjustmentPayload(adj({ ends_at: '2026-10-01' }), 'c1').error).toContain('vigencia')
    // one-off: never recurring, no end
    expect(adjustmentPayload(adj({ type: 'one_off' }), 'c1').payload).toMatchObject({ recurring: false, ends_at: null })
  })

  it('a nivel de cliente solo admite porcentajes de descuento o recargo', () => {
    expect(adjustmentPayload(adj({ scope: 'client' }), 'c1').error).toContain('porcentuales')
    expect(adjustmentPayload(adj({ scope: 'client', mode: 'percent', value: '10,5' }), 'c1').payload).toMatchObject({ client_id: 'c1', percent: 10.5 })
  })

  it('muestra valor y estado del ajuste', () => {
    expect(adjustmentValue({ type: 'discount', amount: 10000, percent: null })).toBe('- $ 10.000')
    expect(adjustmentValue({ type: 'surcharge', amount: null, percent: 15 })).toBe('+ 15 %')
    expect(adjustmentStatus('applied')).toEqual({ label: 'Aplicado', severity: 'success' })
  })

  it('arma la nota de crédito según el destino', () => {
    const base = { amount: '$ 19.000', reason: 'Caída', invoice_id: 'i1', tenant_key: 'rancagua' }
    expect(creditNotePayload({ ...base, target: 'invoice' }, 'c1').payload).toEqual({ client_id: 'c1', amount: 19000, reason: 'Caída', target: 'invoice', invoice_id: 'i1', tenant_key: null })
    expect(creditNotePayload({ ...base, target: 'next_period' }, 'c1').payload).toMatchObject({ invoice_id: null, tenant_key: 'rancagua' })
    expect(creditNotePayload({ ...base, target: 'invoice', invoice_id: '' }, 'c1').error).toBe('Elige la factura.')
    expect(creditNotePayload({ ...base, target: 'balance', amount: '' }, 'c1').error).toBe('Ingresa un monto válido.')
  })
})

describe('cobranza: refacturación', () => {
  it('envía solo los datos cambiados y líneas con signo', () => {
    const { payload } = reissuePayload({
      reason: ' RUT mal ', billing_data: { tax_id: '76.222.222-2', legal_name: 'X SpA' }, original: { tax_id: '76.111.111-1', legal_name: 'X SpA' },
      lines: [{ description: 'Descuento', amount: '-10.000' }, { description: '', amount: '' }], due_at: '', send: false,
    })
    expect(payload).toEqual({
      reason: 'RUT mal', billing_data: { tax_id: '76.222.222-2' }, lines: [{ description: 'Descuento', amount: -10000, tenant_key: null }], due_at: null, send: false,
    })
  })

  it('exige motivo y líneas completas', () => {
    const base = { billing_data: {}, original: {}, due_at: '', send: true }
    expect(reissuePayload({ ...base, reason: '', lines: [] }).error).toBe('El motivo es obligatorio.')
    expect(reissuePayload({ ...base, reason: 'x', lines: [{ description: 'a', amount: '0' }] }).error).toContain('distinto de cero')
    expect(reissuePayload({ ...base, reason: 'x', lines: [] }).payload?.billing_data).toBeNull()
  })

  it('etiqueta los eventos nuevos de la bitácora', () => {
    expect(eventLabel('credit_note')).toBe('Nota de crédito')
    expect(eventLabel('late_fee_waived')).toBe('Interés condonado')
    expect(eventLabel('reminder_sent')).toBe('Recordatorio enviado')
  })
})

describe('cobranza: conciliación', () => {
  it('valida el mapeo de columnas', () => {
    expect(mappingError({})).toBe('Elige la columna de fecha.')
    expect(mappingError({ date: 'Fecha' })).toContain('abonos')
    expect(mappingError({ date: 'Fecha', credit: 'Fecha' })).toContain('dos campos')
    expect(mappingError({ date: 'Fecha', amount: 'Monto', description: '' })).toBeNull()
  })

  it('previsualiza la aplicación: parcial, varias facturas y saldo a favor', () => {
    const invoices = [{ id: 'a', balance: 119000 }, { id: 'b', balance: 119000 }]
    expect(allocationPreview(200000, invoices, ['a', 'b'])).toEqual({
      rows: [{ id: 'a', applied: 119000, remaining: 0 }, { id: 'b', applied: 81000, remaining: 38000 }], credit: 0,
    })
    expect(allocationPreview(200000, invoices, ['a']).credit).toBe(81000)
    expect(allocationPreview(50000, invoices, ['b', 'a']).rows).toEqual([{ id: 'b', applied: 50000, remaining: 69000 }, { id: 'a', applied: 0, remaining: 119000 }])
  })

  it('etiqueta estados, razones y puntajes', () => {
    expect(transactionStatus('suggested').label).toBe('Con sugerencia')
    expect(importStatus('failed').severity).toBe('danger')
    expect(matchReasonLabel('tax_id_in_text')).toBe('RUT en la glosa')
    expect(scoreSeverity(90)).toBe('success')
    expect(scoreSeverity(65)).toBe('info')
    expect(scoreSeverity(40)).toBe('warning')
  })
})

describe('cobranza: estado de cuenta, reportes y recordatorios', () => {
  it('formatea celdas de reportes', () => {
    expect(reportCell('total', 238000)).toBe('$ 238.000')
    expect(reportCell('d31_60', 0)).toBe('$ 0')
    expect(reportCell('invoices', 1200)).toBe('1.200')
    expect(reportCell('due_at', '2026-12-31')).toBe('31-12-2026')
    expect(reportCell('label', null)).toBe('—')
    expect(isNumericColumn('balance')).toBe(true)
    expect(isNumericColumn('client')).toBe(false)
  })

  it('lee los días de recordatorio', () => {
    expect(parseReminderDays('3, 7,7')).toEqual([7, 3])
    expect(parseReminderDays('')).toEqual([])
    expect(parseReminderDays('7;3')).toBeNull()
  })

  it('rango del año y etiquetas', () => {
    expect(yearToDate(new Date(2026, 10, 19))).toEqual({ from: '2026-01-01', to: '2026-11-19' })
    expect(activityLabel('bank_transaction', 'auto_matched')).toBe('Movimiento bancario conciliado automáticamente')
    expect(movementLabel('credit_note')).toBe('Nota de crédito')
  })
})
