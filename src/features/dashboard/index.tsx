import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Activity,
  FilePlus2,
  FileText,
  LogOut,
  Route,
  Tags,
  Upload,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { signOut } from '@/lib/simple-auth'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import fallbackDashboardData from './data/complaints-dashboard.json'

type CountItem = {
  name: string
  count: number
  share: number
}

type DashboardRecord = {
  uid?: string
  id: string
  registeredAt: string
  dateIso: string
  content: string
  correspondent: string
  location: string
  profile: string
  intent: string
  source: string
  recipient: string
  origin?: 'excel' | 'manual'
  sourceFile?: string
  rowNumber?: number | null
}

type DashboardData = typeof fallbackDashboardData & {
  summary: typeof fallbackDashboardData.summary & {
    manualCount?: number
    excelCount?: number
  }
  recent: DashboardRecord[]
}

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const numberFormat = new Intl.NumberFormat('ru-RU')

export function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData>(
    fallbackDashboardData as DashboardData
  )
  const [apiState, setApiState] = useState<'loading' | 'online' | 'offline'>(
    'loading'
  )

  const reloadDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) throw new Error('Dashboard API failed')
      setDashboardData((await response.json()) as DashboardData)
      setApiState('online')
    } catch {
      setDashboardData(fallbackDashboardData as DashboardData)
      setApiState('offline')
    }
  }

  useEffect(() => {
    let cancelled = false

    fetch('/api/dashboard')
      .then((response) => {
        if (!response.ok) throw new Error('Dashboard API failed')
        return response.json() as Promise<DashboardData>
      })
      .then((data) => {
        if (cancelled) return
        setDashboardData(data)
        setApiState('online')
      })
      .catch(() => {
        if (cancelled) return
        setDashboardData(fallbackDashboardData as DashboardData)
        setApiState('offline')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const monthTrend = useMemo(
    () =>
      dashboardData.byMonth.map((item) => ({
        ...item,
        label: formatMonthLabel(item.month),
      })),
    [dashboardData.byMonth]
  )
  const profileChart = dashboardData.byProfile.slice(0, 8)
  const sourceChart = dashboardData.bySource.slice(0, 6)
  const locationChart = dashboardData.byLocation.slice(0, 8)

  return (
    <>
      <Header fixed>
        <div className='me-auto min-w-0'>
          <p className='truncate text-sm font-medium'>
            Дашборд обращений граждан
          </p>
          <p className='truncate text-xs text-muted-foreground'>
            {apiState === 'online'
              ? `Backend API: ${dashboardData.sourceFile}`
              : 'Локальный fallback без backend API'}
          </p>
        </div>
        <ThemeSwitch />
        <Button variant='outline' size='sm' onClick={signOut}>
          <LogOut />
          Выйти
        </Button>
      </Header>

      <Main fluid className='space-y-4 px-6 lg:px-8'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
          <div className='flex flex-col gap-1'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Статистика обращений граждан
            </h1>
            <p className='text-sm text-muted-foreground'>
              Период: {formatDate(dashboardData.dateRange.from)} -{' '}
              {formatDate(dashboardData.dateRange.to)}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <UploadExcelDialog
              disabled={apiState !== 'online'}
              onChanged={reloadDashboard}
            />
            <AddAppealDialog
              disabled={apiState !== 'online'}
              onChanged={reloadDashboard}
            />
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            title='Всего обращений'
            value={dashboardData.total}
            description={`${dashboardData.summary.excelCount ?? dashboardData.total} из Excel, ${dashboardData.summary.manualCount ?? 0} вручную`}
            icon={FileText}
          />
          <MetricCard
            title='К главному врачу'
            value={dashboardData.summary.chiefDoctorCount}
            description={`${getShare(dashboardData, dashboardData.summary.chiefDoctorCount)}% от общего потока`}
            icon={Activity}
          />
          <MetricCard
            title='Через ведомства'
            value={dashboardData.summary.redirectedCount}
            description={`${getShare(dashboardData, dashboardData.summary.redirectedCount)}% от общего потока`}
            icon={Route}
          />
          <MetricCard
            title='Профилей жалоб'
            value={dashboardData.summary.profileCount}
            description='Рубрики и автоклассификация'
            icon={Tags}
          />
        </div>

        <div className='grid grid-cols-1 gap-4'>
          <Card>
            <CardHeader>
              <CardTitle>Динамика обращений</CardTitle>
              <CardDescription>Количество регистраций по месяцам</CardDescription>
            </CardHeader>
            <CardContent className='h-72'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart
                  data={monthTrend}
                  margin={{ top: 10, right: 48, left: -10, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray='3 3' vertical={false} />
                  <XAxis
                    dataKey='label'
                    interval={0}
                    minTickGap={0}
                    padding={{ left: 24, right: 24 }}
                    tickMargin={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line
                    type='monotone'
                    dataKey='count'
                    name='Обращения'
                    stroke='var(--chart-1)'
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Откуда поступило письмо</CardTitle>
              <CardDescription>Главный врач, ведомства и другие источники</CardDescription>
            </CardHeader>
            <CardContent className='h-72'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={sourceChart}
                    dataKey='count'
                    nameKey='name'
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {sourceChart.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Профили жалоб</CardTitle>
              <CardDescription>Топ рубрик и тематик обращений</CardDescription>
            </CardHeader>
            <CardContent className='h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={profileChart}
                  layout='vertical'
                  margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray='3 3' horizontal={false} />
                  <XAxis type='number' allowDecimals={false} />
                  <YAxis
                    type='category'
                    dataKey='name'
                    width={190}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={shortLabel}
                  />
                  <Tooltip />
                  <Bar dataKey='count' name='Обращения' fill='var(--chart-2)' />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>География заявителей</CardTitle>
              <CardDescription>Населенные пункты из поля корреспондента</CardDescription>
            </CardHeader>
            <CardContent className='h-80'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={locationChart}
                  margin={{ top: 10, right: 20, left: -20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray='3 3' vertical={false} />
                  <XAxis
                    dataKey='name'
                    interval={0}
                    angle={-20}
                    textAnchor='end'
                    tickMargin={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={shortLabel}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey='count' name='Обращения' fill='var(--chart-3)' />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-4 xl:grid-cols-7'>
          <Card className='xl:col-span-3'>
            <CardHeader>
              <CardTitle>Типы обращений</CardTitle>
              <CardDescription>Автоклассификация по содержанию</CardDescription>
            </CardHeader>
            <CardContent>
              <RankedList items={dashboardData.byIntent.slice(0, 8)} />
            </CardContent>
          </Card>

          <Card className='xl:col-span-4'>
            <CardHeader>
              <CardTitle>Последние обращения</CardTitle>
              <CardDescription>Excel-строка или ручной ввод сохраняются в источнике</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[110px]'>Дата</TableHead>
                    <TableHead>Профиль</TableHead>
                    <TableHead>Источник</TableHead>
                    <TableHead className='text-right'>№ РК</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.recent.slice(0, 8).map((record) => (
                    <TableRow key={record.uid ?? record.id}>
                      <TableCell>{record.registeredAt}</TableCell>
                      <TableCell className='max-w-[260px] truncate'>
                        {record.profile}
                      </TableCell>
                      <TableCell className='max-w-[260px] truncate text-muted-foreground'>
                        {record.origin === 'manual'
                          ? 'Ручное добавление'
                          : record.source}
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {record.id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}

function UploadExcelDialog({
  disabled,
  onChanged,
}: {
  disabled: boolean
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/imports/excel', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Import failed')
      await onChanged()
      setFile(null)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' disabled={disabled}>
          <Upload />
          Загрузить Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузка Excel</DialogTitle>
          <DialogDescription>
            Новые строки обновят данные из Excel по номеру РК, ручные записи
            останутся отдельно.
          </DialogDescription>
        </DialogHeader>
        <form className='space-y-4' onSubmit={handleSubmit}>
          <div className='space-y-2'>
            <Label htmlFor='excel-file'>Файл .xls или .xlsx</Label>
            <Input
              id='excel-file'
              type='file'
              accept='.xls,.xlsx'
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={!file || loading}>
              {loading ? 'Загрузка...' : 'Импортировать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddAppealDialog({
  disabled,
  onChanged,
}: {
  disabled: boolean
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = Object.fromEntries(form.entries())

    setLoading(true)
    try {
      const response = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Create appeal failed')
      await onChanged()
      event.currentTarget.reset()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <FilePlus2 />
          Добавить обращение
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Ручное обращение</DialogTitle>
          <DialogDescription>
            Запись сохранится в backend-хранилище и не изменит исходный Excel.
          </DialogDescription>
        </DialogHeader>
        <form className='grid gap-4' onSubmit={handleSubmit}>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='№ РК'>
              <Input name='id' placeholder='manual-001' />
            </Field>
            <Field label='Дата регистрации'>
              <Input name='registeredAt' type='date' />
            </Field>
            <Field label='Корреспондент'>
              <Input name='correspondent' placeholder='ФИО - город' />
            </Field>
            <Field label='Город'>
              <Input name='location' placeholder='Сургут' />
            </Field>
            <Field label='Профиль'>
              <Input name='profile' placeholder='Жалобы и проверки качества' />
            </Field>
            <Field label='Источник'>
              <Input name='source' placeholder='Обращение к главному врачу' />
            </Field>
            <Field label='Кому'>
              <Input name='recipient' placeholder='Главный врач' />
            </Field>
            <Field label='Тип обращения'>
              <Input name='intent' placeholder='Жалоба' />
            </Field>
          </div>
          <Field label='Содержание'>
            <Textarea name='content' required className='min-h-28' />
          </Field>
          <DialogFooter>
            <Button type='submit' disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: number
  description: string
  icon: typeof FileText
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='size-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{numberFormat.format(value)}</div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  )
}

function RankedList({ items }: { items: CountItem[] }) {
  const max = Math.max(...items.map((item) => item.count), 1)

  return (
    <ul className='space-y-3'>
      {items.map((item) => (
        <li key={item.name}>
          <div className='mb-1 flex items-center justify-between gap-3'>
            <span className='truncate text-sm'>{item.name}</span>
            <span className='text-sm font-medium tabular-nums'>
              {item.count}
            </span>
          </div>
          <div className='h-2 rounded-full bg-muted'>
            <div
              className='h-2 rounded-full bg-primary'
              style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }}
            />
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {item.share}% от общего количества
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatDate(value: string) {
  if (!value) return 'не указано'
  return new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`))
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-')
  return month && year ? `${month}.${year}` : value
}

function getShare(data: DashboardData, value: number) {
  return data.total ? Number(((value / data.total) * 100).toFixed(1)) : 0
}

function shortLabel(value: string) {
  return value.length > 24 ? `${value.slice(0, 24)}...` : value
}
