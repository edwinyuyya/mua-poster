'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import PinGate from '../components/PinGate';
import FaceCapture from '../components/FaceCapture';

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function CashierPage() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState({});
  const [tab, setTab] = useState('active'); // active | closed
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [cap, setCap] = useState(null); // { mode:'void'|'close', title, onPhoto }

  const load = useCallback(async () => {
    const statuses = tab === 'active'
      ? ['open', 'preparing', 'served']
      : ['closed', 'cancelled'];
    const { data: ords } = await supabase
      .from('orders')
      .select('*')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(50);

    const ids = (ords || []).map((o) => o.id);
    let its = [];
    if (ids.length) {
      const r = await supabase.from('order_items').select('*').in('order_id', ids);
      its = r.data || [];
    }
    const byOrder = {};
    for (const it of its) (byOrder[it.order_id] ||= []).push(it);
    setItems(byOrder);
    setOrders(ords || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function patch(id, body) {
    setBusy(id);
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
    setBusy('');
  }

  // Void/batalkan bill: wajib isi alasan + nama petugas + FOTO WAJAH (anti-curang)
  async function voidBill(o) {
    const reason = prompt(`Batalkan bill #${o.order_no} (Meja ${o.table_number}, ${rupiah(o.total)}).\n\nAlasan pembatalan:`);
    if (reason === null) return; // batal
    if (!reason.trim()) { alert('Alasan wajib diisi.'); return; }
    const by = prompt('Nama/inisial petugas yang membatalkan:') || '';
    // buka kamera; setelah foto diambil, baru proses pembatalan
    setCap({
      mode: 'void',
      title: 'Foto Wajah — Pembatalan',
      onPhoto: async (photo) => {
        await patch(o.id, { status: 'cancelled', void_reason: reason.trim(), voided_by: by.trim(), void_photo: photo });
      },
    });
  }

  // Tutup kasir / akhir shift: wajib foto wajah + hitung kas (untuk pantauan owner)
  async function closeShift() {
    const by = prompt('Nama/inisial kasir yang menutup shift:') || '';
    if (!by.trim()) { alert('Nama kasir wajib diisi.'); return; }
    const cashStr = prompt('Total uang kas di laci (Rp), kosongkan jika tidak dihitung:') || '';
    const note = prompt('Catatan (opsional):') || '';
    setCap({
      mode: 'close',
      title: 'Foto Wajah — Tutup Kasir',
      onPhoto: async (photo) => {
        setBusy('close');
        await fetch('/api/cashier/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            closed_by: by.trim(),
            cash_total: cashStr.replace(/[^0-9]/g, '') || null,
            note: note.trim(),
            photo,
          }),
        });
        setBusy('');
        alert('Kasir berhasil ditutup. Tercatat di Dashboard Owner.');
      },
    });
  }

  async function onPhotoTaken(photo) {
    const fn = cap?.onPhoto;
    setCap(null);
    if (fn) await fn(photo);
  }

  return (
    <div className="container">
      <div className="between" style={{ padding: '16px 0' }}>
        <div>
          <h1 className="title">💵 Kasir</h1>
          <p className="muted small">Konfirmasi pembayaran &amp; tutup bill</p>
        </div>
        <div className="row">
          <button className="btn" disabled={busy === 'close'} onClick={closeShift}>🔒 Tutup Kasir</button>
          <Link href="/" className="btn">← Beranda</Link>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${tab === 'active' ? 'btn-brand' : ''}`} onClick={() => setTab('active')}>Aktif</button>
        <button className={`btn ${tab === 'closed' ? 'btn-brand' : ''}`} onClick={() => setTab('closed')}>Selesai</button>
      </div>

      <FaceCapture
        open={!!cap}
        title={cap?.title}
        onCapture={onPhotoTaken}
        onCancel={() => setCap(null)}
      />

      {loading && <p className="muted">Memuat…</p>}
      {!loading && orders.length === 0 && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Tidak ada data.</p></div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
        {orders.map((o) => {
          const paid = o.payment_status === 'paid';
          return (
            <div key={o.id} className="card">
              <div className="between">
                <div className="bold">#{o.order_no} · Meja {o.table_number}</div>
                <span className={`badge ${paid ? 'badge-green' : 'badge-amber'}`}>
                  {paid ? 'Lunas' : 'Belum bayar'}
                </span>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className="badge badge-blue">{o.status}</span>
                <span className="badge">{o.payment_method === 'qris' ? 'QRIS' : 'Kasir'}</span>
                {o.customer_name && <span className="muted small">{o.customer_name}</span>}
              </div>

              <hr className="hr" />
              <div className="col" style={{ gap: 4 }}>
                {(items[o.id] || []).map((it) => (
                  <div key={it.id} className="between small">
                    <span>{it.qty}× {it.name}</span>
                    <span>{rupiah(it.price * it.qty)}</span>
                  </div>
                ))}
              </div>
              <hr className="hr" />
              <div className="between"><span className="bold">Total</span><span className="bold">{rupiah(o.total)}</span></div>

              {o.status === 'cancelled' && (
                <div className="small" style={{ marginTop: 8, color: '#ff8585' }}>
                  ✖ Dibatalkan{o.voided_by ? ` oleh ${o.voided_by}` : ''}
                  {o.void_reason ? ` — "${o.void_reason}"` : ''}
                </div>
              )}

              {tab === 'active' && (
                <div className="col no-print" style={{ marginTop: 12, gap: 8 }}>
                  {!paid && (
                    <button className="btn btn-green btn-block" disabled={busy === o.id} onClick={() => patch(o.id, { payment_status: 'paid' })}>
                      Tandai Lunas
                    </button>
                  )}
                  <div className="row">
                    <button className="btn btn-block" disabled={busy === o.id} onClick={() => patch(o.id, { status: 'closed' })}>
                      Tutup Bill
                    </button>
                    <button className="btn btn-block" disabled={busy === o.id} onClick={() => voidBill(o)}>
                      Batalkan
                    </button>
                  </div>
                  <Link href={`/kitchen/print/${o.id}`} target="_blank" className="btn btn-block">🖨️ Cetak ulang</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CashierGated() {
  return (
    <PinGate scope="kasir" title="Masuk Kasir">
      <CashierPage />
    </PinGate>
  );
}
