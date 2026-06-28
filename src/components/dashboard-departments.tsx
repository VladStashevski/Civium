import * as React from 'react'

import { DistributionRows } from '@/components/dashboard-breakdowns'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReferences } from '@/hooks/use-appeals'
import {
  buildDepartmentDashboardFromReferences,
  type DepartmentDashboard,
} from '@/lib/department-dashboard'
import type { AppealMode } from '@/lib/api'

export function DepartmentDistributionTabs({
  dashboard,
  subject,
}: {
  dashboard: DepartmentDashboard
  subject: string
}) {
  return (
    <Card>
      <Tabs defaultValue="departments" className="gap-0">
        <CardHeader>
          <CardTitle>Отделения</CardTitle>
          <CardDescription>
            Распределение {subject} по отделениям и профилям
          </CardDescription>
          <CardAction className="col-span-full col-start-1 row-start-3 justify-self-start sm:col-span-auto sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            <TabsList>
              <TabsTrigger value="departments">
                Отделения
                <Badge variant="secondary">{dashboard.departments.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="profiles">
                Профили
                <Badge variant="secondary">{dashboard.profiles.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TabsContent
            value="departments"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <DistributionRows
              rows={dashboard.departments}
              barClass="bg-positive"
              pctClass="text-positive"
              currentYear={dashboard.currentYear}
              previousYear={dashboard.previousYear}
            />
          </TabsContent>
          <TabsContent
            value="profiles"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <DistributionRows
              rows={dashboard.profiles}
              barClass="bg-primary"
              pctClass="text-primary"
              currentYear={dashboard.currentYear}
              previousYear={dashboard.previousYear}
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

export function DashboardDepartments({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useReferences(mode)
  const dashboard = React.useMemo(
    () => (data ? buildDepartmentDashboardFromReferences(data) : null),
    [data],
  )

  if (isPending || !dashboard) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton key={j} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <DepartmentDistributionTabs dashboard={dashboard} subject="обращений" />
    </div>
  )
}
