import * as React from 'react'
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  CaretDownIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  SlidersHorizontalIcon,
  XIcon,
} from '@phosphor-icons/react'

import { AppealRowActions } from '@/components/appeal-row-actions'
import { FacetedFilter, type FacetOption } from '@/components/appeals-faceted-filter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
import { useAppeals } from '@/hooks/use-appeals'
import type { Appeal, AppealMode } from '@/lib/api'
import { formatDateShort, isGratitudeAppeal } from '@/lib/appeals-data'
import { cn } from '@/lib/utils'

const COLUMN_LABELS: Record<string, string> = {
  id: '№',
  dateIso: 'Дата',
  content: 'Содержание',
  correspondent: 'Заявитель',
  profile: 'Рубрика',
  sourceView: 'Источник',
  registrationRoute: 'Контур регистрации',
  location: 'Город',
  rubricTheme: 'Тематика',
  departments: 'Отделения',
  justified: 'Обоснованность',
  issues: 'Проблемы',
  notes: 'Комментарий',
}

const CENTERED_COLUMN_IDS = new Set(['dateIso', 'sourceView'])

/**
 * Ширины колонок заданы в px (как при базовом font-size 16px), но рендерятся в rem,
 * чтобы расти вместе с глобальным авто-скейлом шрифта на больших экранах —
 * иначе текст в ячейках обрезался бы сильнее при крупном шрифте и фиксированных px.
 */
const remWidth = (px: number) => `${px / 16}rem`
const VIRTUAL_ROW_HEIGHT = 49
const VIRTUAL_OVERSCAN = 8

function getDepartments(a: Appeal): string[] {
  const manual = a.manualFields?.departments
  return manual && manual.length ? manual : (a.departments ?? [])
}

/** Multi-select filter: row value (single string) must be one of the selected values. */
const inArray: FilterFn<Appeal> = (row, columnId, value) => {
  const selected = value as string[]
  if (!selected?.length) return true
  return selected.includes(String(row.getValue(columnId) ?? ''))
}

function TruncatedCell({ text, className }: { text?: string; className?: string }) {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useEffect(() => {
    const element = textRef.current
    if (!element || !text) {
      setIsTruncated(false)
      return
    }

    const update = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth + 1)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  if (!text) return <span className="text-muted-foreground/60">—</span>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!isTruncated}
          title={text}
          className={cn(
            'block w-full min-w-0 overflow-hidden text-left disabled:pointer-events-none',
            isTruncated &&
              'cursor-pointer underline-offset-2 decoration-dotted hover:underline aria-expanded:underline',
            className,
          )}
          aria-label={isTruncated ? `Показать полностью: ${text}` : undefined}
        >
          <span
            ref={textRef}
            className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {text}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-h-80 w-auto max-w-md overflow-auto"
      >
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {text}
        </p>
      </PopoverContent>
    </Popover>
  )
}

function AnimatedPaginationText({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <span key={value} className={cn('appeals-pagination-value', className)}>
      {value}
    </span>
  )
}

