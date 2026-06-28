import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { sendNotif, rupiahWA } from '../../../../lib/notify';

export const dynamic = 'force-dynamic';

function startOfTodayWIB() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth(), d = wib.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - 7 * 3600 * 1000).toISOString();
}

// Laporan harian -> WhatsApp. Dipanggil Vercel Cron (vercel.json) atau manual.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const url = new URL(req.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseServer();
  const startISO = startOfTodayWIB();
  const merchant = process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran';

  const { data: orders } = await db
    .from('orders')
    .select('status, payment_method, payment_status, total, void_reason, voided_by, order_no, table_number')
    .gte('created_at', startISO);

  const all = orders || [];
  const live = all.filter((o) => o.status !== 'cancelled');
  const paid = live.filter((o) => o.payment_status === 'paid');
  const cancelled = all.filter((o) => o.status === 'cancelled');
  const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const qris = paid.filter((o) => o.payment_method === 'qris').reduce((s, o) => s + Number(o.total || 0), 0);
  const cash = paid.filter((o) => o.payment_method !== 'qris').reduce((s, o) => s + Number(o.total || 0), 0);
  const voidValue = cancelled.reduce((s, o) => s + Number(o.total || 0), 0);

  // belanja hari ini
  const { data: moves } = await db
    .from('stock_movements')
    .select('cost, type, created_at')
    .gte('created_at', startISO)
    .eq('type', 'in');
  const purchase = (moves || []).reduce((s, m) => s + Number(m.cost || 0), 0);

  const tgl = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  let msg =
    `📊 *LAPORAN HARIAN* — ${merchant}\n${tgl}\n\n` +
    `💰 Omzet (lunas): ${rupiahWA(revenue)}\n` +
    `   • QRIS: ${rupiahWA(qris)}\n` +
    `   • Kasir: ${rupiahWA(cash)}\n` +
    `🧾 Order: ${live.length} (lunas ${paid.length}, belum ${live.length - paid.length})\n` +
    `🛒 Belanja: ${rupiahWA(purchase)}\n` +
    `🚫 Void: ${cancelled.length}× (${rupiahWA(voidValue)})`;

  if (cancelled.length) {
    msg += '\n\n*Detail Void:*';
    cancelled.slice(0, 10).forEach((o) => {
      msg += `\n• #${o.order_no} Meja ${o.table_number} ${rupiahWA(o.total)} — ${o.void_reason || '-'} (${o.voided_by || '-'})`;
    });
  }

  const sent = await sendNotif(msg);

  // Mode debug: /api/cron/daily-report?key=...&debug=1
  // Menampilkan apakah env terbaca server + respons mentah Telegram (tanpa bocorkan nilai).
  const debug = new URL(req.url).searchParams.get('debug') === '1';
  let dbg;
  if (debug) {
    dbg = {
      env_seen: {
        telegram: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
        token_len: (process.env.TELEGRAM_BOT_TOKEN || '').length,
        chat: process.env.TELEGRAM_CHAT_ID || null,
        callmebot: !!process.env.CALLMEBOT_APIKEY,
        fonnte: !!process.env.FONNTE_TOKEN,
        webhook: !!process.env.ALERT_WEBHOOK_URL,
      },
    };
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: '🔎 Debug test dari server BBQIU' }),
        });
        dbg.telegram_status = r.status;
        dbg.telegram_body = (await r.text()).slice(0, 300);
      } catch (e) {
        dbg.telegram_error = String(e).slice(0, 300);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, revenue, orders: live.length, voids: cancelled.length, debug: dbg, message: msg });
}
