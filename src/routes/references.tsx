import { createFileRoute } from '@tanstack/react-router'
import { ReferencesView } from '@/components/references-view'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/references')({
  validateSearch: parseAppealModeSearch,
  component: ReferencesPage,
})

function ReferencesPage() {
  const { mode } = Route.useSearch()
  return <ReferencesView mode={mode} />
}