function useWindowVirtualRows(count: number, refreshKey: string) {
  const bodyRef = React.useRef<HTMLTableSectionElement>(null)
  const [range, setRange] = React.useState(() => ({
    start: 0,
    end: Math.min(count, 40),
  }))

  React.useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const element = bodyRef.current
      if (!element || count === 0) {
        setRange((current) =>
          current.start === 0 && current.end === 0
            ? current
            : { start: 0, end: 0 },
        )
        return
      }

      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const visibleTop = Math.max(0, -rect.top)
      const visibleBottom = Math.min(
        count * VIRTUAL_ROW_HEIGHT,
        visibleTop + viewportHeight,
      )
      const start = Math.max(
        0,
        Math.floor(visibleTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN,
      )
      const end = Math.min(
        count,
        Math.ceil(visibleBottom / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN,
      )

      setRange((current) =>
        current.start === start && current.end === end
          ? current
          : { start, end },
      )
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [count, refreshKey])

  return {
    bodyRef,
    start: range.start,
    end: range.end,
    before: range.start * VIRTUAL_ROW_HEIGHT,
    after: Math.max(0, (count - range.end) * VIRTUAL_ROW_HEIGHT),
  }
}

function SortHeader({
  column,
  children,
}: {
  column: Column<Appeal>
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 max-w-full min-w-0 justify-start overflow-hidden px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      <span className="truncate">{children}</span>
      <CaretUpDownIcon className="ml-1 size-3.5 shrink-0 opacity-60" />
    </Button>
  )
}

const columns: ColumnDef<Appeal>[] = [
  {
    accessorKey: 'id',
    size: 110,
    minSize: 110,
    maxSize: 140,
    header: ({ column }) => <SortHeader column={column}>№</SortHeader>,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums whitespace-nowrap">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: 'dateIso',
    size: 110,
    minSize: 110,
    maxSize: 150,
    header: ({ column }) => <SortHeader column={column}>Дата</SortHeader>,
    cell: ({ row }) => (
      <span className="block text-center tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDateShort(row.original.dateIso)}
      </span>
    ),
  },
  {
    accessorKey: 'content',
    size: 220,
    minSize: 160,
    maxSize: 600,
    header: 'Содержание',
    cell: ({ row }) => <TruncatedCell text={row.original.content} />,
  },
  {
    accessorKey: 'correspondent',
    size: 175,
    minSize: 165,
    maxSize: 420,
    header: 'Заявитель',
    cell: ({ row }) => (
      <TruncatedCell text={row.original.correspondent} />
    ),
  },
  {
    accessorKey: 'profile',
    size: 190,
    minSize: 130,
    maxSize: 480,
    header: 'Рубрика',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.profile}
        className="text-muted-foreground"
      />
    ),
  },
  {
    id: 'sourceView',
    size: 200,
    minSize: 200,
    maxSize: 420,
    accessorFn: (appeal) =>
      appeal.appealMode === 'chiefDoctor'
        ? appeal.sourceChannel
        : appeal.sourceOrganization,
    header: 'Источник',
    filterFn: inArray,
    cell: ({ getValue }) => (
      <TruncatedCell
        text={getValue<string>()}
        className="text-center text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'registrationRoute',
    size: 220,
    minSize: 220,
    maxSize: 380,
    header: 'Контур регистрации',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.registrationRoute}
        className="text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'location',
    size: 130,
    minSize: 110,
    maxSize: 240,
    header: 'Город',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.location || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'rubricTheme',
    size: 180,
    minSize: 150,
    maxSize: 420,
    header: 'Тематика',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.rubricTheme}
        className="text-muted-foreground"
      />
    ),
  },
  {
    id: 'departments',
    size: 190,
    minSize: 170,
    maxSize: 480,
    accessorFn: (a) => getDepartments(a).join(', '),
    header: ({ column }) => <SortHeader column={column}>Отделения</SortHeader>,
    cell: ({ getValue }) => (
      <TruncatedCell text={getValue<string>()} />
    ),
  },
  {
    id: 'justified',
    size: 220,
    minSize: 220,
    maxSize: 220,
    accessorFn: (a) =>
      a.manualFields?.isJustified === true
        ? 'Обоснованно'
        : a.manualFields?.isJustified === false
          ? 'Не обоснованно'
          : '',
    header: ({ column }) => <SortHeader column={column}>Обоснованность</SortHeader>,
    filterFn: inArray,
    cell: ({ row }) => {
      const v = row.original.manualFields?.isJustified
      if (v === true)
        return (
          <Badge className="border-transparent bg-destructive/10 text-destructive">
            Обоснованно
          </Badge>
        )
      if (v === false)
        return (
          <Badge className="border-transparent bg-positive/10 text-positive dark:bg-positive/15">
            Не обоснованно
          </Badge>
        )
      return <span className="text-muted-foreground/60">—</span>
    },
  },
  {
    id: 'issues',
    size: 210,
    minSize: 170,
    maxSize: 520,
    accessorFn: (a) => a.manualFields?.issues ?? '',
    header: 'Проблемы',
    enableSorting: false,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.manualFields?.issues}
      />
    ),
  },
  {
    id: 'notes',
    size: 190,
    minSize: 170,
    maxSize: 480,
    accessorFn: (a) => a.manualFields?.notes ?? '',
    header: 'Комментарий',
    enableSorting: false,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.manualFields?.notes}
      />
    ),
  },
  {
    id: 'actions',
    size: 52,
    minSize: 52,
    maxSize: 52,
    enableResizing: false,
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">Действия</span>,
    cell: ({ row }) => <AppealRowActions appeal={row.original} />,
  },
]

