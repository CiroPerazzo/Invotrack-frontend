import { useMutation, useQueryClient } from '@tanstack/react-query'
import { emitInvoiceBatch } from '@/features/invoices/services/batchEmissionService'
import { QUERY_KEYS } from '@/lib/constants'

export function useBatchEmitCae(companyId, onProgress) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (invoiceIds) => emitInvoiceBatch({ companyId, invoiceIds, onProgress }),
    retry: false,
    onSettled: async (_data, _error, ids) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICES, companyId] }),
        client.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD_STATS, companyId] }),
        client.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_CHART, companyId] }),
        ...ids.map((id) => client.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICE, id, companyId] })),
      ])
    },
  })
}
