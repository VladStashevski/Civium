import * as React from 'react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

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
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import {
  buildDepartmentProfileTrend,
  type DepartmentProfileTrend,
} from '@/lib/department-dashboard'
import type { Appeal, PosMessage } from '@/lib/api'

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

const PROFILE_COLORS = [
  'var(--primary)',
  'var(--positive)',
  'var(--accent-source)',
  'var(--destructive)',
  'var(--comparison-previous)',
]

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

function shortProfileName(profile: string): string {
  return profile.replace(/\s+профиль$/i, '')
}

export function DepartmentProfileTrendChart({
  records = [],
  trend: trendProp,
  title,
  description,
  isPending,
}: {
  records?: (Appeal | PosMessage)[]
  trend?: DepartmentProfileTrend
  title: string
  description: string
  isPending?: boolean
}) {
  const isMobile = useIsMobile()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [selectedPeriod, setSelectedPeriod] = React.useState('current')
  const trend = React.useMemo(
    () => trendProp ?? buildDepartmentProfileTrend(records),
    [records, trendProp],
  )
  const profileEntries = trend.profiles.map((profile, index) => ({
    profile,
    currentKey: `profile${index}Current`,
    previousKey: `profile${index}Previous`,
    color: PROFILE_COLORS[index % PROFILE_COLORS.length],
  }))
  const availableMonths = trend.rows.length
  const visibleMonths =
    selectedPeriod === 'current'
      ? availableMonths
      : Math.min(Number(selectedPeriod), availableMonths)
  const chartData = trend.rows.slice(0, visibleMonths).map((row) => {
    const item: Record<string, number | string> = { month: row.month }
    for (const entry of profileEntries) {
      item[entry.currentKey] = row.current[entry.profile] ?? 0
      item[entry.previousKey] = row.previous[entry.profile] ?? 0
    }
    return item
  })
  const chartConfig = Object.fromEntries(
    profileEntries.flatMap((entry) => [
      [
        entry.previousKey,
        {
          label: `${shortProfileName(entry.profile)} · ${trend.previousYear}`,
          color: entry.color,
        },
      ],
      [
        entry.currentKey,
        {
          label: shortProfileName(entry.profile),
          color: entry.color,
        },
      ],
    ]),
  ) satisfies ChartConfig

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} · сопоставимый период: {trend.previousYear} и{' '}
          {trend.currentYear}
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
            <LineChart data={chartData}>
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
                    indicator="line"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {profileEntries.map((entry, index) => (
                <React.Fragment key={entry.profile}>
                  <Line
                    dataKey={entry.previousKey}
                    name={`${shortProfileName(entry.profile)} · ${trend.previousYear}`}
                    type="natural"
                    stroke={`var(--color-${entry.previousKey})`}
                    strokeWidth={1.75}
                    strokeDasharray="6 5"
                    legendType="none"
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationBegin={120 * index}
                    animationDuration={700}
                    animationEasing="ease-out"
                    isAnimationActive={!prefersReducedMotion}
                  />
                  <Line
                    dataKey={entry.currentKey}
                    name={shortProfileName(entry.profile)}
                    type="natural"
                    stroke={`var(--color-${entry.currentKey})`}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationBegin={160 * index + 120}
                    animationDuration={850}
                    animationEasing="ease-out"
                    isAnimationActive={!prefersReducedMotion}
                  />
                </React.Fragment>
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
