import crypto from 'node:crypto'
import XLSX from 'xlsx'
import {
  APPEAL_SOURCE_NAMES,
  OFFICIAL_RUBRICS,
  RUBRIC_ALIASES,
} from './appeals-classifier.mjs'

const OFFICIAL_RUBRIC_NAMES = new Set(
  OFFICIAL_RUBRICS.map((rubric) => rubric.name)
)

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
  const id = clean(input.id) || `manual-${crypto.randomUUID()}`
  const registeredAt = normalizeManualDate(input.registeredAt)
  const content = clean(input.content)
  const correspondent = clean(input.correspondent)
  const rawRubric = clean(input.rawRubric)
  const supportDocument = clean(input.supportDocument)
  const recipient = clean(input.recipient) || 'Не указан'
  const parsedCorrespondent = parseCorrespondent(correspondent)
  const profile = clean(input.profile) || normalizeRubric(rawRubric) || classifyProfile(content)
  const source = canonicalizeSource(
    clean(input.source) || parseSource({ id, supportDocument }),
    id
  )
  const registration = resolveRegistration(id)
  const isChiefDoctor = registration.appealMode === 'chiefDoctor'
  const isRedirected = isRedirectedSource(source)

  return {
    uid: `manual:${id}`,
    id,
    registeredAt,
    dateIso: parseFlexibleDate(registeredAt),
    content,
    correspondent: parsedCorrespondent.name,
    location: clean(input.location) || parsedCorrespondent.location,
    profile,
    intent: clean(input.intent) || classifyIntent(content),
    source,
    sourceOrganization: isChiefDoctor ? APPEAL_SOURCE_NAMES.direct : source,
    sourceChannel: clean(input.delivery) || 'Не указан',
    appealMode: registration.appealMode,
    registrationRoute: registration.registrationRoute,
    isChiefDoctor,
    isRedirected,
    recipient,
    rawRubric,
    origin: 'manual',
    sourceFile: '',
    importId: '',
    rowNumber: null,
    manualFields: input.manualFields ?? {},
    createdAt: now,
    updatedAt: now,
  }
}

