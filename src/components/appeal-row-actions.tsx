import * as React from 'react'
import { CheckIcon, PencilSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePatchAppeal } from '@/hooks/use-appeals'
import type { Appeal } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'
import {
  DEPARTMENT_BY_NAME,
  DEPARTMENT_GROUPS,
  departmentShortLabel,
  resolveDepartmentName,
} from '@/lib/departments'
import { cn } from '@/lib/utils'

export function justifiedToValue(v: boolean | undefined): string {
  return v === true ? 'yes' : v === false ? 'no' : 'none'
}

// Проверка по обращению: проводилась ли ВНК (внутренний контроль качества) или
// служебная проверка. Взаимоисключающий выбор; по умолчанию — не проводилась
// (хранится как отсутствие поля, в форме — состояние 'none').
export function inspectionLabel(value: unknown): string {
  return value === 'vnk' ? 'ВНК' : value === 'service' ? 'Служебная' : ''
}

function formatAnnotationDate(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

// Смена цифры = направленный «прокат»: новое число въезжает снизу при росте и
// сверху при убыли (slide + лёгкий fade), пружинным таймингом. По-прежнему в
// кадре ОДНА цифра — никакого наложения/ghosting (он раньше давал «мигание»):
// предыдущая не держится, въезд новой и есть переход. Сам бейдж overflow-hidden,
// так что цифра выкатывается изнутри кружка. На первом появлении бейджа
// направления нет — цифра статична, за появление отвечает обёртка CountBadge.
function RollingDigits({ value }: { value: number }) {
  const [current, setCurrent] = React.useState(value)
  const [dir, setDir] = React.useState<'up' | 'down' | null>(null)
  if (current !== value) {
    setDir(value > current ? 'up' : 'down')
    setCurrent(value)
  }
  React.useEffect(() => {
    if (!dir) return
    const timer = window.setTimeout(() => setDir(null), 220)
    return () => window.clearTimeout(timer)
  }, [dir, current])

  return (
    <span
      key={current}
      className={cn(
        'inline-block tabular-nums [animation-timing-function:cubic-bezier(0.34,1.3,0.7,1)]',
        dir === 'up' && 'duration-200 animate-in fade-in-0 slide-in-from-bottom-1',
        dir === 'down' && 'duration-200 animate-in fade-in-0 slide-in-from-top-1',
      )}
    >
      {current}
    </span>
  )
}

function CountBadge({ count }: { count: number }) {
  const [prevCount, setPrevCount] = React.useState(count)
  // во время схлопывания держим последнее положительное число (не показываем 0)
  const [display, setDisplay] = React.useState(count)
  if (prevCount !== count) {
    setPrevCount(count)
    if (count > 0) setDisplay(count)
  }

  const visible = count > 0

  // Меряем фактическую ширину бейджа СИНХРОННО при смене числа (useLayoutEffect
  // в том же кадре) — без лага ResizeObserver, иначе ширина (и сдвиг лейбла)
  // доезжает на кадр позже цифры и в конце «доскакивает». tabular-nums держит
  // одинаковую ширину цифр, так что ширина меняется только при 1↔2 знаках.
  const badgeRef = React.useRef<HTMLSpanElement>(null)
  const [width, setWidth] = React.useState<number>()
  React.useLayoutEffect(() => {
    if (badgeRef.current) setWidth(badgeRef.current.offsetWidth)
  }, [display])

  return (
    <span
      aria-hidden={!visible}
      style={{ width: visible ? width : 0 }}
      className={cn(
        'inline-flex overflow-hidden transition-[width,margin-left,opacity] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
        visible ? 'ml-1 opacity-100' : 'ml-0 opacity-0',
      )}
    >
      <span
        ref={badgeRef}
        className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground tabular-nums"
      >
        <RollingDigits key={visible ? 'on' : 'off'} value={display} />
      </span>
    </span>
  )
}

function DepartmentChip({
  name,
  label,
  selected,
  onToggle,
}: {
  name: string
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      title={name}
      data-selected={selected}
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-[color,background-color,border-color,transform] duration-150 ease-out active:translate-y-px data-[selected=false]:bg-background data-[selected=false]:text-foreground/80 data-[selected=false]:hover:border-primary/40 data-[selected=false]:hover:bg-primary/5 data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      {selected && (
        <CheckIcon
          weight="bold"
          className="size-3 shrink-0 duration-150 animate-in zoom-in-50 fade-in-0"
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  )
}

// Плавно тянется под высоту контента. ResizeObserver ловит ЛЮБОЕ изменение
// (смена профиля, перетекание чипов, ресайз) — высота всегда равна натуральной,
// а переход к ней анимируется. overflow прячем ТОЛЬКО на время анимации: в покое
// он видим, поэтому тень/фокус и нажатие (active:translate-y) чипов на нижней
// строке не обрезаются. Модалка (height:auto) плавно следует за высотой.
function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const outerRef = React.useRef<HTMLDivElement>(null)
  const innerRef = React.useRef<HTMLDivElement>(null)
  const prevHeight = React.useRef<number | null>(null)

  React.useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    let timer: number | undefined

    const apply = () => {
      const next = inner.offsetHeight
      const first = prevHeight.current === null
      prevHeight.current = next
      // первый кадр / reduced-motion — ставим высоту мгновенно (без анимации)
      if (first || reduceMotion) {
        outer.style.transition = 'none'
        outer.style.height = `${next}px`
        return
      }
      // «Откуда» берём из ФАКТИЧЕСКОЙ текущей высоты (а не из прошлой цели): если
      // клик пришёл во время идущей анимации, стартуем от того места, где она
      // сейчас, а не снапаем на старую цель. Иначе виден скачок высоты, и за ним
      // дёргается весь центрированный диалог.
      const from = outer.getBoundingClientRect().height
      if (Math.abs(from - next) < 0.5) {
        outer.style.transition = 'none'
        outer.style.height = `${next}px`
        return
      }
      window.clearTimeout(timer)
      outer.style.overflow = 'hidden'
      outer.style.transition = 'none'
      outer.style.height = `${from}px`
      void outer.offsetHeight // фиксируем стартовую высоту до анимации
      outer.style.transition = 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)'
      outer.style.height = `${next}px`
      timer = window.setTimeout(() => {
        outer.style.overflow = ''
      }, 300)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(inner)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div ref={outerRef}>
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

// FLIP: при смене ширины чипа (появилась/ушла галочка) соседи и переносы строк
// двигаются не скачком, а плавно. Меряем позиции обёрток до/после рендера, гасим
// разницу обратным transform и анимируем его к нулю. transform живёт на обёртке —
// отдельной от кнопки, чтобы не конфликтовать с её active:translate-y.
function DepartmentChips({
  departments,
  selected,
  onToggle,
}: {
  departments: readonly { name: string; aliases: readonly string[] }[]
  selected: Set<string>
  onToggle: (name: string) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const prevRects = React.useRef(
    new Map<string, { left: number; top: number }>(),
  )

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Координаты чипов меряем ОТНОСИТЕЛЬНО контейнера, а не вьюпорта: пока едет
    // высота, центрированный диалог сам уезжает по вертикали — в абсолютных
    // координатах сместились бы СРАЗУ все чипы, и FLIP принял бы это за их
    // переезд и дёрнул бы их все одновременно. Относительные координаты
    // реагируют только на реальное перетекание чипов внутри контейнера.
    const base = container.getBoundingClientRect()

    for (const wrap of Array.from(container.children) as HTMLElement[]) {
      const name = wrap.dataset.name
      if (!name) continue
      const rect = wrap.getBoundingClientRect()
      const left = rect.left - base.left
      const top = rect.top - base.top
      const prev = prevRects.current.get(name)
      prevRects.current.set(name, { left, top })
      if (!prev) continue
      const dx = prev.left - left
      const dy = prev.top - top
      if (!dx && !dy) continue
      wrap.style.transition = 'none'
      wrap.style.transform = `translate(${dx}px, ${dy}px)`
      requestAnimationFrame(() => {
        wrap.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
        wrap.style.transform = ''
      })
    }
  })

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap gap-1.5 duration-200 ease-out animate-in fade-in-0"
    >
      {departments.map((department) => (
        <div key={department.name} data-name={department.name} className="inline-flex">
          <DepartmentChip
            name={department.name}
            label={departmentShortLabel(department)}
            selected={selected.has(department.name)}
            onToggle={() => onToggle(department.name)}
          />
        </div>
      ))}
    </div>
  )
}

export function DepartmentSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const canonicalValue = React.useMemo(
    () => [...new Set(value.map(resolveDepartmentName).filter(Boolean))],
    [value],
  )
  const selected = React.useMemo(() => new Set(canonicalValue), [canonicalValue])
  const [activeProfile, setActiveProfile] = React.useState<string>(
    DEPARTMENT_GROUPS[0].profile,
  )

  const toggle = (name: string) => {
    onChange(
      selected.has(name)
        ? canonicalValue.filter((item) => item !== name)
        : [...canonicalValue, name],
    )
  }

  const countByProfile = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const name of canonicalValue) {
      const option = DEPARTMENT_BY_NAME.get(name)
      if (option)
        counts.set(option.profile, (counts.get(option.profile) ?? 0) + 1)
    }
    return counts
  }, [canonicalValue])

  const activeGroup =
    DEPARTMENT_GROUPS.find((g) => g.profile === activeProfile) ??
    DEPARTMENT_GROUPS[0]

  return (
    <div className="flex min-w-0 flex-col">
      <Tabs value={activeProfile} onValueChange={setActiveProfile}>
        <TabsList className="h-8 w-full">
          {DEPARTMENT_GROUPS.map((group) => {
            const count = countByProfile.get(group.profile) ?? 0
            return (
              <TabsTrigger
                key={group.profile}
                value={group.profile}
                className="gap-0 px-1.5 text-xs"
              >
                {group.short}
                <CountBadge count={count} />
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      <AnimatedHeight>
        <div className="pt-2.5">
          <DepartmentChips
            key={activeProfile}
            departments={activeGroup.departments}
            selected={selected}
            onToggle={toggle}
          />
        </div>
      </AnimatedHeight>
    </div>
  )
}

export function NoteField({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full min-w-0 items-center rounded-lg border bg-background px-3 text-left text-sm transition-[color,background-color,border-color,box-shadow] duration-150 ease-out active:translate-y-px hover:border-primary/40 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/20"
        >
          <span
            className={cn(
              'line-clamp-1 w-full',
              value ? 'text-foreground' : 'text-muted-foreground/55',
            )}
          >
            {value || placeholder}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="gap-3 rounded-2xl px-4 py-4 sm:max-w-md sm:px-4"
      >
        <DialogTitle className="sr-only">{placeholder}</DialogTitle>
        <Textarea
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="max-h-[60vh] min-h-28 overflow-y-auto rounded-lg border-input bg-background text-sm transition-[height,border-color,box-shadow] duration-150 ease-out"
        />
        <DialogClose asChild>
          <Button className="justify-self-end">Сохранить</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

export function AppealRowActions({ appeal }: { appeal: Appeal }) {
  const { mutate, isPending } = usePatchAppeal()
  const [open, setOpen] = React.useState(false)
  const [justified, setJustified] = React.useState('none')
  const [inspection, setInspection] = React.useState('none')
  const [notes, setNotes] = React.useState('')
  const [issues, setIssues] = React.useState('')
  const [departments, setDepartments] = React.useState<string[]>([])

  const openEditor = () => {
    setJustified(justifiedToValue(appeal.manualFields?.isJustified))
    setInspection(appeal.manualFields?.inspection || 'none')
    setNotes(appeal.manualFields?.notes ?? '')
    setIssues(appeal.manualFields?.issues ?? '')
    setDepartments(appeal.manualFields?.departments ?? [])
    setOpen(true)
  }

  const hasAnnotation =
    appeal.manualFields?.isJustified !== undefined ||
    Boolean(appeal.manualFields?.inspection) ||
    Boolean(appeal.manualFields?.notes) ||
    Boolean(appeal.manualFields?.issues) ||
    Boolean(appeal.manualFields?.departments?.length)
  const annotationDate = formatAnnotationDate(
    appeal.manualFields?.annotationUpdatedAt,
  )

  const save = () => {
    mutate(
      {
        uid: appeal.uid,
        isJustified:
          justified === 'yes' ? true : justified === 'no' ? false : null,
        inspection: inspection === 'none' ? '' : inspection,
        notes,
        issues,
        departments,
      },
      {
        onSuccess: () => setOpen(false),
        onError: () => toast.error('Не удалось сохранить аннотацию'),
      },
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'size-8 text-foreground/75 transition-[background-color,color,box-shadow] duration-150 hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary',
          hasAnnotation && 'bg-primary/10 text-primary hover:bg-primary/15',
        )}
        onClick={openEditor}
        aria-label={`Редактировать обращение № ${appeal.id}`}
        title="Редактировать"
      >
        <PencilSimpleIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto rounded-3xl px-5 py-5 sm:max-w-[34rem] sm:px-6">
          <DialogHeader className="gap-1 pr-8">
            <DialogTitle className="text-base font-medium">
              № {appeal.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {appeal.correspondent} · {formatDateShort(appeal.dateIso)}
              {appeal.profile ? ` · ${appeal.profile}` : ''}
              {annotationDate ? ` · изм. ${annotationDate}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-4">
            <p className="min-w-0 border-l-2 border-border pl-3 text-sm text-muted-foreground">
              {appeal.content}
            </p>

            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={justified}
              onValueChange={(v) => v && setJustified(v)}
              className="w-full"
            >
              <ToggleGroupItem
                value="none"
                className="h-9 flex-1 text-sm data-[state=on]:bg-muted data-[state=on]:text-foreground"
              >
                Не задано
              </ToggleGroupItem>
              <ToggleGroupItem
                value="yes"
                className="h-9 flex-1 text-sm hover:bg-destructive/10 hover:text-destructive data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
              >
                Обоснованно
              </ToggleGroupItem>
              <ToggleGroupItem
                value="no"
                className="h-9 flex-1 text-sm hover:bg-positive/10 hover:text-positive data-[state=on]:border-positive/40 data-[state=on]:bg-positive/10 data-[state=on]:text-positive dark:hover:bg-positive/15 dark:data-[state=on]:bg-positive/15"
              >
                Не обоснованно
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Проверка
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={inspection}
                onValueChange={(v) => v && setInspection(v)}
                className="w-full"
              >
                <ToggleGroupItem
                  value="none"
                  className="h-9 flex-1 text-sm data-[state=on]:bg-muted data-[state=on]:text-foreground"
                >
                  Не проводилась
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="vnk"
                  className="h-9 flex-1 text-sm hover:bg-inspection-vnk/10 hover:text-inspection-vnk data-[state=on]:border-inspection-vnk/40 data-[state=on]:bg-inspection-vnk/10 data-[state=on]:text-inspection-vnk"
                >
                  ВНК
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="service"
                  className="h-9 flex-1 text-sm hover:bg-inspection-service/15 hover:text-inspection-service data-[state=on]:border-inspection-service/40 data-[state=on]:bg-inspection-service/15 data-[state=on]:text-inspection-service"
                >
                  Служебная
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <DepartmentSelect value={departments} onChange={setDepartments} />

            <div className="grid min-w-0 gap-2 md:grid-cols-2">
              <NoteField
                value={issues}
                placeholder="Выявлено и решено…"
                onChange={setIssues}
              />
              <NoteField
                value={notes}
                placeholder="Комментарий…"
                onChange={setNotes}
              />
            </div>
          </div>

          <DialogFooter>
            {hasAnnotation && (
              <Button
                variant="ghost"
                className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isPending}
                onClick={() =>
                  mutate(
                    {
                      uid: appeal.uid,
                      isJustified: null,
                      inspection: '',
                      notes: '',
                      issues: '',
                      departments: [],
                    },
                    {
                      onSuccess: () => setOpen(false),
                      onError: () =>
                        toast.error('Не удалось очистить аннотацию'),
                    },
                  )
                }
              >
                Очистить
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="ghost">Отмена</Button>
            </DialogClose>
            <Button onClick={save} disabled={isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
