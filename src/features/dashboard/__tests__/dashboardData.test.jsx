import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'

const { stats, chart } = vi.hoisted(() => ({ stats: {}, chart: {} }))
vi.mock('@/features/invoices/hooks/useInvoices', () => ({
  useDashboardStats: () => stats,
  useMonthlyChart: () => chart,
}))
vi.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: 'Ana' } } }),
}))
vi.mock('@/features/dashboard/components/RecentInvoices', () => ({ default: () => null }))
vi.mock('@/features/dashboard/components/MonthlyMetricCard', () => ({
  default: ({ title, value, data, isLoading }) => <output data-testid={title}>{JSON.stringify({ value, data, isLoading })}</output>,
}))
vi.mock('@/features/dashboard/components/RevenueChart', () => ({
  default: ({ data, isLoading }) => <output data-testid="chart">{JSON.stringify({ data, isLoading })}</output>,
}))

const point = (testId) => JSON.parse(screen.getByTestId(testId).textContent)
const page = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>)
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  Object.assign(stats, { data: { totalFacturado: 321, totalIngresos: 321, totalIngresado: 123, totalGastos: 43, resultado: 80 }, isLoading: false, error: null, refetch: vi.fn() })
  Object.assign(chart, { data: [
    { issue_date: '2026-09-04', type: 'receivable', total_amount: 200, total_paid: 100 },
    { issue_date: '2026-10-04', type: 'receivable', total_amount: 321, total_paid: 123 },
    { issue_date: '2026-10-07', type: 'payable', total_amount: 43, total_paid: 43 },
  ], isLoading: false, error: null, refetch: vi.fn() })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('dashboard conectado con facturación', () => {
  it('muestra los importes consultados también en desarrollo, sin sustituirlos por valores de prueba', () => {
    page()
    expect(point('Facturado').value).toBe(321)
    expect(point('Ingresos').value).toBe(321)
    expect(point('Gastos').value).toBe(43)
    expect(point('chart').data).toEqual(point('Facturado').data)
    expect(point('chart').data[0]).toMatchObject({ facturado: 0, ingresos: 0, gastos: 0 })
    expect(point('chart').data[1]).toMatchObject({ facturado: 200, ingresos: 200, gastos: 0 })
    expect(point('chart').data[2]).toMatchObject({ facturado: 321, ingresos: 321, gastos: 43 })
    expect(screen.queryByText(/datos de prueba|modo demo/i)).toBeNull()
  })

  it('una empresa sin movimientos muestra ceros', () => {
    stats.data = {}
    chart.data = []
    page()
    for (const label of ['Facturado', 'Ingresos', 'Gastos']) expect(point(label).value).toBe(0)
    expect(point('chart').data.every((month) => month.facturado === 0 && month.ingresos === 0 && month.gastos === 0)).toBe(true)
  })

  it('conserva el estado de carga mientras consulta Supabase', () => {
    stats.isLoading = true
    chart.isLoading = true
    page()
    expect(point('Facturado').isLoading).toBe(true)
    expect(point('chart').isLoading).toBe(true)
  })

  it('muestra el error y permite reconsultar sin presentar cifras inventadas', () => {
    stats.error = new Error('Sin acceso')
    page()
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar')
    expect(screen.queryByTestId('Facturado')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(stats.refetch).toHaveBeenCalledOnce()
    expect(chart.refetch).toHaveBeenCalledOnce()
  })
})
