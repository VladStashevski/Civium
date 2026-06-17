import XLSX from 'xlsx'
import {
  APPEALS_CLASSIFIER_VERSION,
  APPEAL_SOURCES,
  APPEAL_SOURCE_NAMES as SOURCE_NAMES,
  OFFICIAL_RUBRICS,
  RUBRIC_ALIASES,
  THEMATIC_GROUPS,
} from './appeals-classifier.mjs'
import {
  normalizeExcelRows as normalizeStrictExcelRows,
} from './complaints-parser-strict.mjs'

export const STORE_VERSION = 7

const APPEAL_MODES = {
  chiefDoctor: 'chiefDoctor',
  external: 'external',
}

const REGISTRATION_ROUTES = {
  chiefDoctor: '07/19 — главный врач',
  department: '07-* — Депздрав Югры',
  governor: '01-* — Губернатор Югры',
  other: 'Другой контур регистрации',
}

const COLUMN_ALIASES = {
  id: ['№ РК', 'Номер РК', 'Рег. номер', 'Регистрационный номер'],
  registeredAt: ['Дата рег.', 'Дата регистрации', 'Дата поступления', 'Дата РК'],
  content: ['Содержание', 'Краткое содержание', 'Текст обращения'],
  correspondent: [
    'Корр./Подписал',
    'Корреспондент',
    'Заявитель',
    'Подписал',
    'ФИО Заявителя',
  ],
  rubricCode: ['Код рубрики'],
  rubric: ['Рубрика', 'Тематика', 'Категория', 'Имя рубрики'],
  supportDocument: [
    'Сопровод. документ',
    'Сопроводительный документ',
    'Текст первого поручения',
  ],
  recipient: ['Кому', 'Адресат', 'Получатель', 'Участники'],
  delivery: ['Вид доставки РК', 'Способ подачи', 'Вид доставки'],
  groupIndex: ['Группа документов - индекс'],
  groupDocuments: ['Группа документов'],
  siteAppealNumber: ['Номер обращения с сайта'],
  posMessageNumber: ['Сообщение ПОС №', 'Номер сообщения ПОС'],
  sourceSystem: ['От', 'Источник'],
  deadline: ['Срок', 'Контрольный срок', 'Срок исполнения', 'План (РК)'],
  completedAt: [
    'Дата исполнения',
    'Дата ответа',
    'Дата закрытия',
    'Исполнено',
    'Дата снятия с контроля',
    'Факт (РК)',
  ],
  response: ['Ответ', 'Результат рассмотрения', 'Резолюция'],
}

const MANUAL_FIELD_KEYS = [
  'department',
  'departments',
  'category',
  'responsible',
  'affectedPersonOverride',
  'caseId',
  'isJustified',
  'justified',
  'notes',
]

const DEPARTMENT_RULES = [
  ['инф. прием', 'Инфекционное приёмное отделение'],
  ['инф.прием', 'Инфекционное приёмное отделение'],
  ['инф. пр', 'Инфекционное приёмное отделение'],
  ['инф.пр', 'Инфекционное приёмное отделение'],
  ['инф. детск. прием', 'Инфекционное приёмное отделение'],
  ['инфекционн\\w*\\s+при[её]мн', 'Инфекционное приёмное отделение'],
  ['инф.№5', 'Инфекционное отделение №5'],
  ['ио5', 'Инфекционное отделение №5'],
  ['ио 5', 'Инфекционное отделение №5'],
  ['инфекционн\\w*\\s+отделени\\w*\\s*№\\s*5', 'Инфекционное отделение №5'],
  ['рао1', 'Отделение реанимации и анестезиологии №1'],
  ['рао 1', 'Отделение реанимации и анестезиологии №1'],
  ['рао3', 'Отделение реанимации и анестезиологии №3'],
  ['рао 3', 'Отделение реанимации и анестезиологии №3'],
  ['пр. хир', 'Хирургическое приёмное отделение'],
  ['хирургическ\\w*\\s+при[её]мн', 'Хирургическое приёмное отделение'],
  ['хир.№1', 'Хирургическое отделение №1'],
  ['хир №1', 'Хирургическое отделение №1'],
  ['хо№1', 'Хирургическое отделение №1'],
  ['хо1', 'Хирургическое отделение №1'],
  ['неврол', 'Неврологическое отделение'],
  ['\\bрао\\b|реанимац', 'Отделение реанимации и анестезиологии'],
  ['онкол', 'Онкологическое отделение'],
  ['\\bонк\\b', 'Онкологическое отделение'],
  ['проктол', 'Проктологическое отделение'],
  ['\\bинф\\b|инфекционн\\w*\\s+отделени', 'Инфекционное отделение №1'],
  ['\\bио\\b', 'Инфекционное отделение №1'],
  ['осмп', 'Отделение скорой медицинской помощи'],
  ['скор\\w+\\s+медицинск\\w+\\s+помощ', 'Отделение скорой медицинской помощи'],
  ['нефро', 'Нефрологическое отделение'],
  ['урол', 'Урологическое отделение'],
  ['пульм', 'Пульмонологическое отделение'],
  ['ревматол', 'Ревматологическое отделение'],
  ['ревмо', 'Ревматологическое отделение'],
  ['хирург', 'Хирургическое отделение №1'],
  ['члх', 'Отделение челюстно-лицевой хирургии'],
  ['челюстно-лицев', 'Отделение челюстно-лицевой хирургии'],
  ['лор', 'ЛОР-отделение'],
  ['оториноларинг', 'ЛОР-отделение'],
  ['сурдол', 'Сурдологическое отделение'],
  ['гемат', 'Гематологическое отделение'],
  ['эндокр', 'Эндокринологическое отделение'],
  ['аллергол', 'Центр аллергологии и иммунологии'],
  ['иммунол', 'Центр аллергологии и иммунологии'],
  ['офтальм', 'Офтальмологическое отделение'],
  ['гастро', 'Гастроэнтерологическое отделение'],
  ['сосуд', 'Отделение сосудистой хирургии'],
  ['терапевтическ\\w*\\s+отделени|\\bтер\\b', 'Терапевтическое отделение'],
]

const SERVICE_RUBRIC_NAMES = new Set(['Заявление', 'Письмо'])

const RUBRIC_BY_NAME = new Map(OFFICIAL_RUBRICS.map((rubric) => [rubric.name, rubric]))
const RUBRIC_BY_CODE = new Map(OFFICIAL_RUBRICS.map((rubric) => [rubric.code, rubric]))

const DEFAULT_CLASSIFIED_RUBRIC = RUBRIC_BY_NAME.get('Лечение и оказание медицинской помощи')

