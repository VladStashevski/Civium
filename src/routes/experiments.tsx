import { createFileRoute } from '@tanstack/react-router'
import { ExperimentsView } from '@/components/experiments-view'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/experiments')({
  validateSearch: parseAppealModeSearch,
  component: ExperimentsPage,
})

function ExperimentsPage() {
  const { mode } = Route.useSearch()
  return <ExperimentsView mode={mode} />
}
