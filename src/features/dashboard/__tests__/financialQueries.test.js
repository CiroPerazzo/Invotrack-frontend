import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoiceService } from '@/features/invoices/services/invoiceService'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

function financialSource(rows, error = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn(async (start, end) => ({ data: rows.slice(start, end + 1), error })),
  }
  from.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
})
afterEach(() => vi.useRealTimers())

describe('consultas de facturación del dashboard', () => {
  it('calcula facturado, cobrado y gastado desde facturas y pagos reales', async () => {
    const query = financialSource([
      { type: 'receivable', total_amount: '1210', total_paid: '1210', total_pending: '0', is_fully_paid: true },
      { type: 'receivable', total_amount: '100', total_paid: '25', total_pending: '75', is_fully_paid: false },
      { type: 'receivable', total_amount: '200', total_paid: '0', total_pending: '200', is_overdue: true },
      { type: 'payable', total_amount: '700', total_paid: '300', total_pending: '400' },
    ])
    expect(await invoiceService.getDashboardStats('company-a')).toEqual({
      totalFacturado: 1510, totalIngresos: 1510, totalIngresado: 1235, totalGastos: 700,
      totalPendiente: 275, resultado: 810, paid: 1, pending: 1, overdue: 1, total: 3,
    })
    expect(from).toHaveBeenCalledWith('invoice_financial_summary')
    expect(query.eq).toHaveBeenCalledWith('company_id', 'company-a')
    expect(query.gte).toHaveBeenCalledWith('issue_date', '2026-10-01')
    expect(query.lt).toHaveBeenCalledWith('issue_date', '2026-11-01')
    expect(query.not).toHaveBeenCalledWith('status', 'in', '(draft,cancelled)')
  })

  it('incluye ingresos y egresos pendientes sin registrar pagos ficticios', async () => {
    financialSource([
      { type: 'receivable', total_amount: '100', total_paid: '0', total_pending: '100' },
      { type: 'payable', total_amount: '40', total_paid: '0', total_pending: '40' },
    ])
    expect(await invoiceService.getDashboardStats('company-a')).toMatchObject({
      totalIngresos: 100, totalGastos: 40, resultado: 60,
      totalIngresado: 0, totalPendiente: 100, paid: 0,
    })
  })

  it('carga todas las páginas para no truncar los importes a 1000 facturas', async () => {
    const query = financialSource(Array.from({ length: 1001 }, () => ({
      type: 'receivable', total_amount: '10', total_paid: '0', total_pending: '10',
    })))
    expect((await invoiceService.getDashboardStats('company-a')).totalFacturado).toBe(10010)
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]])
  })

  it('consulta el historial de la empresa activa con límites de mes completos', async () => {
    vi.setSystemTime(new Date(2026, 1, 15))
    const rows = [{ type: 'receivable', issue_date: '2025-12-01', total_amount: '50', total_paid: '20' }]
    const query = financialSource(rows)
    expect(await invoiceService.getMonthlyChart('company-b', 3)).toEqual(rows)
    expect(query.eq).toHaveBeenCalledWith('company_id', 'company-b')
    expect(query.gte).toHaveBeenCalledWith('issue_date', '2025-12-01')
    expect(query.lt).toHaveBeenCalledWith('issue_date', '2026-03-01')
  })

  it('propaga errores de Supabase y rechaza consultas sin empresa', async () => {
    const error = new Error('Sin acceso')
    financialSource([], error)
    await expect(invoiceService.getDashboardStats('company-a')).rejects.toBe(error)
    await expect(invoiceService.getMonthlyChart('company-a')).rejects.toBe(error)
    from.mockClear()
    await expect(invoiceService.getDashboardStats()).rejects.toThrow('companyId requerido')
    await expect(invoiceService.getMonthlyChart()).rejects.toThrow('companyId requerido')
    expect(from).not.toHaveBeenCalled()
  })
})
