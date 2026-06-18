import * as React from 'react'
import {
  CheckIcon,
  PencilSimpleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePatchAppeal } from '@/hooks/use-appeals'
import type { Appeal } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'
import { DEPARTMENT_OPTIONS, type DepartmentOption } from '@/lib/departments'
import { cn } from '@/lib/utils'

function justifiedToValue(v: boolean | undefined): string {
  return v === true ? 'yes' : v === false ? 'no' : 'none'
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim()
}

const compactTextareaClass =
  'h-20 min-h-0 w-full min-w-0 resize-none overflow-auto rounded-2xl px-3 py-2.5 text-sm break-words [field-sizing:fixed]'

function formatAnnotationDate(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function DepartmentSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [query, setQuery] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const selected = React.useMemo(() => new Set(value), [value])
  const search = normalizeSearch(query)

  const visibleOptions = React.useMemo(() => {
    const matched = DEPARTMENT_OPTIONS.filter((option) => {
      if (selected.has(option.value)) return false
      if (!search) return false
      return normalizeSearch(
        `${option.value} ${option.name} ${option.profile} ${option.aliases.join(' ')}`,
      ).includes(search)
    })
    return matched.slice(0, 6)
  }, [search, selected])

  const toggle = (department: string) => {
    onChange(
      selected.has(department)
        ? value.filter((item) => item !== department)
        : [...value, department],
    )
  }

  const add = (option: DepartmentOption) => {
    if (!selected.has(option.value)) onChange([...value, option.value])
    setQuery('')
  }

  const showSuggestions = Boolean(search)

  return (
    <div className="relative flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Отделения</Label>
        {value.length > 0 && (
          <span className="text-xs font-medium text-foreground/60">
            {value.length}
          </span>
        )}
      </div>
      <div
        className={cn(
          'rounded-2xl border bg-input/45 px-2.5 py-2 transition-[border-color,box-shadow,background-color] duration-150',
          focused && 'border-ring bg-background ring-3 ring-ring/20',
        )}
      >
        <div className="flex max-h-20 min-w-0 flex-wrap items-center gap-1.5 overflow-y-auto">
          {value.map((department) => (
            <Badge
              key={department}
              variant="secondary"
              className="h-7 max-w-full gap-1 rounded-full px-2"
            >
              <span className="max-w-56 truncate">{department}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-foreground/65 transition-colors hover:bg-background hover:text-foreground"
                onClick={() => toggle(department)}
                aria-label={`Убрать ${department}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && visibleOptions[0]) {
                event.preventDefault()
                add(visibleOptions[0])
              }
            }}
            placeholder={value.length ? 'Добавить отделение…' : 'Найти отделение…'}
            className="h-7 min-w-36 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-foreground/45"
          />
        </div>
      </div>

      {showSuggestions && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-52 overflow-y-auto rounded-2xl bg-popover p-1.5 text-sm shadow-lg ring-1 ring-foreground/10">
          {visibleOptions.length ? (
            <div className="grid gap-1">
              {visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(option)}
                  className="group flex min-h-8 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-primary/10"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input text-primary group-hover:border-primary/40">
                    <CheckIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.value}</span>
                  <span className="shrink-0 text-xs text-foreground/55">
                    {option.profile.replace(' профиль', '')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2 py-3 text-center text-sm text-foreground/60">
              Ничего не найдено
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AppealRowActions({ appeal }: { appeal: Appeal }) {
  const { mutate, isPending } = usePatchAppeal()
  const [open, setOpen] = React.useState(false)
  const [justified, setJustified] = React.useState('none')
  const [notes, setNotes] = React.useState('')
  const [issues, setIssues] = React.useState('')
  const [departments, setDepartments] = React.useState<string[]>([])

  const openEditor = () => {
    setJustified(justifiedToValue(appeal.manualFields?.isJustified))
    setNotes(appeal.manualFields?.notes ?? '')
    setIssues(appeal.manualFields?.issues ?? '')
    setDepartments(appeal.manualFields?.departments ?? [])
    setOpen(true)
  }

  const hasAnnotation =
    appeal.manualFields?.isJustified !== undefined ||
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
        isJustified: justified === 'yes' ? true : justified === 'no' ? false : null,
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
          hasAnnotation &&
            'bg-primary/10 text-primary hover:bg-primary/15',
        )}
        onClick={openEditor}
        aria-label={`Редактировать обращение № ${appeal.id}`}
        title="Редактировать"
      >
        <PencilSimpleIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] gap-3.5 overflow-visible rounded-3xl px-5 py-5 sm:max-w-[34rem] sm:px-6">
          <DialogHeader className="gap-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>Аннотация обращения</DialogTitle>
                <DialogDescription className="truncate">
                  № {appeal.id} · {appeal.correspondent}
                </DialogDescription>
              </div>
              {annotationDate && (
                <div className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium whitespace-nowrap">
                  Изменено {annotationDate}
                </div>
              )}
            </div>
            <p className="text-xs text-foreground/70">
              {formatDateShort(appeal.dateIso)}
              {appeal.profile ? ` · ${appeal.profile}` : ''}
            </p>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-3">
            <div
              className="min-w-0 rounded-2xl border bg-muted/45 px-3 py-2 text-sm"
              title={appeal.content}
            >
              <p className="truncate">
                {appeal.content}
              </p>
            </div>

            <div className="grid items-center gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              <Label className="text-sm">Обоснованность</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={justified}
                onValueChange={(v) => v && setJustified(v)}
                className="flex-wrap justify-start gap-1.5"
              >
                <ToggleGroupItem value="none" className="h-8 px-3">
                  Не задано
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="yes"
                  className="h-8 px-3 data-[state=on]:border-emerald-500/40 data-[state=on]:bg-emerald-500/10 data-[state=on]:text-emerald-700 dark:data-[state=on]:text-emerald-400"
                >
                  Обоснованно
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="no"
                  className="h-8 px-3 data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
                >
                  Не обоснованно
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <DepartmentSelect
              value={departments}
              onChange={setDepartments}
            />

            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="appeal-issues">Выявлено и решено</Label>
                <Textarea
                  id="appeal-issues"
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  placeholder="Проблемы и решение…"
                  className={compactTextareaClass}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="appeal-notes">Комментарий</Label>
                <Textarea
                  id="appeal-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Комментарий…"
                  className={compactTextareaClass}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-1">
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
