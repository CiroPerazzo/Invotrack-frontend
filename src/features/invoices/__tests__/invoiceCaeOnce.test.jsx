import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvoiceForm from '@/features/invoices/components/InvoiceForm'

const { mutateAsync, toast } = vi.hoisted(() => ({ mutateAsync: vi.fn(), toast: vi.fn() }))
vi.mock('@/features/invoices/hooks/useEmitCae', () => ({
  useEmitCae: () => ({ mutateAsync, isPending: false, isError: false }),
}))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/features/products/hooks/useProducts', () => ({
  useProducts: () => ({ data: { data: [{ name: 'Producto', price: 100 }] } }),
}))
vi.mock('@/features/invoices/components/ItemSearchInput', () => ({ default: () => null }))
vi.mock('@/features/invoices/components/CompanyPartyPanel', () => ({ default: () => null }))
vi.mock('@/features/invoices/components/QuickCreatePartyDialog', () => ({ default: () => null }))

const invoiceId = '11111111-1111-4111-8111-111111111111'
const company = { id: '22222222-2222-4222-8222-222222222222', tax_condition: 'RI' }
const defaultValues = {
  client_id: '44444444-4444-4444-8444-444444444444',
  type: 'receivable', tipo_comprobante: 'Factura B', punto_de_venta: 1, numero_comprobante: 1,
  fecha_emision: '2026-10-19', fecha_vencimiento: '2026-11-01', condicion_pago: 'contado', moneda: 'ARS', tipo_cambio: 1,
  emisor_cuit: '20-11111111-2', emisor_razon_social: 'Empresa', emisor_condicion_iva: 'RI', emisor_domicilio: 'Calle 123',
  receptor_cuit: '', receptor_razon_social: '', receptor_condicion_iva: 'CF', consumidor_final_anonimo: true,
  cae: '', cae_vencimiento: '', neto_gravado: 0, neto_no_gravado: 0, exento: 0,
  iva_105: 0, iva_21: 0, iva_27: 0, otros_tributos: 0, total_amount: 0,
  items: [{ descripcion: 'Producto', cantidad: 1, precio_unitario: 100, alicuota_iva: 21 }],
}

function form(values = defaultValues, onSubmit = vi.fn()) {
  return render(<MemoryRouter><InvoiceForm invoiceId={invoiceId} defaultValues={values} company={company} onSubmit={onSubmit} /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})
afterEach(cleanup)

describe('solicitar CAE una sola vez desde el formulario', () => {
  it('no permite pedir CAE con datos escritos pero sin cliente creado y vinculado', () => {
    form({ ...defaultValues, client_id: null, receptor_razon_social: 'Cliente escrito' })
    const button = screen.getByRole('button', { name: /Solicitar CAE en ARCA/ })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })
  it('bloquea el segundo clic mientras espera la respuesta y envía la identidad estable', async () => {
    mutateAsync.mockReturnValue(new Promise(() => {}))
    form()
    const button = screen.getByRole('button', { name: /Solicitar CAE en ARCA/ })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(mutateAsync).toHaveBeenCalledOnce()
    expect(mutateAsync).toHaveBeenCalledWith({ invoice: expect.objectContaining({ id: invoiceId, company_id: company.id, numero_comprobante: 0 }) })
    expect(button.disabled).toBe(true)
  })

  it('mantiene el bloqueo después de un timeout y al volver a montar el formulario', async () => {
    mutateAsync.mockRejectedValue(new Error('network timeout'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = form()
    fireEvent.click(screen.getByRole('button', { name: /Solicitar CAE en ARCA/ }))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    view.unmount()
    form()
    const button = screen.getByRole('button', { name: 'CAE ya solicitado' })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(mutateAsync).toHaveBeenCalledOnce()
    vi.restoreAllMocks()
  })

  it('no permite solicitarlo si ya hay un CAE guardado', () => {
    form({ ...defaultValues, cae: '70000000000001' })
    expect(screen.getByRole('button', { name: 'CAE obtenido' }).disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('12345678901234'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'CAE ya solicitado' }).disabled).toBe(true)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('conserva el mismo UUID al guardar luego de obtener el CAE', async () => {
    mutateAsync.mockResolvedValue({ cae: '70000000000001', caeVencimiento: '2026-11-01', numeroComprobante: 10 })
    const onSubmit = vi.fn()
    form(defaultValues, onSubmit)
    fireEvent.click(screen.getByRole('button', { name: /Solicitar CAE en ARCA/ }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id: invoiceId, cae: '70000000000001', numero_comprobante: 10 })))
    expect(screen.getByRole('button', { name: 'CAE obtenido' }).disabled).toBe(true)
  })
})
