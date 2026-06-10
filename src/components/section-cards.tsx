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
import { formatDateIso, shareOfTotal } from '@/lib/appeals-data'

const cardWrapClass =
  'grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card'

export function SectionCards() {
  const { data, isPending } = useDashboard()

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

  const { total, summary, dateRange } = data
  const cards = [
    {
      description: 'Всего обращений',
      value: total.toLocaleString('ru-RU'),
      icon: IconInbox,
      badge: `${summary.profileCount} рубрик`,
      footTitle: 'За весь период наблюдений',
      footDesc: `${formatDateIso(dateRange.from)} — ${formatDateIso(dateRange.to)}`,
    },
    {
      description: 'На имя главного врача',
      value: summary.chiefDoctorCount.toLocaleString('ru-RU'),
      icon: IconStethoscope,
      badge: `${shareOfTotal(summary.chiefDoctorCount, total)}%`,
      footTitle: 'Поступили напрямую',
      footDesc: `из ${total.toLocaleString('ru-RU')} обращений`,
    },
    {
      description: 'Перенаправлено',
      value: summary.redirectedCount.toLocaleString('ru-RU'),
      icon: IconArrowsExchange,
      badge: `${shareOfTotal(summary.redirectedCount, total)}%`,
      footTitle: 'Переданы в инстанции',
      footDesc: 'из вышестоящих органов',
    },
    {
      description: 'Источники и охват',
      value: summary.sourceCount.toLocaleString('ru-RU'),
      icon: IconFolders,
      badge: `${summary.locationCount} нас. пунктов`,
      footTitle: 'Каналов поступления',
      footDesc: `${summary.profileCount} рубрик обращений`,
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
              <Badge variant="outline">
                <card.icon />
                {card.badge}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {card.footTitle}
            </div>
            <div className="text-muted-foreground">{card.footDesc}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
