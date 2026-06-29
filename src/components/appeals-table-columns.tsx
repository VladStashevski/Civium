import type { ReactNode } from 'react'
import type {
  Column,
  ColumnDef,
  FilterFn,
  VisibilityState,
} from '@tanstack/react-table'
import { CaretUpDownIcon } from '@phosphor-icons/react'

import { AppealRowActions, inspectionLabel } from '@/components/appeal-row-actions'
import { TruncatedCell } from '@/components/appeals-table-cell'
import type { FacetOption } from '@/components/appeals-faceted-filter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Appeal } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'
import { DEPARTMENT_BY_NAME, resolveDepartmentName } from '@/lib/departments'

export const COLUMN_LABELS: Record<string, string> = {
  id: '№',
  dateIso: 'Дата',
  year: 'Год',
  content: 'Содержание',
  correspondent: 'Заявитель',
  profile: 'Рубрика',
  sourceView: 'Источник',
  registrationRoute: 'Контур регистрации',
  location: 'Город',
  rubricTheme: 'Тематика',
  departmentProfile: 'Профиль отделения',
  departments: 'Отделения',
  justified: 'Обоснованность',
  inspection: 'Проверка',
  issues: 'Проблемы',
  notes: 'Комментарий',
}

export const CENTERED_COLUMN_IDS = new Set(['dateIso', 'sourceView'])

export type DateRangeFilterValue = {
  from?: string
  to?: string
}

/**
 * Ширины колонок заданы в px (как при базовом font-size 16px), но рендерятся в rem,
 * чтобы расти вместе с глобальным авто-скейлом шрифта на больших экранах —
 * иначе текст в ячейках обрезался бы сильнее при крупном шрифте и фиксированных px.
 */
export const remWidth = (px: number) => `${px / 16}rem`

function getDepartments(a: Appeal): string[] {
  const manual = a.manualFields?.departments
  const departments = manual && manual.length ? manual : (a.departments ?? [])
  return [...new Set(departments.map(resolveDepartmentName).filter(Boolean))]
}

function getDepartmentProfiles(a: Appeal): string[] {
  return [
    ...new Set(
      getDepartments(a)
        .map((department) => DEPARTMENT_BY_NAME.get(department)?.profile)
        .filter((profile): profile is string => Boolean(profile)),
    ),
  ]
}

/** Multi-select filter: row value (single string) must be one of the selected values. */
const inArray: FilterFn<Appeal> = (row, columnId, value) => {
  const selected = value as string[]
  if (!selected?.length) return true
  return selected.includes(String(row.getValue(columnId) ?? ''))
}

