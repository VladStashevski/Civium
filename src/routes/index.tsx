import { createFileRoute } from '@tanstack/react-router'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DashboardBreakdowns } from '@/components/dashboard-breakdowns'
import { SectionCards } from '@/components/section-cards'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <>
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DashboardBreakdowns />
    </>
  )
}
