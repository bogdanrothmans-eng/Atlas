import Head from "next/head";
import Link from "next/link";
import { Icon } from "../components/Icons";

export default function NotFoundPage() {
  return <>
    <Head>
      <title>Страница не найдена — Atlas</title>
      <meta name="robots" content="noindex,nofollow" />
    </Head>
    <div className="not-found-shell">
      <main className="not-found-card">
        <Link className="brand" href="/" aria-label="Вернуться на карту Atlas">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Atlas</span>
        </Link>
        <p className="not-found-code">Ошибка 404</p>
        <h1>Такой страницы нет</h1>
        <p>Возможно, адрес изменился или в ссылке есть опечатка. Вернитесь на карту и продолжите поиск мест.</p>
        <Link className="primary" href="/"><Icon name="arrow-left" /> Вернуться на карту</Link>
      </main>
    </div>
  </>;
}
