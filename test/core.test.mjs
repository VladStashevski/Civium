import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDashboardData,
  normalizeManualRecord,
} from '../scripts/complaints-parser.mjs'
import {
  buildReferenceData,
  getRecordKey,
  mergeExcelRowsIntoStore,
  migrateAppealsStore,
  normalizeAppealExcelRows,
  pickManualFields,
  readAppealExcelRows,
} from '../scripts/appeals-store.mjs'
import { syncAnnotationTimestamps } from '../scripts/appeal-annotations.mjs'
import { normalizePosRecords } from '../scripts/pos-parser.mjs'
import { mergePosRecords } from '../scripts/pos-store.mjs'
import {
  DEPARTMENT_BY_NAME,
  DEPARTMENT_GROUPS,
  DEPARTMENT_OPTIONS,
} from '../scripts/departments.mjs'
import XLSX from 'xlsx'

test('manual records receive unique generated identifiers', () => {
  const records = Array.from({ length: 100 }, () =>
    normalizeManualRecord({ content: 'Тестовое обращение' })
  )

  assert.equal(new Set(records.map((record) => record.id)).size, records.length)
  assert.equal(new Set(records.map((record) => record.uid)).size, records.length)
})

test('dashboard keeps unknown justification separate from unjustified', () => {
  const records = [
    makeRecord('1', true),
    makeRecord('2', false),
    makeRecord('3', undefined),
  ]

  const dashboard = buildDashboardData(records)

  assert.equal(dashboard.summary.justifiedCount, 1)
  assert.equal(dashboard.summary.unjustifiedCount, 1)
  assert.equal(dashboard.summary.justificationMissingCount, 1)
  assert.deepEqual(
    dashboard.byJustification.map(({ name, count }) => ({ name, count })),
    [
      { name: 'Обоснованные', count: 1 },
      { name: 'Необоснованные', count: 1 },
      { name: 'Не определено', count: 1 },
    ]
  )
})

test('dashboard includes classified profiles without a raw Excel rubric', () => {
  const records = [
    { ...makeRecord('1'), profile: 'Рубрика из Excel', rawRubric: 'Рубрика из Excel' },
    { ...makeRecord('2'), profile: 'Рубрика классификатора', rawRubric: '' },
  ]

  const dashboard = buildDashboardData(records)

  assert.equal(dashboard.summary.profileCount, 2)
  assert.deepEqual(
    dashboard.byProfile.map(({ name, count }) => ({ name, count })),
    [
      { name: 'Рубрика из Excel', count: 1 },
      { name: 'Рубрика классификатора', count: 1 },
    ]
  )
})

test('dashboard excludes gratitude from analytical totals but counts it separately', () => {
  const records = [
    { ...makeRecord('07/19-ОГ-1'), content: 'Жалоба на лечение' },
    {
      ...makeRecord('07/19-ОГ-2'),
      content: 'Благодарность врачу и медицинским сестрам',
      profile: 'Лечение и оказание медицинской помощи',
      rawRubric: '',
    },
    {
      ...makeRecord('07/19-ОГ-3'),
      dateIso: '2024-01-01',
      year: 2024,
      content: 'Благодарственное письмо отделению',
      profile: 'Лечение и оказание медицинской помощи',
      rawRubric: '',
    },
  ]

  const dashboard = buildDashboardData(records)

  assert.equal(dashboard.total, 1)
  assert.equal(dashboard.summary.gratitudeCount, 1)
  assert.equal(dashboard.comparison.previousSummary.gratitudeCount, 1)
  assert.equal(dashboard.summary.profileCount, 1)
  assert.deepEqual(
    dashboard.byProfile.map(({ name, count }) => ({ name, count })),
    [{ name: 'Тестовая рубрика', count: 1 }]
  )
})

