import Pagination from "../components/Pagination";
import { t, useLocale, setLocale } from "../i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import useProfile from "../hooks/useProfile";
const languageKey = id => `steamnt-settings-language:${id}`;
const useText = () => {
  useLocale();
  return t;
};
const searchTerms = {
  general: "account profile email bio avatar cover privacy theme language мова язык загальні общие",
  password: "password security",
  notifications: "notifications messages updates sounds",
  wallet: "wallet balance funds transactions",
  delete: "delete account permanent"
};
const sections = ["general", "password", "notifications", "wallet", "delete"];
const errorText = error => error.response?.data?.detail || Object.values(error.response?.data || {}).flat().join(" ") || t("Could not save. Please try again.");
function useImagePreview(file, fallback) {
  const preview = useMemo(() => file ? URL.createObjectURL(file) : fallback, [file, fallback]);
  useEffect(() => {
    if (file && preview) return () => URL.revokeObjectURL(preview);
  }, [file, preview]);
  return preview;
}
function General({
  profile,
  save,
  reloadProfile
}) {
  useLocale();
  const t = useText();
  const language = useLocale();
  const setLanguage = value => setLocale(value, profile.id);
  const [form, setForm] = useState(() => ({
    username: profile.username,
    email: profile.email,
    bio: profile.bio || "",
    language,
    dark_theme: profile.dark_theme ?? true,
    privacy_games: profile.privacy_games ?? true,
    privacy_wishlist: profile.privacy_wishlist ?? true,
    privacy_friends: profile.privacy_friends ?? true,
    privacy_activity: profile.privacy_activity ?? true,
    privacy_messages: profile.privacy_messages || "everyone",
    show_online: profile.show_online ?? true
  }));
  const [avatar, setAvatar] = useState(null);
  const [cover, setCover] = useState(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [busy, setBusy] = useState(false);
  const initial = useRef(form);
  const formRef = useRef(null);
  const avatarPreview = useImagePreview(avatar, profile.avatar);
  const coverPreview = useImagePreview(cover, profile.cover);
  const cancel = () => {
    setForm(initial.current);
    setAvatar(null);
    setCover(null);
    setMessage("");
    setMessageTone("success");
    formRef.current?.reset();
  };
  const update = (key, value) => setForm(current => ({
    ...current,
    [key]: value
  }));
  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageTone("success");
    try {
      await save({
        ...form,
        language: form.language,
        ...(avatar ? {
          avatar
        } : {}),
        ...(cover ? {
          cover
        } : {})
      });
      try {
        localStorage.setItem(languageKey(profile.id), form.language);
      } catch {/* Browser storage may be unavailable. */}
      setLanguage(form.language);
      initial.current = form;
      setAvatar(null);
      setCover(null);
      formRef.current?.reset();
      await reloadProfile();
      setMessage("Settings saved.");
    } catch (error) {
      setMessageTone("error");
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return <form ref={formRef} className="settings-card complete-settings-form" onSubmit={submit}>
    <h2>{t("General")}</h2>
    <div className="complete-settings-cover" style={coverPreview ? {
      backgroundImage: `url(${coverPreview})`
    } : undefined}>
      <label>{t("Change cover")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCover(event.target.files[0] || null)} /></label>
    </div>
    <div className="complete-settings-avatar">
      <span>{avatarPreview ? <img src={avatarPreview} alt="" /> : profile.username.charAt(0).toUpperCase()}</span>
      <label>{t("Change avatar")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setAvatar(event.target.files[0] || null)} /></label>
    </div>
    <div className="settings-form-grid">
      <label>{t("Username")}<input value={form.username} onChange={event => update("username", event.target.value)} required /></label>
      <label>{t("Email")}<input type="email" value={form.email} onChange={event => update("email", event.target.value)} required /></label>
    </div>
    <label htmlFor="settings-bio">{t("Bio")}<textarea id="settings-bio" aria-label={t("Bio")} rows={4} maxLength={500} value={form.bio} onChange={event => update("bio", event.target.value)} /></label>
    <div className="settings-form-grid">
      <label>{t("Settings language")}<select value={form.language} onChange={event => update("language", event.target.value)}><option value="en">{t("English")}</option><option value="ru">{t("Russian")}</option><option value="uk">{t("Ukrainian")}</option></select></label>
      <label>{t("Who can message me")}<select value={form.privacy_messages} onChange={event => update("privacy_messages", event.target.value)}><option value="everyone">{t("Everyone")}</option><option value="friends">{t("Friends")}</option><option value="nobody">{t("Nobody")}</option></select></label>
    </div>
    <h3>{t("Privacy")}</h3>
    {[["privacy_games", t("Show games")], ["privacy_wishlist", t("Show wishlist")], ["privacy_friends", t("Show friends")], ["privacy_activity", t("Show activity")], ["show_online", t("Show online status")], ["dark_theme", t("Dark theme")]].map(([key, label]) => <label className="complete-settings-toggle" key={key}><span>{t(label)}</span><input type="checkbox" checked={form[key]} onChange={event => update(key, event.target.checked)} /></label>)}
    <div className="settings-save-feedback" aria-live="polite" aria-atomic="true">
      {message && <p className={`is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{t(message)}</p>}
    </div>
    <div className="settings-actions"><button type="button" disabled={busy} onClick={cancel}>{t("Cancel")}</button><button disabled={busy}>{busy ? t("Saving…") : t("Save changes")}</button></div>
  </form>;
}
function Password({
  logout
}) {
  useLocale();
  const t = useText();
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm: ""
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (form.new_password !== form.confirm) {
      setMessage("New passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.post("/settings/password/", form);
      logout();
      window.location.assign("/login");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return <form className="settings-card complete-settings-form" onSubmit={submit}><h2>{t("Change password")}</h2><p>{t("Use a strong password you have not used before.")}</p>{[["current_password", t("Current password")], ["new_password", t("New password")], ["confirm", t("Confirm password")]].map(([key, label]) => <label key={key}>{t(label)}<input type="password" autoComplete={key === "current_password" ? "current-password" : "new-password"} value={form[key]} onChange={event => setForm(current => ({
        ...current,
        [key]: event.target.value
      }))} required /></label>)}{message && <p role="alert">{t(message)}</p>}<div className="settings-actions"><button disabled={busy}>{t("Update password")}</button></div></form>;
}
function Notifications({
  profile,
  save,
  reloadProfile
}) {
  useLocale();
  const t = useText();
  const [prefs, setPrefs] = useState(profile.notification_preferences || {});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await save({
        notification_preferences: prefs
      });
      await reloadProfile();
      setMessage("Preferences saved.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return <form className="settings-card complete-settings-form" onSubmit={submit}><h2>{t("Notifications")}</h2><p>{t("Choose which updates you want to receive.")}</p>{Object.entries(prefs).map(([key, value]) => <label className="complete-settings-toggle" key={key}><span>{t(key.replaceAll("_", " "))}</span><input type="checkbox" checked={value} onChange={event => setPrefs(current => ({
        ...current,
        [key]: event.target.checked
      }))} /></label>)}{message && <p role="status">{t(message)}</p>}<div className="settings-actions"><button disabled={busy}>{t("Save preferences")}</button></div></form>;
}
function Wallet({
  reloadProfile
}) {
  useLocale();
  const t = useText();
  const requestId = useRef(crypto.randomUUID());
  const [wallet, setWallet] = useState(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("10.00");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.get("/settings/wallet/", {
      params: {
        page
      },
      signal: controller.signal
    }).then(({
      data
    }) => {
      setWallet(data);
      setError("");
    }).catch(err => {
      if (!controller.signal.aborted) setError(errorText(err));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [page, attempt]);
  const turn = value => {
    setLoading(true);
    setPage(value);
  };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const {
        data
      } = await api.post("/settings/wallet/", {
        amount,
        request_id: requestId.current
      });
      requestId.current = crypto.randomUUID();
      setWallet(data);
      setPage(1);
      reloadProfile().catch(() => {});
      setMessage("Demo balance updated.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return <section className="settings-card complete-settings-form"><h2>{t("Demo wallet")}</h2>
    <p>{t("Demo funds have no monetary value. You can use them at checkout.")}</p>
    <div className="complete-wallet-balance"><span>{t("Balance · USD")}</span><strong>{wallet?.balance ?? "…"}</strong></div>
    {error && <p role="alert">{t(error)} <button type="button" onClick={() => {
        setLoading(true);
        setAttempt(n => n + 1);
      }}>{t("Retry")}</button></p>}
    <form onSubmit={submit}><label>{t("Top-up amount")}<input type="number" required min="1" max="500" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <div className="settings-actions"><button disabled={busy || !wallet}>{busy ? t("Adding…") : t("Add demo funds")}</button></div></form>
    {message && <p role="status">{t(message)}</p>}<h3>{t("Transactions")}</h3>
    {loading ? <p role="status">{t("Loading transactions…")}</p> : <div className="complete-wallet-history">{wallet?.transactions.length ? wallet.transactions.map(item => <div key={item.id}><span>{t(item.description)}<small>{new Date(item.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</small></span><strong>{item.amount}</strong></div>) : !error && <p>{t("No transactions yet.")}</p>}</div>}
    <Pagination page={page} previous={wallet?.previous} next={wallet?.next} disabled={loading} onPageChange={turn} />
  </section>;
}
function Delete({
  username,
  logout
}) {
  useLocale();
  const t = useText();
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmation: ""
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.post("/settings/delete-account/", form);
      logout();
      window.location.assign("/");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return <form className="settings-card complete-settings-form" onSubmit={submit}><h2>{t("Delete account")}</h2><p>{t("This permanently removes your account, profile media, demo orders and wallet, library, posts, reviews, social connections, and conversations with their attachments. Other participants also lose those conversations. Confirm with your username, password, and the word DELETE.")}</p>{[["username", `${t("Username")} (${username})`], ["password", t("Password")], ["confirmation", t("Type DELETE")]].map(([key, label]) => <label key={key}>{t(label)}<input autoComplete={key === "password" ? "current-password" : "off"} type={key === "password" ? "password" : "text"} value={form[key]} onChange={event => setForm(current => ({
        ...current,
        [key]: event.target.value
      }))} required /></label>)}{message && <p role="alert">{t(message)}</p>}<div className="settings-actions"><button className="danger" disabled={busy || form.confirmation !== "DELETE"}>{t("Delete account")}</button></div></form>;
}
function SettingsContent() {
  useLocale();
  const t = useText();
  const [search, setSearch] = useState("");
  const visibleSections = sections.filter(name => searchTerms[name].includes(search.toLowerCase().trim()) || name.includes(search.toLowerCase().trim()) || t(name === "delete" ? "Delete account" : name).toLowerCase().includes(search.toLowerCase().trim()));
  const {
    reloadProfile,
    logout
  } = useAuth();
  const {
    profile,
    loading,
    error,
    reload,
    save
  } = useProfile();
  const [params, setParams] = useSearchParams();
  const section = sections.includes(params.get("section")) ? params.get("section") : "general";
  if (loading && !profile) return <div className="settings-page">{t("Loading settings…")}</div>;
  if (error || !profile) return <div className="settings-page" role="alert">{error || t("Settings unavailable.")} <button onClick={reload}>{t("Retry")}</button></div>;
  return <div className="settings-page"><header className="settings-hero"><div><span className="section-kicker">{t("ACCOUNT")}</span><h1>{t("Settings")}</h1><p>{t("Manage your account and preferences.")}</p></div></header><div className="settings-layout"><nav className="settings-nav" aria-label={t("Settings sections")}><label className="sr-only" htmlFor="settings-search">{t("Find a setting")}</label><input id="settings-search" type="search" placeholder={t("Find a setting…")} value={search} onChange={event => setSearch(event.target.value)} />{visibleSections.length === 0 && <p>{t("No matching sections. ")}<button type="button" onClick={() => setSearch("")}>{t("Clear search")}</button></p>}{visibleSections.map(name => <button type="button" key={name} className={section === name ? "active" : ""} onClick={() => setParams({
          section: name
        })}>{t(name === "delete" ? "Delete account" : name)}</button>)}</nav><section className="settings-content">{section === "general" && <General profile={profile} save={save} reloadProfile={reloadProfile} />}{section === "password" && <Password logout={logout} />}{section === "notifications" && <Notifications profile={profile} save={save} reloadProfile={reloadProfile} />}{section === "wallet" && <Wallet reloadProfile={reloadProfile} />}{section === "delete" && <Delete username={profile.username} logout={logout} />}</section></div></div>;
}
export default function SettingsCompletePage() {
  useLocale();
  return <SettingsContent />;
}
