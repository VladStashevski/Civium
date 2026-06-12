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
  CaretLeftIcon,
  CaretRightIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatDateShort } from '@/lib/appeals-data'
import { cn } from '@/lib/utils'

const COLUMN_LABELS: Record<string, string> = {
  id: '№',
  dateIso: 'Дата',
  content: 'Содержание',
  correspondent: 'Корреспондент',
  profile: 'Рубрика',
  sourceView: 'Источник / канал',
  registrationRoute: 'Контур регистрации',
  location: 'Город',
  documentTopic: 'Тема',
  officialCategory: 'Категория',
  departments: 'Отделения',
  justified: 'Обоснованность',
  notes: 'Комментарий',
}

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

/** Truncated text that opens the full value in a popover on click. */
function TruncatedCell({ text, className }: { text?: string; className?: string }) {
  if (!text) return <span className="text-muted-foreground/60">—</span>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'block w-full min-w-0 max-w-full cursor-pointer overflow-hidden text-left underline-offset-2 decoration-dotted hover:underline',
            className,
          )}
        >
          <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
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
  )
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
      className="-ml-2 h-8 max-w-full min-w-0 justify-start overflow-hidden"
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
    size: 80,
    minSize: 64,
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
    minSize: 96,
    maxSize: 150,
    header: ({ column }) => <SortHeader column={column}>Дата</SortHeader>,
    cell: ({ row }) => (
      <span className="tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDateShort(row.original.dateIso)}
      </span>
    ),
  },
  {
    accessorKey: 'content',
    size: 280,
    minSize: 140,
    maxSize: 600,
    header: 'Содержание',
    cell: ({ row }) => <TruncatedCell text={row.original.content} />,
  },
  {
    accessorKey: 'correspondent',
    size: 170,
    minSize: 120,
    maxSize: 420,
    header: 'Корреспондент',
    cell: ({ row }) => (
      <TruncatedCell text={row.original.correspondent} />
    ),
  },
  {
    accessorKey: 'profile',
    size: 190,
    minSize: 120,
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
    size: 180,
    minSize: 120,
    maxSize: 420,
    accessorFn: (appeal) =>
      appeal.appealMode === 'chiefDoctor'
        ? appeal.sourceChannel
        : appeal.sourceOrganization,
    header: 'Источник / канал',
    filterFn: inArray,
    cell: ({ getValue }) => (
      <TruncatedCell
        text={getValue<string>()}
        className="text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'registrationRoute',
    size: 170,
    minSize: 120,
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
    minSize: 90,
    maxSize: 240,
    header: 'Город',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.location || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'documentTopic',
    size: 190,
    minSize: 120,
    maxSize: 480,
    header: 'Тема',
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.documentTopic}
        className="text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'officialCategory',
    size: 180,
    minSize: 120,
    maxSize: 420,
    header: 'Категория',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.officialCategory}
        className="text-muted-foreground"
      />
    ),
  },
  {
    id: 'departments',
    size: 190,
    minSize: 120,
    maxSize: 480,
    accessorFn: (a) => getDepartments(a).join(', '),
    header: ({ column }) => <SortHeader column={column}>Отделения</SortHeader>,
    cell: ({ getValue }) => (
      <TruncatedCell text={getValue<string>()} />
    ),
  },
  {
    id: 'justified',
    size: 160,
    minSize: 140,
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
          <Badge className="border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            Обоснованно
          </Badge>
        )
      if (v === false)
        return (
          <Badge className="border-transparent bg-destructive/10 text-destructive">
            Не обоснованно
          </Badge>
        )
      return <span className="text-muted-foreground/60">—</span>
    },
  },
  {
    id: 'notes',
    size: 190,
    minSize: 120,
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

const DEFAULT_HIDDEN: VisibilityState = {
  registrationRoute: false,
  location: false,
  documentTopic: false,
  officialCategory: false,
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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => ({
      ...DEFAULT_HIDDEN,
      registrationRoute: mode === 'external',
    }),
  )

  const allRows = React.useMemo(() => data?.items ?? [], [data])
  const rows = React.useMemo(
    () => allRows.filter((appeal) => appeal.appealMode === mode),
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
  const categoryOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.officialCategory),
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
    onColumnSizingChange: setColumnSizing,
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
  const isFiltered = columnFilters.length > 0

  React.useEffect(() => {
    setColumnFilters([])
    setGlobalFilter('')
    setColumnVisibility((current) => ({
      ...current,
      registrationRoute: mode === 'external',
    }))
    table.setPageIndex(0)
  }, [mode, table])

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Все обращения</CardTitle>
          <CardDescription>
            {mode === 'chiefDoctor'
              ? '07/19: обращения на имя главного врача по каналам поступления'
              : '07-/01-: внешние обращения по источникам поступления'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Поиск по обращениям…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 w-full max-w-xs"
            />
            <FacetedFilter
              column={table.getColumn('sourceView')}
              title={mode === 'chiefDoctor' ? 'Канал' : 'Источник'}
              options={sourceOptions}
            />
            {mode === 'external' && (
              <FacetedFilter
                column={table.getColumn('registrationRoute')}
                title="Контур"
                options={routeOptions}
              />
            )}
            <FacetedFilter
              column={table.getColumn('profile')}
              title="Рубрика"
              options={profileOptions}
            />
            <FacetedFilter
              column={table.getColumn('officialCategory')}
              title="Категория"
              options={categoryOptions}
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
                        onCheckedChange={(v) => column.toggleVisibility(!!v)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        {COLUMN_LABELS[column.id] ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table
              className="table-fixed"
              style={{
                width: table.getTotalSize(),
                minWidth: '100%',
              }}
            >
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="relative overflow-hidden"
                        style={{ width: header.getSize() }}
                      >
                        <div className="min-w-0 overflow-hidden whitespace-nowrap">
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
              <TableBody>
                {isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={columns.length}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="min-w-0 overflow-hidden"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Обращений нет. Загрузите Excel, чтобы наполнить базу.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Найдено: {total} из {rows.length}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Строк на странице
                </span>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger size="sm" className="w-[72px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={`${n}`}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                Стр. {pageIndex + 1} из {table.getPageCount() || 1}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <CaretDoubleLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <CaretLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <CaretRightIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <CaretDoubleRightIcon />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
