const recommendedGames = [
  {
    title: 'Black Myth: Wukong',
    genre: 'Action RPG',
    image:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'The Witcher',
    genre: 'Adventure RPG',
    image:
      'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Manor Lords',
    genre: 'Strategy',
    image:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Avatar',
    genre: 'Action Adventure',
    image:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=85',
  },
]

const popularGames = [
  {
    title: 'Elden Ring',
    genre: 'Action RPG',
    image:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Stardew Valley',
    genre: 'Simulation',
    image:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Ghost',
    genre: 'Adventure',
    image:
      'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Avatar: Frontiers',
    genre: 'Action',
    image:
      'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=900&q=85',
  },
]

const affordableGames = [
  {
    title: 'FAR',
    genre: 'Adventure',
    image:
      'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Peek-a-Boo',
    genre: 'Indie',
    image:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'The Escape Together',
    genre: 'Puzzle',
    image:
      'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'Another World',
    genre: 'Adventure',
    image:
      'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=900&q=85',
  },
]

function GameCard({ game }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-violet-400/10 bg-[#21163a] transition duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-[#2a1c4a]">
      <div className="aspect-[16/10] overflow-hidden">
        <img
          src={game.image}
          alt={game.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-semibold text-white">
          {game.title}
        </h3>

        <p className="mt-1 text-xs text-slate-500">{game.genre}</p>

        <div className="mt-3 flex items-center gap-2">
          <span className="rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-pink-300">
            New
          </span>

          <span className="text-[10px] text-slate-500">Discover</span>
        </div>
      </div>
    </article>
  )
}

function GameSection({ title, games, id }) {
  return (
    <section id={id} className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-white sm:text-lg">
          {title}
        </h2>

        <button
          type="button"
          className="text-xs font-medium text-violet-400 transition hover:text-violet-300"
        >
          View all
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((game) => (
          <GameCard key={game.title} game={game} />
        ))}
      </div>
    </section>
  )
}

function HomePage() {
  return (
    <div id="home" className="py-5 pb-10 sm:py-6 sm:pb-12">
      <section className="overflow-hidden rounded-xl border border-violet-400/15 bg-[#120b22]">
        <div className="relative min-h-[340px] overflow-hidden sm:min-h-[420px]">
          

          <div className="absolute inset-0 bg-gradient-to-r from-[#120b22] via-[#120b22]/70 to-transparent" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#120b22]/80 via-transparent to-transparent" />

          <div className="relative z-10 flex min-h-[340px] max-w-xl flex-col justify-end p-6 sm:min-h-[420px] sm:p-8 lg:p-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-pink-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-300">
                Featured
              </span>

              <span className="text-xs text-slate-400">Adventure RPG</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Your next adventure
              <br />
              starts here.
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
              Discover new worlds, unforgettable stories and games that deserve
              a place in your collection.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                Explore games
              </a>

              <button
                type="button"
                className="rounded-lg border border-white/15 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Learn more
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-violet-400/10 border-t border-violet-400/10">
          <div className="p-3 text-center sm:p-4">
            <p className="text-sm font-bold text-white">500+</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
              Games
            </p>
          </div>

          <div className="p-3 text-center sm:p-4">
            <p className="text-sm font-bold text-white">20+</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
              Categories
            </p>
          </div>

          <div className="p-3 text-center sm:p-4">
            <p className="text-sm font-bold text-white">New</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
              Every week
            </p>
          </div>
        </div>
      </section>

      <GameSection
        title="Recommended for you"
        games={recommendedGames}
        id="catalog"
      />

      <GameSection
        title="Recommended now"
        games={popularGames}
        id="categories"
      />

      <GameSection title="Under 100" games={affordableGames} />

      <section className="mt-8 rounded-xl border border-violet-400/10 bg-[#18102a] p-5 sm:p-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
            Steamn&apos;t
          </p>

          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
            Find something new to play.
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Browse games, discover new genres and keep track of titles you want
            to explore later.
          </p>
        </div>
      </section>
    </div>
  )
}

export default HomePage