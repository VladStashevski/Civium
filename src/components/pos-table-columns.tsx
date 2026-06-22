import type { ReactNode } from 'react'
import type {
  Column,
  ColumnDef,
  FilterFn,
  VisibilityState,
} from '@tanstack/react-table'
import { CaretUpDownIcon } from '@phosphor-icons/react'

import { TruncatedCell } from '@/components/appeals-table-cell'
import type { FacetOption } from '@/components/appeals-faceted-filter'
import { PosRowActions } from '@/components/pos-row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateShort } from '@/lib/appeals-data'
import type { PosMessage } from '@/lib/api'

export const COLUMN_LABELS: Record<string, string> = {
  number: 'Номер',
  epguNumber: 'Номер ЕПГУ',
  dateIso: 'Поступило',
  source: 'Источник',
  category: 'Категория',
  subcategory: 'Подкатегория',
  fact: 'Факт',
  status: 'Статус',
  stage: 'Стадия',
  completedIso: 'Завершено',
  plannedIso: 'План. срок',
  rating: 'Оценка',
  fastTrack: 'Фаст-трек',
  fz: 'ФЗ',
  executor: 'Исполнитель',
  coordinator: 'Координатор',
  departments: 'Отделения',
  justified: 'Обоснованность',
  issues: 'Проблемы',
  notes: 'Комментарий',
}

export const CENTERED_COLUMN_IDS = new Set([
  'dateIso',
  'epguNumber',
  'completedIso',
  'plannedIso',
  'rating',
  'fastTrack',
  'justified',
])

/** px (при базовом 16px) → rem, чтобы ширины росли вместе с авто-скейлом шрифта. */
export const remWidth = (px: number) => `${px / 16}rem`

/** Multi-select фильтр: значение строки должно входить в выбранный список. */
const inArray: FilterFn<PosMessage> = (row, columnId, value) => {
  const selected = value as string[]
  if (!selected?.length) return true
  return selected.includes(String(row.getValue(columnId) ?? ''))
}

function SortHeader({
  column,
  children,
}: {
  column: Column<PosMessage>
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 max-w-full min-w-0 justify-start overflow-hidden px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      <span className="truncate">{children}</span>
      <CaretUpDownIcon className="ml-1 size-3.5 shrink-0 opacity-60" />
    </Button>
  )
}

function DateCell({ iso }: { iso: string }) {
  return (
    <span className="block text-center tabular-nums whitespace-nowrap text-muted-foreground">
      {iso ? formatDateShort(iso) : '—'}
    </span>
  )
}

function getDepartments(message: PosMessage): string[] {
  return message.manualFields?.departments ?? []
}

