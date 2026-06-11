import * as React from 'react'
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
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
  DropdownMenuLabel,
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
import type { Appeal } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'
import { cn } from '@/lib/utils'

const COLUMN_LABELS: Record<string, string> = {
  id: '№',
  dateIso: 'Дата',
  content: 'Содержание',
  correspondent: 'Корреспондент',
  profile: 'Рубрика',
  source: 'Источник',
  location: 'Город',
  documentTopic: 'Тема',
  officialCategory: 'Категория',
  departments: 'Отделения',
  justified: 'Обоснованность',
  status: 'Статус',
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
            'block max-w-[380px] cursor-pointer truncate text-left underline-offset-2 decoration-dotted hover:underline',
            className,
          )}
        >
          {text}
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
      className="-ml-2 h-8"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {children}
      <CaretUpDownIcon className="ml-1 size-3.5 opacity-60" />
    </Button>
  )
}

const columns: ColumnDef<Appeal>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => <SortHeader column={column}>№</SortHeader>,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums whitespace-nowrap">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: 'dateIso',
    header: ({ column }) => <SortHeader column={column}>Дата</SortHeader>,
    cell: ({ row }) => (
      <span className="tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDateShort(row.original.dateIso)}
      </span>
    ),
  },
  {
    accessorKey: 'content',
    header: 'Содержание',
    cell: ({ row }) => <TruncatedCell text={row.original.content} />,
  },
  {
    accessorKey: 'correspondent',
    header: 'Корреспондент',
    cell: ({ row }) => (
      <TruncatedCell text={row.original.correspondent} className="max-w-[180px]" />
    ),
  },
  {
    accessorKey: 'profile',
    header: 'Рубрика',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.profile}
        className="max-w-[200px] text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'source',
    header: 'Источник',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.source}
        className="max-w-[200px] text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'location',
    header: 'Город',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.location || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'documentTopic',
    header: 'Тема',
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.documentTopic}
        className="max-w-[200px] text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'officialCategory',
    header: 'Категория',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.officialCategory}
        className="max-w-[200px] text-muted-foreground"
      />
    ),
  },
  {
    id: 'departments',
    accessorFn: (a) => getDepartments(a).join(', '),
    header: ({ column }) => <SortHeader column={column}>Отделения</SortHeader>,
    cell: ({ getValue }) => (
      <TruncatedCell text={getValue<string>()} className="max-w-[200px]" />
    ),
  },
  {
    id: 'justified',
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
    accessorKey: 'status',
    header: 'Статус',
    filterFn: inArray,
    cell: ({ row }) =>
      row.original.status === 'withdrawn' ? (
        <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
          <span className="size-1.5 rounded-full bg-zinc-400" />
          Отозвано
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5 font-normal">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Активно
        </Badge>
      ),
  },
  {
    id: 'notes',
    accessorFn: (a) => a.manualFields?.notes ?? '',
    header: 'Комментарий',
    enableSorting: false,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.manualFields?.notes}
        className="max-w-[200px]"
      />
    ),
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">Действия</span>,
    cell: ({ row }) => <AppealRowActions appeal={row.original} />,
  },
]

const DEFAULT_HIDDEN: VisibilityState = {
  source: false,
  location: false,
  documentTopic: false,
  officialCategory: false,
}

const STATUS_OPTIONS: FacetOption[] = [
  { label: 'Активно', value: 'active' },
  { label: 'Отозвано', value: 'withdrawn' },
]

const JUSTIFIED_OPTIONS: FacetOption[] = [
  { label: 'Обоснованно', value: 'Обоснованно' },
  { label: 'Не обоснованно', value: 'Не обоснованно' },
  { label: 'Не задано', value: '' },
]

function uniqueOptions(
  items: Appeal[],
  key: 'source' | 'profile' | 'officialCategory',
): FacetOption[] {
  const set = new Set<string>()
  for (const it of items) if (it[key]) set.add(it[key])
  return [...set]
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((v) => ({ label: v, value: v }))
}

export function AppealsTable() {
  const { data, isPending } = useAppeals()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(DEFAULT_HIDDEN)

  const rows = React.useMemo(() => data?.items ?? [], [data])
  const sourceOptions = React.useMemo(() => uniqueOptions(rows, 'source'), [rows])
  const profileOptions = React.useMemo(() => uniqueOptions(rows, 'profile'), [rows])
  const categoryOptions = React.useMemo(
    () => uniqueOptions(rows, 'officialCategory'),
    [rows],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
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

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Все обращения</CardTitle>
          <CardDescription>
            Полный список обращений из базы — {data?.total ?? '…'}
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
              column={table.getColumn('source')}
              title="Источник"
              options={sourceOptions}
            />
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
              column={table.getColumn('status')}
              title="Статус"
              options={STATUS_OPTIONS}
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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Показать колонки</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((c) => c.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(v) => column.toggleVisibility(!!v)}
                      >
                        {COLUMN_LABELS[column.id] ?? column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
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
                        <TableCell key={cell.id}>
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
              Найдено: {total} из {data?.total ?? 0}
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
