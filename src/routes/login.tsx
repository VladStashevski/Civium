import { createFileRoute } from '@tanstack/react-router'
import { CiviumLogo } from '@/components/civium-logo'
import { LoginForm } from '@/components/login-form'
import { LoginArt } from '@/components/login-art'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="grid min-h-svh duration-300 animate-in fade-in-0 lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center">
          <CiviumLogo className="size-9 text-primary" />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>
      <LoginArt />
    </div>
  )
}
