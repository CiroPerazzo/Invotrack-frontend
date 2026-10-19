import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useDashboardStats, useMonthlyChart, useCreateInvoice, useUpdateInvoice,
  useUpdateInvoiceStatus, useDeleteInvoice,
} from '@/features/invoices/hooks/useInvoices'
import { useRegisterPayment, useDeletePayment } from '@/features/invoices/hooks/useInvoicePayments'
import { QUERY_KEYS } from '@/lib/constants'

const { context, invoices, payments } = vi.hoisted(() => ({
  context: { company: null },
  invoices: {
    getDashboardStats: vi.fn(), getMonthlyChart: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), delete: vi.fn(),
  },
  payments: { registerPayment: vi.fn(), deletePayment: vi.fn() },
}))
vi.mock('@/features/companies/context/CompanyContext', () => ({ useCompany: () => context }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/features/invoices/services/invoiceService', () => ({ invoiceService: invoices }))
vi.mock('@/features/invoices/services/invoicePaymentService', () => ({ invoicePaymentService: payments }))

const clients = []
function queryContext() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })
  clients.push(client)
  return { client, wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }
}
beforeEach(() => {
  vi.clearAllMocks()
  context.company = { id: 'company-a' }
  invoices.getDashboardStats.mockResolvedValue({ totalFacturado: 2 })
  invoices.getMonthlyChart.mockResolvedValue([{ total_amount: 2 }])
})
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()) })

describe('actualización del dashboard al cambiar la facturación', () => {
  it.each([
    ['crear factura', useCreateInvoice, {}],
    ['editar factura', useUpdateInvoice, { id: 'invoice-a', total_amount: 2 }],
    ['cambiar estado', useUpdateInvoiceStatus, { id: 'invoice-a', status: 'cancelled' }],
    ['eliminar factura', useDeleteInvoice, 'invoice-a'],
    ['registrar pago', useRegisterPayment, { amount: 2 }],
    ['eliminar pago', useDeletePayment, 'payment-a'],
  ])('%s refresca las tarjetas y el gráfico que ya estaban abiertos', async (_, useAction, payload) => {
    const { client, wrapper } = queryContext()
    client.setQueryData([QUERY_KEYS.DASHBOARD_STATS, 'company-a'], { totalFacturado: 1 })
    client.setQueryData([QUERY_KEYS.MONTHLY_CHART, 'company-a', 3], [{ total_amount: 1 }])
    const { result } = renderHook(() => ({
      stats: useDashboardStats(), chart: useMonthlyChart(), mutation: useAction('invoice-a'),
    }), { wrapper })
    expect(result.current.stats.data.totalFacturado).toBe(1)
    await act(async () => { await result.current.mutation.mutateAsync(payload) })
    await waitFor(() => {
      expect(result.current.stats.data.totalFacturado).toBe(2)
      expect(result.current.chart.data[0].total_amount).toBe(2)
    })
    expect(invoices.getDashboardStats).toHaveBeenCalledWith('company-a')
    expect(invoices.getMonthlyChart).toHaveBeenCalledWith('company-a', 3)
  })

  it('consulta la empresa activa incluso si conserva una antigua marca de demo', async () => {
    const { wrapper } = queryContext()
    context.company = { id: 'company-a', _isDemo: true }
    const { result } = renderHook(() => ({ stats: useDashboardStats(), chart: useMonthlyChart() }), { wrapper })
    await waitFor(() => expect(result.current.chart.isSuccess).toBe(true))
    expect(invoices.getDashboardStats).toHaveBeenCalledWith('company-a')
    expect(invoices.getMonthlyChart).toHaveBeenCalledWith('company-a', 3)
  })

  it('al cambiar de empresa no reutiliza los importes de otra empresa', async () => {
    const { wrapper } = queryContext()
    invoices.getDashboardStats.mockImplementation(async (id) => ({ totalFacturado: id === 'company-a' ? 10 : 20 }))
    const { result, rerender } = renderHook(() => useDashboardStats(), { wrapper })
    await waitFor(() => expect(result.current.data?.totalFacturado).toBe(10))
    context.company = { id: 'company-b' }
    rerender()
    await waitFor(() => expect(result.current.data?.totalFacturado).toBe(20))
    expect(invoices.getDashboardStats).toHaveBeenLastCalledWith('company-b')
  })

  it('sin empresa seleccionada no consulta ni devuelve datos de demostración', () => {
    const { wrapper } = queryContext()
    context.company = null
    const { result } = renderHook(() => ({ stats: useDashboardStats(), chart: useMonthlyChart() }), { wrapper })
    expect(result.current.stats.data).toBeUndefined()
    expect(result.current.chart.data).toBeUndefined()
    expect(invoices.getDashboardStats).not.toHaveBeenCalled()
    expect(invoices.getMonthlyChart).not.toHaveBeenCalled()
  })
})
