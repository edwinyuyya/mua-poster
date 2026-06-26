import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Client untuk dipakai di browser (anon key, dibatasi RLS)
export const supabase = createClient(supabaseUrl, supabaseKey);
