export type Category = "documents" | "health" | "food" | "work" | "family" | "leisure";
export type Comment = { id: string; author: string; text: string; date: string };
export type Place = { id: string; name: string; category: Category; address: string; description: string; lng: number; lat: number; verified: number; comments: Comment[]; addedBy?: string };

import { supabasePublishableKey, supabaseUrl } from "./supabaseConfig";

const url = supabaseUrl;
const key = supabasePublishableKey;
export const isSupabaseConfigured = Boolean(url && key);

type DbComment = { id: string; author: string; body: string; created_at: string };
type DbPlace = { id: string; name: string; category: Category; address: string; description: string; longitude: number; latitude: number; verified_count: number; added_by: string; comments?: DbComment[] };
const headers = () => ({ apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
const dateLabel = (value: string) => new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" }).format(new Date(value));
const fromDb = (row: DbPlace): Place => ({ id: row.id, name: row.name, category: row.category, address: row.address, description: row.description, lng: row.longitude, lat: row.latitude, verified: row.verified_count, addedBy: row.added_by, comments: (row.comments ?? []).map(c => ({ id: c.id, author: c.author, text: c.body, date: dateLabel(c.created_at) })) });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!url || !key) throw new Error("Supabase не настроен");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!response.ok) throw new Error((await response.text()) || `Supabase: ${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const isMissingRpc = (cause: unknown) => cause instanceof Error && /PGRST202|schema cache|Could not find the function/i.test(cause.message);

export async function loadPlaces(): Promise<Place[]> {
  const rows = await request<DbPlace[]>("places?select=*,comments(*)&order=created_at.asc");
  return rows.map(fromDb);
}
export async function createPlace(place: Place, clientId: string): Promise<void> {
  try {
    await request<string>("rpc/submit_place", {
      method: "POST",
      body: JSON.stringify({
        new_id: place.id,
        new_name: place.name,
        new_category: place.category,
        new_address: place.address,
        new_description: place.description,
        new_longitude: place.lng,
        new_latitude: place.lat,
        new_added_by: place.addedBy,
        client_id: clientId,
      }),
    });
  } catch (cause) {
    if (!isMissingRpc(cause)) throw cause;
    await request<void>("places", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        description: place.description,
        longitude: place.lng,
        latitude: place.lat,
        added_by: place.addedBy,
        status: "hidden",
      }),
    });
  }
}
export async function createComment(placeId: string, comment: Comment, clientId: string): Promise<Comment> {
  let row: DbComment;
  try {
    row = await request<DbComment>("rpc/submit_comment", {
      method: "POST",
      body: JSON.stringify({
        new_id: comment.id,
        target_place_id: placeId,
        new_author: comment.author,
        new_body: comment.text,
        client_id: clientId,
      }),
    });
  } catch (cause) {
    if (!isMissingRpc(cause)) throw cause;
    [row] = await request<DbComment[]>("comments?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: comment.id, place_id: placeId, author: comment.author, body: comment.text }),
    });
  }
  return { id: row.id, author: row.author, text: row.body, date: dateLabel(row.created_at) };
}
export async function confirmPlace(placeId: string, clientId: string): Promise<number> {
  try {
    return await request<number>("rpc/confirm_place", { method: "POST", body: JSON.stringify({ target_place_id: placeId, client_id: clientId }) });
  } catch (cause) {
    if (!isMissingRpc(cause)) throw cause;
    return request<number>("rpc/confirm_place", { method: "POST", body: JSON.stringify({ target_place_id: placeId }) });
  }
}
