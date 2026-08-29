import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useAuth, userDisplayName } from "../components/AuthProvider";
import { Icon } from "../components/Icons";
import { supabase } from "../lib/supabaseClient";

const capabilities = [
  { icon: "location" as const, title: "Добавлять места", text: "Новые точки отправляются на модерацию." },
  { icon: "message" as const, title: "Обсуждать", text: "Пишите комментарии и отвечайте другим." },
  { icon: "thumb-up" as const, title: "Оценивать", text: "Ставьте лайки и дизлайки полезным местам." },
  { icon: "camera" as const, title: "Добавлять фото", text: "Показывайте актуальный вид места." },
  { icon: "flag" as const, title: "Сообщать о проблемах", text: "Отправляйте жалобы модераторам Atlas." },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const name = userDisplayName(user);
  const provider = String(user?.app_metadata.provider || "email");

  const logout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    await router.replace("/");
  };

  return <>
    <Head><title>Профиль — Atlas</title><meta name="robots" content="noindex,nofollow" /></Head>
    <div className="account-page">
      <header className="account-header">
        <Link href="/" className="brand" aria-label="Atlas — вернуться на карту"><span className="brand-mark" aria-hidden="true">A</span><span className="brand-name">Atlas</span></Link>
        <Link className="back-to-map" href="/"><Icon name="arrow-left" /> Карта</Link>
      </header>
      <main className="account-main">
        {loading ? <p className="account-loading" role="status">Загружаем профиль…</p> : !user ? (
          <section className="account-guest" aria-labelledby="guest-title">
            <div className="account-avatar"><Icon name="user" /></div>
            <p className="eyebrow">Гостевой режим</p>
            <h1 id="guest-title">Войдите, чтобы участвовать</h1>
            <p>Карта доступна без регистрации. Вход нужен только для публикаций, реакций и жалоб.</p>
            <Link className="primary" href="/auth?next=%2Fprofile">Войти или создать аккаунт</Link>
            <Link href="/">Продолжить как гость</Link>
          </section>
        ) : (
          <>
            <section className="account-hero" aria-labelledby="profile-title">
              <div className="account-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
              <div><p className="eyebrow">Профиль Atlas</p><h1 id="profile-title">{name}</h1><p>{user.email || "Аккаунт без email"} · вход через {provider === "custom:telegram" ? "Telegram" : provider === "facebook" ? "Facebook" : provider === "google" ? "Google" : "email"}</p></div>
              <button type="button" onClick={logout} disabled={signingOut}>{signingOut ? "Выходим…" : "Выйти"}</button>
            </section>
            <section className="account-capabilities" aria-labelledby="capabilities-title">
              <div><p className="eyebrow">Ваши возможности</p><h2 id="capabilities-title">Участвуйте в жизни карты</h2></div>
              <div className="capability-grid">{capabilities.map((item) => <article key={item.title}><Icon name={item.icon} /><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>
            </section>
            {user.email?.toLowerCase() === "mrgold2332@ya.ru" && <Link className="admin-profile-link" href="/admin"><Icon name="work" /> Открыть панель администратора <Icon name="chevron-right" /></Link>}
          </>
        )}
      </main>
    </div>
  </>;
}