const RUBRIC_CLASSIFIER_RULES = [
  ['Благодарности, пожелания сотрудникам подведомственных учреждений', /благодар|спасибо|признательн|поощр/i, 100],
  ['Прекращение рассмотрения обращения', /прекращен\w*\s+рассмотрен|отзыв\s+обращен|отозван/i, 100],
  ['Лекарственное обеспечение', /лекарств|препарат|рецепт|льготн\w+\s+обеспеч|инсулин|таблет|медикамент/i, 95],
  ['Установление группы инвалидности, в том числе связанной с пребыванием на фронте. Вопросы медико-социальной экспертизы (МСЭ)', /мсэ\b|медико-социальн|групп[аы]?\s+инвалидност|инвалидн/i, 95],
  ['Квоты на оказание высокотехнологичной медицинской помощи', /\bвмп\b|квот|высокотехнолог/i, 95],
  ['Служба скорой и неотложной медицинской помощи', /скор\w+\s+(медицинск\w+\s+)?помощ|неотложн|\bсмп\b|бригада\s+скор/i, 95],
  ['Трудовые конфликты. Разрешение трудовых споров', /трудов\w+\s+(конфликт|спор)|увольнен|зарплат|сокращен|отстранен\w*\s+от\s+работ/i, 95],
  ['Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике', /вкк\b|врачебно-консультац|диагноз|диагност|консультац/i, 90],
  ['Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике', /военно-врачебн|годност\w*\s+к\s+воен|ввк\b/i, 90],
  ['Обязательное медицинское страхование', /\bомс\b|страхов\w+\s+медицинск|тфомс|согаз|капитал\s+мс/i, 90],
  ['Охрана здоровья взрослого населения', /диспансеризац|профилактик|вакцинац|иммунизац|профосмотр/i, 85],
  ['Охрана здоровья', /охран\w+\s+здоровь/i, 84],
  ['Работа медицинских учреждений и их сотрудников', /хамств|груб|оскорб|неэтичн|деонтолог|отношен\w+\s+к\s+больн/i, 85],
  ['Работа медицинских учреждений и их сотрудников', /оборудован|оснащени|мрт\b|кт\b|рентген|аппарат|материально-технич|финансиров|финансов\w+\s+обеспеч/i, 84],
  ['Требования и стандарты в сфере здравоохранения', /лиценз/i, 84],
  ['Работа медицинских учреждений и их сотрудников', /социальн\w+\s+поддержк\w+\s+медработ|медицинск\w+\s+работник|компенсац|подъ[её]мн/i, 84],
  ['Переподготовка и повышение квалификации медицинских работников', /переподготовк|повышени\w+\s+квалификац|обучени\w+\s+медицинск/i, 84],
  ['Лечение и оказание медицинской помощи', /\bпнд\b|психоневролог|психиатр|сняти\w+\s+с\s+учет/i, 84],
  ['Результаты рассмотрения обращения', /результат\w+\s+рассмотрен|ответ\s+на\s+обращен/i, 82],
  ['Результаты рассмотрения обращения', /истребован\w+\s+(дополнительн\w+\s+)?документ|дополнительн\w+\s+материал/i, 82],
  ['Обращение и производство лекарственных средств, медицинских изделий и биологически активных добавок', /производств\w+\s+(лекарств|медицинск\w+\s+издел)|биологически\s+активн\w+\s+добав|обращени\w+\s+лекарствен/i, 80],
  ['Работа медицинских учреждений и их сотрудников', /работ\w+\s+(медицинск|больниц|поликлиник|учрежден)|сотрудник|персонал|кадр|коллектив/i, 75],
  ['Требования и стандарты в сфере здравоохранения', /стандарт|требован|порядок\s+оказан|клиническ\w+\s+рекомендац/i, 74],
  ['Обеспечение потребности в медицинской помощи и объёмов её получения', /обеспечен\w+\s+потребност|объ[её]м\w*\s+.*медицинск|доступност\w*\s+медицинск/i, 72],
  ['Помещение в больницы и специализированные лечебные учреждения. Оплата за лечение, пребывание в лечебных учреждениях', /госпитализац|помещени\w+\s+в\s+больниц|оплат\w*\s+за\s+лечен|пребывани\w+\s+в\s+лечебн/i, 71],
  ['Лечение и оказание медицинской помощи', /мед\.?документац|медицинск\w+\s+документ|выписк|справк|истори[яи]\s+болезн|эпикриз|гистолог|исследован|лечение|медицинск\w+\s+помощ|госпитализац|операц|обследован/i, 70],
]

export function readAppealExcelRows(filePathOrBuffer) {
  const workbook =
    filePathOrBuffer instanceof Buffer
      ? XLSX.read(filePathOrBuffer, { type: 'buffer', cellDates: false })
      : XLSX.readFile(filePathOrBuffer, { cellDates: false })

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return sheetToRowsWithDetectedHeader(sheet)
}

export function normalizeAppealExcelRows(rows, options = {}) {
  return rows
    .map((row, index) => {
      const strictRecord =
        normalizeStrictExcelRows([row], {
          ...options,
          rowNumber: Number(row.__rowNumber) || index + 2,
        })[0] ?? {}
      return normalizeAppealRow(row, {
        ...options,
        strictRecord,
        rowNumber: Number(row.__rowNumber) || index + 2,
      })
    })
    .filter((record) => record.id || record.content)
}

export function migrateAppealsStore(store = {}) {
  const now = new Date().toISOString()
  const records = Array.isArray(store.records) ? store.records : []

  const migratedRecords = records.map(migrateRecord)

  return {
    version: STORE_VERSION,
    schema: 'civium-appeals-store',
    updatedAt: store.updatedAt ?? now,
    imports: Array.isArray(store.imports) ? store.imports : [],
    records: migratedRecords,
    references: buildReferenceData(migratedRecords),
  }
}

export function createAppealsStore(records, imports = []) {
  const now = new Date().toISOString()
  const migratedRecords = records.map((record) => ({
    ...migrateRecord(record),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
  }))

  return {
    version: STORE_VERSION,
    schema: 'civium-appeals-store',
    updatedAt: now,
    imports,
    records: migratedRecords,
    references: buildReferenceData(migratedRecords),
  }
}

export function mergeExcelRowsIntoStore(store, rows, importMeta) {
  const currentStore = migrateAppealsStore(store)
  const now = new Date().toISOString()
  const importedRows = normalizeAppealExcelRows(rows, importMeta)
  const importedByKey = new Map()
  let duplicateCount = 0

  for (const record of importedRows) {
    const key = getRecordKey(record)
    const previousImported = importedByKey.get(key)
    if (previousImported) {
      duplicateCount += 1
      importedByKey.set(key, {
        ...previousImported,
        ...record,
        duplicateRowNumbers: [
          ...(previousImported.duplicateRowNumbers ?? [previousImported.rowNumber]),
          record.rowNumber,
        ].filter(Boolean),
      })
      continue
    }
    importedByKey.set(key, record)
  }

  const importedRecords = [...importedByKey.values()]
  const existingByKey = new Map(
    currentStore.records
      .filter((record) => record.origin === 'excel')
      .map((record) => [getRecordKey(record), record])
  )

  let addedCount = 0
  let updatedCount = 0
  let preservedManualFieldsCount = 0

  const importedKeys = new Set()
  const mergedImported = importedRecords.map((record) => {
    const key = getRecordKey(record)
    importedKeys.add(key)
    const previous = existingByKey.get(key)
    const manualFields = previous?.manualFields ?? {}
    if (previous) updatedCount += 1
    else addedCount += 1
    if (Object.keys(manualFields).length) preservedManualFieldsCount += 1

    return {
      ...record,
      manualFields,
      importHistory: [
        ...(previous?.importHistory ?? []),
        {
          importId: importMeta.importId,
          filename: importMeta.sourceFile,
          rowNumber: record.rowNumber,
          importedAt: now,
        },
      ],
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      lastSeenImportId: importMeta.importId,
    }
  })

  const manualRecords = currentStore.records.filter(
    (record) => record.origin !== 'excel'
  )
  const removedCount = currentStore.records.filter(
    (record) =>
      record.origin === 'excel' && !importedKeys.has(getRecordKey(record))
  ).length

  const nextStore = {
    ...currentStore,
    updatedAt: now,
    imports: [
      ...currentStore.imports,
      {
        id: importMeta.importId,
        filename: importMeta.sourceFile,
        storedFilename: importMeta.storedFilename,
        uploadedAt: now,
        rowsCount: importedRows.length,
        uniqueRowsCount: importedRecords.length,
        duplicateCount,
        addedCount,
        updatedCount,
        removedCount,
        preservedManualFieldsCount,
      },
    ],
    records: [...mergedImported, ...manualRecords].sort(compareAppeals),
  }
  nextStore.references = buildReferenceData(nextStore.records)

  return {
    store: nextStore,
    importedRecords,
    importedRowsCount: importedRows.length,
    addedCount,
    updatedCount,
    removedCount,
    duplicateCount,
    preservedManualFieldsCount,
    keptExistingCount: manualRecords.length,
  }
}

