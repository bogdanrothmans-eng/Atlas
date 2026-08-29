import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import {
  createComment,
  createPlace,
  isSupabaseConfigured,
  loadPlaces,
  reactToPlace,
  reportPlace,
  uploadPlacePhoto,
  type Category,
  type Comment,
  type Place,
  type ReportReason,
} from "../lib/atlasRepository";
import { Icon, type IconName } from "./Icons";
import { Modal } from "./Modal";
import { useAuth, userDisplayName } from "./AuthProvider";

type MarkerEntry = { marker: Marker; element: HTMLButtonElement; place: Place };

const categories: Record<Category, { label: string; icon: IconName; color: string }> = {
  documents: { label: "Документы", icon: "documents", color: "#6f4bd8" },
  health: { label: "Медицина", icon: "health", color: "#c83f52" },
  food: { label: "Еда", icon: "food", color: "#a94f18" },
  work: { label: "Работа", icon: "work", color: "#24739e" },
  family: { label: "Для семьи", icon: "family", color: "#bd3f7f" },
  leisure: { label: "Досуг", icon: "leisure", color: "#2f8258" },
};

const seedPlaces: Place[] = [
  { id: "1", name: "Phuket Immigration Office", category: "documents", address: "Phuket Road, Phuket Town", description: "Иммиграционный офис: визы, продления и регистрация иностранцев.", lng: 98.3913, lat: 7.8663, likes: 18, dislikes: 1, myReaction: null, addedBy: "Анна К.", photos: [], comments: [{ id: "c1", author: "Михаил", text: "Лучше приезжать утром и заранее подготовить копии документов.", date: "12 авг.", parentId: null, createdAt: new Date().toISOString() }] },
  { id: "2", name: "HOMA Coworking", category: "work", address: "Samkong, Phuket Town", description: "Коворкинг со стабильным Wi‑Fi, переговорными и зонами для звонков.", lng: 98.3837, lat: 7.9061, likes: 31, dislikes: 2, myReaction: null, addedBy: "Илья", photos: [], comments: [] },
  { id: "3", name: "Bangkok Hospital Phuket", category: "health", address: "Hongyok Utis Road", description: "Международная частная клиника. Персонал говорит по-английски.", lng: 98.3827, lat: 7.9041, likes: 12, dislikes: 1, myReaction: null, addedBy: "София", photos: [], comments: [] },
  { id: "4", name: "Naka Weekend Market", category: "food", address: "Wirat Hong Yok Road", description: "Большой вечерний рынок с тайской едой, фруктами и локальными продуктами.", lng: 98.3729, lat: 7.8807, likes: 46, dislikes: 3, myReaction: null, addedBy: "Команда Atlas", photos: [], comments: [] },
  { id: "5", name: "Karon Viewpoint", category: "leisure", address: "Karon, Mueang Phuket", description: "Смотровая площадка с видом на пляжи Ката Ной, Ката и Карон.", lng: 98.3026, lat: 7.7973, likes: 73, dislikes: 2, myReaction: null, addedBy: "Команда Atlas", photos: [], comments: [] },
  { id: "6", name: "Rawai Park", category: "family", address: "Rawai, Mueang Phuket", description: "Семейный парк с игровыми зонами и бассейном для детей.", lng: 98.3278, lat: 7.7799, likes: 9, dislikes: 0, myReaction: null, addedBy: "Мария", photos: [], comments: [] },
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
const CLIENT_ID_KEY = "atlas-client-id-v1";
const ACTION_TIMES_STORAGE_KEY = "atlas-action-times-v1";
const MIN_MARKER_DISTANCE = 58;
const PLACE_SUBMISSION_INTERVAL = 10 * 60 * 1000;
const COMMENT_SUBMISSION_INTERVAL = 30 * 1000;
const PHOTO_SUBMISSION_INTERVAL = 60 * 1000;

const reportReasons: Record<ReportReason, string> = {
  inaccurate: "Неверная информация",
  closed: "Место закрыто",
  spam: "Спам или реклама",
  harmful: "Опасный или недопустимый контент",
  duplicate: "Дубликат места",
  other: "Другая причина",
};

const markerSymbols: Record<Category, string> = {
  documents: "▤",
  health: "+",
  food: "⌁",
  work: "◇",
  family: "♥",
  leisure: "✦",
};

const getClientId = () => {
  const stored = localStorage.getItem(CLIENT_ID_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
};

const getActionWait = (action: "place" | "comment" | "photo", interval: number, actorId: string) => {
  try {
    const stored = JSON.parse(localStorage.getItem(ACTION_TIMES_STORAGE_KEY) || "{}") as Record<string, number>;
    return Math.max(0, interval - (Date.now() - (stored[`${actorId}:${action}`] || 0)));
  } catch {
    return 0;
  }
};

const rememberAction = (action: "place" | "comment" | "photo", actorId: string) => {
  let stored: Record<string, number> = {};
  try { stored = JSON.parse(localStorage.getItem(ACTION_TIMES_STORAGE_KEY) || "{}"); } catch { /* Replace invalid state. */ }
  localStorage.setItem(ACTION_TIMES_STORAGE_KEY, JSON.stringify({ ...stored, [`${actorId}:${action}`]: Date.now() }));
};

const spreadOverlappingMarkers = (map: MapLibreMap, entries: MarkerEntry[]) => {
  const points = entries.map(({ place }) => map.project([place.lng, place.lat]));
  const offsets = entries.map(() => ({ x: 0, y: 0 }));

  for (let iteration = 0; iteration < 6; iteration += 1) {
    for (let first = 0; first < entries.length; first += 1) {
      for (let second = first + 1; second < entries.length; second += 1) {
        let dx = points[second].x + offsets[second].x - points[first].x - offsets[first].x;
        let dy = points[second].y + offsets[second].y - points[first].y - offsets[first].y;
        let distance = Math.hypot(dx, dy);

        if (distance >= MIN_MARKER_DISTANCE) continue;
        if (distance < 0.01) {
          const seed = `${entries[first].place.id}:${entries[second].place.id}`
            .split("")
            .reduce((total, character) => total + character.charCodeAt(0), 0);
          const angle = (seed % 360) * Math.PI / 180;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const push = (MIN_MARKER_DISTANCE - distance) / 2;
        const unitX = dx / distance;
        const unitY = dy / distance;
        offsets[first].x -= unitX * push;
        offsets[first].y -= unitY * push;
        offsets[second].x += unitX * push;
        offsets[second].y += unitY * push;
      }
    }
  }

  entries.forEach((entry, index) => {
    const offset = offsets[index];
    entry.marker.setOffset([Math.round(offset.x), Math.round(offset.y)]);
    entry.element.classList.toggle("is-displaced", Math.hypot(offset.x, offset.y) > 2);
  });
};

export default function AtlasMap() {
  const router = useRouter();
  const { session, user, loading: sessionLoading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const addingRef = useRef(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const hasFitInitialPlacesRef = useRef(false);
  const handledIntentRef = useRef("");

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
  const [reacting, setReacting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingReport, setSavingReport] = useState(false);

  addingRef.current = adding;

  const sendGuestToAuth = (intent: "add-place" | "comment" | "like" | "dislike" | "photo" | "report", placeId?: string) => {
    const params = new URLSearchParams({ intent });
    if (placeId) params.set("place", placeId);
    void router.push(`/auth?next=${encodeURIComponent(`/?${params.toString()}`)}`);
  };

  const requireMember = (intent: "add-place" | "comment" | "like" | "dislike" | "photo" | "report", placeId?: string) => {
    if (user && session) return true;
    sendGuestToAuth(intent, placeId);
    return false;
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (isSupabaseConfigured) {
      loadPlaces(user?.id || getClientId(), session?.access_token)
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
  }, [session?.access_token, sessionLoading, user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);

  useEffect(() => {
    setReplyTo(null);
  }, [selected?.id]);

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

    markersRef.current.forEach(({ marker }) => marker.remove());
    const entries = new Map<string, MarkerEntry>();

    visible.forEach((place) => {
      const category = categories[place.category];
      const anchor = document.createElement("div");
      anchor.className = "place-marker-anchor";
      const element = document.createElement("button");
      element.className = "place-marker";
      element.type = "button";
      element.title = place.name;
      element.setAttribute("aria-label", `${category.label}: ${place.name}`);
      element.setAttribute("aria-pressed", "false");
      element.style.setProperty("--marker", category.color);
      const symbol = document.createElement("span");
      symbol.className = "place-marker-symbol";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = markerSymbols[place.category];
      element.appendChild(symbol);
      anchor.appendChild(element);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelected(place);
      });
      const marker = new maplibregl.Marker({ element: anchor, anchor: "bottom" })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
      entries.set(place.id, { marker, element, place });
    });

    markersRef.current = entries;
    const updateLayout = () => spreadOverlappingMarkers(map, Array.from(entries.values()));
    updateLayout();
    map.on("zoom", updateLayout);
    map.on("resize", updateLayout);

    return () => {
      map.off("zoom", updateLayout);
      map.off("resize", updateLayout);
      entries.forEach(({ marker }) => marker.remove());
      if (markersRef.current === entries) markersRef.current = new Map();
    };
  }, [visible]);

  useEffect(() => {
    markersRef.current.forEach(({ element, place }) => {
      const isSelected = selected?.id === place.id;
      element.classList.toggle("is-selected", isSelected);
      element.setAttribute("aria-pressed", String(isSelected));
    });
  }, [selected?.id]);

  const fitPlacesInView = (targets: Place[], animated = false) => {
    const map = mapRef.current;
    if (!map || !targets.length) return;
    const bounds = new maplibregl.LngLatBounds();
    targets.forEach((place) => bounds.extend([place.lng, place.lat]));
    const compact = window.innerWidth <= 700;
    map.fitBounds(bounds, {
      padding: compact
        ? { top: 312, right: 24, bottom: 40, left: 24 }
        : { top: 230, right: 40, bottom: 40, left: 380 },
      maxZoom: 12.5,
      duration: animated ? 420 : 0,
      essential: false,
    });
  };

  useEffect(() => {
    if (loadingPlaces || hasFitInitialPlacesRef.current || !places.length) return;
    hasFitInitialPlacesRef.current = true;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.resize();
      fitPlacesInView(places);
    });
    return () => cancelAnimationFrame(frame);
  }, [loadingPlaces, places]);

  const beginAdding = () => {
    if (!requireMember("add-place")) return;
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
    fitPlacesInView(places, true);
  };

  const addPlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !session) {
      sendGuestToAuth("add-place");
      return;
    }
    if (!draft || savingPlace) return;
    const data = new FormData(event.currentTarget);
    if (String(data.get("website") || "").trim()) return;
    const placeWait = getActionWait("place", PLACE_SUBMISSION_INTERVAL, user.id);
    if (isSupabaseConfigured && placeWait > 0) {
      setNotice(`Новое место можно отправить через ${Math.ceil(placeWait / 60000)} мин.`);
      return;
    }
    let place: Place = {
      id: crypto.randomUUID(),
      name: String(data.get("name")).trim(),
      address: String(data.get("address")).trim(),
      description: String(data.get("description")).trim(),
      category: data.get("category") as Category,
      ...draft,
      likes: 0,
      dislikes: 0,
      myReaction: null,
      addedBy: userDisplayName(user),
      comments: [],
      photos: [],
    };
    setSavingPlace(true);
    try {
      if (isSupabaseConfigured) {
        await createPlace(place, user.id, session.access_token);
        rememberAction("place", user.id);
      } else {
        setPlaces((current) => [...current, place]);
        setSelected(place);
      }
      setDraft(null);
      setNotice(isSupabaseConfigured ? "Место отправлено на модерацию" : "Место сохранено в этом браузере");
    } catch {
      setNotice("Не удалось добавить место. Проверьте соединение и повторите попытку.");
    } finally {
      setSavingPlace(false);
    }
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !session) {
      sendGuestToAuth("comment", selected?.id);
      return;
    }
    if (!selected || savingComment) return;
    const data = new FormData(event.currentTarget);
    if (String(data.get("website") || "").trim()) return;
    const commentWait = getActionWait("comment", COMMENT_SUBMISSION_INTERVAL, user.id);
    if (isSupabaseConfigured && commentWait > 0) {
      setNotice(`Следующий комментарий можно отправить через ${Math.ceil(commentWait / 1000)} сек.`);
      return;
    }
    const text = String(data.get("comment")).trim();
    if (!text) return;
    let comment: Comment = { id: crypto.randomUUID(), author: userDisplayName(user), text, date: "сегодня", parentId: replyTo?.id ?? null, createdAt: new Date().toISOString() };
    setSavingComment(true);
    try {
      if (isSupabaseConfigured) {
        comment = await createComment(selected.id, comment, user.id, session.access_token);
        rememberAction("comment", user.id);
      }
      const updated = { ...selected, comments: [...selected.comments, comment] };
      setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place));
      setSelected(updated);
      setReplyTo(null);
      event.currentTarget.reset();
      setNotice(replyTo ? "Ответ опубликован" : "Комментарий опубликован");
    } catch {
      setNotice("Не удалось опубликовать комментарий. Повторите попытку.");
    } finally {
      setSavingComment(false);
    }
  };

  const react = async (reaction: -1 | 1) => {
    if (!selected || reacting) return;
    if (!user || !session) {
      sendGuestToAuth(reaction === 1 ? "like" : "dislike", selected.id);
      return;
    }
    setReacting(true);
    try {
      const result: { likes: number; dislikes: number; myReaction: -1 | 1 | null } = isSupabaseConfigured
        ? await reactToPlace(selected.id, reaction, user.id, session.access_token)
        : {
            likes: selected.likes + (selected.myReaction === 1 ? -1 : 0) + (reaction === 1 && selected.myReaction !== 1 ? 1 : 0),
            dislikes: selected.dislikes + (selected.myReaction === -1 ? -1 : 0) + (reaction === -1 && selected.myReaction !== -1 ? 1 : 0),
            myReaction: selected.myReaction === reaction ? null : reaction,
          };
      const updated = { ...selected, ...result };
      setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place));
      setSelected(updated);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Не удалось сохранить реакцию");
    } finally {
      setReacting(false);
    }
  };

  const addPhoto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !session) {
      sendGuestToAuth("photo", selected?.id);
      return;
    }
    if (!selected || savingPhoto) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("photo");
    if (!(file instanceof File) || !file.size) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Подойдут JPG, PNG или WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice("Фото должно быть меньше 5 МБ");
      return;
    }
    const photoWait = getActionWait("photo", PHOTO_SUBMISSION_INTERVAL, user.id);
    if (photoWait > 0) {
      setNotice(`Следующее фото можно отправить через ${Math.ceil(photoWait / 1000)} сек.`);
      return;
    }
    setSavingPhoto(true);
    try {
      await uploadPlacePhoto(selected.id, file, String(data.get("caption") || "").trim(), user.id, session.access_token);
      rememberAction("photo", user.id);
      form.reset();
      setPhotoOpen(false);
      setNotice("Фото отправлено на модерацию");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Не удалось загрузить фото");
    } finally {
      setSavingPhoto(false);
    }
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !session) {
      sendGuestToAuth("report", selected?.id);
      return;
    }
    if (!selected || savingReport) return;
    const data = new FormData(event.currentTarget);
    setSavingReport(true);
    try {
      await reportPlace(selected.id, data.get("reason") as ReportReason, String(data.get("details") || "").trim(), user.id, session.access_token);
      setReportOpen(false);
      setNotice("Жалоба отправлена. Спасибо, что помогаете Atlas.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Не удалось отправить жалобу");
    } finally {
      setSavingReport(false);
    }
  };

  const startReply = (comment: Comment) => {
    if (!requireMember("comment", selected?.id)) return;
    setReplyTo(comment);
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("#comment")?.focus());
  };

  useEffect(() => {
    if (!router.isReady || !places.length) return;
    const intent = typeof router.query.intent === "string" ? router.query.intent : "";
    const placeId = typeof router.query.place === "string" ? router.query.place : "";
    if (!intent) return;

    const target = placeId ? places.find((place) => place.id === placeId) : undefined;
    if (placeId && !target) return;
    if (target) setSelected(target);
    if (!user || !session) return;

    const intentKey = `${user.id}:${intent}:${placeId}`;
    if (handledIntentRef.current === intentKey) return;
    handledIntentRef.current = intentKey;

    if (intent === "add-place") {
      setSelected(null);
      setAdding(true);
      setNotice("Вы вошли. Теперь выберите место на карте.");
    } else if (target && intent === "photo") {
      setPhotoOpen(true);
    } else if (target && intent === "report") {
      setReportOpen(true);
    } else if (target && intent === "comment") {
      requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("#comment")?.focus());
    } else if (target && (intent === "like" || intent === "dislike")) {
      const reaction = intent === "like" ? 1 : -1;
      setReacting(true);
      reactToPlace(target.id, reaction, user.id, session.access_token)
        .then((result) => {
          const updated = { ...target, ...result };
          setPlaces((current) => current.map((place) => place.id === target.id ? updated : place));
          setSelected(updated);
        })
        .catch((cause) => setNotice(cause instanceof Error ? cause.message : "Не удалось сохранить реакцию"))
        .finally(() => setReacting(false));
    }

    void router.replace("/", undefined, { shallow: true });
  }, [places, router, router.isReady, router.query.intent, router.query.place, session, user]);

  const commentThreads = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(selected.comments.map((comment) => [comment.id, comment]));
    const rootId = (comment: Comment) => {
      let current = comment;
      const visited = new Set<string>();
      while (current.parentId && byId.has(current.parentId) && !visited.has(current.parentId)) {
        visited.add(current.id);
        current = byId.get(current.parentId)!;
      }
      return current.id;
    };
    const roots = selected.comments.filter((comment) => !comment.parentId || !byId.has(comment.parentId));
    return roots.map((root) => ({ root, replies: selected.comments.filter((comment) => comment.id !== root.id && rootId(comment) === root.id) }));
  }, [selected]);

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
        <Link className="profile-link" href={user ? "/profile" : `/auth?next=${encodeURIComponent("/profile")}`} aria-label={user ? `Открыть профиль: ${userDisplayName(user)}` : "Войти в Atlas"}>
          {user ? <span className="profile-initial" aria-hidden="true">{userDisplayName(user).slice(0, 1).toUpperCase()}</span> : <Icon name="user" />}
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

      <main id="map" ref={containerRef} className="map" aria-label="Интерактивная карта Пхукета" aria-busy={loadingPlaces} tabIndex={-1} />

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
            {selected.photos.length > 0 && (
              <div className="place-gallery" aria-label={`Фотографии ${selected.name}`}>
                {selected.photos.map((photo) => (
                  <figure key={photo.id}>
                    <Image src={photo.url} alt={photo.alt} fill sizes="(max-width: 48rem) 100vw, 25rem" />
                    {photo.caption && <figcaption>{photo.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            <p className="address"><Icon name="location" /> {selected.address}</p>
            <p className="description">{selected.description}</p>
            <p className="byline">Добавил: {selected.addedBy}</p>

            <a className="primary-route" href={`https://www.openstreetmap.org/directions?to=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer">
              <Icon name="route" /> Построить маршрут
            </a>

            <div className="social-actions" aria-label="Действия с местом">
              <button className={selected.myReaction === 1 ? "is-active" : ""} type="button" onClick={() => react(1)} disabled={reacting} aria-pressed={selected.myReaction === 1} aria-label={`Нравится, ${selected.likes}`}>
                <Icon name="thumb-up" /><span>{selected.likes}</span>
              </button>
              <button className={selected.myReaction === -1 ? "is-negative" : ""} type="button" onClick={() => react(-1)} disabled={reacting} aria-pressed={selected.myReaction === -1} aria-label={`Не нравится, ${selected.dislikes}`}>
                <Icon name="thumb-down" /><span>{selected.dislikes}</span>
              </button>
              <a href="#place-comments" aria-label={`Комментарии, ${selected.comments.length}`}>
                <Icon name="message" /><span>{selected.comments.length}</span>
              </a>
              <button type="button" onClick={() => requireMember("photo", selected.id) && setPhotoOpen(true)} aria-label="Добавить фото">
                <Icon name="camera" /><span className="action-label">Фото</span>
              </button>
            </div>
            <button className="report-action" type="button" onClick={() => requireMember("report", selected.id) && setReportOpen(true)}><Icon name="flag" /> Пожаловаться на место</button>

            <section className="comments" id="place-comments">
              <div className="comments-heading">
                <div><p className="eyebrow">Обсуждение</p><h3>Комментарии <span>{selected.comments.length}</span></h3></div>
              </div>
              {commentThreads.map(({ root, replies }) => (
                <div className="comment-thread" key={root.id}>
                  <article className="comment-item">
                    <div className="comment-avatar" aria-hidden="true">{root.author.slice(0, 1).toUpperCase()}</div>
                    <div className="comment-content">
                      <header><strong>{root.author}</strong><time dateTime={root.createdAt}>{root.date}</time></header>
                      <p>{root.text}</p>
                      <button type="button" onClick={() => startReply(root)}>Ответить</button>
                    </div>
                  </article>
                  {replies.length > 0 && (
                    <div className="comment-replies">
                      {replies.map((reply) => (
                        <article className="comment-item" key={reply.id}>
                          <div className="comment-avatar is-reply" aria-hidden="true">{reply.author.slice(0, 1).toUpperCase()}</div>
                          <div className="comment-content">
                            <header><strong>{reply.author}</strong><time dateTime={reply.createdAt}>{reply.date}</time></header>
                            <p>{reply.text}</p>
                            <button type="button" onClick={() => startReply(reply)}>Ответить</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!selected.comments.length && (
                <div className="comments-empty">
                  <Icon name="message" aria-hidden="true" />
                  <p>Пока нет комментариев. Расскажите, что важно знать об этом месте.</p>
                </div>
              )}
              {user && session ? (
                <form onSubmit={addComment}>
                  <input className="honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  {replyTo && <div className="replying-to"><span>Ответ для <strong>{replyTo.author}</strong></span><button type="button" aria-label="Отменить ответ" onClick={() => setReplyTo(null)}><Icon name="close" /></button></div>}
                  <label className="sr-only" htmlFor="comment">Ваш комментарий</label>
                  <div className="comment-composer">
                    <textarea id="comment" name="comment" maxLength={1000} required placeholder={replyTo ? `Ответить ${replyTo.author}…` : "Добавить комментарий…"} />
                    <button type="submit" disabled={savingComment} aria-label={savingComment ? "Публикуем комментарий" : "Опубликовать комментарий"}><Icon name="send" /></button>
                  </div>
                </form>
              ) : (
                <button className="guest-composer" type="button" onClick={() => sendGuestToAuth("comment", selected.id)}>
                  <span className="guest-composer-icon" aria-hidden="true"><Icon name="user" /></span>
                  <span><strong>Войдите, чтобы комментировать</strong><small>Ответы и обсуждения доступны участникам Atlas</small></span>
                  <Icon name="chevron-right" />
                </button>
              )}
            </section>
          </div>
        </aside>
      )}

      <Modal open={photoOpen} onClose={() => setPhotoOpen(false)} labelledBy="photo-title">
        {selected && (
          <section className="modal social-modal">
            <button className="close" type="button" aria-label="Закрыть окно" onClick={() => setPhotoOpen(false)}><Icon name="close" /></button>
            <div className="modal-icon" aria-hidden="true"><Icon name="camera" /></div>
            <p className="eyebrow">Фото сообщества</p>
            <h2 id="photo-title">Добавить фото</h2>
            <p className="modal-description">Покажите, как выглядит «{selected.name}». Фото появится после проверки модератором.</p>
            <form onSubmit={addPhoto}>
              <label className="file-drop" htmlFor="place-photo">
                <Icon name="camera" />
                <span><strong>Выберите фото</strong><small>JPG, PNG или WebP до 5 МБ</small></span>
              </label>
              <input className="file-input" id="place-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required data-initial-focus />
              <label htmlFor="photo-caption">Подпись <span className="optional">необязательно</span></label>
              <input id="photo-caption" name="caption" maxLength={240} placeholder="Что изображено на фото" />
              <div className="modal-actions"><button type="button" onClick={() => setPhotoOpen(false)}>Отменить</button><button className="primary" type="submit" disabled={savingPhoto}>{savingPhoto ? "Загружаем…" : "Отправить на проверку"}</button></div>
            </form>
          </section>
        )}
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} labelledBy="report-title">
        {selected && (
          <section className="modal social-modal">
            <button className="close" type="button" aria-label="Закрыть окно" onClick={() => setReportOpen(false)}><Icon name="close" /></button>
            <div className="modal-icon report-icon" aria-hidden="true"><Icon name="flag" /></div>
            <p className="eyebrow">Безопасность сообщества</p>
            <h2 id="report-title">Пожаловаться на место</h2>
            <p className="modal-description">Сообщите, что не так с «{selected.name}». Модератор проверит жалобу.</p>
            <form onSubmit={submitReport}>
              <label htmlFor="report-reason">Причина</label>
              <select id="report-reason" name="reason" defaultValue="inaccurate" data-initial-focus>
                {(Object.entries(reportReasons) as [ReportReason, string][]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <label htmlFor="report-details">Комментарий <span className="optional">необязательно</span></label>
              <textarea id="report-details" name="details" maxLength={1000} placeholder="Добавьте детали, которые помогут разобраться" />
              <div className="modal-actions"><button type="button" onClick={() => setReportOpen(false)}>Отменить</button><button className="primary" type="submit" disabled={savingReport}>{savingReport ? "Отправляем…" : "Отправить жалобу"}</button></div>
            </form>
          </section>
        )}
      </Modal>

      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} labelledBy="add-title" returnFocus={addButtonRef}>
        {draft && (
          <section className="modal">
            <button className="close" type="button" aria-label="Закрыть окно" onClick={() => setDraft(null)}>
              <Icon name="close" />
            </button>
            <div className="modal-icon" aria-hidden="true"><Icon name="location" /></div>
            <p className="eyebrow">Новая точка</p>
            <h2 id="add-title">Добавить место</h2>
            <p className="modal-description">Расскажите, чем оно полезно. После проверки место появится на общей карте.</p>
            <p className="coordinates"><Icon name="location" /> {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}</p>
            <form onSubmit={addPlace}>
              <input className="honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <label htmlFor="place-name">Название</label>
              <input id="place-name" name="name" maxLength={120} required autoFocus data-initial-focus placeholder="Например: Phuket Immigration Office" />
              <label htmlFor="place-category">Категория</label>
              <select id="place-category" name="category" defaultValue={filter === "all" ? "documents" : filter}>
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
