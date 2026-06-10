export type MonthPoint = { month: string; count: number }
export type ProfileRow = { name: string; count: number; share: number }
export type SourceRow = { name: string; count: number; share: number }

export type AppealsSummary = {
  chiefDoctorCount: number
  redirectedCount: number
  justifiedCount: number
  unjustifiedCount: number
  manualCount: number
  excelCount: number
  profileCount: number
  sourceCount: number
  locationCount: number
  rubricMissingCount: number
}

export type AppealsDashboard = {
  generatedAt: string
  sourceFile: string
  total: number
  dateRange: { from: string; to: string }
  summary: AppealsSummary
  byMonth: MonthPoint[]
  byProfile: ProfileRow[]
  bySource: SourceRow[]
}

/** Доля от общего числа обращений, в процентах (одна десятая). */
export function shareOfTotal(count: number, total: number): number {
  if (!total) return 0
  return Math.round((count / total) * 1000) / 10
}

const MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

/** "2024-01" → "янв 2024" */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS_RU[Number(m) - 1]} ${year}`
}

/** "2024-01-09" → "9 янв 2024" */
export function formatDateIso(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`
}

/** "2024-01-09" → "09.01.2024" */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
