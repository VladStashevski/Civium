import type { AppealsDashboard } from '@/lib/appeals-data'

export type Appeal = {
  uid: string
  id: string
  appealKey: string
  dateIso: string
  content: string
  correspondent: string
  location: string
  profile: string
  rubricTheme?: string
  source: string
  documentTopic: string
  officialCategory: string
  status: string
  isChiefDoctor: boolean
  isRedirected: boolean
  departments: string[]
  manualFields?: {
    isJustified?: boolean
    notes?: string
    departments?: string[]
    [key: string]: unknown
  }
}

export type AppealsResponse = {
  items: Appeal[]
  total: number
  updatedAt: string
}

export type AppealPatch = {
  uid: string
  isJustified?: boolean | null
  notes?: string
  departments?: string[]
}

export type ImportResult = {
  importId: string
  rowsCount: number
  addedCount: number
  updatedCount: number
  manualFieldsPreserved: number
  existingRecordsKept: number
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Запрос не удался: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export async function fetchAppeals(): Promise<AppealsResponse> {
  return asJson(await fetch('/api/appeals?limit=100000'))
}

export async function fetchDashboard(): Promise<AppealsDashboard> {
  return asJson(await fetch('/api/dashboard'))
}

export async function patchAppeal(body: AppealPatch): Promise<{ item: Appeal }> {
  return asJson(
    await fetch('/api/appeals', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function uploadExcel(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  return asJson(await fetch('/api/imports/excel', { method: 'POST', body: form }))
}

export type RefItem = { id: string; name: string; count: number }
export type Rubric = RefItem & { code?: string; theme?: string }
export type Theme = RefItem & { description?: string }
export type Source = RefItem & { status?: string }

export type References = {
  generatedAt: string
  classifierVersion: string
  rubrics: Rubric[]
  themes: Theme[]
  sources: Source[]
  departments: RefItem[]
}

export async function fetchReferences(): Promise<References> {
  return asJson(await fetch('/api/references'))
}

export type Session = { authenticated: boolean; email?: string }

export async function fetchSession(): Promise<Session> {
  const res = await fetch('/api/auth/session', { credentials: 'same-origin' })
  if (res.status === 401) return { authenticated: false }
  return asJson(res)
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Неверная почта или пароль')
  return asJson(res)
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
}
