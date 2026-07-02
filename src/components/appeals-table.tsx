import * as React from 'react'
import {
  type ColumnFiltersState,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
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
  JUSTIFIED_OPTIONS,
  columns,
  remWidth,
  uniqueOptions,
} from '@/components/appeals-table-columns'
import { AppealsToolbar } from '@/components/appeals-table-toolbar'
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
import { useColumnVisibilityTransition } from '@/hooks/use-column-visibility-transition'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useWindowVirtualRows } from '@/hooks/use-window-virtual-rows'
import type { Appeal, AppealMode } from '@/lib/api'
import { isGratitudeAppeal } from '@/lib/appeals-data'
import { DEPARTMENT_BY_NAME, resolveDepartmentName } from '@/lib/departments'
import { cn } from '@/lib/utils'

function appealDepartments(appeal: Appeal): string[] {
  const manual = appeal.manualFields?.departments
  const departments = manual && manual.length ? manual : (appeal.departments ?? [])
  return [...new Set(departments.map(resolveDepartmentName).filter(Boolean))]
}

function uniqueFlatOptions(
  rows: Appeal[],
  getValues: (appeal: Appeal) => string[],
) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const rowValues = new Set<string>()
    for (const value of getValues(row)) {
      const clean = value.trim()
      if (clean) rowValues.add(clean)
    }
    for (const value of rowValues) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([value, count]) => ({ label: value, value, count }))
}

function countStaticOptions(
  rows: Appeal[],
  options: typeof JUSTIFIED_OPTIONS,
  getValue: (appeal: Appeal) => string,
) {
  const counts = new Map(options.map((option) => [option.value, 0]))
  for (const row of rows) {
    const value = getValue(row)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return options.map((option) => ({
    ...option,
    count: counts.get(option.value) ?? 0,
  }))
}

export function AppealsTable({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  // Настройки таблицы помним в localStorage, ОТДЕЛЬНО по каждому режиму (ключ
  // содержит mode): сортировка, видимость колонок, их ширины, размер страницы.
  // Поиск и фильтры намеренно НЕ персистим — это разовый запрос, не «настройка».
  const [sorting, setSorting] = usePersistentState<SortingState>(
    `appeals-table:${mode}:sorting`,
    [],
  )
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing] = usePersistentState<ColumnSizingState>(
    `appeals-table:${mode}:sizing`,
    {},
  )
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = usePersistentState(
    `appeals-table:${mode}:page-size`,
    20,
  )
  const { enteringColumnId, exitingColumnId, setColumnVisible } =
    useColumnVisibilityTransition<Appeal>()
  const [columnVisibility, setColumnVisibility] =
    usePersistentState<VisibilityState>(`appeals-table:${mode}:visibility`, {
      ...DEFAULT_HIDDEN,
      registrationRoute: mode === 'external',
    })

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
        mode === 'chiefDoctor'
          ? appeal.sourceChannel
          : appeal.sourceOrganizationDetail || appeal.sourceOrganization,
      ),
    [rows, mode],
  )
  const routeOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.registrationRoute),
    [rows],
  )
  const yearOptions = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const appeal of rows) {
      const year = appeal.dateIso.slice(0, 4)
      if (/^\d{4}$/.test(year)) {
        counts.set(year, (counts.get(year) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => b.localeCompare(a, 'ru'))
      .map(([value, count]) => ({ label: value, value, count }))
  }, [rows])
  const profileOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.profile),
    [rows],
  )
  const themeOptions = React.useMemo(
    () => uniqueOptions(rows, (appeal) => appeal.rubricTheme ?? ''),
    [rows],
  )
  const departmentOptions = React.useMemo(
    () => uniqueFlatOptions(rows, appealDepartments),
    [rows],
  )
  const departmentProfileOptions = React.useMemo(
    () =>
      uniqueFlatOptions(rows, (appeal) =>
        appealDepartments(appeal)
          .map((department) => DEPARTMENT_BY_NAME.get(department)?.profile)
          .filter((profile): profile is string => Boolean(profile)),
      ),
    [rows],
  )
  const justifiedOptions = React.useMemo(
    () =>
      countStaticOptions(rows, JUSTIFIED_OPTIONS, (appeal) =>
        appeal.manualFields?.isJustified === true
          ? 'Обоснованно'
          : appeal.manualFields?.isJustified === false
            ? 'Не обоснованно'
            : '',
      ),
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
  })

  const total = table.getFilteredRowModel().rows.length
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

  // Смена режима — сбрасываем разовый поиск/фильтры и возвращаемся на первую
  // страницу. Видимость колонок и прочие настройки НЕ трогаем: их персист уже
  // подгрузил под новый режим (ключ зависит от mode).
  React.useEffect(() => {
    setColumnFilters([])
    setGlobalFilter('')
    setPageIndex(0)
  }, [mode])

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <p className="text-sm text-muted-foreground">
        {mode === 'chiefDoctor'
          ? 'Обращения на имя главного врача, контур регистрации 07/19'
          : 'Обращения в адрес Депздрава Югры (контур регистрации 07-*) и Губернатора Югры (контур регистрации 01-*)'}
      </p>
          <AppealsToolbar
            table={table}
            mode={mode}
            sourceOptions={sourceOptions}
            routeOptions={routeOptions}
            yearOptions={yearOptions}
            profileOptions={profileOptions}
            themeOptions={themeOptions}
            departmentProfileOptions={departmentProfileOptions}
            departmentOptions={departmentOptions}
            justifiedOptions={justifiedOptions}
            onColumnVisibleChange={setColumnVisible}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm tabular-nums text-muted-foreground">
              <AnimatedPaginationText value={`Найдено: ${total} из ${rows.length}`} />
            </div>
            <AppealsPagination table={table} />
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
                          'sticky top-0 z-20 overflow-hidden bg-background transition-[width] duration-300 ease-out',
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
    </div>
  )
}
