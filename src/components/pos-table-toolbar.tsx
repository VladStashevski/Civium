import type { Column, Table } from '@tanstack/react-table'
import { SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react'

import { FacetedFilter, type FacetOption } from '@/components/appeals-faceted-filter'
import {
  COLUMN_LABELS,
  JUSTIFIED_OPTIONS,
  RATING_OPTIONS,
} from '@/components/pos-table-columns'
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
import type { PosMessage } from '@/lib/api'

export function PosToolbar({
  table,
  sourceOptions,
  yearOptions,
  categoryOptions,
  subcategoryOptions,
  statusOptions,
  onColumnVisibleChange,
}: {
  table: Table<PosMessage>
  sourceOptions: FacetOption[]
  yearOptions: FacetOption[]
  categoryOptions: FacetOption[]
  subcategoryOptions: FacetOption[]
  statusOptions: FacetOption[]
  onColumnVisibleChange: (column: Column<PosMessage>, visible: boolean) => void
}) {
  const globalFilter = String(table.getState().globalFilter ?? '')
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Поиск по ПОС…"
        value={globalFilter}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        className="h-8 w-full sm:max-w-xs"
      />
      <FacetedFilter
        column={table.getColumn('source')}
        title="Источник"
        options={sourceOptions}
      />
      <FacetedFilter
        column={table.getColumn('year')}
        title="Год"
        options={yearOptions}
      />
      <FacetedFilter
        column={table.getColumn('category')}
        title="Категория"
        options={categoryOptions}
      />
      <FacetedFilter
        column={table.getColumn('subcategory')}
        title="Подкатегория"
        options={subcategoryOptions}
      />
      <FacetedFilter
        column={table.getColumn('status')}
        title="Статус"
        options={statusOptions}
      />
      <FacetedFilter
        column={table.getColumn('rating')}
        title="Оценка"
        options={RATING_OPTIONS}
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
