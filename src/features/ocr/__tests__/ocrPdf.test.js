import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ocrService } from '@/features/ocr/services/ocrService'
import { parseGpt4Response } from '@/features/ocr/parsers/invoiceParser'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))

beforeEach(() => {
  vi.clearAllMocks()
  invoke.mockResolvedValue({ data: { rawText: 'TIPO: Factura B\nVENDEDOR:\nRAZON_SOCIAL: Proveedor PDF\nCUIT: 30-12345678-9\nCONDICION_IVA: MO\nDOMICILIO: Calle 123\nCOMPRADOR:\nRAZON_SOCIAL: Empresa\nITEMS: NO_DETECTADO\nTOTAL: 121.00' } })
})

describe('OCR de documentos', () => {
  it.each(['application/pdf', ''])('envía el PDF completo con nombre y MIME (%s)', async (type) => {
    const file = new File(['%PDF-1.7\ncontenido de varias páginas'], 'factura.pdf', { type })
    const result = await ocrService.processInvoice(file, 'gpt4v')
    expect(invoke).toHaveBeenCalledWith('ocr-gpt4v', { body: {
      fileBase64: expect.any(String), mimeType: 'application/pdf', fileName: 'factura.pdf',
    } })
    expect(atob(invoke.mock.calls[0][1].body.fileBase64)).toContain('%PDF-1.7')
    expect(result.normalized).toMatchObject({ seller_name: 'Proveedor PDF', seller_tax_condition: 'MO', seller_address: 'Calle 123', ocr_provider: 'gpt4v' })
  })

  it('sigue aceptando imágenes', async () => {
    await ocrService.processInvoice(new File(['image'], 'factura.png', { type: 'image/png' }), 'gpt4v')
    expect(invoke.mock.calls[0][1].body.mimeType).toBe('image/png')
  })

  it('no inventa datos fiscales cuando el OCR deja un campo vacío', () => {
    const result = parseGpt4Response('VENDEDOR:\nRAZON_SOCIAL: Proveedor\nCUIT:\nCONDICION_IVA:\nDOMICILIO: Calle 123\nCOMPRADOR:\nRAZON_SOCIAL: Empresa\nITEMS: NO_DETECTADO')
    expect(result.seller_cuit).toBeNull()
    expect(result.seller_tax_condition).toBeNull()
    expect(result.seller_address).toBe('Calle 123')
  })

  it.each([
    new File([], 'vacio.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' }),
    new File(['texto'], 'factura.txt', { type: 'text/plain' }),
  ])('rechaza archivos vacíos, grandes o no admitidos antes de enviarlos', async (file) => {
    await expect(ocrService.processInvoice(file, 'gpt4v')).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })
})
