import {
  IconChartBar,
  IconClipboardCheck,
  IconHeartHandshake,
  IconInbox,
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/use-appeals'
import {
  formatDeltaPercent,
  normalizeDashboard,
} from '@/lib/appeals-data'
import { cn } from '@/lib/utils'
import type { AppealMode } from '@/lib/api'

const cardWrapClass =
  'grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card'

export function SectionCards({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useDashboard(mode)

  if (isPending || !data) {
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

  const dashboard = normalizeDashboard(data)
  const { total, summary, comparison } = dashboard
  const monthCount = Math.max(dashboard.byMonth.length, 1)
  const currentMonthlyAverage = total / monthCount
  const previousMonthlyAverage = comparison.previousTotal / monthCount
  const missingShare = total
    ? (summary.justificationMissingCount / total) * 100
    : 0
  const metric = (current: number, previous: number) => ({
    current,
    previous,
    delta: current - previous,
    deltaPercent:
      previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100,
  })
  const cards = [
    {
      description: 'Обращения',
      ...metric(total, comparison.previousTotal),
      icon: IconInbox,
      value: total.toLocaleString('ru-RU'),
      tone: 'badIncrease',
      footTitle: `${comparison.previousYear}: ${comparison.previousTotal.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${total.toLocaleString('ru-RU')}`,
    },
    {
      description: 'Среднемесячно',
      ...metric(currentMonthlyAverage, previousMonthlyAverage),
      icon: IconChartBar,
      value: currentMonthlyAverage.toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
      }),
      tone: 'badIncrease',
      footTitle: `Нагрузка за ${monthCount} мес. сопоставимого периода`,
      footMeta: `${comparison.previousYear}: ${previousMonthlyAverage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} · ${comparison.currentYear}: ${currentMonthlyAverage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`,
    },
    {
      description: 'Без оценки',
      current: summary.justificationMissingCount,
      previous: 0,
      delta: summary.justificationMissingCount,
      deltaPercent: missingShare,
      icon: IconClipboardCheck,
      value: summary.justificationMissingCount.toLocaleString('ru-RU'),
      badgeText: `${missingShare.toFixed(1).replace('.', ',')}%`,
      tone: 'badIncrease',
      footTitle: 'Требуют ручной аннотации',
      footMeta: `Оценено: ${(summary.justifiedCount + summary.unjustifiedCount).toLocaleString('ru-RU')} · ${missingShare.toFixed(1).replace('.', ',')}% без оценки`,
    },
    {
      description: 'Благодарности',
      ...metric(summary.gratitudeCount, comparison.previousSummary.gratitudeCount),
      icon: IconHeartHandshake,
      value: summary.gratitudeCount.toLocaleString('ru-RU'),
      tone: 'goodIncrease',
      footTitle: `${comparison.previousYear}: ${comparison.previousSummary.gratitudeCount.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${summary.gratitudeCount.toLocaleString('ru-RU')}`,
    },
  ]

  return (
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
                {card.badgeText ?? formatDeltaPercent(card.deltaPercent)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {card.footTitle}
            </div>
            {card.footMeta && (
              <div className="text-muted-foreground">
                {card.footMeta}
              </div>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