export function buildReferenceData(records) {
  return {
    generatedAt: new Date().toISOString(),
    classifierVersion: APPEALS_CLASSIFIER_VERSION,
    rubrics: buildRubricReferences(records),
    themes: buildThematicGroupReferences(records),
    sources: buildSourceReferences(records),
    departments: buildNamedReferences(
      records,
      (record) => getEffectiveDepartments(record),
      {
        type: 'department',
        multiple: true,
      }
    ),
  }
}

function hasTableRubric(record) {
  const rubricName = normalizeRubricName(record.rawRubric)
  return Boolean(
    clean(record.rubricCode || extractRubricCode(record.rawRubric)) ||
      rubricName
  )
}

function sheetToRowsWithDetectedHeader(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  const headerIndex = findHeaderRowIndex(matrix)
  if (headerIndex === -1) {
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  }

  const headers = matrix[headerIndex].map(clean)
  return matrix
    .slice(headerIndex + 1)
    .map((row, index) => {
      const item = {}
      const seenHeaders = new Map()
      headers.forEach((header, cellIndex) => {
        assignHeaderValue(item, seenHeaders, header, row[cellIndex] ?? '')
      })
      item.__rowNumber = headerIndex + index + 2
      return item
    })
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== '__rowNumber' && clean(value))
    )
}

function assignHeaderValue(item, seenHeaders, header, value) {
  if (!header) return
  const count = seenHeaders.get(header) ?? 0
  seenHeaders.set(header, count + 1)
  const text = clean(value)

  if (!item[header] || text) {
    item[header] = item[header] || value
  }
  if (text && !clean(item[header])) {
    item[header] = value
  }
  if (count > 0) {
    item[`${header}_${count}`] = value
    if (!clean(item[header]) && text) item[header] = value
  }
}

