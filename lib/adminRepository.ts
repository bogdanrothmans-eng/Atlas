import { publicPhotoUrl } from "./atlasRepository";
import { supabasePublishableKey, supabaseUrl } from "./supabaseConfig";

const url = supabaseUrl;
const key = supabasePublishableKey;
const TOKEN_KEY = "atlas-admin-token";
export type AdminPlace = {
  id: string; name: string; category: string; address: string; description: string;
  longitude: number; latitude: number; status: "published" | "hidden"; verified_count: number;
  likes: number; dislikes: number; comment_count: number; created_at: string;
};
export type AdminComment = {
  id: string; place_id: string; place_name: string; parent_id: string | null;
  author: string; body: string; status: "published" | "hidden"; created_at: string;
};
export type AdminReport = {
  id: string; place_id: string; place_name: string;
  reason: "inaccurate" | "closed" | "spam" | "harmful" | "duplicate" | "other";
  details: string; status: "new" | "reviewed" | "resolved" | "dismissed"; created_at: string;
};
export type AdminPhoto = {
  id: string; place_id: string; place_name: string; storage_path: string;
  caption: string; alt_text: string; status: "published" | "hidden"; created_at: string;
};
export type Dashboard = { places: AdminPlace[]; comments: AdminComment[]; reports: AdminReport[]; photos: AdminPhoto[] };

const baseHeaders = () => ({ apikey: key!, "Content-Type": "application/json" });
async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, string>;
    const message = body.error_code === "invalid_credentials"
      ? "Неверный email или пароль"
      : body.message || body.msg || body.error_description || body.hint;
    throw new Error(message || "Не удалось выполнить запрос. Проверьте подключение и повторите попытку.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
export async function signIn(email: string, password: string) {
  const data = await parse<{ access_token: string }>(await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: baseHeaders(), body: JSON.stringify({ email, password }),
  }));
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  return data.access_token;
}
export async function signUp(email: string, password: string) {
  return parse<{ session: { access_token: string } | null }>(await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: baseHeaders(), body: JSON.stringify({ email, password }) }));
}
export async function requestPasswordReset(email: string, redirectTo: string) {
  return parse<Record<string, never>>(await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", headers: baseHeaders(), body: JSON.stringify({ email }) }));
}
export async function updatePassword(accessToken: string, password: string) {
  return parse<Record<string, unknown>>(await fetch(`${url}/auth/v1/user`, { method: "PUT", headers: { ...baseHeaders(), Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ password }) }));
}
export function signOut() { sessionStorage.removeItem(TOKEN_KEY); }
export function currentToken() { return typeof window === "undefined" ? null : sessionStorage.getItem(TOKEN_KEY); }
async function rpc<T>(name: string, body: object = {}) {
  const token = currentToken();
  if (!token) throw new Error("Войдите в аккаунт");
  return parse<T>(await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { ...baseHeaders(), Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  }));
}
export const loadAdminDashboard = async () => {
  const result = await rpc<Partial<Dashboard>>("admin_dashboard");
  return { places: result.places ?? [], comments: result.comments ?? [], reports: result.reports ?? [], photos: result.photos ?? [] };
};
export const setPlaceStatus = (id: string, status: "published" | "hidden") => rpc<void>("admin_set_place_status", { target_place_id: id, new_status: status });
export const removeComment = (id: string) => rpc<void>("admin_delete_comment", { target_comment_id: id });
export const updatePlace = (place: AdminPlace) => rpc<void>("admin_update_place", { target_place_id: place.id, new_name: place.name, new_category: place.category, new_address: place.address, new_description: place.description, new_longitude: place.longitude, new_latitude: place.latitude });
export const updateComment = (id: string, body: string) => rpc<void>("admin_update_comment", { target_comment_id: id, new_body: body });
export const resolveReport = (id: string, status: "reviewed" | "resolved" | "dismissed", hidePlace = false) => rpc<void>("admin_resolve_report", { target_report_id: id, new_status: status, hide_place: hidePlace });
export const setPhotoStatus = (id: string, status: "published" | "hidden") => rpc<void>("admin_set_photo_status", { target_photo_id: id, new_status: status });
export const removePhoto = (id: string) => rpc<void>("admin_delete_photo", { target_photo_id: id });
export const adminPhotoUrl = (photo: AdminPhoto) => publicPhotoUrl(photo.storage_path);
