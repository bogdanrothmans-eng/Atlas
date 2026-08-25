import Head from "next/head";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  currentToken, loadAdminDashboard, removeComment, setPlaceStatus, signIn,
  signOut, updateComment, updatePlace, type AdminComment, type AdminPlace,
  type Dashboard,
} from "../lib/adminRepository";

type DialogState =
  | { kind: "place"; item: AdminPlace }
  | { kind: "comment"; item: AdminComment }
  | { kind: "delete"; item: AdminComment }
  | null;

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = async () => {
    setLoading(true); setError("");
    try { setDashboard(await loadAdminDashboard()); }
    catch (e) { setError(e instanceof Error ? e.message : "Нет доступа"); setDashboard(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (currentToken()) void refresh(); }, []);
  useEffect(() => { if (!dialog) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDialog(null); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [dialog]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try { await signIn(String(data.get("email")), String(data.get("password"))); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось войти"); setLoading(false); }
  };
  const places = useMemo(() => dashboard?.places.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(query.toLowerCase())) ?? [], [dashboard, query]);
  const moderate = async (item: AdminPlace) => {
    setLoading(true);
    try { await setPlaceStatus(item.id, item.status === "published" ? "hidden" : "published"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось изменить видимость места. Повторите попытку."); setLoading(false); }
  };
  const savePlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (dialog?.kind !== "place") return;
    const data = new FormData(event.currentTarget);
    const next = { ...dialog.item, name: String(data.get("name")).trim(), category: String(data.get("category")), address: String(data.get("address")).trim(), description: String(data.get("description")).trim(), longitude: Number(data.get("longitude")), latitude: Number(data.get("latitude")) };
    setLoading(true); setError("");
    try { await updatePlace(next); setDialog(null); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить место"); setLoading(false); }
  };
  const saveComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (dialog?.kind !== "comment") return;
    const body = String(new FormData(event.currentTarget).get("body")).trim();
    setLoading(true); setError("");
    try { await updateComment(dialog.item.id, body); setDialog(null); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить комментарий"); setLoading(false); }
  };
  const confirmDelete = async () => {
    if (dialog?.kind !== "delete") return; setLoading(true); setError("");
    try { await removeComment(dialog.item.id); setDialog(null); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось удалить комментарий"); setLoading(false); }
  };

  return <><Head><title>Профиль администратора — Atlas</title><meta name="robots" content="noindex,nofollow" /></Head>
    <div className="admin-shell">
      <header className="admin-header"><Link href="/" className="brand"><span className="brand-mark">A</span><span>Atlas</span></Link><span className="admin-badge">Профиль администратора</span>{dashboard && <button type="button" onClick={() => { signOut(); setDashboard(null); }}>Выйти</button>}</header>
      {!dashboard ? <main className="login-wrap"><section className="login-card"><p className="eyebrow">Закрытый раздел</p><h1>Вход администратора</h1><p>Используйте аккаунт, которому предоставлен доступ к модерации Atlas.</p><form onSubmit={login}><label htmlFor="admin-email">Email</label><input id="admin-email" name="email" type="email" autoComplete="email" required /><label htmlFor="admin-password">Пароль</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required /><button className="primary" type="submit" disabled={loading}>{loading ? "Входим…" : "Войти"}</button></form><Link className="login-help-link" href="/forgot-password">Забыли пароль?</Link>{error && <p className="form-error" role="alert">{error}</p>}</section></main>
      : <main className="admin-main"><div className="admin-title"><div><p className="eyebrow">Профиль администратора</p><h1>Управление Atlas</h1></div><button type="button" onClick={refresh} disabled={loading}>↻ Обновить данные</button></div>{error && <p className="form-error" role="alert">{error}</p>}
        <section className="stats" aria-label="Статистика"><article><strong>{dashboard.places.length}</strong><span>Всего мест</span></article><article><strong>{dashboard.places.filter(p => p.status === "published").length}</strong><span>Опубликовано</span></article><article><strong>{dashboard.places.filter(p => p.status === "hidden").length}</strong><span>Скрыто</span></article><article><strong>{dashboard.comments.length}</strong><span>Комментариев</span></article></section>
        <section className="admin-section"><div className="section-heading"><div><h2>Места</h2><p>Редактируйте, публикуйте или скрывайте точки.</p></div><label className="admin-search"><span className="sr-only">Поиск мест по названию или адресу</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Название или адрес" /></label></div>{places.length ? <div className="admin-table-wrap"><table><thead><tr><th>Место</th><th>Категория</th><th>Статус</th><th>Актуальность</th><th><span className="sr-only">Действия</span></th></tr></thead><tbody>{places.map(p => <tr key={p.id}><td><strong>{p.name}</strong><small>{p.address}</small></td><td>{p.category}</td><td><span className={`status ${p.status}`}>{p.status === "published" ? "Опубликовано" : "Скрыто"}</span></td><td>{p.verified_count}</td><td><div className="row-actions"><button className="secondary-action" type="button" disabled={loading} onClick={() => setDialog({kind:"place",item:p})}>Изменить</button><button className="visibility-action" type="button" disabled={loading} onClick={() => moderate(p)}>{p.status === "published" ? "Скрыть" : "Опубликовать"}</button></div></td></tr>)}</tbody></table></div> : <div className="admin-empty"><strong>Места не найдены</strong><p>Измените запрос или очистите поле поиска.</p>{query && <button type="button" onClick={() => setQuery("")}>Очистить поиск</button>}</div>}</section>
        <section className="admin-section"><div className="section-heading"><div><h2>Комментарии</h2><p>Редактируйте или удаляйте сообщения пользователей.</p></div></div>{dashboard.comments.length ? <div className="comment-grid">{dashboard.comments.map(c => <article key={c.id}><div><strong>{c.author}</strong><small>{c.place_name}</small></div><p>{c.body}</p><footer><time>{new Date(c.created_at).toLocaleDateString("ru")}</time><div className="row-actions"><button className="secondary-action" type="button" disabled={loading} onClick={() => setDialog({kind:"comment",item:c})}>Изменить</button><button className="danger-action" type="button" disabled={loading} onClick={() => setDialog({kind:"delete",item:c})}>Удалить</button></div></footer></article>)}</div> : <div className="admin-empty"><strong>Комментариев пока нет</strong><p>Новые комментарии появятся здесь после публикации.</p></div>}</section>
      </main>}
      {dialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="close" type="button" aria-label="Закрыть окно" onClick={() => setDialog(null)}>×</button>
        {dialog.kind === "place" && <><h2 id="dialog-title">Редактировать место</h2><form onSubmit={savePlace}><label>Название<input name="name" defaultValue={dialog.item.name} required autoFocus /></label><label>Категория<select name="category" defaultValue={dialog.item.category}><option value="documents">Документы</option><option value="health">Медицина</option><option value="food">Еда</option><option value="work">Работа</option><option value="family">Для семьи</option><option value="leisure">Досуг</option></select></label><label>Адрес<input name="address" defaultValue={dialog.item.address} required /></label><label>Описание<textarea name="description" defaultValue={dialog.item.description} required /></label><div className="coordinate-fields"><label>Долгота<input name="longitude" type="number" step="any" defaultValue={dialog.item.longitude} required /></label><label>Широта<input name="latitude" type="number" step="any" defaultValue={dialog.item.latitude} required /></label></div><button className="primary" type="submit" disabled={loading}>Сохранить изменения</button></form></>}
        {dialog.kind === "comment" && <><h2 id="dialog-title">Редактировать комментарий</h2><form onSubmit={saveComment}><label>Текст комментария<textarea name="body" defaultValue={dialog.item.body} required autoFocus /></label><button className="primary" type="submit" disabled={loading}>Сохранить</button></form></>}
        {dialog.kind === "delete" && <><h2 id="dialog-title">Удалить комментарий?</h2><p>Комментарий пользователя «{dialog.item.author}» будет удалён без возможности восстановления.</p><div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>Отмена</button><button className="danger" type="button" disabled={loading} onClick={confirmDelete}>Удалить</button></div></>}
      </section></div>}
    </div></>;
}
