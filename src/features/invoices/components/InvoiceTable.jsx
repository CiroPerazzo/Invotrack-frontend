import { Link, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Eye, Edit, Trash2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import InvoiceStatusBadge from '@/features/invoices/components/InvoiceStatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useUpdateInvoiceStatus, useDeleteInvoice } from '@/features/invoices/hooks/useInvoices'
import { emissionBlockReason, MAX_BATCH_INVOICES } from '@/features/invoices/services/batchEmissionService'

// Tabla de facturas con columnas de número, cliente/proveedor, fechas, total y estado.
// Incluye menú de acciones (ver, editar, marcar pagada, eliminar) por fila.
export default function InvoiceTable({ invoices = [], isLoading, companyId,
  selectedIds = [], onToggleInvoice, onTogglePage, allPageSelected, selectionDisabled = false,
}) {
  const navigate = useNavigate()
  const updateStatus = useUpdateInvoiceStatus()
  const deleteInvoice = useDeleteInvoice()
  const canToggle = (invoice) => !selectionDisabled
    && (selectedIds.includes(invoice.id) || selectedIds.length < MAX_BATCH_INVOICES)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!invoices.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No hay facturas para mostrar</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {onToggleInvoice && <th className="py-3 px-4">
              <input type="checkbox" aria-label="Seleccionar todas las facturas de esta página"
                className="h-5 w-5 cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
                checked={Boolean(allPageSelected)} disabled={selectionDisabled || (!allPageSelected && selectedIds.length >= MAX_BATCH_INVOICES)}
                onChange={onTogglePage} />
            </th>}
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Número</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente/Proveedor</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vencimiento</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
            <th className="py-3 px-4 text-left">ARCA</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds.includes(invoice.id) ? 'bg-blue-500/10' : ''}`}
              onClick={() => {
                if (onToggleInvoice) {
                  if (canToggle(invoice)) onToggleInvoice(invoice)
                } else navigate(`/invoices/${invoice.id}`)
              }}
            >
              {onToggleInvoice && <td className="py-3.5 px-4" onClick={(e) => {
                e.stopPropagation()
                if (canToggle(invoice)) onToggleInvoice(invoice)
              }}>
                <input type="checkbox" aria-label={`Seleccionar factura ${invoice.invoice_number || invoice.id}`}
                  className="h-5 w-5 cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
                  checked={selectedIds.includes(invoice.id)}
                  disabled={!canToggle(invoice)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleInvoice(invoice)} />
              </td>}
              <td className="py-3.5 px-4 font-medium text-gray-900">
                <Link to={`/invoices/${invoice.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {invoice.invoice_number || invoice.id}
                </Link>
              </td>
              <td className="py-3.5 px-4 text-gray-600 text-xs">
                {invoice.tipo_comprobante ?? '-'}
              </td>
              <td className="py-3.5 px-4 text-gray-600">
                {invoice.clients?.name
                  || invoice.providers?.name
                  || invoice.receptor_razon_social
                  || invoice.emisor_razon_social
                  || '-'}
              </td>
              <td className="py-3.5 px-4 text-gray-500">{formatDate(invoice.fecha_emision)}</td>
              <td className="py-3.5 px-4 text-gray-500">{formatDate(invoice.fecha_vencimiento)}</td>
              <td className="py-3.5 px-4 text-right money font-semibold text-gray-900">
                {formatCurrency(invoice.total_amount)}
              </td>
              <td className="py-3.5 px-4">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="py-3.5 px-4 text-xs text-gray-500">
                {emissionBlockReason(invoice, companyId) || 'Lista para enviar'}
              </td>
              <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={selectionDisabled}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      <Eye className="h-4 w-4 mr-2" /> Ver detalle
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                      <Edit className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    {invoice.status === 'pending' && (
                      <DropdownMenuItem onClick={() => updateStatus.mutate({ id: invoice.id, status: 'paid' })}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Marcar como pagada
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => deleteInvoice.mutate(invoice.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
