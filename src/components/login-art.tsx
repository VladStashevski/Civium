export function LoginArt() {
  return (
    <div className="relative hidden overflow-hidden lg:block">
      {/* базовый градиент */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-primary to-indigo-800" />

      {/* мягкие световые пятна (mesh) */}
      <div className="absolute -top-32 -left-24 size-[30rem] rounded-full bg-sky-300/50 blur-3xl" />
      <div className="absolute top-1/3 -right-28 size-[28rem] rounded-full bg-violet-400/40 blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 size-[30rem] rounded-full bg-blue-800/50 blur-3xl" />

      {/* лёгкий блик сверху */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_25%_15%,rgba(255,255,255,0.22),transparent_55%)]" />
    </div>
  )
}