function findHeaderRowIndex(matrix) {
  const aliases = new Set(
    Object.values(COLUMN_ALIASES)
      .flat()
      .map((value) => value.toLocaleLowerCase('ru-RU'))
  )

  let bestIndex = -1
  let bestScore = 0
  matrix.forEach((row, index) => {
    const score = row.reduce((count, cell) => {
      const header = clean(cell).toLocaleLowerCase('ru-RU')
      return aliases.has(header) ? count + 1 : count
    }, 0)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore >= 2 ? bestIndex : -1
}

function buildRubricReferences(records) {
  const rubrics = new Map(
    OFFICIAL_RUBRICS.map((rubric) => [
      rubric.name,
      {
        id: `rubric:${fingerprint(rubric.name)}`,
        key: fingerprint(rubric.name),
        code: rubric.code,
        codes: [rubric.code],
        name: rubric.name,
        theme: rubric.theme,
        groupCode: rubric.groupCode,
        aliases: [],
        rawValues: [],
        count: 0,
        years: {},
      },
    ])
  )

  for (const record of records) {
    const rubric = resolveOfficialRubric(
      record.rubricCanonicalName ||
        record.rubricName ||
        normalizeRubricName(record.rawRubric) ||
        record.profile,
      record.rubricCode || extractRubricCode(record.rawRubric)
    )
    if (!rubric) continue

    const item = rubrics.get(rubric.name)
    item.count += 1
    if (record.year) item.years[record.year] = (item.years[record.year] ?? 0) + 1
    addUnique(item.codes, record.rubricCode)
    addUnique(item.aliases, record.rubricName)
    addUnique(item.aliases, record.profile)
    addUnique(item.rawValues, record.rawRubric)
  }

  return OFFICIAL_RUBRICS.map((rubric) => rubrics.get(rubric.name))
}

function buildThematicGroupReferences(records) {
  const themes = new Map(
    THEMATIC_GROUPS.map((theme) => [
      theme.name,
      {
        id: `theme:${fingerprint(theme.name)}`,
        key: fingerprint(theme.name),
        code: theme.code,
        name: theme.name,
        description: theme.description,
        count: 0,
        years: {},
      },
    ])
  )

  for (const record of records) {
    const item = themes.get(record.rubricTheme)
    if (!item) continue
    item.count += 1
    if (record.year) item.years[record.year] = (item.years[record.year] ?? 0) + 1
  }

  return THEMATIC_GROUPS.map((theme) => themes.get(theme.name))
}

function buildSourceReferences(records) {
  const sources = new Map(
    APPEAL_SOURCES.map((source) => [
      source.name,
      {
        id: `source:${fingerprint(source.name)}`,
        key: fingerprint(source.name),
        name: source.name,
        status: source.status,
        count: 0,
        years: {},
      },
    ])
  )

  for (const record of records) {
    const name = canonicalizeAppealSource(
      record.sourceOrganization || record.documentSource || record.source
    )
    const item = sources.get(name)
    if (!item) continue
    item.count += 1
    if (record.year) item.years[record.year] = (item.years[record.year] ?? 0) + 1
  }

  return APPEAL_SOURCES.map((source) => sources.get(source.name))
}

function buildNamedReferences(records, getValue, options = {}) {
  const items = new Map()
  for (const record of records) {
    const values = options.multiple ? getValue(record) : [getValue(record)]
    for (const rawValue of values) {
      const name = clean(rawValue) || 'Не указан'
      const key = fingerprint(name)
      const item = items.get(key) ?? {
        id: `${options.type ?? 'reference'}:${key}`,
        key,
        name,
        count: 0,
        years: {},
      }
      item.count += 1
      if (record.year) item.years[record.year] = (item.years[record.year] ?? 0) + 1
      items.set(key, item)
    }
  }

  return [...items.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru')
  )
}

function addUnique(list, value) {
  const text = clean(value)
  if (text && !list.includes(text)) list.push(text)
}

export function buildAppealsAnalytics(records, filters = {}) {
  const appeals = filterAppeals(records.map(migrateRecord), filters)
  const total = appeals.length

  return {
    generatedAt: new Date().toISOString(),
    filters,
    total,
    dateRange: getDateRange(appeals),
    byYear: countList(appeals, (record) => String(record.year || 'Не указан')),
    byMonth: countList(appeals, (record) => record.month || 'Не указан'),
    bySource: countList(
      appeals.filter((record) => record.appealMode === APPEAL_MODES.external),
      (record) => record.sourceOrganization || record.documentSource || record.source
    ),
    byDelivery: countList(appeals, (record) => record.delivery || 'Не указан'),
    byChiefDoctorChannel: countList(
      appeals.filter((record) => record.appealMode === APPEAL_MODES.chiefDoctor),
      (record) => record.sourceChannel || record.delivery || 'Не указан'
    ),
    byDeadlineStatus: countList(appeals, (record) => record.deadlineStatus || 'unknown'),
    byDepartment: countList(appeals, (record) => getEffectiveDepartments(record), {
      multiple: true,
    }),
    byTheme: countList(appeals, (record) => record.rubricTheme || 'Тематика не указана'),
    byRubric: countList(
      appeals,
      (record) => record.rubricCanonicalName || 'Без рубрики'
    ),
    byJustified: countList(appeals, (record) => getJustificationLabel(record)),
    byResponsible: countList(
      appeals,
      (record) => record.manualFields?.responsible || 'Не указан'
    ),
    yearMonthMatrix: buildYearMonthMatrix(appeals),
    overdue: appeals
      .filter((record) => record.deadlineStatus === 'overdue')
      .map(toAppealSummary),
  }
}

export function buildAppealsGraph(records, filters = {}) {
  const appeals = filterAppeals(records.map(migrateRecord), filters)
  const nodes = new Map()
  const edges = new Map()

  for (const appeal of appeals) {
    addNode(nodes, {
      id: appeal.uid,
      type: 'appeal',
      label: appeal.id,
      data: toAppealSummary(appeal),
    })

    const applicantId = `applicant:${fingerprint(appeal.applicant?.name)}`
    addNode(nodes, {
      id: applicantId,
      type: 'applicant',
      label: appeal.applicant?.name || 'Не указан',
      data: {
        location: appeal.location,
        raw: appeal.correspondentRaw,
      },
    })
    addEdge(edges, applicantId, appeal.uid, 'submitted')

    for (const person of getEffectiveAffectedPeople(appeal)) {
      const personId = `person:${fingerprint(person.name)}`
      addNode(nodes, {
        id: personId,
        type: 'affectedPerson',
        label: person.name,
        data: {
          relation: person.relation,
          confidence: person.confidence,
        },
      })
      addEdge(edges, appeal.uid, personId, 'about')
    }

    for (const department of getEffectiveDepartments(appeal)) {
      const departmentId = `department:${fingerprint(department)}`
      addNode(nodes, {
        id: departmentId,
        type: 'department',
        label: department,
      })
      addEdge(edges, appeal.uid, departmentId, 'assigned_to')
    }

    const theme = appeal.rubricTheme || 'Тематика не указана'
    const themeId = `theme:${fingerprint(theme)}`
    addNode(nodes, {
      id: themeId,
      type: 'theme',
      label: theme,
    })
    addEdge(edges, appeal.uid, themeId, 'grouped_by_theme')

    const sourceId = `source:${fingerprint(appeal.documentSource || appeal.source)}`
    addNode(nodes, {
      id: sourceId,
      type: 'source',
      label: appeal.documentSource || appeal.source || 'Источник не указан',
    })
    addEdge(edges, sourceId, appeal.uid, 'routed')

    if (appeal.recipient && appeal.recipient !== 'Не указан') {
      const recipientId = `recipient:${fingerprint(appeal.recipient)}`
      addNode(nodes, {
        id: recipientId,
        type: 'recipient',
        label: appeal.recipient,
      })
      addEdge(edges, appeal.uid, recipientId, 'sent_to')
    }

    if (appeal.supportDocument) {
      const responseId = `document:${fingerprint(appeal.supportDocument)}`
      addNode(nodes, {
        id: responseId,
        type: 'document',
        label: appeal.supportDocument.split('\n')[0].slice(0, 120),
        data: {
          text: appeal.supportDocument,
        },
      })
      addEdge(edges, responseId, appeal.uid, 'source_document')
    }

    if (appeal.manualFields?.responsible) {
      const responsibleId = `responsible:${fingerprint(appeal.manualFields.responsible)}`
      addNode(nodes, {
        id: responsibleId,
        type: 'responsible',
        label: appeal.manualFields.responsible,
      })
      addEdge(edges, appeal.uid, responsibleId, 'responsible')
    }

    if (appeal.manualFields?.caseId) {
      const caseId = `case:${fingerprint(appeal.manualFields.caseId)}`
      addNode(nodes, {
        id: caseId,
        type: 'case',
        label: appeal.manualFields.caseId,
      })
      addEdge(edges, appeal.uid, caseId, 'part_of_case')
    }
  }

  addRepeatApplicantEdges(appeals, edges)
  addRepeatAffectedPersonEdges(appeals, edges)
  addSimilarContentEdges(appeals, edges)

  return {
    generatedAt: new Date().toISOString(),
    filters,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  }
}

export function getRecordKey(record) {
  // Ключ устойчив к переимпорту: № РК — регистрационный номер обращения,
  // он не меняется между выгрузками, поэтому ручные аннотации (manualFields)
  // переносятся на ту же запись даже если в новой таблице чуть иная дата.
  const year = record.year || inferYear(record)
  const id = clean(record.id || record.rkNumber || 'no-rk')
  return `${year}:${id}`
}

function normalizeAppealRow(row, metadata) {
  const strictRecord = metadata.strictRecord ?? {}
  const raw = normalizeRawRow(row)
  const id = clean(getRawField(raw, 'id') || strictRecord.id)
  const registeredAt = clean(getRawField(raw, 'registeredAt') || strictRecord.registeredAt)
  const dateIso = parseFlexibleDate(registeredAt) || strictRecord.dateIso || ''
  const year = Number(metadata.year || dateIso.slice(0, 4) || inferYearFromFile(metadata.sourceFile))
  const content = clean(getRawField(raw, 'content') || strictRecord.content)
  const correspondentRaw = clean(getRawField(raw, 'correspondent') || strictRecord.correspondent)
  const applicant = parseCorrespondent(correspondentRaw)
  const supportDocument = clean(
    getRawField(raw, 'supportDocument') || strictRecord.supportDocument
  )
  const recipient = clean(getRawField(raw, 'recipient') || strictRecord.recipient) || 'Не указан'
  const rawRubric = clean(getRawField(raw, 'rubric') || strictRecord.rawRubric)
  const rubricCode = clean(
    getRawField(raw, 'rubricCode') || extractRubricCode(rawRubric) || strictRecord.rubricCode
  )
  const rubricName = normalizeRubricName(rawRubric)
  const delivery = clean(getRawField(raw, 'delivery') || strictRecord.delivery)
  const groupIndex = clean(getRawField(raw, 'groupIndex') || strictRecord.groupIndex)
  const groupDocuments = clean(
    getRawField(raw, 'groupDocuments') || strictRecord.groupDocuments
  )
  const siteAppealNumber = clean(
    getRawField(raw, 'siteAppealNumber') || strictRecord.siteAppealNumber
  )
  const posMessageNumber = clean(
    getRawField(raw, 'posMessageNumber') || strictRecord.posMessageNumber
  )
  const sourceSystem = clean(getRawField(raw, 'sourceSystem') || strictRecord.sourceSystem)
  const deadlineRaw = clean(getRawField(raw, 'deadline'))
  const completedAtRaw = clean(getRawField(raw, 'completedAt'))
  const deadlineAt = parseFlexibleDate(deadlineRaw)
  const completedAt = parseFlexibleDate(completedAtRaw)
  const isDiscontinued = inferDiscontinued({
    rawRubric,
    content,
    strictRecord,
  })
  const departments = extractDepartments([content, rawRubric, recipient, supportDocument].join(' '))
  const profile = rubricName || strictRecord.profile || ''
  const category = classifyComplaintCategory({
    content,
    profile,
    documentTopic: strictRecord.documentTopic,
  })
  const affectedPeople = extractAffectedPeople(content)
  const tableRubric = resolveOfficialRubric(rubricName, rubricCode)
  const classifiedRubric = tableRubric
    ? null
    : classifyOfficialRubric({
        content,
        supportDocument,
        recipient,
        groupIndex,
        groupDocuments,
        delivery,
        sourceSystem,
      })
  const resolvedRubric = tableRubric ?? classifiedRubric.rubric
  const resolvedRubricCode = resolvedRubric.code
  const rubricSource = tableRubric ? 'table' : 'classified'
  const rubricCanonicalName = resolvedRubric.name
  const rubricTheme = getRubricTheme(rubricCanonicalName)
  const appealKey = `${year || 'unknown'}:${id || 'no-rk'}`
  const detectedDocumentSource = resolveAppealDocumentSource({
    id,
    supportDocument,
    recipient,
    groupIndex,
    groupDocuments,
    delivery,
    siteAppealNumber,
    posMessageNumber,
    sourceSystem,
    content,
  })
  const existingDocumentSource = canonicalizeAppealSource(
    strictRecord.documentSource || strictRecord.source
  )
  const documentSource = selectAppealSource(
    detectedDocumentSource,
    existingDocumentSource,
    hasSourceEvidence({
      supportDocument,
      sourceSystem,
      siteAppealNumber,
      posMessageNumber,
    })
  )
  const registration = resolveRegistration(id, groupIndex)
  const sourceOrganization =
    registration.appealMode === APPEAL_MODES.chiefDoctor
      ? SOURCE_NAMES.direct
      : documentSource

  return {
    ...strictRecord,
    uid: `excel:${appealKey}`,
    appealKey,
    id,
    rkNumber: id,
    year,
    month: dateIso ? dateIso.slice(0, 7) : '',
    registeredAt,
    dateIso,
    content,
    correspondent: applicant.name,
    correspondentRaw,
    applicant,
    affectedPeople,
    location: applicant.location,
    profile: rubricCanonicalName || 'Без рубрики',
    rubricSource,
    intent: strictRecord.intent || rubricCanonicalName || category,
    source: sourceOrganization,
    sourceOrganization,
    sourceChannel: delivery || 'Не указан',
    appealMode: registration.appealMode,
    registrationRoute: registration.registrationRoute,
    recipient,
    rawRubric,
    rubricCode: resolvedRubricCode,
    rubricName: rubricCanonicalName,
    rubricCanonicalName,
    rubricTheme,
    rubricClassification: tableRubric
      ? null
      : {
          method: classifiedRubric.method,
          score: classifiedRubric.score,
          matchedRule: classifiedRubric.matchedRule,
        },
    supportDocument,
    groupIndex,
    groupDocuments,
    delivery,
    siteAppealNumber,
    posMessageNumber,
    sourceSystem,
    documentSource,
    documentTopic: strictRecord.documentTopic || category,
    officialCategory: category,
    departments,
    deadlineRaw,
    deadlineAt,
    completedAtRaw,
    completedAt,
    deadlineStatus: getDeadlineStatus({ deadlineAt, completedAt, isDiscontinued }),
    raw,
    normalized: {
      applicant,
      affectedPeople,
      departments,
      category,
      deadlineAt,
      completedAt,
      deadlineStatus: getDeadlineStatus({ deadlineAt, completedAt, isDiscontinued }),
    },
    origin: 'excel',
    sourceFile: metadata.sourceFile ?? '',
    importId: metadata.importId ?? '',
    rowNumber: metadata.rowNumber,
    manualFields: {},
    createdAt: '',
    updatedAt: '',
  }
}

function migrateRecord(record) {
  const dateIso = record.dateIso || parseFlexibleDate(record.registeredAt)
  const year = Number(record.year || dateIso.slice(0, 4) || inferYear(record))
  const applicant =
    record.applicant ??
    parseCorrespondent(record.correspondentRaw || record.correspondent || '')
  const content = clean(record.content)
  const rawRubric = clean(record.rawRubric)
  const rawRubricCode = clean(extractRubricCode(rawRubric))
  const rawRubricName = clean(normalizeRubricName(rawRubric))
  const hasTableRubricValue =
    record.rubricSource === 'table' || Boolean(rawRubricCode || rawRubricName)
  const tableRubricCode = hasTableRubricValue
    ? clean(record.rubricCode || rawRubricCode)
    : ''
  const tableRubricName = hasTableRubricValue
    ? clean(record.rubricName || rawRubricName)
    : ''
  const supportDocument = clean(record.supportDocument)
  const departments =
    Array.isArray(record.departments) && record.departments.length
      ? record.departments
      : extractDepartments([content, rawRubric, supportDocument].join(' '))
  const category =
    record.officialCategory ??
    classifyComplaintCategory({
      content,
      profile: record.profile,
      documentTopic: record.documentTopic,
    })
  const tableRubric = hasTableRubricValue
    ? resolveOfficialRubric(tableRubricName, tableRubricCode)
    : null
  const classifiedRubric = tableRubric
    ? null
    : classifyOfficialRubric({
        content,
        supportDocument,
        recipient: record.recipient,
        groupIndex: record.groupIndex,
        groupDocuments: record.groupDocuments,
        delivery: record.delivery,
        sourceSystem: record.sourceSystem,
      })
  const resolvedRubric = tableRubric ?? classifiedRubric.rubric
  const rubricCode = resolvedRubric.code
  const rubricName = resolvedRubric.name
  const rubricCanonicalName = resolvedRubric.name
  const rubricTheme = getRubricTheme(rubricCanonicalName)
  const rubricSource = tableRubric ? 'table' : 'classified'
  const isDiscontinued = inferDiscontinued({
    rawRubric,
    content,
    strictRecord: record,
  })
  const detectedDocumentSource = resolveAppealDocumentSource({
    id: record.id || record.rkNumber,
    supportDocument,
    recipient: record.recipient,
    groupIndex: record.groupIndex,
    groupDocuments: record.groupDocuments,
    delivery: record.delivery,
    siteAppealNumber: record.siteAppealNumber,
    posMessageNumber: record.posMessageNumber,
    sourceSystem: record.sourceSystem,
    content,
  })
  const existingDocumentSource = canonicalizeAppealSource(
    record.documentSource || record.source
  )
  const documentSource = selectAppealSource(
    detectedDocumentSource,
    existingDocumentSource,
    hasSourceEvidence({
      supportDocument,
      sourceSystem: record.sourceSystem,
      siteAppealNumber: record.siteAppealNumber,
      posMessageNumber: record.posMessageNumber,
    })
  )
  const registration = resolveRegistration(
    record.id || record.rkNumber,
    record.groupIndex
  )
  const sourceOrganization =
    registration.appealMode === APPEAL_MODES.chiefDoctor
      ? SOURCE_NAMES.direct
      : documentSource
  // Формат ключа пересчитываем всегда (миграция со старого `год:№РК:дата`),
  // чтобы uid/appealKey были стабильны между выгрузками.
  const appealKey = `${year || 'unknown'}:${record.id || record.rkNumber || 'no-rk'}`

  return {
    ...record,
    uid: `${record.origin ?? 'excel'}:${appealKey}`,
    appealKey,
    id: record.id ?? record.rkNumber ?? '',
    rkNumber: record.rkNumber ?? record.id ?? '',
    year,
    month: record.month ?? (dateIso ? dateIso.slice(0, 7) : ''),
    dateIso,
    applicant,
    correspondent: record.correspondent ?? applicant.name,
    correspondentRaw: record.correspondentRaw ?? record.correspondent ?? '',
    location: record.location ?? applicant.location,
    affectedPeople: Array.isArray(record.affectedPeople)
      ? record.affectedPeople
      : extractAffectedPeople(content),
    officialCategory: category,
    profile: rubricCanonicalName || 'Без рубрики',
    rubricCode,
    rubricName,
    rubricCanonicalName,
    rubricTheme,
    rubricSource,
    rubricClassification: tableRubric
      ? null
      : {
          method: classifiedRubric.method,
          score: classifiedRubric.score,
          matchedRule: classifiedRubric.matchedRule,
        },
    source: sourceOrganization,
    sourceOrganization,
    sourceChannel: clean(record.delivery) || 'Не указан',
    appealMode: registration.appealMode,
    registrationRoute: registration.registrationRoute,
    documentSource,
    departments,
    status: undefined,
    deadlineStatus:
      record.deadlineStatus ??
      getDeadlineStatus({
        deadlineAt: record.deadlineAt,
        completedAt: record.completedAt,
        isDiscontinued,
      }),
    raw: record.raw ?? {},
    normalized: {
      ...(record.normalized ?? {}),
      applicant,
      affectedPeople: record.affectedPeople ?? extractAffectedPeople(content),
      departments,
      category,
    },
    manualFields: record.manualFields ?? {},
    origin: record.origin ?? 'excel',
  }
}

function normalizeRawRow(row) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key !== '__rowNumber')
      .map(([key, value]) => [clean(key), clean(value)])
  )
}