export function buildDashboardData(records, metadata = {}) {
  const allRecords = records
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
  const comparable = selectComparablePeriod(allRecords)
  const normalizedRecords = comparable.current
  const previousRecords = comparable.previous

  const total = normalizedRecords.length
  const chiefDoctorRecords = normalizedRecords.filter(
    (record) => getAppealMode(record) === 'chiefDoctor'
  )
  const externalRecords = normalizedRecords.filter(
    (record) => getAppealMode(record) === 'external'
  )
  const chiefDoctorCount = chiefDoctorRecords.length
  const redirectedCount = externalRecords.length
  const justifiedCount = normalizedRecords.filter((record) =>
    isJustified(record)
  ).length
  const unjustifiedCount = normalizedRecords.filter(
    (record) => record.manualFields?.isJustified === false
  ).length
  const justificationMissingCount = total - justifiedCount - unjustifiedCount
  const previousSummary = buildSummary(previousRecords)
  const currentSummary = buildSummary(normalizedRecords)

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: metadata.sourceFile ?? 'database',
    total,
    dateRange: getDateRange(normalizedRecords),
    comparison: {
      currentYear: comparable.currentYear,
      previousYear: comparable.previousYear,
      cutoffMonthDay: comparable.cutoffMonthDay,
      currentTotal: total,
      previousTotal: previousRecords.length,
      delta: total - previousRecords.length,
      deltaPercent: getPercentChange(total, previousRecords.length),
      currentSummary,
      previousSummary,
    },
    summary: {
      chiefDoctorCount,
      redirectedCount,
      justifiedCount,
      unjustifiedCount,
      justificationMissingCount,
      manualCount: normalizedRecords.filter((record) => record.origin === 'manual')
        .length,
      excelCount: normalizedRecords.filter((record) => record.origin === 'excel')
        .length,
      profileCount: countUnique(normalizedRecords.map((record) => record.profile)),
      sourceCount: countUnique(
        externalRecords.map(
          (record) => record.sourceOrganization || record.documentSource || record.source
        )
      ),
      channelCount: countUnique(
        chiefDoctorRecords.map(
          (record) => record.sourceChannel || record.delivery || 'Не указан'
        )
      ),
      locationCount: countUnique(normalizedRecords.map((record) => record.location)),
      rubricMissingCount: normalizedRecords.filter((record) => !record.rawRubric)
        .length,
    },
    byMonth: buildComparableMonths(
      normalizedRecords,
      previousRecords,
      comparable.cutoffMonthDay
    ),
    byWeek: groupByWeek(normalizedRecords),
    byProfile: buildComparableCounts(
      normalizedRecords,
      previousRecords,
      (record) => record.profile
    ),
    bySource: buildComparableCounts(
      externalRecords,
      previousRecords.filter((record) => getAppealMode(record) === 'external'),
      (record) =>
        record.sourceOrganization || record.documentSource || record.source
    ),
    byChiefDoctorChannel: buildComparableCounts(
      chiefDoctorRecords,
      previousRecords.filter((record) => getAppealMode(record) === 'chiefDoctor'),
      (record) => record.sourceChannel || record.delivery || 'Не указан'
    ),
    byLocation: topCounts(normalizedRecords, (record) => record.location),
    byRecipient: topCounts(normalizedRecords, (record) => record.recipient, 8),
    byIntent: topCounts(normalizedRecords, (record) => record.intent),
    byJustification: [
      {
        name: 'Обоснованные',
        count: justifiedCount,
        share: total ? Number(((justifiedCount / total) * 100).toFixed(1)) : 0,
      },
      {
        name: 'Необоснованные',
        count: unjustifiedCount,
        share: total ? Number(((unjustifiedCount / total) * 100).toFixed(1)) : 0,
      },
      {
        name: 'Не определено',
        count: justificationMissingCount,
        share: total
          ? Number(((justificationMissingCount / total) * 100).toFixed(1))
          : 0,
      },
    ],
    recent: normalizedRecords.slice(-12).reverse(),
  }
}

export function selectComparablePeriod(records) {
  const dated = records.filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.dateIso))
  const currentYear = Math.max(
    0,
    ...dated.map((record) => Number(record.dateIso.slice(0, 4)))
  )
  const previousYear = currentYear ? currentYear - 1 : 0
  const currentYearRecords = dated.filter(
    (record) => Number(record.dateIso.slice(0, 4)) === currentYear
  )
  const cutoffMonthDay = currentYearRecords
    .map((record) => record.dateIso.slice(5))
    .sort()
    .at(-1) ?? '12-31'
  const inWindow = (record, year) =>
    Number(record.dateIso.slice(0, 4)) === year &&
    record.dateIso.slice(5) <= cutoffMonthDay

  return {
    currentYear,
    previousYear,
    cutoffMonthDay,
    current: records.filter((record) => inWindow(record, currentYear)),
    previous: records.filter((record) => inWindow(record, previousYear)),
  }
}

function buildSummary(records) {
  const chiefDoctorRecords = records.filter(
    (record) => getAppealMode(record) === 'chiefDoctor'
  )
  const externalRecords = records.filter(
    (record) => getAppealMode(record) === 'external'
  )
  return {
    total: records.length,
    profileCount: countUnique(records.map((record) => record.profile)),
    sourceCount: countUnique(
      externalRecords.map(
        (record) => record.sourceOrganization || record.documentSource || record.source
      )
    ),
    channelCount: countUnique(
      chiefDoctorRecords.map(
        (record) => record.sourceChannel || record.delivery || 'Не указан'
      )
    ),
    justifiedCount: records.filter((record) => isJustified(record)).length,
    unjustifiedCount: records.filter(
      (record) => record.manualFields?.isJustified === false
    ).length,
  }
}

