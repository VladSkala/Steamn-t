function Footer() {
  return (
    <footer className="border-t border-violet-400/10 bg-[#120b22]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-semibold text-slate-300">
            Steam<span className="text-violet-400">n&apos;t</span>
          </p>

          <p className="mt-1">
            Discover, explore and organize your next favorite games.
          </p>
        </div>

        <p>Copyright 2026 Steamn&apos;t</p>
      </div>
    </footer>
  )
}

export default Footer