test('dashboard compares current and previous years through the same date', () => {
  const records = [
    { ...makeRecord('2025-1'), dateIso: '2025-06-08', year: 2025 },
    { ...makeRecord('2025-2'), dateIso: '2025-06-20', year: 2025 },
    { ...makeRecord('2026-1'), dateIso: '2026-06-09', year: 2026 },
    { ...makeRecord('2026-2'), dateIso: '2026-01-15', year: 2026 },
  ]

  const dashboard = buildDashboardData(records)

  assert.equal(dashboard.comparison.currentYear, 2026)
  assert.equal(dashboard.comparison.previousYear, 2025)
  assert.equal(dashboard.comparison.cutoffMonthDay, '06-09')
  assert.equal(dashboard.comparison.currentTotal, 2)
  assert.equal(dashboard.comparison.previousTotal, 1)
  assert.equal(dashboard.total, 2)
  assert.equal(
    dashboard.byMonth.find((row) => row.month === '06').previousCount,
    1
  )
})

test('references include all department profiles and departments with zero counts', () => {
  const references = buildReferenceData([])

  // Справочник отзеркаливает таксономию из departments.mjs — сверяем с ней,
  // а не с захардкоженными числами, чтобы тест не ломался при правке структуры.
  assert.equal(references.profiles.length, DEPARTMENT_GROUPS.length)
  assert.equal(references.departments.length, DEPARTMENT_OPTIONS.length)
  assert.deepEqual(
    references.profiles.map((profile) => [profile.name, profile.count]),
    DEPARTMENT_GROUPS.map((group) => [group.profile, 0]),
  )
  for (const option of DEPARTMENT_OPTIONS) {
    assert.ok(
      references.departments.some(
        (department) =>
          department.name === option.value &&
          department.profile === option.profile &&
          department.count === 0,
      ),
      `в справочнике нет отделения с нулевым счётом: ${option.value}`,
    )
  }
})

test('references count department profiles by current-year months', () => {
  const references = buildReferenceData([
    {
      ...makeRecord('2026-1'),
      dateIso: '2026-03-05',
      year: 2026,
      departments: ['Неврологическое отделение'],
    },
  ])
  const neuroProfile = DEPARTMENT_BY_NAME.get('Неврологическое отделение').profile
  const profile = references.profiles.find((item) => item.name === neuroProfile)

  assert.equal(profile.years[2026], 1)
  assert.equal(profile.months[2026]['03'], 1)
})

test('references keep gratitude in rubric and theme taxonomy only', () => {
  const complaint = {
    ...makeRecord('2026-complaint'),
    dateIso: '2026-01-10',
    year: 2026,
    appealMode: 'external',
    sourceOrganizationDetail: 'Источник жалобы',
    rubricCanonicalName: 'Лечение и оказание медицинской помощи',
    rubricName: 'Лечение и оказание медицинской помощи',
    rubricTheme: 'Качество и оказание медицинской помощи',
  }
  const gratitude = {
    ...makeRecord('2026-gratitude'),
    dateIso: '2026-01-11',
    year: 2026,
    appealMode: 'external',
    sourceOrganizationDetail: 'Источник благодарности',
    content: 'Благодарность врачу и медицинским сестрам',
    rubricCanonicalName: 'Лечение и оказание медицинской помощи',
    rubricName: 'Лечение и оказание медицинской помощи',
    rubricTheme: 'Качество и оказание медицинской помощи',
  }

  const references = buildReferenceData([complaint], {
    taxonomyRecords: [complaint, gratitude],
  })
  const theme = references.themes.find(
    (item) => item.name === 'Благодарности и положительная обратная связь',
  )
  const rubric = references.rubrics.find(
    (item) =>
      item.name ===
      'Благодарности, пожелания сотрудникам подведомственных учреждений',
  )

  assert.equal(theme.years[2026], 1)
  assert.equal(rubric.years[2026], 1)
  assert.equal(
    references.sources.some((item) => item.name === 'Источник благодарности'),
    false,
  )
})

test('store migration removes synthetic appeal status', () => {
  const store = migrateAppealsStore({
    records: [{ ...makeRecord('1'), status: 'active' }],
  })

  assert.equal(store.records[0].status, undefined)
  assert.equal(JSON.stringify(store).includes('"status":"active"'), false)
})

