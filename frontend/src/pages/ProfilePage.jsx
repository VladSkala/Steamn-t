import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const badges = ['🏆', '⚔', '💗', '🎮']
const discussionCards = [
  { title: 'A world after the storm', text: 'I still cannot decide which game world I would choose to live in.' },
  { title: 'Fallout 4 Lights Up', text: 'Which one of them is more fun? What is your opinion?' },
]
const screenshots = ['game-cover-forest', 'game-cover-storm', 'game-cover-ocean']

function ProfilePage() {
  const { user } = useAuth()
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  const displayName = fullName || user?.username || 'Player'
  const avatarInitial = displayName.charAt(0).toUpperCase()

  return (
    <div className="profile-page">
      <section className="profile-header-card">
        <div className="profile-cover"><div className="profile-cover-glow" /></div>
        <div className="profile-identity-row">
          <div className="profile-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : avatarInitial}</div>
          <div className="profile-identity"><h1>{displayName}</h1><span className="online-status">online</span><p>{user?.email || 'Slush player'}</p></div>
          <Link to="/settings" className="profile-edit-button">✎ Edit profile</Link>
        </div>
      </section>

      <div className="profile-layout">
        <main className="profile-main-content">
          <section className="profile-block">
            <h2>Badge gallery</h2>
            <div className="profile-badges"><div className="badge-count"><strong>5</strong><span>Badges</span></div>{badges.map((badge, index) => <div className="profile-badge" key={index}>{badge}</div>)}</div>
          </section>

          <section className="profile-block game-collection-block">
            <h2>Game collection</h2>
            <div className="collection-stats"><div><strong>1234</strong><span>Games</span></div><div><strong>121</strong><span>DLC</span></div><div><strong>2564</strong><span>Hours</span></div></div>
            <div className="collection-covers">{['game-cover-ocean', 'game-cover-garden', 'game-cover-forest', 'game-cover-space'].map((cover, index) => <div className={`collection-cover ${cover}`} key={index} />)}</div>
          </section>

          <section className="profile-block profile-discussions"><h2>Discussion gallery</h2>{discussionCards.map((card, index) => <article className="discussion-card" key={card.title}><div><span className="discussion-game">Fallout 4</span><small>25.02.2024</small></div><h3>{card.title}</h3><p>{card.text}</p><div className="discussion-actions"><span>♡ 2.5k</span><span>▢ 2.5k</span><button type="button">⇧ Share</button></div>{index === 0 && <div className="discussion-image game-cover-sand" />}</article>)}</section>

          <section className="profile-block profile-screenshots"><h2>Screenshot gallery</h2><div className="profile-feature-shot game-cover-storm"><span>Screenshot</span></div><div className="profile-thumb-grid">{screenshots.map((cover, index) => <div className={`profile-thumb ${cover}`} key={index} />)}</div></section>

          <section className="profile-block profile-discussions"><h2>Video gallery</h2><article className="discussion-card compact"><div className="discussion-image game-cover-ocean" /><h3>My favorite gameplay moments</h3><p>A personal collection of memorable gaming moments.</p></article></section>
        </main>

        <aside className="profile-sidebar">
          <section className="level-card"><div className="level-heading"><h2>Level</h2><strong>99</strong></div>{['Home', 'Badges', 'Games', 'Wishlist', 'Discussions', 'Screenshots', 'Video', 'Guides', 'Reviews'].map((item, index) => <div className="profile-level-row" key={item}><span>{item}</span><b>{index === 0 ? '' : 100}</b></div>)}</section>
          <section className="friends-card"><h3>Friends</h3>{['GhostRogue', 'slimrock', 'NikaNii', 'whysurky', 'zuzeyka'].map((name) => <div className="friend-row" key={name}><span>{name.charAt(0)}</span>{name}<b>40</b></div>)}</section>
        </aside>
      </div>
    </div>
  )
}

export default ProfilePage
