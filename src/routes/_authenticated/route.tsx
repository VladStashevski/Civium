import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (location.pathname !== '/') {
      throw redirect({ to: '/' })
    }
  },
  component: AuthenticatedLayout,
})