// По умолчанию показываем только то, что комфортно влезает на ноутбучную ширину
// (№, Дата, Содержание, Заявитель, Рубрика, ⋮). Остальные колонки включаются
// через меню «Колонки» — тогда таблица скроллится по горизонтали в своей области.
const DEFAULT_HIDDEN: VisibilityState = {
  sourceView: false,
  registrationRoute: false,
  location: false,
  rubricTheme: false,
  departments: false,
  justified: false,
  issues: false,
  notes: false,
}

const COLUMN_MIN_WIDTHS: Record<string, number> = {
  id: 110,
  dateIso: 110,
  content: 160,
  correspondent: 165,
  profile: 130,
  sourceView: 200,
  registrationRoute: 220,
  location: 110,
  rubricTheme: 150,
  departments: 170,
  justified: 220,
  issues: 170,
  notes: 170,
  actions: 52,
}

const JUSTIFIED_OPTIONS: FacetOption[] = [
  { label: 'Обоснованно', value: 'Обоснованно' },
  { label: 'Не обоснованно', value: 'Не обоснованно' },
  { label: 'Не задано', value: '' },
]

function uniqueOptions(items: Appeal[], getValue: (item: Appeal) => string): FacetOption[] {
  const set = new Set<string>()
  for (const item of items) {
    const value = getValue(item)
    if (value) set.add(value)
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((v) => ({ label: v, value: v }))
}

export function AppealsTable({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [enteringColumnId, setEnteringColumnId] = React.useState<string | null>(
    null,
  )
  const [exitingColumnId, setExitingColumnId] = React.useState<string | null>(
    null,
  )
  const enteringColumnTimer = React.useRef<number | undefined>(undefined)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => ({
      ...DEFAULT_HIDDEN,
      registrationRoute: mode === 'external',
    }),
  )

  const allRows = React.useMemo(() => data?.items ?? [], [data])
  const rows = React.useMemo(
    () =>
      allRows.filter(
        (appeal) => appeal.appealMode === mode && !isGratitudeAppeal(appeal),
      ),
    [allRows, mode],
  )
  const sourceOptions = React.useMemo(
    () =>
      uniqueOptions(rows, (appeal) =>
        mode === 'chiefDoctor' ? appeal.sourceChannel : appeal.sourceOrganization,
      ),
    [rows, mode],
  )
  const routeOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.registrationRoute),
    [rows],
  )
  const profileOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.profile),
    [rows],
  )
  const themeOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.rubricTheme ?? ''),
    [rows],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility,
      columnSizing,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: (updater) =>
      setColumnSizing((current) => {
        const next =
          typeof updater === 'function' ? updater(current) : updater
        return Object.fromEntries(
          Object.entries(next).map(([columnId, width]) => [
            columnId,
            Math.max(width, COLUMN_MIN_WIDTHS[columnId] ?? 120),
          ]),
        )
      }),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount()
  const isFiltered = columnFilters.length > 0
  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn
  const pageRows = table.getRowModel().rows
  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length
  const rowAnimationKey = React.useMemo(
    () =>
      [
        mode,
        globalFilter,
        JSON.stringify(columnFilters),
        JSON.stringify(sorting),
        pageIndex,
        pageSize,
        total,
      ].join('|'),
    [mode, globalFilter, columnFilters, sorting, pageIndex, pageSize, total],
  )
  const virtualRows = useWindowVirtualRows(
    isPending ? 0 : pageRows.length,
    rowAnimationKey,
  )
  const renderedRows = pageRows.slice(virtualRows.start, virtualRows.end)

  React.useEffect(() => {
    setColumnFilters([])
    setGlobalFilter('')
    setColumnVisibility((current) => ({
      ...current,
      registrationRoute: mode === 'external',
    }))
    table.setPageIndex(0)
  }, [mode, table])

  React.useEffect(
    () => () => window.clearTimeout(enteringColumnTimer.current),
    [],
  )

  const setColumnVisible = (column: Column<Appeal>, visible: boolean) => {
    window.clearTimeout(enteringColumnTimer.current)

    if (visible && !column.getIsVisible()) {
      window.clearTimeout(enteringColumnTimer.current)
      setEnteringColumnId(column.id)
      column.toggleVisibility(true)
      enteringColumnTimer.current = window.setTimeout(
        () => setEnteringColumnId(null),
        260,
      )
      return
    }

    if (!visible && column.getIsVisible()) {
      setExitingColumnId(column.id)
      enteringColumnTimer.current = window.setTimeout(() => {
        column.toggleVisibility(false)
        setExitingColumnId(null)
      }, 220)
      return
    }

    column.toggleVisibility(visible)
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Все обращения</CardTitle>
          <CardDescription>
            {mode === 'chiefDoctor'
              ? 'Обращения на имя главного врача, контур регистрации 07/19'
              : 'Обращения в адрес Депздрава Югры (контур регистрации 07-*) и Губернатора Югры (контур регистрации 01-*)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Поиск по обращениям…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-8 w-full sm:max-w-xs"
            />
            <FacetedFilter
              column={table.getColumn('sourceView')}
              title="Источник"
              options={sourceOptions}
            />
            {mode === 'external' && (
              <FacetedFilter
                column={table.getColumn('registrationRoute')}
                title="Контур регистрации"
                options={routeOptions}
              />
            )}
            <FacetedFilter
              column={table.getColumn('profile')}
              title="Рубрика"
              options={profileOptions}
            />
            <FacetedFilter
              column={table.getColumn('rubricTheme')}
              title="Тематика"
              options={themeOptions}
            />
            <FacetedFilter
              column={table.getColumn('justified')}
              title="Обоснованность"
              options={JUSTIFIED_OPTIONS}
            />
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                className="appeals-fade-in"
                onClick={() => table.resetColumnFilters()}
              >
                Сбросить
                <XIcon />
              </Button>
            )}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontalIcon />
                    Колонки
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2.5">
                  <DropdownMenuItem onSelect={() => table.resetColumnSizing()}>
                    Сбросить ширину
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="-mx-2.5 my-2.5" />
                  {table
                    .getAllColumns()
                    .filter((c) => c.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(v) => setColumnVisible(column, !!v)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        {COLUMN_LABELS[column.id] ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm tabular-nums text-muted-foreground">
              <AnimatedPaginationText value={`Найдено: ${total} из ${rows.length}`} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap text-muted-foreground">
                  Строк на странице
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-20 justify-between px-3 transition-[background-color,border-color,box-shadow,color] duration-200"
                    >
                      <AnimatedPaginationText
                        value={`${pageSize}`}
                        className="min-w-7 text-left tabular-nums"
                      />
                      <CaretDownIcon className="size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-24 min-w-24 p-2">
                    {[10, 20, 50, 100].map((value) => (
                      <DropdownMenuCheckboxItem
                        key={value}
                        checked={pageSize === value}
                        className="h-8 rounded-xl px-3 py-1.5"
                        onCheckedChange={() => {
                          table.setPageIndex(0)
                          table.setPageSize(value)
                        }}
                      >
                        <span className="min-w-7 tabular-nums">{value}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="inline-flex w-30 justify-center text-sm tabular-nums whitespace-nowrap text-muted-foreground transition-colors duration-200">
                <AnimatedPaginationText
                  value={`Стр. ${pageCount ? pageIndex + 1 : 0} из ${pageCount || 1}`}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 transition-[background-color,border-color,box-shadow,color,opacity] duration-200"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Первая страница"
                >
                  <CaretDoubleLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 transition-[background-color,border-color,box-shadow,color,opacity] duration-200"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Предыдущая страница"
                >
                  <CaretLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 transition-[background-color,border-color,box-shadow,color,opacity] duration-200"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Следующая страница"
                >
                  <CaretRightIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 transition-[background-color,border-color,box-shadow,color,opacity] duration-200"
                  onClick={() => table.setPageIndex(pageCount - 1)}
                  disabled={!table.getCanNextPage()}
                  aria-label="Последняя страница"
                >
                  <CaretDoubleRightIcon />
                </Button>
              </div>
            </div>
          </div>

          {/* Таблица тянет страницу вниз, как database table: без второго вертикального скролла. */}
          <Table
            containerClassName="overflow-x-auto overscroll-x-contain rounded-lg border"
            className={cn(
              'table-fixed transition-[width] duration-300 ease-out',
              isResizingColumn && 'transition-none',
            )}
            style={{
              width: remWidth(table.getTotalSize()),
              minWidth: '100%',
            }}
          >
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'sticky top-0 z-20 overflow-hidden bg-card transition-[width] duration-300 ease-out',
                          CENTERED_COLUMN_IDS.has(header.column.id) &&
                            'text-center',
                          header.column.id === enteringColumnId &&
                            'appeals-column-enter',
                          header.column.id === exitingColumnId &&
                            'appeals-column-exit',
                          isResizingColumn && 'transition-none',
                        )}
                        style={
                          {
                            width: remWidth(header.getSize()),
                            minWidth: remWidth(
                              COLUMN_MIN_WIDTHS[header.column.id] ??
                                header.column.columnDef.minSize ??
                                0,
                            ),
                            '--appeals-column-width': remWidth(header.getSize()),
                          } as React.CSSProperties
                        }
                      >
                        <div
                          className={cn(
                            'min-w-0 overflow-hidden whitespace-nowrap',
                            CENTERED_COLUMN_IDS.has(header.column.id) &&
                              'text-center',
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </div>
                        {header.column.getCanResize() && (
                          <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Изменить ширину колонки ${
                              COLUMN_LABELS[header.column.id] ?? header.column.id
                            }`}
                            onDoubleClick={() => header.column.resetSize()}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              'absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none after:absolute after:top-2 after:right-0 after:bottom-2 after:w-px after:bg-border hover:after:bg-primary',
                              header.column.getIsResizing() &&
                                'after:w-0.5 after:bg-primary',
                            )}
                          />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                key={rowAnimationKey}
                ref={virtualRows.bodyRef}
                className="appeals-table-body-enter"
              >
                {isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={visibleColumnCount}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pageRows.length ? (
                  <>
                    {virtualRows.before > 0 && (
                      <TableRow aria-hidden="true">
                        <TableCell
                          colSpan={visibleColumnCount}
                          className="border-0 p-0"
                          style={{ height: virtualRows.before }}
                        />
                      </TableRow>
                    )}
                    {renderedRows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'min-w-0 overflow-hidden transition-[width] duration-300 ease-out',
                              CENTERED_COLUMN_IDS.has(cell.column.id) &&
                                'text-center',
                              cell.column.id === enteringColumnId &&
                                'appeals-column-enter',
                              cell.column.id === exitingColumnId &&
                                'appeals-column-exit',
                              isResizingColumn && 'transition-none',
                            )}
                            style={
                              {
                                width: remWidth(cell.column.getSize()),
                                minWidth: remWidth(
                                  COLUMN_MIN_WIDTHS[cell.column.id] ??
                                    cell.column.columnDef.minSize ??
                                    0,
                                ),
                                '--appeals-column-width': remWidth(
                                  cell.column.getSize(),
                                ),
                              } as React.CSSProperties
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {virtualRows.after > 0 && (
                      <TableRow aria-hidden="true">
                        <TableCell
                          colSpan={visibleColumnCount}
                          className="border-0 p-0"
                          style={{ height: virtualRows.after }}
                        />
                      </TableRow>
                    )}
                  </>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumnCount}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Обращений нет. Загрузите Excel, чтобы наполнить базу.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  )
}
