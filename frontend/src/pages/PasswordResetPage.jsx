import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";

export default function PasswordResetPage() {
  const [params] = useSearchParams();
  const confirming = Boolean(params.get("token"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (confirming && password !== confirm) { setMessage("Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      const { data } = await api.post(confirming ? "/auth/password-reset/confirm/" : "/auth/password-reset/", confirming ? { uid: params.get("uid"), token: params.get("token"), password } : { email }, { skipAuth: true });
      setMessage(data.detail); setDone(true);
    } catch (error) { setMessage(error.response?.data?.detail || "Unable to reset your password. Try again."); }
    finally { setBusy(false); }
  };
  return <section className="auth-page"><div className="auth-card"><p className="section-kicker">Account security</p><h1>{confirming ? "Choose a new password" : "Reset your password"}</h1><p className="auth-intro">{confirming ? "Use at least eight characters and avoid a password you use elsewhere." : "Enter your account email to receive a recovery link."}</p>
    {!done && <form className="auth-form" onSubmit={submit}>{confirming ? <><label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>Confirm password<input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label></> : <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}<button className="primary-button" disabled={busy}>{busy ? "Please wait…" : confirming ? "Save password" : "Send recovery link"}</button></form>}
    {message && <p role={done ? "status" : "alert"}>{message}</p>}<p className="auth-bottom-text"><Link to="/login">Back to sign in</Link></p>
  </div></section>;
}