test('store separates registration route, source organization and channel', () => {
  const store = migrateAppealsStore({
    records: [
      {
        ...makeRecord('07/19-ОГ-1'),
        delivery: 'E-mail',
        documentSource: 'Обращения на имя главного врача',
      },
      {
        ...makeRecord('07-ОГ-2'),
        delivery: 'СЭДД',
        supportDocument:
          'Прокуратура города Сургута - Исх. № 123 от 01.01.2025',
        documentSource: 'Органы прокуратуры',
      },
      {
        ...makeRecord('01-ОГ-3'),
        delivery: 'Почта',
        documentSource: 'Органы прокуратуры',
      },
      {
        ...makeRecord('07-ОГ-4'),
        supportDocument:
          'Администрация Президента Российской Федерации - Исх. № 456',
        documentSource: 'Обращения на имя главного врача',
      },
      {
        ...makeRecord('07-ОГ-5'),
        recipient: 'Департамент здравоохранения Ханты-Мансийского автономного округа – Югры',
        delivery: 'СЭВ',
        groupIndex: '07',
        siteAppealNumber: '8282516',
      },
      {
        ...makeRecord('01-ОГ-6'),
        recipient: 'Губернатор Ханты-Мансийского автономного округа - Югры',
        delivery: 'СЭВ',
        groupIndex: '01',
        siteAppealNumber: '10920956',
      },
      {
        ...makeRecord('07-ОГ-7'),
        supportDocument:
          'Администрация города Сургута - Исх. № 123 от 01.01.2025',
        delivery: 'СЭВ',
        groupIndex: '07',
      },
    ],
  })

  const [
    chiefDoctor,
    department,
    governor,
    president,
    departmentSite,
    governorSite,
    municipal,
  ] = store.records

  assert.equal(chiefDoctor.appealMode, 'chiefDoctor')
  assert.equal(chiefDoctor.registrationRoute, '07/19 — главный врач')
  assert.equal(chiefDoctor.sourceChannel, 'E-mail')
  assert.match(chiefDoctor.sourceOrganization, /Непосредственно от заявителя/)
  assert.equal(chiefDoctor.sourceOrganizationDetail, 'E-mail')

  assert.equal(department.appealMode, 'external')
  assert.equal(department.registrationRoute, '07-* — Депздрав Югры')
  assert.equal(department.sourceOrganization, 'Органы прокуратуры')
  assert.equal(department.sourceOrganizationDetail, 'Прокуратура города Сургута')
  assert.equal(department.sourceChannel, 'СЭДД')

  assert.equal(governor.registrationRoute, '01-* — Губернатор Югры')
  assert.equal(governor.sourceOrganization, 'Органы прокуратуры')

  assert.equal(president.registrationRoute, '07-* — Депздрав Югры')
  assert.equal(president.sourceOrganization, 'Администрация Президента РФ')

  assert.equal(departmentSite.registrationRoute, '07-* — Депздрав Югры')
  assert.equal(
    departmentSite.sourceOrganization,
    'Департамент здравоохранения ХМАО-Югры',
  )
  assert.equal(departmentSite.sourceChannel, 'СЭВ')

  assert.equal(governorSite.registrationRoute, '01-* — Губернатор Югры')
  assert.equal(
    governorSite.sourceOrganization,
    'Аппарат Губернатора и Правительства ХМАО-Югры',
  )
  assert.equal(governorSite.sourceChannel, 'СЭВ')

  assert.equal(municipal.registrationRoute, '07-* — Депздрав Югры')
  assert.equal(municipal.sourceOrganization, 'Иные органы власти ХМАО-Югры')
  assert.equal(municipal.sourceOrganizationDetail, 'Администрация города Сургута')

  const externalSources = buildReferenceData(
    store.records.filter((record) => record.appealMode === 'external'),
  ).sources.map((source) => source.name)
  assert.ok(externalSources.includes('Администрация города Сургута'))
  assert.equal(externalSources.includes('Иные органы власти ХМАО-Югры'), false)
})

