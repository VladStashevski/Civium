import * as React from 'react'
import {
  CaretDownIcon,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePatchAppeal } from '@/hooks/use-appeals'
import type { Appeal } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'
import { DEPARTMENT_GROUPS, DEPARTMENT_OPTIONS } from '@/lib/departments'
import { cn } from '@/lib/utils'

function justifiedToValue(v: boolean | undefined): string {
  return v === true ? 'yes' : v === false ? 'no' : 'none'
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim()
}

function DepartmentSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const selected = React.useMemo(() => new Set(value), [value])
  const search = normalizeSearch(query)

  const visibleGroups = React.useMemo(
    () =>
      DEPARTMENT_GROUPS.map((group) => ({
        ...group,
        departments: DEPARTMENT_OPTIONS.filter(
          (option) =>
            option.profile === group.profile &&
            (!search ||
              normalizeSearch(
                `${option.value} ${option.name} ${option.profile} ${option.aliases.join(' ')}`,
              ).includes(search)),
        ),
      })).filter((group) => group.departments.length > 0),
    [search],
  )

  const toggle = (department: string) => {
    onChange(
      selected.has(department)
        ? value.filter((item) => item !== department)
        : [...value, department],
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>Отделения</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 w-full justify-between whitespace-normal px-3 py-2 text-left"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {value.length ? `Выбрано: ${value.length}` : 'Выберите отделения'}
            </span>
            <CaretDownIcon
              className={cn(
                'size-4 shrink-0 opacity-60 transition-transform',
                open && 'rotate-180',
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions={false}
          className="w-[min(32rem,calc(100vw-2rem))] gap-3 rounded-xl p-3"
          onWheelCapture={(event) => event.stopPropagation()}
          onTouchMoveCapture={(event) => event.stopPropagation()}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по отделениям…"
            className="h-9"
          />
          <div
            className="max-h-[min(18rem,calc(100svh-12rem))] overflow-y-auto overscroll-contain scroll-smooth pr-1"
            onWheelCapture={(event) => event.stopPropagation()}
            onTouchMoveCapture={(event) => event.stopPropagation()}
          >
            {visibleGroups.length ? (
              visibleGroups.map((group) => (
                <div key={group.profile} className="py-1.5 first:pt-0">
                  <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                    {group.profile}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.departments.map((option) => {
                      const checked = selected.has(option.value)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                            checked && 'bg-muted',
                          )}
                          onClick={() => toggle(option.value)}
                        >
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded border',
                              checked
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input',
                            )}
                          >
                            {checked && <CheckIcon className="size-3" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {option.value}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((department) => (
            <Badge
              key={department}
              variant="secondary"
              className="h-auto max-w-full gap-1 rounded-md py-1 pr-1"
            >
              <span className="truncate">{department}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() =>
                  onChange(value.filter((item) => item !== department))
                }
                aria-label={`Убрать ${department}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
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
  const [departments, setDepartments] = React.useState<string[]>([])

  const openEditor = () => {
    setJustified(justifiedToValue(appeal.manualFields?.isJustified))
    setNotes(appeal.manualFields?.notes ?? '')
    setDepartments(appeal.manualFields?.departments ?? [])
    setOpen(true)
  }

  const hasAnnotation =
    appeal.manualFields?.isJustified !== undefined ||
    Boolean(appeal.manualFields?.notes) ||
    Boolean(appeal.manualFields?.departments?.length)

  const save = () => {
    mutate(
      {
        uid: appeal.uid,
        isJustified: justified === 'yes' ? true : justified === 'no' ? false : null,
        notes,
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
        className="size-8 text-muted-foreground"
        onClick={openEditor}
        aria-label={`Редактировать обращение № ${appeal.id}`}
        title="Редактировать"
      >
        <PencilSimpleIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование обращения</DialogTitle>
            <DialogDescription className="truncate">
              № {appeal.id} · {appeal.correspondent}
            </DialogDescription>
            <p className="text-xs text-muted-foreground">
              Дата обращения: {formatDateShort(appeal.dateIso)}
              {appeal.profile ? ` · ${appeal.profile}` : ''}
            </p>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-5">
            <div className="max-h-40 min-w-0 overflow-auto rounded-md border bg-muted/40 p-3">
              <p className="text-sm break-words whitespace-pre-wrap">
                {appeal.content}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Обоснованность</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={justified}
                onValueChange={(v) => v && setJustified(v)}
                className="flex-wrap justify-start"
              >
                <ToggleGroupItem value="none" className="px-4">
                  Не задано
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="yes"
                  className="px-4 data-[state=on]:border-emerald-500/40 data-[state=on]:bg-emerald-500/10 data-[state=on]:text-emerald-700 dark:data-[state=on]:text-emerald-400"
                >
                  Обоснованно
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="no"
                  className="px-4 data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
                >
                  Не обоснованно
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <DepartmentSelect
              value={departments}
              onChange={setDepartments}
            />

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="appeal-notes">Комментарий</Label>
              <Textarea
                id="appeal-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Комментарий к обращению…"
                className="min-h-28 w-full min-w-0 resize-none break-words"
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
                    { uid: appeal.uid, isJustified: null, notes: '', departments: [] },
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
