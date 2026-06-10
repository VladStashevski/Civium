import XLSX from 'xlsx'
import {
  APPEAL_SOURCE_NAMES,
  OFFICIAL_RUBRICS,
  RUBRIC_ALIASES as CLASSIFIER_RUBRIC_ALIASES,
} from './appeals-classifier.mjs'

export const COLUMNS = {
  id: '№ РК',
  registeredAt: 'Дата рег.',
  content: 'Содержание',
  correspondent: 'Корр./Подписал',
  rubric: 'Рубрика',
  supportDocument: 'Сопровод. документ',
  recipient: 'Кому',
  groupIndex: 'Группа документов - индекс',
  groupDocuments: 'Группа документов',
  delivery: 'Вид доставки РК',
  siteAppealNumber: 'Номер обращения с сайта',
  posMessageNumber: 'Сообщение ПОС №',
  sourceSystem: 'От',
}

const RUBRIC_VOCABULARY = OFFICIAL_RUBRICS.map((rubric) => rubric.name)
const RUBRIC_NAMES = new Set(RUBRIC_VOCABULARY)

// Канонизация: разные варианты записи одной рубрики в Excel → единый вид
const RUBRIC_ALIASES = {
  ...CLASSIFIER_RUBRIC_ALIASES,
  'Заявление': null, // служебная — не учитываем как тему
  'Письмо': null, // служебная — не учитываем как тему
}

const CHIEF_DOCTOR_SOURCE = APPEAL_SOURCE_NAMES.chiefDoctor
const DEPARTMENT_SOURCE = APPEAL_SOURCE_NAMES.department
const MINISTRY_SOURCE = APPEAL_SOURCE_NAMES.ministry
const GOVERNOR_SOURCE = APPEAL_SOURCE_NAMES.governor
const PRESIDENT_SOURCE = APPEAL_SOURCE_NAMES.chiefDoctor
const ROSZDRAVNADZOR_SOURCE = APPEAL_SOURCE_NAMES.oversight
const PROSECUTOR_SOURCE = APPEAL_SOURCE_NAMES.prosecutor
const OMBUDSMAN_SOURCE = APPEAL_SOURCE_NAMES.publicRights
const SURGUT_ADMINISTRATION_SOURCE = APPEAL_SOURCE_NAMES.direct
const INSURANCE_SOURCE = APPEAL_SOURCE_NAMES.insurance
const PUBLIC_SOURCE = APPEAL_SOURCE_NAMES.direct
const POS_SOURCE = APPEAL_SOURCE_NAMES.direct
const UNKNOWN_SOURCE = APPEAL_SOURCE_NAMES.unknown
const NON_SUBSTANTIVE_TOPICS = new Set([
  'Благодарности, пожелания сотрудникам подведомственных учреждений',
  'Прекращение рассмотрения обращения',
])
const DOCUMENT_SOURCE_ORDER = [
  DEPARTMENT_SOURCE,
  GOVERNOR_SOURCE,
  MINISTRY_SOURCE,
  INSURANCE_SOURCE,
  PROSECUTOR_SOURCE,
  CHIEF_DOCTOR_SOURCE,
  APPEAL_SOURCE_NAMES.direct,
  ROSZDRAVNADZOR_SOURCE,
  OMBUDSMAN_SOURCE,
]
const DOCUMENT_TOPIC_ORDER = [
  'Жалобы на оказание медицинской помощи',
  'Организация записи на прием к врачу',
  'Лекарственное обеспечение',
  'Благодарности',
  'Обращения информационного характера',
  'Коллективные обращения работников БУ СОКБ',
  'Отстранение от работы и исполнение трудовой функции',
  'Прекращение рассмотрения обращения (отзыв обращения)',
  'Вопросы трудоустройства',
]
const IGNORED_DOCUMENT_SOURCES = new Set()

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

