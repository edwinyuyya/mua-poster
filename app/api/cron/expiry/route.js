import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { computeAlerts, formatAlertMessage } from '../../../../lib/alerts';
import { sendNotif } from '../../../../lib/notify';

export const dynamic = 'force-dynamic';

// Dipanggil otomatis oleh Vercel Cron (lihat vercel.json), atau manual.
// Mengirim peringatan ke webhook (ALERT_WEBHOOK_URL) jika diset.
//   - Slack/Discord: kirim { text }
//   - WhatsApp/Telegram via gateway: kirim { text } juga (sesuaikan gateway-mu)
export async function GET(req) {
  // proteksi opsional
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const url = new URL(req.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseServer();
  const alerts = await computeAlerts(db);
  const merchant = process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran';
  const message = formatAlertMessage(alerts, merchant);

  let sent = false;
  if (message) sent = await sendNotif(message);

  return NextResponse.json({
    ok: true,
    sent,
    near_expiry: alerts.near_expiry.length,
    low_stock: alerts.low_stock.length,
    message,
  });
}
