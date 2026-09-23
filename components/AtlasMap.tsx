import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  MoreHorizontal,
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
import { PhotoPicker, photoError } from "@/components/PhotoPicker";
import { PlacePin, type LabelSide } from "@/components/PlacePin";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// `element` hosts a React portal that renders the PlacePin.
type MarkerEntry = { marker: Marker; element: HTMLDivElement; place: Place };

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
// 32px pins plus a gap; pins closer than this are nudged apart.
const MIN_MARKER_DISTANCE = 40;
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
  });
  return points.map((point, index) => ({
    x: point.x + offsets[index].x,
    y: point.y + offsets[index].y,
  }));
};

/*
 * Pin layout, recomputed on zoom and resize:
 *
 * - Below SPREAD_ZOOM, pins that would overlap merge into a cluster shown on
 *   its most-liked member. Zooming in is what separates them, so clicking a
 *   cluster zooms to its members. The selected place never joins a cluster.
 * - From SPREAD_ZOOM up, zooming no longer separates places that share a
 *   building, so overlapping pins are nudged apart instead.
 * - Labels go to single pins greedily, selected first, then by likes. Each
 *   tries the right of its pin, then the left, and is dropped only if neither
 *   side clears every other label and pin. The selected label always shows,
 *   on the right.
 */
const CLUSTER_RADIUS = 40;
const SPREAD_ZOOM = 17;
const LABEL_HEIGHT = 20;
const LABEL_GAP = 18; // from the pin's centre to the label's left edge
const PIN_RADIUS = 18; // covers both a 32px pin and a 36px cluster
const LABEL_CLEARANCE = 4; // keeps labels from touching their neighbours

type PinLayout = {
  labels: Map<string, LabelSide>;
  hidden: Set<string>;
  clusters: Map<string, string[]>;
};

const byPriority = (selectedId: string | null) => (a: MarkerEntry, b: MarkerEntry) => {
  if (a.place.id === selectedId) return -1;
  if (b.place.id === selectedId) return 1;
  return b.place.likes - a.place.likes;
};

const layoutPins = (
  map: MapLibreMap,
  entries: MarkerEntry[],
  selectedId: string | null,
): PinLayout => {
  const hidden = new Set<string>();
  const clusters = new Map<string, string[]>();
  let points: { x: number; y: number }[];

  if (map.getZoom() >= SPREAD_ZOOM) {
    points = spreadOverlappingMarkers(map, entries);
  } else {
    entries.forEach(({ marker }) => marker.setOffset([0, 0]));
    points = entries.map(({ place }) => map.project([place.lng, place.lat]));
    const index = new Map(entries.map((entry, i) => [entry, i]));
    const order = [...entries].sort(byPriority(selectedId));
    const taken = new Set<string>();
    for (const leader of order) {
      const id = leader.place.id;
      if (taken.has(id)) continue;
      taken.add(id);
      if (id === selectedId) continue;
      const origin = points[index.get(leader)!];
      const members = [id];
      for (const other of order) {
        const otherId = other.place.id;
        if (taken.has(otherId) || otherId === selectedId) continue;
        const point = points[index.get(other)!];
        if (Math.hypot(point.x - origin.x, point.y - origin.y) < CLUSTER_RADIUS) {
          taken.add(otherId);
          hidden.add(otherId);
          members.push(otherId);
        }
      }
      if (members.length > 1) clusters.set(id, members);
    }
  }

  const shownOnMap = entries
    .map((entry, i) => ({ entry, point: points[i] }))
    .filter(({ entry }) => !hidden.has(entry.place.id));
  const obstacles = shownOnMap.map(({ entry, point }) => ({
    id: entry.place.id,
    left: point.x - PIN_RADIUS,
    right: point.x + PIN_RADIUS,
    top: point.y - PIN_RADIUS,
    bottom: point.y + PIN_RADIUS,
  }));
  const overlaps = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  const labels = new Map<string, LabelSide>();
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  shownOnMap
    .filter(({ entry }) => !clusters.has(entry.place.id))
    .sort((a, b) => byPriority(selectedId)(a.entry, b.entry))
    .forEach(({ entry, point }) => {
      const width =
        entry.element.querySelector<HTMLElement>(".place-marker-label")?.offsetWidth ?? 0;
      if (!width) return;
      const rectFor = (side: LabelSide) => {
        const near = LABEL_GAP - LABEL_CLEARANCE;
        const far = LABEL_GAP + width + LABEL_CLEARANCE;
        return {
          left: side === "right" ? point.x + near : point.x - far,
          right: side === "right" ? point.x + far : point.x - near,
          top: point.y - LABEL_HEIGHT / 2 - LABEL_CLEARANCE,
          bottom: point.y + LABEL_HEIGHT / 2 + LABEL_CLEARANCE,
        };
      };
      const clear = (rect: ReturnType<typeof rectFor>) =>
        !placed.some((other) => overlaps(rect, other)) &&
        !obstacles.some((pin) => pin.id !== entry.place.id && overlaps(rect, pin));

      const isSelected = entry.place.id === selectedId;
      const side: LabelSide | null = isSelected
        ? "right"
        : clear(rectFor("right"))
          ? "right"
          : clear(rectFor("left"))
            ? "left"
            : null;
      if (!side) return;
      placed.push(rectFor(side));
      labels.set(entry.place.id, side);
    });

  return { labels, hidden, clusters };
};

