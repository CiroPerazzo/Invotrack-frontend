import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitInvoiceBatch, emissionBlockReason } from '@/features/invoices/services/batchEmissionService'

const { getById, emitCae, update, eq, single } = vi.hoisted(() => ({
  getById: vi.fn(), emitCae: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn(),
}))
vi.mock('@/features/invoices/services/invoiceService', () => ({ invoiceService: { getById } }))
vi.mock('@/features/invoices/services/afipService', () => ({ afipService: { emitCae } }))
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ update }) } }))

const invoice = (id, fields = {}) => ({
  id, company_id: 'company-a', type: 'receivable', tipo_comprobante: 'Factura B',
  status: 'pending', invoice_number: `draft-${id}`, punto_de_venta: 2,
  invoice_items: [{ description: 'Producto', quantity: 1, unit_price: 100, alicuota_iva: 21 }],
  ...fields,
})
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  getById.mockImplementation(async (id) => invoice(id))
  emitCae.mockResolvedValue({ cae: '70000000000001', caeVencimiento: '2026-11-12', numeroComprobante: 12 })
  const query = { eq, select: vi.fn().mockReturnThis(), single }
  update.mockReturnValue(query)
  eq.mockReturnValue(query)
  single.mockResolvedValue({ data: { id: 'saved' }, error: null })
})

describe('envío de varias facturas guardadas a ARCA', () => {
  it('envía una por vez, conserva los ítems y guarda solo la autorización en la empresa correspondiente', async () => {
    const progress = vi.fn()
    emitCae.mockImplementation(async () => {
      if (emitCae.mock.calls.length === 2) expect(single).toHaveBeenCalledOnce()
      return { cae: '70000000000001', caeVencimiento: '2026-11-12', numeroComprobante: 12 }
    })
    const results = await emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a', 'b'], onProgress: progress })
    expect(results.map((r) => r.status)).toEqual(['issued', 'issued'])
    expect(getById.mock.calls).toEqual([['a', 'company-a'], ['b', 'company-a']])
    expect(emitCae).toHaveBeenNthCalledWith(1, { invoice: expect.objectContaining({
      id: 'a', numero_comprobante: 0, items: invoice('a').invoice_items,
    }) })
    expect(update).toHaveBeenCalledWith({
      cae: '70000000000001', cae_vencimiento: '2026-11-12', numero_comprobante: 12,
      invoice_number: '0002-00000012', afip_status: 'issued', status: 'pending',
    })
    expect(eq).toHaveBeenCalledWith('company_id', 'company-a')
    expect(eq).toHaveBeenCalledWith('id', 'a')
    expect(progress).toHaveBeenCalledTimes(2)
    expect(progress.mock.calls[0][0]).toHaveLength(1)
  })

  it('continúa con las demás tras un timeout y no reintenta la solicitud', async () => {
    emitCae.mockRejectedValueOnce(new Error('network timeout'))
    const results = await emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a', 'b'] })
    expect(results.map((r) => r.status)).toEqual(['error', 'issued'])
    expect(results[0].message).toContain('timeout')
    expect(emitCae).toHaveBeenCalledTimes(2)
    await emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a'] })
    expect(emitCae).toHaveBeenCalledTimes(2)
  })

  it.each([
    { type: 'payable' }, { status: 'cancelled' }, { cae: '70000000000001' },
    { afip_status: 'issued' }, { tipo_comprobante: 'Presupuesto' }, { company_id: 'company-b' },
  ])('no envía comprobantes incompatibles o de otra empresa: %o', async (fields) => {
    getById.mockResolvedValue(invoice('a', fields))
    const [result] = await emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a'] })
    expect(result.status).toBe('error')
    expect(emitCae).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('distingue un CAE autorizado que no se pudo guardar y lo mantiene bloqueado', async () => {
    single.mockResolvedValue({ error: new Error('Sin conexión con la base') })
    const [result] = await emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a'] })
    expect(result).toMatchObject({ status: 'authorized_unsaved', cae: '70000000000001', numeroComprobante: 12 })
    expect(emissionBlockReason(invoice('a'), 'company-a')).toContain('ya solicitado')
  })

  it('conserva el estado de pago y convierte los borradores autorizados en pendientes', async () => {
    getById.mockImplementation(async (id) => invoice(id, { status: id === 'a' ? 'paid' : 'draft' }))
    await emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a', 'b'] })
    expect(update.mock.calls[0][0].status).toBe('paid')
    expect(update.mock.calls[1][0].status).toBe('pending')
  })

  it.each([[], ['a', 'a'], Array.from({ length: 51 }, (_, i) => String(i))])('rechaza selecciones inválidas antes de enviar', async (ids) => {
    await expect(emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ids })).rejects.toThrow('facturas distintas')
    expect(getById).not.toHaveBeenCalled()
    expect(emitCae).not.toHaveBeenCalled()
  })

  it('no permite dos lotes simultáneos', async () => {
    let release
    emitCae.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const first = emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['a'] })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    await expect(emitInvoiceBatch({ companyId: 'company-a', invoiceIds: ['b'] })).rejects.toThrow('en curso')
    release({ cae: '70000000000001', caeVencimiento: '2026-11-12', numeroComprobante: 12 })
    await first
    expect(emitCae).toHaveBeenCalledOnce()
  })
})
