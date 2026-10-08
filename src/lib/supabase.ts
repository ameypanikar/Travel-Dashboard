import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSessionToken } from "./auth";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hcmdjhaglmzmetzczzwpz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjbWRqaGFnbHptZXR6Y3p6d3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzU4MDAsImV4cCI6MjEwNzAxMTgwMH0.w4jLiyUdaSA49ydSVNa1kdYftRgmniWY513GcPxHNQg";

// The default unauthenticated client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let cachedToken: string | null = null;
let cachedClient: SupabaseClient | null = null;

export function getSupabase() {
  const token = getSessionToken();
  if (!token) return supabase;

  if (token === cachedToken && cachedClient) {
    return cachedClient;
  }

  cachedToken = token;
  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'Prefer': `custom-auth-${token}`
      }
    }
  });

  return cachedClient;
}
