import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDashboardData,
  normalizeManualRecord,
} from '../scripts/complaints-parser.mjs'
import {
  mergeExcelRowsIntoStore,
  migrateAppealsStore,
} from '../scripts/appeals-store.mjs'

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
    ],
  })

  const [chiefDoctor, department, governor, president] = store.records

  assert.equal(chiefDoctor.appealMode, 'chiefDoctor')
  assert.equal(chiefDoctor.registrationRoute, 'На имя главного врача (07/19)')
  assert.equal(chiefDoctor.sourceChannel, 'E-mail')
  assert.match(chiefDoctor.sourceOrganization, /Непосредственно от заявителя/)

  assert.equal(department.appealMode, 'external')
  assert.equal(department.registrationRoute, 'Депздрав Югры (07-*)')
  assert.equal(department.sourceOrganization, 'Органы прокуратуры')
  assert.equal(department.sourceChannel, 'СЭДД')

  assert.equal(governor.registrationRoute, 'Губернатор Югры (01-*)')
  assert.equal(governor.sourceOrganization, 'Органы прокуратуры')

  assert.equal(president.registrationRoute, 'Депздрав Югры (07-*)')
  assert.equal(president.sourceOrganization, 'Администрация Президента РФ')
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
