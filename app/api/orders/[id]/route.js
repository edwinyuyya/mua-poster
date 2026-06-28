import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { sendNotif, rupiahWA } from '../../../../lib/notify';

export const dynamic = 'force-dynamic';

// GET /api/orders/:id -> detail order + item
export async function GET(_req, { params }) {
  const { id } = await params;
  const db = supabaseServer();

  const { data: order, error } = await db
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !order)
    return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });

  const { data: items } = await db
    .from('order_items')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ order, items: items || [] });
}

// PATCH /api/orders/:id -> ubah status / pembayaran
export async function PATCH(req, { params }) {
  const { id } = await params;
  const db = supabaseServer();
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const patch = {};
  if (body.payment_status === 'paid') {
    patch.payment_status = 'paid';
    patch.paid_at = new Date().toISOString();
  }
  if (body.payment_status === 'unpaid') patch.payment_status = 'unpaid';

  if (['open', 'preparing', 'served', 'closed', 'cancelled'].includes(body.status)) {
    patch.status = body.status;
    if (body.status === 'closed') patch.closed_at = new Date().toISOString();
    if (body.status === 'cancelled') {
      patch.cancelled_at = new Date().toISOString();
      patch.void_reason = (body.void_reason || '').toString().slice(0, 300) || null;
      patch.voided_by = (body.voided_by || '').toString().slice(0, 80) || null;
      if (body.void_photo && typeof body.void_photo === 'string' && body.void_photo.startsWith('data:image')) {
        patch.void_photo = body.void_photo;
      }
    }
  }
  if (['qris', 'cashier'].includes(body.payment_method))
    patch.payment_method = body.payment_method;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 });

  const { data, error } = await db
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 });

  // Notifikasi real-time ke WA saat ada pembatalan (void) — titik rawan.
  if (data && data.status === 'cancelled') {
    const merchant = process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran';
    const msg =
      `🚫 *VOID NOTA* — ${merchant}\n` +
      `Bill #${data.order_no} · Meja ${data.table_number}\n` +
      `Nilai: ${rupiahWA(data.total)}${data.payment_status === 'paid' ? ' (SUDAH LUNAS!)' : ''}\n` +
      `Alasan: ${data.void_reason || '-'}\n` +
      `Oleh: ${data.voided_by || '-'}\n` +
      `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
    // jangan tunggu (fire-and-forget) agar respons cepat
    sendNotif(msg);
  }

  return NextResponse.json({ ok: true, order: data });
}
