import { t, useLocale } from "../i18n/index.js";
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { resolveReturnLocation } from '../utils/returnLocation';
function LoginPage() {
  useLocale();
  const {
    login
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate(resolveReturnLocation(location.state?.from), {
        replace: true
      });
    } catch (err) {
      setError(err.response?.status === 401 ? t('Unable to sign in. Check your email and password.') : err.response?.data?.detail || t('Unable to sign in. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  };
  return <section className="auth-page"><div className="auth-card auth-card-enter">
    <p className="section-kicker">{t("Steamn't account")}</p><h1>{t("Welcome back")}</h1>
    <p className="auth-intro">{t("Sign in to continue discovering games.")}</p>
    <form className="auth-form" onSubmit={submit}>
      <label><span>{t("Email")}</span><input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({
            ...form,
            email: e.target.value
          })} autoComplete="email" required /></label>
      <label><span>{t("Password")}</span><input name="password" type="password" placeholder={t("Enter your password")} value={form.password} onChange={e => setForm({
            ...form,
            password: e.target.value
          })} autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? t('Signing in…') : t('Sign in')}</button>
    </form>
    <p className="auth-bottom-text"><Link to="/reset-password">{t("Forgot password?")}</Link></p>
    <p className="auth-bottom-text">{t("Don't have an account?")}{" "}<Link to="/register" state={{
          from: location.state?.from
        }}>{t("Create one")}</Link></p>
  </div></section>;
}
export default LoginPage;
