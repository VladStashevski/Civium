// Парсер выгрузки ПОС (Платформа обратной связи «Госуслуги. Решаем вместе»).
// Структура отличается от базы обращений: свой набор колонок, ключ — «Номер».
import XLSX from 'xlsx'

// Сопоставление полей записи с заголовками колонок в выгрузке. Читаем по имени
// заголовка, а не по индексу, — так порядок колонок в файле может меняться.
const HEADERS = {
  number: 'Номер',
  epguNumber: 'Номер ЕПГУ',
  source: 'Источник',
  region: 'Верхнеуровневый ЛКО',
  category: 'Категория',
  subcategory: 'Подкатегория',
  fact: 'Факт',
  orgReceived: 'Организация, в которую поступило сообщение',
  orgCurrent: 'Организация, в которой находится сообщение',
  dateReceived: 'Дата поступления',
  datePlanned: 'Дата планируемого завершения работ',
  dateCompleted: 'Дата фактического завершения работ',
  stage: 'Стадия',
  status: 'Статус',
  overdue: 'Просрочено',
  fastTrack: 'Фаст-трек',
  fz: 'ФЗ',
  chose59fz: 'Заявитель выбрал подачу по 59-ФЗ',
  resolutionType: 'Тип решения',
  sentByEmail: 'Направлено по email в ФОИВ, не подключенный к ПОС',
  rating: 'Оценка ответа заявителем',
  repeated: 'Повторное рассмотрение',
  coordinator: 'ФИО координатора',
  executor: 'ФИО исполнителя',
  manager: 'ФИО руководителя',
}

/** Читает первый лист книги (Buffer или путь) в массив объектов «заголовок → значение». */
export function readPosExcelRows(filePathOrBuffer) {
  const workbook = Buffer.isBuffer(filePathOrBuffer)
    ? XLSX.read(filePathOrBuffer, { type: 'buffer' })
    : XLSX.readFile(filePathOrBuffer)
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    raw: false,
    defval: '',
  })
}

function clean(value) {
  // схлопываем кратные пробелы (в ФИО встречаются двойные) и режем края
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** «06.01.2026» → «2026-01-06». Пустое / «-» / нераспознанное → ''. */
function toIsoDate(value) {
  const text = clean(value)
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  if (!match) return ''
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

/** «5» → 5, «-»/пусто → null. */
function toRating(value) {
  const text = clean(value)
  const number = Number(text)
  return Number.isFinite(number) && text !== '' && text !== '-' ? number : null
}

/**
 * Сырые строки выгрузки → нормализованные записи ПОС. Строки без «Номера»
 * пропускаются. uid = «Номер» (стабильный ключ для дедупликации и аннотаций).
 */
export function normalizePosRecords(rows, options = {}) {
  const { importId = '', sourceFile = '' } = options
  const now = new Date().toISOString()
  const records = []

  rows.forEach((row, index) => {
    const get = (key) => clean(row[HEADERS[key]])
    const number = get('number')
    if (!number) return

    const dateIso = toIsoDate(row[HEADERS.dateReceived])
    const [year, month] = dateIso ? dateIso.split('-').map(Number) : [0, 0]

    records.push({
      uid: number,
      number,
      epguNumber: get('epguNumber'),
      source: get('source'),
      region: get('region'),
      category: get('category'),
      subcategory: get('subcategory'),
      fact: get('fact'),
      orgReceived: get('orgReceived'),
      orgCurrent: get('orgCurrent'),
      dateIso,
      plannedIso: toIsoDate(row[HEADERS.datePlanned]),
      completedIso: toIsoDate(row[HEADERS.dateCompleted]),
      stage: get('stage'),
      status: get('status'),
      overdue: get('overdue'),
      fastTrack: get('fastTrack'),
      fz: get('fz'),
      chose59fz: get('chose59fz'),
      resolutionType: get('resolutionType'),
      sentByEmail: get('sentByEmail'),
      rating: toRating(row[HEADERS.rating]),
      repeated: get('repeated'),
      coordinator: get('coordinator'),
      executor: get('executor'),
      manager: get('manager'),
      year,
      month,
      origin: 'excel',
      rowNumber: index + 2, // +2: строка 1 — заголовок, индексация с 1
      importId,
      sourceFile,
      manualFields: {},
      createdAt: now,
      updatedAt: now,
    })
  })

  return records
}
