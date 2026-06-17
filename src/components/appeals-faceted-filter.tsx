import type { Column } from '@tanstack/react-table'
import { CheckIcon, PlusCircleIcon } from '@phosphor-icons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export type FacetOption = { label: string; value: string }

export function FacetedFilter<T>({
  column,
  title,
  options,
}: {
  column?: Column<T, unknown>
  title: string
  options: FacetOption[]
}) {
  const facets = column?.getFacetedUniqueValues()
  const selected = new Set((column?.getFilterValue() as string[]) ?? [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'border-dashed transition-[background-color,border-color,color,box-shadow] duration-300 ease-out',
            selected.size > 0 &&
              'border-solid border-primary/40 bg-primary/5 text-foreground',
          )}
        >
          <PlusCircleIcon
            className={cn('size-4 shrink-0', selected.size > 0 && 'text-primary')}
            weight="regular"
          />
          {title}
          <span
            className={cn(
              'grid min-w-0 grid-cols-[0fr] overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-out',
              selected.size > 0 ? 'grid-cols-[1fr] opacity-100' : 'opacity-0',
            )}
          >
            <span className="flex min-w-0 items-center overflow-hidden">
              <Separator
                orientation="vertical"
                className="mx-1 self-center data-[orientation=vertical]:h-4"
              />
              <Badge
                variant="secondary"
                className="h-6 min-w-6 justify-center rounded-full bg-primary/15 px-1.5 font-medium text-primary"
              >
                <span
                  key={selected.size}
                  className="appeals-badge-pop tabular-nums"
                >
                  {selected.size || ''}
                </span>
              </Badge>
            </span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-52 max-w-80 overflow-hidden p-0"
        align="start"
        sideOffset={6}
      >
        <div className="max-h-80 overflow-y-auto p-2.5">
          {options.map((option) => {
            const isSelected = selected.has(option.value)
            const count = facets?.get(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                onClick={() => {
                  const next = new Set(selected)
                  if (isSelected) next.delete(option.value)
                  else next.add(option.value)
                  const arr = [...next]
                  column?.setFilterValue(arr.length ? arr : undefined)
                }}
              >
                <span
                  className={cn(
                    'mt-px flex size-4 shrink-0 items-center justify-center rounded-[6px] border transition-[background-color,border-color,color] duration-200',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  <CheckIcon
                    className={cn(
                      'size-3 transition-opacity duration-160',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                    weight="bold"
                  />
                </span>
                <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
                  {option.label || '— не задано'}
                </span>
                {count !== undefined && (
                  <span
                    className={cn(
                      'ml-auto shrink-0 pt-px text-xs tabular-nums',
                      isSelected
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
            selected.size > 0
              ? 'grid-rows-[1fr] opacity-100'
              : 'pointer-events-none grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t p-1.5">
              <button
                type="button"
                tabIndex={selected.size > 0 ? 0 : -1}
                className="w-full rounded-xl px-3 py-1.5 text-center text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent"
                onClick={() => column?.setFilterValue(undefined)}
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
