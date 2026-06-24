import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

// PATCH /api/print-jobs/:id -> tandai sudah dicetak; sekaligus tandai item 'printed'
export async function PATCH(req, { params }) {
  const { id } = await params;
  const db = supabaseServer();

  const { data: job, error: jErr } = await db
    .from('print_jobs')
    .update({ status: 'printed', printed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (jErr || !job)
    return NextResponse.json({ error: 'Print job tidak ditemukan' }, { status: 404 });

  await db
    .from('order_items')
    .update({ kitchen_status: 'printed' })
    .eq('order_id', job.order_id)
    .eq('kitchen_status', 'queued');

  return NextResponse.json({ ok: true, job });
}
