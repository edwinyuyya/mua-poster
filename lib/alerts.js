// Logika alert stok mendekati kadaluarsa + saran menu. Dipakai oleh
// /api/alerts (UI) dan /api/cron/expiry (kirim notifikasi terjadwal).
import { estimateShelfLife, addDays } from './shelflife';

const STOPWORDS = new Set([
  'slice', 'fillet', 'filet', 'frozen', 'segar', 'kg', 'gram', 'gr', 'pack', 'pcs',
  'box', 'liter', 'ikat', 'jumbo', 'small', 'large', 'porsi', 'premium', 'special',
  'spesial', 'grill', 'suki', 'bumbu', 'isi', 'merk', 'merek', 'dan', 'the',
]);

export function keywords(name) {
  return String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function daysLeft(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const today = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const exp = Date.UTC(y, (m || 1) - 1, d || 1);
  return Math.floor((exp - today) / 86400000);
}

export async function computeAlerts(db) {
  const threshold = Number(process.env.ALERT_EXPIRY_DAYS || 3);

  const { data: inv } = await db
    .from('inventory_items')
    .select('id, name, unit, stock_qty, min_stock, expiry_date, received_date, shelf_life_days, category');
  const items = inv || [];

  // Tentukan kadaluarsa efektif: dari tanggal manual, atau ESTIMASI
  // (tanggal datang + masa simpan override/heuristik).
  const withExp = items.map((i) => {
    if (i.expiry_date) {
      return { ...i, effective_expiry: i.expiry_date, estimated: false, basis: null };
    }
    if (i.received_date) {
      let days = (i.shelf_life_days != null && i.shelf_life_days !== '') ? Number(i.shelf_life_days) : null;
      let basis = days != null ? `masa simpan diset ${days} hari` : null;
      if (days == null) {
        const est = estimateShelfLife(i.name, i.category);
        if (est) { days = est.days; basis = est.basis; }
      }
      if (days != null) {
        return { ...i, effective_expiry: addDays(i.received_date, days), estimated: true, basis };
      }
    }
    return { ...i, effective_expiry: null, estimated: false, basis: null };
  });

  const nearExpiry = withExp
    .map((i) => ({ ...i, days_left: daysLeft(i.effective_expiry) }))
    .filter((i) => i.days_left !== null && i.days_left <= threshold && Number(i.stock_qty) > 0)
    .sort((a, b) => a.days_left - b.days_left);

  const lowStock = items.filter((i) => Number(i.stock_qty) <= Number(i.min_stock));

  const { data: menus } = await db
    .from('menu_items')
    .select('id, name, available')
    .eq('available', true);
  const menuList = menus || [];

  const suggestions = nearExpiry.map((ing) => {
    const kws = keywords(ing.name);
    const matched = menuList.filter((m) => {
      const mn = m.name.toLowerCase();
      return kws.some((k) => mn.includes(k));
    });
    return {
      ingredient: ing.name, stock: Number(ing.stock_qty), unit: ing.unit,
      expiry_date: ing.expiry_date, days_left: ing.days_left,
      menus: matched.map((m) => ({ id: m.id, name: m.name })),
    };
  });

  return { threshold_days: threshold, near_expiry: nearExpiry, low_stock: lowStock, suggestions, generated_at: new Date().toISOString() };
}

// Format pesan teks untuk notifikasi (WhatsApp/Telegram/Slack)
export function formatAlertMessage(a, merchant) {
  if (!a.near_expiry.length && !a.low_stock.length) return '';
  let msg = `*${merchant || 'Restoran'}* — Peringatan Stok\n`;
  if (a.near_expiry.length) {
    msg += `\n⚠️ Mendekati kadaluarsa (${a.near_expiry.length}):\n`;
    a.near_expiry.forEach((i) => {
      const d = i.days_left;
      const lbl = d < 0 ? `lewat ${Math.abs(d)} hari` : d === 0 ? 'HARI INI' : `${d} hari lagi`;
      msg += `• ${i.name} (${Number(i.stock_qty)} ${i.unit}) — ${lbl}${i.estimated ? ' (estimasi)' : ''}\n`;
    });
  }
  const sugg = a.suggestions.filter((s) => s.menus.length);
  if (sugg.length) {
    msg += `\n💡 Saran Menu of the Day / Promo:\n`;
    sugg.forEach((s) => { msg += `• ${s.ingredient} → ${s.menus.map((m) => m.name).join(', ')}\n`; });
  }
  if (a.low_stock.length) {
    msg += `\n📦 Stok menipis: ${a.low_stock.map((i) => i.name).join(', ')}\n`;
  }
  return msg.trim();
}
