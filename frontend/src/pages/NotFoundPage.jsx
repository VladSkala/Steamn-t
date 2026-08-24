import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="not-found-page">
      <span className="not-found-number">
        404
      </span>

      <h1>
        This world does not exist.
      </h1>

      <p>
        The page you are looking for
        could not be found.
      </p>

      <Link
        to="/"
        className="primary-button"
      >
        Back to home
        <span>→</span>
      </Link>
    </div>
  )
}

export default NotFoundPage