import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

// POST /api/cashier/close  { closed_by, cash_total?, note?, photo? }
// Catat penutupan kasir / akhir shift dengan foto wajah (bukti keamanan).
export async function POST(req) {
  const db = supabaseServer();
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 }); }
  if (!b.closed_by || !String(b.closed_by).trim())
    return NextResponse.json({ error: 'Nama kasir wajib' }, { status: 400 });

  const row = {
    closed_by: String(b.closed_by).trim().slice(0, 80),
    cash_total: b.cash_total === null || b.cash_total === '' ? null : Number(b.cash_total) || 0,
    note: (b.note || '').toString().slice(0, 300) || null,
    photo: (b.photo && typeof b.photo === 'string' && b.photo.startsWith('data:image')) ? b.photo : null,
  };
  const { data, error } = await db.from('cashier_closures').insert(row).select().single();
  if (error) return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 });
  return NextResponse.json({ ok: true, closure: data });
}

// GET /api/cashier/close  -> daftar penutupan terbaru
export async function GET() {
  const db = supabaseServer();
  const { data } = await db
    .from('cashier_closures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  return NextResponse.json({ closures: data || [] });
}
