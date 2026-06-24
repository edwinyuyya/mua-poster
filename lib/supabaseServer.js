import { createClient } from '@supabase/supabase-js';

// Client untuk dipakai di server (route handlers / server components).
// Pakai service role bila tersedia, jika tidak fallback ke anon key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseServer() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
