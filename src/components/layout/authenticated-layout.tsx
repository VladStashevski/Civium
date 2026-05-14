import { Outlet } from '@tanstack/react-router'
import { AuthGate } from '@/components/auth-gate'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <AuthGate>
      <div className='min-h-svh bg-background @container/content'>
        {children ?? <Outlet />}
      </div>
    </AuthGate>
  )
}
