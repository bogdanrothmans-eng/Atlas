import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { toast } from "sonner";
import {
  Camera,
  ChevronRight,
  Flag,
  MapPin,
  MessageSquare,
  Plus,
  Route,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";

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
} from "@/lib/atlasRepository";
import { useAuth, userDisplayName } from "@/components/AuthProvider";
import { BrandMark } from "@/components/Brand";
import { CitySwitcher } from "@/components/CitySwitcher";
import { FiltersSheet } from "@/components/FiltersSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categories } from "@/lib/categories";
import {
  cities,
  cityById,
  defaultCity,
  isInCity,
  type City,
} from "@/lib/cities";
import { cn } from "@/lib/utils";

type MarkerEntry = { marker: Marker; element: HTMLButtonElement; place: Place };

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
const CITY_STORAGE_KEY = "atlas-city-v1";
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

/*
 * Cross-fades a pair of icons that occupy the same slot. No motion library is
 * installed, so both icons stay in the DOM and animate with CSS transitions.
 */
const iconSwap = (visible: boolean) =>
  cn(
    "transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
    visible ? "scale-100 opacity-100 blur-0" : "scale-25 opacity-0 blur-[4px]",
  );

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
  const [city, setCity] = useState<City>(defaultCity);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ lng: number; lat: number } | null>(null);
  const [draftCategory, setDraftCategory] = useState<Category>("documents");
  const [reportReason, setReportReason] = useState<ReportReason>("inaccurate");
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
        .catch(() => toast.error("Не удалось обновить данные. Показали сохранённую подборку."))
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
    const stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored) setCity(cityById(stored));
  }, []);

  useEffect(() => {
    setReplyTo(null);
  }, [selected?.id]);

  // The draft opens from a map click handler that cannot read the latest
  // filter, so the suggested category is applied once the draft appears.
  useEffect(() => {
    if (draft) setDraftCategory(filter === "all" ? "documents" : filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    if (!adding) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdding(false);
        toast("Добавление отменено");
        addButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [adding]);

  const cityPlaces = useMemo(
    () => places.filter((place) => isInCity(place, city)),
    [places, city],
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cityPlaces.filter((place) => {
      const matchesCategory = filter === "all" || place.category === filter;
      const matchesQuery = `${place.name} ${place.address} ${place.description}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [cityPlaces, filter, query]);

  const categoryCounts = useMemo(() => {
    return cityPlaces.reduce<Record<Category, number>>((counts, place) => {
      counts[place.category] += 1;
      return counts;
    }, { documents: 0, health: 0, food: 0, work: 0, family: 0, leisure: 0 });
  }, [cityPlaces]);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of cities) {
      counts[item.id] = places.filter((place) => isInCity(place, item)).length;
    }
    return counts;
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
        ? { top: 200, right: 24, bottom: 40, left: 24 }
        : { top: 140, right: 40, bottom: 40, left: 380 },
      maxZoom: 12.5,
      duration: animated ? 420 : 0,
      essential: false,
    });
  };

  useEffect(() => {
    if (loadingPlaces || hasFitInitialPlacesRef.current || !cityPlaces.length) return;
    hasFitInitialPlacesRef.current = true;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.resize();
      fitPlacesInView(cityPlaces);
    });
    return () => cancelAnimationFrame(frame);
  }, [loadingPlaces, cityPlaces]);

  const beginAdding = () => {
    if (!requireMember("add-place")) return;
    setAdding(true);
    setSelected(null);
  };

  const cancelAdding = () => {
    setAdding(false);
    toast("Добавление отменено");
    addButtonRef.current?.focus();
  };

  const useMapCenter = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    setDraft({ lng: center.lng, lat: center.lat });
    setAdding(false);
  };

  const changeCity = (next: City) => {
    setCity(next);
    localStorage.setItem(CITY_STORAGE_KEY, next.id);
    setSelected(null);
    setQuery("");
    setFilter("all");
    setAdding(false);
    const targets = places.filter((place) => isInCity(place, next));
    if (targets.length) {
      fitPlacesInView(targets, true);
    } else {
      mapRef.current?.flyTo({
        center: [next.lng, next.lat],
        zoom: next.zoom,
        duration: 600,
        essential: false,
      });
    }
  };

  const resetDiscovery = () => {
    setQuery("");
    setFilter("all");
    setSelected(null);
    fitPlacesInView(cityPlaces, true);
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
      toast(`Новое место можно отправить через ${Math.ceil(placeWait / 60000)} мин.`);
      return;
    }
    const place: Place = {
      id: crypto.randomUUID(),
      name: String(data.get("name")).trim(),
      address: String(data.get("address")).trim(),
      description: String(data.get("description")).trim(),
      category: draftCategory,
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
      toast.success(isSupabaseConfigured ? "Место отправлено на модерацию" : "Место сохранено в этом браузере");
    } catch {
      toast.error("Не удалось добавить место. Проверьте соединение и повторите попытку.");
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
    const form = event.currentTarget;
    const data = new FormData(form);
    if (String(data.get("website") || "").trim()) return;
    const commentWait = getActionWait("comment", COMMENT_SUBMISSION_INTERVAL, user.id);
    if (isSupabaseConfigured && commentWait > 0) {
      toast(`Следующий комментарий можно отправить через ${Math.ceil(commentWait / 1000)} сек.`);
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
      form.reset();
      toast.success(replyTo ? "Ответ опубликован" : "Комментарий опубликован");
    } catch {
      toast.error("Не удалось опубликовать комментарий. Повторите попытку.");
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
      toast.error(cause instanceof Error ? cause.message : "Не удалось сохранить реакцию");
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
      toast.error("Подойдут JPG, PNG или WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Фото должно быть меньше 5 МБ");
      return;
    }
    const photoWait = getActionWait("photo", PHOTO_SUBMISSION_INTERVAL, user.id);
    if (photoWait > 0) {
      toast(`Следующее фото можно отправить через ${Math.ceil(photoWait / 1000)} сек.`);
      return;
    }
    setSavingPhoto(true);
    try {
      await uploadPlacePhoto(selected.id, file, String(data.get("caption") || "").trim(), user.id, session.access_token);
      rememberAction("photo", user.id);
      form.reset();
      setPhotoOpen(false);
      toast.success("Фото отправлено на модерацию");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Не удалось загрузить фото");
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
      await reportPlace(selected.id, reportReason, String(data.get("details") || "").trim(), user.id, session.access_token);
      setReportOpen(false);
      toast.success("Жалоба отправлена. Спасибо, что помогаете Atlas.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Не удалось отправить жалобу");
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
      toast("Вы вошли. Теперь выберите место на карте.");
    } else if (target && intent === "photo") {
      setPhotoOpen(true);
    } else if (target && intent === "report") {
      setReportReason("inaccurate");
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
        .catch((cause) => toast.error(cause instanceof Error ? cause.message : "Не удалось сохранить реакцию"))
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
  const ActiveCategoryIcon = activeCategory?.icon;
  const hasFilters = Boolean(query.trim()) || filter !== "all";

  const renderComment = (comment: Comment, isReply = false) => (
    <article className="flex items-start gap-3" key={comment.id}>
      <Avatar className={cn("size-8", isReply && "size-7")}>
        <AvatarFallback className={cn(isReply && "text-xs")}>
          {comment.author.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <header className="flex items-baseline gap-2">
          <strong className="truncate text-sm font-medium">{comment.author}</strong>
          <time className="text-muted-foreground text-xs" dateTime={comment.createdAt}>
            {comment.date}
          </time>
        </header>
        <p className="text-sm text-pretty">{comment.text}</p>
        <Button
          variant="link"
          size="sm"
          // min-h-6 keeps the target at the 24px WCAG 2.2 AA minimum.
          className="h-auto min-h-6 p-0 text-xs"
          onClick={() => startReply(comment)}
        >
          Ответить
        </Button>
      </div>
    </article>
  );

  return (
    <div className="bg-muted relative h-svh w-full overflow-hidden">
      <a
        href="#map"
        className="bg-background focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:px-3 focus:py-2 focus:text-sm focus:ring-2"
      >
        Перейти к карте
      </a>
      <h1 className="sr-only">Atlas — полезные места на Пхукете</h1>

      <main
        id="map"
        ref={containerRef}
        className={cn("absolute inset-0", adding && "cursor-crosshair")}
        aria-label="Интерактивная карта Пхукета"
        aria-busy={loadingPlaces}
        tabIndex={-1}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
        <header className="bg-background pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 rounded-2xl border p-2 shadow-sm sm:flex-nowrap sm:gap-2">
          <button
            type="button"
            onClick={resetDiscovery}
            aria-label="Atlas — показать все места"
            className="focus-visible:ring-ring/50 flex shrink-0 items-center gap-2 rounded-md px-1 font-semibold tracking-tight outline-none focus-visible:ring-[3px]"
          >
            <BrandMark />
            <span className="hidden lg:inline">Atlas</span>
          </button>

          <Separator
            orientation="vertical"
            className="hidden data-[orientation=vertical]:h-8 sm:block"
          />

          <div className="flex-1 sm:flex-none">
            <CitySwitcher city={city} counts={cityCounts} onSelect={changeCity} />
          </div>

          <div className="relative order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Label className="sr-only" htmlFor="place-search">
              Поиск мест
            </Label>
            <Input
              id="place-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Поиск в городе ${city.name}`}
              autoComplete="off"
              aria-controls="map"
              className="px-9"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-0 size-9 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X />
              </Button>
            )}
          </div>

          <FiltersSheet
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            filter={filter}
            counts={categoryCounts}
            total={cityPlaces.length}
            visibleCount={visible.length}
            onChange={setFilter}
            onReset={() => setFilter("all")}
          />

          <Button
            ref={addButtonRef}
            type="button"
            size="icon"
            variant={adding ? "secondary" : "default"}
            className="sm:w-auto sm:px-4"
            aria-label={adding ? "Отменить добавление места" : "Добавить место"}
            aria-pressed={adding}
            onClick={adding ? cancelAdding : beginAdding}
          >
            <span className="relative grid size-4 shrink-0 place-items-center">
              <Plus className={cn("absolute", iconSwap(!adding))} />
              <X className={cn("absolute", iconSwap(adding))} />
            </span>
            <span className="hidden sm:inline">
              {adding ? "Отменить" : "Добавить"}
            </span>
          </Button>

          <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full">
            <Link
              href={user ? "/profile" : `/auth?next=${encodeURIComponent("/profile")}`}
              aria-label={user ? `Открыть профиль: ${userDisplayName(user)}` : "Войти в Atlas"}
            >
              {user ? (
                <span aria-hidden="true" className="text-sm font-medium">
                  {userDisplayName(user).slice(0, 1).toUpperCase()}
                </span>
              ) : (
                <User />
              )}
            </Link>
          </Button>
        </header>
      </div>

      {!selected && !adding && visible.length > 0 && (
        <Card
          className="absolute top-24 left-3 z-10 hidden w-72 gap-0 py-4 shadow-lg md:block"
          aria-labelledby="map-intro-title"
        >
          <CardContent className="space-y-2 px-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Карта сообщества
            </p>
            <h2 id="map-intro-title" className="text-lg font-semibold tracking-tight text-balance">
              Найдите полезное место рядом
            </h2>
            <p className="text-muted-foreground text-sm text-pretty">
              Выберите метку, чтобы увидеть детали, отзывы и маршрут.
            </p>
            <div className="flex gap-2 pt-1">
              <Badge variant="secondary">
                {loadingPlaces ? "Обновляем…" : `${visible.length} мест`}
              </Badge>
              <Badge variant="secondary">{city.name}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {adding && (
        <Card
          className="absolute top-24 left-1/2 z-10 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 gap-0 py-4 shadow-lg"
          aria-labelledby="add-instruction-title"
        >
          <CardContent className="flex flex-wrap items-center gap-3 px-4">
            <MapPin className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-40 flex-1">
              <h2 id="add-instruction-title" className="font-semibold tracking-tight">
                Где находится место?
              </h2>
              <p className="text-muted-foreground text-sm">
                Выберите точку на карте или используйте её центр.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={useMapCenter}>
                Центр карты
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelAdding}>
                Отменить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loadingPlaces && visible.length === 0 && (
        <Card
          className="absolute top-24 left-1/2 z-10 w-[min(24rem,calc(100%-1.5rem))] -translate-x-1/2 gap-0 py-6 text-center shadow-lg"
          aria-labelledby="map-empty-title"
        >
          <CardContent className="space-y-2 px-6">
            {cityPlaces.length ? (
              <>
                <Search className="text-muted-foreground mx-auto size-5" aria-hidden="true" />
                <h2 id="map-empty-title" className="text-lg font-semibold tracking-tight">
                  Места не найдены
                </h2>
                <p className="text-muted-foreground text-sm text-pretty">
                  Попробуйте другой запрос или сбросьте выбранную категорию.
                </p>
                <Button variant="secondary" size="sm" onClick={resetDiscovery}>
                  Показать все места
                </Button>
              </>
            ) : (
              <>
                <MapPin className="text-muted-foreground mx-auto size-5" aria-hidden="true" />
                <h2 id="map-empty-title" className="text-lg font-semibold tracking-tight">
                  {`В городе ${city.name} пока нет мест`}
                </h2>
                <p className="text-muted-foreground text-sm text-pretty">
                  Карту наполняет сообщество. Добавьте первое место — оно появится
                  здесь после проверки.
                </p>
                <Button variant="secondary" size="sm" onClick={beginAdding}>
                  <Plus /> Добавить первое место
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {loadingPlaces
          ? "Обновляем места"
          : hasFilters
            ? `Найдено: ${visible.length}`
            : `${visible.length} мест на карте`}
      </div>

      {selected && activeCategory && ActiveCategoryIcon && (
        <Card
          className="absolute inset-x-0 bottom-0 z-30 max-h-[75svh] gap-0 rounded-b-none py-0 shadow-xl md:inset-x-auto md:top-24 md:bottom-3 md:left-3 md:max-h-none md:w-96 md:rounded-xl"
          aria-label={`Информация о ${selected.name}`}
        >
          <div className="relative flex items-start gap-3 border-b p-4 pr-12">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white"
              style={{ backgroundColor: activeCategory.color }}
            >
              <ActiveCategoryIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {activeCategory.label}
              </span>
              <h2 className="text-lg leading-tight font-semibold tracking-tight text-balance">
                {selected.name}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Закрыть карточку"
              className="absolute top-3 right-3"
              onClick={() => setSelected(null)}
            >
              <X />
            </Button>
          </div>

          <ScrollArea className="max-h-[calc(75svh-5rem)] md:max-h-none md:flex-1">
            <div className="space-y-4 p-4">
              {selected.photos.length > 0 && (
                <div
                  className="flex gap-2 overflow-x-auto"
                  aria-label={`Фотографии ${selected.name}`}
                >
                  {selected.photos.map((photo) => (
                    <figure
                      key={photo.id}
                      className="bg-muted image-outline relative aspect-video w-60 shrink-0 overflow-hidden rounded-lg"
                    >
                      <Image
                        src={photo.url}
                        alt={photo.alt}
                        fill
                        sizes="(max-width: 48rem) 100vw, 25rem"
                        className="object-cover"
                      />
                      {photo.caption && (
                        <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                          {photo.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}

              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {selected.address}
              </p>
              <p className="text-sm text-pretty">{selected.description}</p>
              <p className="text-muted-foreground text-xs">
                Добавил: {selected.addedBy}
              </p>

              <Button asChild className="w-full">
                <a
                  href={`https://www.openstreetmap.org/directions?to=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Route /> Построить маршрут
                </a>
              </Button>

              <div className="grid grid-cols-4 gap-2" aria-label="Действия с местом">
                <Button
                  type="button"
                  variant={selected.myReaction === 1 ? "default" : "outline"}
                  onClick={() => react(1)}
                  disabled={reacting}
                  aria-pressed={selected.myReaction === 1}
                  aria-label={`Нравится, ${selected.likes}`}
                >
                  <ThumbsUp />
                  <span className="tabular-nums">{selected.likes}</span>
                </Button>
                <Button
                  type="button"
                  variant={selected.myReaction === -1 ? "destructive" : "outline"}
                  onClick={() => react(-1)}
                  disabled={reacting}
                  aria-pressed={selected.myReaction === -1}
                  aria-label={`Не нравится, ${selected.dislikes}`}
                >
                  <ThumbsDown />
                  <span className="tabular-nums">{selected.dislikes}</span>
                </Button>
                <Button asChild variant="outline">
                  <a
                    href="#place-comments"
                    aria-label={`Комментарии, ${selected.comments.length}`}
                  >
                    <MessageSquare />
                    <span className="tabular-nums">{selected.comments.length}</span>
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Добавить фото"
                  onClick={() => requireMember("photo", selected.id) && setPhotoOpen(true)}
                >
                  <Camera />
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground w-full"
                onClick={() => {
                  if (!requireMember("report", selected.id)) return;
                  setReportReason("inaccurate");
                  setReportOpen(true);
                }}
              >
                <Flag /> Пожаловаться на место
              </Button>

              <Separator />

              <section className="space-y-4" id="place-comments">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Обсуждение
                  </p>
                  <h3 className="font-semibold tracking-tight">
                    Комментарии{" "}
                    <span className="text-muted-foreground tabular-nums">
                      {selected.comments.length}
                    </span>
                  </h3>
                </div>

                {commentThreads.map(({ root, replies }) => (
                  <div className="space-y-3" key={root.id}>
                    {renderComment(root)}
                    {replies.length > 0 && (
                      <div className="space-y-3 border-l pl-4 md:ml-4">
                        {replies.map((reply) => renderComment(reply, true))}
                      </div>
                    )}
                  </div>
                ))}

                {!selected.comments.length && (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
                    <MessageSquare className="size-5" aria-hidden="true" />
                    <p className="text-sm text-pretty">
                      Пока нет комментариев. Расскажите, что важно знать об этом
                      месте.
                    </p>
                  </div>
                )}

                {user && session ? (
                  <form className="space-y-2" onSubmit={addComment}>
                    <input
                      className="hidden"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                    />
                    {replyTo && (
                      <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm">
                        <span className="truncate">
                          Ответ для <strong>{replyTo.author}</strong>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Отменить ответ"
                          onClick={() => setReplyTo(null)}
                        >
                          <X />
                        </Button>
                      </div>
                    )}
                    <Label className="sr-only" htmlFor="comment">
                      Ваш комментарий
                    </Label>
                    <div className="flex items-end gap-2">
                      <Textarea
                        id="comment"
                        name="comment"
                        maxLength={1000}
                        required
                        rows={2}
                        placeholder={
                          replyTo ? `Ответить ${replyTo.author}…` : "Добавить комментарий…"
                        }
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={savingComment}
                        aria-label={
                          savingComment
                            ? "Публикуем комментарий"
                            : "Опубликовать комментарий"
                        }
                      >
                        <Send />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-between py-3 text-left"
                    onClick={() => sendGuestToAuth("comment", selected.id)}
                  >
                    <span className="flex items-center gap-3">
                      <User className="shrink-0" aria-hidden="true" />
                      <span className="flex flex-col">
                        <strong className="text-sm font-medium">
                          Войдите, чтобы комментировать
                        </strong>
                        <small className="text-muted-foreground text-xs">
                          Ответы и обсуждения доступны участникам Atlas
                        </small>
                      </span>
                    </span>
                    <ChevronRight className="shrink-0" aria-hidden="true" />
                  </Button>
                )}
              </section>
            </div>
          </ScrollArea>
        </Card>
      )}

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Фото сообщества
                </p>
                <DialogTitle>Добавить фото</DialogTitle>
                <DialogDescription>
                  Покажите, как выглядит «{selected.name}». Фото появится после
                  проверки модератором.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={addPhoto}>
                <div className="space-y-2">
                  <Label htmlFor="place-photo">
                    Фото{" "}
                    <span className="text-muted-foreground font-normal">
                      JPG, PNG или WebP до 5 МБ
                    </span>
                  </Label>
                  <Input
                    id="place-photo"
                    name="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    className="h-auto py-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo-caption">
                    Подпись{" "}
                    <span className="text-muted-foreground font-normal">
                      необязательно
                    </span>
                  </Label>
                  <Input
                    id="photo-caption"
                    name="caption"
                    maxLength={240}
                    placeholder="Что изображено на фото"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPhotoOpen(false)}
                  >
                    Отменить
                  </Button>
                  <Button type="submit" disabled={savingPhoto}>
                    {savingPhoto ? "Загружаем…" : "Отправить на проверку"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Безопасность сообщества
                </p>
                <DialogTitle>Пожаловаться на место</DialogTitle>
                <DialogDescription>
                  Сообщите, что не так с «{selected.name}». Модератор проверит
                  жалобу.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submitReport}>
                <div className="space-y-2">
                  <Label htmlFor="report-reason">Причина</Label>
                  <Select
                    value={reportReason}
                    onValueChange={(value) => setReportReason(value as ReportReason)}
                  >
                    <SelectTrigger id="report-reason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(reportReasons) as [ReportReason, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-details">
                    Комментарий{" "}
                    <span className="text-muted-foreground font-normal">
                      необязательно
                    </span>
                  </Label>
                  <Textarea
                    id="report-details"
                    name="details"
                    maxLength={1000}
                    placeholder="Добавьте детали, которые помогут разобраться"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReportOpen(false)}
                  >
                    Отменить
                  </Button>
                  <Button type="submit" disabled={savingReport}>
                    {savingReport ? "Отправляем…" : "Отправить жалобу"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
            addButtonRef.current?.focus();
          }
        }}
      >
        <DialogContent>
          {draft && (
            <>
              <DialogHeader>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Новая точка
                </p>
                <DialogTitle>Добавить место</DialogTitle>
                <DialogDescription>
                  Расскажите, чем оно полезно. После проверки место появится на
                  общей карте.
                </DialogDescription>
              </DialogHeader>
              <Badge variant="secondary" className="w-fit tabular-nums">
                <MapPin /> {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
              </Badge>
              <form className="space-y-4" onSubmit={addPlace}>
                <input
                  className="hidden"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
                <div className="space-y-2">
                  <Label htmlFor="place-name">Название</Label>
                  <Input
                    id="place-name"
                    name="name"
                    maxLength={120}
                    required
                    autoFocus
                    placeholder="Например: Phuket Immigration Office"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place-category">Категория</Label>
                  <Select
                    value={draftCategory}
                    onValueChange={(value) => setDraftCategory(value as Category)}
                  >
                    <SelectTrigger id="place-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(categories) as Category[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {categories[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place-address">Адрес</Label>
                  <Input
                    id="place-address"
                    name="address"
                    maxLength={200}
                    required
                    placeholder="Улица, район или ориентир"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place-description">Чем полезно это место</Label>
                  <Textarea
                    id="place-description"
                    name="description"
                    maxLength={1000}
                    required
                    placeholder="Что здесь можно сделать и что стоит знать заранее"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDraft(null)}
                  >
                    Отменить
                  </Button>
                  <Button type="submit" disabled={savingPlace}>
                    {savingPlace ? "Добавляем…" : "Добавить на карту"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
