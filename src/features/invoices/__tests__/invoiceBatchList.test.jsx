import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvoicesPage from '@/features/invoices/pages/InvoicesPage'

const { context, state, mutation } = vi.hoisted(() => ({
  context: { company: { id: 'company-a' } },
  state: { rows: [], progress: null },
  mutation: { mutateAsync: vi.fn(), isPending: false, error: null },
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/features/companies/context/CompanyContext', () => ({ useCompany: () => context }))
vi.mock('@/features/invoices/hooks/useInvoices', () => ({
  useInvoices: () => ({ data: state.rows, count: state.rows.length, isLoading: false }),
  useUpdateInvoiceStatus: () => ({}), useDeleteInvoice: () => ({}),
}))
vi.mock('@/features/invoices/hooks/useBatchEmitCae', () => ({
  useBatchEmitCae: (_companyId, onProgress) => { state.progress = onProgress; return mutation },
}))

const invoice = (id, fields = {}) => ({
  id, company_id: 'company-a', invoice_number: id, type: 'receivable',
  tipo_comprobante: 'Factura B', status: 'pending', total_amount: 121, ...fields,
})
const page = () => <MemoryRouter><InvoicesPage /></MemoryRouter>
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  context.company = { id: 'company-a' }
  mutation.isPending = false
  mutation.error = null
  state.rows = [invoice('venta'), invoice('compra', { type: 'payable' }),
    invoice('autorizada', { cae: '70000000000001' }), invoice('cancelada', { status: 'cancelled' })]
  mutation.mutateAsync.mockResolvedValue([])
})
afterEach(cleanup)

describe('lista para enviar facturas a ARCA', () => {
  it('permite marcar las facturas y env?a las ventas disponibles', async () => {
    render(page())
    const send = screen.getByRole('button', { name: 'Enviar seleccionadas a ARCA' })
    expect(send.disabled).toBe(true)
    for (const id of ['compra', 'autorizada', 'cancelada']) {
      expect(screen.getByRole('checkbox', { name: `Seleccionar factura ${id}` }).disabled).toBe(false)
    }
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar factura venta' }))
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledWith(['venta']))
    await waitFor(() => expect(screen.getByText('0 seleccionadas')).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Facturas' })).toBeTruthy()
  })

  it('selecciona y deselecciona todas las facturas de la página', () => {
    state.rows.push(invoice('otra-venta'))
    render(page())
    const all = screen.getByRole('checkbox', { name: /Seleccionar todas las facturas/ })
    fireEvent.click(all)
    expect(screen.getByText('5 seleccionadas')).toBeTruthy()
    expect(screen.getByText('2 listas para ARCA')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Seleccionar factura compra' }).checked).toBe(true)
    fireEvent.click(all)
    expect(screen.getByText('0 seleccionadas')).toBeTruthy()
  })

  it('muestra las autorizadas y los errores del lote por separado y bloquea un doble clic', async () => {
    state.rows.push(invoice('otra-venta'))
    let release
    mutation.mutateAsync.mockImplementation(() => new Promise((resolve) => { release = resolve }))
    render(page())
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar todas las facturas/ }))
    const send = screen.getByRole('button', { name: 'Enviar seleccionadas a ARCA' })
    fireEvent.click(send)
    fireEvent.click(send)
    expect(mutation.mutateAsync).toHaveBeenCalledOnce()
    state.progress([
      { id: 'venta', label: 'venta', status: 'issued', invoiceNumber: '0001-00000015', cae: '70000000000001' },
      { id: 'otra-venta', label: 'otra-venta', status: 'error', message: 'Error de ARCA' },
    ])
    release([])
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 emitidas de 2'))
    expect(screen.getByRole('status').textContent).toContain('CAE 70000000000001')
    expect(screen.getByRole('status').textContent).toContain('Error de ARCA')
  })

  it('limpia la selección al cambiar de empresa', () => {
    const view = render(page())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar factura venta' }))
    expect(screen.getByText('1 seleccionadas')).toBeTruthy()
    context.company = { id: 'company-b' }
    view.rerender(page())
    expect(screen.getByText('0 seleccionadas')).toBeTruthy()
  })

  it('permite seleccionar desde la fila y desde el espacio alrededor de la casilla', () => {
    render(page())
    const checkbox = screen.getByRole('checkbox', { name: 'Seleccionar factura venta' })
    fireEvent.click(checkbox.closest('tr'))
    expect(checkbox.checked).toBe(true)
    expect(screen.getByText('1 seleccionadas')).toBeTruthy()
    fireEvent.click(checkbox.closest('td'))
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    expect(screen.getByRole('link', { name: 'venta' }).getAttribute('href')).toBe('/invoices/venta')
  })

  it('permite marcar las que tienen CAE, explica su exclusión y no las envía otra vez', async () => {
    render(page())
    const send = screen.getByRole('button', { name: 'Enviar seleccionadas a ARCA' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar factura autorizada' }))
    expect(screen.getByText('1 seleccionadas')).toBeTruthy()
    expect(send.disabled).toBe(true)
    expect(screen.getByRole('note').textContent).toContain('autorizada: CAE obtenido')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar factura venta' }))
    fireEvent.click(send)
    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledWith(['venta']))
  })

  it('deshabilita la selección mientras hay un envío en curso', () => {
    mutation.isPending = true
    render(page())
    const checkbox = screen.getByRole('checkbox', { name: 'Seleccionar factura venta' })
    expect(checkbox.disabled).toBe(true)
    fireEvent.click(checkbox.closest('tr'))
    fireEvent.click(checkbox.closest('td'))
    expect(screen.getByText('0 seleccionadas')).toBeTruthy()
  })
})
