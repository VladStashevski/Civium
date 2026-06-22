import * as React from 'react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Ячейка с обрезкой по ширине: если текст не помещается, превращается в кнопку,
 * раскрывающую Popover с полным содержимым. Пустое значение рендерит «—».
 */
export function TruncatedCell({
  text,
  className,
}: {
  text?: string
  className?: string
}) {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useEffect(() => {
    const element = textRef.current
    if (!element || !text) {
      setIsTruncated(false)
      return
    }

    const update = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth + 1)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  if (!text) return <span className="text-muted-foreground/60">—</span>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!isTruncated}
          title={text}
          className={cn(
            'block w-full min-w-0 overflow-hidden text-left disabled:pointer-events-none',
            isTruncated &&
              'cursor-pointer underline-offset-2 decoration-dotted hover:underline aria-expanded:underline',
            className,
          )}
          aria-label={isTruncated ? `Показать полностью: ${text}` : undefined}
        >
          <span
            ref={textRef}
            className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {text}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-h-80 w-auto max-w-md overflow-auto"
      >
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {text}
        </p>
      </PopoverContent>
    </Popover>
  )
}
