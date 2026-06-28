// Kirim pesan notifikasi. Pilih channel berdasar env yang terisi (prioritas):
//  1) Telegram  (GRATIS, unlimited)  : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//  2) CallMeBot (WhatsApp gratis, terbatas): CALLMEBOT_PHONE + CALLMEBOT_APIKEY
//  3) Fonnte    (WA berbayar)        : FONNTE_TOKEN + WA_TARGET
//  4) Webhook umum (Slack/Discord)   : ALERT_WEBHOOK_URL
// Fire-and-forget: tidak melempar error agar tidak mengganggu alur utama.
export async function sendNotif(text) {
  if (!text) return false;
  try {
    // 1) Telegram — gratis & andal
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      const targets = tgChat.split(',').map((s) => s.trim()).filter(Boolean);
      let ok = false;
      for (const chat_id of targets) {
        const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text }), // plain text, tanpa parse_mode (aman)
        });
        ok = ok || res.ok;
      }
      return ok;
    }

    // 2) CallMeBot — WhatsApp gratis (terbatas)
    const cmbPhone = process.env.CALLMEBOT_PHONE;
    const cmbKey = process.env.CALLMEBOT_APIKEY;
    if (cmbPhone && cmbKey) {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cmbPhone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(cmbKey)}`;
      const res = await fetch(url);
      return res.ok;
    }

    // 3) Fonnte — WA berbayar (opsional)
    const token = process.env.FONNTE_TOKEN;
    const target = process.env.WA_TARGET;
    if (token && target) {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, message: text }),
      });
      return res.ok;
    }

    // 4) Webhook umum
    const hook = process.env.ALERT_WEBHOOK_URL;
    if (hook) {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
