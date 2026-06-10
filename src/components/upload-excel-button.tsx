import { useRef } from 'react'
import { UploadSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useUploadExcel } from '@/hooks/use-appeals'

export function UploadExcelButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutate, isPending } = useUploadExcel()

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const id = toast.loading('Загрузка Excel…')
          mutate(file, {
            onSuccess: (r) =>
              toast.success(
                `Импорт готов: +${r.addedCount} новых, ${r.updatedCount} обновлено, аннотаций сохранено ${r.manualFieldsPreserved}`,
                { id },
              ),
            onError: () =>
              toast.error('Не удалось загрузить файл', { id }),
          })
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
      >
        <UploadSimpleIcon />
        Загрузить Excel
      </Button>
    </>
  )
}
