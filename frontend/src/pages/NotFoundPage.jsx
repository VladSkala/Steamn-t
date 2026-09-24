import { t, useLocale } from "../i18n/index.js";
import { Link } from 'react-router-dom';
function NotFoundPage() {
  useLocale();
  return <div className="not-found-page">
      <span className="not-found-number">
        404
      </span>

      <h1>{t("This world does not exist.")}</h1>

      <p>{t("The page you are looking for could not be found.")}</p>

      <Link to="/" className="primary-button">{t("Back to home")}<span>→</span>
      </Link>
    </div>;
}
export default NotFoundPage;
