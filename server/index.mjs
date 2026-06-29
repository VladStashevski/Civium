import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import {
  buildDashboardData,
  isGratitudeRecord,
  selectComparablePeriod,
} from '../scripts/complaints-parser.mjs'
import {
  buildReferenceData,
  createAppealsStore,
  mergeExcelRowsIntoStore,
  migrateAppealsStore,
  normalizeAppealExcelRows,
  pickManualFields,
  readAppealExcelRows,
} from '../scripts/appeals-store.mjs'
import { syncAnnotationTimestamps } from '../scripts/appeal-annotations.mjs'
import { createPosRepository, preparePosImport } from '../scripts/pos-store.mjs'

const rootDir = process.cwd()
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, 'data')
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(rootDir, 'uploads')
const storeFile = path.join(dataDir, 'complaints-store.json')
const backupDir = path.join(dataDir, 'backups')
const maxStoreBackups = Number(process.env.CIVIUM_MAX_BACKUPS ?? 10)
const initialExcelFile = path.join(rootDir, 'statistic.xls')
const posSeedFile = path.join(rootDir, 'pos-seed.xlsx')
const posRepo = createPosRepository({ dataDir, seedFile: posSeedFile })
const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '127.0.0.1'
const isProduction = process.env.NODE_ENV === 'production'
const adminEmail =
  process.env.CIVIUM_ADMIN_EMAIL ?? (isProduction ? '' : 'admin@civium.local')
const adminPassword =
  process.env.CIVIUM_ADMIN_PASSWORD ?? (isProduction ? '' : 'Civium2026!')
const sessionSecret =
  process.env.CIVIUM_SESSION_SECRET ?? (isProduction ? '' : 'civium-local-session-secret')
const secureSessionCookie =
  process.env.CIVIUM_COOKIE_SECURE === undefined
    ? isProduction
    : process.env.CIVIUM_COOKIE_SECURE === 'true'
const sessionCookie = 'civium_session'
const sessionLifetimeMs = 12 * 60 * 60 * 1000
const loginWindowMs = 15 * 60 * 1000
const loginAttemptLimit = 10
const loginAttempts = new Map()
let storeMutationQueue = Promise.resolve()
let storeCache = null
let storeReadInFlight = null
let storeIndex = createEmptyStoreIndex()

if (
  !adminEmail ||
  !adminPassword ||
  !sessionSecret ||
  (isProduction && sessionSecret.length < 32)
) {
  throw new Error(
    'CIVIUM_ADMIN_EMAIL, CIVIUM_ADMIN_PASSWORD and a 32+ character CIVIUM_SESSION_SECRET are required in production'
  )
}

const app = Fastify({ logger: true, trustProxy: isProduction })

await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})

// Единая обёртка ошибок: логируем полностью, наружу отдаём только статус и
// безопасное сообщение (детали 5xx не утекают клиенту).
app.setErrorHandler((error, request, reply) => {
  request.log.error(error)
  const status =
    typeof error.statusCode === 'number' && error.statusCode >= 400
      ? error.statusCode
      : 500
  reply
    .code(status)
    .send({ error: status >= 500 ? 'internal server error' : error.message })
})

// Периодически вычищаем просроченные окна лимита логина, чтобы Map не рос
// неограниченно при попытках с множества IP. unref — не держим процесс живым.
setInterval(() => {
  const now = Date.now()
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key)
  }
}, loginWindowMs).unref()

app.get('/api/health', async () => ({ ok: true }))

app.post('/api/auth/login', async (request, reply) => {
  const clientKey = request.ip
  const attempt = getLoginAttempt(clientKey)
  if (attempt.count >= loginAttemptLimit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((attempt.resetAt - Date.now()) / 1000)
    )
    reply.header('Retry-After', String(retryAfter))
    return reply.code(429).send({ error: 'too many login attempts' })
  }

  const email = String(request.body?.email ?? '').trim()
  const password = String(request.body?.password ?? '')

  if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) {
    recordFailedLogin(clientKey, attempt)
    return reply.code(401).send({ error: 'invalid credentials' })
  }

  loginAttempts.delete(clientKey)
  reply.header('Set-Cookie', buildSessionCookie(createSessionToken(email)))
  return { authenticated: true, email }
})

app.get('/api/auth/session', async (request, reply) => {
  const session = readSession(request)
  if (!session) return reply.code(401).send({ authenticated: false })
  return { authenticated: true, email: session.email }
})

app.post('/api/auth/logout', async (_request, reply) => {
  reply.header('Set-Cookie', clearSessionCookie())
  return { authenticated: false }
})

