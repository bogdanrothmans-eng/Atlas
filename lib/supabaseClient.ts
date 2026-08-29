import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "./supabaseConfig";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const safeNextPath = (value: unknown) => {
  const path = typeof value === "string" ? value : "/";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
};
