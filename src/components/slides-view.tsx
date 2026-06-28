import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppeals, useReferences } from '@/hooks/use-appeals'
import { isGratitudeAppeal } from '@/lib/appeals-data'
import type { Appeal, AppealMode, Theme } from '@/lib/api'
import {
  DEPARTMENT_BY_NAME,
  DEPARTMENT_GROUPS,
  DEPARTMENT_OPTIONS,
  resolveDepartmentName,
} from '@/lib/departments'
import { cn } from '@/lib/utils'

const MONTHS_SHORT = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
]
const yearOf = (a: Appeal) => a.dateIso?.slice(0, 4) ?? ''
const monthOf = (a: Appeal) => a.dateIso?.slice(5, 7) ?? ''
const isGratitude = (a: Appeal) => isGratitudeAppeal(a)
const isDiscontinued = (a: Appeal) => /прекращ/i.test(a.profile ?? '')
const effDepartments = (a: Appeal): string[] => {
  const m = a.manualFields?.departments
  return (m && m.length ? m : a.departments) ?? []
}

const numFmt = (n: number) => n.toLocaleString('ru-RU')
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const pctValue = (prev: number, cur: number): number | null =>
  prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / prev) * 100
const pctText = (p: number | null) =>
  p === null ? 'новое' : `${p > 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%`
const deltaClass = (d: number) =>
  d > 0 ? 'text-destructive' : d < 0 ? 'text-emerald-600' : 'text-muted-foreground'

type RankRow = { name: string; prev: number; cur: number }
type MonthRow = { name: string; prev: number; cur: number }
type ThemeColumn = { name: string; label: string; title: string }
type DepartmentSlideRow = RankRow & {
  deltaPercent: number | null
  themes: Record<string, { prev: number; cur: number }>
}

const THEME_SHORT_LABELS: Record<string, string> = {
  A: 'Кач.',
  B: 'Орг.',
  C: 'Кадры',
  D: 'Лек.',
  E: 'Эксп.',
  F: 'Станд.',
  G: 'ОМС',
  H: 'Благ.',
  I: 'Дело',
}

