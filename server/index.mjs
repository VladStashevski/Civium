import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import {
  buildDashboardData,
  normalizeExcelRows,
  normalizeManualRecord,
  readExcelRows,
} from '../scripts/complaints-parser.mjs'

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

app.get('/api/dashboard', async () => {
  const store = await readStore()
  return buildDashboardData(store.records, {
    sourceFile: store.imports.at(-1)?.filename ?? 'database',
  })
})

app.get('/api/appeals', async (request) => {
  const store = await readStore()
  const limit = Math.min(Number(request.query?.limit ?? 100), 500)

  return {
    items: store.records
      .slice()
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || b.id.localeCompare(a.id))
      .slice(0, limit),
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

  const rows = readExcelRows(buffer)
  const importedRecords = normalizeExcelRows(rows, {
    sourceFile: safeFilename,
    importId,
  })
  const store = await readStore()
  const manualRecords = store.records.filter((record) => record.origin === 'manual')
  const previousExcelById = new Map(
    store.records
      .filter((record) => record.origin === 'excel')
      .map((record) => [record.id, record])
  )
  const now = new Date().toISOString()
  const mergedExcelRecords = importedRecords.map((record) => {
    const previous = previousExcelById.get(record.id)

    return {
      ...record,
      uid: `excel:${record.id}`,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    }
  })

  store.records = [...mergedExcelRecords, ...manualRecords]
  store.imports.push({
    id: importId,
    filename: safeFilename,
    storedFilename,
    uploadedAt: now,
    rowsCount: importedRecords.length,
  })
  store.updatedAt = now
  await writeStore(store)

  return {
    importId,
    rowsCount: importedRecords.length,
    manualRecordsKept: manualRecords.length,
  }
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
    const initialStore = {
      version: 1,
      updatedAt: now,
      imports: initialRecords.length
        ? [
            {
              id: 'initial-statistic-xls',
              filename: 'statistic.xls',
              uploadedAt: now,
              rowsCount: initialRecords.length,
            },
          ]
        : [],
      records: initialRecords,
    }

    await writeStore(initialStore)
  }
}

async function readStore() {
  await ensureStore()
  const raw = await fs.readFile(storeFile, 'utf8')
  return JSON.parse(raw)
}

async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(storeFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

function sanitizeFilename(filename) {
  return filename.replace(/[^\p{L}\p{N}._-]+/gu, '_')
}

async function readInitialExcelRecords() {
  try {
    await fs.access(initialExcelFile)
    return normalizeExcelRows(readExcelRows(initialExcelFile), {
      sourceFile: 'statistic.xls',
      importId: 'initial-statistic-xls',
    })
  } catch {
    return []
  }
}
