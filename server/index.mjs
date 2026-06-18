import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import {
  buildDashboardData,
  isGratitudeRecord,
  normalizeManualRecord,
  selectComparablePeriod,
} from '../scripts/complaints-parser.mjs'
import {
  buildAppealsAnalytics,
  buildAppealsGraph,
  buildReferenceData,
  createAppealsStore,
  mergeExcelRowsIntoStore,
  migrateAppealsStore,
  normalizeAppealExcelRows,
  pickManualFields,
  readAppealExcelRows,
} from '../scripts/appeals-store.mjs'
import {
  buildComparisonReport as buildStrictComparisonReport,
  normalizeExcelRows as normalizeComparisonExcelRows,
  readExcelRows as readComparisonExcelRows,
} from '../scripts/complaints-parser-strict.mjs'

const rootDir = process.cwd()
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(rootDir, 'data')
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(rootDir, 'uploads')
const storeFile = path.join(dataDir, 'complaints-store.json')
const initialExcelFile = path.join(rootDir, 'statistic.xls')
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

app.get('/api/analytics', async (request) => {
  const store = await readStore()
  return buildAppealsAnalytics(store.records, getFilters(request.query))
})

app.get('/api/graph', async (request) => {
  const store = await readStore()
  return buildAppealsGraph(store.records, getFilters(request.query))
})

