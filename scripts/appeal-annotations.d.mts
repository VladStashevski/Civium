export function hasAnnotationContent(
  manualFields: Record<string, unknown> | null | undefined,
): boolean

export function syncAnnotationTimestamps<T extends Record<string, unknown>>(
  manualFields: T,
  now?: string,
): T
