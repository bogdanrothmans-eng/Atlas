import Head from "next/head";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { updatePassword } from "../lib/adminRepository";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [linkError, setLinkError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token") || "";
    const recoveryError = params.get("error_description");
    if (accessToken) setToken(accessToken);
    else setLinkError(recoveryError || "Ссылка недействительна или устарела. Запросите новую ссылку.");
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirmation"));
    if (password !== confirmation) { setError("Пароли не совпадают"); return; }
    setLoading(true);
    setError("");
    try {
      await updatePassword(token, password);
      setComplete(true);
      window.history.replaceState(null, "", "/reset-password");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить пароль. Запросите новую ссылку и повторите попытку.");
    } finally {
      setLoading(false);
    }
  };

  return <>
    <Head><title>Новый пароль — Atlas</title><meta name="robots" content="noindex,nofollow" /></Head>
    <div className="admin-shell">
      <header className="admin-header"><Link href="/" className="brand"><span className="brand-mark">A</span><span>Atlas</span></Link><span className="admin-badge">Аккаунт Atlas</span></header>
      <main className="login-wrap"><section className="login-card">
        <p className="eyebrow">Восстановление доступа</p>
        <h1>Создать новый пароль</h1>
        {complete ? <div className="recovery-result" role="status"><p className="form-success">Пароль изменён. Теперь войдите с новым паролем.</p><Link href="/auth">Перейти ко входу</Link></div> : linkError ? <div className="recovery-result"><p className="form-error" role="alert">{linkError}</p><Link href="/forgot-password">Запросить новую ссылку</Link></div> : <>
          <p>Используйте не менее 8 символов. Новый пароль можно сохранить в менеджере паролей.</p>
          <form onSubmit={submit}>
            <label htmlFor="new-password">Новый пароль</label>
            <input id="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required autoFocus />
            <label htmlFor="confirm-password">Повторите пароль</label>
            <input id="confirm-password" name="confirmation" type="password" minLength={8} autoComplete="new-password" required />
            <button className="primary" type="submit" disabled={loading || !token}>{loading ? "Сохраняем…" : "Сохранить пароль"}</button>
          </form>
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
      </section></main>
    </div>
  </>;
}