export function buildComparisonReport(
  currentRecords,
  previousRecords,
  metadata = {}
) {
  const current = normalizeRecordsForReport(currentRecords)
  const previous = normalizeRecordsForReport(previousRecords)
  const currentAnalysis = getSubstantiveRecords(current)
  const previousAnalysis = getSubstantiveRecords(previous)
  const currentDocumentRecords = getDocumentReportRecords(current)
  const previousDocumentRecords = getDocumentReportRecords(previous)
  const currentDateRange = getDateRange(current)
  const previousDateRange = getDateRange(previous)
  const currentExcluded = getExcludedTopicSummary(current)
  const previousExcluded = getExcludedTopicSummary(previous)

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
    currentAnalysisTotal: currentAnalysis.length,
    previousAnalysisTotal: previousAnalysis.length,
    analysisDelta: currentAnalysis.length - previousAnalysis.length,
    analysisDeltaPercent: getPercentChange(
      currentAnalysis.length,
      previousAnalysis.length
    ),
    excludedTopics: {
      current: currentExcluded,
      previous: previousExcluded,
    },
    byPeriod: buildPeriodComparison(currentAnalysis, previousAnalysis),
    bySource: buildRankComparison(currentAnalysis, previousAnalysis, getReportSource, 10),
    byTopic: buildRankComparison(
      currentAnalysis,
      previousAnalysis,
      (record) => record.profile,
      10
    ),
    bySourceAll: buildRankComparison(
      currentAnalysis,
      previousAnalysis,
      getReportSource,
      Number.POSITIVE_INFINITY
    ),
    byTopicAll: buildRankComparison(
      currentAnalysis,
      previousAnalysis,
      (record) => record.profile,
      Number.POSITIVE_INFINITY
    ),
    byDocumentSource: buildOrderedComparison(
      currentDocumentRecords,
      previousDocumentRecords,
      getReportSource,
      DOCUMENT_SOURCE_ORDER
    ),
    byDocumentTopic: buildOrderedComparison(
      currentDocumentRecords,
      previousDocumentRecords,
      getDocumentTopic,
      DOCUMENT_TOPIC_ORDER
    ),
    bySourceDynamics: buildMovementComparison(
      currentAnalysis,
      previousAnalysis,
      getReportSource,
      12
    ),
    byTopicDynamics: buildMovementComparison(
      currentAnalysis,
      previousAnalysis,
      (record) => record.profile,
      12
    ),
    sourceRouting: {
      current: getUnknownSourceRouting(current),
      previous: getUnknownSourceRouting(previous),
    },
    rubricCoverage: getRubricCoverage(current),
  }
}

function getSubstantiveRecords(records) {
  return records.filter((record) => !NON_SUBSTANTIVE_TOPICS.has(record.profile))
}

function getDocumentReportRecords(records) {
  return records.filter(
    (record) => !IGNORED_DOCUMENT_SOURCES.has(getReportSource(record))
  )
}

function getExcludedTopicSummary(records) {
  const gratitude = records.filter(
    (record) =>
      record.profile ===
      'Благодарности, пожелания сотрудникам подведомственных учреждений'
  ).length
  const discontinued = records.filter(
    (record) => record.profile === 'Прекращение рассмотрения обращения'
  ).length

  return {
    gratitude,
    discontinued,
    total: gratitude + discontinued,
  }
}

function getUnknownSourceRouting(records) {
  const unknown = records.filter((record) => isUnknownSource(record))
  const nonSubstantive = unknown.filter((record) =>
    NON_SUBSTANTIVE_TOPICS.has(record.profile)
  )
  const substantive = unknown.filter(
    (record) => !NON_SUBSTANTIVE_TOPICS.has(record.profile)
  )
  const routedToGovernor = substantive.filter((record) => /^01-ОГ/i.test(record.id))
  const routedToDepartment = substantive.filter(
    (record) => !/^01-ОГ/i.test(record.id)
  )

  return {
    total: unknown.length,
    nonSubstantive: nonSubstantive.length,
    substantive: unknown.length - nonSubstantive.length,
    routedToDepartment: routedToDepartment.length,
    routedToGovernor: routedToGovernor.length,
  }
}

