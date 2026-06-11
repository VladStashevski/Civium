import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/hooks/use-appeals'

export function LoginForm() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const navigate = useNavigate()
  const loginMutation = useLogin()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    loginMutation.mutate(
      { email: email.trim(), password },
      { onSuccess: () => navigate({ to: '/' }) },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold">Вход в Civium</h1>
        <p className="text-sm text-muted-foreground">
          Авторизуйтесь для доступа к базе обращений
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Почта</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="admin@civium.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {loginMutation.isError && (
          <p className="text-sm text-destructive">Неверная почта или пароль</p>
        )}

        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Вход…' : 'Войти'}
        </Button>
      </div>
    </form>
  )
}
