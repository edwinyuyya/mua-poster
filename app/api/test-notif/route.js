import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Endpoint tes notifikasi SEMENTARA (tanpa key) untuk diagnosa Telegram.
// Buka: /api/test-notif  -> langsung kirim pesan tes + tampilkan diagnosa.
// Hapus lagi setelah notifikasi berhasil.
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chat = process.env.TELEGRAM_CHAT_ID || '';

  const diag = {
    TELEGRAM_terbaca_server: !!token && !!chat,
    panjang_token: token.length, // harus 46
    chat_id: chat || null,
  };

  if (token && chat) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: '✅ Tes notifikasi BBQIU dari server berhasil! Bot siap.' }),
      });
      diag.telegram_status = r.status; // harus 200
      diag.telegram_jawaban = (await r.text()).slice(0, 250);
    } catch (e) {
      diag.telegram_gagal = String(e).slice(0, 250);
    }
  }

  return NextResponse.json(diag);
}
