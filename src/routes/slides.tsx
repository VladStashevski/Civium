import { createFileRoute } from '@tanstack/react-router'
import { SlidesView } from '@/components/slides-view'

export const Route = createFileRoute('/slides')({
  component: SlidesPage,
})

function SlidesPage() {
  return <SlidesView />
}
