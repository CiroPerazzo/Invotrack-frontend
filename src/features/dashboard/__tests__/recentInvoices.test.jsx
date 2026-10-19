import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RecentInvoices from '@/features/dashboard/components/RecentInvoices'

const { useInvoices } = vi.hoisted(() => ({ useInvoices: vi.fn() }))
vi.mock('@/features/invoices/hooks/useInvoices', () => ({ useInvoices }))
afterEach(cleanup)

describe('actividad reciente del dashboard', () => {
  it('usa los nombres de las relaciones y la fecha de emisión de la factura', () => {
    useInvoices.mockReturnValue({ isLoading: false, data: [
      { id: 'a', invoice_number: '0001-00000001', fecha_emision: '2026-10-19', total_amount: 123, status: 'pending', clients: { name: 'Cliente real' } },
      { id: 'b', invoice_number: '0001-00000002', fecha_emision: '2026-10-18', total_amount: 456, status: 'paid', providers: { name: 'Proveedor real' } },
    ] })
    render(<MemoryRouter><RecentInvoices /></MemoryRouter>)
    expect(useInvoices).toHaveBeenCalledWith({ page: 1, pageSize: 5 })
    expect(screen.getByText('Cliente real')).toBeTruthy()
    expect(screen.getByText('Proveedor real')).toBeTruthy()
    expect(screen.getByText('19/10/2026')).toBeTruthy()
    expect(screen.getByText('18/10/2026')).toBeTruthy()
  })

  it('distingue un fallo de consulta de una empresa sin facturas', () => {
    useInvoices.mockReturnValue({ isLoading: false, data: [], error: new Error('Error de red') })
    render(<MemoryRouter><RecentInvoices /></MemoryRouter>)
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar')
    expect(screen.queryByText('No hay facturas aún')).toBeNull()
  })
})
