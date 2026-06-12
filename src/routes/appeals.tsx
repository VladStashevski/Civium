import { createFileRoute } from '@tanstack/react-router'
import { AppealsTable } from '@/components/appeals-table'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/appeals')({
  validateSearch: parseAppealModeSearch,
  component: AppealsPage,
})

function AppealsPage() {
  const { mode } = Route.useSearch()
  return <AppealsTable mode={mode} />
}