/*
 * Padding for fitting places into view. Top is the header bottom + 56px for
 * the selected pin, which lifts above its coordinate, + a 12px margin:
 * 120 + 56 + 12 on mobile, 56 + 56 + 12 on desktop. Desktop keeps 380px on
 * the left clear of the intro card and the place panel; right and bottom
 * clear MapLibre's zoom buttons and attribution in the bottom-right corner.
 */
const fitPadding = () =>
  window.innerWidth <= 700
    ? { top: 188, right: 56, bottom: 72, left: 24 }
    : { top: 124, right: 72, bottom: 72, left: 380 };

const layoutKey = ({ labels, hidden, clusters }: PinLayout) =>
  [
    [...labels].map(([id, side]) => `${id}:${side}`).sort().join(","),
    [...hidden].sort().join(","),
    [...clusters].map(([id, members]) => `${id}:${members.length}`).sort().join(","),
  ].join("|");

export default function AtlasMap() {
  const router = useRouter();
  const { session, user, loading: sessionLoading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const addingRef = useRef(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [titleHidden, setTitleHidden] = useState(false);
  const [pinHosts, setPinHosts] = useState<MarkerEntry[]>([]);
  const [pinLayout, setPinLayout] = useState<PinLayout>({
    labels: new Map(),
    hidden: new Set(),
    clusters: new Map(),
  });
  const selectedIdRef = useRef<string | null>(null);
  const layoutRef = useRef<() => void>(() => {});
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

  selectedIdRef.current = selected?.id ?? null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    const entries = new Map<string, MarkerEntry>();

    // MapLibre owns position; React renders the pin into each host through a
    // portal, so pins share the app's icons, tokens and state.
    visible.forEach((place) => {
      const element = document.createElement("div");
      element.className = "place-marker-anchor";
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
      entries.set(place.id, { marker, element, place });
    });

    markersRef.current = entries;
    const list = Array.from(entries.values());
    setPinHosts(list);

    const updateLayout = () => {
      const next = layoutPins(map, list, selectedIdRef.current);
      // Zoom fires every frame; only re-render when the layout really changes.
      setPinLayout((current) => (layoutKey(current) === layoutKey(next) ? current : next));
    };
    layoutRef.current = updateLayout;
    map.on("zoom", updateLayout);
    map.on("resize", updateLayout);

    return () => {
      map.off("zoom", updateLayout);
      map.off("resize", updateLayout);
      entries.forEach(({ marker }) => marker.remove());
      if (markersRef.current === entries) markersRef.current = new Map();
    };
  }, [visible]);

  // Labels are measured from the rendered portals, so lay out once they exist,
  // and again when the selection changes which label takes priority.
  useEffect(() => {
    const frame = requestAnimationFrame(() => layoutRef.current());
    return () => cancelAnimationFrame(frame);
  }, [pinHosts, selected?.id]);

  // Move focus to the panel so keyboard and screen-reader users land on what
  // they just opened instead of staying on the pin.
  useEffect(() => {
    if (selected) headingRef.current?.focus({ preventScroll: true });
  }, [selected?.id]);

  // Ease a point into the part of the map nothing covers: below the header,
  // and beside (desktop) or above (mobile) the place panel when it is open.
  // Used for the selected pin, which the panel may have just covered, and for
  // a pin reached by keyboard while off-screen, so focus never lands out of
  // sight. Non-essential, so MapLibre skips it under prefers-reduced-motion.
  const revealPoint = (lng: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return;
    const box = map.getContainer().getBoundingClientRect();
    const panel = cardRef.current?.getBoundingClientRect();
    const headerBottom = (headerRef.current?.getBoundingClientRect().bottom ?? box.top) - box.top;
    const PIN_HEIGHT = 56; // the selected pin lifts above its coordinate
    const MARGIN = 16;
    const isSheet = Boolean(panel && panel.width >= box.width - 1);
    const area = {
      left: panel && !isSheet ? panel.right - box.left + MARGIN : MARGIN,
      right: box.width - MARGIN,
      top: headerBottom + PIN_HEIGHT + MARGIN,
      bottom: panel && isSheet ? panel.top - box.top - MARGIN : box.height - MARGIN,
    };
    if (area.right <= area.left || area.bottom <= area.top) return;
    const point = map.project([lng, lat]);
    const visible =
      point.x >= area.left && point.x <= area.right &&
      point.y >= area.top && point.y <= area.bottom;
    if (visible) return;
    map.easeTo({
      center: [lng, lat],
      offset: [
        (area.left + area.right) / 2 - box.width / 2,
        (area.top + area.bottom) / 2 - box.height / 2,
      ],
      duration: 450,
      essential: false,
    });
  };

  useEffect(() => {
    if (!selected) return;
    // Wait a frame so the panel is laid out before measuring what it covers.
    const frame = requestAnimationFrame(() => revealPoint(selected.lng, selected.lat));
    return () => cancelAnimationFrame(frame);
  }, [selected?.id]);

  // Watch the real heading so the sticky mini header appears only after it
  // has scrolled out of view.
  useEffect(() => {
    setTitleHidden(false);
    const heading = headingRef.current;
    const root = scrollerRef.current;
    if (!selected || !heading || !root) return;
    // No root margin: without a hero photo the heading already sits inside
    // the bar's 56px band at rest, so only a heading that has fully left the
    // top edge counts as hidden.
    const observer = new IntersectionObserver(
      ([entry]) => setTitleHidden(!entry.isIntersecting),
      { root },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [selected?.id]);

  // Zoom to a cluster's members. Capped at SPREAD_ZOOM: past it they no
  // longer merge, so pins that share a building are nudged apart instead.
  const expandCluster = (ids: string[]) => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds();
    ids.forEach((id) => {
      const place = markersRef.current.get(id)?.place;
      if (place) bounds.extend([place.lng, place.lat]);
    });
    map.fitBounds(bounds, {
      padding: fitPadding(),
      maxZoom: SPREAD_ZOOM,
      duration: 450,
      essential: false,
    });
  };

  const closePlace = () => {
    const id = selected?.id;
    setSelected(null);
    // Hand focus back to the pin that opened the panel.
    if (id)
      requestAnimationFrame(() =>
        markersRef.current.get(id)?.element.querySelector("button")?.focus(),
      );
  };

  const fitPlacesInView = (targets: Place[], animated = false) => {
    const map = mapRef.current;
    if (!map || !targets.length) return;
    const bounds = new maplibregl.LngLatBounds();
    targets.forEach((place) => bounds.extend([place.lng, place.lat]));
    map.fitBounds(bounds, {
      padding: fitPadding(),
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
    const photoFile = data.get("photo");
    const photo = photoFile instanceof File && photoFile.size ? photoFile : null;
    const photoProblem = photo && photoError(photo);
    if (photoProblem) {
      toast.error(photoProblem);
      return;
    }
    const placeWait = getActionWait("place", PLACE_SUBMISSION_INTERVAL, user.id);
    if (isSupabaseConfigured && placeWait > 0) {
      toast(`Новое место можно добавить через ${Math.ceil(placeWait / 60000)} мин.`);
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
      }
      // The place is already on the map, so a failed photo must not undo it:
      // say so and let the person retry from the place card.
      let photoFailed = false;
      if (photo) {
        const alt = `Фото места ${place.name}`;
        try {
          const uploaded = isSupabaseConfigured
            ? await uploadPlacePhoto(place.id, photo, "", user.id, session.access_token)
            : { id: crypto.randomUUID(), url: URL.createObjectURL(photo), caption: "", alt, createdAt: new Date().toISOString() };
          if (isSupabaseConfigured) rememberAction("photo", user.id);
          place.photos = [{ ...uploaded, alt: uploaded.alt || alt }];
        } catch {
          photoFailed = true;
        }
      }
      setPlaces((current) => [...current, place]);
      setSelected(place);
      setDraft(null);
      if (photoFailed) {
        toast.warning("Место добавлено, но фото не загрузилось. Попробуйте добавить его из карточки места.");
      } else {
        toast.success(isSupabaseConfigured ? "Место добавлено на карту" : "Место сохранено в этом браузере");
      }
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
    const problem = photoError(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const photoWait = getActionWait("photo", PHOTO_SUBMISSION_INTERVAL, user.id);
    if (photoWait > 0) {
      toast(`Следующее фото можно добавить через ${Math.ceil(photoWait / 1000)} сек.`);
      return;
    }
    setSavingPhoto(true);
    try {
      const photo = await uploadPlacePhoto(selected.id, file, String(data.get("caption") || "").trim(), user.id, session.access_token);
      rememberAction("photo", user.id);
      const updated = { ...selected, photos: [...selected.photos, { ...photo, alt: photo.alt || `Фото места ${selected.name}` }] };
      setPlaces((current) => current.map((place) => place.id === updated.id ? updated : place));
      setSelected(updated);
      form.reset();
      setPhotoOpen(false);
      toast.success("Фото добавлено");
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

      {/*
        Three islands, one per question the user is asking: where am I (brand +
        city), what am I looking for (search + filters), and what do I do / who
        am I (add place + profile). The map showing through the gaps is what
        groups them; every island shares one height and one elevation.

        Radii are concentric: islands are rounded-xl (14px) with a 6px inset,
        so the rounded-md (8px) controls inside sit parallel to the edge.
      */}
      <div ref={headerRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 p-3 md:flex-nowrap">
        <div className="bg-background pointer-events-auto flex h-11 shrink-0 items-center gap-1 rounded-xl border px-1.5 shadow-sm">
          <button
            type="button"
            onClick={resetDiscovery}
            aria-label="Atlas — показать все места"
            className="focus-visible:ring-ring/50 flex h-8 items-center gap-2 rounded-md px-1 font-semibold tracking-tight outline-none focus-visible:ring-[3px]"
          >
            <BrandMark className="size-7 rounded-md" />
            <span className="hidden lg:inline">Atlas</span>
          </button>
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-5"
          />
          <CitySwitcher city={city} counts={cityCounts} onSelect={changeCity} />
        </div>

        <div className="pointer-events-auto relative order-last w-full md:order-none md:mx-auto md:w-auto md:max-w-xl md:flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
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
            className={cn(
              "bg-background h-11 rounded-xl pl-10 shadow-sm",
              query ? "pr-20" : "pr-12",
            )}
          />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Очистить поиск"
                className="size-8"
                onClick={() => setQuery("")}
              >
                <X />
              </Button>
            )}
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
          </div>
        </div>

        <div className="bg-background pointer-events-auto ml-auto flex h-11 shrink-0 items-center gap-1 rounded-xl border px-1.5 shadow-sm md:ml-0">
          <Button
            ref={addButtonRef}
            type="button"
            size="sm"
            variant={adding ? "secondary" : "default"}
            className="w-8 px-0 sm:w-auto sm:px-3"
            aria-label={adding ? "Отменить добавление места" : "Добавить место"}
            aria-pressed={adding}
            onClick={adding ? cancelAdding : beginAdding}
          >
            <span className="relative grid size-4 shrink-0 place-items-center">
              <Plus className={cn("absolute", iconSwap(!adding))} />
              <X className={cn("absolute", iconSwap(adding))} />
            </span>
            <span className="hidden sm:inline">
              {adding ? "Отменить" : "Добавить место"}
            </span>
          </Button>

          <Button asChild variant="ghost" size="icon" className="size-8 rounded-full">
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
        </div>
      </div>

      <main
        id="map"
        ref={containerRef}
        className={cn("absolute inset-0", adding && "cursor-crosshair")}
        aria-label="Интерактивная карта Пхукета"
        aria-busy={loadingPlaces}
        tabIndex={-1}
      />
      {pinHosts.map(({ element, place }) =>
        createPortal(
          <PlacePin
            place={place}
            selected={selected?.id === place.id}
            labelSide={pinLayout.labels.get(place.id) ?? null}
            hidden={pinLayout.hidden.has(place.id)}
            clusterSize={pinLayout.clusters.get(place.id)?.length ?? 1}
            onSelect={() => setSelected(place)}
            onExpand={() => expandCluster(pinLayout.clusters.get(place.id) ?? [])}
            onFocus={() => revealPoint(place.lng, place.lat)}
          />,
          element,
          place.id,
        ),
      )}


      {!selected && !adding && visible.length > 0 && (
        <Card
          className="absolute top-18 left-3 z-10 hidden w-72 gap-0 py-4 shadow-lg md:block"
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
          className="absolute top-32 left-1/2 z-10 w-[min(28rem,calc(100%-1.5rem))] md:top-18 -translate-x-1/2 gap-0 py-4 shadow-lg"
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
          className="absolute top-32 left-1/2 z-10 w-[min(24rem,calc(100%-1.5rem))] md:top-18 -translate-x-1/2 gap-0 py-6 text-center shadow-lg"
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
                  Карту наполняет сообщество. Добавьте первое место — оно сразу
                  появится на карте.
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
        /*
          Order follows the questions a visitor asks: is this the place (photo,
          name), what and where is it (category, address), how do I get there
          and is it any good (route, vote), then the detail (description,
          author) and the discussion. Rare actions live in the ⋯ menu.
        */
        <Card
          ref={cardRef}
          role="region"
          aria-labelledby="place-title"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.defaultPrevented) closePlace();
          }}
          className="absolute inset-x-0 bottom-0 z-30 max-h-[70svh] gap-0 overflow-hidden rounded-b-none py-0 shadow-xl md:inset-x-auto md:top-18 md:bottom-auto md:left-3 md:max-h-[calc(100svh-5.25rem)] md:w-96 md:rounded-xl"
        >
          {/* Pinned outside the scroller so close stays reachable while reading. */}
          <div className="absolute top-3 right-3 z-10 flex gap-1.5">
            {/*
              Non-modal: a modal menu aria-hides the rest of the page, which
              includes the still-focusable skip link. A two-item action menu
              needs no focus trap; clicking outside already dismisses it.
            */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-8 rounded-full shadow-sm"
                  aria-label="Ещё действия с местом"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => {
                    if (requireMember("photo", selected.id)) setPhotoOpen(true);
                  }}
                >
                  <Camera /> Добавить фото
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (!requireMember("report", selected.id)) return;
                    setReportReason("inaccurate");
                    setReportOpen(true);
                  }}
                >
                  <Flag /> Пожаловаться
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-8 rounded-full shadow-sm"
              aria-label="Закрыть карточку"
              onClick={closePlace}
            >
              <X />
            </Button>
          </div>

          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {/*
              Sticky but pulled up by its own height (-mb-14), so it overlays
              the content instead of pushing it down. aria-hidden because the
              real heading below is what assistive tech should read.
            */}
            <div
              aria-hidden="true"
              className={cn(
                "bg-background sticky top-0 z-[5] -mb-14 flex h-14 items-center border-b px-4 pr-24 transition-opacity duration-150",
                titleHidden ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <span className="truncate font-semibold">{selected.name}</span>
            </div>
            {selected.photos.length > 0 && (
              <div className="relative">
                <div
                  className="flex snap-x snap-mandatory overflow-x-auto"
                  role="region"
                  aria-label={`Фотографии: ${selected.name}`}
                  tabIndex={0}
                >
                  {selected.photos.map((photo) => (
                    <figure
                      key={photo.id}
                      className="bg-muted relative aspect-[2/1] w-full shrink-0 snap-start md:aspect-[16/10]"
                    >
                      <Image
                        src={photo.url}
                        alt={photo.alt}
                        fill
                        sizes="(max-width: 48rem) 100vw, 24rem"
                        className="object-cover"
                      />
                      {photo.caption && (
                        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2.5 text-xs text-white">
                          {photo.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
                {selected.photos.length > 1 && (
                  <Badge
                    variant="secondary"
                    className="absolute top-3 left-3 tabular-nums shadow-sm"
                  >
                    {selected.photos.length} фото
                  </Badge>
                )}
              </div>
            )}

            <div className="space-y-4 p-4">
              <header
                className={cn("space-y-2", !selected.photos.length && "pr-20")}
              >
                <h2
                  id="place-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-xl leading-tight font-semibold tracking-tight text-balance outline-none"
                >
                  {selected.name}
                </h2>
                <Badge variant="secondary" className="gap-1.5">
                  <ActiveCategoryIcon
                    style={{ color: activeCategory.color }}
                    aria-hidden="true"
                  />
                  {activeCategory.label}
                </Badge>
                <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {selected.address}
                </p>
              </header>

              <div className="flex gap-2">
                <Button asChild className="min-w-0 flex-1">
                  <a
                    href={`https://www.openstreetmap.org/directions?to=${selected.lat},${selected.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Route /> Построить маршрут
                  </a>
                </Button>
                {/*
                  Like and dislike are one decision, so they read as one group.
                  The active vote fills its icon rather than turning red: a
                  dislike is an opinion, not an error.
                */}
                <div role="group" aria-label="Оценка места" className="flex shrink-0">
                  <Button
                    type="button"
                    variant={selected.myReaction === 1 ? "secondary" : "outline"}
                    className="rounded-r-none px-3"
                    onClick={() => react(1)}
                    disabled={reacting}
                    aria-pressed={selected.myReaction === 1}
                    aria-label={`Нравится, ${selected.likes}`}
                  >
                    <ThumbsUp className={cn(selected.myReaction === 1 && "fill-current")} />
                    <span className="tabular-nums">{selected.likes}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={selected.myReaction === -1 ? "secondary" : "outline"}
                    className="-ml-px rounded-l-none px-3"
                    onClick={() => react(-1)}
                    disabled={reacting}
                    aria-pressed={selected.myReaction === -1}
                    aria-label={`Не нравится, ${selected.dislikes}`}
                  >
                    <ThumbsDown className={cn(selected.myReaction === -1 && "fill-current")} />
                    <span className="tabular-nums">{selected.dislikes}</span>
                  </Button>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-pretty">{selected.description}</p>
              {/* Label and value, so the line never has to agree with a name's gender. */}
              <p className="text-muted-foreground text-xs">Автор: {selected.addedBy}</p>

              <Separator />

              <section className="space-y-4" id="place-comments">
                <h3 className="font-semibold tracking-tight">
                  Комментарии{" "}
                  <span className="text-muted-foreground tabular-nums">
                    {selected.comments.length}
                  </span>
                </h3>

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
                  <p className="text-muted-foreground text-sm text-pretty">
                    Пока никто не написал. Расскажите, что важно знать об этом месте.
                  </p>
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
          </div>
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
                  Покажите, как выглядит «{selected.name}». Фото сразу появится
                  в карточке места.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={addPhoto}>
                <PhotoPicker label="Фото" required alt={`Выбранное фото места ${selected.name}`} />
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
                    {savingPhoto ? "Загружаем…" : "Добавить фото"}
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
                  Расскажите, чем оно полезно, и приложите фото, если есть. Место
                  сразу появится на общей карте.
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
                <PhotoPicker
                  label="Фото"
                  hint="необязательно"
                  alt="Выбранное фото нового места"
                />
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
