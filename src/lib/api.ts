import {
  normalizeDashboard,
  type AppealsDashboard,
} from '@/lib/appeals-data'

export type AppealMode = 'chiefDoctor' | 'external'

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
  sourceOrganization: string
  sourceOrganizationDetail: string
  sourceChannel: string
  appealMode: AppealMode
  registrationRoute: string
  documentTopic: string
  officialCategory: string
  isChiefDoctor: boolean
  isRedirected: boolean
  departments: string[]
  deadlineStatus?: string
  manualFields?: {
    isJustified?: boolean
    inspection?: string
    notes?: string
    issues?: string
    departments?: string[]
    annotationCreatedAt?: string
    annotationUpdatedAt?: string
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
  inspection?: string
  notes?: string
  issues?: string
  departments?: string[]
}

export type ImportResult = {
  importId: string
  rowsCount: number
  addedCount: number
  updatedCount: number
  removedCount: number
  manualFieldsPreserved: number
  existingRecordsKept: number
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Запрос не удался: ${res.status} ${res.statusText}`
    try {
      const body = objectValue(await res.json())
      const error = stringValue(body.error)
      if (error) message = error
    } catch {
      // Some infrastructure errors return HTML or an empty body.
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function normalizeAppeal(value: unknown): Appeal {
  const item = objectValue(value)
  const manualFields = objectValue(item.manualFields)
  const id = stringValue(item.id)
  const appealMode: AppealMode =
    item.appealMode === 'external' ||
    (!String(id).includes('07/19') && item.isChiefDoctor !== true)
      ? 'external'
      : 'chiefDoctor'

  return {
    ...(item as Partial<Appeal>),
    uid: stringValue(item.uid) || id,
    id,
    appealKey: stringValue(item.appealKey) || id,
    dateIso: stringValue(item.dateIso),
    content: stringValue(item.content),
    correspondent: stringValue(item.correspondent),
    location: stringValue(item.location),
    profile: stringValue(item.profile),
    rubricTheme: stringValue(item.rubricTheme) || undefined,
    source: stringValue(item.source),
    sourceOrganization:
      stringValue(item.sourceOrganization) || stringValue(item.source),
    sourceOrganizationDetail:
      stringValue(item.sourceOrganizationDetail) ||
      stringValue(item.sourceOrganization) ||
      stringValue(item.source),
    sourceChannel:
      stringValue(item.sourceChannel) || stringValue(item.delivery),
    appealMode,
    registrationRoute: stringValue(item.registrationRoute),
    documentTopic: stringValue(item.documentTopic),
    officialCategory: stringValue(item.officialCategory),
    isChiefDoctor: appealMode === 'chiefDoctor',
    isRedirected: appealMode === 'external',
    departments: stringArray(item.departments),
    deadlineStatus: stringValue(item.deadlineStatus) || undefined,
    manualFields: {
      ...manualFields,
      departments: stringArray(manualFields.departments),
    },
  }
}

export async function fetchAppeals(mode: AppealMode): Promise<AppealsResponse> {
  const raw = objectValue(
    await asJson<unknown>(
      await fetch(`/api/appeals?limit=100000&mode=${mode}`),
    ),
  )
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map(normalizeAppeal)
    .filter((item) => item.appealMode === mode)

  return {
    items,
    total: items.length,
    updatedAt: stringValue(raw.updatedAt),
  }
}

export async function fetchDashboard(mode: AppealMode): Promise<AppealsDashboard> {
  return normalizeDashboard(
    await asJson<unknown>(await fetch(`/api/dashboard?mode=${mode}`)),
  )
}

export async function patchAppeal(body: AppealPatch): Promise<{ item: Appeal }> {
  const raw = objectValue(
    await asJson<unknown>(
      await fetch('/api/appeals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ),
  )
  return { item: normalizeAppeal(raw.item) }
}

export async function uploadExcel(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  return asJson(await fetch('/api/imports/excel', { method: 'POST', body: form }))
}

// --- ПОС (Платформа обратной связи «Госуслуги. Решаем вместе») ---
// Отдельный датасет со своим стором/таблицей. Аннотации: «отработано» + комментарий.

export type PosMessage = {
  uid: string
  number: string
  epguNumber: string
  source: string
  region: string
  category: string
  subcategory: string
  fact: string
  orgReceived: string
  orgCurrent: string
  dateIso: string
  plannedIso: string
  completedIso: string
  stage: string
  status: string
  overdue: string
  fastTrack: string
  fz: string
  chose59fz: string
  resolutionType: string
  sentByEmail: string
  rating: number | null
  repeated: string
  coordinator: string
  executor: string
  manager: string
  year: number
  month: number
  manualFields?: {
    isJustified?: boolean
    notes?: string
    issues?: string
    departments?: string[]
    annotationCreatedAt?: string
    annotationUpdatedAt?: string
    [key: string]: unknown
  }
}

export type PosResponse = {
  items: PosMessage[]
  total: number
  updatedAt: string
}

export type PosPatch = {
  uid: string
  isJustified?: boolean | null
  notes?: string
  issues?: string
  departments?: string[]
}

function normalizePosMessage(value: unknown): PosMessage {
  const item = objectValue(value)
  const manualFields = objectValue(item.manualFields)
  const uid = stringValue(item.uid) || stringValue(item.number)
  return {
    ...(item as Partial<PosMessage>),
    uid,
    number: stringValue(item.number) || uid,
    epguNumber: stringValue(item.epguNumber),
    source: stringValue(item.source),
    region: stringValue(item.region),
    category: stringValue(item.category),
    subcategory: stringValue(item.subcategory),
    fact: stringValue(item.fact),
    orgReceived: stringValue(item.orgReceived),
    orgCurrent: stringValue(item.orgCurrent),
    dateIso: stringValue(item.dateIso),
    plannedIso: stringValue(item.plannedIso),
    completedIso: stringValue(item.completedIso),
    stage: stringValue(item.stage),
    status: stringValue(item.status),
    overdue: stringValue(item.overdue),
    fastTrack: stringValue(item.fastTrack),
    fz: stringValue(item.fz),
    chose59fz: stringValue(item.chose59fz),
    resolutionType: stringValue(item.resolutionType),
    sentByEmail: stringValue(item.sentByEmail),
    rating: typeof item.rating === 'number' ? item.rating : null,
    repeated: stringValue(item.repeated),
    coordinator: stringValue(item.coordinator),
    executor: stringValue(item.executor),
    manager: stringValue(item.manager),
    year: numberValue(item.year),
    month: numberValue(item.month),
    manualFields: {
      ...manualFields,
      isJustified:
        typeof manualFields.isJustified === 'boolean'
          ? manualFields.isJustified
          : undefined,
      notes: stringValue(manualFields.notes) || undefined,
      issues: stringValue(manualFields.issues) || undefined,
      departments: stringArray(manualFields.departments),
    },
  }
}

export async function fetchPos(): Promise<PosResponse> {
  const raw = objectValue(await asJson<unknown>(await fetch('/api/pos')))
  const items = (Array.isArray(raw.items) ? raw.items : []).map(
    normalizePosMessage,
  )
  return { items, total: items.length, updatedAt: stringValue(raw.updatedAt) }
}

export async function patchPos(body: PosPatch): Promise<{ item: PosMessage }> {
  const raw = objectValue(
    await asJson<unknown>(
      await fetch('/api/pos', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ),
  )
  return { item: normalizePosMessage(raw.item) }
}

export async function uploadPosExcel(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  return asJson(
    await fetch('/api/imports/pos-excel', { method: 'POST', body: form }),
  )
}

export type RefItem = {
  id: string
  name: string
  count: number
  years?: Record<string, number>
  months?: Record<string, Record<string, number>>
}
export type Rubric = RefItem & { code?: string; theme?: string; description?: string }
export type Theme = RefItem & { code?: string; description?: string }
export type Source = RefItem & { status?: string }
export type DepartmentProfile = RefItem & { short?: string }
export type DepartmentRef = RefItem & { profile?: string }

export type References = {
  generatedAt: string
  classifierVersion: string
  rubrics: Rubric[]
  themes: Theme[]
  sources: Source[]
  profiles: DepartmentProfile[]
  departments: DepartmentRef[]
  comparison: {
    currentYear: number
    previousYear: number
    cutoffMonthDay: string
  }
}

function normalizeRefItems<T extends RefItem>(
  value: unknown,
): T[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const item = objectValue(entry)
    return {
      ...item,
      id: stringValue(item.id) || stringValue(item.name),
      name: stringValue(item.name) || 'Не указано',
      count: numberValue(item.count),
      years: objectValue(item.years) as Record<string, number>,
      months: objectValue(item.months) as Record<string, Record<string, number>>,
    } as T
  })
}

export async function fetchReferences(mode: AppealMode): Promise<References> {
  const raw = objectValue(
    await asJson<unknown>(await fetch(`/api/references?mode=${mode}`)),
  )
  return {
    generatedAt: stringValue(raw.generatedAt),
    classifierVersion: stringValue(raw.classifierVersion),
    rubrics: normalizeRefItems<Rubric>(raw.rubrics),
    themes: normalizeRefItems<Theme>(raw.themes),
    sources: normalizeRefItems<Source>(raw.sources),
    profiles: normalizeRefItems<DepartmentProfile>(raw.profiles),
    departments: normalizeRefItems<DepartmentRef>(raw.departments),
    comparison: {
      currentYear: numberValue(objectValue(raw.comparison).currentYear),
      previousYear: numberValue(objectValue(raw.comparison).previousYear),
      cutoffMonthDay: stringValue(objectValue(raw.comparison).cutoffMonthDay),
    },
  }
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
  if (!res.ok) {
    let serverMessage = ''
    try {
      const body = objectValue(await res.json())
      serverMessage = stringValue(body.error)
    } catch {
      // Infrastructure errors can return HTML or an empty body.
    }
    if (res.status === 401) throw new Error('Неверная почта или пароль')
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After'))
      const suffix = Number.isFinite(retryAfter)
        ? ` Повторите через ${Math.ceil(retryAfter / 60)} мин.`
        : ''
      throw new Error(`Слишком много попыток входа.${suffix}`)
    }
    throw new Error(serverMessage || `Не удалось войти: ${res.status}`)
  }
  return asJson(res)
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
}
