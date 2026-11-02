import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoiceService } from '@/features/invoices/services/invoiceService'
import { useCompany } from '@/features/companies/context/CompanyContext'
import { QUERY_KEYS } from '@/lib/constants'
import { useToast } from '@/components/ui/toast'

/**
 * Lista facturas de la empresa activa con filtros opcionales.
 * Req 1.4 — company_id se lee de CompanyContext, nunca hardcodeado.
 *
 * @param {object} filters - { status, type, search, dateFrom, dateTo, page, pageSize }
 * @returns {{ data: object[], count: number, isLoading: boolean, error: Error|null }}
 */
export function useInvoices(filters = {}) {
  const { company } = useCompany()

  const query = useQuery({
    queryKey: [QUERY_KEYS.INVOICES, company?.id, filters],
    queryFn: () => invoiceService.getAll({ ...filters, companyId: company.id }),
    enabled: Boolean(company?.id),
  })

  return {
    data: query.data?.data ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Obtiene una factura por ID con sus ítems y pagos.
 * @param {string|null} id
 */
export function useInvoice(id) {
  const { company } = useCompany()

  return useQuery({
    queryKey: [QUERY_KEYS.INVOICE, id, company?.id],
    queryFn: () => invoiceService.getById(id, company.id),
    enabled: Boolean(id && company?.id),
  })
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * FLUJO "CREAR FACTURA" — paso 3 de 4
 * ──────────────────────────────────────────────────────────────────────────────
 * useCreateInvoice es el hook de React Query que orquesta la mutación.
 *
 * Responsabilidades:
 *  1. Recibir el payload del formulario y agregarle el company_id desde el contexto.
 *  2. Llamar a invoiceService.create() (paso 4) que escribe en Supabase.
 *  3. Al completar con éxito: invalidar el caché de facturas y dashboard para
 *     que las listas y los KPIs se actualicen solos.
 *  4. Mostrar un toast de éxito o error al usuario.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { company } = useCompany()

  return useMutation({
    // mutationFn: recibe el payload del formulario y agrega company_id desde el contexto.
    // company_id identifica a qué empresa pertenece la factura (aislamiento multi-tenant).
    mutationFn: (payload) =>
      invoiceService.create({ ...payload, company_id: company.id }),

    // onSuccess: React Query invalida las queries de facturas y del dashboard,
    // forzando una re-fetching automática para reflejar la factura recién creada.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICES] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD_STATS] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_CHART] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Factura creada', variant: 'success' })
    },

    // onError: si Supabase o la red devuelven un error, se muestra al usuario via toast.
    onError: (err) => {
      toast({ title: 'Error al crear factura', description: err.message, variant: 'error' })
    },
  })
}

/**
 * Actualiza campos de una factura existente.
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ id, ...data }) => invoiceService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICES] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICE, id] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD_STATS] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_CHART] })
      toast({ title: 'Factura actualizada', variant: 'success' })
    },
    onError: (err) => {
      toast({ title: 'Error al actualizar', description: err.message, variant: 'error' })
    },
  })
}

/**
 * Actualiza solo el estado de una factura.
 */
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ id, status }) => invoiceService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICES] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD_STATS] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_CHART] })
      toast({ title: 'Estado actualizado', variant: 'success' })
    },
    onError: (err) => {
      toast({ title: 'Error al actualizar estado', description: err.message, variant: 'error' })
    },
  })
}

/**
 * Elimina una factura (cascada a ítems y pagos via FK).
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (id) => invoiceService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.INVOICES] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DASHBOARD_STATS] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MONTHLY_CHART] })
      toast({ title: 'Factura eliminada', variant: 'success' })
    },
    onError: (err) => {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'error' })
    },
  })
}

/**
 * KPIs del dashboard para la empresa activa.
 */
export function useDashboardStats() {
  const { company } = useCompany()

  return useQuery({
    queryKey: [QUERY_KEYS.DASHBOARD_STATS, company?.id],
    queryFn: () => invoiceService.getDashboardStats(company.id),
    enabled: Boolean(company?.id),
  })
}

/**
 * Datos del gráfico mensual de ingresos vs gastos.
 * @param {number} months - Cantidad de meses hacia atrás (default 3)
 */
export function useMonthlyChart(months = 3) {
  const { company } = useCompany()

  return useQuery({
    queryKey: [QUERY_KEYS.MONTHLY_CHART, company?.id, months],
    queryFn: () => invoiceService.getMonthlyChart(company.id, months),
    enabled: Boolean(company?.id),
  })
}
