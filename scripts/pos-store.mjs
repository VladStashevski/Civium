// Стор ПОС: отдельный от обращений файл data/pos-store.json. Модуль сам владеет
// вводом-выводом (кэш + очередь мутаций + атомарная запись) и сидом из выгрузки,
// чтобы server/index.mjs оставался тонким. Аннотации (manualFields) переживают
// повторный импорт по ключу «Номер», а база обогащается новыми выгрузками.
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readPosExcelRows, normalizePosRecords } from './pos-parser.mjs'
import { syncPosAnnotationTimestamps } from './pos-annotations.mjs'

export const POS_STORE_SCHEMA = 'pos.v1'

export function createPosStore(records = [], imports = []) {
  const now = new Date().toISOString()
  return {
    schema: POS_STORE_SCHEMA,
    createdAt: now,
    updatedAt: now,
    records,
    imports,
  }
}

export function migratePosStore(store = {}) {
  return {
    schema: POS_STORE_SCHEMA,
    createdAt: store.createdAt ?? new Date().toISOString(),
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    records: Array.isArray(store.records) ? store.records : [],
    imports: Array.isArray(store.imports) ? store.imports : [],
  }
}

/** Оставляет только разрешённые ручные поля из тела запроса. */
export function pickPosManualFields(input = {}) {
  const manualFields = {}
  if (input.isJustified !== undefined && input.isJustified !== null) {
    manualFields.isJustified = Boolean(input.isJustified)
  }
  if (typeof input.notes === 'string' && input.notes.trim()) {
    manualFields.notes = input.notes
  }
  if (typeof input.issues === 'string' && input.issues.trim()) {
    manualFields.issues = input.issues
  }
  if (Array.isArray(input.departments)) {
    const departments = input.departments
      .map((item) => String(item).trim())
      .filter(Boolean)
    if (departments.length) manualFields.departments = departments
  }
  return manualFields
}

/**
 * Импорт = пополнение общей базы: записи из файла добавляются или обновляют
 * прежние по ключу «Номер» (uid). Старые записи, которых нет в текущем файле,
 * остаются в базе вместе с manualFields.
 */
export function mergePosRecords(store, records, meta = {}) {
  const currentStore = migratePosStore(store)
  const now = new Date().toISOString()
  const { importId = crypto.randomUUID(), sourceFile = '' } = meta

  // дедупликация внутри самого импорта — последняя строка с тем же номером побеждает
  const importedByKey = new Map()
  let duplicateCount = 0
  for (const record of records) {
    if (importedByKey.has(record.uid)) duplicateCount += 1
    importedByKey.set(record.uid, record)
  }
  const importedRecords = [...importedByKey.values()]

  const existingByKey = new Map(
    currentStore.records.map((record) => [record.uid, record]),
  )

  let addedCount = 0
  let updatedCount = 0
  let preservedManualFieldsCount = 0

  const importedKeys = new Set()
  const mergedImported = importedRecords.map((record) => {
    importedKeys.add(record.uid)
    const previous = existingByKey.get(record.uid)
    const manualFields = previous?.manualFields ?? {}
    if (previous) updatedCount += 1
    else addedCount += 1
    if (Object.keys(manualFields).length) preservedManualFieldsCount += 1
    return {
      ...record,
      importId,
      sourceFile,
      manualFields,
      importHistory: [
        ...(previous?.importHistory ?? []),
        {
          importId,
          filename: sourceFile,
          rowNumber: record.rowNumber,
          importedAt: now,
        },
      ],
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      lastSeenImportId: importId,
    }
  })

  const keptExistingRecords = currentStore.records.filter(
    (record) => !importedKeys.has(record.uid),
  )
  const removedCount = keptExistingRecords.length

  const nextStore = {
    ...currentStore,
    updatedAt: now,
    records: [...mergedImported, ...keptExistingRecords].sort(comparePosRecords),
    imports: [
      ...currentStore.imports,
      {
        id: importId,
        filename: sourceFile,
        uploadedAt: now,
        rowsCount: records.length,
        uniqueRowsCount: importedRecords.length,
        duplicateCount,
        addedCount,
        updatedCount,
        removedCount,
        preservedManualFieldsCount,
      },
    ],
  }

  return {
    store: nextStore,
    importedRecords,
    importedRowsCount: records.length,
    addedCount,
    updatedCount,
    removedCount,
    duplicateCount,
    preservedManualFieldsCount,
    keptExistingCount: keptExistingRecords.length,
  }
}

