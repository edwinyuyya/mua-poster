import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

// PATCH /api/order-items/:id -> ubah status dapur (queued|printed|preparing|ready|served)
export async function PATCH(req, { params }) {
  const { id } = await params;
  const db = supabaseServer();
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const allowed = ['queued', 'printed', 'preparing', 'ready', 'served'];
  if (!allowed.includes(body.kitchen_status))
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });

  const { data, error } = await db
    .from('order_items')
    .update({ kitchen_status: body.kitchen_status })
    .eq('id', id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 });

  return NextResponse.json({ ok: true, item: data });
}
