import {
  IconBuildingHospital,
  IconCircleCheck,
  IconClipboardCheck,
  IconFileX,
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
  'grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card'

type CardTone = 'badIncrease' | 'goodIncrease' | 'warning'
type DashboardCard = {
  description: string
  current: number
  previous: number
  delta: number
  deltaPercent: number | null
  icon: typeof IconInbox
  value: string
  tone: CardTone
  footTitle: string
  footMeta?: string
  badgeText?: string
}

export function SectionCards({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useDashboard(mode)

  if (isPending || !data) {
    return (
      <div className={cardWrapClass}>
        {Array.from({ length: 6 }).map((_, i) => (
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
  const shareText = (count: number) =>
    total ? `${((count / total) * 100).toFixed(1).replace('.', ',')}%` : '0,0%'
  const metric = (current: number, previous: number) => ({
    current,
    previous,
    delta: current - previous,
    deltaPercent:
      previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100,
  })
  const cards: DashboardCard[] = [
    {
      description: 'Обращения',
      ...metric(total, comparison.previousTotal),
      icon: IconInbox,
      value: total.toLocaleString('ru-RU'),
      tone: 'badIncrease',
      footTitle: `${comparison.previousYear}: ${comparison.previousTotal.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${total.toLocaleString('ru-RU')}`,
    },
    {
      description: 'Прекращено',
      ...metric(summary.discontinuedCount, comparison.previousSummary.discontinuedCount),
      icon: IconFileX,
      value: summary.discontinuedCount.toLocaleString('ru-RU'),
      tone: 'warning',
      footTitle: `${comparison.previousYear}: ${comparison.previousSummary.discontinuedCount.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${summary.discontinuedCount.toLocaleString('ru-RU')}`,
      footMeta: `${shareText(summary.discontinuedCount)} от обращений`,
    },
    {
      description: 'Обоснованные',
      ...metric(summary.justifiedCount, comparison.previousSummary.justifiedCount),
      icon: IconCircleCheck,
      value: summary.justifiedCount.toLocaleString('ru-RU'),
      tone: 'goodIncrease',
      footTitle: `${comparison.previousYear}: ${comparison.previousSummary.justifiedCount.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${summary.justifiedCount.toLocaleString('ru-RU')}`,
      footMeta: `${shareText(summary.justifiedCount)} от обращений`,
    },
    {
      description: 'Не задано',
      ...metric(
        summary.justificationMissingCount,
        comparison.previousSummary.justificationMissingCount,
      ),
      icon: IconClipboardCheck,
      value: summary.justificationMissingCount.toLocaleString('ru-RU'),
      tone: 'badIncrease',
      footTitle: `${comparison.previousYear}: ${comparison.previousSummary.justificationMissingCount.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${summary.justificationMissingCount.toLocaleString('ru-RU')}`,
      footMeta: `${shareText(summary.justificationMissingCount)} от обращений`,
    },
    {
      description: 'Без отделения',
      ...metric(summary.departmentMissingCount, comparison.previousSummary.departmentMissingCount),
      icon: IconBuildingHospital,
      value: summary.departmentMissingCount.toLocaleString('ru-RU'),
      tone: 'badIncrease',
      footTitle: `${comparison.previousYear}: ${comparison.previousSummary.departmentMissingCount.toLocaleString('ru-RU')} · ${comparison.currentYear}: ${summary.departmentMissingCount.toLocaleString('ru-RU')}`,
      footMeta: `${shareText(summary.departmentMissingCount)} от обращений`,
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
                  card.tone === 'warning' &&
                    card.delta > 0 &&
                    'border-amber-500/30 bg-amber-500/5 text-amber-600',
                  card.tone === 'warning' &&
                    card.delta < 0 &&
                    'border-positive/30 bg-positive/5 text-positive',
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
