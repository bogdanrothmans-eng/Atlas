import Head from "next/head";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  currentToken,
  loadAdminDashboard,
  removeComment,
  setPlaceStatus,
  signIn,
  signOut,
  updateComment,
  updatePlace,
  type AdminComment,
  type AdminPlace,
  type Dashboard,
} from "../lib/adminRepository";
import { Icon } from "../components/Icons";
import { Modal } from "../components/Modal";

type DialogState =
  | { kind: "place"; item: AdminPlace }
  | { kind: "comment"; item: AdminComment }
  | { kind: "delete"; item: AdminComment }
  | null;

const categoryLabels: Record<string, string> = {
  documents: "Документы",
  health: "Медицина",
  food: "Еда",
  work: "Работа",
  family: "Для семьи",
  leisure: "Досуг",
};

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await loadAdminDashboard());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Нет доступа к данным Atlas");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentToken()) void refresh();
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти. Проверьте данные и повторите попытку.");
      setLoading(false);
    }
  };

  const places = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dashboard?.places.filter((place) => `${place.name} ${place.address}`.toLowerCase().includes(normalizedQuery)) ?? [];
  }, [dashboard, query]);

  const moderate = async (item: AdminPlace) => {
    setLoading(true);
    setError("");
    try {
      await setPlaceStatus(item.id, item.status === "published" ? "hidden" : "published");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить видимость места. Повторите попытку.");
      setLoading(false);
    }
  };

  const savePlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.kind !== "place") return;
    const data = new FormData(event.currentTarget);
    const next = {
      ...dialog.item,
      name: String(data.get("name")).trim(),
      category: String(data.get("category")),
      address: String(data.get("address")).trim(),
      description: String(data.get("description")).trim(),
      longitude: Number(data.get("longitude")),
      latitude: Number(data.get("latitude")),
    };
    setLoading(true);
    setError("");
    try {
      await updatePlace(next);
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить место. Повторите попытку.");
      setLoading(false);
    }
  };

  const saveComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.kind !== "comment") return;
    const body = String(new FormData(event.currentTarget).get("body")).trim();
    setLoading(true);
    setError("");
    try {
      await updateComment(dialog.item.id, body);
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить комментарий. Повторите попытку.");
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog?.kind !== "delete") return;
    setLoading(true);
    setError("");
    try {
      await removeComment(dialog.item.id);
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить комментарий. Повторите попытку.");
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Управление Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="admin-shell">
        <header className="admin-header">
          <Link href="/" className="brand" aria-label="Вернуться на карту Atlas">
            <span className="brand-mark" aria-hidden="true">A</span>
            <span className="brand-name">Atlas</span>
          </Link>
          <span className="admin-badge">Управление</span>
          <Link className="back-to-map" href="/"><Icon name="arrow-left" /> Карта</Link>
          {dashboard && (
            <button type="button" onClick={() => { signOut(); setDashboard(null); }}>
              Выйти
            </button>
          )}
        </header>

        {!dashboard ? (
          <main className="login-wrap">
            <section className="login-card" aria-labelledby="login-title">
              <div className="login-icon" aria-hidden="true"><Icon name="user" /></div>
              <p className="eyebrow">Закрытый раздел</p>
              <h1 id="login-title">Вход администратора</h1>
              <p>Войдите в аккаунт с доступом к модерации мест и комментариев.</p>
              <form onSubmit={login} aria-describedby={error ? "login-error" : undefined}>
                <label htmlFor="admin-email">Email</label>
                <input id="admin-email" name="email" type="email" autoComplete="username" spellCheck={false} required autoFocus />
                <label htmlFor="admin-password">Пароль</label>
                <div className="password-field">
                  <input id="admin-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} aria-pressed={showPassword}>
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                <button className="primary" type="submit" disabled={loading}>
                  {loading ? "Входим…" : "Войти"}
                </button>
              </form>
              <Link className="login-help-link" href="/forgot-password">Восстановить пароль</Link>
              {error && <p id="login-error" className="form-error" role="alert">{error}</p>}
            </section>
          </main>
        ) : (
          <main className="admin-main">
            <div className="admin-title">
              <div><p className="eyebrow">Панель администратора</p><h1>Управление Atlas</h1><p>Проверяйте места и поддерживайте комментарии в порядке.</p></div>
              <button type="button" onClick={refresh} disabled={loading}>{loading ? "Обновляем…" : "Обновить данные"}</button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}

            <section className="stats" aria-label="Статистика Atlas">
              <article><span>Всего мест</span><strong>{dashboard.places.length}</strong></article>
              <article><span>Опубликовано</span><strong>{dashboard.places.filter((place) => place.status === "published").length}</strong></article>
              <article><span>Скрыто</span><strong>{dashboard.places.filter((place) => place.status === "hidden").length}</strong></article>
              <article><span>Комментариев</span><strong>{dashboard.comments.length}</strong></article>
            </section>

            <section className="admin-section">
              <div className="section-heading">
                <div><p className="eyebrow">Контент карты</p><h2>Места</h2><p>Редактируйте данные и управляйте публикацией точек.</p></div>
                <div className="admin-search">
                  <Icon name="search" />
                  <label className="sr-only" htmlFor="admin-place-search">Поиск мест по названию или адресу</label>
                  <input id="admin-place-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или адрес" />
                  {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")}><Icon name="close" /></button>}
                </div>
              </div>
              {places.length ? (
                <div className="admin-table-wrap">
                  <table>
                    <caption className="sr-only">Места на карте Atlas</caption>
                    <thead><tr><th>Место</th><th>Категория</th><th>Статус</th><th>Подтверждения</th><th><span className="sr-only">Действия</span></th></tr></thead>
                    <tbody>
                      {places.map((place) => (
                        <tr key={place.id}>
                          <td data-label="Место"><strong>{place.name}</strong><small>{place.address}</small></td>
                          <td data-label="Категория">{categoryLabels[place.category] ?? place.category}</td>
                          <td data-label="Статус"><span className={`status ${place.status}`}>{place.status === "published" ? "Опубликовано" : "Скрыто"}</span></td>
                          <td data-label="Подтверждения" className="numeric">{place.verified_count}</td>
                          <td className="table-actions"><div className="row-actions"><button className="secondary-action" type="button" disabled={loading} onClick={() => setDialog({ kind: "place", item: place })}>Изменить</button><button className="visibility-action" type="button" disabled={loading} onClick={() => moderate(place)}>{place.status === "published" ? "Скрыть" : "Опубликовать"}</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty"><Icon name="search" aria-hidden="true" /><strong>Места не найдены</strong><p>Измените запрос или очистите поиск.</p>{query && <button type="button" onClick={() => setQuery("")}>Очистить поиск</button>}</div>
              )}
            </section>

            <section className="admin-section">
              <div className="section-heading"><div><p className="eyebrow">Обратная связь</p><h2>Комментарии</h2><p>Редактируйте или удаляйте сообщения пользователей.</p></div></div>
              {dashboard.comments.length ? (
                <div className="comment-grid">
                  {dashboard.comments.map((comment) => (
                    <article key={comment.id}>
                      <header><div className="comment-author" aria-hidden="true">{comment.author.slice(0, 1).toUpperCase()}</div><div><strong>{comment.author}</strong><small>{comment.place_name}</small></div></header>
                      <p>{comment.body}</p>
                      <footer><time>{new Date(comment.created_at).toLocaleDateString("ru")}</time><div className="row-actions"><button className="secondary-action" type="button" disabled={loading} onClick={() => setDialog({ kind: "comment", item: comment })}>Изменить</button><button className="danger-action" type="button" disabled={loading} onClick={() => setDialog({ kind: "delete", item: comment })}>Удалить</button></div></footer>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty"><Icon name="message" aria-hidden="true" /><strong>Комментариев пока нет</strong><p>Новые комментарии появятся здесь после публикации.</p></div>
              )}
            </section>
          </main>
        )}

        <Modal open={Boolean(dialog)} onClose={() => setDialog(null)} labelledBy="dialog-title">
          {dialog && (
            <section className="admin-dialog">
              <button className="close" type="button" aria-label="Закрыть окно" onClick={() => setDialog(null)}><Icon name="close" /></button>
              {dialog.kind === "place" && (
                <>
                  <p className="eyebrow">Место на карте</p><h2 id="dialog-title">Редактировать место</h2>
                  <form onSubmit={savePlace}>
                    <label htmlFor="edit-place-name">Название</label><input id="edit-place-name" name="name" defaultValue={dialog.item.name} maxLength={120} required autoFocus data-initial-focus />
                    <label htmlFor="edit-place-category">Категория</label><select id="edit-place-category" name="category" defaultValue={dialog.item.category}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                    <label htmlFor="edit-place-address">Адрес</label><input id="edit-place-address" name="address" defaultValue={dialog.item.address} maxLength={200} required />
                    <label htmlFor="edit-place-description">Описание</label><textarea id="edit-place-description" name="description" defaultValue={dialog.item.description} maxLength={1000} required />
                    <div className="coordinate-fields">
                      <label>Долгота<input name="longitude" type="number" step="any" min={-180} max={180} defaultValue={dialog.item.longitude} required /></label>
                      <label>Широта<input name="latitude" type="number" step="any" min={-90} max={90} defaultValue={dialog.item.latitude} required /></label>
                    </div>
                    <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>Отменить</button><button className="primary" type="submit" disabled={loading}>{loading ? "Сохраняем…" : "Сохранить изменения"}</button></div>
                  </form>
                </>
              )}
              {dialog.kind === "comment" && (
                <>
                  <p className="eyebrow">Комментарий пользователя</p><h2 id="dialog-title">Редактировать комментарий</h2>
                  <form onSubmit={saveComment}><label htmlFor="edit-comment">Текст комментария</label><textarea id="edit-comment" name="body" defaultValue={dialog.item.body} maxLength={1000} required autoFocus data-initial-focus /><div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>Отменить</button><button className="primary" type="submit" disabled={loading}>{loading ? "Сохраняем…" : "Сохранить комментарий"}</button></div></form>
                </>
              )}
              {dialog.kind === "delete" && (
                <>
                  <div className="danger-icon" aria-hidden="true"><Icon name="message" /></div>
                  <h2 id="dialog-title">Удалить комментарий?</h2>
                  <p>Комментарий пользователя «{dialog.item.author}» будет удалён без возможности восстановления.</p>
                  <div className="dialog-actions"><button type="button" autoFocus data-initial-focus onClick={() => setDialog(null)}>Отменить</button><button className="danger" type="button" disabled={loading} onClick={confirmDelete}>{loading ? "Удаляем…" : "Удалить комментарий"}</button></div>
                </>
              )}
            </section>
          )}
        </Modal>
      </div>
    </>
  );
}