export const columns: ColumnDef<PosMessage>[] = [
  {
    accessorKey: 'number',
    size: 130,
    minSize: 120,
    maxSize: 170,
    header: ({ column }) => <SortHeader column={column}>Номер</SortHeader>,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums whitespace-nowrap">
        {row.original.number}
      </span>
    ),
  },
  {
    accessorKey: 'epguNumber',
    size: 135,
    minSize: 120,
    maxSize: 170,
    header: ({ column }) => <SortHeader column={column}>Номер ЕПГУ</SortHeader>,
    cell: ({ row }) => (
      <span className="block text-center tabular-nums whitespace-nowrap text-muted-foreground">
        {row.original.epguNumber || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'dateIso',
    size: 120,
    minSize: 110,
    maxSize: 150,
    header: ({ column }) => <SortHeader column={column}>Поступило</SortHeader>,
    cell: ({ row }) => <DateCell iso={row.original.dateIso} />,
  },
  {
    accessorKey: 'source',
    size: 165,
    minSize: 140,
    maxSize: 320,
    header: 'Источник',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell text={row.original.source} className="text-muted-foreground" />
    ),
  },
  {
    accessorKey: 'category',
    size: 160,
    minSize: 130,
    maxSize: 320,
    header: 'Категория',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell text={row.original.category} className="text-muted-foreground" />
    ),
  },
  {
    accessorKey: 'subcategory',
    size: 210,
    minSize: 160,
    maxSize: 480,
    header: 'Подкатегория',
    filterFn: inArray,
    cell: ({ row }) => <TruncatedCell text={row.original.subcategory} />,
  },
  {
    accessorKey: 'fact',
    size: 240,
    minSize: 170,
    maxSize: 600,
    header: 'Факт',
    enableSorting: false,
    cell: ({ row }) => <TruncatedCell text={row.original.fact} />,
  },
  {
    accessorKey: 'status',
    size: 210,
    minSize: 170,
    maxSize: 420,
    header: 'Статус',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell text={row.original.status} className="text-muted-foreground" />
    ),
  },
  {
    accessorKey: 'stage',
    size: 140,
    minSize: 120,
    maxSize: 280,
    header: 'Стадия',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell text={row.original.stage} className="text-muted-foreground" />
    ),
  },
  {
    accessorKey: 'completedIso',
    size: 120,
    minSize: 110,
    maxSize: 150,
    header: ({ column }) => <SortHeader column={column}>Завершено</SortHeader>,
    cell: ({ row }) => <DateCell iso={row.original.completedIso} />,
  },
  {
    accessorKey: 'plannedIso',
    size: 120,
    minSize: 110,
    maxSize: 150,
    header: ({ column }) => <SortHeader column={column}>План. срок</SortHeader>,
    cell: ({ row }) => <DateCell iso={row.original.plannedIso} />,
  },
  {
    id: 'rating',
    size: 110,
    minSize: 110,
    maxSize: 140,
    accessorFn: (m) => (m.rating === null ? '' : String(m.rating)),
    header: ({ column }) => <SortHeader column={column}>Оценка</SortHeader>,
    filterFn: inArray,
    cell: ({ row }) => {
      const rating = row.original.rating
      if (rating === null) return <span className="block text-center text-muted-foreground/60">—</span>
      const good = rating >= 4
      return (
        <span className="flex justify-center">
          <Badge
            className={
              good
                ? 'border-transparent bg-positive/10 text-positive tabular-nums dark:bg-positive/15'
                : 'border-transparent bg-destructive/10 text-destructive tabular-nums'
            }
          >
            {rating}
          </Badge>
        </span>
      )
    },
  },
  {
    accessorKey: 'fastTrack',
    size: 120,
    minSize: 110,
    maxSize: 160,
    header: 'Фаст-трек',
    filterFn: inArray,
    cell: ({ row }) => (
      <span className="block text-center whitespace-nowrap text-muted-foreground">
        {row.original.fastTrack || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'fz',
    size: 180,
    minSize: 150,
    maxSize: 320,
    header: 'ФЗ',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell text={row.original.fz} className="text-muted-foreground" />
    ),
  },
  {
    accessorKey: 'executor',
    size: 190,
    minSize: 160,
    maxSize: 420,
    header: 'Исполнитель',
    cell: ({ row }) => <TruncatedCell text={row.original.executor} />,
  },
  {
    accessorKey: 'coordinator',
    size: 190,
    minSize: 160,
    maxSize: 420,
    header: 'Координатор',
    cell: ({ row }) => <TruncatedCell text={row.original.coordinator} />,
  },
  {
    id: 'departments',
    size: 190,
    minSize: 170,
    maxSize: 480,
    accessorFn: (m) => getDepartments(m).join(', '),
    header: ({ column }) => <SortHeader column={column}>Отделения</SortHeader>,
    cell: ({ getValue }) => <TruncatedCell text={getValue<string>()} />,
  },
  {
    id: 'justified',
    size: 220,
    minSize: 220,
    maxSize: 220,
    accessorFn: (m) =>
      m.manualFields?.isJustified === true
        ? 'Обоснованно'
        : m.manualFields?.isJustified === false
          ? 'Не обоснованно'
          : '',
    header: ({ column }) => <SortHeader column={column}>Обоснованность</SortHeader>,
    filterFn: inArray,
    cell: ({ row }) => {
      const v = row.original.manualFields?.isJustified
      if (v === true)
        return (
          <Badge className="border-transparent bg-destructive/10 text-destructive">
            Обоснованно
          </Badge>
        )
      if (v === false)
        return (
          <Badge className="border-transparent bg-positive/10 text-positive dark:bg-positive/15">
            Не обоснованно
          </Badge>
        )
      return <span className="text-muted-foreground/60">—</span>
    },
  },
  {
    id: 'issues',
    size: 210,
    minSize: 170,
    maxSize: 520,
    accessorFn: (m) => m.manualFields?.issues ?? '',
    header: 'Проблемы',
    enableSorting: false,
    cell: ({ row }) => <TruncatedCell text={row.original.manualFields?.issues} />,
  },
  {
    id: 'notes',
    size: 200,
    minSize: 170,
    maxSize: 480,
    accessorFn: (m) => m.manualFields?.notes ?? '',
    header: 'Комментарий',
    enableSorting: false,
    cell: ({ row }) => <TruncatedCell text={row.original.manualFields?.notes} />,
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
    cell: ({ row }) => <PosRowActions message={row.original} />,
  },
]

// По умолчанию — компактный набор под ноутбук. Остальное включается «Колонками».
export const DEFAULT_HIDDEN: VisibilityState = {
  fact: false,
  status: false,
  stage: false,
  completedIso: false,
  plannedIso: false,
  rating: false,
  fastTrack: false,
  fz: false,
  executor: false,
  coordinator: false,
  departments: false,
  justified: false,
  issues: false,
  notes: false,
}

export const COLUMN_MIN_WIDTHS: Record<string, number> = {
  number: 120,
  epguNumber: 120,
  dateIso: 110,
  source: 140,
  category: 130,
  subcategory: 160,
  fact: 170,
  status: 170,
  stage: 120,
  completedIso: 110,
  plannedIso: 110,
  rating: 110,
  fastTrack: 110,
  fz: 150,
  executor: 160,
  coordinator: 160,
  departments: 170,
  justified: 220,
  issues: 170,
  notes: 170,
  actions: 52,
}

export const RATING_OPTIONS: FacetOption[] = [
  { label: '5 — отлично', value: '5' },
  { label: '1 — плохо', value: '1' },
  { label: 'Без оценки', value: '' },
]

export const JUSTIFIED_OPTIONS: FacetOption[] = [
  { label: 'Обоснованно', value: 'Обоснованно' },
  { label: 'Не обоснованно', value: 'Не обоснованно' },
]

export function uniqueOptions(
  items: PosMessage[],
  getValue: (item: PosMessage) => string,
): FacetOption[] {
  const set = new Set<string>()
  for (const item of items) {
    const value = getValue(item)
    if (value) set.add(value)
  }
  return [...set]
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((v) => ({ label: v, value: v }))
}
