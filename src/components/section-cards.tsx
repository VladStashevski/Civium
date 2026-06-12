import {
  IconArrowsExchange,
  IconFolders,
  IconInbox,
  IconStethoscope,
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
  const isChiefDoctor = mode === 'chiefDoctor'
  const sourceKindCount = isChiefDoctor ? summary.channelCount : summary.sourceCount
  const previousSourceKindCount = isChiefDoctor
    ? comparison.previousSummary.channelCount
    : comparison.previousSummary.sourceCount
  const metric = (current: number, previous: number) => ({
    current,
    previous,
    delta: current - previous,
    deltaPercent:
      previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100,
  })
  const cards = [
    {
      description: 'Всего обращений',
      ...metric(total, comparison.previousTotal),
      icon: IconInbox,
      footTitle: `${comparison.previousYear} → ${comparison.currentYear}`,
    },
    {
      description: 'Рубрики',
      ...metric(summary.profileCount, comparison.previousSummary.profileCount),
      icon: isChiefDoctor ? IconStethoscope : IconArrowsExchange,
      footTitle: 'Уникальных рубрик',
    },
    {
      description: 'Обоснованные',
      ...metric(
        summary.justifiedCount,
        comparison.previousSummary.justifiedCount,
      ),
      icon: IconFolders,
      footTitle: `${summary.justificationMissingCount} без оценки`,
    },
    {
      description: isChiefDoctor ? 'Каналы поступления' : 'Источники',
      ...metric(sourceKindCount, previousSourceKindCount),
      icon: IconArrowsExchange,
      footTitle: isChiefDoctor ? 'Каналов 07/19' : 'Источников 07-/01-',
    },
  ]

  return (
    <div className={cardWrapClass}>
      {cards.map((card) => (
        <Card key={card.description} className="@container/card">
          <CardHeader>
            <CardDescription>{card.description}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.current.toLocaleString('ru-RU')}
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className={cn(
                  card.delta > 0 &&
                    'border-destructive/30 bg-destructive/5 text-destructive',
                  card.delta < 0 &&
                    'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
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
            <div className="text-muted-foreground">
              {comparison.previousYear}: {card.previous.toLocaleString('ru-RU')}
              {' · '}
              {comparison.currentYear}: {card.current.toLocaleString('ru-RU')}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