const intersectsArray: FilterFn<Appeal> = (row, columnId, value) => {
  const selected = value as string[]
  if (!selected?.length) return true
  const rowValues = String(row.getValue(columnId) ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  return rowValues.some((item) => selected.includes(item))
}

const inDateRange: FilterFn<Appeal> = (row, columnId, value) => {
  const range = value as DateRangeFilterValue | undefined
  if (!range?.from && !range?.to) return true

  const date = String(row.getValue(columnId) ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false

  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

function SortHeader({
  column,
  children,
}: {
  column: Column<Appeal>
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

export const columns: ColumnDef<Appeal>[] = [
  {
    accessorKey: 'id',
    size: 110,
    minSize: 110,
    maxSize: 140,
    header: ({ column }) => <SortHeader column={column}>№</SortHeader>,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums whitespace-nowrap">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: 'dateIso',
    size: 110,
    minSize: 110,
    maxSize: 150,
    header: ({ column }) => <SortHeader column={column}>Дата</SortHeader>,
    filterFn: inDateRange,
    cell: ({ row }) => (
      <span className="block text-center tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDateShort(row.original.dateIso)}
      </span>
    ),
  },
  {
    id: 'year',
    size: 90,
    minSize: 90,
    maxSize: 110,
    accessorFn: (a) => a.dateIso.slice(0, 4),
    header: ({ column }) => <SortHeader column={column}>Год</SortHeader>,
    filterFn: inArray,
    cell: ({ getValue }) => (
      <span className="block text-center tabular-nums text-muted-foreground">
        {getValue<string>() || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'content',
    size: 220,
    minSize: 160,
    maxSize: 600,
    header: 'Содержание',
    cell: ({ row }) => <TruncatedCell text={row.original.content} />,
  },
  {
    accessorKey: 'correspondent',
    size: 175,
    minSize: 165,
    maxSize: 420,
    header: 'Заявитель',
    cell: ({ row }) => (
      <TruncatedCell text={row.original.correspondent} />
    ),
  },
  {
    accessorKey: 'profile',
    size: 190,
    minSize: 130,
    maxSize: 480,
    header: 'Рубрика',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.profile}
        className="text-muted-foreground"
      />
    ),
  },
  {
    id: 'sourceView',
    size: 200,
    minSize: 200,
    maxSize: 420,
    accessorFn: (appeal) =>
      appeal.appealMode === 'chiefDoctor'
        ? appeal.sourceChannel
        : appeal.sourceOrganizationDetail || appeal.sourceOrganization,
    header: 'Источник',
    filterFn: inArray,
    cell: ({ getValue }) => (
      <TruncatedCell
        text={getValue<string>()}
        className="text-center text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'registrationRoute',
    size: 220,
    minSize: 220,
    maxSize: 380,
    header: 'Контур регистрации',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.registrationRoute}
        className="text-muted-foreground"
      />
    ),
  },
  {
    accessorKey: 'location',
    size: 130,
    minSize: 110,
    maxSize: 240,
    header: 'Город',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.location || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'rubricTheme',
    size: 180,
    minSize: 150,
    maxSize: 420,
    header: 'Тематика',
    filterFn: inArray,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.rubricTheme}
        className="text-muted-foreground"
      />
    ),
  },
  {
    id: 'departments',
    size: 190,
    minSize: 170,
    maxSize: 480,
    accessorFn: (a) => getDepartments(a).join('\n'),
    header: ({ column }) => <SortHeader column={column}>Отделения</SortHeader>,
    filterFn: intersectsArray,
    cell: ({ row }) => <TruncatedCell text={getDepartments(row.original).join(', ')} />,
  },
  {
    id: 'departmentProfile',
    size: 190,
    minSize: 170,
    maxSize: 420,
    accessorFn: (a) => getDepartmentProfiles(a).join('\n'),
    header: ({ column }) => <SortHeader column={column}>Профиль отделения</SortHeader>,
    filterFn: intersectsArray,
    cell: ({ row }) => (
      <TruncatedCell text={getDepartmentProfiles(row.original).join(', ')} />
    ),
  },
  {
    id: 'justified',
    size: 220,
    minSize: 220,
    maxSize: 220,
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
    id: 'inspection',
    size: 150,
    minSize: 150,
    maxSize: 150,
    accessorFn: (a) => inspectionLabel(a.manualFields?.inspection),
    header: ({ column }) => <SortHeader column={column}>Проверка</SortHeader>,
    filterFn: inArray,
    cell: ({ row }) => {
      const inspection = row.original.manualFields?.inspection
      const label = inspectionLabel(inspection)
      if (!label) return <span className="text-muted-foreground/60">—</span>
      return (
        <Badge
          className={
            inspection === 'vnk'
              ? 'border-transparent bg-inspection-vnk/10 text-inspection-vnk'
              : 'border-transparent bg-inspection-service/15 text-inspection-service'
          }
        >
          {label}
        </Badge>
      )
    },
  },
  {
    id: 'issues',
    size: 210,
    minSize: 170,
    maxSize: 520,
    accessorFn: (a) => a.manualFields?.issues ?? '',
    header: 'Проблемы',
    enableSorting: false,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.manualFields?.issues}
      />
    ),
  },
  {
    id: 'notes',
    size: 190,
    minSize: 170,
    maxSize: 480,
    accessorFn: (a) => a.manualFields?.notes ?? '',
    header: 'Комментарий',
    enableSorting: false,
    cell: ({ row }) => (
      <TruncatedCell
        text={row.original.manualFields?.notes}
      />
    ),
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
    cell: ({ row }) => <AppealRowActions appeal={row.original} />,
  },
]

// По умолчанию показываем только то, что комфортно влезает на ноутбучную ширину
// (№, Дата, Содержание, Заявитель, Рубрика, ⋮). Остальные колонки включаются
// через меню «Колонки» — тогда таблица скроллится по горизонтали в своей области.
export const DEFAULT_HIDDEN: VisibilityState = {
  year: false,
  sourceView: false,
  registrationRoute: false,
  location: false,
  rubricTheme: false,
  departmentProfile: false,
  departments: false,
  justified: false,
  issues: false,
  notes: false,
}

export const COLUMN_MIN_WIDTHS: Record<string, number> = {
  id: 110,
  dateIso: 110,
  year: 90,
  content: 160,
  correspondent: 165,
  profile: 130,
  sourceView: 200,
  registrationRoute: 220,
  location: 110,
  rubricTheme: 150,
  departmentProfile: 170,
  departments: 170,
  justified: 220,
  inspection: 150,
  issues: 170,
  notes: 170,
  actions: 52,
}

export const JUSTIFIED_OPTIONS: FacetOption[] = [
  { label: 'Обоснованно', value: 'Обоснованно' },
  { label: 'Не обоснованно', value: 'Не обоснованно' },
  { label: 'Не задано', value: '' },
]

export function uniqueOptions(
  items: Appeal[],
  getValue: (item: Appeal) => string,
): FacetOption[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const value = getValue(item)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([value, count]) => ({ label: value, value, count }))
}
