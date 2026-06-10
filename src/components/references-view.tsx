import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReferences } from '@/hooks/use-appeals'

function CountCell({ value }: { value: number }) {
  return (
    <TableCell className="w-20 text-right tabular-nums text-muted-foreground">
      {value}
    </TableCell>
  )
}

function byCountDesc<T extends { count: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.count - a.count)
}

export function ReferencesView() {
  const { data, isPending } = useReferences()

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Справочники</CardTitle>
          <CardDescription>
            Канонические рубрики, темы, источники и отделения из классификатора
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending || !data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="rubrics" className="gap-4">
              <TabsList>
                <TabsTrigger value="rubrics">
                  Рубрики
                  <Badge variant="secondary" className="ml-1.5">
                    {data.rubrics.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="themes">
                  Темы
                  <Badge variant="secondary" className="ml-1.5">
                    {data.themes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="sources">
                  Источники
                  <Badge variant="secondary" className="ml-1.5">
                    {data.sources.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="departments">
                  Отделения
                  <Badge variant="secondary" className="ml-1.5">
                    {data.departments.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rubrics">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Рубрика</TableHead>
                        <TableHead>Тема</TableHead>
                        <TableHead className="w-[180px]">Код</TableHead>
                        <TableHead className="w-20 text-right">Обращений</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCountDesc(data.rubrics).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.theme ?? '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.code ?? '—'}
                          </TableCell>
                          <CountCell value={r.count} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="themes">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[280px]">Тема</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead className="w-20 text-right">Обращений</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCountDesc(data.themes).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.description ?? '—'}
                          </TableCell>
                          <CountCell value={t.count} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="sources">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Источник</TableHead>
                        <TableHead className="w-[160px]">Статус</TableHead>
                        <TableHead className="w-20 text-right">Обращений</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCountDesc(data.sources).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {s.status ?? '—'}
                          </TableCell>
                          <CountCell value={s.count} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="departments">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Отделение</TableHead>
                        <TableHead className="w-20 text-right">Обращений</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byCountDesc(data.departments).map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <CountCell value={d.count} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
