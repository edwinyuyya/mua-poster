'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

export default function MenuClient({ token, table, categories, items, taxPercent, merchant }) {
  const router = useRouter();
  const [cart, setCart] = useState({}); // { menuId: qty }
  const [notes, setNotes] = useState({}); // { menuId: note }
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [payment, setPayment] = useState('qris');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const itemById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  );

  const grouped = useMemo(() => {
    const byCat = categories.map((c) => ({
      ...c,
      items: items.filter((i) => i.category_id === c.id),
    }));
    const uncategorized = items.filter(
      (i) => !categories.some((c) => c.id === i.category_id)
    );
    if (uncategorized.length)
      byCat.push({ id: 'none', name: 'Lainnya', items: uncategorized });
    return byCat.filter((c) => c.items.length);
  }, [categories, items]);

  const cartLines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ item: itemById[id], qty, note: notes[id] || '' }))
    .filter((l) => l.item);

  const subtotal = cartLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const tax = Math.round((subtotal * taxPercent) / 100);
  const total = subtotal + tax;
  const totalQty = cartLines.reduce((s, l) => s + l.qty, 0);

  function setQty(id, delta) {
    setCart((c) => {
      const next = Math.max(0, (c[id] || 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function submitOrder() {
    setError('');
    if (cartLines.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          customer_name: customerName,
          note: orderNote,
          payment_method: payment,
          items: cartLines.map((l) => ({
            menu_item_id: l.item.id,
            qty: l.qty,
            note: l.note,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan');
      router.push(`/order/${data.order_id}`);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="container-sm" style={{ paddingBottom: 90 }}>
      <header style={{ padding: '16px 0' }}>
        <div className="muted small">{merchant}</div>
        <h1 className="title">Menu · Meja {table.table_number}</h1>
      </header>

      {grouped.map((cat) => (
        <section key={cat.id} style={{ marginBottom: 18 }}>
          <h2 className="h2" style={{ marginBottom: 10 }}>{cat.name}</h2>
          <div className="col">
            {cat.items.map((it) => (
              <div key={it.id} className="card">
                <div className="between">
                  <div style={{ flex: 1 }}>
                    <div className="bold">{it.name}</div>
                    {it.description && (
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {it.description}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>{rupiah(it.price)}</div>
                  </div>
                  <div className="qty">
                    {cart[it.id] > 0 && (
                      <>
                        <button onClick={() => setQty(it.id, -1)}>−</button>
                        <span className="bold">{cart[it.id]}</span>
                      </>
                    )}
                    <button onClick={() => setQty(it.id, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Bar keranjang melayang */}
      {totalQty > 0 && !showCart && (
        <div
          className="sticky-bottom"
          style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20 }}
        >
          <div className="container-sm" style={{ padding: '0 16px' }}>
            <button className="btn btn-brand btn-block" onClick={() => setShowCart(true)}>
              Lihat Keranjang · {totalQty} item · {rupiah(total)}
            </button>
          </div>
        </div>
      )}

      {/* Panel keranjang */}
      {showCart && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            zIndex: 30, display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowCart(false)}
        >
          <div
            className="container-sm"
            style={{
              background: 'var(--bg)', borderTopLeftRadius: 18, borderTopRightRadius: 18,
              maxHeight: '88vh', overflowY: 'auto', width: '100%', paddingBottom: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="between" style={{ padding: '16px 0' }}>
              <h2 className="h2">Keranjang · Meja {table.table_number}</h2>
              <button className="btn" onClick={() => setShowCart(false)}>Tutup</button>
            </div>

            <div className="col">
              {cartLines.map((l) => (
                <div key={l.item.id} className="card">
                  <div className="between">
                    <div className="bold">{l.item.name}</div>
                    <div className="qty">
                      <button onClick={() => setQty(l.item.id, -1)}>−</button>
                      <span className="bold">{l.qty}</span>
                      <button onClick={() => setQty(l.item.id, 1)}>+</button>
                    </div>
                  </div>
                  <div className="between" style={{ marginTop: 6 }}>
                    <span className="muted small">
                      {rupiah(l.item.price)} × {l.qty}
                    </span>
                    <span className="bold">{rupiah(l.item.price * l.qty)}</span>
                  </div>
                  <input
                    className="input"
                    style={{ marginTop: 8 }}
                    placeholder="Catatan (mis. tidak pedas)"
                    value={notes[l.item.id] || ''}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [l.item.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <input
                className="input"
                placeholder="Nama (opsional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <textarea
                className="textarea"
                style={{ marginTop: 8 }}
                placeholder="Catatan untuk seluruh pesanan (opsional)"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div className="between"><span className="muted">Subtotal</span><span>{rupiah(subtotal)}</span></div>
              {taxPercent > 0 && (
                <div className="between" style={{ marginTop: 6 }}>
                  <span className="muted">Pajak {taxPercent}%</span><span>{rupiah(tax)}</span>
                </div>
              )}
              <hr className="hr" />
              <div className="between"><span className="bold">Total</span><span className="bold">{rupiah(total)}</span></div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div className="h2" style={{ marginBottom: 10 }}>Metode Pembayaran</div>
              <div className="col">
                <label className={`btn ${payment === 'qris' ? 'btn-brand' : ''}`} style={{ justifyContent: 'flex-start' }}>
                  <input type="radio" name="pay" checked={payment === 'qris'} onChange={() => setPayment('qris')} />
                  &nbsp;Bayar sekarang via QRIS
                </label>
                <label className={`btn ${payment === 'cashier' ? 'btn-brand' : ''}`} style={{ justifyContent: 'flex-start' }}>
                  <input type="radio" name="pay" checked={payment === 'cashier'} onChange={() => setPayment('cashier')} />
                  &nbsp;Bayar di kasir
                </label>
              </div>
            </div>

            {error && (
              <div className="card" style={{ marginTop: 12, borderColor: 'var(--red)' }}>
                <span style={{ color: '#ff8585' }}>{error}</span>
              </div>
            )}

            <button
              className="btn btn-green btn-block"
              style={{ marginTop: 14 }}
              disabled={submitting}
              onClick={submitOrder}
            >
              {submitting ? 'Memproses…' : `Pesan Sekarang · ${rupiah(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
