import type { ComponentProps } from 'react'

/**
 * Фирменный знак Civium: монограмма «C» (гражданское сообщество / открытый
 * диалог) с восходящими столбиками внутри (аналитика обращений). Одноцветный,
 * тинтуется через `currentColor`; двутон — за счёт прозрачности столбиков.
 * Тот же знак — в `public/favicon.svg`.
 *
 * `animated` — столбики поочерёдно «вырастают» от общей базовой линии (для
 * фоновых/акцентных мест; в навигации знак статичный).
 */
export function CiviumLogo({
  animated = false,
  className,
  ...props
}: ComponentProps<'svg'> & { animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      role="img"
      aria-label="Civium"
      {...props}
    >
      <path
        d="M25.66 7.3 A13 13 0 1 0 25.66 24.7 L21.57 21.02 A7.5 7.5 0 1 1 21.57 10.98 Z"
        fill="currentColor"
      />
      <g fill="currentColor">
        <rect
          x="10.4"
          y="17.4"
          width="2.7"
          height="3.6"
          rx="1.35"
          opacity="0.45"
          className={animated ? 'civium-bar-1' : undefined}
        />
        <rect
          x="14.65"
          y="14.4"
          width="2.7"
          height="6.6"
          rx="1.35"
          opacity="0.7"
          className={animated ? 'civium-bar-2' : undefined}
        />
        <rect
          x="18.9"
          y="12"
          width="2.7"
          height="9"
          rx="1.35"
          className={animated ? 'civium-bar-3' : undefined}
        />
      </g>
    </svg>
  )
}
