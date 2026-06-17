import type { AppealMode } from '@/lib/api'

export type AppealModeSearch = { mode: AppealMode }

export function parseAppealModeSearch(
  search: Record<string, unknown>,
): AppealModeSearch {
  return {
    mode: search.mode === 'external' ? 'external' : 'chiefDoctor',
  }
}

export function appealModeLabel(mode: AppealMode): string {
  return mode === 'chiefDoctor'
    ? '07/19 — главный врач'
    : 'Депздрав Югры (07-*) и Губернатор Югры (01-*)'
}
