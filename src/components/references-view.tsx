import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReferences } from '@/hooks/use-appeals'
import { usePersistentState } from '@/hooks/use-persistent-state'
import type { AppealMode, RefItem } from '@/lib/api'
import { cn } from '@/lib/utils'

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

function TextCell({
  value,
  className,
}: {
  value?: string
  className?: string
}) {
  const text = value || '—'
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useEffect(() => {
    const element = textRef.current
    if (!element) return

    const update = () =>
      setIsTruncated(element.scrollWidth > element.clientWidth + 1)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  return (
    <TableCell className={cn('min-w-0 overflow-hidden', className)}>
      {value ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!isTruncated}
              className={cn(
                'block w-full min-w-0 max-w-full overflow-hidden text-left',
                isTruncated &&
                  'cursor-pointer underline-offset-2 decoration-dotted hover:underline aria-expanded:underline',
                className,
              )}
              aria-label={
                isTruncated ? `Показать полностью: ${text}` : undefined
              }
            >
              <span
                ref={textRef}
                className="block w-full overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {text}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-80 w-auto max-w-md overflow-auto"
          >
            <p className="text-sm break-words whitespace-pre-wrap">{text}</p>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      )}
    </TableCell>
  )
}

function CountCell({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <TableCell
      className={cn(
        'w-20 text-right tabular-nums',
        strong ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
    >
      {value}
    </TableCell>
  )
}

function MonthCountCell({ value }: { value: number }) {
  return (
    <TableCell
      className={cn(
        'w-14 text-right text-xs tabular-nums',
        value ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
    >
      {value}
    </TableCell>
  )
}

function yearCount(item: RefItem, year: number): number {
  return item.years?.[String(year)] ?? 0
}

function monthCount(item: RefItem, year: number, month: string): number {
  return item.months?.[String(year)]?.[month] ?? 0
}

function byCurrentYear<T extends RefItem>(rows: T[], year: number): T[] {
  return [...rows].sort(
    (a, b) =>
      yearCount(b, year) - yearCount(a, year) ||
      yearCount(b, year - 1) - yearCount(a, year - 1),
  )
}

function DeltaCell({
  current,
  previous,
}: {
  current: number
  previous: number
}) {
  const delta = current - previous
  const percent =
    previous === 0 ? (current === 0 ? 0 : null) : (delta / previous) * 100
  return (
    <TableCell
      className={cn(
        'w-24 text-right text-xs font-medium tabular-nums',
        delta > 0 && 'text-destructive',
        delta < 0 && 'text-emerald-600',
        delta === 0 && 'text-muted-foreground',
      )}
    >
      {percent === null
        ? 'новое'
        : `${percent > 0 ? '+' : ''}${percent.toFixed(1).replace('.', ',')}%`}
    </TableCell>
  )
}

export function ReferencesView({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useReferences(mode)
  const [tab, setTab] = usePersistentState('references:tab', 'rubrics')
  const rubrics = data?.rubrics ?? []
  const themes = data?.themes ?? []
  const sources = data?.sources ?? []
  const profiles = data?.profiles ?? []
  const departments = data?.departments ?? []
  const currentYear = data?.comparison.currentYear ?? 0
  const previousYear = data?.comparison.previousYear ?? currentYear - 1
  const cutoffMonth = Number(data?.comparison.cutoffMonthDay.slice(0, 2)) || 12
  const profileMonths = Array.from({ length: cutoffMonth }, (_, index) =>
    String(index + 1).padStart(2, '0'),
  )
  const periodLabel = data
    ? `Сопоставимый период ${previousYear} и ${currentYear} годов`
    : ''
  const comparisonHeaders = (
    <>
      <TableHead className="w-20 text-right">{previousYear}</TableHead>
      <TableHead className="w-20 text-right">{currentYear}</TableHead>
      <TableHead className="w-24 text-right">Динамика</TableHead>
    </>
  )
  const comparisonCells = (item: RefItem) => {
    const previous = yearCount(item, previousYear)
    const current = yearCount(item, currentYear)
    return (
      <>
        <CountCell value={previous} />
        <CountCell value={current} strong />
        <DeltaCell current={current} previous={previous} />
      </>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardDescription>
            {mode === 'chiefDoctor'
              ? 'Рубрики, тематика, источники поступления и отделения для контура 07/19'
              : 'Рубрики, тематика, источники и отделения для контуров 01-* и 07-*'}
            {periodLabel && ` · ${periodLabel}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending || !data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <div className="-mx-1 overflow-x-auto px-1">
                <TabsList>
                <TabsTrigger value="rubrics">
                  Рубрики
                  <Badge variant="secondary" className="ml-1.5">
                    {rubrics.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="themes">
                  Тематика
                  <Badge variant="secondary" className="ml-1.5">
                    {themes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="sources">
                  Источники
                  <Badge variant="secondary" className="ml-1.5">
                    {sources.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="profiles">
                  Профили
                  <Badge variant="secondary" className="ml-1.5">
                    {profiles.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="departments">
                  Отделения
                  <Badge variant="secondary" className="ml-1.5">
                    {departments.length}
                  </Badge>
                </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="rubrics"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-2/5">Рубрика</TableHead>
                        <TableHead className="text-center">Тематика</TableHead>
                        <TableHead className="w-28">Код</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(rubrics, currentYear).map((r) => (
                        <TableRow key={r.id}>
                          <TextCell value={r.name} className="font-medium" />
                          <TextCell
                            value={r.theme}
                            className="text-center text-muted-foreground"
                          />
                          <TextCell
                            value={r.code}
                            className="font-mono text-xs text-muted-foreground"
                          />
                          {comparisonCells(r)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent
                value="themes"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] text-center">
                          Тематика
                        </TableHead>
                        <TableHead>Описание</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(themes, currentYear).map((t) => (
                        <TableRow key={t.id}>
                          <TextCell
                            value={t.name}
                            className="text-center font-medium"
                          />
                          <TextCell
                            value={t.description}
                            className="text-muted-foreground"
                          />
                          {comparisonCells(t)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent
                value="sources"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Источник</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(sources, currentYear).map((s) => (
                        <TableRow key={s.id}>
                          <TextCell value={s.name} className="font-medium" />
                          {comparisonCells(s)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent
                value="profiles"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Профиль</TableHead>
                        {profileMonths.map((month) => (
                          <TableHead
                            key={month}
                            className="w-14 text-right text-xs"
                          >
                            {MONTHS_SHORT[Number(month) - 1]}
                          </TableHead>
                        ))}
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(profiles, currentYear).map((p) => (
                        <TableRow key={p.id}>
                          <TextCell value={p.name} className="font-medium" />
                          {profileMonths.map((month) => (
                            <MonthCountCell
                              key={month}
                              value={monthCount(p, currentYear, month)}
                            />
                          ))}
                          {comparisonCells(p)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent
                value="departments"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Отделение</TableHead>
                        <TableHead className="w-1/4">Профиль</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(departments, currentYear).map((d) => (
                        <TableRow key={d.id}>
                          <TextCell value={d.name} className="font-medium" />
                          <TextCell
                            value={d.profile}
                            className="text-muted-foreground"
                          />
                          {comparisonCells(d)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
