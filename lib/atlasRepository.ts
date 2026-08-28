import { supabasePublishableKey, supabaseUrl } from "./supabaseConfig";

export type Category = "documents" | "health" | "food" | "work" | "family" | "leisure";
export type Reaction = -1 | 1 | null;
export type Comment = { id: string; author: string; text: string; date: string; parentId: string | null; createdAt: string };
export type PlacePhoto = { id: string; url: string; caption: string; alt: string; createdAt: string };
export type Place = {
  id: string; name: string; category: Category; address: string; description: string;
  lng: number; lat: number; likes: number; dislikes: number; myReaction: Reaction;
  comments: Comment[]; photos: PlacePhoto[]; addedBy?: string;
};
export type ReportReason = "inaccurate" | "closed" | "spam" | "harmful" | "duplicate" | "other";
export type ReactionResult = { likes: number; dislikes: number; myReaction: Reaction };

const url = supabaseUrl;
const key = supabasePublishableKey;
export const isSupabaseConfigured = Boolean(url && key);
const headers = () => ({ apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

type DbComment = { id: string; author: string; body: string; parent_id: string | null; created_at: string };
type DbPhoto = { id: string; storage_path: string; caption: string; alt_text: string; created_at: string };
type DbPlace = {
  id: string; name: string; category: Category; address: string; description: string;
  longitude: number; latitude: number; added_by: string; likes: number; dislikes: number;
  my_reaction: Reaction; comments?: DbComment[]; photos?: DbPhoto[];
};

const dateLabel = (value: string) => new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(new Date(value));
export const publicPhotoUrl = (path: string) => `${url}/storage/v1/object/public/place-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
const fromDbComment = (row: DbComment): Comment => ({
  id: row.id, author: row.author, text: row.body, date: dateLabel(row.created_at),
  parentId: row.parent_id, createdAt: row.created_at,
});
const fromDb = (row: DbPlace): Place => ({
  id: row.id, name: row.name, category: row.category, address: row.address,
  description: row.description, lng: row.longitude, lat: row.latitude,
  likes: Number(row.likes || 0), dislikes: Number(row.dislikes || 0),
  myReaction: row.my_reaction ?? null, addedBy: row.added_by,
  comments: (row.comments ?? []).map(fromDbComment),
  photos: (row.photos ?? []).map((photo) => ({
    id: photo.id, url: publicPhotoUrl(photo.storage_path), caption: photo.caption,
    alt: photo.alt_text || photo.caption || `Фото места ${row.name}`, createdAt: photo.created_at,
  })),
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!url || !key) throw new Error("Supabase не настроен");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body.message || body.hint || `Supabase: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function loadPlaces(clientId: string): Promise<Place[]> {
  const rows = await request<DbPlace[]>("rpc/atlas_places", { method: "POST", body: JSON.stringify({ visitor_id: clientId }) });
  return rows.map(fromDb);
}

export async function createPlace(place: Place, clientId: string): Promise<void> {
  await request<string>("rpc/submit_place", {
    method: "POST",
    body: JSON.stringify({
      new_id: place.id, new_name: place.name, new_category: place.category,
      new_address: place.address, new_description: place.description,
      new_longitude: place.lng, new_latitude: place.lat,
      new_added_by: place.addedBy, client_id: clientId,
    }),
  });
}

export async function createComment(placeId: string, comment: Comment, clientId: string): Promise<Comment> {
  const row = await request<DbComment>("rpc/submit_comment_v2", {
    method: "POST",
    body: JSON.stringify({
      new_id: comment.id, target_place_id: placeId, parent_comment_id: comment.parentId,
      new_author: comment.author, new_body: comment.text, client_id: clientId,
    }),
  });
  return fromDbComment(row);
}

export async function reactToPlace(placeId: string, reaction: Exclude<Reaction, null>, clientId: string) {
  const result = await request<{ likes: number; dislikes: number; my_reaction: Reaction }>("rpc/react_to_place", {
    method: "POST",
    body: JSON.stringify({ target_place_id: placeId, client_id: clientId, new_reaction: reaction }),
  });
  return { likes: Number(result.likes), dislikes: Number(result.dislikes), myReaction: result.my_reaction ?? null } satisfies ReactionResult;
}

export async function uploadPlacePhoto(placeId: string, file: File, caption: string, clientId: string) {
  if (!url || !key) throw new Error("Supabase не настроен");
  const rawExtension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const extension = rawExtension === "jpeg" ? "jpg" : rawExtension;
  const photoId = crypto.randomUUID();
  const storagePath = `${placeId}/${clientId}/${photoId}.${extension}`;
  const upload = await fetch(`${url}/storage/v1/object/place-photos/${storagePath}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
    body: file,
  });
  if (!upload.ok) {
    const body = await upload.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body.message || body.error || "Не удалось загрузить фото");
  }
  await request<string>("rpc/submit_place_photo", {
    method: "POST",
    body: JSON.stringify({
      new_id: photoId, target_place_id: placeId, new_storage_path: storagePath,
      new_caption: caption, new_alt_text: caption, client_id: clientId,
    }),
  });
}

export async function reportPlace(placeId: string, reason: ReportReason, details: string, clientId: string) {
  return request<string>("rpc/submit_place_report", {
    method: "POST",
    body: JSON.stringify({ target_place_id: placeId, client_id: clientId, new_reason: reason, new_details: details }),
  });
}
