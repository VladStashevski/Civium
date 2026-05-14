import XLSX from 'xlsx'

export const COLUMNS = {
  id: '№ РК',
  registeredAt: 'Дата рег.',
  content: 'Содержание',
  correspondent: 'Корр./Подписал',
  rubric: 'Рубрика',
  supportDocument: 'Сопровод. документ',
  recipient: 'Кому',
}

export function readExcelRows(filePathOrBuffer) {
  const workbook =
    filePathOrBuffer instanceof Buffer
      ? XLSX.read(filePathOrBuffer, { type: 'buffer', cellDates: false })
      : XLSX.readFile(filePathOrBuffer, { cellDates: false })

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

export function normalizeExcelRows(rows, options = {}) {
  return rows
    .map((row, index) =>
      normalizeRecord(row, {
        origin: 'excel',
        sourceFile: options.sourceFile ?? '',
        importId: options.importId ?? '',
        rowNumber: index + 2,
      })
    )
    .filter((record) => record.id || record.content)
}

export function normalizeManualRecord(input) {
  const now = new Date().toISOString()
  const id = clean(input.id) || `manual-${Date.now()}`
  const registeredAt = normalizeManualDate(input.registeredAt)
  const content = clean(input.content)
  const correspondent = clean(input.correspondent)
  const rawRubric = clean(input.rawRubric)
  const supportDocument = clean(input.supportDocument)
  const recipient = clean(input.recipient) || 'Не указан'
  const parsedCorrespondent = parseCorrespondent(correspondent)
  const profile = clean(input.profile) || normalizeRubric(rawRubric) || classifyProfile(content)
  const source = clean(input.source) || parseSource({ id, supportDocument })

  return {
    uid: `manual:${id}`,
    id,
    registeredAt,
    dateIso: parseFlexibleDate(registeredAt),
    content,
    correspondent: parsedCorrespondent.name,
    location: clean(input.location) || parsedCorrespondent.location,
    profile,
    intent: clean(input.intent) || classifyIntent(content, rawRubric),
    source,
    isChiefDoctor: source === 'Обращение к главному врачу',
    isRedirected: Boolean(supportDocument),
    recipient,
    rawRubric,
    origin: 'manual',
    sourceFile: '',
    importId: '',
    rowNumber: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildDashboardData(records, metadata = {}) {
  const normalizedRecords = records
    .map((record) => ({
      ...record,
      uid: record.uid ?? `${record.origin ?? 'excel'}:${record.id}`,
      origin: record.origin ?? 'excel',
    }))
    .filter((record) => record.id || record.content)
    .sort((a, b) => {
      const dateCompare = clean(a.dateIso).localeCompare(clean(b.dateIso))
      return dateCompare || clean(a.id).localeCompare(clean(b.id))
    })

  const total = normalizedRecords.length
  const chiefDoctorCount = normalizedRecords.filter(
    (record) => record.isChiefDoctor
  ).length
  const redirectedCount = normalizedRecords.filter(
    (record) => record.isRedirected
  ).length

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: metadata.sourceFile ?? 'database',
    total,
    dateRange: getDateRange(normalizedRecords),
    summary: {
      chiefDoctorCount,
      redirectedCount,
      manualCount: normalizedRecords.filter((record) => record.origin === 'manual')
        .length,
      excelCount: normalizedRecords.filter((record) => record.origin === 'excel')
        .length,
      profileCount: countUnique(normalizedRecords.map((record) => record.profile)),
      sourceCount: countUnique(normalizedRecords.map((record) => record.source)),
      locationCount: countUnique(normalizedRecords.map((record) => record.location)),
      rubricMissingCount: normalizedRecords.filter((record) => !record.rawRubric)
        .length,
    },
    byMonth: groupByMonth(normalizedRecords),
    byProfile: topCounts(normalizedRecords, (record) => record.profile, 12),
    bySource: topCounts(normalizedRecords, (record) => record.source, 12),
    byLocation: topCounts(normalizedRecords, (record) => record.location, 12),
    byRecipient: topCounts(normalizedRecords, (record) => record.recipient, 8),
    byIntent: topCounts(normalizedRecords, (record) => record.intent, 10),
    recent: normalizedRecords.slice(-12).reverse(),
  }
}

function normalizeRecord(row, metadata) {
  const id = clean(row[COLUMNS.id])
  const registeredAt = clean(row[COLUMNS.registeredAt])
  const content = clean(row[COLUMNS.content])
  const correspondent = clean(row[COLUMNS.correspondent])
  const rawRubric = clean(row[COLUMNS.rubric])
  const supportDocument = clean(row[COLUMNS.supportDocument])
  const recipient = clean(row[COLUMNS.recipient]) || 'Не указан'
  const parsedCorrespondent = parseCorrespondent(correspondent)
  const source = parseSource({ id, supportDocument })
  const profile = normalizeRubric(rawRubric) || classifyProfile(content)

  return {
    uid: `${metadata.origin}:${id}`,
    id,
    registeredAt,
    dateIso: parseFlexibleDate(registeredAt),
    content,
    correspondent: parsedCorrespondent.name,
    location: parsedCorrespondent.location,
    profile,
    intent: classifyIntent(content, rawRubric),
    source,
    isChiefDoctor: isChiefDoctorAppeal(id, supportDocument),
    isRedirected: Boolean(supportDocument),
    recipient,
    rawRubric,
    origin: metadata.origin,
    sourceFile: metadata.sourceFile,
    importId: metadata.importId,
    rowNumber: metadata.rowNumber,
    createdAt: '',
    updatedAt: '',
  }
}

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeManualDate(value) {
  const text = clean(value)
  if (!text) return new Intl.DateTimeFormat('ru-RU').format(new Date())
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-')
    return `${day}.${month}.${year}`
  }
  return text
}

function parseFlexibleDate(value) {
  const text = clean(value)
  const ruMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (ruMatch) {
    const [, day, month, year] = ruMatch
    return `${year}-${month}-${day}`
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return text

  return ''
}

function normalizeRubric(value) {
  return clean(value).replace(/^\([^)]+\)\s*/, '').trim()
}

function parseCorrespondent(value) {
  const text = clean(value)
  if (!text) return { name: 'Не указан', location: 'Не указан' }

  const separator = text.lastIndexOf(' - ')
  if (separator === -1) return { name: text, location: 'Не указан' }

  return {
    name: text.slice(0, separator).trim() || 'Не указан',
    location: normalizeLocation(text.slice(separator + 3)),
  }
}

function normalizeLocation(value) {
  const location = clean(value)
    .replace(/^г\.\s*/i, '')
    .replace(/^город\s+/i, '')
    .replace(/,$/, '')
    .trim()

  if (!location) return 'Не указан'
  if (/сургут/i.test(location)) return 'Сургут'
  if (/нефтеюганск/i.test(location)) return 'Нефтеюганск'
  if (/нижневартовск/i.test(location)) return 'Нижневартовск'
  if (/пыть-?ях/i.test(location)) return 'Пыть-Ях'
  if (/ханты-мансийск/i.test(location)) return 'Ханты-Мансийск'
  return location
}

function parseSource({ id, supportDocument }) {
  const text = clean(supportDocument)
  if (!text && isChiefDoctorAppeal(id, supportDocument)) {
    return 'Обращение к главному врачу'
  }
  if (!text) return 'Источник не указан'

  const firstLine = text.split(/\s+Исх\.\s*№:/i)[0].trim()
  const separator = firstLine.lastIndexOf(' - ')
  return clean(separator === -1 ? firstLine : firstLine.slice(0, separator))
}

function isChiefDoctorAppeal(id, supportDocument) {
  return /^07\/19/i.test(clean(id)) && !clean(supportDocument)
}

function classifyProfile(content) {
  const text = content.toLowerCase()

  if (/жалоб|провер|расслед/.test(text)) return 'Жалобы и проверки качества'
  if (/мед\.?\s*док|медицинск\w*\s+док|выписк|эпикриз|протокол/.test(text)) {
    return 'Предоставление медицинской документации'
  }
  if (/налогов|вычет|справк/.test(text)) return 'Справки и налоговые документы'
  if (/лист(ок|ков)?\s+нетрудоспособ|больничн/.test(text)) {
    return 'Листки нетрудоспособности'
  }
  if (/страхов|омс|согаз|альфастрах/.test(text)) return 'Страховые обращения'
  if (/благодар/.test(text)) return 'Благодарности'
  if (/лечени|мед\.?\s*помощ|помощи/.test(text)) return 'Лечение и медицинская помощь'

  return 'Прочие обращения'
}

function classifyIntent(content, rubric) {
  const text = `${content} ${rubric}`.toLowerCase()

  if (/жалоб/.test(text)) return 'Жалоба'
  if (/благодар/.test(text)) return 'Благодарность'
  if (/провер|расслед/.test(text)) return 'Проверка'
  if (/выписк|эпикриз|протокол|мед\.?\s*док|медицинск\w*\s+док/.test(text)) {
    return 'Запрос документов'
  }
  if (/справк|налогов|вычет/.test(text)) return 'Запрос справки'
  if (/лист(ок|ков)?\s+нетрудоспособ|больничн/.test(text)) {
    return 'Лист нетрудоспособности'
  }
  if (/лекарств|препарат/.test(text)) return 'Лекарственное обеспечение'
  if (/квот|вмп|высокотехнолог/.test(text)) return 'ВМП и квоты'

  return 'Другое'
}

function countUnique(values) {
  return new Set(values.filter(Boolean)).size
}

function getDateRange(items) {
  const dates = items.map((item) => item.dateIso).filter(Boolean).sort()
  return {
    from: dates[0] ?? '',
    to: dates.at(-1) ?? '',
  }
}

function groupByMonth(items) {
  const grouped = new Map()

  for (const item of items) {
    const key = item.dateIso.slice(0, 7) || 'Не указано'
    const previous = grouped.get(key) ?? { month: key, count: 0 }
    previous.count += 1
    grouped.set(key, previous)
  }

  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function topCounts(items, getKey, limit) {
  const counts = new Map()
  const total = items.length

  for (const item of items) {
    const name = clean(getKey(item)) || 'Не указано'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      share: total ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}
