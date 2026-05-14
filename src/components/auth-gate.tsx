import { useState, type FormEvent, type ReactNode } from 'react'
import { BarChart3, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AUTH_EMAIL, AUTH_PASSWORD, isSignedIn, signIn } from '@/lib/simple-auth'

export function AuthGate({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => isSignedIn())
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (email !== AUTH_EMAIL || password !== AUTH_PASSWORD) {
      setError('Неверная почта или пароль')
      return
    }

    signIn()
    setIsAuthenticated(true)
  }

  if (isAuthenticated) return children

  return (
    <main className='flex min-h-svh items-center justify-center bg-muted/30 p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <div className='mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground'>
            <BarChart3 className='size-5' />
          </div>
          <CardTitle>Civium</CardTitle>
          <CardDescription>Вход в дашборд обращений граждан</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='space-y-2'>
              <Label htmlFor='email'>Почта</Label>
              <Input
                id='email'
                name='email'
                type='email'
                autoComplete='email'
                defaultValue={AUTH_EMAIL}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Пароль</Label>
              <Input
                id='password'
                name='password'
                type='password'
                autoComplete='current-password'
                required
              />
            </div>
            {error && <p className='text-sm text-destructive'>{error}</p>}
            <Button type='submit' className='w-full'>
              <LogIn />
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
