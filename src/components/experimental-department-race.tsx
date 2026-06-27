import * as React from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAppeals } from '@/hooks/use-appeals'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { formatDeltaPercent, type ProfileRow } from '@/lib/appeals-data'
import { buildDepartmentDashboard } from '@/lib/department-dashboard'
import { shortLabel } from '@/lib/experiments'
import type { AppealMode } from '@/lib/api'
import { cn } from '@/lib/utils'

type Dimension = 'departments' | 'profiles'

export function ExperimentalDepartmentRace({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  const reduceMotion = usePrefersReducedMotion()
  const [dimension, setDimension] = React.useState<Dimension>('departments')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const dashboard = React.useMemo(
    () => buildDepartmentDashboard(data?.items ?? []),
    [data],
  )
  const rows: ProfileRow[] = (
    dimension === 'departments' ? dashboard.departments : dashboard.profiles
  )
    .filter((row) => row.count || row.previousCount)
    .slice(0, 8)
  const max = Math.max(1, ...rows.flatMap((row) => [row.count, row.previousCount]))

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Гонка отделений</CardTitle>
          <CardDescription>
            Топ-8 по числу обращений: {dashboard.currentYear} против{' '}
            {dashboard.previousYear} (сопоставимый период)
          </CardDescription>
          <CardAction className="col-span-full col-start-1 row-start-3 justify-self-start sm:col-span-auto sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            <ToggleGroup
              type="single"
              variant="outline"
              value={dimension}
              onValueChange={(value) => value && setDimension(value as Dimension)}
            >
              <ToggleGroupItem value="departments" className="h-8 px-3 text-xs">
                Отделения
              </ToggleGroupItem>
              <ToggleGroupItem value="profiles" className="h-8 px-3 text-xs">
                Профили
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !rows.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет распознанных отделений. Разметьте отделения в обращениях.
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {rows.map((row, index) => {
                const rising = row.delta > 0
                return (
                  <li key={row.name} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate" title={row.name}>
                          {shortLabel(row.name, 32)}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                            row.delta > 0 && 'bg-destructive/10 text-destructive',
                            row.delta < 0 && 'bg-positive/10 text-positive',
                            row.delta === 0 && 'bg-muted text-muted-foreground',
                          )}
                          title={`${dashboard.previousYear}: ${row.previousCount} · ${dashboard.currentYear}: ${row.count}`}
                        >
                          {formatDeltaPercent(row.deltaPercent)}
                        </span>
                      </div>
                      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            rising ? 'bg-primary' : 'bg-positive',
                          )}
                          style={{
                            width: `${mounted || reduceMotion ? (row.count / max) * 100 : 0}%`,
                            transition: reduceMotion
                              ? undefined
                              : `width 800ms cubic-bezier(0.22,1,0.36,1) ${index * 70}ms`,
                          }}
                        />
                        {/* метка прошлого года */}
                        <span
                          aria-hidden
                          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-foreground/35"
                          style={{ left: `calc(${(row.previousCount / max) * 100}% - 1px)` }}
                          title={`${dashboard.previousYear}: ${row.previousCount}`}
                        />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums">
                      {row.count}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