app.get('/api/references', async (request) => {
  const store = await readStore()
  const mode = getAppealModeFilter(request.query?.mode)
  const modeRecords = filterRecordsByMode(store.records, mode)
  const comparable = selectComparablePeriod(modeRecords)
  const records = [...comparable.previous, ...comparable.current].filter(
    (record) => !isGratitudeRecord(record)
  )
  const references = buildReferenceData(records)
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

app.get('/api/appeals', async (request) => {
  const store = await readStore()
  const limit = Math.min(Math.max(Number(request.query?.limit ?? 25), 1), 100000)
  const offset = Math.max(Number(request.query?.offset ?? 0), 0)
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
    items: records.slice(offset, offset + limit),
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

app.post('/api/appeals', async (request, reply) => {
  const record = normalizeManualRecord(request.body ?? {})

  if (!record.content) {
    return reply.code(400).send({ error: 'content is required' })
  }

  await mutateStore((store) => {
    assertUniqueAppealIds(store.records, [record])
    store.records.push(record)
  })

  return reply.code(201).send({ item: record })
})

app.post('/api/appeals/bulk', async (request, reply) => {
  const items = Array.isArray(request.body?.items) ? request.body.items : []

  if (!items.length) {
    return reply.code(400).send({ error: 'items array is required and cannot be empty' })
  }
  if (items.length > 10_000) {
    return reply.code(400).send({ error: 'items array is too large' })
  }

  const newRecords = items.map(item => normalizeManualRecord(item))
  if (newRecords.some((record) => !record.content)) {
    return reply.code(400).send({ error: 'content is required for every item' })
  }
  await mutateStore((store) => {
    assertUniqueAppealIds(store.records, newRecords)
    store.records.push(...newRecords)
  })

  return reply.code(201).send({ count: newRecords.length })
})

app.patch('/api/appeals', async (request, reply) => {
  const { uid, id, appealKey, isJustified } = request.body ?? {}

  if (!uid && !id && !appealKey) {
    return reply.code(400).send({ error: 'uid, id or appealKey is required' })
  }

  const record = await mutateStore((store) => {
    const current = store.records.find((item) =>
      uid ? item.uid === uid : appealKey ? item.appealKey === appealKey : item.id === id
    )
    if (!current) return null

    const now = new Date().toISOString()
    const manualFields = pickManualFields(request.body ?? {})
    if (isJustified === null) {
      delete current.manualFields?.isJustified
      delete manualFields.isJustified
    } else if (isJustified !== undefined) {
      manualFields.isJustified = Boolean(isJustified)
    }
    for (const key of ['responsible', 'notes', 'issues']) {
      if (request.body?.[key] !== undefined && !String(request.body[key]).trim()) {
        delete current.manualFields?.[key]
        delete manualFields[key]
      }
    }
    if (request.body?.departments !== undefined) {
      const departments = Array.isArray(request.body.departments)
        ? request.body.departments.map((item) => String(item).trim()).filter(Boolean)
        : []
      if (departments.length) {
        manualFields.departments = departments
      } else {
        delete current.manualFields?.departments
        delete manualFields.departments
      }
    }

    const hasAnnotationPatch =
      request.body?.isJustified !== undefined ||
      request.body?.notes !== undefined ||
      request.body?.issues !== undefined ||
      request.body?.departments !== undefined

    current.manualFields = {
      ...(current.manualFields ?? {}),
      ...manualFields,
    }
    if (hasAnnotationPatch) {
      const hasAnnotation =
        current.manualFields?.isJustified !== undefined ||
        Boolean(String(current.manualFields?.notes ?? '').trim()) ||
        Boolean(String(current.manualFields?.issues ?? '').trim()) ||
        Boolean(current.manualFields?.departments?.length)

      if (hasAnnotation) {
        current.manualFields.annotationCreatedAt =
          current.manualFields.annotationCreatedAt || now
        current.manualFields.annotationUpdatedAt = now
      } else {
        delete current.manualFields?.annotationCreatedAt
        delete current.manualFields?.annotationUpdatedAt
      }
    }
    current.updatedAt = now
    current.normalized = {
      ...(current.normalized ?? {}),
      manualUpdatedAt: now,
    }
    return current
  })

  if (!record) {
    return reply.code(404).send({ error: 'appeal not found' })
  }

  return { item: record }
})

app.get('/api/imports', async () => {
  const store = await readStore()
  return { items: store.imports.slice().reverse() }
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

  const merge = await mutateStore((store) => {
    const result = mergeExcelRowsIntoStore(store, rows, {
      importId,
      sourceFile: safeFilename,
      storedFilename,
    })
    return { nextStore: result.store, result }
  })

  return {
    importId,
    uploadedAt: new Date().toISOString(),
    rowsCount: merge.importedRecords.length,
    addedCount: merge.addedCount,
    updatedCount: merge.updatedCount,
    removedCount: merge.removedCount,
    manualFieldsPreserved: merge.preservedManualFieldsCount,
    existingRecordsKept: merge.keptExistingCount,
  }
})

app.post('/api/reports/comparison', async (request, reply) => {
  const uploads = {}
  let institution = 'БУ СОКБ'

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      uploads[part.fieldname] = {
        filename: sanitizeFilename(part.filename || `${part.fieldname}.xls`),
        buffer: await part.toBuffer(),
      }
      continue
    }

    if (part.fieldname === 'institution') {
      institution = String(part.value || '').trim() || institution
    }
  }

  if (!uploads.currentFile || !uploads.previousFile) {
    return reply
      .code(400)
      .send({ error: 'currentFile and previousFile are required' })
  }

  const currentRecords = normalizeComparisonExcelRows(
    readComparisonExcelRows(uploads.currentFile.buffer),
    {
      sourceFile: uploads.currentFile.filename,
      importId: crypto.randomUUID(),
    }
  )
  const previousRecords = normalizeComparisonExcelRows(
    readComparisonExcelRows(uploads.previousFile.buffer),
    {
      sourceFile: uploads.previousFile.filename,
      importId: crypto.randomUUID(),
    }
  )

  return buildStrictComparisonReport(currentRecords, previousRecords, {
    institution,
    currentSourceFile: uploads.currentFile.filename,
    previousSourceFile: uploads.previousFile.filename,
  })
})

await ensureStore()
await migrateStoreFile()
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
  await ensureStore()
  const raw = await fs.readFile(storeFile, 'utf8')
  const parsed = JSON.parse(raw)
  return migrateAppealsStore(parsed)
}

async function migrateStoreFile() {
  const raw = await fs.readFile(storeFile, 'utf8')
  const parsed = JSON.parse(raw)
  const migrated = migrateAppealsStore(parsed)
  if (parsed.version !== migrated.version || parsed.schema !== migrated.schema) {
    await writeStore(migrated)
  }
}

async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true })
  const migrated = migrateAppealsStore(store)
  const tempFile = `${storeFile}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    await fs.writeFile(tempFile, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8')
    await fs.rename(tempFile, storeFile)
  } catch (error) {
    await fs.rm(tempFile, { force: true })
    throw error
  }
}

function mutateStore(mutator) {
  const operation = storeMutationQueue.then(async () => {
    const store = await readStore()
    const value = await mutator(store)
    const nextStore = value?.nextStore ?? store
    nextStore.updatedAt = new Date().toISOString()
    await writeStore(nextStore)
    return value?.nextStore ? value.result : value
  })
  storeMutationQueue = operation.catch(() => {})
  return operation
}

function assertUniqueAppealIds(existingRecords, newRecords) {
  const ids = new Set(existingRecords.map((record) => record.id).filter(Boolean))
  for (const record of newRecords) {
    if (ids.has(record.id)) {
      const error = new Error(`appeal id already exists: ${record.id}`)
      error.statusCode = 409
      throw error
    }
    ids.add(record.id)
  }
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

function getFilters(query = {}) {
  return {
    from: cleanQueryValue(query.from),
    to: cleanQueryValue(query.to),
    applicant: cleanQueryValue(query.applicant),
    department: cleanQueryValue(query.department),
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
