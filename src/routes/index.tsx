import { createFileRoute } from '@tanstack/react-router'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DashboardBreakdowns } from '@/components/dashboard-breakdowns'
import { SectionCards } from '@/components/section-cards'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/')({
  validateSearch: parseAppealModeSearch,
  component: DashboardPage,
})

function DashboardPage() {
  const { mode } = Route.useSearch()

  return (
    <>
      <SectionCards mode={mode} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive mode={mode} />
      </div>
      <DashboardBreakdowns mode={mode} />
    </>
  )
}
