import { createFileRoute } from '@tanstack/react-router'
import { SlidesView } from '@/components/slides-view'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/slides')({
  validateSearch: parseAppealModeSearch,
  component: SlidesPage,
})

function SlidesPage() {
  const { mode } = Route.useSearch()
  return <SlidesView mode={mode} />
}