function buildComparableCounts(current, previous, getKey) {
  const currentRows = topCounts(current, getKey)
  const previousRows = topCounts(previous, getKey)
  const currentMap = new Map(currentRows.map((row) => [row.name, row.count]))
  const previousMap = new Map(previousRows.map((row) => [row.name, row.count]))
  return [...new Set([...currentMap.keys(), ...previousMap.keys()])]
    .map((name) => {
      const count = currentMap.get(name) ?? 0
      const previousCount = previousMap.get(name) ?? 0
      return {
        name,
        count,
        previousCount,
        delta: count - previousCount,
        deltaPercent: getPercentChange(count, previousCount),
        share: current.length
          ? Number(((count / current.length) * 100).toFixed(1))
          : 0,
      }
    })
    .sort((a, b) => b.count - a.count || b.previousCount - a.previousCount)
}

function buildComparableMonths(current, previous, cutoffMonthDay) {
  const lastMonth = Number(cutoffMonthDay.slice(0, 2)) || 12
  return Array.from({ length: lastMonth }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    const currentCount = current.filter(
      (record) => record.dateIso.slice(5, 7) === month
    ).length
    const previousCount = previous.filter(
      (record) => record.dateIso.slice(5, 7) === month
    ).length
    return {
      month,
      count: currentCount,
      previousCount,
      delta: currentCount - previousCount,
    }
  })
}

export function buildComparisonReport(
  currentRecords,
  previousRecords,
  metadata = {}
) {
  const current = normalizeRecordsForReport(currentRecords)
  const previous = normalizeRecordsForReport(previousRecords)
  const currentDateRange = getDateRange(current)
  const previousDateRange = getDateRange(previous)

  return {
    generatedAt: new Date().toISOString(),
    institution: metadata.institution ?? 'БУ СОКБ',
    sourceFiles: {
      current: metadata.currentSourceFile ?? '',
      previous: metadata.previousSourceFile ?? '',
    },
    currentPeriod: {
      ...currentDateRange,
      label: getPeriodLabel(currentDateRange),
    },
    previousPeriod: {
      ...previousDateRange,
      label: getPeriodLabel(previousDateRange),
    },
    currentTotal: current.length,
    previousTotal: previous.length,
    delta: current.length - previous.length,
    deltaPercent: getPercentChange(current.length, previous.length),
    byPeriod: buildPeriodComparison(current, previous),
    bySource: buildRankComparison(current, previous, getReportSource, 10),
    byTopic: buildRankComparison(current, previous, (record) => record.profile, 10),
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
  const isChiefDoctor = isChiefDoctorAppeal(id)

  return {
    uid: `${metadata.origin}:${id}`,
    id,
    registeredAt,
    dateIso: parseFlexibleDate(registeredAt),
    content,
    correspondent: parsedCorrespondent.name,
    location: parsedCorrespondent.location,
    profile,
    intent: classifyIntent(content),
    source,
    isChiefDoctor,
    isRedirected: !isChiefDoctor,
    recipient,
    rawRubric,
    origin: metadata.origin,
    sourceFile: metadata.sourceFile,
    importId: metadata.importId,
    rowNumber: metadata.rowNumber,
    manualFields: {},
    createdAt: '',
    updatedAt: '',
  }
}

function normalizeRecordsForReport(records) {
  return records
    .map((record) => ({
      ...record,
      uid: record.uid ?? `${record.origin ?? 'excel'}:${record.id}`,
      origin: record.origin ?? 'excel',
    }))
    .filter((record) => record.id || record.content)
}

function isJustified(record) {
  return record.manualFields?.isJustified === true
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
  const name = clean(value).replace(/^\([^)]+\)\s*/, '').trim()
  const canonicalName =
    RUBRIC_ALIASES[name] ||
    RUBRIC_ALIASES[name.toLocaleLowerCase('ru-RU')] ||
    name
  return OFFICIAL_RUBRIC_NAMES.has(canonicalName) ? canonicalName : ''
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

  if (!location || /^не\s+указан[оа]?$/i.test(location)) return 'Не указан'
  if (/сургут|суругут/i.test(location)) return 'Сургут'
  if (/нефтеюганск/i.test(location)) return 'Нефтеюганск'
  if (/нижневартовск/i.test(location)) return 'Нижневартовск'
  if (/пыть-?ях/i.test(location)) return 'Пыть-Ях'
  if (/ханты-мансийск/i.test(location)) return 'Ханты-Мансийск'
  if (/ф[её]доровск/i.test(location)) return 'Федоровский'
  if (/барсов/i.test(location)) return 'Барсово'
  if (/бел[ыяа]й\s+яр/i.test(location)) return 'Белый Яр'
  if (/солнечн|солечн/i.test(location)) return 'Солнечный'
  if (/нижнесортым/i.test(location)) return 'Нижнесортымский'
  if (/лянтор/i.test(location)) return 'Лянтор'
  if (/когалым/i.test(location)) return 'Когалым'
  return location
}

