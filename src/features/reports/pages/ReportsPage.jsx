import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useMonthlyChart, useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useCompany } from '@/features/companies/context/CompanyContext'
import { reportService } from '../services/reportService'
import { formatCurrency } from '@/lib/utils'
import { CURRENCY_SYMBOLS } from '@/lib/constants'
import { Download } from 'lucide-react'

const REPORT_MONTHS = 3

function processMonthlyData(rawData = [], period = REPORT_MONTHS) {
  const now = new Date()
  const months = Array.from({ length: period }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - period + index + 1, 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      month: date.toLocaleDateString('es-AR', { month: 'short' }),
      total: 0,
      count: 0,
      paid: 0,
      pending: 0,
    }
  })
  const byMonth = new Map(months.map((month) => [month.key, month]))

  for (const inv of rawData ?? []) {
    const month = byMonth.get(inv.key ?? inv.issue_date?.slice(0, 7))
    if (!month) continue

    if (inv.key) {
      month.total += Number(inv.facturado ?? 0)
      month.count += Number(inv.count ?? 0)
      month.paid += Number(inv.paid ?? 0)
      month.pending += Number(inv.pending ?? 0)
    } else if (inv.type === 'receivable') {
      month.total += Number(inv.total_amount ?? 0)
      month.count++
      if (inv.status === 'paid') month.paid++
      if (inv.status === 'pending') month.pending++
    }
  }

  return months
}

/**
 * Agrupa facturas por moneda y calcula totales por cada una.
 * Req 15.4 — multi-moneda
 */
function groupByCurrency(invoices = []) {
  const groups = {}
  invoices.forEach((inv) => {
    const currency = inv.moneda ?? 'ARS'
    if (!groups[currency]) {
      groups[currency] = { currency, total: 0, collected: 0, pending: 0, count: 0 }
    }
    groups[currency].total += Number(inv.total_amount ?? 0)
    groups[currency].count++
    if (inv.status === 'paid') {
      groups[currency].collected += Number(inv.total_amount ?? 0)
    } else {
      groups[currency].pending += Number(inv.total_amount ?? 0)
    }
  })
  return Object.values(groups)
}

export default function ReportsPage() {
  const [flowType, setFlowType] = useState('all')
  const [exporting, setExporting] = useState(false)
  const { company } = useCompany()
  const { data: rawData } = useMonthlyChart(REPORT_MONTHS)
  const { data: allInvoices } = useInvoices({ pageSize: 500 })
  const chartData = processMonthlyData(rawData, REPORT_MONTHS)
  const currencyGroups = groupByCurrency(allInvoices)

  const totalRevenue = chartData.reduce((acc, m) => acc + m.total, 0)
  const totalInvoices = chartData.reduce((acc, m) => acc + m.count, 0)

  const handleExport = async () => {
    if (!company?.id) return
    setExporting(true)
    try {
      const rows = await reportService.getInvoicesForExport({
        companyId: company.id,
        type: flowType !== 'all' ? flowType : undefined,
      })
      reportService.exportToCsv(rows, `reporte_${flowType}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-blue-400/80">// análisis</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis financiero de tu empresa</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={flowType} onValueChange={setFlowType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo de flujo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="receivable">Cuentas a cobrar</SelectItem>
              <SelectItem value="payable">Cuentas a pagar</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Ingresos totales</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">Últimos {REPORT_MONTHS} meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Facturas emitidas</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalInvoices}</p>
            <p className="text-xs text-gray-400 mt-1">Últimos {REPORT_MONTHS} meses</p>
          </CardContent>
        </Card>
      </div>

      {/* Totales por moneda — Req 15.4 */}
      {currencyGroups.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Totales por moneda</CardTitle>
            <CardDescription>Desglose de facturas agrupadas por moneda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {currencyGroups.map((g) => (
                <div key={g.currency} className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-700">{CURRENCY_SYMBOLS[g.currency] ?? g.currency}</span>
                    <span className="text-sm font-semibold text-gray-600">{g.currency}</span>
                    <span className="ml-auto text-xs text-gray-400">{g.count} facturas</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total facturado</span>
                      <span className="font-medium">{g.currency === 'ARS' ? formatCurrency(g.total) : `${CURRENCY_SYMBOLS[g.currency] ?? g.currency} ${g.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cobrado</span>
                      <span className="font-medium text-green-600">{g.currency === 'ARS' ? formatCurrency(g.collected) : `${CURRENCY_SYMBOLS[g.currency] ?? g.currency} ${g.collected.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pendiente</span>
                      <span className="font-medium text-amber-600">{g.currency === 'ARS' ? formatCurrency(g.pending) : `${CURRENCY_SYMBOLS[g.currency] ?? g.currency} ${g.pending.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por mes</CardTitle>
              <CardDescription>Total facturado en el período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3d8c4" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6f614c' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6f614c' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(v), 'Ingresos']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e3d8c4', fontSize: '13px', background: '#fffdf9', color: '#241d15' }}
                  />
                  <Bar dataKey="total" fill="#e5693e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Facturas por mes</CardTitle>
              <CardDescription>Pagadas vs pendientes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3d8c4" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6f614c' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6f614c' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e3d8c4', fontSize: '13px', background: '#fffdf9', color: '#241d15' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#6f614c' }} />
                  <Line type="monotone" dataKey="paid" stroke="#678c54" strokeWidth={2} name="Pagadas" dot={false} />
                  <Line type="monotone" dataKey="pending" stroke="#d8941f" strokeWidth={2} name="Pendientes" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
