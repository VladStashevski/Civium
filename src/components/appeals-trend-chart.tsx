import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useIsMobile } from '@/hooks/use-mobile'
import { useDashboard } from '@/hooks/use-appeals'
import { normalizeDashboard } from '@/lib/appeals-data'
import type { AppealMode } from '@/lib/api'

const MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

const PERIODS = [
  { value: '3', label: 'I квартал', months: 3 },
  { value: '6', label: 'Полугодие', months: 6 },
  { value: '9', label: '9 месяцев', months: 9 },
  { value: '12', label: 'Год', months: 12 },
] as const

function MonthAxisTick({
  x = 0,
  y = 0,
  index = 0,
  lastIndex,
  payload,
}: {
  x?: number
  y?: number
  index?: number
  lastIndex: number
  payload?: { value?: string | number }
}) {
  const textAnchor =
    index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'
  const value = payload?.value
  const label = MONTHS[Number(value) - 1] ?? String(value ?? '')

  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor={textAnchor}
      fill="var(--muted-foreground)"
    >
      {label}
    </text>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

export function AppealsTrendChart({ mode }: { mode: AppealMode }) {
  const isMobile = useIsMobile()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [selectedPeriod, setSelectedPeriod] = React.useState('current')
  const { data, isPending } = useDashboard(mode)
  const dashboard = normalizeDashboard(data)
  const availableMonths = dashboard.byMonth.length
  const visibleMonths =
    selectedPeriod === 'current'
      ? availableMonths
      : Math.min(Number(selectedPeriod), availableMonths)
  const chartData = dashboard.byMonth.slice(0, visibleMonths)
  const chartConfig = {
    previousCount: {
      label: `${dashboard.comparison.previousYear} · прошлый`,
      color: 'var(--comparison-previous)',
    },
    count: {
      label: `${dashboard.comparison.currentYear} · текущий`,
      color: 'var(--primary)',
    },
  } satisfies ChartConfig

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Динамика обращений</CardTitle>
        <CardDescription>
          {mode === 'chiefDoctor' ? 'контур 07/19' : '01-* — Губернатор, 07-* — Депздрав'} · сопоставимый период:{' '}
          {dashboard.comparison.previousYear} и{' '}
          {dashboard.comparison.currentYear}
        </CardDescription>
        <CardAction>
          {!isMobile ? (
            <ToggleGroup
              type="single"
              value={selectedPeriod}
              onValueChange={(value) => value && setSelectedPeriod(value)}
              variant="outline"
              spacing={0}
            >
              {PERIODS.map((period) => (
                <ToggleGroupItem
                  key={period.value}
                  value={period.value}
                  size="sm"
                  disabled={period.months > availableMonths}
                >
                  {period.label}
                </ToggleGroupItem>
              ))}
              <ToggleGroupItem value="current" size="sm">
                Текущий период
              </ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((period) => (
                  <SelectItem
                    key={period.value}
                    value={period.value}
                    disabled={period.months > availableMonths}
                  >
                    {period.label}
                  </SelectItem>
                ))}
                <SelectItem value="current">Текущий период</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isPending ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillPreviousYear" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-previousCount)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-previousCount)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
                <linearGradient id="fillCurrentYear" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.55}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.04}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={isMobile ? 'preserveStartEnd' : 0}
                minTickGap={isMobile ? 16 : 0}
                tick={<MonthAxisTick lastIndex={chartData.length - 1} />}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      MONTHS[Number(value) - 1] ?? String(value)
                    }
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                key={`${mode}-${selectedPeriod}-previous`}
                dataKey="previousCount"
                type="natural"
                fill="url(#fillPreviousYear)"
                stroke="var(--color-previousCount)"
                strokeWidth={2}
                strokeDasharray="6 5"
                animationBegin={0}
                animationDuration={700}
                animationEasing="ease-out"
                isAnimationActive={!prefersReducedMotion}
              />
              <Area
                key={`${mode}-${selectedPeriod}-current`}
                dataKey="count"
                type="natural"
                fill="url(#fillCurrentYear)"
                stroke="var(--color-count)"
                strokeWidth={3}
                animationBegin={180}
                animationDuration={900}
                animationEasing="ease-out"
                isAnimationActive={!prefersReducedMotion}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
