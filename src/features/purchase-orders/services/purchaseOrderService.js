import { apiRequest } from '@/lib/apiClient'

const base = (companyId) => `/companies/${encodeURIComponent(companyId)}/purchase-orders`

export const purchaseOrderService = {
  list(companyId, page = 1) { return apiRequest(`${base(companyId)}?page=${page}`) },
  get(companyId, id) { return apiRequest(`${base(companyId)}/${encodeURIComponent(id)}`) },
  create(companyId, data) { return apiRequest(base(companyId), { method: 'POST', body: data }) },
  update(companyId, id, data) { return apiRequest(`${base(companyId)}/${encodeURIComponent(id)}`, { method: 'PUT', body: data }) },
  cancel(companyId, id) { return apiRequest(`${base(companyId)}/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' }) },
  delete(companyId, id) { return apiRequest(`${base(companyId)}/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
  preview(companyId, orderIds) { return apiRequest(`${base(companyId)}/group-preview`, { method: 'POST', body: { orderIds } }) },
  allocate(companyId, invoiceId, allocations) {
    return apiRequest(`/companies/${encodeURIComponent(companyId)}/invoices/${encodeURIComponent(invoiceId)}/purchase-orders`, {
      method: 'POST', body: { allocations },
    })
  },
  createGroupedInvoice(companyId, invoice, items, allocations) {
    return apiRequest(`${base(companyId)}/grouped-invoice`, {
      method: 'POST', body: { invoice, items, allocations },
    })
  },
  forInvoice(companyId, invoiceId) {
    return apiRequest(`/companies/${encodeURIComponent(companyId)}/invoices/${encodeURIComponent(invoiceId)}/purchase-orders`)
  },
}