function parseSource({ id, supportDocument }) {
  const text = clean(supportDocument)
  if (!text) return parseSourceById(id)

  const firstLine = text.split(/\s+Исх\.\s*№:/i)[0].trim()
  const separator = firstLine.lastIndexOf(' - ')
  return canonicalizeSource(
    normalizeSourceName(separator === -1 ? firstLine : firstLine.slice(0, separator)),
    id
  )
}

function getReportSource(record) {
  return canonicalizeSource(record.source, record.id)
}

function isChiefDoctorAppeal(id) {
  return /^07\/19/i.test(clean(id))
}

function parseSourceById(id) {
  const text = clean(id)

  if (/^07\/19/i.test(text)) return APPEAL_SOURCE_NAMES.chiefDoctor
  if (/^07-(ОГ|ЗИ|НО)/i.test(text)) {
    return APPEAL_SOURCE_NAMES.department
  }
  if (/^01-ОГ/i.test(text)) {
    return APPEAL_SOURCE_NAMES.governor
  }

  return APPEAL_SOURCE_NAMES.direct
}

function canonicalizeSource(value, id = '') {
  const source = clean(value).toLocaleLowerCase('ru-RU')
  const recordId = clean(id)

  if (/управление\s+президента|администрац[а-яё]*\s+президента/.test(source)) {
    return APPEAL_SOURCE_NAMES.president
  }
  if (/^07\/19/i.test(recordId) || /главн\w*\s+врач|ссту/.test(source)) {
    return APPEAL_SOURCE_NAMES.chiefDoctor
  }
  if (/департамент\s+здравоохранения|депздрав/.test(source)) {
    return APPEAL_SOURCE_NAMES.department
  }
  if (/аппарат\s+губернатора|правительств\w*\s+ханты-мансийского|губернатор/.test(source)) {
    return APPEAL_SOURCE_NAMES.governor
  }
  if (/минздрав|министерство\s+здравоохранения/.test(source)) {
    return APPEAL_SOURCE_NAMES.ministry
  }
  if (/альфа|согаз|капитал\s+мс|страх|тфомс|тофомс|\bомс\b/.test(source)) {
    return APPEAL_SOURCE_NAMES.insurance
  }
  if (/прокуратур/.test(source)) return APPEAL_SOURCE_NAMES.prosecutor
  if (/росздравнадзор|роспотребнадзор|служб\w*\s+по\s+надзор/.test(source)) {
    return APPEAL_SOURCE_NAMES.oversight
  }
  if (/уполномоченн\w*\s+по\s+прав|общественн\w*\s+палат/.test(source)) {
    return APPEAL_SOURCE_NAMES.publicRights
  }
  return APPEAL_SOURCE_NAMES.direct
}

function isRedirectedSource(source) {
  return ![
    APPEAL_SOURCE_NAMES.chiefDoctor,
    APPEAL_SOURCE_NAMES.direct,
    APPEAL_SOURCE_NAMES.unknown,
  ].includes(canonicalizeSource(source))
}

