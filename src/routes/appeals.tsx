import { createFileRoute } from '@tanstack/react-router'
import { AppealsTable } from '@/components/appeals-table'

export const Route = createFileRoute('/appeals')({
  component: AppealsPage,
})

function AppealsPage() {
  return <AppealsTable />
}
