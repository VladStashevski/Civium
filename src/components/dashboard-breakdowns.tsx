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
import type { AppealMode } from '@/lib/api'
import {
  formatDeltaPercent,
  normalizeDashboard,
  type ProfileRow,
} from '@/lib/appeals-data'

function DistributionCard({
  title,
  description,
  rows,
  barClass,
  pctClass,
  currentYear,
  previousYear,
}: {
  title: string
  description?: string
  rows: ProfileRow[]
  barClass: string
  pctClass: string
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
          rows.map((r) => {
            return (
              <div key={r.name} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="truncate" title={r.name}>
                    {r.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                      r.delta > 0 && 'bg-destructive/10 text-destructive',
                      r.delta < 0 && 'bg-emerald-500/10 text-emerald-600',
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
                  <span className={pctClass}>{currentYear}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', barClass)}
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                  <span className={cn('text-right font-medium tabular-nums', pctClass)}>
                    {r.count}
                  </span>
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

export function DashboardBreakdowns({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useDashboard(mode)

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

  const dashboard = normalizeDashboard(data)
  const profiles = dashboard.byProfile
  const chiefDoctorChannels = dashboard.byChiefDoctorChannel ?? []
  const externalSources = dashboard.bySource

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
      <DistributionCard
        title="Топ рубрик"
        description="Распределение обращений по рубрикам"
        rows={profiles.slice(0, 8)}
        barClass="bg-primary"
        pctClass="text-primary"
        currentYear={dashboard.comparison.currentYear}
        previousYear={dashboard.comparison.previousYear}
      />
      {mode === 'chiefDoctor' ? (
        <DistributionCard
          title="Каналы 07/19"
          description="Как обращения поступили главному врачу"
          rows={chiefDoctorChannels}
          barClass="bg-emerald-500"
          pctClass="text-emerald-600 dark:text-emerald-400"
          currentYear={dashboard.comparison.currentYear}
          previousYear={dashboard.comparison.previousYear}
        />
      ) : (
        <DistributionCard
          title="Источники 07-/01-"
          description="Откуда поступило обращение"
          rows={externalSources}
          barClass="bg-violet-500"
          pctClass="text-violet-600 dark:text-violet-400"
          currentYear={dashboard.comparison.currentYear}
          previousYear={dashboard.comparison.previousYear}
        />
      )}
    </div>
  )
}
