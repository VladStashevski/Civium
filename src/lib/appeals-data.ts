export type MonthPoint = {
  month: string
  count: number
  previousCount: number
  delta: number
}
export type ProfileRow = {
  name: string
  count: number
  previousCount: number
  delta: number
  deltaPercent: number | null
  share: number
}
export type SourceRow = ProfileRow
export type ComparisonSummary = {
  total: number
  profileCount: number
  sourceCount: number
  channelCount: number
  justifiedCount: number
  unjustifiedCount: number
  justificationMissingCount: number
  gratitudeCount: number
  discontinuedCount: number
}

export type AppealsSummary = {
  chiefDoctorCount: number
  redirectedCount: number
  justifiedCount: number
  unjustifiedCount: number
  justificationMissingCount: number
  discontinuedCount: number
  manualCount: number
  excelCount: number
  profileCount: number
  sourceCount: number
  channelCount: number
  locationCount: number
  rubricMissingCount: number
  gratitudeCount: number
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
  byChiefDoctorChannel?: SourceRow[]
  comparison: {
    currentYear: number
    previousYear: number
    cutoffMonthDay: string
    currentTotal: number
    previousTotal: number
    delta: number
    deltaPercent: number | null
    currentSummary: ComparisonSummary
    previousSummary: ComparisonSummary
  }
}

const emptySummary: AppealsSummary = {
  chiefDoctorCount: 0,
  redirectedCount: 0,
  justifiedCount: 0,
  unjustifiedCount: 0,
  justificationMissingCount: 0,
  discontinuedCount: 0,
  manualCount: 0,
  excelCount: 0,
  profileCount: 0,
  sourceCount: 0,
  channelCount: 0,
  locationCount: 0,
  rubricMissingCount: 0,
  gratitudeCount: 0,
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function countRows(value: unknown): SourceRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = objectValue(item)
    return {
      name: stringValue(row.name) || 'Не указано',
      count: numberValue(row.count),
      previousCount: numberValue(row.previousCount),
      delta: numberValue(row.delta),
      deltaPercent:
        row.deltaPercent === null ? null : numberValue(row.deltaPercent),
      share: numberValue(row.share),
    }
  })
}

function monthRows(value: unknown): MonthPoint[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = objectValue(item)
      return {
        month: stringValue(row.month),
        count: numberValue(row.count),
        previousCount: numberValue(row.previousCount),
        delta: numberValue(row.delta),
      }
    })
    .filter((row) => row.month)
}

export function normalizeDashboard(value: unknown): AppealsDashboard {
  const data = objectValue(value)
  const rawSummary = objectValue(data.summary)
  const total = numberValue(data.total)
  const byProfile = countRows(data.byProfile)
  const bySource = countRows(data.bySource)
  const byChiefDoctorChannel = countRows(data.byChiefDoctorChannel)
  const summary = Object.fromEntries(
    Object.keys(emptySummary).map((key) => [
      key,
      numberValue(rawSummary[key]),
    ]),
  ) as AppealsSummary
  if (rawSummary.profileCount === undefined) summary.profileCount = byProfile.length
  if (rawSummary.sourceCount === undefined) summary.sourceCount = bySource.length
  if (rawSummary.channelCount === undefined) {
    summary.channelCount = byChiefDoctorChannel.length
  }
  if (rawSummary.justificationMissingCount === undefined) {
    summary.justificationMissingCount = Math.max(
      0,
      total - summary.justifiedCount - summary.unjustifiedCount,
    )
  }
  const rawDateRange = objectValue(data.dateRange)
  const rawComparison = objectValue(data.comparison)
  const normalizeComparisonSummary = (value: unknown): ComparisonSummary => {
    const summary = objectValue(value)
    return {
      total: numberValue(summary.total),
      profileCount: numberValue(summary.profileCount),
      sourceCount: numberValue(summary.sourceCount),
      channelCount: numberValue(summary.channelCount),
      justifiedCount: numberValue(summary.justifiedCount),
      unjustifiedCount: numberValue(summary.unjustifiedCount),
      justificationMissingCount: numberValue(summary.justificationMissingCount),
      gratitudeCount: numberValue(summary.gratitudeCount),
      discontinuedCount: numberValue(summary.discontinuedCount),
    }
  }

  return {
    generatedAt: stringValue(data.generatedAt),
    sourceFile: stringValue(data.sourceFile),
    total,
    dateRange: {
      from: stringValue(rawDateRange.from),
      to: stringValue(rawDateRange.to),
    },
    summary,
    byMonth: monthRows(data.byMonth),
    byProfile,
    bySource,
    byChiefDoctorChannel,
    comparison: {
      currentYear: numberValue(rawComparison.currentYear),
      previousYear: numberValue(rawComparison.previousYear),
      cutoffMonthDay: stringValue(rawComparison.cutoffMonthDay),
      currentTotal: numberValue(rawComparison.currentTotal) || total,
      previousTotal: numberValue(rawComparison.previousTotal),
      delta: numberValue(rawComparison.delta),
      deltaPercent:
        rawComparison.deltaPercent === null
          ? null
          : numberValue(rawComparison.deltaPercent),
      currentSummary: normalizeComparisonSummary(rawComparison.currentSummary),
      previousSummary: normalizeComparisonSummary(rawComparison.previousSummary),
    },
  }
}

/** Доля от общего числа обращений, в процентах (одна десятая). */
export function shareOfTotal(count: number, total: number): number {
  if (!total) return 0
  return Math.round((count / total) * 1000) / 10
}

export function formatDeltaPercent(value: number | null): string {
  if (value === null) return 'новое'
  return `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function isGratitudeAppeal(appeal: {
  profile?: string
  rubricTheme?: string
  documentTopic?: string
  officialCategory?: string
  content?: string
  [key: string]: unknown
}): boolean {
  return /благодар|спасибо|признательн|поощр/i.test(
    [
      appeal.profile,
      appeal.rubricTheme,
      appeal.documentTopic,
      appeal.officialCategory,
      appeal.content,
      typeof appeal.rawRubric === 'string' ? appeal.rawRubric : '',
    ].join(' '),
  )
}
