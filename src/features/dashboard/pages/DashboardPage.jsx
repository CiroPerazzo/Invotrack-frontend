import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, FileText, Wallet, FlaskConical, Plus
} from 'lucide-react'
import { useDashboardStats, useMonthlyChart } from '@/features/invoices/hooks/useInvoices'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useCompany } from '@/features/companies/context/CompanyContext'
import { formatCurrency } from '@/lib/utils'
import RevenueChart from '@/features/dashboard/components/RevenueChart'
import MonthlyMetricCard from '@/features/dashboard/components/MonthlyMetricCard'
import RecentInvoices from '@/features/dashboard/components/RecentInvoices'
import { buildMonthlyMetrics, DASHBOARD_MONTHS } from '@/features/dashboard/lib/monthlyMetrics'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Vista temporal para revisar el diseño de las tres tarjetas en desarrollo.
const METRIC_CARD_PREVIEW = {
  facturado: [220000, 680000, 410000],
  ingresos: [170000, 145000, 365000],
  gastos: [110000, 220000, 95000],
}

// ── Bloque de estado (contador) ──────────────────────────────
function StatusBlock({ label, count, amount, color, isLoading }) {
  const colors = {
    green:   { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500/10 ring-emerald-500/20' },
    amber:   { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-500/10 ring-amber-500/20' },
    red:     { dot: 'bg-red-500',     text: 'text-red-600',     bg: 'bg-red-500/10 ring-red-500/20' },
    neutral: { dot: 'bg-gray-400',    text: 'text-gray-700',    bg: 'bg-gray-100 ring-gray-200' },
  }
  const c = colors[color]

  if (isLoading) return <Skeleton className="h-20 rounded-xl" />

  return (
    <div className={cn('rounded-xl p-4 flex items-center gap-4 ring-1 ring-inset', c.bg)}>
      <span className={cn('h-3 w-3 rounded-full flex-shrink-0 shadow-[0_0_10px_currentColor]', c.dot)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', c.text)}>{label}</p>
        {amount !== undefined && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{formatCurrency(amount)}</p>
        )}
      </div>
      <span className={cn('money text-2xl font-bold', c.text)}>{count}</span>
    </div>
  )
}

// ── Separador visual con label ───────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="font-mono text-[10px] font-semibold text-gray-500 uppercase tracking-[0.22em] whitespace-nowrap">
        {children}
      </p>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-100 to-transparent" />
    </div>
  )
}

// ── Dashboard principal ──────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { company } = useCompany()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: chartData, isLoading: chartLoading } = useMonthlyChart(DASHBOARD_MONTHS)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuario'
  const now = new Date()
  const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const monthlyMetrics = buildMonthlyMetrics(chartData, now)
  const isMetricPreview = import.meta.env.DEV
  const cardMetrics = isMetricPreview
    ? monthlyMetrics.map((month, index) => ({
        ...month,
        facturado: METRIC_CARD_PREVIEW.facturado[index],
        ingresos: METRIC_CARD_PREVIEW.ingresos[index],
        gastos: METRIC_CARD_PREVIEW.gastos[index],
      }))
    : monthlyMetrics
  const currentCardMetrics = cardMetrics.at(-1)
  const resultado = stats?.resultado ?? 0

  return (
    <div className="space-y-8">

      {/* Banner modo demo */}
      {company?._isDemo && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-500">
          <FlaskConical className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Modo demo</strong> — Estás viendo datos de ejemplo de "Tech Solutions S.A.".
            Para usar tus propios datos, <button className="underline font-medium" onClick={() => navigate('/onboarding')}>creá tu empresa</button>.
          </span>
        </div>
      )}

      {/* ── Hero misión control ── */}
      <div className="relative glass rounded-2xl p-6 sm:p-8 scan-frame scan-active overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-tl from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/40 dark:via-blue-500/20 dark:to-blue-500/8" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-500">resumen financiero · {monthName}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Hola, <span className="aurora-text">{firstName}</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">Controlá facturación, cobros y gastos desde un solo lugar.</p>
            <Button
              onClick={() => navigate('/invoices/new')}
              className="mt-5 dark:from-[#185FA5] dark:to-[#185FA5] shadow-[0_4px_18px_rgba(37,99,235,0.32)] dark:shadow-[0_4px_18px_rgba(37,99,235,0.32)]"
            >
              <Plus className="h-4 w-4" />
              Nueva factura
            </Button>
          </div>

          <div className="rounded-2xl bg-ink/[0.04] ring-1 ring-inset ring-ink/10 px-6 py-5 text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Resultado neto del mes</p>
            <p className="money text-4xl font-bold text-gray-900 mt-1">
              {statsLoading ? '—' : formatCurrency(resultado)}
            </p>
            <div className="flex gap-5 mt-3 text-xs justify-end">
              <span className="text-gray-500">Ingresado <strong className="text-emerald-600 money">{formatCurrency(stats?.totalIngresado || 0)}</strong></span>
              <span className="text-gray-500">Gastos <strong className="text-red-600 money">{formatCurrency(stats?.totalGastos || 0)}</strong></span>
              <span className="text-gray-500">Pendiente <strong className="text-amber-700 money">{formatCurrency(stats?.totalPendiente || 0)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Métricas financieras ── */}
      <div>
        <SectionLabel>Métricas del mes{isMetricPreview && ' · datos de prueba'}</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MonthlyMetricCard
            title="Facturado"
            value={isMetricPreview ? currentCardMetrics.facturado : stats?.totalFacturado ?? 0}
            metric="facturado"
            data={cardMetrics}
            icon={FileText}
            tone="blue"
            isLoading={!isMetricPreview && (statsLoading || chartLoading)}
          />
          <MonthlyMetricCard
            title="Ingresos"
            value={isMetricPreview ? currentCardMetrics.ingresos : stats?.totalIngresado ?? 0}
            metric="ingresos"
            data={cardMetrics}
            icon={TrendingUp}
            tone="green"
            isLoading={!isMetricPreview && (statsLoading || chartLoading)}
          />
          <MonthlyMetricCard
            title="Gastos"
            value={isMetricPreview ? currentCardMetrics.gastos : stats?.totalGastos ?? 0}
            metric="gastos"
            data={cardMetrics}
            icon={Wallet}
            tone="red"
            isLoading={!isMetricPreview && (statsLoading || chartLoading)}
          />
        </div>
        <div className="mt-6">
          <RevenueChart data={cardMetrics} isLoading={!isMetricPreview && chartLoading} />
        </div>
      </div>

      {/* ── Estado de facturas ── */}
      <div>
        <SectionLabel>Estado de facturas</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusBlock
            label="Pagadas"
            count={stats?.paid ?? '—'}
            amount={stats?.totalIngresado}
            color="green"
            isLoading={statsLoading}
          />
          <StatusBlock
            label="Pendientes"
            count={stats?.pending ?? '—'}
            amount={stats?.totalPendiente}
            color="amber"
            isLoading={statsLoading}
          />
          <StatusBlock
            label="Vencidas"
            count={stats?.overdue ?? '—'}
            color="red"
            isLoading={statsLoading}
          />
          <StatusBlock
            label="Total del mes"
            count={stats?.total ?? '—'}
            color="neutral"
            isLoading={statsLoading}
          />
        </div>
      </div>

      {/* ── Facturas recientes ── */}
      <div>
        <SectionLabel>Actividad reciente</SectionLabel>
        <RecentInvoices />
      </div>

    </div>
  )
}
