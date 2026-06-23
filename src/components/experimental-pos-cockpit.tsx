import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRightIcon } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePos } from '@/hooks/use-pos'

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

export function ExperimentalPosCockpit() {
  const { data, isPending } = usePos()
  const items = React.useMemo(() => data?.items ?? [], [data])

  const stats = React.useMemo(() => {
    const total = items.length
    const rated = items.filter((m) => m.rating !== null)
    const positive = rated.filter((m) => (m.rating ?? 0) >= 4).length
    const avg = rated.length
      ? rated.reduce((sum, m) => sum + (m.rating ?? 0), 0) / rated.length
      : 0
    return {
      total,
      avg,
      ratedCount: rated.length,
      positive,
      fastTrack: items.filter((m) => /да/i.test(m.fastTrack)).length,
      fz59: items.filter((m) => /59/.test(m.fz) || /да/i.test(m.chose59fz)).length,
      justified: items.filter((m) => m.manualFields?.isJustified === true).length,
    }
  }, [items])

  const tiles = [
    { label: 'Сообщений', value: stats.total.toLocaleString('ru-RU'), sub: 'всего в базе ПОС' },
    {
      label: 'Средняя оценка',
      value: stats.ratedCount ? stats.avg.toFixed(1).replace('.', ',') : '—',
      sub: `оценено ${stats.ratedCount}`,
    },
    {
      label: 'Довольных',
      value: pct(stats.positive, stats.ratedCount),
      sub: 'оценка 4–5',
    },
    { label: 'Фаст-трек', value: pct(stats.fastTrack, stats.total), sub: 'быстрый контур' },
    { label: 'По 59-ФЗ', value: pct(stats.fz59, stats.total), sub: 'официальные обращения' },
    { label: 'Обоснованные', value: stats.justified.toLocaleString('ru-RU'), sub: 'отмечено вручную' },
  ]

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>POS cockpit</CardTitle>
          <CardDescription>
            Тизер операторского экрана ПОС — ключевые показатели платформы обратной
            связи
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="text-muted-foreground">
              preview
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !stats.total ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Данных ПОС пока нет. Загрузите выгрузку в разделе «Сообщения».
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              {tiles.map((tile) => (
                <div key={tile.label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{tile.label}</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {tile.value}
                  </span>
                  <span className="text-xs text-muted-foreground/80">{tile.sub}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" asChild>
            <Link to="/pos" search={{ mode: 'chiefDoctor' }}>
              Открыть дашборд ПОС
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
