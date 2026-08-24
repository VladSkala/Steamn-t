const navigationItems = [
  { label: 'Home', href: '#home' },
  { label: 'Catalog', href: '#catalog' },
  { label: 'Categories', href: '#categories' },
]

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-violet-400/10 bg-[#120b22]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#home"
          className="flex shrink-0 items-center gap-3"
          aria-label="Steamn’t home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-500/15 text-sm font-black text-violet-300">
            S
          </div>

          <span className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Steam<span className="text-violet-400">n&apos;t</span>
          </span>
        </a>

        <nav className="hidden md:block" aria-label="Main navigation">
          <ul className="flex items-center gap-1">
            {navigationItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-violet-300"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-4.2-4.2" />
            </svg>
          </button>

          <button
            type="button"
            className="hidden rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 sm:inline-flex"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header