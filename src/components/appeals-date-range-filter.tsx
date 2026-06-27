import * as React from 'react'
import type { Column } from '@tanstack/react-table'
import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  XIcon,
} from '@phosphor-icons/react'

import type { DateRangeFilterValue } from '@/components/appeals-table-columns'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

function normalizeRange(range: DateRangeFilterValue): DateRangeFilterValue {
  return {
    from: range.from || undefined,
    to: range.to || undefined,
  }
}

function parseIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

function calendarDays(month: Date) {
  const first = startOfMonth(month)
  const daysCount = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const previousMonth = addMonths(first, -1)
  const previousDaysCount = new Date(
    previousMonth.getFullYear(),
    previousMonth.getMonth() + 1,
    0,
  ).getDate()
  const days = [
    ...Array.from(
      { length: offset },
      (_, index) =>
        new Date(
          previousMonth.getFullYear(),
          previousMonth.getMonth(),
          previousDaysCount - offset + index + 1,
        ),
    ),
    ...Array.from(
      { length: daysCount },
      (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1),
    ),
  ]
  return [
    ...days,
    ...Array.from(
      { length: 42 - days.length },
      (_, index) => new Date(first.getFullYear(), first.getMonth() + 1, index + 1),
    ),
  ]
}

function monthLabel(month: Date) {
  return `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`
}

function formatDate(value?: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

function rangeLabel(range: DateRangeFilterValue) {
  if (range.from && range.to) return `${formatDate(range.from)}-${formatDate(range.to)}`
  if (range.from) return `с ${formatDate(range.from)}`
  if (range.to) return `до ${formatDate(range.to)}`
  return ''
}

export function DateRangeFilter<T>({
  column,
  title,
}: {
  column?: Column<T, unknown>
  title: string
}) {
  const value = normalizeRange(
    (column?.getFilterValue() as DateRangeFilterValue | undefined) ?? {},
  )
  const activeLabel = rangeLabel(value)
  const anchorDate = parseIsoDate(value.from ?? value.to)
  const [month, setMonth] = React.useState(() =>
    startOfMonth(anchorDate ?? new Date()),
  )
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`

  const setRange = (next: DateRangeFilterValue) => {
    const normalized = normalizeRange(next)
    column?.setFilterValue(
      normalized.from || normalized.to ? normalized : undefined,
    )
  }

  const selectDate = (date: Date) => {
    const iso = toIsoDate(date)
    if (!value.from || value.to) {
      setRange({ from: iso })
      return
    }

    if (iso < value.from) {
      setRange({ from: iso, to: value.from })
    } else {
      setRange({ from: value.from, to: iso })
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'border-dashed transition-[background-color,border-color,color,box-shadow] duration-300 ease-out',
            activeLabel &&
              'border-solid border-primary/40 bg-primary/5 text-foreground',
          )}
        >
          <CalendarBlankIcon
            className={cn('size-4 shrink-0', activeLabel && 'text-primary')}
            weight="regular"
          />
          {title}
          {activeLabel && (
            <span className="flex min-w-0 items-center overflow-hidden">
              <Separator
                orientation="vertical"
                className="mx-1 self-center data-[orientation=vertical]:h-4"
              />
              <span className="max-w-40 truncate text-xs font-medium text-primary">
                {activeLabel}
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(20rem,calc(100vw-2rem))] gap-4 p-4"
        align="start"
        sideOffset={6}
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Предыдущий месяц"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            <CaretLeftIcon />
          </Button>
          <div
            key={monthKey}
            className="appeals-fade-in min-w-0 text-sm font-medium"
          >
            {monthLabel(month)}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Следующий месяц"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            <CaretRightIcon />
          </Button>
        </div>

        <div
          key={monthKey}
          className="appeals-fade-in grid grid-cols-7 gap-1 text-center"
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {calendarDays(month).map((date) => {
            const iso = toIsoDate(date)
            const isOutsideMonth = date.getMonth() !== month.getMonth()
            const isStart = iso === value.from
            const isEnd = iso === value.to
            const isInside =
              Boolean(value.from && value.to) &&
              value.from! < iso &&
              iso < value.to!
            const isSelected = isStart || isEnd

            return (
              <button
                key={iso}
                type="button"
                className={cn(
                  'flex h-9 items-center justify-center rounded-2xl text-sm tabular-nums transition-[background-color,color,box-shadow,transform] duration-200 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-95',
                  isOutsideMonth && 'text-muted-foreground/35 hover:text-muted-foreground',
                  isInside && 'bg-primary/10 text-primary',
                  isSelected &&
                    'scale-100 bg-primary font-medium text-primary-foreground shadow-sm hover:bg-primary',
                )}
                onClick={() => selectDate(date)}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/70 px-3 py-2">
            <span className="text-muted-foreground">С</span>
            <span
              key={value.from ?? 'from-empty'}
              className={cn(
                'appeals-fade-in tabular-nums',
                value.from
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {formatDate(value.from) || 'не выбрано'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/70 px-3 py-2">
            <span className="text-muted-foreground">По</span>
            <span
              key={value.to ?? 'to-empty'}
              className={cn(
                'appeals-fade-in tabular-nums',
                value.to
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {formatDate(value.to) || 'не выбрано'}
            </span>
          </div>
        </div>
        <div
          className={cn(
            '-mt-4 grid transition-[grid-template-rows,opacity] duration-200 ease-out',
            activeLabel
              ? 'grid-rows-[1fr] opacity-100'
              : 'pointer-events-none grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full rounded-2xl transition-colors duration-200 hover:bg-muted hover:text-foreground"
                tabIndex={activeLabel ? 0 : -1}
                onClick={() => column?.setFilterValue(undefined)}
              >
                <XIcon />
                Сбросить период
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
