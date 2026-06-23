import * as React from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppeals, useDashboard } from '@/hooks/use-appeals'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { formatDeltaPercent, isGratitudeAppeal } from '@/lib/appeals-data'
import {
  clamp,
  hasDeadlineData,
  isOverdue,
  LEVEL_CLASS,
  LEVEL_COLOR,
  riskLevel,
  shortLabel,
} from '@/lib/experiments'
import type { AppealMode } from '@/lib/api'
import { cn } from '@/lib/utils'

type Factor = { key: string; label: string; value: number; hint: string }

const LEVEL_WORD = { low: 'низкий', mid: 'средний', high: 'высокий' } as const

function useRiskFactors(mode: AppealMode) {
  const dashboard = useDashboard(mode)
  const appeals = useAppeals(mode)

  const factors = React.useMemo<Factor[]>(() => {
    const data = dashboard.data
    if (!data) return []
    const items = appeals.data?.items ?? []
    const total = data.total || items.length
    if (!total) return []
    const list: Factor[] = []

    const missing = data.summary.justificationMissingCount
    list.push({
      key: 'noEval',
      label: 'Без ручной оценки',
      value: clamp((missing / total) * 100),
      hint: `${missing} из ${total} без обоснованности`,
    })

    if (hasDeadlineData(items)) {
      const withDeadline = items.filter(
        (item) => item.deadlineStatus && item.deadlineStatus !== 'unknown',
      )
      const overdue = withDeadline.filter(isOverdue).length
      list.push({
        key: 'overdue',
        label: 'Просрочки',
        value: clamp(withDeadline.length ? (overdue / withDeadline.length) * 100 : 0),
        hint: `${overdue} просрочено из ${withDeadline.length}`,
      })
    }

    const growth = data.comparison.deltaPercent
    list.push({
      key: 'growth',
      label: 'Рост к прошлому году',
      value: growth === null ? 50 : clamp(50 + growth * 1.4),
      hint:
        growth === null
          ? 'нет данных за прошлый год'
          : `${formatDeltaPercent(growth)} обращений`,
    })

    const topProfile = [...data.byProfile].sort((a, b) => b.count - a.count)[0]
    if (topProfile) {
      list.push({
        key: 'topProfile',
        label: `Рост «${shortLabel(topProfile.name, 16)}»`,
        value:
          topProfile.deltaPercent === null
            ? 50
            : clamp(50 + topProfile.deltaPercent * 1.4),
        hint: `${topProfile.name}: ${formatDeltaPercent(topProfile.deltaPercent)}`,
      })
    }

    const nonGratitude = items.length
      ? items.filter((item) => !isGratitudeAppeal(item)).length / items.length
      : (total - data.summary.gratitudeCount) / total
    list.push({
      key: 'nonGratitude',
      label: 'Доля жалоб (не благодарности)',
      value: clamp(nonGratitude * 100),
      hint: `благодарностей ${data.summary.gratitudeCount} из ${total}`,
    })

    if (topProfile) {
      list.push({
        key: 'concentration',
        label: 'Концентрация в топ-рубрике',
        value: clamp(topProfile.share),
        hint: `${topProfile.name}: ${topProfile.share}%`,
      })
    }

    return list
  }, [dashboard.data, appeals.data])

  const score = factors.length
    ? Math.round(factors.reduce((sum, f) => sum + f.value, 0) / factors.length)
    : 0

  return {
    factors,
    score,
    isPending: dashboard.isPending || appeals.isPending,
  }
}

function polarPoints(values: number[], radius: number, center: number) {
  return values
    .map((value, index) => {
      const angle = (-90 + (index * 360) / values.length) * (Math.PI / 180)
      const r = (clamp(value) / 100) * radius
      return `${(center + r * Math.cos(angle)).toFixed(1)},${(center + r * Math.sin(angle)).toFixed(1)}`
    })
    .join(' ')
}

function RadarShape({ factors, color }: { factors: Factor[]; color: string }) {
  const center = 100
  const radius = 78
  const grid = [0.25, 0.5, 0.75, 1]
  const axisPoints = factors.map((_, index) => {
    const angle = (-90 + (index * 360) / factors.length) * (Math.PI / 180)
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  })
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="presentation">
      {grid.map((ring) => (
        <polygon
          key={ring}
          points={polarPoints(
            factors.map(() => ring * 100),
            radius,
            center,
          )}
          fill="none"
          className="stroke-border"
          strokeWidth={ring === 1 ? 1.5 : 1}
          strokeOpacity={ring === 1 ? 0.9 : 0.5}
        />
      ))}
      {axisPoints.map((point, index) => (
        <line
          key={index}
          x1={center}
          y1={center}
          x2={point.x}
          y2={point.y}
          className="stroke-border"
          strokeOpacity={0.5}
        />
      ))}
      <polygon
        points={polarPoints(
          factors.map((f) => f.value),
          radius,
          center,
        )}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {factors.map((factor, index) => {
        const angle = (-90 + (index * 360) / factors.length) * (Math.PI / 180)
        const r = (clamp(factor.value) / 100) * radius
        return (
          <circle
            key={factor.key}
            cx={center + r * Math.cos(angle)}
            cy={center + r * Math.sin(angle)}
            r={3}
            fill={color}
          />
        )
      })}
    </svg>
  )
}

export function ExperimentalRiskRadar({ mode }: { mode: AppealMode }) {
  const { factors, score, isPending } = useRiskFactors(mode)
  const reduceMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const level = riskLevel(score)
  const color = LEVEL_COLOR[level]

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Радар риска</CardTitle>
          <CardDescription>
            Сводный операционный риск из 5–6 факторов: чем выше, тем больше зон
            внимания
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="text-muted-foreground">
              эксперимент
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="mx-auto aspect-square w-full max-w-64 rounded-full" />
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ) : !factors.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Недостаточно данных для оценки риска. Загрузите обращения.
            </p>
          ) : (
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div className="relative mx-auto aspect-square w-full max-w-64">
                <RadarShape factors={factors} color={color} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={cn('text-5xl font-semibold tabular-nums', LEVEL_CLASS[level].text)}
                  >
                    {score}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    риск · {LEVEL_WORD[level]}
                  </span>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {factors.map((factor, index) => {
                  const factorLevel = riskLevel(factor.value)
                  return (
                    <li key={factor.key} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate" title={factor.hint}>
                          {factor.label}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 tabular-nums',
                            LEVEL_CLASS[factorLevel].text,
                          )}
                        >
                          {Math.round(factor.value)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', LEVEL_CLASS[factorLevel].bg)}
                          style={{
                            width: `${mounted || reduceMotion ? Math.round(factor.value) : 0}%`,
                            transition: reduceMotion
                              ? undefined
                              : `width 700ms cubic-bezier(0.22,1,0.36,1) ${index * 70}ms`,
                          }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
