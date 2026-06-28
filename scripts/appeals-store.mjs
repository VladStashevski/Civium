import XLSX from 'xlsx'
import {
  APPEALS_CLASSIFIER_VERSION,
  APPEAL_SOURCES,
  APPEAL_SOURCE_NAMES as SOURCE_NAMES,
  classifyOrganizationSource,
  OFFICIAL_RUBRICS,
  RUBRIC_ALIASES,
  THEMATIC_GROUPS,
} from './appeals-classifier.mjs'
import {
  normalizeExcelRows as normalizeStrictExcelRows,
} from './complaints-parser-strict.mjs'
import {
  DEPARTMENT_BY_NAME,
  DEPARTMENT_GROUPS,
  DEPARTMENT_OPTIONS,
  resolveDepartmentName,
} from './departments.mjs'

export const STORE_VERSION = 9

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

const MANUAL_TEXT_FIELD_KEYS = [
  'department',
  'category',
  'responsible',
  'affectedPersonOverride',
  'caseId',
  'notes',
  'issues',
]
const INSPECTION_VALUES = new Set(['vnk', 'service'])

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
    profiles: buildDepartmentProfileReferences(records),
    departments: buildDepartmentReferences(records),
  }
}

function buildDepartmentProfileReferences(records) {
  const profiles = new Map(
    DEPARTMENT_GROUPS.map((group) => [
      group.profile,
      {
        id: `department-profile:${fingerprint(group.profile)}`,
        key: fingerprint(group.profile),
        name: group.profile,
        short: group.short,
        count: 0,
        years: {},
        months: {},
      },
    ])
  )

  for (const record of records) {
    const recordProfiles = new Set(
      getEffectiveDepartments(record)
        .map((department) => DEPARTMENT_BY_NAME.get(resolveDepartmentName(department))?.profile)
        .filter(Boolean)
    )
    for (const profile of recordProfiles) {
      const item = profiles.get(profile)
      if (!item) continue
      item.count += 1
      incrementReferencePeriod(item, record)
    }
  }

  return DEPARTMENT_GROUPS.map((group) => profiles.get(group.profile))
}

function buildDepartmentReferences(records) {
  const departments = new Map(
    DEPARTMENT_OPTIONS.map((department) => [
      department.value,
      {
        id: `department:${fingerprint(department.value)}`,
        key: fingerprint(department.value),
        name: department.value,
        profile: department.profile,
        count: 0,
        years: {},
        months: {},
      },
    ])
  )

  for (const record of records) {
    for (const department of new Set(getEffectiveDepartments(record).map(resolveDepartmentName))) {
      const item = departments.get(department)
      if (!item) continue
      item.count += 1
      incrementReferencePeriod(item, record)
    }
  }

  return DEPARTMENT_OPTIONS.map((department) => departments.get(department.value))
}

function incrementReferencePeriod(item, record) {
  if (!record.year) return
  item.years[record.year] = (item.years[record.year] ?? 0) + 1
  const month = String(record.dateIso || '').slice(5, 7)
  if (!/^\d{2}$/.test(month)) return
  item.months[record.year] ??= {}
  item.months[record.year][month] = (item.months[record.year][month] ?? 0) + 1
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
        description: rubric.description,
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
  const sources = new Map()
  for (const record of records) {
    const name = resolveReferenceSourceName(record)
    const key = fingerprint(name)
    const item = sources.get(key) ?? {
      id: `source:${key}`,
      key,
      name,
      status: resolveSourceReferenceStatus(record),
      count: 0,
      years: {},
    }
    item.count += 1
    if (record.year) item.years[record.year] = (item.years[record.year] ?? 0) + 1
    sources.set(key, item)
  }

  return [...sources.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru')
  )
}

function resolveReferenceSourceName(record) {
  if (record.appealMode === APPEAL_MODES.chiefDoctor) {
    return clean(record.sourceChannel || record.delivery) || 'Не указан'
  }

  return (
    clean(record.sourceOrganizationDetail) ||
    clean(record.sourceOrganization) ||
    clean(record.documentSource) ||
    clean(record.source) ||
    SOURCE_NAMES.unknown
  )
}