function getRawField(raw, aliasKey) {
  const aliases = COLUMN_ALIASES[aliasKey] ?? []
  for (const alias of aliases) {
    if (raw[alias]) return raw[alias]
  }

  const loweredAliases = aliases.map((alias) => normalizeHeaderKey(alias))
  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = normalizeHeaderKey(key)
    if (loweredAliases.includes(lowerKey)) return value
  }

  if (aliasKey === 'deadline') return findRawValue(raw, /(срок|контрол)/i)
  if (aliasKey === 'completedAt') {
    return findRawValue(raw, /(дата.*(исполн|ответ|закр)|исполнено|сняти.*контрол)/i)
  }

  return ''
}

function normalizeHeaderKey(value) {
  return clean(value)
    .replace(/_\d+$/, '')
    .toLocaleLowerCase('ru-RU')
}

function findRawValue(raw, pattern) {
  const entry = Object.entries(raw).find(([key, value]) => pattern.test(key) && value)
  return entry?.[1] ?? ''
}

function extractRubricCode(value) {
  return clean(value).match(/^\(([^)]+)\)/)?.[1] ?? ''
}

function normalizeRubricName(value) {
  const name = clean(value).replace(/^\([^)]+\)\s*/, '').trim()
  return SERVICE_RUBRIC_NAMES.has(name) ? '' : name
}

