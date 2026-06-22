import { createFileRoute } from '@tanstack/react-router'
import { PosTable } from '@/components/pos-table'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/pos-table')({
  validateSearch: parseAppealModeSearch,
  component: PosTable,
})
