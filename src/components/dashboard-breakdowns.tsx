import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/use-appeals'
import { cn } from '@/lib/utils'

type Row = { name: string; count: number }

function DistributionCard({
  title,
  description,
  rows,
  total,
  barClass,
  pctClass,
}: {
  title: string
  description?: string
  rows: Row[]
  total: number
  barClass: string
  pctClass: string
}) {
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length ? (
          rows.map((r) => {
            const pct = total ? Math.round((r.count / total) * 1000) / 10 : 0
            return (
              <div key={r.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate" title={r.name}>
                    {r.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {r.count} ·{' '}
                    <span className={cn('font-medium', pctClass)}>{pct}%</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', barClass)}
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-muted-foreground">Нет данных</p>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardBreakdowns() {
  const { data, isPending } = useDashboard()

  if (isPending || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
      <DistributionCard
        title="Топ рубрик"
        description="Распределение обращений по рубрикам"
        rows={data.byProfile.slice(0, 8)}
        total={data.total}
        barClass="bg-primary"
        pctClass="text-primary"
      />
      <DistributionCard
        title="Источники обращений"
        description="Откуда поступают обращения"
        rows={data.bySource}
        total={data.total}
        barClass="bg-violet-500"
        pctClass="text-violet-600 dark:text-violet-400"
      />
    </div>
  )
}
