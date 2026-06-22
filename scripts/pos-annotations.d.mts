export function hasPosAnnotation(
  manualFields: Record<string, unknown> | null | undefined,
): boolean

export function syncPosAnnotationTimestamps<T extends Record<string, unknown>>(
  manualFields: T,
  now?: string,
): T
