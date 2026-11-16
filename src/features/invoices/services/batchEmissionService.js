import { supabase } from '@/lib/supabase'
import { invoiceService } from '@/features/invoices/services/invoiceService'
import { afipService } from '@/features/invoices/services/afipService'
import { getComprobanteConfig } from '@/constants/comprobanteConfig'

export const MAX_BATCH_INVOICES = 50
let running = false
const requestKey = (companyId, id) => `invotrack:cae:${companyId}:${id}`

export function emissionBlockReason(invoice, companyId) {
  if (invoice.type !== 'receivable') return 'Factura recibida: no se envía a ARCA'
  if (invoice.status === 'cancelled') return 'Factura cancelada'
  if (String(invoice.cae ?? '').trim() || ['issued', 'authorized', 'valid'].includes(invoice.afip_status)) {
    return 'CAE obtenido'
  }
  const config = getComprobanteConfig(invoice.tipo_comprobante)
  if (!config.esFactura || config.esExportacion) return 'Tipo no disponible para envío en lote'
  if (!invoice.client_id) return 'Creá o seleccioná un cliente antes de solicitar el CAE'
  try {
    if (sessionStorage.getItem(requestKey(companyId, invoice.id)) === 'requested') {
      return 'CAE ya solicitado: revisá el resultado anterior'
    }
  } catch { /* La reserva del servidor también impide duplicar el CAE. */ }
  return null
}

// Reutiliza la misma Edge Function que el formulario, con una solicitud por vez.
// Los errores nunca disparan reintentos: ARCA puede haber autorizado la factura.
export async function emitInvoiceBatch({ companyId, invoiceIds, onProgress = () => {} }) {
  if (!companyId) throw new Error('Seleccioná una empresa')
  if (!Array.isArray(invoiceIds) || !invoiceIds.length || invoiceIds.length > MAX_BATCH_INVOICES
      || new Set(invoiceIds).size !== invoiceIds.length) {
    throw new Error(`Seleccioná entre 1 y ${MAX_BATCH_INVOICES} facturas distintas`)
  }
  if (running) throw new Error('Ya hay un envío a ARCA en curso')
  running = true
  const results = []
  try {
    for (const id of invoiceIds) {
      let invoice, authorization
      try {
        // Leer los datos guardados nuevamente, dentro de la empresa activa.
        invoice = await invoiceService.getById(id, companyId)
        if (!invoice || invoice.company_id !== companyId) throw new Error('Factura no encontrada en esta empresa')
        const reason = emissionBlockReason(invoice, companyId)
        if (reason) throw new Error(reason)
        try { sessionStorage.setItem(requestKey(companyId, id), 'requested') } catch { /* Server reservation remains authoritative. */ }
        authorization = await afipService.emitCae({
          invoice: { ...invoice, items: invoice.invoice_items ?? [], numero_comprobante: 0 },
        })
        const number = Number(authorization?.numeroComprobante ?? authorization?.cbteDesde)
        if (!authorization?.cae || !Number.isInteger(number) || number <= 0) {
          throw new Error('Respuesta incompleta de ARCA. Revisá el intento antes de continuar.')
        }
        const updates = {
          cae: String(authorization.cae),
          cae_vencimiento: authorization.caeVencimiento,
          numero_comprobante: number,
          invoice_number: `${String(invoice.punto_de_venta).padStart(4, '0')}-${String(number).padStart(8, '0')}`,
          afip_status: 'issued',
          status: invoice.status === 'draft' ? 'pending' : invoice.status,
        }
        // Actualizar solo la cabecera: no duplicar ítems, pagos ni movimientos de stock.
        const { error } = await supabase.from('invoices').update(updates)
          .eq('company_id', companyId).eq('id', id).select('id').single()
        if (error) throw error
        results.push({ id, label: invoice.invoice_number || id, status: 'issued', cae: updates.cae, invoiceNumber: updates.invoice_number })
      } catch (error) {
        results.push({
          id, label: invoice?.invoice_number || id,
          status: authorization?.cae ? 'authorized_unsaved' : 'error',
          cae: authorization?.cae,
          numeroComprobante: authorization?.numeroComprobante ?? authorization?.cbteDesde,
          message: error.message,
        })
      }
      onProgress([...results])
    }
    return results
  } finally {
    running = false
  }
}