function classifyOfficialRubric(input = {}) {
  const text = [
    input.content,
    input.supportDocument,
    input.recipient,
    input.groupIndex,
    input.groupDocuments,
    input.delivery,
    input.sourceSystem,
  ]
    .map(clean)
    .join(' ')
    .toLocaleLowerCase('ru-RU')
  const candidates = []

  for (const [name, pattern, score] of RUBRIC_CLASSIFIER_RULES) {
    if (pattern.test(text)) {
      candidates.push({
        rubric: getOfficialRubric(name),
        score,
        matchedRule: name,
      })
    }
  }

  candidates.push(...classifyCareContext(text))

  const best = candidates
    .filter((candidate) => candidate.rubric)
    .sort((a, b) => b.score - a.score || a.rubric.name.localeCompare(b.rubric.name, 'ru'))[0]

  if (best) {
    return {
      rubric: best.rubric,
      method: 'rules',
      score: best.score,
      matchedRule: best.matchedRule,
    }
  }

  return {
    rubric: DEFAULT_CLASSIFIED_RUBRIC ?? OFFICIAL_RUBRICS[0],
    method: 'default',
    score: 1,
    matchedRule: 'default-medical-care',
  }
}

function classifyCareContext(text) {
  const candidates = []
  const isChild = /реб[её]н|дет(ск|ям|ей|и)|младен|новорож|подрост/.test(text)
  const isStationary = /стационар|госпитал|больниц|отделени|операц|хирург|реанимац|рао\b|хо\s*№?|онко|неврол|урол|члх/i.test(text)
  const isAmbulatory = /амбулатор|поликлин|при[её]м|консультац|запис\w*\s+к\s+врач/i.test(text)
  const isQuality = /жалоб|претензи|качеств|некачеств|ненадлежащ|отказ|не\s+оказан|нарушен|диагноз|лечение/i.test(text)
  const isOrganization = /организац|порядок|маршрут|очеред|график|запис|срок|доступност/i.test(text)

  if (isChild && isStationary && isQuality) {
    candidates.push(candidate('Качество оказания медицинской помощи детям в стационарных условиях', 88))
  }
  if (isChild && isAmbulatory && isQuality) {
    candidates.push(candidate('Качество оказания медицинской помощи детям в амбулаторно-поликлинических условиях', 87))
  }
  if (isChild && isStationary && isOrganization) {
    candidates.push(candidate('Организация оказания медицинской помощи детям в стационарных условиях', 84))
  }
  if (isChild && isAmbulatory) {
    candidates.push(candidate('Оказание медицинской помощи детям в амбулаторно-поликлинических условиях', 83))
  }
  if (isStationary && isOrganization) {
    candidates.push(
      candidate(
        'Помещение в больницы и специализированные лечебные учреждения. Оплата за лечение, пребывание в лечебных учреждениях',
        82
      )
    )
  }
  if (isAmbulatory && isOrganization) {
    candidates.push(candidate('Организация оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях', 82))
  }
  if (isStationary && isQuality) {
    candidates.push(candidate('Качество оказания медицинской помощи взрослым в стационарных условиях', 81))
  }
  if (isAmbulatory && isQuality) {
    candidates.push(candidate('Качество оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях', 81))
  }

  return candidates
}

function candidate(name, score) {
  return {
    rubric: getOfficialRubric(name),
    score,
    matchedRule: name,
  }
}

function getOfficialRubric(name) {
  return resolveOfficialRubric(name)
}

function getRubricTheme(name) {
  return resolveOfficialRubric(name)?.theme || THEMATIC_GROUPS[0].name
}

function resolveOfficialRubric(name, code = '') {
  const rubricCode = clean(code)
  const rubricName = clean(name)
  const codeMatch =
    RUBRIC_BY_CODE.get(rubricCode) ||
    (rubricCode === '0002.0014.0143.0387.0051'
      ? RUBRIC_BY_CODE.get('0002.0014.0143.0388.0051')
      : null)
  if (codeMatch) return codeMatch

  const canonicalName =
    RUBRIC_ALIASES[rubricName] ||
    RUBRIC_ALIASES[rubricName.toLocaleLowerCase('ru-RU')] ||
    rubricName
  return RUBRIC_BY_NAME.get(canonicalName) ?? null
}

function resolveAppealDocumentSource({
  id,
  supportDocument,
  groupIndex,
  siteAppealNumber,
  posMessageNumber,
  sourceSystem,
}) {
  const senderText = [supportDocument, sourceSystem]
    .map(clean)
    .join(' ')
    .toLocaleLowerCase('ru-RU')
  const idText = clean(id)
  const groupIndexText = clean(groupIndex)

  if (clean(siteAppealNumber) || clean(posMessageNumber)) {
    return SOURCE_NAMES.direct
  }
  if (/сообщение\s+пос|\bпос\b|платформ[а-яё]*\s+обратн[а-яё]*\s+связ/.test(senderText)) {
    return SOURCE_NAMES.direct
  }
  if (/сообщество\s+вк|вконтакте|\bvk\b|послушайте[, ]+\s*доктор|паблик/.test(senderText)) {
    return SOURCE_NAMES.direct
  }
  if (/альфа|согаз|капитал\s+мс|страхов|тфомс|тофомс|\bомс\b|обязательн[а-яё]*\s+медицинск[а-яё]*\s+страхован/.test(senderText)) {
    return SOURCE_NAMES.insurance
  }
  if (/минздрав|министерство\s+здравоохранения\s+(российской\s+федерации|рф)/.test(senderText)) {
    return SOURCE_NAMES.ministry
  }
  if (/управление\s+президента|администрац[а-яё]*\s+президента/.test(senderText)) {
    return SOURCE_NAMES.president
  }
  if (/аппарат\s+губернатора|правительств[а-яё]*\s+ханты-мансийского|губернатор/.test(senderText)) {
    return SOURCE_NAMES.governor
  }
  if (/департамент\s+здравоохранения|депздрав|паськов\s+роман/.test(senderText)) {
    return SOURCE_NAMES.department
  }
  if (/росздравнадзор|служб[а-яё]*\s+по\s+надзор|территориальн[а-яё]*\s+орган.*надзор/.test(senderText)) {
    return SOURCE_NAMES.oversight
  }
  if (/прокуратур/.test(senderText)) return SOURCE_NAMES.prosecutor
  if (/уполномоченн[а-яё]*\s+по\s+прав|общественн[а-яё]*\s+палат/.test(senderText)) {
    return SOURCE_NAMES.publicRights
  }
  if (senderText) return SOURCE_NAMES.unknown

  if (/^07\/19/i.test(idText) || /^07\/19/i.test(groupIndexText)) {
    return SOURCE_NAMES.chiefDoctor
  }
  if (/^01-ОГ/i.test(idText) || /^01\b|^01-/i.test(groupIndexText)) {
    return SOURCE_NAMES.governor
  }
  if (/^07-(ОГ|ЗИ|НО)/i.test(idText) || /^07\b/i.test(groupIndexText)) {
    return SOURCE_NAMES.department
  }

  return SOURCE_NAMES.unknown
}

function isResolvedSource(source) {
  return source && source !== SOURCE_NAMES.unknown
}

