import type { Column, Table } from '@tanstack/react-table'
import { SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react'

import { DateRangeFilter } from '@/components/appeals-date-range-filter'
import { FacetedFilter, type FacetOption } from '@/components/appeals-faceted-filter'
import {
  COLUMN_LABELS,
  JUSTIFIED_OPTIONS,
} from '@/components/appeals-table-columns'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { AppealMode, Appeal } from '@/lib/api'

export function AppealsToolbar({
  table,
  mode,
  sourceOptions,
  routeOptions,
  yearOptions,
  profileOptions,
  themeOptions,
  departmentProfileOptions,
  departmentOptions,
  onColumnVisibleChange,
}: {
  table: Table<Appeal>
  mode: AppealMode
  sourceOptions: FacetOption[]
  routeOptions: FacetOption[]
  yearOptions: FacetOption[]
  profileOptions: FacetOption[]
  themeOptions: FacetOption[]
  departmentProfileOptions: FacetOption[]
  departmentOptions: FacetOption[]
  onColumnVisibleChange: (column: Column<Appeal>, visible: boolean) => void
}) {
  const globalFilter = String(table.getState().globalFilter ?? '')
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Поиск по обращениям…"
        value={globalFilter}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        className="h-8 w-full sm:max-w-xs"
      />
      <FacetedFilter
        column={table.getColumn('sourceView')}
        title="Источник"
        options={sourceOptions}
      />
      <FacetedFilter
        column={table.getColumn('year')}
        title="Год"
        options={yearOptions}
      />
      <DateRangeFilter column={table.getColumn('dateIso')} title="Период" />
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
        column={table.getColumn('departmentProfile')}
        title="Профиль"
        options={departmentProfileOptions}
      />
      <FacetedFilter
        column={table.getColumn('departments')}
        title="Отделение"
        options={departmentOptions}
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
                  onCheckedChange={(v) => onColumnVisibleChange(column, !!v)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
