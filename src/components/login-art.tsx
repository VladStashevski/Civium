import { CiviumLogo } from '@/components/civium-logo'

export function LoginArt() {
  return (
    <div className="relative hidden items-center justify-center overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
      {/* свечение из правого-верхнего угла */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_82%_12%,rgba(255,255,255,0.22),transparent_70%)]"
      />
      {/* точечная сетка с мягким затуханием к краям */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(80%_80%_at_50%_45%,#000,transparent)]"
      />
      {/* фирменный знак как фоновый элемент в правом верхнем углу;
          столбики поочерёдно «вырастают» */}
      <CiviumLogo
        animated
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-[34rem] text-white/[0.09]"
      />

      {/* основная иллюстрация */}
      <svg
        viewBox="0 0 420 360"
        className="relative z-10 w-full max-w-md"
        fill="none"
        role="img"
        aria-label="Обработка обращений граждан"
      >
        {/* орбиты */}
        <circle cx="210" cy="180" r="168" stroke="#fff" strokeOpacity="0.08" strokeWidth="2" />
        <circle cx="210" cy="180" r="120" stroke="#fff" strokeOpacity="0.07" strokeWidth="2" />

        {/* узлы вращаются по орбите вокруг центра (в разные стороны) */}
        <g className="civium-orbit">
          <circle cx="306" cy="42" r="5" fill="#fff" fillOpacity="0.55" />
          <circle cx="52" cy="123" r="4" fill="#fff" fillOpacity="0.45" />
          <circle cx="153" cy="338" r="5" fill="#fff" fillOpacity="0.4" />
        </g>
        <g className="civium-orbit-reverse">
          <circle cx="345" cy="258" r="4" fill="#fff" fillOpacity="0.5" />
          <circle cx="157" cy="33" r="5" fill="#fff" fillOpacity="0.45" />
          <circle cx="63" cy="233" r="3" fill="#fff" fillOpacity="0.4" />
        </g>

        {/* задний лист */}
        <g transform="rotate(-7 210 185)">
          <rect x="118" y="74" width="184" height="224" rx="22" fill="#fff" fillOpacity="0.16" />
        </g>

        {/* основной документ-обращение */}
        <rect x="120" y="60" width="184" height="238" rx="22" fill="#fff" />

        {/* шапка: заявитель */}
        <circle cx="152" cy="98" r="15" fill="#3b82f6" />
        <path d="M152 92a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-8 17a8 8 0 0 1 16 0Z" fill="#fff" />
        <rect x="176" y="89" width="84" height="9" rx="4.5" fill="#cbd5e1" />
        <rect x="176" y="104" width="58" height="7" rx="3.5" fill="#e2e8f0" />

        {/* тело: строки текста */}
        <rect x="142" y="134" width="140" height="8" rx="4" fill="#e9eef5" />
        <rect x="142" y="152" width="120" height="8" rx="4" fill="#e9eef5" />
        <rect x="142" y="170" width="132" height="8" rx="4" fill="#e9eef5" />

        {/* мини-диаграмма */}
        <rect x="142" y="262" width="22" height="20" rx="4" fill="#93c5fd" />
        <rect x="172" y="246" width="22" height="36" rx="4" fill="#60a5fa" />
        <rect x="202" y="226" width="22" height="56" rx="4" fill="#3b82f6" />
        <rect x="232" y="240" width="22" height="42" rx="4" fill="#2563eb" />

        {/* конверт сверху-справа — парит в своём ритме */}
        <g transform="translate(244 40) rotate(8)">
          <g
            className="civium-float"
            style={{ animationDuration: '6.5s', animationDelay: '0s' }}
          >
            <rect x="0" y="0" width="98" height="70" rx="12" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
            <path d="M10 14 L49 46 L88 14" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>

        {/* бейдж «обработано» — парит иначе, не в такт конверту */}
        <g
          className="civium-float"
          style={{ animationDuration: '4.4s', animationDelay: '1.1s' }}
        >
          <circle cx="298" cy="276" r="30" fill="#10b981" />
          <path d="M285 277 l9 9 l17 -19" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}
