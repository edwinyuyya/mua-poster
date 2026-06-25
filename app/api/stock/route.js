import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

function todayWIB() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-${String(wib.getUTCDate()).padStart(2, '0')}`;
}

// POST /api/stock
//  { action: 'receive', items: [{item_id, qty, cost_price?}] }  -> barang datang (in)
//  { action: 'adjust', item_id, mode:'out'|'set', qty, note }   -> pemakaian / opname
export async function POST(req) {
  const db = supabaseServer();
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 }); }

  if (b.action === 'receive') {
    const rows = Array.isArray(b.items) ? b.items.filter((x) => x.item_id && Number(x.qty) > 0) : [];
    if (!rows.length) return NextResponse.json({ error: 'Tidak ada barang' }, { status: 400 });
    const ids = rows.map((r) => r.item_id);
    const { data: items } = await db.from('inventory_items').select('id, stock_qty, cost_price').in('id', ids);
    const byId = Object.fromEntries((items || []).map((i) => [i.id, i]));
    const moves = [];
    for (const r of rows) {
      const it = byId[r.item_id];
      if (!it) continue;
      const qty = Number(r.qty);
      const cost = (Number(r.cost_price) || Number(it.cost_price) || 0) * qty;
      moves.push({ item_id: r.item_id, type: 'in', qty, cost, note: b.note || 'Barang datang' });
      const patch = { stock_qty: Number(it.stock_qty || 0) + qty, received_date: todayWIB() };
      if (r.cost_price !== undefined && r.cost_price !== '' && Number(r.cost_price) >= 0) patch.cost_price = Number(r.cost_price);
      if (r.expiry_date) patch.expiry_date = r.expiry_date; // tanggal kadaluarsa batch ini (jika diisi)
      await db.from('inventory_items').update(patch).eq('id', r.item_id);
    }
    if (moves.length) await db.from('stock_movements').insert(moves);
    return NextResponse.json({ ok: true, count: moves.length });
  }

  if (b.action === 'adjust') {
    if (!b.item_id) return NextResponse.json({ error: 'item_id wajib' }, { status: 400 });
    const { data: it } = await db.from('inventory_items').select('stock_qty').eq('id', b.item_id).single();
    if (!it) return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 });
    const cur = Number(it.stock_qty || 0);
    const qty = Number(b.qty) || 0;
    let newStock, mvQty, type;
    if (b.mode === 'set') { newStock = qty; mvQty = qty - cur; type = 'adjust'; }
    else { newStock = cur - qty; mvQty = qty; type = 'out'; }
    await db.from('inventory_items').update({ stock_qty: newStock }).eq('id', b.item_id);
    await db.from('stock_movements').insert({ item_id: b.item_id, type, qty: mvQty, note: b.note || (type === 'out' ? 'Pemakaian' : 'Opname') });
    return NextResponse.json({ ok: true, stock_qty: newStock });
  }

  return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 });
}

// GET /api/stock?item_id=...  -> riwayat pergerakan (terbaru)
export async function GET(req) {
  const db = supabaseServer();
  const itemId = new URL(req.url).searchParams.get('item_id');
  let q = db.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100);
  if (itemId) q = q.eq('item_id', itemId);
  const { data } = await q;
  return NextResponse.json({ movements: data || [] });
}
