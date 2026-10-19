import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import NewInvoicePage from '@/features/invoices/pages/NewInvoicePage'

const { existing } = vi.hoisted(() => ({ existing: { value: null } }))
vi.mock('@/features/companies/context/CompanyContext', () => ({
  useCompany: () => ({ company: { id: '22222222-2222-4222-8222-222222222222', tax_condition: 'RI' } }),
}))
vi.mock('@/features/clients/hooks/useClients', () => ({ useClients: () => ({ data: { data: [] } }) }))
vi.mock('@/features/providers/hooks/useProviders', () => ({ useProviders: () => ({ data: { data: [] } }) }))
vi.mock('@/features/invoices/hooks/useInvoices', () => ({
  useCreateInvoice: () => ({ isPending: false }),
  useUpdateInvoice: () => ({ isPending: false }),
  useInvoice: () => ({ data: existing.value, isLoading: false }),
}))
vi.mock('@/features/invoices/components/InvoiceForm', () => ({
  default: ({ invoiceId }) => <output data-testid="invoice-id">{invoiceId}</output>,
}))
vi.mock('@/features/invoices/components/InvoiceFlowPicker', () => ({
  default: ({ onSelect }) => <button onClick={() => onSelect('receivable')}>Yo emito</button>,
}))

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
function page(url) {
  return render(<MemoryRouter initialEntries={[url]}>
    <Location />
    <Routes>
      <Route path="/invoices/new" element={<NewInvoicePage />} />
      <Route path="/invoices/:id/edit" element={<NewInvoicePage />} />
    </Routes>
  </MemoryRouter>)
}
afterEach(() => { cleanup(); existing.value = null })

describe('identidad de factura para no repetir el CAE', () => {
  it('conserva el UUID del borrador en la URL y después de una recarga', async () => {
    const view = page('/invoices/new')
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('?draft='))
    const url = screen.getByTestId('location').textContent
    const draft = new URLSearchParams(url.split('?')[1]).get('draft')
    fireEvent.click(screen.getByRole('button', { name: 'Yo emito' }))
    expect(screen.getByTestId('invoice-id').textContent).toBe(draft)
    view.unmount()
    page(url)
    fireEvent.click(screen.getByRole('button', { name: 'Yo emito' }))
    expect(screen.getByTestId('invoice-id').textContent).toBe(draft)
  })

  it('usa el id guardado al editar aunque haya otro draft en la URL', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    existing.value = { id, type: 'receivable' }
    page(`/invoices/${id}/edit?draft=33333333-3333-4333-8333-333333333333`)
    expect(screen.getByTestId('invoice-id').textContent).toBe(id)
  })
})
