// Единый источник правды для служебных полей аннотации записи ПОС.
// Импортируется и сервером (PATCH /api/pos), и клиентом (оптимистичный апдейт в
// use-pos.ts), чтобы правила «когда аннотация задана» и проставление
// annotationCreatedAt/annotationUpdatedAt не расходились. Без серверных
// зависимостей (fs/xlsx) — безопасен для фронтового бандла.

/**
 * Есть ли содержательная аннотация (без учёта служебных таймстампов):
 * обоснованность, заметка, проблемы или отделения.
 * @param {Record<string, unknown> | null | undefined} manualFields
 * @returns {boolean}
 */
export function hasPosAnnotation(manualFields) {
  return (
    manualFields?.isJustified !== undefined ||
    Boolean(String(manualFields?.notes ?? '').trim()) ||
    Boolean(String(manualFields?.issues ?? '').trim()) ||
    Boolean(manualFields?.departments?.length)
  )
}

/**
 * Приводит таймстампы аннотации в соответствие содержимому: при наличии контента
 * проставляет created (если ещё не было) и updated, иначе удаляет оба. Мутирует
 * переданный объект и возвращает его.
 * @template {Record<string, unknown>} T
 * @param {T} manualFields
 * @param {string} [now]
 * @returns {T}
 */
export function syncPosAnnotationTimestamps(
  manualFields,
  now = new Date().toISOString(),
) {
  if (hasPosAnnotation(manualFields)) {
    manualFields.annotationCreatedAt = manualFields.annotationCreatedAt || now
    manualFields.annotationUpdatedAt = now
  } else {
    delete manualFields.annotationCreatedAt
    delete manualFields.annotationUpdatedAt
  }
  return manualFields
}