app.addHook('onRequest', async (request, reply) => {
  if (
    !request.url.startsWith('/api/') ||
    request.url === '/api/health' ||
    request.url.startsWith('/api/auth/')
  ) {
    return
  }

  if (!readSession(request)) {
    return reply.code(401).send({ error: 'authentication required' })
  }
})

app.get('/api/dashboard', async (request) => {
  const store = await readStore()
  const records = filterRecordsByMode(store.records, request.query?.mode)
  return buildDashboardData(records, {
    sourceFile: store.imports.at(-1)?.filename ?? 'database',
  })
})

app.get('/api/references', async (request) => {
  const store = await readStore()
  const mode = getAppealModeFilter(request.query?.mode)
  const modeRecords = filterRecordsByMode(store.records, mode)
  const comparable = selectComparablePeriod(modeRecords)
  const taxonomyRecords = [...comparable.previous, ...comparable.current]
  const records = taxonomyRecords.filter(
    (record) => !isGratitudeRecord(record)
  )
  const references = buildReferenceData(records, { taxonomyRecords })
  if (mode === 'chiefDoctor') {
    references.sources = buildChannelReferences(records)
  }
  return {
    ...references,
    comparison: {
      currentYear: comparable.currentYear,
      previousYear: comparable.previousYear,
      cutoffMonthDay: comparable.cutoffMonthDay,
    },
  }
})

// Внутренние/тяжёлые поля записи, которые клиенту не нужны: `raw` (исходная
// строка Excel) — это ~68% веса записи. Проекция режет ответ /api/appeals с
// ~17.7 МБ до ~3.2 МБ (−82%) без потери того, что реально читает фронт.
const OMITTED_APPEAL_FIELDS = new Set([
  'raw',
  'normalized',
  'importHistory',
  'groupDocuments',
  'correspondentRaw',
  'deadlineRaw',
  'completedAtRaw',
  'rubricClassification',
  'rowNumber',
  'lastSeenImportId',
  'duplicateRowNumbers',
])

function toAppealDto(record) {
  const dto = {}
  for (const key of Object.keys(record)) {
    if (!OMITTED_APPEAL_FIELDS.has(key)) dto[key] = record[key]
  }
  return dto
}

app.get('/api/appeals', async (request) => {
  const store = await readStore()
  const limit = clampInteger(request.query?.limit, 25, 1, 100000)
  const offset = clampInteger(request.query?.offset, 0, 0, Number.MAX_SAFE_INTEGER)
  const query = cleanQueryValue(request.query?.q).toLocaleLowerCase('ru-RU')
  const records = filterRecordsByMode(store.records, request.query?.mode)
    .slice()
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || b.id.localeCompare(a.id))
    .filter((record) => {
      if (!query) return true
      return [
        record.id,
        record.appealKey,
        record.applicant?.name,
        record.correspondent,
        record.content,
        record.rubricCanonicalName,
        record.officialCategory,
        record.registrationRoute,
        record.sourceOrganization,
        record.sourceChannel,
        record.manualFields?.responsible,
        record.manualFields?.notes,
        record.manualFields?.issues,
        ...(record.manualFields?.departments ?? record.departments ?? []),
      ]
        .join(' ')
        .toLocaleLowerCase('ru-RU')
        .includes(query)
    })

  return {
    items: records.slice(offset, offset + limit).map(toAppealDto),
    total: records.length,
    limit,
    offset,
    updatedAt: store.updatedAt,
  }
})

function getAppealModeFilter(value) {
  return value === 'external' ? 'external' : 'chiefDoctor'
}

function filterRecordsByMode(records, value) {
  const mode = getAppealModeFilter(value)
  return records.filter((record) => record.appealMode === mode)
}

