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
import { formatMonth, isGratitudeAppeal } from '@/lib/appeals-data'
import {
  hasDeadlineData,
  isOverdue,
  monthKey,
  shortLabel,
} from '@/lib/experiments'
import type { Appeal, AppealMode } from '@/lib/api'

type Mode = 'all' | 'noEval' | 'gratitude' | 'overdue'

const ACCENT: Record<Mode, string> = {
  all: 'var(--primary)',
  noEval: '#f59e0b',
  gratitude: 'var(--positive)',
  overdue: 'var(--destructive)',
}

const PREDICATE: Record<Mode, (a: Appeal) => boolean> = {
  all: () => true,
  noEval: (a) => a.manualFields?.isJustified === undefined,
  gratitude: (a) => isGratitudeAppeal(a),
  overdue: (a) => isOverdue(a),
}

function cellColor(count: number, max: number, accent: string): string | undefined {
  if (!count) return undefined
  const pct = 14 + (count / max) * 80
  return `color-mix(in oklab, ${accent} ${pct}%, transparent)`
}

export function ExperimentalTensionHeatmap({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  const [view, setView] = React.useState<Mode>('all')

  const items = React.useMemo(() => data?.items ?? [], [data])
  const deadlineAvailable = React.useMemo(() => hasDeadlineData(items), [items])
  const activeView: Mode = view === 'overdue' && !deadlineAvailable ? 'all' : view

  const grid = React.useMemo(() => {
    const dated = items.filter((item) => monthKey(item.dateIso))
    const months = [...new Set(dated.map((item) => monthKey(item.dateIso)))]
      .sort()
      .slice(-24)
    if (!months.length) return null

    const filtered = dated.filter(PREDICATE[activeView])

    const byProfile = new Map<string, number>()
    for (const item of filtered) {
      const profile = item.profile.trim() || 'Без рубрики'
      byProfile.set(profile, (byProfile.get(profile) ?? 0) + 1)
    }
    let rows = [...byProfile.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)

    // мало рубрик — показываем одну агрегатную строку по всем обращениям
    const aggregate = rows.length < 2
    if (aggregate) rows = ['Все обращения']

    const counts = new Map<string, number>()
    for (const item of filtered) {
      const key = monthKey(item.dateIso)
      const row = aggregate ? 'Все обращения' : item.profile.trim() || 'Без рубрики'
      if (!aggregate && !rows.includes(row)) continue
      counts.set(`${row}|${key}`, (counts.get(`${row}|${key}`) ?? 0) + 1)
    }

    const max = Math.max(1, ...counts.values())
    return { months, rows, counts, max, totalFiltered: filtered.length }
  }, [items, activeView])

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Тепловая карта напряжения</CardTitle>
          <CardDescription>
            Когда и по каким рубрикам возникала нагрузка — месяцы по горизонтали
          </CardDescription>
          <CardAction className="col-span-full col-start-1 row-start-3 justify-self-start sm:col-span-auto sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            <ToggleGroup
              type="single"
              variant="outline"
              value={activeView}
              onValueChange={(value) => value && setView(value as Mode)}
              className="flex-wrap"
            >
              <ToggleGroupItem value="all" className="h-8 px-3 text-xs">
                Все
              </ToggleGroupItem>
              <ToggleGroupItem value="noEval" className="h-8 px-3 text-xs">
                Без оценки
              </ToggleGroupItem>
              <ToggleGroupItem value="gratitude" className="h-8 px-3 text-xs">
                Благодарности
              </ToggleGroupItem>
              {deadlineAvailable && (
                <ToggleGroupItem value="overdue" className="h-8 px-3 text-xs">
                  Просрочки
                </ToggleGroupItem>
              )}
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : !grid ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет датированных обращений для карты.
            </p>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <div
                className="grid min-w-fit gap-1 text-xs"
                style={{
                  gridTemplateColumns: `minmax(8rem,12rem) repeat(${grid.months.length}, minmax(2.25rem,1fr))`,
                }}
              >
                <div className="sticky left-0 z-10 bg-card" />
                {grid.months.map((key) => {
                  const [month, year] = formatMonth(key).split(' ')
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center justify-end pb-1 text-center text-[0.65rem] leading-tight text-muted-foreground"
                      title={formatMonth(key)}
                    >
                      <span>{month}</span>
                      <span className="opacity-60">{year.slice(2)}</span>
                    </div>
                  )
                })}

                {grid.rows.map((row) => (
                  <React.Fragment key={row}>
                    <div
                      className="sticky left-0 z-10 flex items-center bg-card pr-2 text-foreground"
                      title={row}
                    >
                      <span className="truncate">{shortLabel(row, 24)}</span>
                    </div>
                    {grid.months.map((key) => {
                      const count = grid.counts.get(`${row}|${key}`) ?? 0
                      return (
                        <div
                          key={key}
                          className="h-7 rounded-[4px] border border-border/40 transition-colors duration-300"
                          style={{ backgroundColor: cellColor(count, grid.max, ACCENT[activeView]) }}
                          title={`${row} · ${formatMonth(key)}: ${count}`}
                        />
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