test('reimport replaces the Excel snapshot and preserves manual data', () => {
  const firstImport = mergeExcelRowsIntoStore(
    { records: [], imports: [] },
    [
      makeExcelRow('07/19-ОГ-1', 'Лично', 'Первоначальный текст'),
      makeExcelRow('07/19-ОГ-2', 'Почта', 'Устаревшая запись'),
    ],
    {
      importId: 'import-1',
      sourceFile: 'first.xls',
      storedFilename: 'first.xls',
    }
  )

  const annotated = firstImport.store.records.find(
    (record) => record.id === '07/19-ОГ-1'
  )
  annotated.manualFields = {
    isJustified: true,
    notes: 'Проверено вручную',
    issues: 'Выявлена задержка записи, пациент записан повторно',
    departments: ['Неврология'],
    annotationCreatedAt: '2026-06-17T08:00:00.000Z',
    annotationUpdatedAt: '2026-06-17T09:00:00.000Z',
  }
  firstImport.store.records.push({
    ...makeRecord('MANUAL-1'),
    uid: 'manual:MANUAL-1',
    origin: 'manual',
  })

  const secondImport = mergeExcelRowsIntoStore(
    firstImport.store,
    [
      makeExcelRow('07/19-ОГ-1', 'E-mail', 'Обновлённый текст'),
      makeExcelRow('07/19-ОГ-3', 'Курьер', 'Новая запись'),
    ],
    {
      importId: 'import-2',
      sourceFile: 'second.xls',
      storedFilename: 'second.xls',
    }
  )

  assert.equal(secondImport.addedCount, 1)
  assert.equal(secondImport.updatedCount, 1)
  assert.equal(secondImport.removedCount, 1)
  assert.equal(secondImport.keptExistingCount, 1)
  assert.equal(secondImport.preservedManualFieldsCount, 1)
  assert.deepEqual(
    secondImport.store.records.map((record) => record.id).sort(),
    ['07/19-ОГ-1', '07/19-ОГ-3', 'MANUAL-1']
  )

  const updated = secondImport.store.records.find(
    (record) => record.id === '07/19-ОГ-1'
  )
  assert.equal(updated.content, 'Обновлённый текст')
  assert.equal(updated.sourceChannel, 'E-mail')
  assert.equal(updated.manualFields.isJustified, true)
  assert.equal(updated.manualFields.notes, 'Проверено вручную')
  assert.equal(
    updated.manualFields.issues,
    'Выявлена задержка записи, пациент записан повторно'
  )
  assert.deepEqual(updated.manualFields.departments, ['Неврология'])
  assert.equal(updated.manualFields.annotationCreatedAt, '2026-06-17T08:00:00.000Z')
  assert.equal(updated.manualFields.annotationUpdatedAt, '2026-06-17T09:00:00.000Z')
  assert.equal(updated.importHistory.length, 2)

  const dashboard = buildDashboardData(secondImport.store.records)
  assert.deepEqual(
    dashboard.byChiefDoctorChannel.map(({ name, count }) => ({ name, count })),
    [
      { name: 'E-mail', count: 1 },
      { name: 'Курьер', count: 1 },
    ]
  )
})

test('inspection-only appeal annotation keeps timestamps', () => {
  const manualFields = { inspection: 'vnk' }

  syncAnnotationTimestamps(manualFields, '2026-06-17T10:00:00.000Z')

  assert.equal(manualFields.annotationCreatedAt, '2026-06-17T10:00:00.000Z')
  assert.equal(manualFields.annotationUpdatedAt, '2026-06-17T10:00:00.000Z')
})

test('appeal manual field picker whitelists and normalizes request data', () => {
  const manualFields = pickManualFields({
    manualFields: {
      annotationCreatedAt: '2020-01-01T00:00:00.000Z',
      hidden: 'should not be stored',
      isJustified: 'false',
      notes: '  Проверено  ',
      departments: ['Невро', '', 'Неврологическое отделение'],
      inspection: 'bad-value',
    },
    isJustified: false,
    inspection: 'vnk',
  })

  assert.deepEqual(manualFields, {
    notes: 'Проверено',
    isJustified: false,
    inspection: 'vnk',
    departments: ['Неврологическое отделение'],
  })
})

