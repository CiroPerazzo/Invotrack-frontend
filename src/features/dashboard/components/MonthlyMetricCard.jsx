import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { getMonthlyChange } from '@/features/dashboard/lib/monthlyMetrics'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const palettes = {
  blue: { line: '#185FA5', fill: '#B5D4F4', icon: 'bg-blue-50 text-blue-600' },
  green: { line: '#0F6E56', fill: '#BFE9D8', icon: 'bg-emerald-50 text-emerald-700' },
  red: { line: '#E2385A', fill: '#F9C9D2', icon: 'bg-rose-50 text-rose-600' },
}

function MonthlyTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium capitalize text-slate-500">{point.label}</p>
      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(point[metric])}</p>
    </div>
  )
}

export default function MonthlyMetricCard({ title, value, metric, data, icon: Icon, tone, isLoading }) {
  const palette = palettes[tone]
  const current = data.at(-1)
  const previous = data.at(-2)
  const change = previous ? getMonthlyChange(value, previous[metric]) : null
  const gradientId = `metric-fill-${metric}`

  return (
    <section className="min-w-0 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.045)] sm:p-6" aria-label={`${title} por mes`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', palette.icon)}>
            <Icon className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-slate-950">{title}</h3>
            <p className="text-sm text-slate-500">Este mes</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {isLoading ? <Skeleton className="ml-auto h-8 w-20 rounded-full" /> : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-sm font-semibold tabular-nums text-slate-600">
              {change === null ? '—' : `${change > 0 ? '+' : ''}${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(change)}%`}
            </span>
          )}
          <p className="mt-1 text-[11px] text-slate-400">vs. mes anterior</p>
        </div>
      </div>

      {isLoading ? <Skeleton className="mt-3 h-11 w-3/4" /> : (
        <p className="money mt-3 truncate text-[clamp(1.6rem,2.5vw,2.35rem)] font-bold tracking-tight text-slate-950" title={formatCurrency(value)}>
          {formatCurrency(value)}
        </p>
      )}

      <div className="mt-2 h-36" role="img" aria-label={`${title}: ${data.map((month) => `${month.label} ${formatCurrency(month[metric])}`).join(', ')}`}>
        {isLoading ? <Skeleton className="h-full w-full rounded-xl" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 9, left: 9, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.fill} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={palette.fill} stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical stroke="#E2E8F0" strokeWidth={0.5} strokeDasharray="4 5" horizontal={false} />
              <XAxis dataKey="month" hide />
              <Tooltip content={<MonthlyTooltip metric={metric} />} cursor={false} />
              <Area type="linear" dataKey={metric} stroke={palette.line} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
              {current && <ReferenceDot x={current.month} y={current[metric]} r={4} fill={palette.line} stroke="white" strokeWidth={2} />}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
