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
import type { AppealMode, RefItem } from '@/lib/api'
import { cn } from '@/lib/utils'

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

function yearCount(item: RefItem, year: number): number {
  return item.years?.[String(year)] ?? 0
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
  const rubrics = data?.rubrics ?? []
  const themes = data?.themes ?? []
  const sources = data?.sources ?? []
  const departments = data?.departments ?? []
  const currentYear = data?.comparison.currentYear ?? 0
  const previousYear = data?.comparison.previousYear ?? currentYear - 1
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
              ? 'Рубрики, темы, каналы поступления и отделения для 07/19'
              : 'Рубрики, темы, источники и отделения для 07-/01-'}
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
            <Tabs defaultValue="rubrics" className="gap-4">
              <TabsList>
                <TabsTrigger value="rubrics">
                  Рубрики
                  <Badge variant="secondary" className="ml-1.5">
                    {rubrics.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="themes">
                  Темы
                  <Badge variant="secondary" className="ml-1.5">
                    {themes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="sources">
                  {mode === 'chiefDoctor' ? 'Каналы' : 'Источники'}
                  <Badge variant="secondary" className="ml-1.5">
                    {sources.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="departments">
                  Отделения
                  <Badge variant="secondary" className="ml-1.5">
                    {departments.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rubrics">
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-2/5">Рубрика</TableHead>
                        <TableHead className="text-center">Тема</TableHead>
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

              <TabsContent value="themes">
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] text-center">
                          Тема
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

              <TabsContent value="sources">
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">
                          {mode === 'chiefDoctor' ? 'Канал' : 'Источник'}
                        </TableHead>
                        <TableHead>Статус</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(sources, currentYear).map((s) => (
                        <TableRow key={s.id}>
                          <TextCell value={s.name} className="font-medium" />
                          <TextCell
                            value={s.status}
                            className="text-muted-foreground"
                          />
                          {comparisonCells(s)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="departments">
                <div className="overflow-hidden rounded-lg border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Отделение</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(departments, currentYear).map((d) => (
                        <TableRow key={d.id}>
                          <TextCell value={d.name} className="font-medium" />
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
