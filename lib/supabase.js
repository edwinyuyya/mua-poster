import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Build-safe lazy client: createClient() ditunda sampai benar-benar dipakai
// (di browser), supaya prerender saat `next build` tidak crash bila env
// belum tersedia / belum valid.
let _client = null;
function getClient() {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

// Proxy agar pemakaian `supabase.from(...)` tetap sama seperti sebelumnya,
// tetapi createClient hanya jalan saat method pertama dipanggil (runtime).
export const supabase = new Proxy(
  {},
  {
    get(_t, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);