function getAppealMode(record) {
  return record.appealMode || resolveRegistration(record.id).appealMode
}

function resolveRegistration(id) {
  const text = clean(id)
  if (/^07\/19/i.test(text)) {
    return {
      appealMode: 'chiefDoctor',
      registrationRoute: 'На имя главного врача (07/19)',
    }
  }
  if (/^07-(ОГ|ЗИ|НО)/i.test(text)) {
    return {
      appealMode: 'external',
      registrationRoute: 'Депздрав Югры (07-*)',
    }
  }
  if (/^01-/i.test(text)) {
    return {
      appealMode: 'external',
      registrationRoute: 'Губернатор Югры (01-*)',
    }
  }
  return {
    appealMode: 'external',
    registrationRoute: 'Другой контур регистрации',
  }
}

function normalizeSourceName(value) {
  const source = clean(value)

  if (/^администрация\s+г\.\s*сургут$/i.test(source)) {
    return 'Администрация города Сургута'
  }
  if (/прокуратура\s+города\s+сургута/i.test(source)) {
    return 'Прокуратура города Сургута'
  }
  if (/прокуратура\s+города\s+когалыма/i.test(source)) {
    return 'Прокуратура города Когалыма'
  }
  if (/прокуратура\s+ханты-мансийского\s+автономного\s+округа\s*-\s*югры/i.test(source)) {
    return 'Прокуратура Ханты-Мансийского автономного округа - Югры'
  }
  if (/альфа\s*-?\s*страховани[ея]\s*-?\s*омс/i.test(source)) {
    return 'АльфаСтрахование-ОМС'
  }
  if (
    /^территориальный орган росздравнадзора по тюменской области/i.test(source) ||
    /^территориальный орган федеральной службы по надзору в сфере здравоохранения/i.test(source)
  ) {
    return 'Росздравнадзор'
  }
  if (/^федеральная служба по надзору в сфере здравоохранения/i.test(source)) {
    return 'Росздравнадзор'
  }

  return source
}

function classifyProfile(content) {
  const text = content.toLowerCase()

  if (/благодар/.test(text)) {
    return 'Благодарности, пожелания сотрудникам подведомственных учреждений'
  }
  if (/прекращен[а-яё]*\s+рассмотрен/.test(text)) {
    return 'Прекращение рассмотрения обращения'
  }
  if (/мед\.?\s*док|медицинск\w*\s+док|выписк|эпикриз|протокол|истори[ия]\s+болезн|медицинск[а-яё]*\s+карт/.test(text)) {
    return 'Лечение и оказание медицинской помощи'
  }
  if (/налогов|вычет|справк/.test(text)) {
    return 'Лечение и оказание медицинской помощи'
  }
  if (/лист(ок|ков)?\s+нетрудоспособ|больничн|временной\s+нетрудоспособ/.test(text)) {
    return 'Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике'
  }
  if (/инвалид|мсэ|медико-социальн\w*\s+экспертиз|группа\s+инвалидност/.test(text)) {
    return 'Установление группы инвалидности, в том числе связанной с пребыванием на фронте. Вопросы медико-социальной экспертизы (МСЭ)'
  }
  if (/квот|вмп|высокотехнолог/.test(text)) {
    return 'Квоты на оказание высокотехнологичной медицинской помощи'
  }
  if (/лекарств|препарат|льготн[а-яё]*\s+обеспеч/.test(text)) {
    return 'Лекарственное обеспечение'
  }
  if (/качеств\w*\s+оказан\w*.*стационар/.test(text) || /стационар.*качеств/.test(text)) {
    return 'Качество оказания медицинской помощи взрослым в стационарных условиях'
  }
  if (/качеств\w*\s+оказан\w*.*амбулатор/.test(text) || /амбулатор.*качеств/.test(text)) {
    return 'Качество оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях'
  }
  if (/жалоб|провер|расслед|нарушен|некачеств|ненадлежащ/.test(text)) {
    return 'Качество оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях'
  }
  if (/лечени|мед\.?\s*помощ|оказани\w*\s+медицинск\w*\s+помощ/.test(text)) {
    return 'Лечение и оказание медицинской помощи'
  }
  if (/работа\s+медицинск|персонал|сотрудник|хамств|груб|деонтолог/.test(text)) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  return 'Лечение и оказание медицинской помощи'
}

