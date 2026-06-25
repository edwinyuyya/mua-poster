import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET /api/inventory -> daftar barang
export async function GET() {
  const db = supabaseServer();
  const { data, error } = await db
    .from('inventory_items')
    .select('*')
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: 'Gagal membaca' }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

// POST /api/inventory -> tambah barang
export async function POST(req) {
  const db = supabaseServer();
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 }); }
  if (!b.name || !String(b.name).trim()) return NextResponse.json({ error: 'Nama wajib' }, { status: 400 });
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const today = `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-${String(wib.getUTCDate()).padStart(2, '0')}`;
  const { data, error } = await db
    .from('inventory_items')
    .insert({
      name: String(b.name).trim(),
      unit: b.unit || 'pcs',
      category: b.category || null,
      stock_qty: Number(b.stock_qty) || 0,
      min_stock: Number(b.min_stock) || 0,
      cost_price: Number(b.cost_price) || 0,
      supplier: b.supplier || null,
      barcode: b.barcode ? String(b.barcode).trim() : null,
      expiry_date: b.expiry_date || null,
      shelf_life_days: b.shelf_life_days ? Number(b.shelf_life_days) : null,
      received_date: Number(b.stock_qty) > 0 ? today : null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
