import { ExperimentalAppealFlow } from '@/components/experimental-appeal-flow'
import { ExperimentalChronoPlay } from '@/components/experimental-chrono-play'
import { ExperimentalDepartmentRace } from '@/components/experimental-department-race'
import { ExperimentalPosCockpit } from '@/components/experimental-pos-cockpit'
import { ExperimentalRiskRadar } from '@/components/experimental-risk-radar'
import { ExperimentalTensionHeatmap } from '@/components/experimental-tension-heatmap'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useDashboard } from '@/hooks/use-appeals'
import { usePos } from '@/hooks/use-pos'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import type { AppealMode } from '@/lib/api'

type ShowcaseCard = {
  id: string
  title: string
  description: string
  indicator: string
  status: string
}

export function ExperimentsView({ mode }: { mode: AppealMode }) {
  const reduceMotion = usePrefersReducedMotion()
  const dashboard = useDashboard(mode)
  const pos = usePos()

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const cards: ShowcaseCard[] = [
    {
      id: 'exp-pulse',
      title: 'Пульс года',
      description: 'Анимированное проигрывание года по месяцам',
      indicator: '▶ play',
      status: 'эксперимент',
    },
    {
      id: 'exp-risk',
      title: 'Радар риска',
      description: 'Сводный операционный риск по 5–6 факторам',
      indicator: 'оценка 0–100',
      status: 'эксперимент',
    },
    {
      id: 'exp-heatmap',
      title: 'Тепловая карта напряжения',
      description: 'Нагрузка по месяцам и рубрикам',
      indicator: dashboard.data ? `${dashboard.data.total} обр.` : '—',
      status: 'эксперимент',
    },
    {
      id: 'exp-flow',
      title: 'Маршруты обращений',
      description: 'Источник → рубрика и отделения',
      indicator: 'топ-11 связей',
      status: 'эксперимент',
    },
    {
      id: 'exp-race',
      title: 'Гонка отделений',
      description: 'Динамика по отделениям год к году',
      indicator: dashboard.data ? `сезон ${dashboard.data.comparison.currentYear}` : '—',
      status: 'эксперимент',
    },
    {
      id: 'exp-pos',
      title: 'POS cockpit',
      description: 'Показатели платформы обратной связи',
      indicator: pos.data ? `${pos.data.total} сообщ.` : '—',
      status: 'preview',
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Лаборатория аналитических идей Civium. Виджеты работают на текущих
          данных выбранного контура и не влияют на основные дашборды — это
          площадка для обкатки будущих экранов.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => scrollTo(card.id)}
              className="rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Card className="h-full gap-0 py-4 transition-colors hover:border-primary/40">
                <CardHeader className="gap-1 px-4">
                  <CardTitle className="text-sm">{card.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-3 flex items-center justify-between gap-2 px-4">
                  <Badge variant="secondary" className="font-normal">
                    {card.status}
                  </Badge>
                  <span className="truncate text-xs tabular-nums text-muted-foreground">
                    {card.indicator}
                  </span>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <section id="exp-pulse" className="scroll-mt-20">
        <ExperimentalChronoPlay mode={mode} />
      </section>
      <section id="exp-risk" className="scroll-mt-20">
        <ExperimentalRiskRadar mode={mode} />
      </section>
      <section id="exp-heatmap" className="scroll-mt-20">
        <ExperimentalTensionHeatmap mode={mode} />
      </section>
      <section id="exp-flow" className="scroll-mt-20">
        <ExperimentalAppealFlow mode={mode} />
      </section>
      <section id="exp-race" className="scroll-mt-20">
        <ExperimentalDepartmentRace mode={mode} />
      </section>
      <section id="exp-pos" className="scroll-mt-20">
        <ExperimentalPosCockpit />
      </section>
    </>
  )
}
