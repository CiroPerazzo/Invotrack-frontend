import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

const SERIES = [
  { key: 'facturado', label: 'Facturado', color: '#378ADD' },
  { key: 'ingresos', label: 'Ingresado', color: '#1D9E75' },
  { key: 'gastos', label: 'Gastado', color: '#E2385A' },
]

// El tooltip muestra solo las series visibles, con sus importes completos.
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-panel-2 border border-gray-100 rounded-xl shadow-2xl shadow-black/40 p-3 text-sm min-w-[160px]">
      <p className="font-semibold capitalize text-gray-700 mb-2">{payload[0]?.payload?.label ?? label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className="font-medium" style={{ color: p.color }}>
            {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// Compara facturación, cobros y gastos por mes de emisión.
export default function RevenueChart({ data = [], isLoading }) {
  const gradientId = useId()
  const [visibleSeries, setVisibleSeries] = useState(() => SERIES.map(({ key }) => key))

  const toggleSeries = (key) => {
    setVisibleSeries((current) => {
      if (!current.includes(key)) return [...current, key]
      return current.length > 1 ? current.filter((item) => item !== key) : current
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="gap-4">
        <div className="space-y-1.5">
          <CardTitle>Evolución mensual</CardTitle>
          <CardDescription>Facturado, ingresado y gastado · últimos {data.length} meses por mes de emisión.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Métricas visibles en el gráfico">
          {SERIES.map(({ key, label, color }) => {
            const selected = visibleSeries.includes(key)
            return (
              <Button
                key={key}
                type="button"
                variant={selected ? 'secondary' : 'outline'}
                size="sm"
                className="disabled:opacity-100"
                aria-pressed={selected}
                disabled={selected && visibleSeries.length === 1}
                onClick={() => toggleSeries(key)}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: color }} aria-hidden="true">
                  {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                {label}
              </Button>
            )
          })}
        </div>
        <p className="text-xs text-gray-500">Elegí una o varias métricas para comparar. Importes en $.</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart accessibilityLayer data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              {SERIES.map(({ key, color }) => (
                <linearGradient key={key} id={`${gradientId}-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 5" strokeWidth={0.5} stroke="var(--color-gray-200)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: 'var(--color-gray-500)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-gray-500)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {SERIES.filter(({ key }) => visibleSeries.includes(key)).map(({ key, label, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId}-${key})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
