import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import Link from "next/link";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import {
  confirmPlace,
  createComment,
  createPlace,
  isSupabaseConfigured,
  loadPlaces,
  type Category,
  type Comment,
  type Place,
} from "../lib/atlasRepository";
import { Icon, type IconName } from "./Icons";
import { Modal } from "./Modal";

const categories: Record<Category, { label: string; icon: IconName; color: string }> = {
  documents: { label: "Документы", icon: "documents", color: "#6f4bd8" },
  health: { label: "Медицина", icon: "health", color: "#c83f52" },
  food: { label: "Еда", icon: "food", color: "#a94f18" },
  work: { label: "Работа", icon: "work", color: "#24739e" },
  family: { label: "Для семьи", icon: "family", color: "#bd3f7f" },
  leisure: { label: "Досуг", icon: "leisure", color: "#2f8258" },
};

const seedPlaces: Place[] = [
  { id: "1", name: "Phuket Immigration Office", category: "documents", address: "Phuket Road, Phuket Town", description: "Иммиграционный офис: визы, продления и регистрация иностранцев.", lng: 98.3913, lat: 7.8663, verified: 18, addedBy: "Анна К.", comments: [{ id: "c1", author: "Михаил", text: "Лучше приезжать утром и заранее подготовить копии документов.", date: "12 августа" }] },
  { id: "2", name: "HOMA Coworking", category: "work", address: "Samkong, Phuket Town", description: "Коворкинг со стабильным Wi‑Fi, переговорными и зонами для звонков.", lng: 98.3837, lat: 7.9061, verified: 31, addedBy: "Илья", comments: [] },
  { id: "3", name: "Bangkok Hospital Phuket", category: "health", address: "Hongyok Utis Road", description: "Международная частная клиника. Персонал говорит по-английски.", lng: 98.3827, lat: 7.9041, verified: 12, addedBy: "София", comments: [] },
  { id: "4", name: "Naka Weekend Market", category: "food", address: "Wirat Hong Yok Road", description: "Большой вечерний рынок с тайской едой, фруктами и локальными продуктами.", lng: 98.3729, lat: 7.8807, verified: 46, addedBy: "Команда Atlas", comments: [] },
  { id: "5", name: "Karon Viewpoint", category: "leisure", address: "Karon, Mueang Phuket", description: "Смотровая площадка с видом на пляжи Ката Ной, Ката и Карон.", lng: 98.3026, lat: 7.7973, verified: 73, addedBy: "Команда Atlas", comments: [] },
  { id: "6", name: "Rawai Park", category: "family", address: "Rawai, Mueang Phuket", description: "Семейный парк с игровыми зонами и бассейном для детей.", lng: 98.3278, lat: 7.7799, verified: 9, addedBy: "Мария", comments: [] },
];

const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const STORAGE_KEY = "atlas-demo-phuket-v1";

const markerSymbols: Record<Category, string> = {
  documents: "▤",
  health: "+",
  food: "⌁",
  work: "◇",
  family: "♥",
  leisure: "✦",
};