test('appeal import keeps rows without registration number distinct', () => {
  const result = mergeExcelRowsIntoStore(
    { records: [], imports: [] },
    [
      makeExcelRow('', 'E-mail', 'Первое обращение без номера'),
      makeExcelRow('', 'Почта', 'Второе обращение без номера'),
    ],
    {
      importId: 'no-rk-import',
      sourceFile: 'no-rk.xls',
      storedFilename: 'no-rk.xls',
    },
  )

  assert.equal(result.importedRecords.length, 2)
  assert.equal(result.duplicateCount, 0)
  assert.equal(result.store.records.length, 2)
  assert.equal(
    new Set(result.store.records.map((record) => getRecordKey(record))).size,
    2,
  )
})

test('appeal import handles PrintResult-style duplicated headers', () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      'Вид',
      '№ РК',
      'Дата рег.',
      'Содержание',
      'Корр./Подписал',
      'Файлы',
      'Рубрика',
      'Вид',
      '№ РК',
      'Дата рег.',
      'Содержание',
      'План (РК)',
      'Факт (РК)',
      'Группа документов - индекс',
      'Сопровод. документ',
      'Кому',
      'Рубрика',
      'Вид доставки РК',
      'Сообщение ПОС №',
      'От',
    ],
    [
      'Гр',
      '07/19-ОГ-10',
      '12.01.2026',
      'Жалоба на лечение в неврологическом отделении',
      'Иванов Иван - Сургут',
      '',
      '',
      'Гр',
      '07/19-ОГ-10',
      '12.01.2026',
      'Жалоба на лечение в неврологическом отделении',
      '10.02.2026',
      '',
      '07/19-ОГ',
      'Проект 07/19-ОТ-15 от 14/01/2026',
      '',
      '(0002.0014.0143.0416) Качество оказания медицинской помощи взрослым в стационарных условиях',
      'E-mail',
      '',
      '',
    ],
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')

  const rows = readAppealExcelRows(XLSX.write(workbook, { type: 'buffer', bookType: 'xls' }))
  const records = normalizeAppealExcelRows(rows, {
    sourceFile: 'PrintResult.xls',
    importId: 'print-result-test',
  })

  assert.equal(records.length, 1)
  assert.equal(records[0].id, '07/19-ОГ-10')
  assert.equal(records[0].dateIso, '2026-01-12')
  assert.equal(records[0].sourceChannel, 'E-mail')
  assert.equal(
    records[0].profile,
    'Качество оказания медицинской помощи взрослым в стационарных условиях'
  )
  assert.equal(records[0].rubricTheme, 'Качество и оказание медицинской помощи')
  assert.deepEqual(records[0].departments, ['Неврологическое отделение'])
})

test('pos import recognizes feedback platform export headers', () => {
  const rows = readRowsFromWorkbook([
    [
      'Номер',
      'Номер ЕПГУ',
      'Источник',
      'Верхнеуровневый ЛКО',
      'Категория',
      'Подкатегория',
      'Факт',
      'Организация, в которую поступило сообщение',
      'Организация, в которой находится сообщение',
      'Дата поступления',
      'Дата планируемого завершения работ',
      'Дата фактического завершения работ',
      'Стадия',
      'Статус',
      'Просрочено',
      'Фаст-трек',
      'ФЗ',
      'Заявитель выбрал подачу по 59-ФЗ',
      'Тип решения',
      'Направлено по email в ФОИВ, не подключенный к ПОС',
      'Оценка ответа заявителем',
      'Повторное рассмотрение',
      'ФИО координатора',
      'ФИО исполнителя',
      'ФИО руководителя',
    ],
    [
      '327441806',
      '6668478383',
      'MED_DOC_EPGU',
      'Ханты-Мансийский автономный округ - Югра',
      'Медицина',
      'Медицинская карта',
      'Медицинская карта',
      'Ханты-Мансийский автономный округ - Югра',
      'БУ "СУРГУТСКАЯ ОКРУЖНАЯ КЛИНИЧЕСКАЯ БОЛЬНИЦА"',
      '06.01.2026',
      '16.01.2026',
      '07.01.2026',
      'Завершено',
      'Отправлен ответ заявителю',
      'Нет',
      'Да',
      'Обычное сообщение',
      'Нет',
      'Решено',
      '-',
      '5',
      '-',
      'Координатор',
      'Исполнитель',
      'Руководитель',
    ],
  ])

  const records = normalizePosRecords(rows, {
    sourceFile: 'pos.xlsx',
    importId: 'pos-import',
  })

  assert.equal(records.length, 1)
  assert.equal(records[0].uid, '327441806')
  assert.equal(records[0].dateIso, '2026-01-06')
  assert.equal(records[0].plannedIso, '2026-01-16')
  assert.equal(records[0].completedIso, '2026-01-07')
  assert.equal(records[0].rating, 5)
})

