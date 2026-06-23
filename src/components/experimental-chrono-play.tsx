import * as React from 'react'
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppeals } from '@/hooks/use-appeals'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { formatMonth } from '@/lib/appeals-data'
import { monthKey, shortLabel } from '@/lib/experiments'
import type { AppealMode } from '@/lib/api'

const TOP_N = 7
const STEP_MS = 1100

type Row = { name: string; value: number }

function ChronoModel(items: { dateIso: string; profile: string }[]) {
  const dated = items.filter((item) => monthKey(item.dateIso))
  const months = [...new Set(dated.map((item) => monthKey(item.dateIso)))].sort()
  if (!months.length) return null
  const monthIndex = new Map(months.map((month, index) => [month, index]))

  const totals = new Map<string, number>()
  for (const item of dated) {
    const rubric = item.profile.trim() || 'Без рубрики'
    totals.set(rubric, (totals.get(rubric) ?? 0) + 1)
  }
  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([name]) => name)
  const topSet = new Set(top)

  const perMonth = months.map(() => new Map<string, number>())
  const grand = months.map(() => 0)
  for (const item of dated) {
    const mi = monthIndex.get(monthKey(item.dateIso))
    if (mi === undefined) continue
    grand[mi] += 1
    const rubric = item.profile.trim() || 'Без рубрики'
    if (topSet.has(rubric)) {
      perMonth[mi].set(rubric, (perMonth[mi].get(rubric) ?? 0) + 1)
    }
  }

  const finalCum = new Map<string, number>()
  for (let i = 0; i < months.length; i += 1) {
    for (const [rubric, count] of perMonth[i]) {
      finalCum.set(rubric, (finalCum.get(rubric) ?? 0) + count)
    }
  }
  const max = Math.max(1, ...finalCum.values())
  return { months, top, perMonth, grand, max }
}

/** Строки рубрик с FLIP-перестановкой при смене ранга. */
function RaceRows({
  rows,
  max,
  reduceMotion,
}: {
  rows: Row[]
  max: number
  reduceMotion: boolean
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const prevTops = React.useRef(new Map<string, number>())

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || reduceMotion) return
    const base = container.getBoundingClientRect().top
    for (const child of Array.from(container.children) as HTMLElement[]) {
      const name = child.dataset.name
      if (!name) continue
      const top = child.getBoundingClientRect().top - base
      const prev = prevTops.current.get(name)
      prevTops.current.set(name, top)
      if (prev === undefined || prev === top) continue
      child.style.transition = 'none'
      child.style.transform = `translateY(${prev - top}px)`
      requestAnimationFrame(() => {
        child.style.transition = 'transform 700ms cubic-bezier(0.22,1,0.36,1)'
        child.style.transform = ''
      })
    }
  })

  return (
    <div ref={containerRef} className="flex flex-col gap-2.5">
      {rows.map((row, index) => (
        <div key={row.name} data-name={row.name} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate" title={row.name}>
                {shortLabel(row.name, 30)}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{row.value}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  transition: reduceMotion
                    ? undefined
                    : 'width 700ms cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ExperimentalChronoPlay({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  const reduceMotion = usePrefersReducedMotion()

  const model = React.useMemo(() => ChronoModel(data?.items ?? []), [data])
  const lastStep = model ? model.months.length - 1 : 0

  const [step, setStep] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)

  // Сброс при смене данных/режима движения — в фазе рендера, без эффекта.
  const resetKey = `${model ? model.months.join(',') : 'none'}:${reduceMotion}`
  const [prevKey, setPrevKey] = React.useState(resetKey)
  if (resetKey !== prevKey) {
    setPrevKey(resetKey)
    setStep(reduceMotion ? lastStep : 0)
    setPlaying(false)
  }

  const isPlaying = playing && step < lastStep

  React.useEffect(() => {
    if (!isPlaying) return
    const id = window.setTimeout(
      () => setStep((s) => Math.min(s + 1, lastStep)),
      reduceMotion ? 280 : STEP_MS,
    )
    return () => window.clearTimeout(id)
  }, [isPlaying, step, lastStep, reduceMotion])

  const rows = React.useMemo<Row[]>(() => {
    if (!model) return []
    const cum = new Map<string, number>()
    for (let i = 0; i <= step; i += 1) {
      for (const [rubric, count] of model.perMonth[i]) {
        cum.set(rubric, (cum.get(rubric) ?? 0) + count)
      }
    }
    return model.top
      .map((name) => ({ name, value: cum.get(name) ?? 0 }))
      .sort((a, b) => b.value - a.value)
  }, [model, step])

  const runningTotal = React.useMemo(() => {
    if (!model) return 0
    let total = 0
    for (let i = 0; i <= step; i += 1) total += model.grand[i]
    return total
  }, [model, step])

  const togglePlay = () => {
    if (!model) return
    if (step >= lastStep) {
      setStep(0)
      setPlaying(true)
    } else {
      setPlaying((value) => !value)
    }
  }
  const restart = () => {
    setStep(0)
    setPlaying(false)
  }

  const progress = model ? ((step + 1) / model.months.length) * 100 : 0

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Пульс года</CardTitle>
          <CardDescription>
            Проигрывание года по месяцам: счётчик растёт, а рубрики меняются местами
            в реальной гонке
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="text-muted-foreground">
              эксперимент
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-12 w-56" />
              <Skeleton className="h-2.5 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !model ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет датированных обращений для проигрывания.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Пауза' : 'Запустить'}
                >
                  {isPlaying ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-muted-foreground"
                  onClick={restart}
                  aria-label="Сначала"
                >
                  <ArrowCounterClockwiseIcon />
                </Button>
                <div className="ml-1 flex flex-col">
                  <span className="text-3xl leading-none font-semibold tabular-nums">
                    {runningTotal.toLocaleString('ru-RU')}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    обращений к {formatMonth(model.months[step])}
                  </span>
                </div>
              </div>

              <div className="relative h-2 rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                  style={{
                    width: `${progress}%`,
                    transition: reduceMotion ? undefined : 'width 600ms ease-out',
                  }}
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
                  style={{
                    left: `calc(${progress}% - 0.375rem)`,
                    transition: reduceMotion ? undefined : 'left 600ms ease-out',
                  }}
                />
              </div>

              <RaceRows rows={rows} max={model.max} reduceMotion={reduceMotion} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
