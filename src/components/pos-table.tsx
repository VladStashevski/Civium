import * as React from 'react'
import {
  type Column,
  type ColumnFiltersState,
  type ColumnSizingState,
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
  AnimatedPaginationText,
  AppealsPagination,
} from '@/components/appeals-table-pagination'
import {
  CENTERED_COLUMN_IDS,
  COLUMN_LABELS,
  COLUMN_MIN_WIDTHS,
  DEFAULT_HIDDEN,
  columns,
  remWidth,
  uniqueOptions,
} from '@/components/pos-table-columns'
import { PosToolbar } from '@/components/pos-table-toolbar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePos } from '@/hooks/use-pos'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useWindowVirtualRows } from '@/hooks/use-window-virtual-rows'
import type { PosMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

export function PosTable() {
  const { data, isPending } = usePos()
  // Настройки таблицы помним в localStorage (сортировка, видимость, ширины, размер
  // страницы). Поиск и фильтры — разовые, не персистим.
  const [sorting, setSorting] = usePersistentState<SortingState>(
    'pos-table:sorting',
    [],
  )
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing] = usePersistentState<ColumnSizingState>(
    'pos-table:sizing',
    {},
  )
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = usePersistentState('pos-table:page-size', 20)
  const [enteringColumnId, setEnteringColumnId] = React.useState<string | null>(
    null,
  )
  const [exitingColumnId, setExitingColumnId] = React.useState<string | null>(
    null,
  )
  const enteringColumnTimer = React.useRef<number | undefined>(undefined)
  const [columnVisibility, setColumnVisibility] =
    usePersistentState<VisibilityState>('pos-table:visibility', {
      ...DEFAULT_HIDDEN,
    })

  const rows = React.useMemo(() => data?.items ?? [], [data])
  const sourceOptions = React.useMemo(
    () => uniqueOptions(rows, (m) => m.source),
    [rows],
  )
  const categoryOptions = React.useMemo(
    () => uniqueOptions(rows, (m) => m.category),
    [rows],
  )
  const subcategoryOptions = React.useMemo(
    () => uniqueOptions(rows, (m) => m.subcategory),
    [rows],
  )
  const statusOptions = React.useMemo(
    () => uniqueOptions(rows, (m) => m.status),
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
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater
      setPageIndex(next.pageIndex)
      setPageSize(next.pageSize)
    },
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
  })

  const total = table.getFilteredRowModel().rows.length
  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn
  const pageRows = table.getRowModel().rows
  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length
  const rowAnimationKey = React.useMemo(
    () =>
      [
        globalFilter,
        JSON.stringify(columnFilters),
        JSON.stringify(sorting),
        pageIndex,
        pageSize,
        total,
      ].join('|'),
    [globalFilter, columnFilters, sorting, pageIndex, pageSize, total],
  )
  const virtualRows = useWindowVirtualRows(
    isPending ? 0 : pageRows.length,
    rowAnimationKey,
  )
  const renderedRows = pageRows.slice(virtualRows.start, virtualRows.end)

  React.useEffect(
    () => () => window.clearTimeout(enteringColumnTimer.current),
    [],
  )

  const setColumnVisible = (column: Column<PosMessage>, visible: boolean) => {
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
          <CardTitle>Сообщения ПОС</CardTitle>
          <CardDescription>
            Платформа обратной связи «Госуслуги. Решаем вместе» — сообщения с
            ЕПГУ, сайта и мобильного приложения
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PosToolbar
            table={table}
            sourceOptions={sourceOptions}
            categoryOptions={categoryOptions}
            subcategoryOptions={subcategoryOptions}
            statusOptions={statusOptions}
            onColumnVisibleChange={setColumnVisible}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm tabular-nums text-muted-foreground">
              <AnimatedPaginationText value={`Найдено: ${total} из ${rows.length}`} />
            </div>
            <AppealsPagination table={table} />
          </div>

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
                    Сообщений нет. Загрузите выгрузку ПОС, чтобы наполнить базу.
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