function rankRows(prev: Appeal[], cur: Appeal[], getKeys: (a: Appeal) => string[]): RankRow[] {
  const tally = (arr: Appeal[]) => {
    const m = new Map<string, number>()
    for (const it of arr) for (const k of getKeys(it)) if (k) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const p = tally(prev)
  const c = tally(cur)
  return [...new Set([...p.keys(), ...c.keys()])]
    .map((name) => ({ name, prev: p.get(name) ?? 0, cur: c.get(name) ?? 0 }))
    .sort((a, b) => b.cur - a.cur || b.prev - a.prev)
}

function officialDepartments(appeal: Appeal): string[] {
  return effDepartments(appeal)
    .map(resolveDepartmentName)
    .filter((department) => DEPARTMENT_BY_NAME.has(department))
}

function departmentProfiles(appeal: Appeal): string[] {
  return [
    ...new Set(
      officialDepartments(appeal)
        .map((department) => DEPARTMENT_BY_NAME.get(department)?.profile)
        .filter((profile): profile is string => Boolean(profile)),
    ),
  ]
}

function countOfficialRows(
  prev: Appeal[],
  cur: Appeal[],
  allNames: string[],
  getKeys: (appeal: Appeal) => string[],
  themeColumns: ThemeColumn[] = [],
): DepartmentSlideRow[] {
  const emptyThemes = () =>
    Object.fromEntries(
      themeColumns.map((theme) => [theme.name, { prev: 0, cur: 0 }]),
    )
  const rows = new Map<string, DepartmentSlideRow>(
    allNames.map((name) => [
      name,
      {
        name,
        prev: 0,
        cur: 0,
        deltaPercent: 0,
        themes: emptyThemes(),
      },
    ]),
  )
  const themeNames = new Set(themeColumns.map((theme) => theme.name))
  const add = (records: Appeal[], side: 'prev' | 'cur') => {
    for (const record of records) {
      const theme = record.rubricTheme ?? ''
      for (const key of new Set(getKeys(record))) {
        if (!key) continue
        const row = rows.get(key)
        if (!row) continue
        row[side] += 1
        if (themeNames.has(theme)) row.themes[theme][side] += 1
      }
    }
  }
  add(prev, 'prev')
  add(cur, 'cur')

  return [...rows.values()].map((row) => {
    row.deltaPercent = pctValue(row.prev, row.cur)
    return row
  })
}

function themeColumnsFromReferences(themes: Theme[]): ThemeColumn[] {
  return themes.map((theme, index) => ({
    name: theme.name,
    label: THEME_SHORT_LABELS[theme.code ?? ''] ?? String(index + 1),
    title: theme.name,
  }))
}

const DEPARTMENT_PROFILE_COLORS = [
  '#1d4ed8',
  '#047857',
  '#7c3aed',
  '#dc2626',
  '#b45309',
] as const

// ---------- building blocks ----------

function Slide({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="slide flex w-full flex-col gap-5 overflow-hidden rounded-xl border border-neutral-200 bg-white p-6 text-neutral-950 shadow-sm md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <span className="text-sm font-bold tracking-wider text-neutral-950 uppercase">
          Слайд {n}
        </span>
        <h2 className="text-right text-base leading-tight font-bold md:text-lg">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Legend({ prevYear, curYear }: { prevYear: string; curYear: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground uppercase">
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-sm bg-emerald-500" />
        {prevYear}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-sm bg-primary" />
        {curYear}
      </span>
    </div>
  )
}

function TotalRail({
  prevYear,
  curYear,
  prevTotal,
  curTotal,
  gratPrev,
  gratCur,
  discPrev,
  discCur,
  aPrev,
  aCur,
}: Record<string, number | string>) {
  const aDelta = (aCur as number) - (aPrev as number)
  return (
    <div className="grid grid-cols-1 items-center gap-3 rounded-lg border bg-muted/30 px-5 py-3 md:grid-cols-[1fr_auto_1fr]">
      <div className="text-center md:text-right">
        <div className="text-[11px] leading-tight font-bold text-muted-foreground uppercase">
          {numFmt(prevTotal as number)} всего −{' '}
          <span className="text-emerald-600">{gratPrev} благодарностей</span> −{' '}
          <span className="text-amber-600">{discPrev} прекращений</span>
        </div>
        <div className="text-[10px] text-muted-foreground">В статистике за {prevYear}</div>
        <div className={cn('mt-1 text-4xl leading-none font-extrabold tabular-nums md:text-5xl', aDelta > 0 ? 'text-emerald-600' : 'text-destructive')}>
          {numFmt(aPrev as number)}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="inline-block rotate-90 text-2xl text-destructive md:rotate-0">→</span>
        <span className={cn('text-2xl font-extrabold tabular-nums md:text-3xl', deltaClass(aDelta))}>
          {signed(aDelta)}
        </span>
      </div>
      <div className="text-center md:text-left">
        <div className="text-[11px] leading-tight font-bold text-muted-foreground uppercase">
          {numFmt(curTotal as number)} всего −{' '}
          <span className="text-emerald-600">{gratCur} благодарностей</span> −{' '}
          <span className="text-amber-600">{discCur} прекращений</span>
        </div>
        <div className="text-[10px] text-muted-foreground">В статистике за {curYear}</div>
        <div className={cn('mt-1 text-4xl leading-none font-extrabold tabular-nums md:text-5xl', aDelta > 0 ? 'text-destructive' : 'text-emerald-600')}>
          {numFmt(aCur as number)}
        </div>
      </div>
    </div>
  )
}

function GroupedBars({
  monthly,
  compact = false,
}: {
  monthly: MonthRow[]
  compact?: boolean
}) {
  const max = Math.max(...monthly.flatMap((m) => [m.prev, m.cur]), 1)
  const Bar = ({ v, c }: { v: number; c: string }) => (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
      {!compact && (
        <span className="text-[10px] leading-none font-bold tabular-nums md:text-xs">
          {v}
        </span>
      )}
      <div
        className={cn('w-full rounded-t', c, compact ? 'max-w-2.5' : 'max-w-4 md:max-w-5')}
        style={{ height: `${(v / max) * 80}%` }}
      />
    </div>
  )
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-end gap-1 border-b-2 border-border px-1 md:gap-2">
        {monthly.map((m) => (
          <div key={m.name} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
            <Bar v={m.prev} c="bg-emerald-500" />
            <Bar v={m.cur} c="bg-primary" />
          </div>
        ))}
      </div>
      <div className="flex gap-1 px-1 pt-1.5 md:gap-2">
        {monthly.map((m) => (
          <span
            key={m.name}
            className="min-w-0 flex-1 truncate text-center text-[10px] font-medium md:text-xs"
          >
            {m.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function DeltaBars({ monthly }: { monthly: MonthRow[] }) {
  const max = Math.max(...monthly.map((m) => Math.abs(m.cur - m.prev)), 1)
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-end gap-1 border-b-2 border-border px-1 md:gap-2">
        {monthly.map((m) => {
          const d = m.cur - m.prev
          return (
            <div key={m.name} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={cn('text-[10px] leading-none font-bold tabular-nums md:text-sm', deltaClass(d))}>
                {d === 0 ? '0' : signed(d)}
              </span>
              <div
                className={cn(
                  'w-full max-w-6 md:max-w-8',
                  d > 0 ? 'bg-destructive' : d < 0 ? 'bg-emerald-500' : 'bg-muted',
                )}
                style={{ height: `${d ? Math.max((Math.abs(d) / max) * 80, 3) : 0}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 px-1 pt-1.5 md:gap-2">
        {monthly.map((m) => (
          <span key={m.name} className="min-w-0 flex-1 truncate text-center text-[10px] font-medium md:text-xs">
            {m.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function RankTable({
  rows,
  prevYear,
  curYear,
  nameHeader,
}: {
  rows: RankRow[]
  prevYear: string
  curYear: string
  nameHeader: string
}) {
  const maxPct = Math.max(
    ...rows.map((r) => pctValue(r.prev, r.cur)).filter((v): v is number => v !== null).map(Math.abs),
    1,
  )
  if (!rows.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">Нет данных</p>
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_minmax(0,0.85fr)] gap-1.5 border-b px-1 pb-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        <span>{nameHeader}</span>
        <span className="text-center">{prevYear}</span>
        <span className="text-center">{curYear}</span>
        <span>Изменение</span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {rows.map((r) => {
          const pct = pctValue(r.prev, r.cur)
          const up = r.cur > r.prev
          const width = pct === null ? 100 : Math.min((Math.abs(pct) / maxPct) * 100, 100)
          return (
            <div
              key={r.name}
              className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_minmax(0,0.85fr)] items-stretch gap-1.5"
            >
              <div
                className="flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs leading-tight font-semibold"
                title={r.name}
              >
                <span className="line-clamp-2">{r.name}</span>
              </div>
              <div className="flex items-center justify-center rounded-md border bg-muted text-sm font-bold tabular-nums">
                {r.prev}
              </div>
              <div className="flex items-center justify-center rounded-md border border-primary/25 bg-primary/15 text-base font-bold tabular-nums">
                {r.cur}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                  <div
                    className={cn('h-full', up ? 'bg-destructive' : 'bg-emerald-500')}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className={cn('w-12 shrink-0 text-right text-[11px] font-bold tabular-nums', up ? 'text-destructive' : 'text-emerald-600')}>
                  {pctText(pct)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- main ----------

export function SlidesView({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  const { data: references, isPending: referencesPending } = useReferences(mode)
  const isMobile = useIsMobile()
  const items = React.useMemo(() => data?.items ?? [], [data])

  const yearOptions = React.useMemo(() => {
    const set = new Set(items.map(yearOf).filter(Boolean))
    if (set.size) set.add(String(Math.max(...[...set].map(Number)) - 1))
    return [...set].sort((a, b) => Number(b) - Number(a))
  }, [items])

  const themeColumns = React.useMemo(
    () => themeColumnsFromReferences(references?.themes ?? []),
    [references],
  )
  const themeOptions = React.useMemo(
    () => themeColumns.map((theme) => theme.name),
    [themeColumns],
  )

  const [selectedCurYear, setCurYear] = React.useState('')
  const [selectedPrevYear, setPrevYear] = React.useState('')
  const [themes, setThemes] = React.useState<string[]>([]) // пусто = все
  const [comparable, setComparable] = React.useState(true) // только сопоставимый период
  const curYear = selectedCurYear || yearOptions[0] || ''
  const prevYear =
    selectedPrevYear || yearOptions[1] || (curYear ? String(Number(curYear) - 1) : '')

  if (isPending || referencesPending) {
    return (
      <div className="px-4 lg:px-6">
        <Skeleton className="mx-auto aspect-video w-full max-w-7xl rounded-xl" />
      </div>
    )
  }

  const inThemes = (a: Appeal) => themes.length === 0 || themes.includes(a.rubricTheme ?? '')

  const cutoffMonthDay =
    items
      .filter((item) => yearOf(item) === curYear)
      .map((item) => item.dateIso.slice(5))
      .filter(Boolean)
      .sort()
      .at(-1) ?? '12-31'
  const monthsLimit = comparable ? Number(cutoffMonthDay.slice(0, 2)) || 12 : 12
  const inWindow = (appeal: Appeal) =>
    !comparable || appeal.dateIso.slice(5) <= cutoffMonthDay
  const periodLabel =
    !comparable || cutoffMonthDay === '12-31'
      ? `${prevYear} / ${curYear}`
      : `01.01–${cutoffMonthDay.slice(3)}.${cutoffMonthDay.slice(0, 2)} · ${prevYear} / ${curYear}`

  const prevAll = items.filter((it) => yearOf(it) === prevYear && inWindow(it))
  const curAll = items.filter((it) => yearOf(it) === curYear && inWindow(it))
  const refPrevItems = prevAll.filter((it) => !isGratitude(it))
  const refCurItems = curAll.filter((it) => !isGratitude(it))
  const aPrevItems = refPrevItems.filter((it) => !isDiscontinued(it))
  const aCurItems = refCurItems.filter((it) => !isDiscontinued(it))

  // глубокий анализ (слайды 3–4) — с тем же составом, что справочники, плюс фильтр по темам
  const deepPrev = refPrevItems.filter(inThemes)
  const deepCur = refCurItems.filter(inThemes)

  const monthly: MonthRow[] = MONTHS_SHORT.map((name, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const c = (arr: Appeal[]) => arr.filter((it) => monthOf(it) === mm).length
    return { name, prev: c(aPrevItems), cur: c(aCurItems) }
  })
  const months = monthly.slice(0, monthsLimit)

  const deepMonthly: MonthRow[] = MONTHS_SHORT.map((name, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const c = (arr: Appeal[]) => arr.filter((it) => monthOf(it) === mm).length
    return { name, prev: c(deepPrev), cur: c(deepCur) }
  }).slice(0, monthsLimit)

  const sources = rankRows(refPrevItems, refCurItems, (appeal) => [
    mode === 'chiefDoctor'
      ? appeal.sourceChannel || 'Источник не определён'
      : appeal.sourceOrganizationDetail ||
        appeal.sourceOrganization ||
        'Источник не определён',
  ])
  const topics = countOfficialRows(
    refPrevItems,
    refCurItems,
    themeOptions,
    (a) => [a.rubricTheme || ''],
  )
  const deepTopics = countOfficialRows(
    deepPrev,
    deepCur,
    themeOptions,
    (a) => [a.rubricTheme || ''],
  )
  const rubrics = rankRows(deepPrev, deepCur, (a) => [a.profile || '—']).slice(0, 9)

  const just = (arr: Appeal[]) => ({
    yes: arr.filter((it) => it.manualFields?.isJustified === true).length,
    no: arr.filter((it) => it.manualFields?.isJustified === false).length,
  })
  const jPrev = just(deepPrev)
  const jCur = just(deepCur)

  const departmentProfileRows = countOfficialRows(
    deepPrev,
    deepCur,
    DEPARTMENT_GROUPS.map((group) => group.profile),
    departmentProfiles,
    themeColumns,
  )
  const departmentProfileRowByName = new Map(
    departmentProfileRows.map((row) => [row.name, row] as const),
  )
  const departmentRows = countOfficialRows(
    deepPrev,
    deepCur,
    DEPARTMENT_OPTIONS.map((department) => department.value),
    officialDepartments,
    themeColumns,
  )
  const departmentRowByName = new Map(
    departmentRows.map((row) => [row.name, row] as const),
  )
  const departmentSections = DEPARTMENT_GROUPS.map((group, index) => ({
    profile: group.profile,
    color: DEPARTMENT_PROFILE_COLORS[index % DEPARTMENT_PROFILE_COLORS.length],
    total: departmentProfileRowByName.get(group.profile) ?? {
      name: group.profile,
      prev: 0,
      cur: 0,
      deltaPercent: 0,
      themes: Object.fromEntries(
        themeColumns.map((theme) => [theme.name, { prev: 0, cur: 0 }]),
      ),
    },
    rows: group.departments
      .map((department) => departmentRowByName.get(department.name))
      .filter((row): row is DepartmentSlideRow => Boolean(row)),
  }))
  const departmentGridTemplate = `minmax(0,1fr) 2rem 2rem 3.6rem repeat(${themeColumns.length}, 2.4rem)`

  const yearSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-[92px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="p-2">
        {yearOptions.map((y) => (
          <SelectItem key={y} value={y}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Сравнить годы:</span>
          {yearSelect(prevYear, setPrevYear)}
          <span className="text-muted-foreground">→</span>
          {yearSelect(curYear, setCurYear)}
          <Button
            size="sm"
            variant={comparable ? 'secondary' : 'outline'}
            className="ml-2 h-8 rounded-full"
            onClick={() => setComparable((v) => !v)}
            title="Сравнивать только период, который есть в неполном году"
          >
            Сопоставимый период
            {comparable && monthsLimit < 12
              ? ` · ${MONTHS_SHORT[0].toLowerCase()}–${MONTHS_SHORT[monthsLimit - 1].toLowerCase()}`
              : ''}
          </Button>
        </div>
        <div className="grid gap-2">
          <span className="text-sm text-muted-foreground">Тематики для слайдов:</span>
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-9">
          {themeColumns.map((theme) => {
            const active = themes.length === 0 || themes.includes(theme.name)
            return (
              <Button
                key={theme.name}
                size="sm"
                variant={active ? 'secondary' : 'outline'}
                className="h-7 rounded-full px-2 text-xs"
                title={theme.title}
                onClick={() =>
                  setThemes((prev) => {
                    const current = prev.length ? prev : themeOptions
                    const next = current.includes(theme.name)
                      ? current.filter((item) => item !== theme.name)
                      : [...current, theme.name]
                    return next.length === themeOptions.length || next.length === 0
                      ? []
                      : next
                  })
                }
              >
                {theme.label}
              </Button>
            )
          })}
          </div>
        </div>
      </div>

      <div className="slides-deck mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 lg:px-6">
        {/* СЛАЙД 1 */}
        <Slide n={1} title={`Обращения граждан: ${periodLabel}`}>
          <TotalRail
            prevYear={prevYear}
            curYear={curYear}
            prevTotal={prevAll.length}
            curTotal={curAll.length}
            gratPrev={prevAll.filter(isGratitude).length}
            gratCur={curAll.filter(isGratitude).length}
            discPrev={prevAll.filter(isDiscontinued).length}
            discCur={curAll.filter(isDiscontinued).length}
            aPrev={aPrevItems.length}
            aCur={aCurItems.length}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
            <div className="flex flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">Обращения по месяцам</span>
                <Legend prevYear={prevYear} curYear={curYear} />
              </div>
              <div className="h-[280px]">
                <GroupedBars monthly={months} compact={isMobile} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="mb-2 text-sm font-bold">Динамика к {prevYear} (рост / спад)</span>
              <div className="h-[280px]">
                <DeltaBars monthly={months} />
              </div>
            </div>
          </div>
        </Slide>

        {/* СЛАЙД 2 */}
        <Slide n={2} title={`Источники и тематика: ${periodLabel}`}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
            <div className="flex flex-col">
              <span className="mb-2 text-sm font-bold">
                Источники поступления
              </span>
              <RankTable
                rows={sources}
                prevYear={prevYear}
                curYear={curYear}
                nameHeader={mode === 'chiefDoctor' ? 'Источник 07/19' : 'Источник 01-* / 07-*'}
              />
            </div>
            <div className="flex flex-col">
              <span className="mb-2 text-sm font-bold">Тематика обращений</span>
              <RankTable rows={topics} prevYear={prevYear} curYear={curYear} nameHeader="Тематика" />
            </div>
          </div>
        </Slide>

        {/* СЛАЙД 3 */}
        <Slide n={3} title={`Углублённый анализ: ${periodLabel}`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex h-[170px] flex-col justify-center rounded-lg border bg-muted/30 p-4">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">Всего в анализе</div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-extrabold tabular-nums text-emerald-600">{numFmt(deepPrev.length)}</div>
                  <div className="text-xs text-muted-foreground">{prevYear}</div>
                </div>
                <span className={cn('text-lg font-bold tabular-nums', deltaClass(deepCur.length - deepPrev.length))}>
                  {signed(deepCur.length - deepPrev.length)}
                </span>
                <div className="text-center">
                  <div className="text-3xl font-extrabold tabular-nums text-primary">{numFmt(deepCur.length)}</div>
                  <div className="text-xs text-muted-foreground">{curYear}</div>
                </div>
              </div>
            </div>
            <div className="flex h-[170px] flex-col rounded-lg border bg-muted/30 p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">По месяцам</span>
                <Legend prevYear={prevYear} curYear={curYear} />
              </div>
              <div className="min-h-0 flex-1">
                <GroupedBars monthly={deepMonthly} compact={isMobile} />
              </div>
            </div>
            <div className="flex h-[170px] flex-col justify-center rounded-lg border bg-muted/30 p-4">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">Оценка обоснованности</div>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th />
                    <th className="w-12 text-right font-medium">{prevYear}</th>
                    <th className="w-12 text-right font-medium">{curYear}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5">Обоснованные</td>
                    <td className="text-right text-xl font-extrabold tabular-nums text-emerald-600">{jPrev.yes}</td>
                    <td className="text-right text-xl font-extrabold tabular-nums text-primary">{jCur.yes}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5">Необоснованные</td>
                    <td className="text-right text-xl font-extrabold tabular-nums text-emerald-600">{jPrev.no}</td>
                    <td className="text-right text-xl font-extrabold tabular-nums text-primary">{jCur.no}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col">
              <span className="mb-2 text-sm font-bold">Тематики обращений</span>
              <RankTable
                rows={deepTopics}
                prevYear={prevYear}
                curYear={curYear}
                nameHeader="Тематика"
              />
            </div>
            <div className="flex flex-col">
              <span className="mb-2 text-sm font-bold">Рубрики обращений</span>
              <RankTable
                rows={rubrics}
                prevYear={prevYear}
                curYear={curYear}
                nameHeader="Рубрика"
              />
            </div>
          </div>
        </Slide>

        {/* СЛАЙД 4 */}
        <Slide n={4} title={`Отделения и профили: ${periodLabel}`}>
          <div className="grid grid-cols-1 gap-4">
              {departmentSections.map((section) => (
                <div key={section.profile} className="slide-section flex flex-col gap-1.5">
                  <div
                    className="border-b-2 pb-1 text-[12px] font-bold tracking-wide uppercase"
                    style={{ color: section.color, borderColor: section.color }}
                  >
                    {section.profile}
                  </div>
                  <div
                    className="grid items-center gap-1 px-1.5 text-[9px] font-bold text-muted-foreground uppercase"
                    style={{ gridTemplateColumns: departmentGridTemplate }}
                  >
                    <span>Отделение</span>
                    <span className="text-center">{prevYear}</span>
                    <span className="text-center">{curYear}</span>
                    <span className="text-center">Δ%</span>
                    {themeColumns.map((theme) => (
                      <span
                        key={theme.name}
                        className="text-center normal-case"
                        title={theme.title}
                      >
                        {theme.label}
                      </span>
                    ))}
                  </div>
                  <div
                    className="grid items-center gap-1 rounded-md bg-muted/55 px-1.5 py-1"
                    style={{ gridTemplateColumns: departmentGridTemplate }}
                  >
                    <span className="truncate text-[11px] font-extrabold uppercase">
                      Общий
                    </span>
                    <span className="text-center text-xs font-bold tabular-nums text-muted-foreground">
                      {section.total.prev}
                    </span>
                    <span className="text-center text-sm font-extrabold tabular-nums">
                      {section.total.cur}
                    </span>
                    <span
                      className={cn(
                        'text-center text-[10px] font-extrabold tabular-nums',
                        section.total.cur > section.total.prev
                          ? 'text-destructive'
                          : 'text-emerald-600',
                        section.total.cur === section.total.prev &&
                          'text-muted-foreground',
                      )}
                    >
                      {pctText(section.total.deltaPercent)}
                    </span>
                    {themeColumns.map((theme) => {
                      const cell = section.total.themes[theme.name]
                      const has = cell.prev || cell.cur
                      return (
                        <span
                          key={theme.name}
                          className="text-center text-[10px] leading-tight font-bold tabular-nums"
                          title={theme.title}
                        >
                          {has ? `${cell.prev}-${cell.cur}` : <span className="text-muted-foreground/40">-</span>}
                        </span>
                      )
                    })}
                  </div>
                  {section.rows.map((row) => (
                    <div
                      key={row.name}
                      className="grid items-center gap-1 px-1.5"
                      style={{ gridTemplateColumns: departmentGridTemplate }}
                    >
                      <span
                        className={cn(
                          'truncate text-[11px] font-semibold',
                          !row.prev && !row.cur && 'text-muted-foreground',
                        )}
                        title={row.name}
                      >
                        {row.name}
                      </span>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {row.prev}
                      </span>
                      <span className="text-center text-sm font-bold tabular-nums">
                        {row.cur}
                      </span>
                      <span
                        className={cn(
                          'text-center text-[10px] font-bold tabular-nums',
                          row.cur > row.prev ? 'text-destructive' : 'text-emerald-600',
                          row.cur === row.prev && 'text-muted-foreground',
                        )}
                      >
                        {pctText(row.deltaPercent)}
                      </span>
                      {themeColumns.map((theme) => {
                        const cell = row.themes[theme.name]
                        const has = cell.prev || cell.cur
                        return (
                          <span
                            key={theme.name}
                            className="text-center text-[10px] leading-tight tabular-nums"
                            title={theme.title}
                          >
                            {has ? `${cell.prev}-${cell.cur}` : <span className="text-muted-foreground/40">-</span>}
                          </span>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </Slide>
      </div>
    </div>
  )
}
