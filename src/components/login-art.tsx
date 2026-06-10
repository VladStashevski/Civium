export function LoginArt() {
  return (
    <div className="relative hidden overflow-hidden bg-primary lg:block">
      {/* мягкие блики */}
      <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-black/10 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
        <div className="text-sm font-semibold tracking-wider uppercase opacity-80">
          Civium
        </div>

        {/* векторная иллюстрация: обращения + аналитика */}
        <svg
          viewBox="0 0 320 220"
          className="mx-auto w-full max-w-md"
          fill="none"
          role="img"
          aria-label="Аналитика обращений граждан"
        >
          {/* стопка документов */}
          <rect x="36" y="40" width="150" height="150" rx="12" fill="white" opacity="0.18" />
          <rect x="48" y="28" width="150" height="150" rx="12" fill="white" opacity="0.28" />
          <rect x="60" y="16" width="150" height="160" rx="12" fill="white" />
          <rect x="78" y="40" width="92" height="10" rx="5" fill="currentColor" opacity="0.25" />
          <rect x="78" y="60" width="114" height="8" rx="4" fill="currentColor" opacity="0.15" />
          <rect x="78" y="76" width="100" height="8" rx="4" fill="currentColor" opacity="0.15" />
          <rect x="78" y="92" width="80" height="8" rx="4" fill="currentColor" opacity="0.15" />
          {/* мини-бар-чарт на документе */}
          <rect x="78" y="150" width="14" height="14" rx="3" fill="currentColor" opacity="0.7" />
          <rect x="98" y="138" width="14" height="26" rx="3" fill="currentColor" opacity="0.55" />
          <rect x="118" y="124" width="14" height="40" rx="3" fill="currentColor" opacity="0.7" />
          <rect x="138" y="146" width="14" height="18" rx="3" fill="currentColor" opacity="0.4" />

          {/* конверт-обращение */}
          <g transform="translate(196 96)">
            <rect x="0" y="0" width="108" height="78" rx="10" fill="white" />
            <path d="M6 10 L54 46 L102 10" stroke="currentColor" strokeOpacity="0.35" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>

        <div className="max-w-sm">
          <div className="text-2xl leading-tight font-semibold">
            Обращения граждан — под контролем
          </div>
          <p className="mt-2 text-sm opacity-80">
            Загрузка выгрузок, аннотации, динамика год к году и печатные отчёты.
          </p>
        </div>
      </div>
    </div>
  )
}
