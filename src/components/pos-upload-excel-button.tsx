import { useRef } from 'react'
import { UploadSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useUploadPosExcel } from '@/hooks/use-pos'

export function UploadPosExcelButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutate, isPending } = useUploadPosExcel()

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
          const id = toast.loading('Загрузка выгрузки ПОС…')
          mutate(file, {
            onSuccess: (r) =>
              toast.success(
                `Импорт готов: +${r.addedCount} новых, ${r.updatedCount} обновлено, ${r.removedCount} устаревших удалено, аннотаций сохранено ${r.manualFieldsPreserved}`,
                { id },
              ),
            onError: (error) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Не удалось загрузить файл',
                { id },
              ),
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
