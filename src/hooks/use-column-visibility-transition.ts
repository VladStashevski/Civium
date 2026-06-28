import * as React from 'react'
import type { Column } from '@tanstack/react-table'

export function useColumnVisibilityTransition<T>() {
  const [enteringColumnId, setEnteringColumnId] = React.useState<string | null>(
    null,
  )
  const [exitingColumnId, setExitingColumnId] = React.useState<string | null>(
    null,
  )
  const timerRef = React.useRef<number | undefined>(undefined)

  React.useEffect(
    () => () => window.clearTimeout(timerRef.current),
    [],
  )

  const setColumnVisible = React.useCallback(
    (column: Column<T, unknown>, visible: boolean) => {
      window.clearTimeout(timerRef.current)

      if (visible && !column.getIsVisible()) {
        setExitingColumnId(null)
        setEnteringColumnId(column.id)
        column.toggleVisibility(true)
        timerRef.current = window.setTimeout(
          () => setEnteringColumnId(null),
          260,
        )
        return
      }

      if (!visible && column.getIsVisible()) {
        setEnteringColumnId(null)
        setExitingColumnId(column.id)
        timerRef.current = window.setTimeout(() => {
          column.toggleVisibility(false)
          setExitingColumnId(null)
        }, 220)
        return
      }

      column.toggleVisibility(visible)
    },
    [],
  )

  return {
    enteringColumnId,
    exitingColumnId,
    setColumnVisible,
  }
}
