import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  IconAlertTriangle,
  IconChartBar,
  IconInbox,
  IconStar,
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DepartmentDistributionTabs } from '@/components/dashboard-departments'
import { DepartmentProfileTrendChart } from '@/components/department-profile-trend-chart'
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
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { usePos } from '@/hooks/use-pos'
import { formatDeltaPercent } from '@/lib/appeals-data'
import { buildDepartmentDashboard } from '@/lib/department-dashboard'
import type { PosMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

const cardWrapClass =
  'grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card'

const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

const PERIODS = [
  { value: '3', label: 'I квартал', months: 3 },
  { value: '6', label: 'Полугодие', months: 6 },
  { value: '9', label: '9 месяцев', months: 9 },
  { value: '12', label: 'Год', months: 12 },
] as const

type CountRow = {
  name: string
  count: number
  previousCount: number
  delta: number
  deltaPercent: number | null
}

type MonthRow = {
  month: string
  count: number
  previousCount: number
  delta: number
}

type PosComparison = {
  currentYear: number
  previousYear: number
  cutoffMonthDay: string
  current: PosMessage[]
  previous: PosMessage[]
  byMonth: MonthRow[]
}

type PosCard = {
  description: string
  value: string
  icon: Icon
  tone: 'badIncrease' | 'goodIncrease'
  footTitle: string
  footMeta?: string
  delta: number
  deltaPercent: number | null
}

function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`
}

function yearOf(item: PosMessage): number {
  return item.year || Number(item.dateIso.slice(0, 4)) || 0
}

function monthOf(item: PosMessage): number {
  return item.month || Number(item.dateIso.slice(5, 7)) || 0
}

function inComparableWindow(
  item: PosMessage,
  year: number,
  cutoffMonthDay: string,
): boolean {
  if (!item.dateIso || yearOf(item) !== year) return false
  return item.dateIso.slice(5) <= cutoffMonthDay
}

function buildPosComparison(items: PosMessage[]): PosComparison {
  const dated = items.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dateIso))
  const currentYear = Math.max(...dated.map(yearOf), 0)
  const previousYear = currentYear ? currentYear - 1 : 0
  const currentYearItems = dated.filter((item) => yearOf(item) === currentYear)
  const cutoffMonthDay =
    currentYearItems
      .map((item) => item.dateIso.slice(5))
      .sort()
      .at(-1) ?? '12-31'
  const current = dated.filter((item) =>
    inComparableWindow(item, currentYear, cutoffMonthDay),
  )
  const previous = dated.filter((item) =>
    inComparableWindow(item, previousYear, cutoffMonthDay),
  )
  const cutoffMonth = Number(cutoffMonthDay.slice(0, 2)) || 12

  return {
    currentYear,
    previousYear,
    cutoffMonthDay,
    current,
    previous,
    byMonth: Array.from({ length: cutoffMonth }, (_, index) => {
      const month = index + 1
      const count = current.filter((item) => monthOf(item) === month).length
      const previousCount = previous.filter((item) => monthOf(item) === month).length
      return {
        month: String(month).padStart(2, '0'),
        count,
        previousCount,
        delta: count - previousCount,
      }
    }),
  }
}

function buildComparableCounts(
  current: PosMessage[],
  previous: PosMessage[],
  getValue: (m: PosMessage) => string,
): CountRow[] {
  const count = (items: PosMessage[]) => {
    const counts = new Map<string, number>()
    for (const item of items) {
      const name = getValue(item).trim() || '—'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return counts
  }
  const currentCounts = count(current)
  const previousCounts = count(previous)
  return [...new Set([...currentCounts.keys(), ...previousCounts.keys()])]
    .map((name) => {
      const itemCount = currentCounts.get(name) ?? 0
      const previousCount = previousCounts.get(name) ?? 0
      return {
        name,
        count: itemCount,
        previousCount,
        delta: itemCount - previousCount,
        deltaPercent: percentChange(itemCount, previousCount),
      }
    })
    .sort((a, b) => b.count - a.count || b.previousCount - a.previousCount)
}

function summarize(items: PosMessage[]) {
  const total = items.length
  const rated = items.filter((m) => m.rating !== null)
  const positive = rated.filter((m) => (m.rating ?? 0) >= 4).length
  const avgRating = rated.length
    ? rated.reduce((sum, m) => sum + (m.rating ?? 0), 0) / rated.length
    : 0
  const fastTrack = items.filter((m) => /да/i.test(m.fastTrack)).length
  const fz59 = items.filter((m) => /59/.test(m.fz) || /да/i.test(m.chose59fz)).length
  const justified = items.filter((m) => m.manualFields?.isJustified === true).length
  const unjustified = items.filter((m) => m.manualFields?.isJustified === false).length
  const justificationMissing = total - justified - unjustified
  return {
    total,
    ratedCount: rated.length,
    positive,
    avgRating,
    fastTrack,
    fz59,
    justified,
    unjustified,
    justificationMissing,
  }
}

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

function PosTrendChart({ comparison }: { comparison: PosComparison }) {
  const isMobile = useIsMobile()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [selectedPeriod, setSelectedPeriod] = React.useState('current')
  const availableMonths = comparison.byMonth.length
  const visibleMonths =
    selectedPeriod === 'current'
      ? availableMonths
      : Math.min(Number(selectedPeriod), availableMonths)
  const chartData = comparison.byMonth.slice(0, visibleMonths)
  const chartConfig = {
    previousCount: {
      label: `${comparison.previousYear} · прошлый`,
      color: 'var(--comparison-previous)',
    },
    count: {
      label: `${comparison.currentYear} · текущий`,
      color: 'var(--primary)',
    },
  } satisfies ChartConfig

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Динамика сообщений ПОС</CardTitle>
        <CardDescription>
          Сопоставимый период: {comparison.previousYear} и{' '}
          {comparison.currentYear}, до {comparison.cutoffMonthDay}
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
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillPosPreviousYear" x1="0" y1="0" x2="0" y2="1">
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
              <linearGradient id="fillPosCurrentYear" x1="0" y1="0" x2="0" y2="1">
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
              dataKey="previousCount"
              type="natural"
              fill="url(#fillPosPreviousYear)"
              stroke="var(--color-previousCount)"
              strokeWidth={2}
              strokeDasharray="6 5"
              animationBegin={0}
              animationDuration={700}
              animationEasing="ease-out"
              isAnimationActive={!prefersReducedMotion}
            />
            <Area
              dataKey="count"
              type="natural"
              fill="url(#fillPosCurrentYear)"
              stroke="var(--color-count)"
              strokeWidth={3}
              animationBegin={180}
              animationDuration={900}
              animationEasing="ease-out"
              isAnimationActive={!prefersReducedMotion}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function DistributionCard({
  title,
  description,
  rows,
  barClass,
  countClass,
  currentYear,
  previousYear,
}: {
  title: string
  description?: string
  rows: CountRow[]
  barClass: string
  countClass: string
  currentYear: number
  previousYear: number
}) {
  const max = Math.max(
    ...rows.flatMap((row) => [row.count, row.previousCount]),
    1,
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length ? (
          rows.map((r) => (
            <div key={r.name} className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="truncate" title={r.name}>
                  {r.name}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                    r.delta > 0 && 'bg-destructive/10 text-destructive',
                    r.delta < 0 && 'bg-positive/10 text-positive',
                    r.delta === 0 && 'bg-muted text-muted-foreground',
                  )}
                >
                  {formatDeltaPercent(r.deltaPercent)}
                </span>
              </div>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{previousYear}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-muted-foreground/45"
                    style={{ width: `${(r.previousCount / max) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">
                  {r.previousCount}
                </span>
                <span className={countClass}>{currentYear}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', barClass)}
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
                <span className={cn('text-right font-medium tabular-nums', countClass)}>
                  {r.count}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Нет данных</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PosDashboard() {
  const { data, isPending } = usePos()
  const items = React.useMemo(() => data?.items ?? [], [data])

  const stats = React.useMemo(() => {
    const comparison = buildPosComparison(items)
    const current = summarize(comparison.current)
    const previous = summarize(comparison.previous)
    const monthCount = Math.max(comparison.byMonth.length, 1)
    return {
      comparison,
      current,
      previous,
      monthCount,
      departments: buildDepartmentDashboard(items),
      bySource: buildComparableCounts(
        comparison.current,
        comparison.previous,
        (m) => m.source,
      ),
      byCategory: buildComparableCounts(
        comparison.current,
        comparison.previous,
        (m) => m.category,
      ),
      bySubcategory: buildComparableCounts(
        comparison.current,
        comparison.previous,
        (m) => m.subcategory,
      ).slice(0, 8),
    }
  }, [items])

  if (isPending) {
    return (
      <div className={cardWrapClass}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-8 w-20" />
            </CardHeader>
            <CardFooter>
              <Skeleton className="h-4 w-40" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  const metric = (current: number, previous: number) => ({
    current,
    previous,
    delta: current - previous,
    deltaPercent: percentChange(current, previous),
  })
  const currentMonthlyAverage = stats.current.total / stats.monthCount
  const previousMonthlyAverage = stats.previous.total / stats.monthCount
  const cards: PosCard[] = [
    {
      description: 'Сообщения ПОС',
      ...metric(stats.current.total, stats.previous.total),
      value: stats.current.total.toLocaleString('ru-RU'),
      icon: IconInbox,
      tone: 'badIncrease',
      footTitle: `${stats.comparison.previousYear}: ${stats.previous.total.toLocaleString('ru-RU')} · ${stats.comparison.currentYear}: ${stats.current.total.toLocaleString('ru-RU')}`,
    },
    {
      description: 'Среднемесячно',
      ...metric(currentMonthlyAverage, previousMonthlyAverage),
      value: currentMonthlyAverage.toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
      }),
      icon: IconChartBar,
      tone: 'badIncrease',
      footTitle: `Нагрузка за ${stats.monthCount} мес. сопоставимого периода`,
      footMeta: `${stats.comparison.previousYear}: ${previousMonthlyAverage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} · ${stats.comparison.currentYear}: ${currentMonthlyAverage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`,
    },
    {
      description: 'Положительных (4-5)',
      ...metric(stats.current.positive, stats.previous.positive),
      value: stats.current.positive.toLocaleString('ru-RU'),
      icon: IconStar,
      tone: 'goodIncrease',
      footTitle: `Оценено ${stats.current.ratedCount} · средняя ${stats.current.avgRating
        .toFixed(1)
        .replace('.', ',')}`,
      footMeta: `${stats.comparison.previousYear}: ${pct(stats.previous.positive, stats.previous.ratedCount)} · ${stats.comparison.currentYear}: ${pct(stats.current.positive, stats.current.ratedCount)}`,
    },
    {
      description: 'Обоснованные',
      ...metric(stats.current.justified, stats.previous.justified),
      value: stats.current.justified.toLocaleString('ru-RU'),
      icon: IconAlertTriangle,
      tone: 'badIncrease',
      footTitle: `Не обосновано: ${stats.current.unjustified.toLocaleString('ru-RU')} · не задано: ${stats.current.justificationMissing.toLocaleString('ru-RU')}`,
    },
  ]

  return (
    <>
      <div className={cardWrapClass}>
        {cards.map((card) => (
          <Card key={card.description} className="@container/card">
            <CardHeader>
              <CardDescription>{card.description}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {card.value}
              </CardTitle>
              <CardAction>
                <Badge
                  variant="outline"
                  className={cn(
                    card.tone === 'badIncrease' &&
                      card.delta > 0 &&
                      'border-destructive/30 bg-destructive/5 text-destructive',
                    card.tone === 'badIncrease' &&
                      card.delta < 0 &&
                      'border-positive/30 bg-positive/5 text-positive',
                    card.tone === 'goodIncrease' &&
                      card.delta > 0 &&
                      'border-positive/30 bg-positive/5 text-positive',
                    card.tone === 'goodIncrease' &&
                      card.delta < 0 &&
                      'border-destructive/30 bg-destructive/5 text-destructive',
                  )}
                >
                  <card.icon />
                  {formatDeltaPercent(card.deltaPercent)}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {card.footTitle}
              </div>
              {card.footMeta && (
                <div className="text-muted-foreground">{card.footMeta}</div>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="px-4 lg:px-6">
        <PosTrendChart comparison={stats.comparison} />
      </div>

      <div className="px-4 lg:px-6">
        <DepartmentProfileTrendChart
          records={items}
          title="Динамика по профилям"
          description="сообщения ПОС"
          isPending={isPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
        <DistributionCard
          title="Источники"
          description="Канал поступления"
          rows={stats.bySource}
          barClass="bg-accent-source"
          countClass="text-accent-source"
          currentYear={stats.comparison.currentYear}
          previousYear={stats.comparison.previousYear}
        />
        <DistributionCard
          title="Категории"
          rows={stats.byCategory}
          barClass="bg-positive"
          countClass="text-positive"
          currentYear={stats.comparison.currentYear}
          previousYear={stats.comparison.previousYear}
        />
        <DistributionCard
          title="Топ подкатегорий"
          description="8 самых частых тем"
          rows={stats.bySubcategory}
          barClass="bg-primary"
          countClass="text-primary"
          currentYear={stats.comparison.currentYear}
          previousYear={stats.comparison.previousYear}
        />
        <DistributionCard
          title="Фаст-трек"
          description="Сравнение быстрых сообщений"
          rows={[
            {
              name: 'Фаст-трек',
              count: stats.current.fastTrack,
              previousCount: stats.previous.fastTrack,
              delta: stats.current.fastTrack - stats.previous.fastTrack,
              deltaPercent: percentChange(
                stats.current.fastTrack,
                stats.previous.fastTrack,
              ),
            },
            {
              name: 'По 59-ФЗ',
              count: stats.current.fz59,
              previousCount: stats.previous.fz59,
              delta: stats.current.fz59 - stats.previous.fz59,
              deltaPercent: percentChange(stats.current.fz59, stats.previous.fz59),
            },
          ]}
          barClass="bg-primary"
          countClass="text-primary"
          currentYear={stats.comparison.currentYear}
          previousYear={stats.comparison.previousYear}
        />
      </div>

      <div className="px-4 lg:px-6">
        <DepartmentDistributionTabs
          dashboard={stats.departments}
          subject="сообщений ПОС"
        />
      </div>
    </>
  )
}
