// Estimasi otomatis masa simpan bahan F&B (hari) berdasarkan nama/kategori.
// Rule-based ("AI heuristik") — instan, gratis, offline. Hasilnya ESTIMASI;
// pengguna bisa override via shelf_life_days atau isi expiry_date manual.

// Urutan penting: aturan spesifik di atas.
const RULES = [
  [/\b(beku|frozen)\b/, 60, 'beku ±60 hari'],
  [/\b(arang|charcoal|tusuk|skewer|plastik|tisu|kemasan|gas|sabun|kertas)\b/, null, 'non-bahan / tahan lama'],
  [/\b(tepung|flour|gula|garam|merica|lada|msg|kaldu bubuk|beras|rice)\b/, 365, 'bahan kering ±1 tahun'],
  [/\b(mie|mi|noodle|kwetiau|bihun)\b/, 120, 'mie kering ±120 hari'],
  [/\b(saus|sauce|kecap|minyak|oil|mayo|mayones|sambal|saos|cuka)\b/, 90, 'saus/bumbu botol ±90 hari'],
  [/\b(susu|keju|cheese|butter|mentega|krim|cream|yogurt|yoghurt)\b/, 7, 'produk susu ±7 hari'],
  [/\b(telur|egg)\b/, 14, 'telur ±14 hari'],
  [/\b(smoked|bacon|dendeng|sosis kering|ham)\b/, 14, 'daging awet/asap ±14 hari'],
  [/\b(sosis|bakso|nugget|siomay|otak|chikuwa|odeng|crab stick|crab nugget|salmon ball|fishcake|tempura)\b/, 7, 'olahan dingin ±7 hari'],
  [/\b(udang|cumi|ikan|salmon|tuna|dory|kakap|crab|kepiting|seafood|kerang|scallop)\b/, 2, 'seafood segar ±2 hari'],
  [/\b(jamur|enoki|hioko|shiitake|kuping|salju|tiram|kancing)\b/, 5, 'jamur ±5 hari'],
  [/\b(tahu|tofu)\b/, 3, 'tahu ±3 hari'],
  [/\b(ayam|chicken|bebek|unggas)\b/, 3, 'ayam segar ±3 hari'],
  [/\b(sapi|beef|kambing|domba|daging|karubi|sirloin|tenderloin|saikoro|lidah|tendon|otot|kikil|paru|patty)\b/, 3, 'daging segar ±3 hari'],
  [/\b(sawi|brokoli|kangkung|buncis|jagung|bombay|onion|tomat|cabai|cabe|daun|selada|timun|wortel|kol|kubis|sayur)\b/, 4, 'sayur segar ±4 hari'],
  [/\b(jeruk|lemon|apel|buah|pisang|melon|semangka|nanas)\b/, 5, 'buah ±5 hari'],
];

const CATEGORY_FALLBACK = {
  daging: [3, 'kategori daging ±3 hari'],
  seafood: [2, 'kategori seafood ±2 hari'],
  ayam: [3, 'kategori ayam ±3 hari'],
  sayur: [4, 'kategori sayur ±4 hari'],
  jamur: [5, 'kategori jamur ±5 hari'],
  bumbu: [90, 'kategori bumbu ±90 hari'],
  buah: [5, 'kategori buah ±5 hari'],
  minuman: [180, 'kategori minuman ±180 hari'],
};

// -> { days, basis } | null bila tak bisa diestimasi
export function estimateShelfLife(name, category) {
  const text = `${name || ''} ${category || ''}`.toLowerCase();
  for (const [re, days, basis] of RULES) {
    if (re.test(text)) return days === null ? null : { days, basis };
  }
  const cat = String(category || '').toLowerCase().trim();
  for (const key of Object.keys(CATEGORY_FALLBACK)) {
    if (cat.includes(key)) { const [days, basis] = CATEGORY_FALLBACK[key]; return { days, basis }; }
  }
  return null;
}

// tambah hari ke tanggal (YYYY-MM-DD) -> YYYY-MM-DD
export function addDays(dateStr, days) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const t = Date.UTC(y, (m || 1) - 1, d || 1) + days * 86400000;
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}