export default function AtlasMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const addingRef = useRef(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const [places, setPlaces] = useState<Place[]>(seedPlaces);
  const [selected, setSelected] = useState<Place | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ lng: number; lat: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [loadingPlaces, setLoadingPlaces] = useState(isSupabaseConfigured);
  const [savingPlace, setSavingPlace] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(() => new Set());

  addingRef.current = adding;

  useEffect(() => {
    if (isSupabaseConfigured) {
      loadPlaces()
        .then((data) => {
          if (data.length) setPlaces(data);
        })
        .catch(() => setNotice("Не удалось обновить данные. Показали сохранённую подборку."))
        .finally(() => setLoadingPlaces(false));
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { setPlaces(JSON.parse(raw)); } catch { /* Keep the built-in collection. */ }
      }
      setLoadingPlaces(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);

  useEffect(() => {
    if (!adding) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdding(false);
        setNotice("Добавление отменено");
        addButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [adding]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return places.filter((place) => {
      const matchesCategory = filter === "all" || place.category === filter;
      const matchesQuery = `${place.name} ${place.address} ${place.description}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [places, filter, query]);

  const categoryCounts = useMemo(() => {
    return places.reduce<Record<Category, number>>((counts, place) => {
      counts[place.category] += 1;
      return counts;
    }, { documents: 0, health: 0, food: 0, work: 0, family: 0, leisure: 0 });
  }, [places]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: osmStyle,
      center: [98.365, 7.86],
      zoom: 10.7,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("click", (event) => {
      if (addingRef.current) {
        setDraft({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        setAdding(false);
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = visible.map((place) => {
      const category = categories[place.category];
      const element = document.createElement("button");
      element.className = `place-marker${selected?.id === place.id ? " is-selected" : ""}`;
      element.type = "button";
      element.title = place.name;
      element.setAttribute("aria-label", `${category.label}: ${place.name}`);
      element.setAttribute("aria-pressed", selected?.id === place.id ? "true" : "false");
      element.style.setProperty("--marker", category.color);
      element.textContent = markerSymbols[place.category];
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelected(place);
        map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 14), essential: false });
      });
      return new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
    });
  }, [visible, selected?.id]);

  const beginAdding = () => {
    setAdding(true);
    setSelected(null);
    setNotice("");
  };

  const cancelAdding = () => {
    setAdding(false);
    setNotice("Добавление отменено");
    addButtonRef.current?.focus();
  };

  const useMapCenter = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    setDraft({ lng: center.lng, lat: center.lat });
    setAdding(false);
  };

  const resetDiscovery = () => {
    setQuery("");
    setFilter("all");
    setSelected(null);
    mapRef.current?.flyTo({ center: [98.365, 7.86], zoom: 10.7, essential: false });
  };

  const addPlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || savingPlace) return;
    const data = new FormData(event.currentTarget);
    let place: Place = {
      id: crypto.randomUUID(),
      name: String(data.get("name")).trim(),
      address: String(data.get("address")).trim(),
      description: String(data.get("description")).trim(),
      category: data.get("category") as Category,
      ...draft,
      verified: 0,
      addedBy: "Гость",
      comments: [],
    };
    setSavingPlace(true);
    try {
      if (isSupabaseConfigured) place = await createPlace(place);
      setPlaces((current) => [...current, place]);
      setDraft(null);
      setSelected(place);
      setNotice(isSupabaseConfigured ? "Место добавлено на общую карту" : "Место сохранено в этом браузере");
    } catch {
      setNotice("Не удалось добавить место. Проверьте соединение и повторите попытку.");
    } finally {
      setSavingPlace(false);
    }
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || savingComment) return;
    const text = String(new FormData(event.currentTarget).get("comment")).trim();
    if (!text) return;
    let comment: Comment = { id: crypto.randomUUID(), author: "Гость", text, date: "сегодня" };
    setSavingComment(true);
    try {
      if (isSupabaseConfigured) comment = await createComment(selected.id, comment);
      const updated = { ...selected, comments: [...selected.comments, comment] };
      setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place));
      setSelected(updated);
      event.currentTarget.reset();
      setNotice("Комментарий опубликован");
    } catch {
      setNotice("Не удалось опубликовать комментарий. Повторите попытку.");
    } finally {
      setSavingComment(false);
    }
  };

  const verify = async () => {
    if (!selected || verifying || verifiedIds.has(selected.id)) return;
    setVerifying(true);
    try {
      const count = isSupabaseConfigured ? await confirmPlace(selected.id) : selected.verified + 1;
      const updated = { ...selected, verified: count };
      setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place));
      setSelected(updated);
      setVerifiedIds((current) => new Set(current).add(updated.id));
      setNotice("Спасибо — актуальность подтверждена");
    } catch {
      setNotice("Не удалось подтвердить актуальность. Повторите попытку.");
    } finally {
      setVerifying(false);
    }
  };

  const activeCategory = selected ? categories[selected.category] : null;
  const hasFilters = Boolean(query.trim()) || filter !== "all";

  return (
    <div className={`atlas${adding ? " is-adding" : ""}`}>
      <a className="skip-link" href="#map">Перейти к карте</a>
      <h1 className="sr-only">Atlas — полезные места на Пхукете</h1>

      <header className="topbar">
        <button className="brand" type="button" onClick={resetDiscovery} aria-label="Atlas — показать все места">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="brand-name">Atlas</span>
        </button>
        <div className="city" aria-label="Текущий город: Пхукет, Таиланд">
          <span>Пхукет</span>
          <small>Таиланд</small>
        </div>
        <div className="search">
          <Icon name="search" />
          <label className="sr-only" htmlFor="place-search">Поиск мест</label>
          <input
            id="place-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, адрес или описание"
            autoComplete="off"
            aria-controls="map"
          />
          {query && (
            <button type="button" className="search-clear" aria-label="Очистить поиск" onClick={() => setQuery("")}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <button
          ref={addButtonRef}
          className="primary add-place-button"
          type="button"
          aria-label={adding ? "Отменить добавление места" : "Добавить место"}
          aria-pressed={adding}
          onClick={adding ? cancelAdding : beginAdding}
        >
          <Icon name={adding ? "close" : "plus"} />
          <span>{adding ? "Отменить" : "Добавить место"}</span>
        </button>
        <Link className="profile-link" href="/profile" aria-label="Открыть профиль администратора">
          <Icon name="user" />
        </Link>
      </header>

      <div className="filters-wrap">
        <nav className="filters" aria-label="Категории">
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            Все места <span>{places.length}</span>
          </button>
          {(Object.keys(categories) as Category[]).map((key) => (
            <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              <i style={{ "--category": categories[key].color } as React.CSSProperties} aria-hidden="true">
                <Icon name={categories[key].icon} />
              </i>
              {categories[key].label}
              <span className="chip-count">{categoryCounts[key]}</span>
            </button>
          ))}
        </nav>
      </div>

      <main id="map" ref={containerRef} className="map" aria-label="Интерактивная карта Пхукета" aria-busy={loadingPlaces} />

      {!selected && !adding && visible.length > 0 && (
        <section className="map-intro" aria-labelledby="map-intro-title">
          <p className="eyebrow">Карта сообщества</p>
          <h2 id="map-intro-title">Найдите полезное место рядом</h2>
          <p>Выберите метку, чтобы увидеть детали, отзывы и маршрут.</p>
          <div className="map-intro-meta"><span>{loadingPlaces ? "Обновляем…" : `${visible.length} мест`}</span><span>Пхукет</span></div>
        </section>
      )}

      {adding && (
        <section className="add-instruction" aria-labelledby="add-instruction-title">
          <div className="instruction-icon" aria-hidden="true"><Icon name="location" /></div>
          <div>
            <h2 id="add-instruction-title">Где находится место?</h2>
            <p>Выберите точку на карте или используйте её центр.</p>
          </div>
          <div className="instruction-actions">
            <button type="button" onClick={useMapCenter}>Использовать центр карты</button>
            <button type="button" onClick={cancelAdding}>Отменить</button>
          </div>
        </section>
      )}

      {!loadingPlaces && visible.length === 0 && (
        <section className="map-empty" aria-labelledby="map-empty-title">
          <div className="empty-icon" aria-hidden="true"><Icon name="search" /></div>
          <h2 id="map-empty-title">Места не найдены</h2>
          <p>Попробуйте другой запрос или сбросьте выбранную категорию.</p>
          <button type="button" onClick={resetDiscovery}>Показать все места</button>
        </section>
      )}

      <div className="result-count" role="status" aria-live="polite">
        {loadingPlaces ? "Обновляем места" : hasFilters ? `Найдено: ${visible.length}` : `${visible.length} мест на карте`}
      </div>

      <div className={`toast${notice ? " is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true">
        <span>{notice}</span>
        {notice && (
          <button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice("")}>
            <Icon name="close" />
          </button>
        )}
      </div>

      {selected && activeCategory && (
        <aside className="place-card" aria-label={`Информация о ${selected.name}`} style={{ "--category": activeCategory.color } as React.CSSProperties}>
          <div className="sheet-handle" aria-hidden="true" />
          <button className="close" type="button" aria-label="Закрыть карточку" onClick={() => setSelected(null)}>
            <Icon name="close" />
          </button>
          <header className="place-heading">
            <div className="category-icon" aria-hidden="true"><Icon name={activeCategory.icon} /></div>
            <div>
              <span className="category-label">{activeCategory.label}</span>
              <h2>{selected.name}</h2>
            </div>
          </header>
          <div className="place-body">
            <p className="verified"><Icon name="check" /> Проверено сообществом · {selected.verified}</p>
            <p className="address"><Icon name="location" /> {selected.address}</p>
            <p className="description">{selected.description}</p>
            <p className="byline">Добавил: {selected.addedBy}</p>

            <div className="card-actions">
              <a className="primary-route" href={`https://www.openstreetmap.org/directions?to=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer">
                <Icon name="route" /> Построить маршрут
              </a>
              <button type="button" onClick={verify} disabled={verifying || verifiedIds.has(selected.id)}>
                <Icon name="check" />
                {verifiedIds.has(selected.id) ? "Актуальность подтверждена" : verifying ? "Подтверждаем…" : "Подтвердить актуальность"}
              </button>
            </div>

            <section className="comments">
              <div className="comments-heading">
                <div><p className="eyebrow">Опыт сообщества</p><h3>Комментарии</h3></div>
                <span>{selected.comments.length}</span>
              </div>
              {selected.comments.map((comment) => (
                <article key={comment.id}>
                  <header><strong>{comment.author}</strong><time>{comment.date}</time></header>
                  <p>{comment.text}</p>
                </article>
              ))}
              {!selected.comments.length && (
                <div className="comments-empty">
                  <Icon name="message" aria-hidden="true" />
                  <p>Пока нет комментариев. Расскажите, что важно знать об этом месте.</p>
                </div>
              )}
              <form onSubmit={addComment}>
                <label htmlFor="comment">Ваш комментарий</label>
                <textarea id="comment" name="comment" maxLength={1000} required placeholder="Например: когда лучше приехать и что взять с собой" />
                <button className="primary" type="submit" disabled={savingComment}>
                  {savingComment ? "Публикуем…" : "Опубликовать комментарий"}
                </button>
              </form>
            </section>
          </div>
        </aside>
      )}

      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} labelledBy="add-title" returnFocus={addButtonRef}>
        {draft && (
          <section className="modal">
            <button className="close" type="button" aria-label="Закрыть окно" onClick={() => setDraft(null)}>
              <Icon name="close" />
            </button>
            <div className="modal-icon" aria-hidden="true"><Icon name="location" /></div>
            <p className="eyebrow">Новая точка</p>
            <h2 id="add-title">Добавить место</h2>
            <p className="modal-description">Расскажите, чем оно полезно. После публикации место увидят другие участники Atlas.</p>
            <p className="coordinates"><Icon name="location" /> {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}</p>
            <form onSubmit={addPlace}>
              <label htmlFor="place-name">Название</label>
              <input id="place-name" name="name" maxLength={120} required autoFocus data-initial-focus placeholder="Например: Phuket Immigration Office" />
              <label htmlFor="place-category">Категория</label>
              <select id="place-category" name="category">
                {(Object.keys(categories) as Category[]).map((key) => <option key={key} value={key}>{categories[key].label}</option>)}
              </select>
              <label htmlFor="place-address">Адрес</label>
              <input id="place-address" name="address" maxLength={200} required placeholder="Улица, район или ориентир" />
              <label htmlFor="place-description">Чем полезно это место</label>
              <textarea id="place-description" name="description" maxLength={1000} required placeholder="Что здесь можно сделать и что стоит знать заранее" />
              <div className="modal-actions">
                <button type="button" onClick={() => setDraft(null)}>Отменить</button>
                <button className="primary" type="submit" disabled={savingPlace}>{savingPlace ? "Добавляем…" : "Добавить на карту"}</button>
              </div>
            </form>
          </section>
        )}
      </Modal>
    </div>
  );
}