function selectAppealSource(detectedSource, existingSource, sourceEvidence) {
  if (sourceEvidence && isResolvedSource(detectedSource)) {
    return detectedSource
  }
  if (isResolvedSource(existingSource)) {
    return existingSource
  }
  if (isResolvedSource(detectedSource)) return detectedSource
  return existingSource
}

function hasSourceEvidence({
  supportDocument,
  sourceSystem,
  siteAppealNumber,
  posMessageNumber,
}) {
  return Boolean(
    clean(supportDocument) ||
      clean(sourceSystem) ||
      clean(siteAppealNumber) ||
      clean(posMessageNumber)
  )
}

function canonicalizeAppealSource(value) {
  const text = clean(value)
  if (!text) return SOURCE_NAMES.unknown
  const lower = text.toLocaleLowerCase('ru-RU')

  if (/департамент\s+здравоохранения|депздрав/.test(lower)) {
    return SOURCE_NAMES.department
  }
  if (/аппарат\s+губернатора|правительств\w*\s+ханты-мансийского|губернатор/.test(lower)) {
    return SOURCE_NAMES.governor
  }
  if (/минздрав|министерство\s+здравоохранения\s+(российской\s+федерации|рф)/.test(lower)) {
    return SOURCE_NAMES.ministry
  }
  if (/альфа|согаз|капитал\s+мс|страхов|тфомс|тофомс|\bомс\b/.test(lower)) {
    return SOURCE_NAMES.insurance
  }
  if (/прокуратур/.test(lower)) return SOURCE_NAMES.prosecutor
  if (/управление\s+президента|администрац\w*\s+президента/.test(lower)) {
    return SOURCE_NAMES.president
  }
  if (/главн\w+\s+врач|ссту/.test(lower)) {
    return SOURCE_NAMES.chiefDoctor
  }
  if (/росздравнадзор|роспотребнадзор|надзорн\w+\s+орган|служб\w*\s+по\s+надзор/.test(lower)) {
    return SOURCE_NAMES.oversight
  }
  if (/уполномоченн\w*\s+по\s+прав|общественн\w+\s+палат/.test(lower)) {
    return SOURCE_NAMES.publicRights
  }
  if (/пос\b|платформ\w+\s+обратн\w+\s+связ|вконтакте|\bvk\b|публичн\w+\s+интернет|личн\w+\s+при[её]м|\be-?mail\b|почт|епгу|заявител/.test(lower)) {
    return SOURCE_NAMES.direct
  }

  return SOURCE_NAMES.unknown
}

function resolveRegistration(id, groupIndex = '') {
  const idText = clean(id)
  const indexText = clean(groupIndex)

  if (/^07\/19/i.test(idText) || /^07\/19/i.test(indexText)) {
    return {
      appealMode: APPEAL_MODES.chiefDoctor,
      registrationRoute: REGISTRATION_ROUTES.chiefDoctor,
    }
  }
  if (/^07-(ОГ|ЗИ|НО)/i.test(idText) || /^07\b/i.test(indexText)) {
    return {
      appealMode: APPEAL_MODES.external,
      registrationRoute: REGISTRATION_ROUTES.department,
    }
  }
  if (/^01-/i.test(idText) || /^01\b|^01-/i.test(indexText)) {
    return {
      appealMode: APPEAL_MODES.external,
      registrationRoute: REGISTRATION_ROUTES.governor,
    }
  }
  return {
    appealMode: APPEAL_MODES.external,
    registrationRoute: REGISTRATION_ROUTES.other,
  }
}

function parseCorrespondent(value) {
  const text = clean(value)
  if (!text) return { name: 'Не указан', location: 'Не указан' }
  const separator = text.lastIndexOf(' - ')
  if (separator === -1) return { name: text, location: 'Не указан' }
  return {
    name: clean(text.slice(0, separator)) || 'Не указан',
    location: clean(text.slice(separator + 3)) || 'Не указан',
  }
}

function extractAffectedPeople(content) {
  const text = clean(content)
  const people = []
  const relationRe =
    /(?:на|о|об|про)\s+(мужа|жену|сына|дочь|мать|отца|брата|сестру|реб[её]нка|пациента|пациентку|гражданина|гражданку)\s+([А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+){0,2}(?:\s+[А-ЯЁ]\.[А-ЯЁ]\.)?)/gu
  for (const match of text.matchAll(relationRe)) {
    const name = clean(match[2]).replace(/\s+\d{2}\.\d{2}\.\d{4}.*$/, '')
    if (name && !people.some((person) => person.name === name)) {
      people.push({
        name,
        relation: match[1],
        confidence: 'pattern',
      })
    }
  }

  return people
}

function extractDepartments(text) {
  const lower = clean(text).toLocaleLowerCase('ru-RU')
  const found = []

  for (const [needle, department] of DEPARTMENT_RULES) {
    const pattern = new RegExp(needle, 'iu')
    if (!pattern.test(lower) || found.includes(department)) continue

    if (
      department === 'Инфекционное отделение №1' &&
      found.some((item) =>
        ['Инфекционное приёмное отделение', 'Инфекционное отделение №5'].includes(item)
      )
    ) {
      continue
    }
    if (
      department === 'Отделение реанимации и анестезиологии' &&
      found.some((item) => /^Отделение реанимации и анестезиологии №/.test(item))
    ) {
      continue
    }
    if (
      department === 'Хирургическое отделение №1' &&
      found.includes('Хирургическое приёмное отделение')
    ) {
      continue
    }

    found.push(department)
  }

  return found
}

function classifyComplaintCategory({ content, profile = '', documentTopic = '' }) {
  const topicText = clean(documentTopic).toLowerCase()
  const profileText = clean(profile).toLowerCase()
  if (/информац/.test(topicText)) return 'Обращения информационного характера'
  if (/благодар/.test(topicText) || /благодар/.test(profileText)) return 'Благодарность'
  if (/прекращен|отзыв/.test(topicText) || /прекращен|отзыв/.test(profileText)) {
    return 'Прекращение рассмотрения'
  }

  const text = [content, profile, documentTopic].map(clean).join(' ').toLowerCase()
  if (/лекарств|препарат|рецепт|льгот/.test(text)) return 'Лекарственное обеспечение'
  if (/этик|деонтолог|хам|груб|оскорб|отношен|поведен|конфликт/.test(text)) {
    return 'Этика и деонтология'
  }
  if (/организац|очеред|запис|регистрат|маршрут|график|госпитализац/.test(text)) {
    return 'Организация медицинской помощи'
  }
  if (/качеств|лечен|диагноз|обследован|операц|ненадлежащ|врач|медицинск/.test(text)) {
    return 'Качество оказания медицинской помощи'
  }
  return 'Иные обращения'
}

function inferDiscontinued({ rawRubric = '', content = '', strictRecord = {} }) {
  const text = [rawRubric, content, strictRecord.profile, strictRecord.documentTopic]
    .map(clean)
    .join(' ')
    .toLowerCase()
  return /прекращен|прекращение|отзыв|отозван/.test(text)
}

function getDeadlineStatus({ deadlineAt, completedAt, isDiscontinued }) {
  if (!deadlineAt) return 'unknown'
  if (isDiscontinued) return 'withdrawn'
  if (completedAt) return completedAt > deadlineAt ? 'closed_overdue' : 'closed_on_time'
  return new Date(`${deadlineAt}T23:59:59`).getTime() < Date.now()
    ? 'overdue'
    : 'in_progress'
}

function filterAppeals(records, filters = {}) {
  return records.filter((record) => {
    if (filters.from && record.dateIso && record.dateIso < filters.from) return false
    if (filters.to && record.dateIso && record.dateIso > filters.to) return false
    if (
      filters.applicant &&
      !clean(record.applicant?.name).toLowerCase().includes(clean(filters.applicant).toLowerCase())
    ) {
      return false
    }
    if (filters.department) {
      const departments = getEffectiveDepartments(record)
      if (!departments.includes(filters.department)) return false
    }
    return true
  })
}

