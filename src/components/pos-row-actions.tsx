import * as React from 'react'
import { PencilSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

import {
  DepartmentSelect,
  NoteField,
  justifiedToValue,
} from '@/components/appeal-row-actions'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePatchPos } from '@/hooks/use-pos'
import type { PosMessage } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'
import { cn } from '@/lib/utils'

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

export function PosRowActions({ message }: { message: PosMessage }) {
  const { mutate, isPending } = usePatchPos()
  const [open, setOpen] = React.useState(false)
  const [justified, setJustified] = React.useState('none')
  const [notes, setNotes] = React.useState('')
  const [issues, setIssues] = React.useState('')
  const [departments, setDepartments] = React.useState<string[]>([])

  const openEditor = () => {
    setJustified(justifiedToValue(message.manualFields?.isJustified))
    setNotes(message.manualFields?.notes ?? '')
    setIssues(message.manualFields?.issues ?? '')
    setDepartments(message.manualFields?.departments ?? [])
    setOpen(true)
  }

  const hasAnnotation =
    message.manualFields?.isJustified !== undefined ||
    Boolean(message.manualFields?.notes) ||
    Boolean(message.manualFields?.issues) ||
    Boolean(message.manualFields?.departments?.length)
  const annotationDate = formatAnnotationDate(
    message.manualFields?.annotationUpdatedAt,
  )

  const save = () => {
    mutate(
      {
        uid: message.uid,
        isJustified:
          justified === 'yes' ? true : justified === 'no' ? false : null,
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
        aria-label={`Редактировать сообщение № ${message.number}`}
        title="Редактировать"
      >
        <PencilSimpleIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto rounded-3xl px-5 py-5 sm:max-w-[34rem] sm:px-6">
          <DialogHeader className="gap-1 pr-8">
            <DialogTitle className="text-base font-medium">
              № {message.number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {message.source} · {formatDateShort(message.dateIso)}
              {message.category ? ` · ${message.category}` : ''}
              {annotationDate ? ` · изм. ${annotationDate}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-4">
            <p className="min-w-0 border-l-2 border-border pl-3 text-sm text-muted-foreground">
              {message.subcategory}
              {message.fact && message.fact !== message.subcategory
                ? ` — ${message.fact}`
                : ''}
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
                      uid: message.uid,
                      isJustified: null,
                      notes: '',
                      issues: '',
                      departments: [],
                    },
                    {
                      onSuccess: () => setOpen(false),
                      onError: () => toast.error('Не удалось очистить аннотацию'),
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
