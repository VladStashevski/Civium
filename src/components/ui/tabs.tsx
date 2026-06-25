"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type TabsIndicator = {
  height: number
  opacity: number
  width: number
  x: number
  y: number
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") {
    ref(value)
    return
  }

  const mutableRef = ref as React.MutableRefObject<T | null>
  mutableRef.current = value
}

function getActiveTrigger(list: HTMLElement) {
  return list.querySelector<HTMLElement>(
    '[data-slot="tabs-trigger"][data-active], [data-slot="tabs-trigger"][data-state="active"], [data-slot="tabs-trigger"][aria-selected="true"]'
  )
}

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLElement | null>(null)
  const showIndicator = variant === "default"
  const [indicator, setIndicator] = React.useState<TabsIndicator | null>(null)

  const measureIndicator = React.useCallback(() => {
    const list = listRef.current
    const activeTrigger = list ? getActiveTrigger(list) : null

    if (!showIndicator || !list || !activeTrigger) {
      setIndicator((current) =>
        current ? { ...current, opacity: 0 } : current
      )
      return
    }

    const listRect = list.getBoundingClientRect()
    const triggerRect = activeTrigger.getBoundingClientRect()
    const nextIndicator: TabsIndicator = {
      height: triggerRect.height,
      opacity: 1,
      width: triggerRect.width,
      x: triggerRect.left - listRect.left,
      y: triggerRect.top - listRect.top,
    }

    setIndicator((current) => {
      if (
        current &&
        Math.abs(current.height - nextIndicator.height) < 0.5 &&
        Math.abs(current.width - nextIndicator.width) < 0.5 &&
        Math.abs(current.x - nextIndicator.x) < 0.5 &&
        Math.abs(current.y - nextIndicator.y) < 0.5 &&
        current.opacity === nextIndicator.opacity
      ) {
        return current
      }

      return nextIndicator
    })
  }, [showIndicator])

  React.useLayoutEffect(() => {
    if (!showIndicator) return

    const list = listRef.current
    if (!list) return

    let frame: number | null = null
    const scheduleMeasure = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        measureIndicator()
      })
    }

    scheduleMeasure()

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasure)
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(scheduleMeasure)

    resizeObserver?.observe(list)
    mutationObserver?.observe(list, {
      attributeFilter: ["aria-selected", "data-active", "data-state"],
      attributes: true,
      childList: true,
      subtree: true,
    })
    list.addEventListener("click", scheduleMeasure)
    list.addEventListener("keydown", scheduleMeasure)
    window.addEventListener("resize", scheduleMeasure)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      list.removeEventListener("click", scheduleMeasure)
      list.removeEventListener("keydown", scheduleMeasure)
      window.removeEventListener("resize", scheduleMeasure)
    }
  }, [measureIndicator, showIndicator])

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node
        setRef(ref, node)
      }}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        tabsListVariants({ variant }),
        showIndicator && "relative isolate",
        className
      )}
      {...props}
    >
      {showIndicator && indicator ? (
        <span
          aria-hidden="true"
          data-slot="tabs-active-indicator"
          role="presentation"
          className="pointer-events-none absolute top-0 left-0 z-0 rounded-full bg-background shadow-xs transition-[transform,width,height,opacity] duration-300 ease-out motion-reduce:transition-none dark:border dark:border-input dark:bg-input/30"
          style={{
            height: indicator.height,
            opacity: indicator.opacity,
            transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            width: indicator.width,
          }}
        />
      ) : null}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-2 rounded-full border border-transparent! px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:rounded-2xl group-data-vertical/tabs:px-3 group-data-vertical/tabs:py-1.5 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-transparent data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
