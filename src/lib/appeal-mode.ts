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
    ? 'На имя главного врача (07/19)'
    : 'Внешние обращения (07-/01-)'
}