function comparePosRecords(a, b) {
  return (
    String(b.dateIso ?? '').localeCompare(String(a.dateIso ?? '')) ||
    String(b.uid ?? '').localeCompare(String(a.uid ?? ''))
  )
}

/**
 * Репозиторий ПОС с собственным вводом-выводом. dataDir — куда писать
 * pos-store.json, seedFile — выгрузка для первого локального запуска (опционально).
 */
export function createPosRepository({ dataDir, seedFile } = {}) {
  const storeFile = path.join(dataDir, 'pos-store.json')
  let cache = null
  let queue = Promise.resolve()

  async function ensure() {
    await fs.mkdir(dataDir, { recursive: true })
    try {
      await fs.access(storeFile)
    } catch {
      const seedRecords = await readSeedRecords()
      const now = new Date().toISOString()
      const store = createPosStore(
        seedRecords,
        seedRecords.length
          ? [
              {
                id: 'initial-pos-seed',
                filename: path.basename(seedFile ?? 'pos-seed.xlsx'),
                uploadedAt: now,
                rowsCount: seedRecords.length,
              },
            ]
          : [],
      )
      await write(store)
    }
  }

  async function readSeedRecords() {
    if (!seedFile) return []
    try {
      await fs.access(seedFile)
      return normalizePosRecords(readPosExcelRows(seedFile), {
        sourceFile: path.basename(seedFile),
        importId: 'initial-pos-seed',
      })
    } catch {
      return []
    }
  }

  async function read() {
    if (cache) return cache
    await ensure()
    const parsed = JSON.parse(await fs.readFile(storeFile, 'utf8'))
    cache = migratePosStore(parsed)
    return cache
  }

  async function write(store) {
    await fs.mkdir(dataDir, { recursive: true })
    const tempFile = `${storeFile}.${process.pid}.${crypto.randomUUID()}.tmp`
    try {
      await fs.writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
      await fs.rename(tempFile, storeFile)
      cache = store
    } catch (error) {
      await fs.rm(tempFile, { force: true })
      throw error
    }
  }

  function mutate(mutator) {
    const operation = queue.then(async () => {
      const store = await read()
      const value = await mutator(store)
      if (value === null) return null
      const nextStore = value.nextStore ?? store
      nextStore.updatedAt = new Date().toISOString()
      try {
        await write(nextStore)
      } catch (error) {
        cache = null
        throw error
      }
      return value.result ?? value
    })
    queue = operation.catch(() => {})
    return operation
  }

  return {
    ensure,
    async list() {
      const store = await read()
      const items = store.records
        .slice()
        .sort(
          (a, b) =>
            b.dateIso.localeCompare(a.dateIso) || b.uid.localeCompare(a.uid),
        )
      return { items, total: items.length, updatedAt: store.updatedAt }
    },
    async patch(body = {}) {
      const uid = String(body.uid ?? '')
      if (!uid) return null
      return mutate((store) => {
        const current = store.records.find((record) => record.uid === uid)
        if (!current) return null
        const now = new Date().toISOString()
        const manualFields = pickPosManualFields(body)

        if (body.isJustified === null) {
          delete current.manualFields?.isJustified
          delete manualFields.isJustified
        } else if (body.isJustified !== undefined) {
          manualFields.isJustified = Boolean(body.isJustified)
        }
        if (body.notes !== undefined && !String(body.notes).trim()) {
          delete current.manualFields?.notes
          delete manualFields.notes
        }
        if (body.issues !== undefined && !String(body.issues).trim()) {
          delete current.manualFields?.issues
          delete manualFields.issues
        }
        if (body.departments !== undefined) {
          const departments = Array.isArray(body.departments)
            ? body.departments.map((item) => String(item).trim()).filter(Boolean)
            : []
          if (departments.length) {
            manualFields.departments = departments
          } else {
            delete current.manualFields?.departments
            delete manualFields.departments
          }
        }

        current.manualFields = { ...(current.manualFields ?? {}), ...manualFields }
        syncPosAnnotationTimestamps(current.manualFields, now)
        current.updatedAt = now
        return { result: current }
      })
    },
    async import(buffer, meta = {}) {
      const rows = readPosExcelRows(buffer)
      const records = normalizePosRecords(rows, meta)
      if (!records.length) {
        return {
          empty: true,
          rowsCount: rows.length,
          headers: Object.keys(rows[0] ?? {}).slice(0, 20),
        }
      }
      return mutate((store) => {
        const result = mergePosRecords(store, records, meta)
        return { nextStore: result.store, result }
      })
    },
  }
}
