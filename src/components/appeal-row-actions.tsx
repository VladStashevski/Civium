import * as React from 'react'
import { DotsThreeVerticalIcon } from '@phosphor-icons/react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePatchAppeal } from '@/hooks/use-appeals'
import type { Appeal } from '@/lib/api'
import { formatDateShort } from '@/lib/appeals-data'

function justifiedToValue(v: boolean | undefined): string {
  return v === true ? 'yes' : v === false ? 'no' : 'none'
}

export function AppealRowActions({ appeal }: { appeal: Appeal }) {
  const { mutate, isPending } = usePatchAppeal()
  const [open, setOpen] = React.useState(false)
  const [justified, setJustified] = React.useState('none')
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setJustified(justifiedToValue(appeal.manualFields?.isJustified))
      setNotes(appeal.manualFields?.notes ?? '')
    }
  }, [open, appeal])

  const hasAnnotation =
    appeal.manualFields?.isJustified !== undefined ||
    Boolean(appeal.manualFields?.notes)

  const save = () => {
    mutate({
      uid: appeal.uid,
      isJustified: justified === 'yes' ? true : justified === 'no' ? false : null,
      notes,
    })
    setOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
          >
            <DotsThreeVerticalIcon />
            <span className="sr-only">Действия</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            Редактировать…
          </DropdownMenuItem>
          {hasAnnotation && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() =>
                  mutate({ uid: appeal.uid, isJustified: null, notes: '' })
                }
              >
                Очистить аннотацию
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Аннотация обращения</DialogTitle>
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
                className="justify-start"
              >
                <ToggleGroupItem value="none" className="px-4">
                  Не задано
                </ToggleGroupItem>
                <ToggleGroupItem value="yes" className="px-4">
                  Обоснованно
                </ToggleGroupItem>
                <ToggleGroupItem value="no" className="px-4">
                  Не обоснованно
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

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
