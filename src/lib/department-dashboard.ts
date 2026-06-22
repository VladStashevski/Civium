import {
  DEPARTMENT_BY_NAME,
  DEPARTMENT_GROUPS,
  DEPARTMENT_OPTIONS,
  resolveDepartmentName,
} from '@/lib/departments'
import type { ProfileRow } from '@/lib/appeals-data'

type RecordWithDepartments = {
  dateIso: string
  departments?: string[]
  manualFields?: {
    departments?: string[]
  }
}

export type DepartmentDashboard = {
  currentYear: number
  previousYear: number
  departments: ProfileRow[]
  profiles: ProfileRow[]
}

export type DepartmentProfileTrendRow = {
  month: string
  current: Record<string, number>
  previous: Record<string, number>
}

function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function yearOf(record: RecordWithDepartments): number {
  return Number(record.dateIso.slice(0, 4)) || 0
}

function inWindow(
  record: RecordWithDepartments,
  year: number,
  cutoffMonthDay: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.dateIso)) return false
  return yearOf(record) === year && record.dateIso.slice(5) <= cutoffMonthDay
}

function recordDepartments(record: RecordWithDepartments): string[] {
  const manual = record.manualFields?.departments ?? []
  const source = manual.length ? manual : (record.departments ?? [])
  return [...new Set(source.map(resolveDepartmentName).filter(Boolean))]
}

function recordProfiles(record: RecordWithDepartments): string[] {
  return [
    ...new Set(
      recordDepartments(record)
        .map((department) => DEPARTMENT_BY_NAME.get(department)?.profile)
        .filter((profile): profile is string => Boolean(profile)),
    ),
  ]
}

function countRows(
  current: RecordWithDepartments[],
  previous: RecordWithDepartments[],
  getNames: (record: RecordWithDepartments) => string[],
  allNames: string[] = [],
): ProfileRow[] {
  const count = (records: RecordWithDepartments[]) => {
    const counts = new Map<string, number>()
    for (const record of records) {
      for (const name of new Set(getNames(record))) {
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }
    return counts
  }
  const currentCounts = count(current)
  const previousCounts = count(previous)
  return [...new Set([...allNames, ...currentCounts.keys(), ...previousCounts.keys()])]
    .map((name) => {
      const itemCount = currentCounts.get(name) ?? 0
      const previousCount = previousCounts.get(name) ?? 0
      return {
        name,
        count: itemCount,
        previousCount,
        delta: itemCount - previousCount,
        deltaPercent: percentChange(itemCount, previousCount),
        share: current.length
          ? Number(((itemCount / current.length) * 100).toFixed(1))
          : 0,
      }
    })
    .sort((a, b) => b.count - a.count || b.previousCount - a.previousCount)
}

export function buildDepartmentDashboard(
  records: RecordWithDepartments[],
): DepartmentDashboard {
  const dated = records.filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.dateIso))
  const currentYear = Math.max(...dated.map(yearOf), 0)
  const previousYear = currentYear ? currentYear - 1 : 0
  const currentYearRecords = dated.filter((record) => yearOf(record) === currentYear)
  const cutoffMonthDay =
    currentYearRecords
      .map((record) => record.dateIso.slice(5))
      .sort()
      .at(-1) ?? '12-31'
  const current = dated.filter((record) =>
    inWindow(record, currentYear, cutoffMonthDay),
  )
  const previous = dated.filter((record) =>
    inWindow(record, previousYear, cutoffMonthDay),
  )

  const allProfiles = DEPARTMENT_GROUPS.map((group) => group.profile)
  const profileNames = new Set<string>(allProfiles)
  const allDepartments = DEPARTMENT_OPTIONS.map((department) => department.value)
  const departmentNames = new Set<string>(allDepartments)
  const getDepartments = (record: RecordWithDepartments) =>
    recordDepartments(record).filter((department) => departmentNames.has(department))
  const getProfiles = (record: RecordWithDepartments) =>
    recordProfiles(record).filter((profile) => profileNames.has(profile))

  return {
    currentYear,
    previousYear,
    departments: countRows(
      current,
      previous,
      getDepartments,
      allDepartments,
    ),
    profiles: countRows(current, previous, getProfiles, allProfiles),
  }
}

export function buildDepartmentProfileTrend(
  records: RecordWithDepartments[],
): {
  currentYear: number
  previousYear: number
  cutoffMonthDay: string
  profiles: string[]
  rows: DepartmentProfileTrendRow[]
} {
  const dated = records.filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.dateIso))
  const currentYear = Math.max(...dated.map(yearOf), 0)
  const previousYear = currentYear ? currentYear - 1 : 0
  const currentYearRecords = dated.filter((record) => yearOf(record) === currentYear)
  const cutoffMonthDay =
    currentYearRecords
      .map((record) => record.dateIso.slice(5))
      .sort()
      .at(-1) ?? '12-31'
  const current = dated.filter((record) =>
    inWindow(record, currentYear, cutoffMonthDay),
  )
  const previous = dated.filter((record) =>
    inWindow(record, previousYear, cutoffMonthDay),
  )
  const cutoffMonth = Number(cutoffMonthDay.slice(0, 2)) || 12
  const profiles = DEPARTMENT_GROUPS.map((group) => group.profile)
  const emptyProfileCounts = () =>
    Object.fromEntries(profiles.map((profile) => [profile, 0]))
  const rows = Array.from({ length: cutoffMonth }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    const row: DepartmentProfileTrendRow = {
      month,
      current: emptyProfileCounts(),
      previous: emptyProfileCounts(),
    }
    for (const record of current) {
      if (record.dateIso.slice(5, 7) !== month) continue
      for (const profile of recordProfiles(record)) {
        row.current[profile] = Number(row.current[profile] ?? 0) + 1
      }
    }
    for (const record of previous) {
      if (record.dateIso.slice(5, 7) !== month) continue
      for (const profile of recordProfiles(record)) {
        row.previous[profile] = Number(row.previous[profile] ?? 0) + 1
      }
    }
    return row
  })

  return {
    currentYear,
    previousYear,
    cutoffMonthDay,
    profiles,
    rows,
  }
}