function buildChannelReferences(records) {
  const counts = new Map()
  for (const record of records) {
    const name = String(record.sourceChannel || record.delivery || 'Не указан').trim()
    const item = counts.get(name) ?? { count: 0, years: {} }
    item.count += 1
    if (record.year) {
      item.years[record.year] = (item.years[record.year] ?? 0) + 1
    }
    counts.set(name, item)
  }
  return [...counts.entries()]
    .map(([name, item]) => ({
      id: `channel:${crypto.createHash('sha1').update(name).digest('hex').slice(0, 12)}`,
      name,
      status: 'Источник поступления в контуре 07/19',
      count: item.count,
      years: item.years,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
}

app.patch('/api/appeals', async (request, reply) => {
  const { uid, id, appealKey, isJustified } = request.body ?? {}

  if (!uid && !id && !appealKey) {
    return reply.code(400).send({ error: 'uid, id or appealKey is required' })
  }
  if (isInvalidOptionalBoolean(isJustified)) {
    return reply.code(400).send({ error: 'isJustified must be boolean or null' })
  }
  if (isInvalidInspection(request.body?.inspection)) {
    return reply.code(400).send({ error: 'inspection must be vnk or service' })
  }

  const record = await mutateStore((store) => {
    const current = findStoreRecord(store, { uid, id, appealKey })
    if (!current) return null

    const now = new Date().toISOString()
    const manualFields = pickManualFields(request.body ?? {})
    if (isJustified === null) {
      delete current.manualFields?.isJustified
      delete manualFields.isJustified
    } else if (typeof isJustified === 'boolean') {
      manualFields.isJustified = isJustified
    }
    for (const key of ['responsible', 'notes', 'issues', 'inspection']) {
      if (request.body?.[key] !== undefined && !String(request.body[key]).trim()) {
        delete current.manualFields?.[key]
        delete manualFields[key]
      }
    }
    if (request.body?.departments !== undefined) {
      if (
        !Array.isArray(request.body.departments) ||
        !manualFields.departments?.length
      ) {
        delete current.manualFields?.departments
        delete manualFields.departments
      }
    }

    const hasAnnotationPatch =
      request.body?.isJustified !== undefined ||
      request.body?.inspection !== undefined ||
      request.body?.notes !== undefined ||
      request.body?.issues !== undefined ||
      request.body?.departments !== undefined

    current.manualFields = {
      ...(current.manualFields ?? {}),
      ...manualFields,
    }
    if (hasAnnotationPatch) {
      syncAnnotationTimestamps(current.manualFields, now)
    }
    current.updatedAt = now
    current.normalized = {
      ...(current.normalized ?? {}),
      manualUpdatedAt: now,
    }
    return current
  }, {
    migrateBeforeWrite: false,
    rebuildReferences: false,
    pretty: false,
  })

  if (!record) {
    return reply.code(404).send({ error: 'appeal not found' })
  }

  return { item: toAppealDto(record) }
})

app.post('/api/imports/excel', async (request, reply) => {
  const file = await request.file()

  if (!file) {
    return reply.code(400).send({ error: 'file is required' })
  }

  const buffer = await file.toBuffer()
  const importId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(file.filename || 'statistic.xls')
  const storedFilename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeFilename}`
  const rows = readAppealExcelRows(buffer)

  if (!rows.length) {
    return reply.code(400).send({
      error: 'Excel file does not contain recognized appeal rows',
    })
  }

  await fs.mkdir(uploadDir, { recursive: true })
  await fs.writeFile(path.join(uploadDir, storedFilename), buffer)

  const merge = await mutateStore(async (store) => {
    const backupFile = await backupStoreFile()
    const result = mergeExcelRowsIntoStore(store, rows, {
      importId,
      sourceFile: safeFilename,
      storedFilename,
    })
    return { nextStore: result.store, result: { ...result, backupFile } }
  })

  if (merge.removedCount > 0) {
    request.log.warn(
      {
        importId,
        sourceFile: safeFilename,
        removedCount: merge.removedCount,
        backupFile: merge.backupFile,
      },
      'excel import dropped existing records not present in the uploaded file',
    )
  }

  return {
    importId,
    uploadedAt: new Date().toISOString(),
    rowsCount: merge.importedRecords.length,
    addedCount: merge.addedCount,
    updatedCount: merge.updatedCount,
    removedCount: merge.removedCount,
    manualFieldsPreserved: merge.preservedManualFieldsCount,
    existingRecordsKept: merge.keptExistingCount,
    backupCreated: Boolean(merge.backupFile),
  }
})

app.get('/api/pos', async () => {
  return posRepo.list()
})

app.patch('/api/pos', async (request, reply) => {
  const uid = String(request.body?.uid ?? '')
  if (!uid) {
    return reply.code(400).send({ error: 'uid is required' })
  }
  if (isInvalidOptionalBoolean(request.body?.isJustified)) {
    return reply.code(400).send({ error: 'isJustified must be boolean or null' })
  }
  const record = await posRepo.patch(request.body ?? {})
  if (!record) {
    return reply.code(404).send({ error: 'pos message not found' })
  }
  return { item: record }
})

app.post('/api/imports/pos-excel', async (request, reply) => {
  const file = await request.file()
  if (!file) {
    return reply.code(400).send({ error: 'file is required' })
  }

  const buffer = await file.toBuffer()
  const importId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(file.filename || 'pos.xlsx')
  const storedFilename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeFilename}`

  const importMeta = {
    importId,
    sourceFile: safeFilename,
    storedFilename,
  }
  const prepared = preparePosImport(buffer, importMeta)

  if (prepared.empty) {
    const headers = Array.isArray(prepared.headers) ? prepared.headers : []
    const foundHeaders = headers.length ? headers.join(', ') : 'не найдены'
    return reply.code(400).send({
      error:
        prepared.rowsCount > 0
          ? `Файл не похож на выгрузку ПОС: не найдены строки с колонкой «Номер». Найденные заголовки: ${foundHeaders}`
          : 'Excel file does not contain recognized ПОС rows',
      rowsCount: prepared.rowsCount ?? 0,
      headers,
    })
  }

  await fs.mkdir(uploadDir, { recursive: true })
  await fs.writeFile(path.join(uploadDir, storedFilename), buffer)

  const result = await posRepo.importRecords(prepared.records, importMeta)

  return {
    importId,
    uploadedAt: new Date().toISOString(),
    rowsCount: result.importedRecords.length,
    addedCount: result.addedCount,
    updatedCount: result.updatedCount,
    removedCount: result.removedCount,
    manualFieldsPreserved: result.preservedManualFieldsCount,
    existingRecordsKept: result.keptExistingCount,
  }
})

let shuttingDown = false
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    app.log.info(`${signal} received — завершаем работу`)
    // Дожидаемся незавершённой мутации стора (атомарная запись не должна
    // прерываться), затем закрываем сервер.
    storeMutationQueue
      .catch(() => {})
      .then(() => app.close())
      .catch((error) => app.log.error(error))
      .finally(() => process.exit(0))
  })
}

