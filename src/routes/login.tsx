import { createFileRoute } from '@tanstack/react-router'
import { ChartBarIcon } from '@phosphor-icons/react'
import { LoginForm } from '@/components/login-form'
import { LoginArt } from '@/components/login-art'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center gap-2 font-semibold">
          <ChartBarIcon className="size-5 text-primary" weight="duotone" />
          Civium
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
