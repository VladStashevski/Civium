import * as React from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAppeals } from '@/hooks/use-appeals'
import { useIsMobile } from '@/hooks/use-mobile'
import { effectiveDepartments, effectiveSource, shortLabel } from '@/lib/experiments'
import type { Appeal, AppealMode } from '@/lib/api'
import { cn } from '@/lib/utils'

type Route = 'source-profile' | 'source-department' | 'theme-department'

const ROUTE_LABEL: Record<Route, string> = {
  'source-profile': 'Источник → Рубрика',
  'source-department': 'Источник → Отделение',
  'theme-department': 'Тема → Отделение',
}

const TOP_N = 11

function leftOf(appeal: Appeal, route: Route, mode: AppealMode): string {
  if (route === 'theme-department') return appeal.rubricTheme?.trim() || 'Без темы'
  return effectiveSource(appeal, mode)
}

function rightsOf(appeal: Appeal, route: Route): string[] {
  if (route === 'source-profile') return [appeal.profile.trim() || 'Без рубрики']
  const departments = effectiveDepartments(appeal)
  return departments.length ? departments : ['Не указано']
}

type Link = { left: string; right: string; count: number }
type Node = { name: string; total: number; y: number; height: number }

const NODE_W = 200
const RIGHT_X = 560
const VIEW_W = 760
const GAP = 12

function buildNodes(names: Map<string, number>, maxCount: number) {
  const entries = [...names.entries()].sort((a, b) => b[1] - a[1])
  const nodes: Node[] = []
  let y = 0
  for (const [name, total] of entries) {
    const height = 30 + (total / maxCount) * 40
    nodes.push({ name, total, y, height })
    y += height + GAP
  }
  return { nodes, totalHeight: y - GAP }
}

export function ExperimentalAppealFlow({ mode }: { mode: AppealMode }) {
  const { data, isPending } = useAppeals(mode)
  const isMobile = useIsMobile()
  const [route, setRoute] = React.useState<Route>('source-profile')
  const [hover, setHover] = React.useState<string | null>(null)

  const items = React.useMemo(() => data?.items ?? [], [data])

  const model = React.useMemo(() => {
    const pairs = new Map<string, Link>()
    for (const appeal of items) {
      const left = leftOf(appeal, route, mode)
      for (const right of rightsOf(appeal, route)) {
        const key = `${left}|||${right}`
        const existing = pairs.get(key)
        if (existing) existing.count += 1
        else pairs.set(key, { left, right, count: 1 })
      }
    }
    const links = [...pairs.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N)
    if (!links.length) return null

    const leftTotals = new Map<string, number>()
    const rightTotals = new Map<string, number>()
    for (const link of links) {
      leftTotals.set(link.left, (leftTotals.get(link.left) ?? 0) + link.count)
      rightTotals.set(link.right, (rightTotals.get(link.right) ?? 0) + link.count)
    }
    const maxNode = Math.max(1, ...leftTotals.values(), ...rightTotals.values())
    const left = buildNodes(leftTotals, maxNode)
    const right = buildNodes(rightTotals, maxNode)
    const height = Math.max(left.totalHeight, right.totalHeight, 40)
    const offset = (col: { totalHeight: number }) => (height - col.totalHeight) / 2
    const leftPos = new Map(
      left.nodes.map((n) => [n.name, { ...n, y: n.y + offset(left) }]),
    )
    const rightPos = new Map(
      right.nodes.map((n) => [n.name, { ...n, y: n.y + offset(right) }]),
    )
    const maxLink = Math.max(...links.map((l) => l.count))
    return { links, leftPos, rightPos, height, maxLink }
  }, [items, route, mode])

  const isDimmed = (name: string, link: Link) =>
    hover !== null && hover !== name && hover !== link.left && hover !== link.right

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Маршруты обращений</CardTitle>
          <CardDescription>
            Куда стекаются обращения — топ-{TOP_N} связей выбранного маршрута
          </CardDescription>
          <CardAction className="col-span-full col-start-1 row-start-3 justify-self-start sm:col-span-auto sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            <ToggleGroup
              type="single"
              variant="outline"
              value={route}
              onValueChange={(value) => value && setRoute(value as Route)}
              className="flex-wrap"
            >
              {(Object.keys(ROUTE_LABEL) as Route[]).map((key) => (
                <ToggleGroupItem key={key} value={key} className="h-8 px-3 text-xs">
                  {ROUTE_LABEL[key]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-72 w-full" />
          ) : !model ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Недостаточно данных для маршрутов по выбранному режиму.
            </p>
          ) : isMobile ? (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {model.links.map((link) => (
                <li key={`${link.left}-${link.right}`} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate" title={link.left}>
                    {link.left}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="min-w-0 flex-1 truncate" title={link.right}>
                    {link.right}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-primary">
                    {link.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <svg
              viewBox={`0 0 ${VIEW_W} ${model.height}`}
              className="h-auto w-full"
              style={{ maxHeight: 420 }}
              role="img"
              aria-label="Диаграмма маршрутов обращений"
            >
              {model.links.map((link) => {
                const a = model.leftPos.get(link.left)
                const b = model.rightPos.get(link.right)
                if (!a || !b) return null
                const ly = a.y + a.height / 2
                const ry = b.y + b.height / 2
                const width = 1.5 + (link.count / model.maxLink) * 16
                const dimmed = isDimmed('', link)
                return (
                  <path
                    key={`${link.left}-${link.right}`}
                    d={`M${NODE_W},${ly} C380,${ly} 380,${ry} ${RIGHT_X},${ry}`}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={width}
                    strokeOpacity={dimmed ? 0.06 : hover ? 0.55 : 0.28}
                    strokeLinecap="round"
                    className="transition-[stroke-opacity] duration-200"
                  />
                )
              })}

              {[...model.leftPos.values()].map((node) => (
                <FlowNode
                  key={`l-${node.name}`}
                  node={node}
                  x={0}
                  align="start"
                  dimmed={hover !== null && hover !== node.name}
                  onHover={setHover}
                />
              ))}
              {[...model.rightPos.values()].map((node) => (
                <FlowNode
                  key={`r-${node.name}`}
                  node={node}
                  x={RIGHT_X}
                  align="end"
                  dimmed={hover !== null && hover !== node.name}
                  onHover={setHover}
                />
              ))}
            </svg>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FlowNode({
  node,
  x,
  align,
  dimmed,
  onHover,
}: {
  node: Node
  x: number
  align: 'start' | 'end'
  dimmed: boolean
  onHover: (name: string | null) => void
}) {
  const labelX = align === 'start' ? x + 10 : x + NODE_W - 10
  const countX = align === 'start' ? x + NODE_W - 10 : x + 10
  return (
    <g
      className={cn('cursor-default transition-opacity duration-200', dimmed && 'opacity-35')}
      onMouseEnter={() => onHover(node.name)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        x={x}
        y={node.y}
        width={NODE_W}
        height={node.height}
        rx={8}
        fill="var(--muted)"
        stroke="var(--border)"
      />
      <text
        x={labelX}
        y={node.y + node.height / 2}
        dominantBaseline="central"
        textAnchor={align === 'start' ? 'start' : 'end'}
        fontSize="12.5"
        fill="var(--foreground)"
      >
        {shortLabel(node.name, 20)}
      </text>
      <text
        x={countX}
        y={node.y + node.height / 2}
        dominantBaseline="central"
        textAnchor={align === 'start' ? 'end' : 'start'}
        fontSize="12"
        fontWeight="600"
        fill="var(--primary)"
      >
        {node.total}
      </text>
    </g>
  )
}
