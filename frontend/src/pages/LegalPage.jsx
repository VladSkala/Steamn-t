import { t, useLocale } from "../i18n/index.js";
import { Link, useParams } from "react-router-dom";
const documents = {
  terms: {
    get title() {
      return t("Terms of Use");
    },
    sections: [["About Steamn’t", "Steamn’t is an educational game storefront and community project. Accounts, purchases, wallet funds, and downloads shown here are for demonstration purposes."], ["Your account", "Provide accurate registration details, protect your password, and use the service respectfully. You are responsible for activity under your account."], ["Community conduct", "Do not post unlawful, abusive, misleading, or unauthorized content. You may edit or remove content you created. Moderation may hide content that violates these rules."], ["Purchases", "Checkout records a demo purchase and adds the game to your library. No real money is charged and no commercial license is granted."], ["Availability", "This course project may change or be unavailable during development. Your locally stored data depends on the database used by the operator."]]
  },
  privacy: {
    get title() {
      return t("Privacy Policy");
    },
    sections: [["Data we use", "Your account stores a username, email, hashed password, profile information, game library, wishlist, orders, and community activity."], ["Public profile", "Your username and content you publish may be visible to others. Privacy settings control visibility of games, wishlist, friends, activity, and online status."], ["Messages and media", "Conversation data and attachments are stored for participants. Access to attachments requires an authenticated participant."], ["Security", "Passwords are hashed. Sign-in uses short-lived access tokens and refresh tokens. Do not share your tokens or password."], ["Your choices", "You can edit profile information and permanently delete your account in Settings. Deletion removes the account, its demo orders, wallet, library, published content, social connections, profile media, and conversations with their attachments. Other participants lose those conversations too. Contact the operator for a data export before deleting the account."]]
  },
  refund: {
    get title() {
      return t("Refund Policy");
    },
    sections: [["Demo purchases", "Steamn’t does not process real payments. Checkout and wallet transactions are demonstrations and do not represent commercial charges."], ["Order records", "An order receipt shows the price recorded at purchase time. It remains in your order history for coursework demonstration."], ["Requesting a refund", "Open Order history, choose an order, and select Refund order. Completed orders can be refunded within 14 days. The entire order is refunded to your demo wallet and its games and DLC leave your library. Refund separately purchased DLC before its base game. Repeating the request never adds funds twice. Demo funds have no monetary value."], ["Questions", "For questions about a local deployment, contact the person or team operating that instance."]]
  }
};
export default function LegalPage() {
  useLocale();
  const {
    policy
  } = useParams();
  const document = documents[policy];
  if (!document) return <div className="legal-page"><h1>{t("Page not found")}</h1><Link to="/">{t("Return home")}</Link></div>;
  return <article className="legal-page"><span className="section-kicker">{t("STEAMN’T POLICIES")}</span><h1>{document.title}</h1><p className="legal-intro">{t("These terms describe the educational demo service and its local data.")}</p><nav aria-label={t("On this page")}>{document.sections.map(([title], index) => <a href={`#section-${index}`} key={title}>{t(title)}</a>)}</nav>{document.sections.map(([title, body], index) => <section key={title} id={`section-${index}`}><h2>{t(title)}</h2><p>{t(body)}</p></section>)}<p>{t("Updated September 2026.")}</p></article>;
}