function resolveSourceReferenceStatus(record) {
  if (record.appealMode === APPEAL_MODES.chiefDoctor) {
    return 'Источник поступления в контуре 07/19'
  }

  const source = canonicalizeAppealSource(
    record.sourceOrganization || record.documentSource || record.source
  )
  return APPEAL_SOURCES.find((item) => item.name === source)?.status ?? source
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

export function getRecordKey(record) {
  // Ключ устойчив к переимпорту: № РК — регистрационный номер обращения,
  // он не меняется между выгрузками, поэтому ручные аннотации (manualFields)
  // переносятся на ту же запись даже если в новой таблице чуть иная дата.
  const year = record.year || inferYear(record)
  return buildAppealKey({
    year,
    id: record.id || record.rkNumber,
    rowNumber: record.rowNumber,
    content: record.content,
  })
}

function buildAppealKey({ year, id, rowNumber, content }) {
  const safeYear = year || 'unknown'
  const rkNumber = clean(id)
  if (rkNumber) return `${safeYear}:${rkNumber}`

  const row = Number(rowNumber)
  if (Number.isFinite(row) && row > 0) return `${safeYear}:row-${row}`

  const contentKey = fingerprint(content).slice(0, 80)
  return `${safeYear}:content-${contentKey || 'no-rk'}`
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
  const appealKey = buildAppealKey({
    year,
    id,
    rowNumber: metadata.rowNumber,
    content,
  })
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
  const sourceOrganizationDetail = resolveAppealSourceOrganizationDetail({
    registration,
    documentSource,
    supportDocument,
    recipient,
    sourceSystem,
    delivery,
    siteAppealNumber,
    posMessageNumber,
  })

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
    sourceOrganizationDetail,
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
    documentSource,
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
  const sourceOrganizationDetail = resolveAppealSourceOrganizationDetail({
    registration,
    documentSource,
    supportDocument,
    recipient: record.recipient,
    sourceSystem: record.sourceSystem,
    delivery: record.delivery,
    siteAppealNumber: record.siteAppealNumber,
    posMessageNumber: record.posMessageNumber,
  })
  // Формат ключа пересчитываем всегда (миграция со старого `год:№РК:дата`),
  // чтобы uid/appealKey были стабильны между выгрузками.
  const appealKey = buildAppealKey({
    year,
    id: record.id || record.rkNumber,
    rowNumber: record.rowNumber,
    content,
  })

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
    sourceOrganizationDetail,
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
  recipient,
  groupIndex,
  siteAppealNumber,
  posMessageNumber,
  sourceSystem,
}) {
  const senderText = [supportDocument, sourceSystem]
    .map(clean)
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru-RU')
  const recipientText = clean(recipient).toLocaleLowerCase('ru-RU')
  const idText = clean(id)
  const groupIndexText = clean(groupIndex)
  const registration = resolveRegistration(idText, groupIndexText)
  const isChiefDoctor = registration.appealMode === APPEAL_MODES.chiefDoctor
  const hasDirectChannel =
    Boolean(clean(siteAppealNumber) || clean(posMessageNumber)) ||
    /сообщение\s+пос|\bпос\b|платформ[а-яё]*\s+обратн[а-яё]*\s+связ/.test(senderText) ||
    /сообщество\s+вк|вконтакте|\bvk\b|послушайте[, ]+\s*доктор|паблик/.test(senderText)

  // Орган-источник по сопроводительному документу — приоритетнее адресата
  // и контура регистрации.
  const organization = classifyOrganizationSource(senderText)
  if (organization) return organization

  // В PrintResult для внешних 07-* / 01-* источник часто лежит в «Кому»:
  // Депздрав Югры / Губернатор Югры. Не заменяем его на «сайт ОГВ».
  const recipientOrganization = classifyOrganizationSource(recipientText)
  if (recipientOrganization) return recipientOrganization

  // Особые каналы прямой подачи гражданином (сайт / ПОС / соцсети) считаем
  // direct только для 07/19. Для внешних 07-* / 01-* источник задаёт контур
  // или сопроводительный документ.
  if (hasDirectChannel && isChiefDoctor) return SOURCE_NAMES.direct

  // Сопроводиловка есть, но отправитель не распознан — честный «не определён»,
  // НЕ приписываем контуру регистрации (это и был баг с «Департаментом»).
  if (senderText) return SOURCE_NAMES.unknown

  // Сопроводительного органа нет — определяем по префиксу № РК / индексу группы
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

function resolveAppealSourceOrganizationDetail({
  registration,
  documentSource,
  supportDocument,
  recipient,
  sourceSystem,
  delivery,
  siteAppealNumber,
  posMessageNumber,
}) {
  const directDetail = resolveDirectSourceDetail({
    delivery,
    sourceSystem,
    siteAppealNumber,
    posMessageNumber,
  })

  if (registration.appealMode === APPEAL_MODES.chiefDoctor) {
    return directDetail
  }

  const concreteSource = [supportDocument, sourceSystem]
    .map(extractOrganizationSourceDetail)
    .find(isConcreteSourceDetail)
  if (concreteSource) return concreteSource

  const recipientSource = resolveRecipientSourceDetail(recipient, registration)
  if (recipientSource) return recipientSource

  if (documentSource === SOURCE_NAMES.direct) return directDetail
  if (isResolvedSource(documentSource) && documentSource !== SOURCE_NAMES.chiefDoctor) {
    return documentSource
  }
  return SOURCE_NAMES.unknown
}

function resolveDirectSourceDetail({
  delivery,
  sourceSystem,
  siteAppealNumber,
  posMessageNumber,
}) {
  const sourceText = clean(sourceSystem).toLocaleLowerCase('ru-RU')
  if (
    clean(posMessageNumber) ||
    /сообщение\s+пос|\bпос\b|платформ[а-яё]*\s+обратн[а-яё]*\s+связ/.test(sourceText)
  ) {
    return 'ПОС'
  }
  if (/сообщество\s+вк|вконтакте|\bvk\b|паблик/.test(sourceText)) {
    return 'ВКонтакте / социальные сети'
  }
  if (clean(siteAppealNumber)) return 'Единый сайт ОГВ'
  return clean(delivery) || SOURCE_NAMES.direct
}

function resolveRecipientSourceDetail(recipient, registration) {
  const text = clean(recipient)
  if (!text) return fallbackRegistrationSource(registration)

  const source = classifyOrganizationSource(text)
  if (source && source !== SOURCE_NAMES.regionalAuthority) return source

  const detail = extractOrganizationSourceDetail(text)
  if (isConcreteSourceDetail(detail)) return detail

  return fallbackRegistrationSource(registration)
}

function fallbackRegistrationSource(registration) {
  if (registration.registrationRoute === REGISTRATION_ROUTES.department) {
    return SOURCE_NAMES.department
  }
  if (registration.registrationRoute === REGISTRATION_ROUTES.governor) {
    return SOURCE_NAMES.governor
  }
  return ''
}

function extractOrganizationSourceDetail(value) {
  const text = clean(value)
  if (!text) return ''

  const known = normalizeKnownSourceDetail(text)
  if (known) return known

  const withoutDocumentMeta = text
    .replace(/\s[-–—]\s+Исх\.?.*$/iu, '')
    .replace(/\s[-–—]\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.?\s*[А-ЯЁ][а-яё-]+.*$/u, '')
    .replace(/\s[-–—]\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.?.*$/u, '')
    .replace(/\s+Исх\.?.*$/iu, '')
    .replace(/\s+исходящ[а-яё]*\s+№.*$/iu, '')
    .replace(/\s+(заместитель|директор|начальник|руководитель|председатель|врио|и\.?\s*о\.?).*$/iu, '')
    .trim()

  return normalizeKnownSourceDetail(withoutDocumentMeta) || withoutDocumentMeta
}

function normalizeKnownSourceDetail(value) {
  const text = clean(value)
  const lower = text.toLocaleLowerCase('ru-RU')
  if (!text) return ''

  if (/департамент\s+финансов\s+администрац[а-яё]*\s+г\.?\s*сургута/.test(lower)) {
    return 'Департамент финансов Администрации города Сургута'
  }
  if (/администрац[а-яё]*\s+(?:города\s+){0,2}г?\.?\s*сургут(?:а)?(?![а-яё])/.test(lower)) {
    return 'Администрация города Сургута'
  }
  if (/администрац[а-яё]*\s+сургутского\s+района/.test(lower)) {
    return 'Администрация Сургутского района'
  }
  if (/администрац[а-яё]*\s+(города\s+)?г?\.?\s*нижневартовска/.test(lower)) {
    return 'Администрация города Нижневартовска'
  }
  if (/департамент\s+внутренней\s+политики/.test(lower)) {
    return 'Департамент внутренней политики ХМАО-Югры'
  }
  if (/департамент\s+социального\s+развития|депсоцразвития/.test(lower)) {
    return 'Департамент социального развития ХМАО-Югры'
  }
  if (/департамент\s+труда\s+и\s+занятости/.test(lower)) {
    return 'Департамент труда и занятости населения ХМАО-Югры'
  }
  if (/министерство\s+здравоохранения\s+(российской\s+федерации|рф)|минздрав\s+росси/.test(lower)) {
    return 'Министерство здравоохранения Российской Федерации (Минздрав России)'
  }
  if (/департамент\s+здравоохранения\s+(ханты-мансийск|хмао)|депздрав\s+югры/.test(lower)) {
    return SOURCE_NAMES.department
  }
  if (/аппарат\s+губернатора|правительств[а-яё]*\s+ханты-мансийск|губернатор/.test(lower)) {
    return SOURCE_NAMES.governor
  }

  return ''
}

function isConcreteSourceDetail(value) {
  const text = clean(value)
  if (!text) return false
  if (SOURCE_NAME_SET.has(text)) return true
  if (classifyOrganizationSource(text)) return true

  return /администрац|аппарат|бюро|департамент|дума|комитет|министерств|прокуратур|правительств|росздравнадзор|роспотребнадзор|служб[а-яё]*\s+по\s+надзор|следствен|страхов|тфомс|фонд\s+обязательн|управлен|уполномоченн|общественн[а-яё]+\s+палат|мвд|полици/i.test(
    text
  )
}

const SOURCE_NAME_SET = new Set(Object.values(SOURCE_NAMES))

function canonicalizeAppealSource(value) {
  const text = clean(value)
  if (!text) return SOURCE_NAMES.unknown

  // Значение уже является каноническим именем источника — возвращаем как есть
  if (SOURCE_NAME_SET.has(text)) return text

  const lower = text.toLocaleLowerCase('ru-RU')

  // Обращения на имя главного врача — внутренний канал, не «организация-источник»
  if (/главн[а-яё]+\s+врач|ссту/.test(lower)) {
    return SOURCE_NAMES.chiefDoctor
  }

  // Орган-источник по единому кириллице-безопасному классификатору
  const organization = classifyOrganizationSource(text)
  if (organization) return organization

  // Каналы прямой подачи гражданином
  if (/\bпос\b|платформ[а-яё]+\s+обратн[а-яё]+\s+связ|вконтакте|\bvk\b|публичн[а-яё]+\s+интернет|личн[а-яё]+\s+при[её]м|\be-?mail\b|почт|епгу/.test(lower)) {
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
  if (
    input.manualFields &&
    typeof input.manualFields === 'object' &&
    !Array.isArray(input.manualFields)
  ) {
    assignManualFields(manualFields, input.manualFields)
  }
  assignManualFields(manualFields, input)
  return manualFields
}

function assignManualFields(target, input = {}) {
  for (const key of MANUAL_TEXT_FIELD_KEYS) {
    if (typeof input[key] === 'string' && clean(input[key])) {
      target[key] = clean(input[key])
    }
  }

  if (typeof input.isJustified === 'boolean') {
    target.isJustified = input.isJustified
  }
  if (typeof input.justified === 'boolean') {
    target.justified = input.justified
  }

  const inspection = clean(input.inspection)
  if (INSPECTION_VALUES.has(inspection)) {
    target.inspection = inspection
  }

  if (Array.isArray(input.departments)) {
    const departments = [
      ...new Set(input.departments.map(resolveDepartmentName).map(clean).filter(Boolean)),
    ]
    if (departments.length) target.departments = departments
  }
}
