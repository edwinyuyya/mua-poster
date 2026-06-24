// Utilitas format & konstanta bersama

export const STATIONS = {
  shaokao: 'Station Shaokao',
  maincourse: 'Station Maincourse',
  bar: 'Bar Minuman',
};

export const TAX_PERCENT = Number(process.env.NEXT_PUBLIC_TAX_PERCENT || 0);

export function rupiah(n) {
  const v = Number(n || 0);
  return 'Rp ' + v.toLocaleString('id-ID');
}

// Hitung subtotal, pajak, total dari daftar item {price, qty}
export function calcTotals(items, taxPercent = TAX_PERCENT) {
  const subtotal = items.reduce(
    (s, it) => s + Number(it.price) * Number(it.qty),
    0
  );
  const tax = Math.round((subtotal * taxPercent) / 100);
  return { subtotal, tax, total: subtotal + tax };
}