function classifyIntent(content) {
  const text = content.toLowerCase()

  if (/благодар|поощрен/.test(text)) return 'Благодарность'
  if (/лист(ок|ков)?\s+нетрудоспособ|больничн/.test(text)) {
    return 'Лист нетрудоспособности'
  }
  if (/справк|налогов|вычет/.test(text)) return 'Запрос справки'
  if (
    /выпис(к|ок)|эпикриз|протокол|гистолог|мед\.?\s*док|медицинск[а-яё]*\s+док|документац|копи[яиюй]|приказ|истори[ия]\s+болезн|медицинск[а-яё]*\s+карт|закрыт[а-яё]*\s+карт|устав/.test(
      text
    )
  ) {
    return 'Запрос документов'
  }
  if (/квот|вмп|высокотехнолог/.test(text)) return 'ВМП и квоты'
  if (/лекарств|лекарственн|препарат|льготн[а-яё]*\s+обеспеч/.test(text)) {
    return 'Лекарственное обеспечение'
  }
  if (/прекращен[а-яё]*\s+рассмотрен/.test(text)) {
    return 'Прекращение рассмотрения'
  }
  if (/запис[ьи]\s+на\s+прием|запис[ьи]\s+на\s+приём|прием\s+к\s+врачу|приём\s+к\s+врачу|узкому\s+специалист|врачу-[а-яё]+/.test(text)) {
    return 'Запись на прием'
  }
  if (/оборудован|аппарат|мрт|денситометр/.test(text)) {
    return 'Медицинское оборудование'
  }
  if (/транспортиров|перевод|маршрутизац|содейств[а-яё]*\s+перевод/.test(text)) {
    return 'Маршрутизация и перевод пациента'
  }
  if (/инвалид|мсэ|экспертиз|годност/.test(text)) return 'МСЭ и инвалидность'
  if (/реабилитац|нейрореабилитац/.test(text)) return 'Реабилитация'
  if (/коллективн[а-яё]*\s+письм/.test(text)) return 'Коллективное обращение'
  if (/практик|стажировк|производственн[а-яё]*\s+практик/.test(text)) {
    return 'Практика и обучение'
  }
  if (/запрос\s+информац|предоставлен[а-яё]*\s+информац|актуализац[а-яё]*\s+данн|состояни[а-яё]*\s+здоров/.test(text)) {
    return 'Запрос информации'
  }
  if (/врачебн[а-яё]*\s+комисс|сняти[а-яё]*\s+диагноз|постановк[а-яё]*\s+диагноз|заключени[а-яё]*/.test(text)) {
    return 'Диагностика и врачебная комиссия'
  }
  if (/провер|расслед|материал[а-яё]*\s+служебн/.test(text)) {
    return 'Запрос проверки или расследования'
  }
  if (
    /жалоб|несоглас|отказ|нарушен|некачеств|качества\s+оказания|организации\s+и\s+качества|ненадлежащ|деонтолог|фальсификац|срок|очеред|груб|хамств|претензи/.test(
      text
    )
  ) {
    return 'Жалобы на качество и организацию помощи'
  }
  if (/оказан[а-яё]*\s+медицинск[а-яё]*\s+помощ|медицинск[а-яё]*\s+помощ|лечени[а-яё]*/.test(text)) {
    return 'Вопросы лечения и медицинской помощи'
  }

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
    const key = clean(item.dateIso).slice(0, 7) || 'Не указано'
    const previous = grouped.get(key) ?? { month: key, count: 0 }
    previous.count += 1
    grouped.set(key, previous)
  }

  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function buildPeriodComparison(current, previous) {
  const currentByMonth = countBy(current, getMonthNumber)
  const previousByMonth = countBy(previous, getMonthNumber)
  const monthNumbers = [
    ...new Set([...currentByMonth.keys(), ...previousByMonth.keys()]),
  ]
    .filter(Boolean)
    .sort()

  return monthNumbers.map((monthNumber) => {
    const count = currentByMonth.get(monthNumber) ?? 0
    const previousCount = previousByMonth.get(monthNumber) ?? 0

    return {
      key: monthNumber,
      name: getMonthName(monthNumber, 'short'),
      count,
      previousCount,
      delta: count - previousCount,
      deltaPercent: getPercentChange(count, previousCount),
    }
  })
}

