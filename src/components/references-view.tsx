import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
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

// Ячейка максимально лёгкая — просто span с CSS-обрезкой и нативным title (полный
// текст по наведению). Раскрытие по КЛИКУ обрабатывается одним обработчиком на всю
// таблицу (делегирование, см. ReferencesView): на ячейках нет ни Popover, ни
// обработчиков, ни состояния — поэтому монтаж/переключение вкладок не подвисает и не
// мигает. data-truncatable — маркер для делегирующего обработчика. memo — чтобы при
// ре-рендере родителя ячейки с теми же props не пересобирались.
const TextCell = React.memo(function TextCell({
  value,
  className,
}: {
  value?: string
  className?: string
}) {
  return (
    <TableCell className={cn('min-w-0 overflow-hidden', className)}>
      {value ? (
        <span
          data-truncatable
          title={value}
          className="block w-full cursor-default overflow-hidden text-ellipsis whitespace-nowrap underline-offset-2 decoration-dotted data-[overflowing=true]:cursor-pointer data-[overflowing=true]:hover:underline"
        >
          {value}
        </span>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      )}
    </TableCell>
  )
})

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
  // Один общий поповер для раскрытия полного текста обрезанной ячейки. expand
  // хранит текст, саму кликнутую ячейку (anchor) и флаг open. Закрываем через
  // open=false, НЕ обнуляя expand — иначе поповер размонтируется и Radix не успеет
  // проиграть анимацию закрытия (пропадёт рывком). Текст/якорь остаются на месте до
  // конца анимации. Привязка к anchor через virtualRef — поповер следует за ячейкой
  // при скролле. handleCellClick стабилен (useCallback) и не ре-рендерит ячейки.
  const [expand, setExpand] = React.useState<{
    text: string
    anchor: HTMLElement
    open: boolean
  } | null>(null)
  // Делегирование: проверяем переполнение на наведении и отмечаем только реально
  // обрезанные ячейки как кликабельные; клик по такой ячейке открывает общий поповер.
  const handleCellPointerOver = React.useCallback((event: React.PointerEvent) => {
    const span = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-truncatable]',
    )
    if (!span) return
    span.dataset.overflowing = String(span.scrollWidth > span.clientWidth + 1)
  }, [])
  const handleCellClick = React.useCallback((event: React.MouseEvent) => {
    const span = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-truncatable]',
    )
    if (!span) return
    // Повторный клик по уже раскрытой ячейке закрывает поповер (toggle); клик по
    // другой обрезанной ячейке переносит его туда. Закрытие по этому же клику у
    // Radix запрещено (onInteractOutside ниже), иначе поповер закроется на
    // pointerdown и тут же откроется на click — то самое «мигание/переоткрытие».
    setExpand((prev) => {
      // повторный клик по той же раскрытой ячейке — закрыть (с анимацией)
      if (prev?.open && prev.anchor === span) return { ...prev, open: false }
      if (span.scrollWidth > span.clientWidth + 1) {
        return { text: span.textContent ?? '', anchor: span, open: true }
      }
      return prev
    })
  }, [])
  const rubrics = data?.rubrics ?? []
  const themes = data?.themes ?? []
  const sources = data?.sources ?? []
  // Мемоизируем (нужны как стабильные deps для мемо тяжёлой таблицы ниже): пока
  // data из React Query не меняется, ссылки на массивы постоянны между ре-рендерами.
  const profiles = React.useMemo(() => data?.profiles ?? [], [data])
  const departments = React.useMemo(() => data?.departments ?? [], [data])
  const currentYear = data?.comparison.currentYear ?? 0
  const previousYear = data?.comparison.previousYear ?? currentYear - 1
  const cutoffMonth = Number(data?.comparison.cutoffMonthDay.slice(0, 2)) || 12
  const profileMonths = Array.from({ length: cutoffMonth }, (_, index) =>
    String(index + 1).padStart(2, '0'),
  )
  const periodLabel = data
    ? `Сопоставимый период ${previousYear} и ${currentYear} годов`
    : ''
  // Стабильные (мемоизированные) хелперы — нужны, чтобы мемо тяжёлой таблицы ниже
  // не сбрасывался на каждом ре-рендере (смена вкладки).
  const comparisonHeaders = React.useMemo(
    () => (
      <>
        <TableHead className="w-20 text-right">{previousYear}</TableHead>
        <TableHead className="w-20 text-right">{currentYear}</TableHead>
        <TableHead className="w-24 text-right">Динамика</TableHead>
      </>
    ),
    [previousYear, currentYear],
  )
  const comparisonCells = React.useCallback(
    (item: RefItem) => {
      const previous = yearCount(item, previousYear)
      const current = yearCount(item, currentYear)
      return (
        <>
          <CountCell value={previous} />
          <CountCell value={current} strong />
          <DeltaCell current={current} previous={previous} />
        </>
      )
    },
    [previousYear, currentYear],
  )
  // Отделения сортируем по профилю (в порядке справочника профилей), внутри —
  // по числу обращений текущего года. Профиль показываем отдельной колонкой.
  const departmentsByProfile = React.useMemo(() => {
    const profileOrder = new Map(
      profiles.map((profile, index) => [profile.name, index] as const),
    )
    return [...departments].sort((a, b) => {
      const orderA = profileOrder.get(a.profile ?? '') ?? profiles.length
      const orderB = profileOrder.get(b.profile ?? '') ?? profiles.length
      if (orderA !== orderB) return orderA - orderB
      return yearCount(b, currentYear) - yearCount(a, currentYear)
    })
  }, [departments, profiles, currentYear])

  // Таблица «Отделения» — самая тяжёлая (58 строк). Мемоизируем её JSX и держим
  // панель смонтированной (forceMount): тогда смена вкладки НЕ пересобирает и НЕ
  // перемонтирует эту таблицу, не блокирует главный поток ~30 мс — и CSS-переход
  // фона активного таба перестаёт дёргаться. Остальные таблицы лёгкие, их не трогаем.
  const departmentsTable = React.useMemo(
    () => (
      <div className="overflow-x-auto overscroll-x-contain rounded-2xl border">
        <Table className="min-w-[44rem] table-fixed xl:min-w-0">
          <TableHeader>
            <TableRow>
              {/* Отделение без фиксированной ширины — забирает всё свободное место
                  (table-fixed отдаёт остаток колонке без width). Профиль — узкая
                  фиксированная колонка по центру, без лишней пустоты. */}
              <TableHead>Отделение</TableHead>
              <TableHead className="w-56 text-center">Профиль</TableHead>
              {comparisonHeaders}
            </TableRow>
          </TableHeader>
          <TableBody>
            {departmentsByProfile.map((d) => (
              <TableRow key={d.id}>
                <TextCell value={d.name} className="font-medium" />
                <TextCell
                  value={d.profile}
                  className="text-center text-muted-foreground"
                />
                {comparisonCells(d)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ),
    [departmentsByProfile, comparisonHeaders, comparisonCells],
  )

  return (
    <>
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <p className="text-sm text-muted-foreground">
        {mode === 'chiefDoctor'
          ? 'Рубрики, тематика, источники поступления и отделения для контура 07/19'
          : 'Рубрики, тематика, источники и отделения для контуров 01-* и 07-*'}
        {periodLabel && ` · ${periodLabel}`}
      </p>
      {isPending || !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
            <Tabs
              value={tab}
              onValueChange={setTab}
              className="gap-4"
              onPointerOver={handleCellPointerOver}
              onClick={handleCellClick}
            >
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
              >
                <div className="overflow-x-auto overscroll-x-contain rounded-2xl border">
                  <Table className="min-w-[52rem] table-fixed xl:min-w-0">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[26%]">Рубрика</TableHead>
                        <TableHead>Что означает</TableHead>
                        <TableHead className="w-[22%] text-center">Тематика</TableHead>
                        <TableHead className="w-28 text-center">Код</TableHead>
                        {comparisonHeaders}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCurrentYear(rubrics, currentYear).map((r) => (
                        <TableRow key={r.id}>
                          <TextCell value={r.name} className="font-medium" />
                          <TextCell
                            value={r.description}
                            className="text-muted-foreground"
                          />
                          <TextCell
                            value={r.theme}
                            className="text-center text-muted-foreground"
                          />
                          <TextCell
                            value={r.code}
                            className="text-center font-mono text-xs text-muted-foreground"
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
              >
                <div className="overflow-x-auto overscroll-x-contain rounded-2xl border">
                  <Table className="min-w-[40rem] table-fixed xl:min-w-0">
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
              >
                <div className="overflow-x-auto overscroll-x-contain rounded-2xl border">
                  <Table className="min-w-[34rem] table-fixed xl:min-w-0">
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
              >
                <div className="overflow-x-auto overscroll-x-contain rounded-2xl border">
                  <Table className="min-w-[56rem] table-fixed xl:min-w-0">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Профиль</TableHead>
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
                {departmentsTable}
              </TabsContent>
            </Tabs>
          )}
    </div>
    {expand && (
      <Popover
        open={expand.open}
        onOpenChange={(next) =>
          !next && setExpand((prev) => (prev ? { ...prev, open: false } : null))
        }
      >
        {/* Якорь — сама ячейка (virtualRef): поповер «прикреплён» к ней и следует
            за скроллом/ресайзом (Radix popper включает floating-ui autoUpdate),
            а не висит на статичных координатах и не уезжает при прокрутке. */}
        <PopoverAnchor virtualRef={{ current: expand.anchor }} />
        <PopoverContent
          align="start"
          sideOffset={4}
          className="max-h-80 w-auto max-w-[min(28rem,calc(100vw-2rem))] overflow-auto"
          // Поповер — read-only подсказка: не забираем фокус. Заодно это убирает
          // закрытие по focus-ветке Radix (focusOutside) при повторном клике.
          onOpenAutoFocus={(event) => event.preventDefault()}
          // onInteractOutside перехватывает ОБА пути закрытия (pointer + focus). Если
          // клик пришёлся по обрезанной ячейке (по той же раскрытой или по другой),
          // решение отдаём нашему делегату-toggle; иначе поповер закрылся бы на
          // pointerdown и тут же открылся на click. Клик вне таблицы закрывает как обычно.
          onInteractOutside={(event) => {
            const span = (
              event.detail.originalEvent.target as HTMLElement | null
            )?.closest?.('[data-truncatable]') as HTMLElement | null
            if (
              span &&
              (span === expand.anchor ||
                span.scrollWidth > span.clientWidth + 1)
            ) {
              event.preventDefault()
            }
          }}
        >
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {expand.text}
          </p>
        </PopoverContent>
      </Popover>
    )}
    </>
  )
}
