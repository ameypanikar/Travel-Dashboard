import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSessionToken } from "./auth";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

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
