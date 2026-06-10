import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import {
  buildDashboardData,
  normalizeManualRecord,
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

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: true,
})
await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})

app.get('/api/health', async () => ({ ok: true }))

app.post('/api/auth/login', async (request, reply) => {
  const email = String(request.body?.email ?? '').trim()
  const password = String(request.body?.password ?? '')

  if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) {
    return reply.code(401).send({ error: 'invalid credentials' })
  }

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

// NOTE: auth gate disabled for the new local admin (no login screen yet).
// Re-enable by restoring the onRequest session check + a login page.

app.get('/api/dashboard', async () => {
  const store = await readStore()
  return buildDashboardData(store.records, {
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

app.get('/api/references', async () => {
  const store = await readStore()
  return store.references ?? buildReferenceData(store.records)
})

app.get('/api/appeals', async (request) => {
  const store = await readStore()
  const limit = Math.min(Math.max(Number(request.query?.limit ?? 25), 1), 100000)
  const offset = Math.max(Number(request.query?.offset ?? 0), 0)
  const query = cleanQueryValue(request.query?.q).toLocaleLowerCase('ru-RU')
  const records = store.records
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
        record.manualFields?.responsible,
        record.manualFields?.notes,
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

app.post('/api/appeals', async (request, reply) => {
  const record = normalizeManualRecord(request.body ?? {})

  if (!record.content) {
    return reply.code(400).send({ error: 'content is required' })
  }

  const store = await readStore()
  store.records.push(record)
  store.updatedAt = new Date().toISOString()
  await writeStore(store)

  return reply.code(201).send({ item: record })
})

app.post('/api/appeals/bulk', async (request, reply) => {
  const items = Array.isArray(request.body?.items) ? request.body.items : []

  if (!items.length) {
    return reply.code(400).send({ error: 'items array is required and cannot be empty' })
  }

  const store = await readStore()
  const newRecords = items.map(item => normalizeManualRecord(item))
  
  store.records.push(...newRecords)
  store.updatedAt = new Date().toISOString()
  await writeStore(store)

  return reply.code(201).send({ count: newRecords.length })
})

app.patch('/api/appeals', async (request, reply) => {
  const { uid, id, appealKey, isJustified } = request.body ?? {}

  if (!uid && !id && !appealKey) {
    return reply.code(400).send({ error: 'uid, id or appealKey is required' })
  }

  const store = await readStore()
  const now = new Date().toISOString()
  const record = store.records.find((item) =>
    uid ? item.uid === uid : appealKey ? item.appealKey === appealKey : item.id === id
  )

  if (!record) {
    return reply.code(404).send({ error: 'appeal not found' })
  }

  const manualFields = pickManualFields(request.body ?? {})
  if (isJustified === null) {
    delete record.manualFields?.isJustified
    delete manualFields.isJustified
  } else if (isJustified !== undefined) {
    manualFields.isJustified = Boolean(isJustified)
  }
  for (const key of ['responsible', 'notes']) {
    if (request.body?.[key] !== undefined && !String(request.body[key]).trim()) {
      delete record.manualFields?.[key]
      delete manualFields[key]
    }
  }

  record.manualFields = {
    ...(record.manualFields ?? {}),
    ...manualFields,
  }
  record.updatedAt = now
  record.normalized = {
    ...(record.normalized ?? {}),
    manualUpdatedAt: now,
  }
  store.updatedAt = now
  await writeStore(store)

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

  await fs.mkdir(uploadDir, { recursive: true })
  await fs.writeFile(path.join(uploadDir, storedFilename), buffer)

  const rows = readAppealExcelRows(buffer)
  const store = await readStore()
  const now = new Date().toISOString()
  const merge = mergeExcelRowsIntoStore(store, rows, {
    importId,
    sourceFile: safeFilename,
    storedFilename,
  })
  await writeStore(merge.store)

  return {
    importId,
    uploadedAt: now,
    rowsCount: merge.importedRecords.length,
    addedCount: merge.addedCount,
    updatedCount: merge.updatedCount,
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
  const migrated = migrateAppealsStore(parsed)
  if (parsed.version !== migrated.version || parsed.schema !== migrated.schema) {
    await writeStore(migrated)
  }
  return migrated
}

async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true })
  const migrated = migrateAppealsStore(store)
  await fs.writeFile(storeFile, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8')
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
    status: cleanQueryValue(query.status),
  }
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
