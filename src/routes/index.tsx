import { createFileRoute } from '@tanstack/react-router'
import { AppealsTrendChart } from '@/components/appeals-trend-chart'
import { DashboardBreakdowns } from '@/components/dashboard-breakdowns'
import { DashboardDepartments } from '@/components/dashboard-departments'
import { DepartmentProfileTrendChart } from '@/components/department-profile-trend-chart'
import { SectionCards } from '@/components/section-cards'
import { useAppeals } from '@/hooks/use-appeals'
import { parseAppealModeSearch } from '@/lib/appeal-mode'

export const Route = createFileRoute('/')({
  validateSearch: parseAppealModeSearch,
  component: DashboardPage,
})

function DashboardPage() {
  const { mode } = Route.useSearch()
  const { data, isPending } = useAppeals(mode)

  return (
    <>
      <SectionCards mode={mode} />
      <div className="px-4 lg:px-6">
        <AppealsTrendChart mode={mode} />
      </div>
      <div className="px-4 lg:px-6">
        <DepartmentProfileTrendChart
          records={data?.items ?? []}
          title="Динамика по профилям"
          description={mode === 'chiefDoctor' ? 'контур 07/19' : 'внешние контуры'}
          isPending={isPending}
        />
      </div>
      <DashboardBreakdowns mode={mode} />
      <DashboardDepartments mode={mode} />
    </>
  )
}
