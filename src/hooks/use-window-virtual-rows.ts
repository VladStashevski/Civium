import * as React from 'react'

const VIRTUAL_ROW_HEIGHT = 49
const VIRTUAL_OVERSCAN = 8

/**
 * Оконная виртуализация строк таблицы: считает видимый диапазон по позиции
 * `<tbody>` относительно окна (таблица скроллится вместе со страницей, без
 * собственного скролл-контейнера). Возвращает ref для tbody, границы диапазона
 * и высоты спейсеров до/после, чтобы сохранить геометрию скролла.
 */
export function useWindowVirtualRows(count: number, refreshKey: string) {
  const bodyRef = React.useRef<HTMLTableSectionElement>(null)
  const [range, setRange] = React.useState(() => ({
    start: 0,
    end: Math.min(count, 40),
  }))

  React.useEffect(() => {
    let frame = 0

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

      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const visibleTop = Math.max(0, -rect.top)
      const visibleBottom = Math.min(
        count * VIRTUAL_ROW_HEIGHT,
        visibleTop + viewportHeight,
      )
      const start = Math.max(
        0,
        Math.floor(visibleTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN,
      )
      const end = Math.min(
        count,
        Math.ceil(visibleBottom / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN,
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
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [count, refreshKey])

  return {
    bodyRef,
    start: range.start,
    end: range.end,
    before: range.start * VIRTUAL_ROW_HEIGHT,
    after: Math.max(0, (count - range.end) * VIRTUAL_ROW_HEIGHT),
  }
}
