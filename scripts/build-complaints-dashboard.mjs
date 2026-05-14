import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  buildDashboardData,
  normalizeExcelRows,
  readExcelRows,
} from './complaints-parser.mjs'

const projectRoot = process.cwd()
const sourceFile = path.join(projectRoot, 'statistic.xls')
const dashboardOutputFile = path.join(
  projectRoot,
  'src/features/dashboard/data/complaints-dashboard.json'
)
const storeOutputFile = path.join(projectRoot, 'data/complaints-store.json')

const rows = readExcelRows(sourceFile)
const records = normalizeExcelRows(rows, {
  sourceFile: 'statistic.xls',
  importId: 'initial-statistic-xls',
})
const dashboard = buildDashboardData(records, { sourceFile: 'statistic.xls' })
const existingStore = await readExistingStore()
const manualRecords =
  existingStore?.records?.filter((record) => record.origin === 'manual') ?? []
const now = new Date().toISOString()
const store = {
  version: 1,
  updatedAt: now,
  imports: [
    ...(existingStore?.imports ?? []).filter(
      (item) => item.id !== 'initial-statistic-xls'
    ),
    {
      id: 'initial-statistic-xls',
      filename: 'statistic.xls',
      uploadedAt: now,
      rowsCount: records.length,
    },
  ],
  records: [...records, ...manualRecords],
}

await fs.mkdir(path.dirname(dashboardOutputFile), { recursive: true })
await fs.writeFile(
  dashboardOutputFile,
  `${JSON.stringify(dashboard, null, 2)}\n`,
  'utf8'
)

await fs.mkdir(path.dirname(storeOutputFile), { recursive: true })
await fs.writeFile(storeOutputFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8')

console.log(
  `Built complaints dashboard data: ${dashboard.total} records, ${dashboard.byProfile.length} profiles, ${dashboard.bySource.length} sources`
)

async function readExistingStore() {
  try {
    return JSON.parse(await fs.readFile(storeOutputFile, 'utf8'))
  } catch {
    return null
  }
}
