import Head from "next/head";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "../lib/adminRepository";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    try {
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить письмо. Проверьте подключение и повторите попытку.");
    } finally {
      setLoading(false);
    }
  };

  return <>
    <Head><title>Восстановление пароля — Atlas</title><meta name="robots" content="noindex,nofollow" /></Head>
    <div className="admin-shell">
      <header className="admin-header"><Link href="/" className="brand"><span className="brand-mark">A</span><span>Atlas</span></Link><span className="admin-badge">Профиль администратора</span></header>
      <main className="login-wrap"><section className="login-card">
        <p className="eyebrow">Восстановление доступа</p>
        <h1>Сбросить пароль</h1>
        {sent ? <div className="recovery-result" role="status"><p className="form-success">Если аккаунт существует, письмо со ссылкой уже отправлено. Проверьте входящие и папку «Спам».</p><Link href="/profile">Вернуться ко входу</Link></div> : <>
          <p>Укажите email администратора. Мы отправим ссылку для создания нового пароля.</p>
          <form onSubmit={submit}>
            <label htmlFor="recovery-email">Email</label>
            <input id="recovery-email" name="email" type="email" autoComplete="email" defaultValue="gogachij@gmail.com" required autoFocus />
            <button className="primary" type="submit" disabled={loading}>{loading ? "Отправляем…" : "Отправить ссылку"}</button>
          </form>
          <Link className="login-help-link" href="/profile">Вернуться ко входу</Link>
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
      </section></main>
    </div>
  </>;
}
