import type { CSSProperties } from 'react'
import * as React from 'react'
import {
  Outlet,
  createRootRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useSession } from '@/hooks/use-appeals'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!isPending && !data?.authenticated) navigate({ to: '/login' })
  }, [isPending, data, navigate])

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Загрузка…
      </div>
    )
  }
  if (!data?.authenticated) return null
  return <>{children}</>
}

function Shell() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function RootLayout() {
  const { pathname } = useLocation()
  const isLogin = pathname === '/login'

  return (
    <TooltipProvider>
      {isLogin ? (
        <Outlet />
      ) : (
        <AuthGate>
          <Shell />
        </AuthGate>
      )}
      <Toaster />
      <TanStackRouterDevtools position="bottom-right" />
    </TooltipProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