await ensureStore()
await migrateStoreFile()
await posRepo.ensure()
await app.listen({ port, host })

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(storeFile)
  } catch {
    const initialRecords = await readInitialExcelRecords()
    const now = new Date().toISOString()
    const initialStore = createAppealsStore(
      initialRecords,
      initialRecords.length
        ? [
            {
              id: 'initial-statistic-xls',
              filename: 'statistic.xls',
              uploadedAt: now,
              rowsCount: initialRecords.length,
            },
          ]
        : []
    )

    await writeStore(initialStore)
  }
}

async function readStore() {
  if (storeCache) return storeCache
  // Защита от гонки холодного кэша: при пустом кэше параллельные запросы
  // переиспользуют одно чтение/парс файла вместо того, чтобы парсить ~17 МБ дважды.
  if (storeReadInFlight) return storeReadInFlight
  storeReadInFlight = (async () => {
    await ensureStore()
    const raw = await fs.readFile(storeFile, 'utf8')
    const parsed = JSON.parse(raw)
    return setStoreCache(migrateAppealsStore(parsed))
  })()
  try {
    return await storeReadInFlight
  } finally {
    storeReadInFlight = null
  }
}

async function migrateStoreFile() {
  const raw = await fs.readFile(storeFile, 'utf8')
  const parsed = JSON.parse(raw)
  const migrated = migrateAppealsStore(parsed)
  if (parsed.version !== migrated.version || parsed.schema !== migrated.schema) {
    await writeStore(migrated)
  } else {
    setStoreCache(migrated)
  }
}

