// Kirim pesan notifikasi ke WhatsApp / webhook.
// Prioritas:
//  1) Fonnte (gateway WA Indonesia): set FONNTE_TOKEN + WA_TARGET (nomor tujuan)
//  2) Webhook umum (Slack/Discord/Telegram-gateway): set ALERT_WEBHOOK_URL
// Fire-and-forget: tidak melempar error agar tidak mengganggu alur utama.
export async function sendNotif(text) {
  if (!text) return false;
  const token = process.env.FONNTE_TOKEN;
  const target = process.env.WA_TARGET; // nomor WA tujuan, mis. 6281234567890 (boleh dipisah koma)
  const hook = process.env.ALERT_WEBHOOK_URL;

  try {
    if (token && target) {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, message: text }),
      });
      return res.ok;
    }
    if (hook) {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // text=Slack, content=Discord, message=generic
        body: JSON.stringify({ text, content: text, message: text }),
      });
      return res.ok;
    }
  } catch {
    /* abaikan kegagalan notifikasi */
  }
  return false;
}

export function rupiahWA(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}
