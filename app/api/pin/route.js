import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function pinFor(scope) {
  if (scope === 'owner') return process.env.OWNER_PIN || process.env.STAFF_PIN || '';
  return process.env.STAFF_PIN || '';
}

// GET /api/pin?scope=staff|owner  -> apakah PIN diperlukan?
export async function GET(req) {
  const scope = new URL(req.url).searchParams.get('scope') || 'staff';
  return NextResponse.json({ required: !!pinFor(scope) });
}

// POST /api/pin  { pin, scope }  -> verifikasi
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const scope = body.scope === 'owner' ? 'owner' : 'staff';
  const expected = pinFor(scope);
  if (!expected) return NextResponse.json({ ok: true }); // tidak diset -> bebas
  return NextResponse.json({ ok: String(body.pin || '') === String(expected) });
}
