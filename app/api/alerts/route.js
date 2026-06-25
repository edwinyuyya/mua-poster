import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { computeAlerts } from '../../../lib/alerts';

export const dynamic = 'force-dynamic';

// GET /api/alerts -> stok mendekati kadaluarsa, low-stock, & saran menu
export async function GET() {
  const db = supabaseServer();
  const data = await computeAlerts(db);
  return NextResponse.json(data);
}