function getEffectiveCategory(record) {
  return record.manualFields?.category || record.officialCategory || record.documentTopic || record.profile || 'Иные обращения'
}

function getEffectiveDepartments(record) {
  if (Array.isArray(record.manualFields?.departments)) {
    return record.manualFields.departments.length
      ? record.manualFields.departments
      : ['Не указано']
  }
  if (record.manualFields?.department) return [record.manualFields.department]
  return Array.isArray(record.departments) && record.departments.length
    ? record.departments
    : ['Не указано']
}

function getEffectiveAffectedPeople(record) {
  const override = clean(record.manualFields?.affectedPersonOverride)
  if (override) return [{ name: override, relation: 'manual', confidence: 'manual' }]
  return Array.isArray(record.affectedPeople) ? record.affectedPeople : []
}

function countList(records, getValue, options = {}) {
  const counts = new Map()
  for (const record of records) {
    const values = options.multiple ? getValue(record) : [getValue(record)]
    for (const value of values) {
      const key = clean(value) || 'Не указан'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      share: records.length ? Number(((count / records.length) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
}

function buildYearMonthMatrix(records) {
  const years = [...new Set(records.map((record) => record.year).filter(Boolean))].sort()
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))

  return months.map((month) => {
    const item = { month }
    for (const year of years) {
      item[year] = records.filter((record) => record.year === year && record.month?.endsWith(`-${month}`)).length
    }
    return item
  })
}

function addNode(nodes, node) {
  if (!nodes.has(node.id)) nodes.set(node.id, node)
}

function addEdge(edges, source, target, type, data) {
  const id = `${source}->${target}:${type}`
  if (!edges.has(id)) {
    edges.set(id, data ? { id, source, target, type, data } : { id, source, target, type })
  }
}

function addRepeatApplicantEdges(appeals, edges) {
  const byApplicant = new Map()
  for (const appeal of appeals) {
    const key = fingerprint(appeal.applicant?.name)
    if (!key || key === fingerprint('Не указан')) continue
    if (!byApplicant.has(key)) byApplicant.set(key, [])
    byApplicant.get(key).push(appeal)
  }

  for (const group of byApplicant.values()) {
    const sorted = group.slice().sort(compareAppeals)
    for (let index = 1; index < sorted.length; index += 1) {
      addEdge(edges, sorted[index - 1].uid, sorted[index].uid, 'same_applicant_repeat')
    }
  }
}

function addRepeatAffectedPersonEdges(appeals, edges) {
  const byPerson = new Map()
  for (const appeal of appeals) {
    for (const person of getEffectiveAffectedPeople(appeal)) {
      const key = fingerprint(person.name)
      if (!key || key === fingerprint('Не указан')) continue
      if (!byPerson.has(key)) byPerson.set(key, [])
      byPerson.get(key).push(appeal)
    }
  }

  for (const group of byPerson.values()) {
    const sorted = [...new Map(group.map((appeal) => [appeal.uid, appeal])).values()].sort(
      compareAppeals
    )
    for (let index = 1; index < sorted.length; index += 1) {
      addEdge(edges, sorted[index - 1].uid, sorted[index].uid, 'same_patient_repeat')
    }
  }
}

function addSimilarContentEdges(appeals, edges) {
  const byApplicant = new Map()
  const prepared = new Map(
    appeals.map((appeal) => [
      appeal.uid,
      {
        normalized: normalizeSimilarityText(appeal.content),
        tokens: new Set(tokenizeSimilarityText(appeal.content)),
      },
    ])
  )

  for (const appeal of appeals) {
    const key = fingerprint(appeal.applicant?.name)
    if (!key || key === fingerprint('Не указан')) continue
    if (!byApplicant.has(key)) byApplicant.set(key, [])
    byApplicant.get(key).push(appeal)
  }

  for (const group of byApplicant.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = prepared.get(group[leftIndex].uid)
        const right = prepared.get(group[rightIndex].uid)
        if (!left?.normalized || !right?.normalized) continue

        const exact = left.normalized === right.normalized && left.normalized.length >= 40
        const score = exact ? 1 : jaccardSimilarity(left.tokens, right.tokens)
        if (!exact && (left.tokens.size < 6 || right.tokens.size < 6 || score < 0.55)) {
          continue
        }

        addEdge(
          edges,
          group[leftIndex].uid,
          group[rightIndex].uid,
          'similar_content',
          { similarity: Number(score.toFixed(2)) }
        )
      }
    }
  }
}

function normalizeSimilarityText(value) {
  return clean(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeSimilarityText(value) {
  const stopWords = new Set([
    'вашего',
    'вашей',
    'который',
    'которая',
    'которые',
    'обращение',
    'обращения',
    'прошу',
    'здравствуйте',
    'спасибо',
  ])
  return normalizeSimilarityText(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !stopWords.has(token))
}

function jaccardSimilarity(left, right) {
  let intersection = 0
  for (const token of left) {
    if (right.has(token)) intersection += 1
  }
  const union = left.size + right.size - intersection
  return union ? intersection / union : 0
}

function toAppealSummary(record) {
  return {
    uid: record.uid,
    appealKey: record.appealKey,
    id: record.id,
    year: record.year,
    dateIso: record.dateIso,
    content: record.content,
    applicant: record.applicant?.name,
    location: record.location,
    profile: record.rubricCanonicalName || 'Без рубрики',
    rubricTheme: record.rubricTheme || 'Тематика не указана',
    rubricCode: record.rubricCode || '',
    rubricName: record.rubricName || '',
    rubricSource: record.rubricSource ?? 'missing',
    justified:
      record.manualFields?.isJustified === undefined
        ? null
        : Boolean(record.manualFields.isJustified),
    departments: getEffectiveDepartments(record),
    responsible: record.manualFields?.responsible ?? '',
    notes: record.manualFields?.notes ?? '',
    recipient: record.recipient ?? 'Не указан',
    source: record.documentSource || record.source,
  }
}

function getJustificationLabel(record) {
  const value = record.manualFields?.isJustified
  if (value === true) return 'Обоснованное'
  if (value === false) return 'Необоснованное'
  return 'Не определено'
}

function getDateRange(records) {
  const dates = records.map((record) => record.dateIso).filter(Boolean).sort()
  return { from: dates[0] ?? '', to: dates.at(-1) ?? '' }
}

function compareAppeals(left, right) {
  return (
    clean(left.dateIso).localeCompare(clean(right.dateIso)) ||
    clean(left.id).localeCompare(clean(right.id), 'ru') ||
    clean(left.uid).localeCompare(clean(right.uid))
  )
}

function inferYear(record) {
  return (
    Number(record.year) ||
    Number(clean(record.dateIso).slice(0, 4)) ||
    Number(clean(record.registeredAt).match(/\b(20\d{2})\b/)?.[1]) ||
    Number(inferYearFromFile(record.sourceFile))
  )
}

function inferYearFromFile(filename = '') {
  return clean(filename).match(/\b(20\d{2})\b/)?.[1] ?? ''
}

function parseFlexibleDate(value) {
  const text = clean(value)
  const ruMatch = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+\d{1,2}(?::\d{2}(?::\d{2})?)?)?$/
  )
  if (ruMatch) {
    const [, day, month, year] = ruMatch
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return text
  const serial = Number(text)
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const date = XLSX.SSF.parse_date_code(serial)
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  return ''
}

function fingerprint(value) {
  return clean(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/giu, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function pickManualFields(input = {}) {
  const manualFields = {}
  for (const key of MANUAL_FIELD_KEYS) {
    if (input[key] !== undefined) manualFields[key] = input[key]
  }
  if (input.manualFields && typeof input.manualFields === 'object') {
    Object.assign(manualFields, input.manualFields)
  }
  return manualFields
}