function buildRankComparison(current, previous, getKey, limit) {
  const currentCounts = countBy(current, getKey)
  const previousCounts = countBy(previous, getKey)

  return [...currentCounts.entries()]
    .map(([name, count]) => {
      const previousCount = previousCounts.get(name) ?? 0

      return {
        name,
        count,
        previousCount,
        delta: count - previousCount,
        deltaPercent: getPercentChange(count, previousCount),
      }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
    .slice(0, limit)
}

function countBy(items, getKey) {
  const counts = new Map()

  for (const item of items) {
    const key = clean(getKey(item)) || 'Не указано'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

function getMonthNumber(record) {
  return clean(record.dateIso).slice(5, 7)
}

function getPeriodLabel(dateRange) {
  if (!dateRange.from || !dateRange.to) return 'период не указан'

  const fromYear = dateRange.from.slice(0, 4)
  const toYear = dateRange.to.slice(0, 4)
  const fromMonth = dateRange.from.slice(5, 7)
  const toMonth = dateRange.to.slice(5, 7)

  if (fromYear === toYear && fromMonth === toMonth) {
    return `${getMonthName(fromMonth)} ${fromYear}`
  }
  if (fromYear === toYear) {
    return `${getMonthName(fromMonth)}-${getMonthName(toMonth)} ${fromYear}`
  }

  return `${getMonthName(fromMonth)} ${fromYear}-${getMonthName(toMonth)} ${toYear}`
}

function getMonthName(monthNumber, variant = 'long') {
  const months = {
    '01': ['январь', 'Янв'],
    '02': ['февраль', 'Фев'],
    '03': ['март', 'Мар'],
    '04': ['апрель', 'Апр'],
    '05': ['май', 'Май'],
    '06': ['июнь', 'Июн'],
    '07': ['июль', 'Июл'],
    '08': ['август', 'Авг'],
    '09': ['сентябрь', 'Сен'],
    '10': ['октябрь', 'Окт'],
    '11': ['ноябрь', 'Ноя'],
    '12': ['декабрь', 'Дек'],
  }

  return months[monthNumber]?.[variant === 'short' ? 1 : 0] ?? monthNumber
}

function getPercentChange(current, previous) {
  if (!previous) return current ? null : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function groupByWeek(items) {
  const grouped = new Map()

  for (const item of items) {
    if (!item.dateIso) continue

    const start = getFridayWeekStart(item.dateIso)
    const end = addDays(start, 6)
    const key = toIsoDate(start)
    const previous = grouped.get(key) ?? {
      week: key,
      from: key,
      to: toIsoDate(end),
      count: 0,
    }

    previous.count += 1
    grouped.set(key, previous)
  }

  return [...grouped.values()].sort((a, b) => a.week.localeCompare(b.week))
}

function getFridayWeekStart(dateIso) {
  const date = new Date(`${dateIso}T00:00:00Z`)
  const day = date.getUTCDay()
  const daysSinceFriday = (day - 5 + 7) % 7
  return addDays(date, -daysSinceFriday)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function topCounts(items, getKey, limit = Number.POSITIVE_INFINITY) {
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