test('pos reimport enriches shared store and preserves manual fields', () => {
  const first = mergePosRecords(
    { records: [], imports: [] },
    [
      makePosRecord('100', '2026-01-01'),
      makePosRecord('200', '2026-01-02'),
    ],
    { importId: 'pos-1', sourceFile: 'first.xlsx' },
  )
  first.store.records.find((record) => record.uid === '100').manualFields = {
    isJustified: true,
    issues: 'Задержка ответа',
    notes: 'Проверено',
    departments: ['Неврологическое отделение'],
  }

  const second = mergePosRecords(
    first.store,
    [
      makePosRecord('100', '2026-02-01'),
      makePosRecord('300', '2026-02-03'),
    ],
    { importId: 'pos-2', sourceFile: 'second.xlsx' },
  )

  assert.equal(second.addedCount, 1)
  assert.equal(second.updatedCount, 1)
  // Импорт ПОС additive: запись «200» из прошлой выгрузки сохраняется (она ниже
  // в списке records), поэтому удалённых нет, а сохранённая учтена отдельно.
  assert.equal(second.removedCount, 0)
  assert.equal(second.preservedManualFieldsCount, 1)
  assert.equal(second.keptExistingCount, 1)
  assert.deepEqual(
    second.store.records.map((record) => record.uid).sort(),
    ['100', '200', '300'],
  )
  assert.equal(
    second.store.records.find((record) => record.uid === '100').manualFields.notes,
    'Проверено',
  )
  assert.equal(
    second.store.records.find((record) => record.uid === '100').manualFields.isJustified,
    true,
  )
  assert.deepEqual(
    second.store.records.find((record) => record.uid === '100').manualFields.departments,
    ['Неврологическое отделение'],
  )
})

function makeRecord(id, isJustified) {
  return {
    uid: `excel:2025:${id}`,
    id,
    dateIso: '2025-01-01',
    content: `Обращение ${id}`,
    correspondent: 'Заявитель',
    profile: 'Тестовая рубрика',
    source: 'Непосредственно от заявителя',
    rawRubric: '',
    origin: 'excel',
    manualFields:
      isJustified === undefined ? {} : { isJustified },
  }
}

function makeExcelRow(id, delivery, content) {
  return {
    '№ РК': id,
    'Дата рег.': '01.01.2025',
    Содержание: content,
    'Корр./Подписал': 'Иванов Иван - Сургут',
    'Вид доставки РК': delivery,
    'Группа документов - индекс': '07/19-ОГ',
  }
}

function readRowsFromWorkbook(rows) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return XLSX.utils.sheet_to_json(
    XLSX.read(buffer, { type: 'buffer' }).Sheets.Sheet1,
    { raw: false, defval: '' },
  )
}

function makePosRecord(uid, dateIso) {
  return {
    uid,
    number: uid,
    dateIso,
    year: Number(dateIso.slice(0, 4)),
    month: Number(dateIso.slice(5, 7)),
    origin: 'excel',
    manualFields: {},
  }
}
