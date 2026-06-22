export const DEPARTMENT_GROUPS = [
  {
    profile: 'Хирургический профиль',
    short: 'Хирург.',
    departments: [
      { name: 'Гинекологическое отделение', aliases: ['Гинекология'] },
      { name: 'Колопроктологическое отделение', aliases: ['Колопроктология'] },
      { name: 'Офтальмологическое отделение', aliases: ['Офтальмология'] },
      { name: 'Оториноларингологическое отделение', aliases: ['ЛОР', 'ЛОР-отделение'] },
      {
        name: 'Отделение челюстно-лицевой хирургии',
        aliases: ['ЧЛХ'],
      },
      { name: 'Хирургическое отделение', aliases: ['Хирургия', 'Хирургическое отделение №1'] },
      {
        name: 'Отделение реанимации и интенсивной терапии',
        aliases: ['Реанимация'],
      },
      { name: 'Урологическое отделение', aliases: ['Урология'] },
      {
        name: 'Хирургическое приемное отделение',
        aliases: ['Приемное хир. отд.', 'Хирургическое приемное'],
      },
      {
        name: 'Отделение сосудистой хирургии',
        aliases: ['Сосуд. хир.', 'Сосудистая хирургия'],
      },
    ],
  },
  {
    profile: 'Терапевтический профиль',
    short: 'Терап.',
    departments: [
      {
        name: 'Гастроэнтерологическое отделение',
        aliases: ['Гастро', 'Гастроэнтерология'],
      },
      { name: 'Гематологическое отделение', aliases: ['Гемато', 'Гематология'] },
      { name: 'Неврологическое сосудистое отделение', aliases: ['НСО'] },
      { name: 'Неврологическое отделение', aliases: ['Невро', 'Неврология'] },
      {
        name: 'Пульмонологическое отделение',
        aliases: ['Пульмо', 'Пульмонология'],
      },
      {
        name: 'Отделение скорой медицинской помощи',
        aliases: ['ОСМП'],
      },
      {
        name: 'Терапевтическое приемное отделение',
        aliases: ['Приёмное', 'Приемное отд.', 'Терапевтическое приемное'],
      },
      {
        name: 'Ревматологическое отделение',
        aliases: ['Ревмато', 'Ревматология'],
      },
      {
        name: 'Отделение реанимации и анестезиологии №1',
        aliases: ['РАО1', 'РАО 1'],
      },
      { name: 'Нефрологическое отделение', aliases: ['Нефро', 'Нефрология'] },
      {
        name: 'Эндокринологическое отделение',
        aliases: ['Эндокр.', 'Эндокринология'],
      },
      { name: 'Отделение диализа', aliases: ['Диализ'] },
      {
        name: 'Отделение медицинской реабилитации',
        aliases: ['Реабил.', 'Отд. мед. реабил.', 'Медицинская реабилитация'],
      },
    ],
  },
  {
    profile: 'Онкологический профиль',
    short: 'Онко',
    departments: [
      {
        name: 'Онкологическое отделение консультативно-диагностической поликлиники',
        aliases: ['Онкол. отд. КДП', 'КДП', 'Онкологическое отделение'],
      },
      {
        name: 'Центр амбулаторной онкологической помощи',
        aliases: ['ЦАОП'],
      },
      {
        name: 'Химиотерапевтическое отделение №1',
        aliases: ['ХТО№1', 'ХТО 1'],
      },
      { name: 'Онкогинекологическое отделение', aliases: ['Онкогинек. отд.'] },
    ],
  },
  {
    profile: 'Инфекционный профиль',
    short: 'Инфекц.',
    departments: [
      { name: 'Инфекционное отделение', aliases: ['Инф. отд.'] },
      {
        name: 'Инфекционное приемное отделение',
        aliases: ['Приемное отд.', 'Инфекционное приемное'],
      },
      {
        name: 'Отделение реанимации и анестезиологии №3',
        aliases: ['РАО3', 'РАО 3'],
      },
    ],
  },
  {
    profile: 'Поликлинический профиль',
    short: 'Поликл.',
    departments: [
      { name: 'Рентгенологическое отделение', aliases: ['Рентген.'] },
      { name: 'Отделение ультразвуковой диагностики', aliases: ['УЗИ'] },
      { name: 'Отделение платных услуг', aliases: ['Платные усл.'] },
      { name: 'Сурдологическое отделение', aliases: ['Сурдология'] },
      {
        name: 'Центр аллергологии и иммунологии',
        aliases: ['Аллергология', 'Иммунология'],
      },
    ],
  },
]

export const DEPARTMENT_OPTIONS = DEPARTMENT_GROUPS.flatMap((group) =>
  group.departments.map((department) => ({
    id: `${group.profile}:${department.name}`,
    name: department.name,
    profile: group.profile,
    value: department.name,
    aliases: [...department.aliases],
  })),
)

export const DEPARTMENT_BY_NAME = new Map(
  DEPARTMENT_OPTIONS.map((option) => [option.value, option]),
)

export const DEPARTMENT_ALIAS_TO_NAME = new Map(
  DEPARTMENT_OPTIONS.flatMap((option) => [
    [option.value.toLocaleLowerCase('ru-RU'), option.value],
    ...option.aliases.map((alias) => [alias.toLocaleLowerCase('ru-RU'), option.value]),
  ]),
)

export function resolveDepartmentName(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return DEPARTMENT_ALIAS_TO_NAME.get(text.toLocaleLowerCase('ru-RU')) ?? text
}
