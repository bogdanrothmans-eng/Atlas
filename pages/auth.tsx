import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import type { Provider } from "@supabase/supabase-js";
import { useAuth } from "../components/AuthProvider";
import { Icon } from "../components/Icons";
import { safeNextPath, supabase } from "../lib/supabaseClient";

type AuthMode = "signin" | "signup";
type SocialProvider = { id: Provider; label: string; icon: "google" | "facebook" | "telegram" };

const providers: SocialProvider[] = [
  { id: "google", label: "Продолжить с Google", icon: "google" },
  { id: "facebook", label: "Продолжить с Facebook", icon: "facebook" },
  { id: "custom:telegram", label: "Продолжить с Telegram", icon: "telegram" },
];

function ProviderIcon({ name }: { name: SocialProvider["icon"] }) {
  if (name === "google") return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z"/></svg>;
  if (name === "facebook") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1877F2"/><path fill="#fff" d="M15.2 13.2h-2.1V21h-3.2v-7.8H8.4v-2.7h1.5V8.9c0-2.2 1-3.6 3.9-3.6h2.1V8h-1.3c-1 0-1.5.4-1.5 1.2v1.3H16l-.8 2.7Z"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#229ED9"/><path fill="#fff" d="m6 11.6 10.7-4.1c.5-.2 1 .1.8 1l-1.8 8.6c-.1.6-.5.7-1 .5l-2.8-2.1-1.3 1.3c-.2.2-.3.3-.6.3l.2-2.8 5.1-4.6c.2-.2 0-.4-.3-.2l-6.3 4-2.7-.9c-.6-.2-.6-.6 0-1Z"/></svg>;
}

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nextPath = safeNextPath(router.query.next);

  useEffect(() => {
    if (!router.isReady) return;
    const providerError = typeof router.query.error_description === "string" ? router.query.error_description : "";
    if (providerError) setError("Не удалось войти через выбранный сервис. Проверьте настройки и повторите попытку.");
  }, [router.isReady, router.query.error_description]);

  useEffect(() => {
    if (router.isReady && !sessionLoading && user && !sent) void router.replace(nextPath);
  }, [nextPath, router, router.isReady, sent, sessionLoading, user]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setSent(false);
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const socialSignIn = async (provider: SocialProvider) => {
    setLoading(provider.id);
    setError("");
    const redirectTo = `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: provider.id,
      options: { redirectTo, scopes: provider.id === "custom:telegram" ? "openid profile" : undefined },
    });
    if (authError) {
      setError(`Вход через ${provider.icon === "telegram" ? "Telegram" : provider.icon === "facebook" ? "Facebook" : "Google"} пока недоступен. Выберите email или повторите позже.`);
      setLoading(null);
    }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const name = String(data.get("name") || "").trim();
    setLoading("email");
    setError("");

    if (mode === "signin") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError("Email или пароль не подошли. Проверьте данные или восстановите пароль.");
    } else {
      const { data: result, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}` },
      });
      if (authError) {
        setError(authError.message.includes("already") ? "Аккаунт с таким email уже существует. Переключитесь на вход." : "Не удалось создать аккаунт. Проверьте email и попробуйте ещё раз.");
      } else if (!result.session) {
        setSent(true);
      }
    }
    setLoading(null);
  };

  const switchPrompt: ReactNode = mode === "signin"
    ? <>Нет аккаунта? <button type="button" onClick={() => changeMode("signup")}>Создать аккаунт</button></>
    : <>Уже есть аккаунт? <button type="button" onClick={() => changeMode("signin")}>Войти</button></>;

  return <>
    <Head>
      <title>{mode === "signin" ? "Вход" : "Регистрация"} — Atlas</title>
      <meta name="description" content="Войдите в Atlas, чтобы добавлять места и участвовать в обсуждениях." />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    </Head>
    <main className="auth-page">
      <section className="auth-context" aria-labelledby="auth-context-title">
        <Link className="auth-brand" href="/" aria-label="Atlas — вернуться на карту"><span className="brand-mark" aria-hidden="true">A</span><span>Atlas</span></Link>
        <div className="auth-context-copy">
          <p className="eyebrow">Карта сообщества</p>
          <h1 id="auth-context-title">Делитесь местами, которым доверяете</h1>
          <p>После входа вы сможете добавлять точки, фотографии, комментарии и реакции. Смотреть карту можно без регистрации.</p>
          <ul>
            <li><Icon name="location" /><span><strong>Добавляйте полезные места</strong><small>Новые точки проходят модерацию.</small></span></li>
            <li><Icon name="message" /><span><strong>Делитесь опытом</strong><small>Пишите комментарии и отвечайте другим.</small></span></li>
            <li><Icon name="flag" /><span><strong>Помогайте сообществу</strong><small>Оценивайте места и сообщайте о проблемах.</small></span></li>
          </ul>
        </div>
        <p className="auth-context-note">Atlas использует вход только для защиты публикаций от спама.</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <Link className="auth-back" href={nextPath}><Icon name="arrow-left" /> Вернуться на карту</Link>
          {sent ? (
            <div className="auth-success" role="status">
              <div className="auth-success-icon" aria-hidden="true"><Icon name="send" /></div>
              <p className="eyebrow">Проверьте почту</p>
              <h2 id="auth-title">Подтвердите email</h2>
              <p>Мы отправили ссылку для завершения регистрации. После подтверждения вы вернётесь в Atlas.</p>
              <button className="primary" type="button" onClick={() => { setSent(false); setMode("signin"); }}>Перейти ко входу</button>
            </div>
          ) : (
            <>
              <p className="eyebrow">{mode === "signin" ? "С возвращением" : "Новый профиль"}</p>
              <h2 id="auth-title">{mode === "signin" ? "Войти в Atlas" : "Создать аккаунт"}</h2>
              <p className="auth-intro">{mode === "signin" ? "Выберите удобный способ входа." : "Регистрация занимает меньше минуты."}</p>

              <div className="social-login" aria-label="Войти через социальный сервис">
                {providers.map((provider) => (
                  <button key={provider.id} type="button" onClick={() => socialSignIn(provider)} disabled={Boolean(loading)}>
                    <ProviderIcon name={provider.icon} /><span>{loading === provider.id ? "Открываем…" : provider.label}</span>
                  </button>
                ))}
              </div>

              <div className="auth-divider"><span>или по email</span></div>
              <form className="auth-form" onSubmit={submitEmail} aria-describedby={error ? "auth-error" : undefined}>
                {mode === "signup" && <><label htmlFor="auth-name">Имя</label><input id="auth-name" name="name" type="text" autoComplete="name" maxLength={80} required placeholder="Как к вам обращаться" /></>}
                <label htmlFor="auth-email">Email</label>
                <input ref={emailRef} id="auth-email" name="email" type="email" autoComplete="email" spellCheck={false} required placeholder="name@example.com" />
                <div className="auth-password-label"><label htmlFor="auth-password">Пароль</label>{mode === "signin" && <Link href="/forgot-password">Восстановить пароль</Link>}</div>
                <input id="auth-password" name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required aria-describedby="password-hint" />
                <small id="password-hint" className="field-hint">Минимум 8 символов.</small>
                {error && <p id="auth-error" className="form-error" role="alert">{error}</p>}
                <button className="primary auth-submit" type="submit" disabled={Boolean(loading)}>{loading === "email" ? (mode === "signin" ? "Входим…" : "Создаём…") : mode === "signin" ? "Войти по email" : "Создать аккаунт"}</button>
              </form>
              <p className="auth-switch">{switchPrompt}</p>
              <p className="auth-legal">Продолжая, вы соглашаетесь соблюдать правила сообщества Atlas.</p>
            </>
          )}
        </div>
      </section>
    </main>
  </>;
}
