import Footer from '../components/Footer'
import Header from '../components/Header'
import PageContainer from '../components/PageContainer'

function GlobalLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b0714] text-white">
      <Header />

      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />

          <div className="absolute right-[-250px] top-[300px] h-[500px] w-[500px] rounded-full bg-purple-700/10 blur-[150px]" />
        </div>

        <div className="relative">
          <PageContainer>{children}</PageContainer>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default GlobalLayout