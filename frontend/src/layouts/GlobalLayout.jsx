import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import PageContainer from '../components/PageContainer'

function GlobalLayout() {
  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        <PageContainer>
          <Outlet />
        </PageContainer>
      </main>

      <Footer />
    </div>
  )
}

export default GlobalLayout