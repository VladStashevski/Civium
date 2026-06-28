import * as React from 'react'

const DEFAULT_VIRTUAL_ROW_HEIGHT = 49
const VIRTUAL_OVERSCAN = 8

/**
 * Оконная виртуализация строк таблицы: считает видимый диапазон по позиции
 * `<tbody>` относительно окна (таблица скроллится вместе со страницей, без
 * собственного скролл-контейнера). Возвращает ref для tbody, границы диапазона
 * и высоты спейсеров до/после, чтобы сохранить геометрию скролла.
 */
export function useWindowVirtualRows(count: number, refreshKey: string) {
  const bodyRef = React.useRef<HTMLTableSectionElement>(null)
  const rowHeightRef = React.useRef(DEFAULT_VIRTUAL_ROW_HEIGHT)
  const [rowHeight, setRowHeight] = React.useState(DEFAULT_VIRTUAL_ROW_HEIGHT)
  const [range, setRange] = React.useState(() => ({
    start: 0,
    end: Math.min(count, 40),
  }))

  React.useEffect(() => {
    let frame = 0
    let resizeObserver: ResizeObserver | null = null

    const measureRowHeight = (element: HTMLTableSectionElement) => {
      const row = element.querySelector<HTMLTableRowElement>(
        'tr:not([aria-hidden="true"])',
      )
      const measured = row?.getBoundingClientRect().height ?? 0
      if (measured <= 0 || Math.abs(measured - rowHeightRef.current) < 0.5) {
        return
      }
      rowHeightRef.current = measured
      setRowHeight(measured)
    }

    const update = () => {
      frame = 0
      const element = bodyRef.current
      if (!element || count === 0) {
        setRange((current) =>
          current.start === 0 && current.end === 0
            ? current
            : { start: 0, end: 0 },
        )
        return
      }

      measureRowHeight(element)
      const measuredRowHeight = rowHeightRef.current
      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const visibleTop = Math.max(0, -rect.top)
      const visibleBottom = Math.min(
        count * measuredRowHeight,
        visibleTop + viewportHeight,
      )
      const start = Math.max(
        0,
        Math.floor(visibleTop / measuredRowHeight) - VIRTUAL_OVERSCAN,
      )
      const end = Math.min(
        count,
        Math.ceil(visibleBottom / measuredRowHeight) + VIRTUAL_OVERSCAN,
      )

      setRange((current) =>
        current.start === start && current.end === end
          ? current
          : { start, end },
      )
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    if (bodyRef.current) {
      resizeObserver = new ResizeObserver(schedule)
      resizeObserver.observe(bodyRef.current)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [count, refreshKey])

  return {
    bodyRef,
    start: range.start,
    end: range.end,
    before: range.start * rowHeight,
    after: Math.max(0, (count - range.end) * rowHeight),
  }
}
