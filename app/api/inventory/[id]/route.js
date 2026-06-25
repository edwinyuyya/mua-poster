import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

// PATCH /api/inventory/:id -> ubah data barang
export async function PATCH(req, { params }) {
  const { id } = await params;
  const db = supabaseServer();
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 }); }
  const patch = {};
  ['name', 'unit', 'category', 'supplier', 'barcode'].forEach((k) => {
    if (b[k] !== undefined) patch[k] = b[k] === '' ? null : b[k];
  });
  ['min_stock', 'cost_price'].forEach((k) => {
    if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
  });
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });
  const { data, error } = await db.from('inventory_items').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

// DELETE /api/inventory/:id
export async function DELETE(_req, { params }) {
  const { id } = await params;
  const db = supabaseServer();
  const { error } = await db.from('inventory_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
