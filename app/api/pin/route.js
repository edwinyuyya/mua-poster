import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// PIN per peran. Jika PIN peran tidak diset, fallback ke STAFF_PIN supaya
// konfigurasi lama tetap jalan (tidak merusak yang sudah ada).
function pinFor(scope) {
  const staff = process.env.STAFF_PIN || '';
  switch (scope) {
    case 'owner': return process.env.OWNER_PIN || staff;
    case 'admin': return process.env.ADMIN_PIN || staff;
    case 'kasir': return process.env.KASIR_PIN || staff;
    case 'dapur': return process.env.DAPUR_PIN || staff;
    case 'stok':  return process.env.STOK_PIN || staff;
    default:      return staff; // 'staff'
  }
}

const SCOPES = ['staff', 'owner', 'admin', 'kasir', 'dapur', 'stok'];
function normScope(s) {
  return SCOPES.includes(s) ? s : 'staff';
}

// GET /api/pin?scope=...  -> apakah PIN diperlukan?
export async function GET(req) {
  const scope = normScope(new URL(req.url).searchParams.get('scope'));
  return NextResponse.json({ required: !!pinFor(scope) });
}

// POST /api/pin  { pin, scope }  -> verifikasi
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const scope = normScope(body.scope);
  const expected = pinFor(scope);
  if (!expected) return NextResponse.json({ ok: true }); // tidak diset -> bebas
  return NextResponse.json({ ok: String(body.pin || '') === String(expected) });
}
