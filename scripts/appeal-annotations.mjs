// Единый источник правды для служебных полей аннотации обращения.
// Импортируется и сервером (PATCH /api/appeals), и клиентом (оптимистичный
// апдейт в use-appeals.ts), чтобы правила «когда аннотация считается заданной»
// и проставление annotationCreatedAt/annotationUpdatedAt не расходились между
// слоями. Модуль намеренно без серверных зависимостей (fs/xlsx) — безопасен
// для фронтового бандла.

/**
 * Есть ли в ручных полях содержательная аннотация (без учёта служебных
 * таймстампов): обоснованность, заметка, проблемы или отделения.
 * @param {Record<string, unknown> | null | undefined} manualFields
 * @returns {boolean}
 */
export function hasAnnotationContent(manualFields) {
  return (
    manualFields?.isJustified !== undefined ||
    Boolean(String(manualFields?.notes ?? '').trim()) ||
    Boolean(String(manualFields?.issues ?? '').trim()) ||
    Boolean(manualFields?.departments?.length)
  )
}

/**
 * Приводит служебные таймстампы аннотации в соответствие её содержимому:
 * при наличии контента проставляет created (если ещё не было) и updated,
 * иначе удаляет оба. Мутирует переданный объект на месте и возвращает его —
 * подходит и для иммутабельной копии на клиенте, и для записи в стор на сервере.
 * @template {Record<string, unknown>} T
 * @param {T} manualFields
 * @param {string} [now]
 * @returns {T}
 */
export function syncAnnotationTimestamps(
  manualFields,
  now = new Date().toISOString(),
) {
  if (hasAnnotationContent(manualFields)) {
    manualFields.annotationCreatedAt = manualFields.annotationCreatedAt || now
    manualFields.annotationUpdatedAt = now
  } else {
    delete manualFields.annotationCreatedAt
    delete manualFields.annotationUpdatedAt
  }
  return manualFields
}
