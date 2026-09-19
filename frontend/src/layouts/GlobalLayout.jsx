import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import PageContainer from '../components/PageContainer'
import {
  communityPostPath,
  postIdFromLegacyHash,
} from '../utils/communityPostLinks'

function GlobalLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const postId = postIdFromLegacyHash(location.hash)
    if (postId) {
      navigate(`${communityPostPath(postId)}${location.search}`, {
        replace: true,
      })
    }
  }, [location.hash, location.search, navigate])

  useEffect(() => {
    const route = location.pathname.split("/")[1];
    const titles = {catalog:"Catalog",community:"Community",news:"News",notifications:"Notifications",friends:"Friends",chat:"Messages",cart:"Cart",checkout:"Checkout",library:"Library",games:"Game",dlc:"DLC",bundles:"Bundles",orders:"Orders",profile:"My profile",users:"Player profile",settings:"Settings",wishlist:"Wishlist"};
    const legal = {terms:"Terms of Use",privacy:"Privacy Policy",refund:"Refund Policy"};
    const title = route === "legal" ? legal[location.pathname.split("/")[2]] : titles[route];
    document.title = title ? `${title} · Steamn’t` : "Steamn’t";
  }, [location.pathname]);

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
