import type { Table } from '@tanstack/react-table'
import {
  CaretDownIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/** Перезапускает CSS-анимацию появления при каждой смене значения (key={value}). */
export function AnimatedPaginationText({
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

export function AppealsPagination<TData>({ table }: { table: Table<TData> }) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()

  return (
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
  )
}
