'use client';

import { useEffect, useState } from 'react';

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

const STATUS_LABEL = {
  open: 'Pesanan diterima',
  preparing: 'Sedang disiapkan',
  served: 'Sudah disajikan',
  closed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export default function OrderClient({ initialOrder, items, qrDataUrl, merchant }) {
  const [order, setOrder] = useState(initialOrder);
  const [confirming, setConfirming] = useState(false);

  // Polling status order tiap 5 detik
  useEffect(() => {
    if (order.status === 'closed' || order.status === 'cancelled') return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        const data = await res.json();
        if (res.ok) setOrder(data.order);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [order.id, order.status]);

  const isQris = order.payment_method === 'qris';
  const paid = order.payment_status === 'paid';

  // Simulasi konfirmasi pembayaran QRIS (mode mock tanpa payment gateway).
  // Untuk produksi: pembayaran dikonfirmasi via webhook payment gateway.
  async function confirmQrisPaid() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'paid' }),
      });
      const data = await res.json();
      if (res.ok) setOrder(data.order);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="container-sm" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div className="muted small">{merchant}</div>
      <h1 className="title">Pesanan #{order.order_no}</h1>
      <div className="row" style={{ marginTop: 6 }}>
        <span className="badge">Meja {order.table_number}</span>
        <span className="badge badge-blue">{STATUS_LABEL[order.status] || order.status}</span>
        <span className={`badge ${paid ? 'badge-green' : 'badge-amber'}`}>
          {paid ? 'Lunas' : 'Belum bayar'}
        </span>
      </div>

      {/* Pembayaran */}
      {!paid && isQris && (
        <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
          <div className="h2">Scan untuk bayar (QRIS)</div>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QRIS" style={{ width: 240, height: 240, margin: '12px auto', background: '#fff', borderRadius: 12, padding: 8 }} />
          ) : (
            <p className="muted">QRIS belum dikonfigurasi.</p>
          )}
          <div className="bold" style={{ fontSize: 20 }}>{rupiah(order.total)}</div>
          <p className="muted small" style={{ marginTop: 8 }}>
            Setelah membayar, tekan tombol di bawah untuk konfirmasi.
          </p>
          <button
            className="btn btn-green btn-block"
            style={{ marginTop: 8 }}
            disabled={confirming}
            onClick={confirmQrisPaid}
          >
            {confirming ? 'Memproses…' : 'Saya sudah bayar'}
          </button>
        </div>
      )}

      {!paid && !isQris && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="h2">Bayar di Kasir</div>
          <p className="muted small" style={{ marginTop: 6 }}>
            Tunjukkan nomor pesanan <b>#{order.order_no}</b> di kasir untuk
            menyelesaikan pembayaran sejumlah <b>{rupiah(order.total)}</b>.
          </p>
        </div>
      )}

      {paid && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--green)' }}>
          <div className="h2" style={{ color: '#5ee996' }}>Pembayaran diterima ✓</div>
          <p className="muted small" style={{ marginTop: 6 }}>
            Pesananmu sedang diproses dapur. Terima kasih!
          </p>
        </div>
      )}

      {/* Rincian */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2" style={{ marginBottom: 10 }}>Rincian Pesanan</div>
        <div className="col">
          {items.map((it) => (
            <div key={it.id} className="between">
              <div>
                <span className="bold">{it.qty}×</span> {it.name}
                {it.note && <div className="muted small">“{it.note}”</div>}
              </div>
              <span>{rupiah(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <hr className="hr" />
        <div className="between"><span className="muted">Subtotal</span><span>{rupiah(order.subtotal)}</span></div>
        {order.tax > 0 && (
          <div className="between" style={{ marginTop: 6 }}>
            <span className="muted">Pajak</span><span>{rupiah(order.tax)}</span>
          </div>
        )}
        <hr className="hr" />
        <div className="between"><span className="bold">Total</span><span className="bold">{rupiah(order.total)}</span></div>
      </div>
    </div>
  );
}
