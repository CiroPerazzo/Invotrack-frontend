import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvoiceForm from '@/features/invoices/components/InvoiceForm'

const { createClient, createProvider } = vi.hoisted(() => ({ createClient: vi.fn(), createProvider: vi.fn() }))
vi.mock('@/features/clients/hooks/useClients', () => ({ useCreateClient: () => ({ mutateAsync: createClient }) }))
vi.mock('@/features/providers/hooks/useProviders', () => ({ useCreateProvider: () => ({ mutateAsync: createProvider }) }))
vi.mock('@/features/invoices/hooks/useEmitCae', () => ({ useEmitCae: () => ({ isPending: false }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/features/products/hooks/useProducts', () => ({ useProducts: () => ({ data: { data: [] } }) }))
vi.mock('@/features/invoices/components/ItemSearchInput', () => ({ default: () => null }))
vi.mock('@/features/invoices/components/CompanyPartyPanel', () => ({ default: () => null }))

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })
afterEach(cleanup)

describe('guardar contraparte desde los datos de la factura', () => {
  it.each([
    ['payable', 'emisor', 'proveedor'], ['receivable', 'receptor', 'cliente'],
  ])('precarga, guarda y vincula un %s sin guardar la factura', async (type, role, noun) => {
    const onSubmit = vi.fn()
    const mutation = type === 'payable' ? createProvider : createClient
    mutation.mockImplementation(async (data) => ({ ...data, id: '44444444-4444-4444-8444-444444444444' }))
    render(<MemoryRouter><InvoiceForm company={{ id: 'company-a', tax_condition: 'RI' }} onSubmit={onSubmit}
      defaultValues={{ type, tipo_comprobante: 'Factura B', items: [],
        [`${role}_razon_social`]: 'Contacto escaneado', [`${role}_cuit`]: '30123456789',
        [`${role}_domicilio`]: 'Calle 123', [`${role}_condicion_iva`]: 'MO' }} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: `Crear ${noun} con estos datos` }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByDisplayValue('Contacto escaneado')).toBeTruthy()
    expect(dialog.getByDisplayValue('30-12345678-9')).toBeTruthy()
    expect(dialog.getByDisplayValue('Calle 123')).toBeTruthy()
    fireEvent.change(dialog.getByDisplayValue('Contacto escaneado'), { target: { value: 'Contacto revisado' } })
    fireEvent.click(dialog.getByRole('button', { name: `Crear ${noun} y usar` }))
    await waitFor(() => expect(mutation).toHaveBeenCalledWith({ company_id: 'company-a', name: 'Contacto revisado', cuit: '30-12345678-9', address: 'Calle 123', tax_condition: 'MO' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: `${type === 'payable' ? 'Proveedor' : 'Cliente'} vinculado` }).disabled).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()
    if (type === 'receivable') expect(screen.getByRole('button', { name: /Solicitar CAE en ARCA/ }).disabled).toBe(false)
  })

  it('al cancelar y volver a abrir toma los datos actuales del emisor', () => {
    render(<MemoryRouter><InvoiceForm company={{ id: 'company-a' }}
      defaultValues={{ type: 'payable', tipo_comprobante: 'Factura B', items: [], emisor_razon_social: 'Original' }} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Crear proveedor con estos datos' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Corregido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear proveedor con estos datos' }))
    expect(within(screen.getByRole('dialog')).getByDisplayValue('Corregido')).toBeTruthy()
    expect(createProvider).not.toHaveBeenCalled()
  })
})