function getRubricCoverage(records) {
  const withRubric = records.filter((r) => r.rawRubric).length
  const total = records.length
  return {
    withRubric,
    inferred: total - withRubric,
    total,
    coveragePercent: total ? Number(((withRubric / total) * 100).toFixed(1)) : 0,
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
  const groupIndex = clean(row[COLUMNS.groupIndex])
  const groupDocuments = clean(row[COLUMNS.groupDocuments])
  const delivery = clean(row[COLUMNS.delivery])
  const siteAppealNumber = clean(row[COLUMNS.siteAppealNumber])
  const posMessageNumber = clean(row[COLUMNS.posMessageNumber])
  const sourceSystem = clean(row[COLUMNS.sourceSystem])
  const parsedCorrespondent = parseCorrespondent(correspondent)
  const source = parseSource({ id, supportDocument })
  const profile = resolveRubric(rawRubric, content)
  const isChiefDoctor = isChiefDoctorAppeal(id)
  const documentSource = resolveDocumentSource({
    id,
    source,
    supportDocument,
    recipient,
    groupIndex,
    groupDocuments,
    delivery,
    siteAppealNumber,
    posMessageNumber,
    sourceSystem,
    content,
    isChiefDoctor,
  })
  const documentTopic = resolveDocumentTopic({
    profile,
    content,
    documentSource,
  })

  return {
    uid: `${metadata.origin}:${id}`,
    id,
    registeredAt,
    dateIso: parseFlexibleDate(registeredAt),
    content,
    correspondent: parsedCorrespondent.name,
    location: parsedCorrespondent.location,
    profile,
    intent: profile,
    source,
    isChiefDoctor,
    isRedirected: !isChiefDoctor,
    recipient,
    rawRubric,
    groupIndex,
    groupDocuments,
    delivery,
    siteAppealNumber,
    posMessageNumber,
    sourceSystem,
    documentSource,
    documentTopic,
    origin: metadata.origin,
    sourceFile: metadata.sourceFile,
    importId: metadata.importId,
    rowNumber: metadata.rowNumber,
    manualFields: {},
    createdAt: '',
    updatedAt: '',
  }
}

function resolveRubric(rawRubric, content) {
  // 1. Если есть Рубрика — используем её, очистив от кода и применив алиасы
  if (rawRubric) {
    const cleaned = clean(rawRubric).replace(/^\([^)]+\)\s*/, '').trim()
    if (cleaned in RUBRIC_ALIASES) {
      const alias = RUBRIC_ALIASES[cleaned]
      if (alias === null) return classifyByContent(content)
      return alias
    }
    if (RUBRIC_NAMES.has(cleaned)) return cleaned
    return classifyByContent(content)
  }
  // 2. Иначе — классификация по содержанию в строго том же словаре
  return classifyByContent(content)
}

