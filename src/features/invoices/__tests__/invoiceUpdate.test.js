import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoiceService } from '@/features/invoices/services/invoiceService'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))

beforeEach(() => vi.clearAllMocks())

describe('invoice editing', () => {
  it('saves detail separately from the header and removes form-only values', async () => {
    rpc.mockResolvedValue({ data: { id: 'invoice' }, error: null })
    const items = [{ descripcion: 'Producto', cantidad: 2, precio_unitario: 100 }]
    await invoiceService.update('invoice', {
      id: 'ignored', consumidor_final_anonimo: true, items,
      fecha_vencimiento: '', cae_vencimiento: '', cae: '', notes: 'Editada',
    }, 'company')
    expect(rpc).toHaveBeenCalledWith('update_invoice_with_items', {
      p_invoice_id: 'invoice', p_company_id: 'company', p_items: items,
      p_updates: { fecha_vencimiento: null, cae_vencimiento: null, cae: null, notes: 'Editada' },
    })
  })

  it('does not clear detail when the caller omits items', async () => {
    rpc.mockResolvedValue({ data: {}, error: null })
    await invoiceService.update('invoice', { notes: 'Editada' }, 'company')
    expect(rpc.mock.calls[0][1].p_items).toBeNull()
  })

  it('requires company scope and propagates transaction errors', async () => {
    await expect(invoiceService.update('invoice', {})).rejects.toThrow('companyId requerido')
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValue({ error: new Error('Sin permisos') })
    await expect(invoiceService.update('invoice', {}, 'company')).rejects.toThrow('Sin permisos')
  })
})
