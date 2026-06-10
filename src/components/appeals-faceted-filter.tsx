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
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon />
          {title}
          {selected.size > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selected.size}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 overflow-hidden p-0" align="start">
        <div className="max-h-80 overflow-y-auto p-2">
          {options.map((option) => {
            const isSelected = selected.has(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
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
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {isSelected && <CheckIcon className="size-3" weight="bold" />}
                </span>
                <span className="line-clamp-2 flex-1 leading-snug">
                  {option.label || '— не задано'}
                </span>
                {facets?.get(option.value) !== undefined && (
                  <span className="shrink-0 self-start pt-0.5 text-xs text-muted-foreground tabular-nums">
                    {facets.get(option.value)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {selected.size > 0 && (
          <>
            <Separator />
            <button
              type="button"
              className="w-full px-2 py-2.5 text-center text-sm outline-none hover:bg-accent focus-visible:bg-accent"
              onClick={() => column?.setFilterValue(undefined)}
            >
              Сбросить
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
