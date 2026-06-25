import type { Appeal, AppealMode } from '@/lib/api'

// Локальные helper'ы экспериментального раздела (живут только здесь, не влияют
// на стабильные дашборды).

export type RiskLevel = 'low' | 'mid' | 'high'

/** Уровень по значению 0–100: зелёный / жёлтый / красный. */
export function riskLevel(value: number): RiskLevel {
  if (value >= 67) return 'high'
  if (value >= 34) return 'mid'
  return 'low'
}

export const LEVEL_CLASS: Record<RiskLevel, { text: string; bg: string }> = {
  low: { text: 'text-positive', bg: 'bg-positive' },
  mid: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' },
  high: { text: 'text-destructive', bg: 'bg-destructive' },
}

/** CSS-цвет уровня для inline-заливок (color-mix и т.п.). */
export const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: 'var(--positive)',
  mid: '#f59e0b',
  high: 'var(--destructive)',
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

/** Источник обращения с учётом режима (как в таблице обращений). */
export function effectiveSource(appeal: Appeal, mode: AppealMode): string {
  const raw =
    mode === 'chiefDoctor'
      ? appeal.sourceChannel
      : appeal.sourceOrganizationDetail || appeal.sourceOrganization
  return (raw || appeal.source || 'Не указан').trim() || 'Не указан'
}

/** Отделения: ручная разметка приоритетнее распознанной. */
export function effectiveDepartments(appeal: Appeal): string[] {
  const manual = appeal.manualFields?.departments
  const list = manual && manual.length ? manual : appeal.departments
  return (list ?? []).map((item) => item.trim()).filter(Boolean)
}

const OVERDUE_STATUSES = new Set(['overdue', 'closed_overdue'])

export function isOverdue(appeal: Appeal): boolean {
  return OVERDUE_STATUSES.has(String(appeal.deadlineStatus ?? ''))
}

export function hasDeadlineData(appeals: Appeal[]): boolean {
  return appeals.some(
    (appeal) => appeal.deadlineStatus && appeal.deadlineStatus !== 'unknown',
  )
}

/** "2026-01-09" → "2026-01"; пусто, если дата некорректна. */
export function monthKey(dateIso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso.slice(0, 7) : ''
}

export function shortLabel(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
