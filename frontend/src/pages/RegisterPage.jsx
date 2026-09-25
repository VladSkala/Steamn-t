import { t, useLocale } from "../i18n/index.js";
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { resolveReturnLocation } from '../utils/returnLocation';
function RegisterPage() {
  useLocale();
  const {
    register
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const change = e => setForm({
    ...form,
    [e.target.name]: e.target.value
  });
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (form.password !== form.password_confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate(resolveReturnLocation(location.state?.from), {
        replace: true
      });
    } catch (err) {
      const data = err.response?.data;
      setError(data ? Object.values(data).flat()[0] || t('Unable to create your account.') : t('Unable to create your account.'));
    } finally {
      setLoading(false);
    }
  };
  return <section className="auth-page"><div className="auth-card auth-card-enter">
    <p className="section-kicker">{t("Join Steamn't")}</p><h1>{t("Create your account")}</h1>
    <p className="auth-intro">{t("Create an account and keep your game library in one place.")}</p>
    <form className="auth-form" onSubmit={submit}>
      <label><span>{t("Username")}</span><input name="username" type="text" placeholder={t("Your username")} value={form.username} onChange={change} autoComplete="username" required /></label>
      <label><span>{t("Email")}</span><input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={change} autoComplete="email" required /></label>
      <label><span>{t("Password")}</span><input name="password" type="password" placeholder={t("At least 8 characters")} value={form.password} onChange={change} autoComplete="new-password" required /></label>
      <label><span>{t("Confirm password")}</span><input name="password_confirm" type="password" placeholder={t("Repeat your password")} value={form.password_confirm} onChange={change} autoComplete="new-password" required /></label>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? t('Creating account…') : t('Create account')}</button>
      <p className="auth-legal">{t("By creating an account, you agree to the")}{" "}<Link to="/legal/terms">{t("Terms of Use")}</Link>{" "}{t("and acknowledge the")}{" "}<Link to="/legal/privacy">{t("Privacy Policy")}</Link>.</p>
    </form>
    <p className="auth-bottom-text">{t("Already have an account?")}{" "}<Link to="/login" state={{
          from: location.state?.from
        }}>{t("Log in")}</Link></p>
  </div></section>;
}
export default RegisterPage;