async function writeStore(store, options = {}) {
  const {
    migrateBeforeWrite = true,
    rebuildReferences = true,
    pretty = true,
  } = options
  await fs.mkdir(dataDir, { recursive: true })
  const migrated = migrateBeforeWrite ? migrateAppealsStore(store) : store
  if (rebuildReferences) {
    migrated.references = buildReferenceData(migrated.records)
  }
  const tempFile = `${storeFile}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    const serialized = pretty
      ? `${JSON.stringify(migrated, null, 2)}\n`
      : JSON.stringify(migrated)
    await fs.writeFile(tempFile, serialized, 'utf8')
    await fs.rename(tempFile, storeFile)
    setStoreCache(migrated)
  } catch (error) {
    await fs.rm(tempFile, { force: true })
    throw error
  }
}

// Импорт обращений additive: совпавшие Excel-записи обновляются, новые добавляются,
// а строки прошлых выгрузок остаются в базе. Перед каждым импортом снимаем снимок
// стора, чтобы случайная загрузка частичного/чужого файла была обратимой.
async function backupStoreFile() {
  try {
    await fs.access(storeFile)
  } catch {
    return null
  }
  await fs.mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(backupDir, `complaints-store.${stamp}.json`)
  await fs.copyFile(storeFile, target)
  await pruneStoreBackups()
  return target
}

async function pruneStoreBackups() {
  if (!(maxStoreBackups > 0)) return
  try {
    const entries = (await fs.readdir(backupDir))
      .filter(
        (name) =>
          name.startsWith('complaints-store.') && name.endsWith('.json'),
      )
      .sort() // ISO-таймстамп в имени сортируется хронологически
    const excess = entries.slice(0, Math.max(0, entries.length - maxStoreBackups))
    await Promise.all(
      excess.map((name) => fs.rm(path.join(backupDir, name), { force: true })),
    )
  } catch {
    // чистка бэкапов не критична — глотаем ошибку
  }
}

function mutateStore(mutator, writeOptions = {}) {
  const operation = storeMutationQueue.then(async () => {
    const store = await readStore()
    const value = await mutator(store)
    if (value === null) return null
    const nextStore = value?.nextStore ?? store
    nextStore.updatedAt = new Date().toISOString()
    try {
      await writeStore(nextStore, writeOptions)
    } catch (error) {
      storeCache = null
      storeIndex = createEmptyStoreIndex()
      throw error
    }
    return value?.nextStore ? value.result : value
  })
  storeMutationQueue = operation.catch(() => {})
  return operation
}

function createEmptyStoreIndex() {
  return {
    byUid: new Map(),
    byId: new Map(),
    byAppealKey: new Map(),
  }
}

function setStoreCache(store) {
  storeCache = store
  storeIndex = createStoreIndex(store.records)
  return storeCache
}

function createStoreIndex(records = []) {
  const index = createEmptyStoreIndex()
  for (const record of records) {
    if (record.uid) index.byUid.set(record.uid, record)
    if (record.id) index.byId.set(record.id, record)
    if (record.appealKey) index.byAppealKey.set(record.appealKey, record)
  }
  return index
}

function findStoreRecord(store, { uid, id, appealKey }) {
  if (store !== storeCache) {
    const records = Array.isArray(store?.records) ? store.records : []
    return records.find((item) =>
      uid ? item.uid === uid : appealKey ? item.appealKey === appealKey : item.id === id
    )
  }
  if (uid) return storeIndex.byUid.get(uid)
  if (appealKey) return storeIndex.byAppealKey.get(appealKey)
  if (id) return storeIndex.byId.get(id)
  return undefined
}

function sanitizeFilename(filename) {
  return filename.replace(/[^\p{L}\p{N}._-]+/gu, '_')
}

async function readInitialExcelRecords() {
  try {
    await fs.access(initialExcelFile)
    return normalizeAppealExcelRows(readAppealExcelRows(initialExcelFile), {
      sourceFile: 'statistic.xls',
      importId: 'initial-statistic-xls',
    })
  } catch {
    return []
  }
}

function getLoginAttempt(clientKey) {
  const current = loginAttempts.get(clientKey)
  if (!current || current.resetAt <= Date.now()) {
    return { count: 0, resetAt: Date.now() + loginWindowMs }
  }
  return current
}

function recordFailedLogin(clientKey, attempt) {
  loginAttempts.set(clientKey, {
    count: attempt.count + 1,
    resetAt: attempt.resetAt,
  })
}

function cleanQueryValue(value) {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

function isInvalidOptionalBoolean(value) {
  return value !== undefined && value !== null && typeof value !== 'boolean'
}

function isInvalidInspection(value) {
  if (value === undefined || value === null || !String(value).trim()) return false
  return !['vnk', 'service'].includes(String(value).trim())
}

// Разбор числового query-параметра с дефолтом и зажимом в [min, max].
// Раньше Number("abc") → NaN, и slice(offset, NaN) возвращал пустой ответ.
function clampInteger(value, fallback, min, max) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  const base = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
  return Math.min(Math.max(base, min), max)
}

function createSessionToken(email) {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      expiresAt: Date.now() + sessionLifetimeMs,
    })
  ).toString('base64url')
  const signature = crypto
    .createHmac('sha256', sessionSecret)
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

function readSession(request) {
  const cookieHeader = String(request.headers.cookie ?? '')
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === sessionCookie)?.[1]
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = crypto
    .createHmac('sha256', sessionSecret)
    .update(payload)
    .digest('base64url')
  if (!safeEqual(signature, expected)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (
      typeof session.email !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Date.now()
    ) {
      return null
    }
    return session
  } catch {
    return null
  }
}

function buildSessionCookie(token) {
  return [
    `${sessionCookie}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(sessionLifetimeMs / 1000)}`,
    ...(secureSessionCookie ? ['Secure'] : []),
  ].join('; ')
}

function clearSessionCookie() {
  return [
    `${sessionCookie}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    ...(secureSessionCookie ? ['Secure'] : []),
  ].join('; ')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  )
}
