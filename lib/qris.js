// QRIS: ubah payload statis merchant menjadi dinamis (nominal terisi otomatis)
// dengan menghitung ulang CRC16-CCITT (FALSE). Terverifikasi terhadap QRIS BCA.

export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// staticPayload: string QRIS statis merchant (diawali "0002...")
// amount: nominal (rupiah, tanpa desimal)
export function buildDynamicQris(staticPayload, amount) {
  let p = String(staticPayload || '');
  if (!p) return '';
  const amt = String(Math.round(Number(amount) || 0));
  if (!amt || amt === '0') return p;
  // static (010211) -> dynamic (010212)
  p = p.replace('010211', '010212');
  // sisipkan tag 54 (nominal) sebelum tag 58 (negara)
  const lenStr = String(amt.length).padStart(2, '0');
  const tag54 = '54' + lenStr + amt;
  const idx = p.indexOf('5802');
  if (idx >= 0) p = p.slice(0, idx) + tag54 + p.slice(idx);
  // buang CRC lama, hitung ulang
  const ci = p.lastIndexOf('6304');
  if (ci >= 0) p = p.slice(0, ci);
  p = p + '6304';
  return p + crc16(p);
}
