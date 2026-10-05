const amount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export const DASHBOARD_MONTHS = 3

/** Agrupa facturas por mes de emisión y completa los meses sin movimientos. */
export function buildMonthlyMetrics(rows = [], today = new Date(), count = DASHBOARD_MONTHS) {
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - count + index + 1, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const shortMonth = new Intl.DateTimeFormat('es-AR', { month: 'short' })
      .format(date).replace('.', '')

    return {
      key,
      month: shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1),
      label: new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date),
      facturado: 0,
      ingresos: 0,
      gastos: 0,
    }
  })
  const byMonth = new Map(months.map((month) => [month.key, month]))

  for (const row of rows ?? []) {
    const key = row.key ?? row.issue_date?.slice(0, 7)
    const month = byMonth.get(key)
    if (!month) continue

    // El modo demo ya trae los totales agrupados; Supabase devuelve una fila por factura.
    if (row.key) {
      month.facturado += amount(row.facturado)
      month.ingresos += amount(row.ingresos)
      month.gastos += amount(row.gastos)
    } else if (row.type === 'receivable') {
      month.facturado += amount(row.total_amount)
      month.ingresos += amount(row.total_paid)
    } else if (row.type === 'payable') {
      month.gastos += amount(row.total_paid)
    }
  }

  return months
}

/** Sin base positiva no hay porcentaje comparable. */
export function getMonthlyChange(current, previous) {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}