function classifyByContent(content) {
  const text = String(content || '').toLowerCase()

  if (!text) return 'Лечение и оказание медицинской помощи'

  // Благодарности
  if (/благодар|поощр/.test(text)) {
    return 'Благодарности, пожелания сотрудникам подведомственных учреждений'
  }

  // Прекращение рассмотрения
  if (/прекращен\w*\s+рассмотрен/.test(text)) {
    return 'Прекращение рассмотрения обращения'
  }

  // Военно-врачебная экспертиза (строго военная)
  if (/военно-врачебн|годност\w*\s+к\s+воен/.test(text)) {
    return 'Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике'
  }

  // Военнослужащие / СВО
  if (/военнослуж|демобилизов|\bсво\b|зона\s+сво|спец\w*\s+воен\w*\s+операц/.test(text)) {
    return 'Лечение и оказание медицинской помощи'
  }

  // Социальное обеспечение и социальная поддержка семей
  if (
    /социальн\w+\s+обеспеч|социальн\w+\s+поддержк\w+\s+семь|многодетн|малоимущ|пожилы[ехм]\s+граждан|трудн\w+\s+жизненн\w+\s+ситуац|одинок\w+\s+родител/.test(
      text
    )
  ) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  // Гражданская медицинская экспертиза (общая, не военная) — судебно-медицинская, экспертиза трудоспособности и пр.
  if (
    /(судебно-?медицинск\w+\s+экспертиз|медицинск\w+\s+экспертиз|освидетельствован\w+\s+(на|для)|медицинское\s+освидетельствован)/.test(
      text
    )
  ) {
    return 'Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике'
  }

  // МСЭ / инвалидность
  if (/мсэ\b|медико-социальн|групп[аы]?\s+инвалидност|установлен\w+\s+групп\w*\s+инвалидност|инвалидность/.test(text)) {
    return 'Установление группы инвалидности, в том числе связанной с пребыванием на фронте. Вопросы медико-социальной экспертизы (МСЭ)'
  }

  // Экспертиза временной нетрудоспособности (больничный)
  if (/лист(ок|ков)?\s+нетрудоспособ|больничн\w*\s+лист|временн\w+\s+нетрудоспособ|закры\w+\s+больничн/.test(text)) {
    return 'Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике'
  }

  // ВМП / квоты
  if (/квот|вмп\b|высокотехнолог/.test(text)) {
    return 'Квоты на оказание высокотехнологичной медицинской помощи'
  }

  // Лекарственное обеспечение
  if (/лекарств|препарат|льготн\w+\s+обеспеч|выписк\w*\s+рецепт|льготн\w+\s+рецепт/.test(text)) {
    return 'Лекарственное обеспечение'
  }

  // Лечение за рубежом
  if (/за\s+рубеж|за\s+границ/.test(text)) {
    return 'Лечение и оказание медицинской помощи'
  }

  // Трудовые конфликты
  if (/трудов\w+\s+конфликт|трудов\w+\s+спор|увольнен|сокращен|зарплат|невыплат/.test(text)) {
    return 'Трудовые конфликты. Разрешение трудовых споров'
  }

  // Меры соц. поддержки медработников
  if (/социальн\w+\s+поддержк\w+\s+медицинск|подъ[её]мн|компенсац\w+\s+медработник/.test(text)) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  // Скорая помощь
  if (/скор\w+\s+(медицинск\w+\s+)?помощ|неотложн\w+\s+помощ|\bсмп\b|бригад\w+\s+скор/.test(text)) {
    return 'Служба скорой и неотложной медицинской помощи'
  }

  // Отношение к больным
  if (/хамств|груб|деонтолог|оскорбл|непочтит|неуважит|неэтичн|оскорб/.test(text)) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  // Оборудование
  if (/оборудован|аппарат\w*\s+мрт|мрт\b|кт\b|денситометр|рентген|оснащени/.test(text)) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  // Материально-техническое и финансовое
  if (/материально-технич|финансов\w+\s+обеспеч|финансиров/.test(text)) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  // Лицензирование
  if (/лиценз/.test(text)) {
    return 'Требования и стандарты в сфере здравоохранения'
  }

  // Помещение в больницы. Оплата за лечение
  if (/оплат\w+\s+лечен|оплат\w+\s+пребыв|плат\w+\s+услуг/.test(text)) {
    return 'Помещение в больницы и специализированные лечебные учреждения. Оплата за лечение, пребывание в лечебных учреждениях'
  }

  // Действие (бездействие) при рассмотрении обращения
  if (/бездейств|нарушен\w+\s+сро\w+\s+рассмотрен|не\s+отвеча\w+\s+на\s+обращен/.test(text)) {
    return 'Результаты рассмотрения обращения'
  }

  // Результаты рассмотрения
  if (/результат\w+\s+рассмотрен/.test(text)) {
    return 'Результаты рассмотрения обращения'
  }

  // ВКК / диагностика
  if (/врачебно-консультац|вкк\b|диагност\w+\s+ошибк|неправильн\w+\s+диагноз|постановк\w+\s+диагноз/.test(text)) {
    return 'Врачебно-консультационная комиссия. О медицинском обслуживании, диагностике'
  }

  // Качество — детям
  const isChildren = /(ребен|ребёнк|дет(ск|ям|и)|младенц|новорожд|подростк)/.test(text)
  const isStationary = /стационар|госпитализ|поступлен\w+\s+в\s+больниц/.test(text)
  const isAmbulatory = /амбулатор|поликлиник|на\s+при[её]м/.test(text)
  const isQualityIssue = /качеств|жалоб|претензи|нарушен|некачеств|ненадлежащ|отказ\s+в|неоказан/.test(text)

  if (isChildren && isStationary && isQualityIssue) {
    return 'Качество оказания медицинской помощи детям в стационарных условиях'
  }
  if (isChildren && isAmbulatory) {
    return 'Оказание медицинской помощи детям в амбулаторно-поликлинических условиях'
  }
  if (isChildren && isQualityIssue) {
    return 'Качество оказания медицинской помощи детям в амбулаторно-поликлинических условиях'
  }

  // Качество взрослым
  if (isStationary && isQualityIssue) {
    return 'Качество оказания медицинской помощи взрослым в стационарных условиях'
  }
  if (isAmbulatory && isQualityIssue) {
    return 'Качество оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях'
  }
  if (isQualityIssue) {
    return 'Качество оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях'
  }

  // Организация мед.помощи (без жалоб, чисто организационные)
  if (isStationary && /организац|порядок|маршрут/.test(text)) {
    return 'Помещение в больницы и специализированные лечебные учреждения. Оплата за лечение, пребывание в лечебных учреждениях'
  }
  if (isAmbulatory && /организац|порядок|маршрут|запис\w+\s+на\s+при[её]м/.test(text)) {
    return 'Организация оказания медицинской помощи взрослым в амбулаторно-поликлинических условиях'
  }

  // Обеспечение потребности
  if (/обеспечен\w+\s+потребност|объ[её]м\w+\s+медицинск|доступн\w+\s+медицинск/.test(text)) {
    return 'Обеспечение потребности в медицинской помощи и объёмов её получения'
  }

  // Охрана здоровья взрослого населения
  if (/охран\w+\s+здоровь|профилактик|диспансериз|иммунизац|вакцинац/.test(text)) {
    return 'Охрана здоровья взрослого населения'
  }

  // Работа учреждений / персонал
  if (/работ\w+\s+(медицинск|больниц|поликлиник)|персонал|кадры/.test(text)) {
    return 'Работа медицинских учреждений и их сотрудников'
  }

  // Лечение и оказание мед. помощи — общий fallback для всего клинического (в т.ч. документация по лечению)
  if (
    /лечен|оказан\w+\s+медицинск\w+\s+помощ|консультац|госпитализ|обследован|при[её]м\s+у\s+врач|при[её]м\w+\s+к\s+врач|консилиум|выписк|эпикриз|протокол|медицинск\w+\s+док|истори[ия]\s+болезн|медицинск\w+\s+карт|справк|вычет|налогов|копи[яей]|документац/.test(
      text
    )
  ) {
    return 'Лечение и оказание медицинской помощи'
  }

  return 'Лечение и оказание медицинской помощи'
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

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
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

function parseCorrespondent(value) {
  const text = clean(value)
  if (!text) return { name: 'Не указан', location: 'Не указан' }
  const separator = text.lastIndexOf(' - ')
  if (separator === -1) return { name: text, location: 'Не указан' }
  return {
    name: text.slice(0, separator).trim() || 'Не указан',
    location: text.slice(separator + 3).trim() || 'Не указан',
  }
}

function parseSource({ id, supportDocument }) {
  const text = clean(supportDocument)
  if (!text) return parseSourceById(id)
  const firstLine = text.split(/\s+Исх\.\s*№:/i)[0].trim()
  const separator = firstLine.lastIndexOf(' - ')
  return separator === -1 ? firstLine : firstLine.slice(0, separator).trim()
}

function parseSourceById(id) {
  const text = clean(id)
  if (/^07\/19/i.test(text)) return 'Обращение к главному врачу'
  return 'Источник не указан'
}

// Распознаёт орган-источник по свободному тексту («Сопровод. документ», «Кому»).
// Возвращает '' если орган не определён.
function matchOrganization(value) {
  const text = clean(value).toLowerCase()
  if (!text) return ''
  if (
    /альфа|согаз|капитал\s+мс|страхов|страхован|тфомс|тофомс|федеральн\w*\s+фонд\s+обязательн\w+\s+медицинск\w+\s+страхован|обязательн\w+\s+медицинск\w+\s+страхован|\bомс\b/.test(
      text
    )
  ) {
    return INSURANCE_SOURCE
  }
  if (/минздрав|министерство\s+здравоохранения\s+(российской\s+федерации|рф)/.test(text)) {
    return MINISTRY_SOURCE
  }
  if (/управление\s+президента|администрац\w*\s+президента/.test(text)) {
    return PRESIDENT_SOURCE
  }
  if (/аппарат\s+губернатора|правительств\w*\s+ханты-мансийского|губернатор/.test(text)) {
    return GOVERNOR_SOURCE
  }
  if (/департамент\s+здравоохранения|депздрав|паськов\s+роман/.test(text)) {
    return DEPARTMENT_SOURCE
  }
  if (/росздравнадзор|служб\w*\s+по\s+надзор|территориальн\w*\s+орган.*надзор/.test(text)) {
    return ROSZDRAVNADZOR_SOURCE
  }
  if (/прокуратур/.test(text)) return PROSECUTOR_SOURCE
  if (/уполномоченн\w*\s+по\s+прав/.test(text)) return OMBUDSMAN_SOURCE
  if (/администрац\w*.*сургут|администрац\w*\s+муниципальн/.test(text)) {
    return SURGUT_ADMINISTRATION_SOURCE
  }
  return ''
}

function resolveDocumentSource({
  id,
  source,
  supportDocument,
  recipient,
  groupIndex,
  groupDocuments,
  delivery,
  siteAppealNumber,
  posMessageNumber,
  sourceSystem,
  content,
  isChiefDoctor,
}) {
  const senderText = [source, supportDocument].map(clean).join(' ').toLowerCase()
  const recipientText = clean(recipient).toLowerCase()
  const routingText = [groupIndex, groupDocuments, delivery, siteAppealNumber, posMessageNumber, sourceSystem]
    .map(clean)
    .join(' ')
    .toLowerCase()
  const contentText = clean(content).toLowerCase()
  const text = [senderText, recipientText, routingText, contentText].join(' ')
  const idText = clean(id)
  const indexText = clean(groupIndex)

  // Особые каналы поступления
  if (/сообщение\s+пос|\bпос\b|платформ\w+\s+обратн\w+\s+связ/.test(text)) {
    return POS_SOURCE
  }
  if (
    /сообщество\s+вк|вконтакте|\bvk\b|послушайте[, ]+\s*доктор|паблик/.test(text)
  ) {
    return PUBLIC_SOURCE
  }

  // 1. Кто переслал обращение — по «Сопровод. документ»/источнику, затем «Кому»
  const fromSender = matchOrganization(senderText)
  if (fromSender) return fromSender
  const fromRecipient = matchOrganization(recipientText)
  if (fromRecipient) return fromRecipient

  // 2. Сопроводительного органа нет — определяем по префиксу № РК / индексу группы
  if (isChiefDoctor || /^07\/19/i.test(idText) || /^07\/19/i.test(indexText)) {
    return CHIEF_DOCTOR_SOURCE
  }
  if (/^01-ОГ/i.test(idText) || /^01\b|^01-/i.test(indexText)) {
    return GOVERNOR_SOURCE
  }
  if (/^07-(ОГ|ЗИ|НО)/i.test(idText) || /^07\b/i.test(indexText)) {
    return DEPARTMENT_SOURCE
  }

  return APPEAL_SOURCE_NAMES.direct
}

function resolveDocumentTopic({ profile, content, documentSource }) {
  const topic = getDocumentTopic({ profile, content, documentSource })
  return DOCUMENT_TOPIC_ORDER.includes(topic)
    ? topic
    : 'Жалобы на оказание медицинской помощи'
}

function getReportSource(record) {
  if (record.documentSource) return record.documentSource

  const source = clean(record.source).toLowerCase()
  const id = clean(record.id)

  if (record.isChiefDoctor || /^07\/19/i.test(id)) {
    return CHIEF_DOCTOR_SOURCE
  }

  if (isUnknownSource(record)) {
    if (/^01-ОГ/i.test(id)) return GOVERNOR_SOURCE
    return DEPARTMENT_SOURCE
  }

  if (/министерство\s+здравоохранения\s+(российской\s+федерации|рф)|минздрав\s+россии/i.test(source)) {
    return MINISTRY_SOURCE
  }
  if (/департамент\s+здравоохранения\s+ханты-мансийского/i.test(source)) {
    return DEPARTMENT_SOURCE
  }
  if (/аппарат\s+губернатора|правительства\s+ханты-мансийского/i.test(source)) {
    return GOVERNOR_SOURCE
  }
  if (/управление\s+президента/i.test(source)) {
    return PRESIDENT_SOURCE
  }
  if (/прокуратур/i.test(source)) return PROSECUTOR_SOURCE
  if (/следствен/i.test(source)) return 'Следственное управление'
  if (/территориальный\s+орган.*(надзор|росздравнадзор)/i.test(source)) {
    return ROSZDRAVNADZOR_SOURCE
  }
  if (/федеральная\s+служба.*надзор|росздравнадзор/i.test(source)) {
    return ROSZDRAVNADZOR_SOURCE
  }
  if (/уполномоченн\w*\s+по\s+прав/i.test(source)) return OMBUDSMAN_SOURCE
  if (/администрац\w*.*сургут|администрац\w*\s+муниципальн/i.test(source)) {
    return SURGUT_ADMINISTRATION_SOURCE
  }
  if (
    /альфа|капитал\s+мс|страх|фсс|пфр|социальн\w*\s+фонд|сфр|согаз|омс|обязательного\s+медицинского\s+страхования/i.test(
      source
    )
  ) {
    return INSURANCE_SOURCE
  }

  return APPEAL_SOURCE_NAMES.direct
}

function getDocumentTopic(record) {
  if (record.documentTopic) return record.documentTopic

  const profile = clean(record.profile)
  const content = clean(record.content).toLowerCase()
  const source = clean(record.documentSource)

  if (source === CHIEF_DOCTOR_SOURCE && isInformationRequest(content, profile)) {
    return 'Обращения информационного характера'
  }

  if (/коллективн.*сокб|сокб.*коллективн/.test(content)) {
    return 'Коллективные обращения работников БУ СОКБ'
  }
  if (/отстранен|отстранён|отстранени/.test(content)) {
    return 'Отстранение от работы и исполнение трудовой функции'
  }
  if (/трудоустрой|прием\s+на\s+работ|приём\s+на\s+работ|ваканси/.test(content)) {
    return 'Вопросы трудоустройства'
  }
  if (profile === 'Лекарственное обеспечение') {
    return 'Лекарственное обеспечение'
  }
  if (
    profile ===
    'Благодарности, пожелания сотрудникам подведомственных учреждений'
  ) {
    return 'Благодарности'
  }
  if (profile === 'Прекращение рассмотрения обращения') {
    return 'Прекращение рассмотрения обращения (отзыв обращения)'
  }
  if (
    /запис\w*\s+на\s+при[её]м|талон\w*\s+к\s+врач|при[её]м\s+к\s+врач|при[её]м\s+у\s+врач/.test(
      content
    )
  ) {
    return 'Организация записи на прием к врачу'
  }
  if (isInformationRequest(content, profile)) {
    return 'Обращения информационного характера'
  }

  return 'Жалобы на оказание медицинской помощи'
}

function isInformationRequest(content, profile = '') {
  const text = clean(content).toLowerCase()
  return (
    /информац|предостав|выдач|направить|получить|справк|выписк|эпикриз|копи[яию]|документ|документац|мед\.?\s*док|медицинск\w+\s+док|медицинск\w+\s+карт|истори[ия]\s+болезн|протокол|результат\w+\s+(анализ|исследован|обследован)|заключени|налогов\w*\s+вычет|лист\w*\s+нетрудоспособ|больничн\w*\s+лист|архив/.test(
      text
    ) ||
    [
      'Экспертиза временной нетрудоспособности',
      'Результаты рассмотрения обращения',
    ].includes(clean(profile))
  )
}

function isUnknownSource(record) {
  return clean(record.source) === UNKNOWN_SOURCE
}

function isChiefDoctorAppeal(id) {
  return /^07\/19/i.test(clean(id))
}

function getDateRange(items) {
  const dates = items.map((item) => item.dateIso).filter(Boolean).sort()
  return { from: dates[0] ?? '', to: dates.at(-1) ?? '' }
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
  const names = new Set([...currentCounts.keys(), ...previousCounts.keys()])

  return [...names]
    .map((name) => {
      const count = currentCounts.get(name) ?? 0
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

function buildMovementComparison(current, previous, getKey, limit) {
  const currentCounts = countBy(current, getKey)
  const previousCounts = countBy(previous, getKey)
  const names = new Set([...currentCounts.keys(), ...previousCounts.keys()])

  return [...names]
    .map((name) => {
      const count = currentCounts.get(name) ?? 0
      const previousCount = previousCounts.get(name) ?? 0
      const delta = count - previousCount
      return {
        name,
        count,
        previousCount,
        delta,
        deltaPercent: getPercentChange(count, previousCount),
      }
    })
    .sort(
      (a, b) =>
        Math.abs(b.delta) - Math.abs(a.delta) ||
        b.count - a.count ||
        a.name.localeCompare(b.name, 'ru')
    )
    .slice(0, limit)
    .sort((a, b) => b.delta - a.delta || b.count - a.count)
}

function buildOrderedComparison(current, previous, getKey, names) {
  const currentCounts = countBy(current, getKey)
  const previousCounts = countBy(previous, getKey)

  return names.map((name) => {
    const count = currentCounts.get(name) ?? 0
    const previousCount = previousCounts.get(name) ?? 0
    return {
      name,
      count,
      previousCount,
      delta: count - previousCount,
      deltaPercent: getPercentChange(count, previousCount),
    }
  })
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

export { RUBRIC_VOCABULARY, classifyByContent }
