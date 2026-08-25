// Supabase publishable credentials are safe to expose in browser code.
// Environment variables remain preferred; the fallback keeps preview builds usable.
export const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mqxafkcywtmrlimjbpkn.supabase.co"
).replace(/\/$/, "");

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_2C2z39830GzWyMsZUvP1mg_4qEqJhWW";
