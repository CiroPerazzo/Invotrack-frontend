import { describe, expect, it } from 'vitest'
import { buildMonthlyMetrics, getMonthlyChange } from '@/features/dashboard/lib/monthlyMetrics'

describe('métricas mensuales del dashboard', () => {
  it('agrupa importes por mes de emisión y conserva los meses sin movimientos al cruzar de año', () => {
    const rows = [
      { issue_date: '2025-12-03', type: 'receivable', total_amount: '1200.50', total_paid: '500.25' },
      { issue_date: '2025-12-20', type: 'receivable', total_amount: '300', total_paid: '0' },
      { issue_date: '2025-12-15', type: 'payable', total_amount: '900', total_paid: '125.10' },
      { issue_date: '2026-02-02', type: 'receivable', total_amount: '80', total_paid: '80' },
      { issue_date: '2025-07-01', type: 'receivable', total_amount: '9999', total_paid: '9999' },
    ]

    const result = buildMonthlyMetrics(rows, new Date(2026, 1, 15))

    expect(result.map((month) => month.key)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(result[0]).toMatchObject({ facturado: 1500.5, ingresos: 500.25, gastos: 125.1 })
    expect(result[1]).toMatchObject({ facturado: 0, ingresos: 0, gastos: 0 })
    expect(result[2]).toMatchObject({ facturado: 80, ingresos: 80, gastos: 0 })
  })

  it('no inventa un porcentaje cuando el mes anterior fue cero', () => {
    expect(getMonthlyChange(100, 0)).toBeNull()
    expect(getMonthlyChange(0, 100)).toBe(-100)
    expect(getMonthlyChange(112, 100)).toBe(12)
  })
})
