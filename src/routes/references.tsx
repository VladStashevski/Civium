import { createFileRoute } from '@tanstack/react-router'
import { ReferencesView } from '@/components/references-view'

export const Route = createFileRoute('/references')({
  component: ReferencesPage,
})

function ReferencesPage() {
  return <ReferencesView />
}
