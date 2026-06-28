'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PinGate from '../components/PinGate';
import AlertsPanel from '../components/AlertsPanel';

function rupiah(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function jamWIB(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

const STATIONS = [
  { id: 'shaokao', name: 'Shaokao' },
  { id: 'maincourse', name: 'Maincourse' },
  { id: 'bar', name: 'Bar' },
];

function OwnerInner() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState('today');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch(`/api/owner/summary?range=${range}`);
    const d = await r.json();
    setData(d);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const stat = (label, value, sub) => (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="bold" style={{ fontSize: 22, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted small" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="container">
      <div className="between" style={{ padding: '16px 0' }}>
        <div>
          <h1 className="title">📊 Dashboard Owner</h1>
          <p className="muted small">Pantau penjualan & belanja · auto-refresh 15 detik</p>
        </div>
        <Link href="/" className="btn">← Beranda</Link>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${range === 'today' ? 'btn-brand' : ''}`} onClick={() => setRange('today')}>Hari ini</button>
        <button className={`btn ${range === '7d' ? 'btn-brand' : ''}`} onClick={() => setRange('7d')}>7 hari</button>
      </div>

      <AlertsPanel />

      {loading && <p className="muted">Memuat…</p>}
      {data && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {stat('Omzet (lunas)', rupiah(data.revenue_paid), `${data.paid_count} order lunas`)}
            {stat('Total order', data.orders_count, `${data.unpaid_count} belum bayar`)}
            {stat('Rata-rata/order', rupiah(data.avg_order))}
            {stat('Belanja hari ini', rupiah(data.purchase_value))}
            {data.voids && stat('Void / Batal', `${data.voids.count}×`, rupiah(data.voids.value))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: 12 }}>
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Pembayaran</div>
              <div className="between"><span className="muted">QRIS ({data.payment.qris_count})</span><span className="bold">{rupiah(data.payment.qris)}</span></div>
              <div className="between" style={{ marginTop: 6 }}><span className="muted">Kasir ({data.payment.cashier_count})</span><span className="bold">{rupiah(data.payment.cashier)}</span></div>
            </div>

            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Penjualan per Station</div>
              {STATIONS.map((s) => (
                <div key={s.id} className="between" style={{ marginBottom: 6 }}>
                  <span className="muted">{s.name}</span>
                  <span className="bold">{rupiah(data.per_station[s.id] || 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: 12 }}>
            <div className="card">
              <div className="h2" style={{ marginBottom: 10 }}>Menu Terlaris</div>
              {data.top_items.length === 0 && <p className="muted small" style={{ margin: 0 }}>Belum ada penjualan.</p>}
              {data.top_items.map((it, i) => (
                <div key={i} className="between" style={{ marginBottom: 6 }}>
                  <span><span className="bold">{it.qty}×</span> {it.name}</span>
                  <span className="muted small">{rupiah(it.value)}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ borderColor: data.low_stock.length ? 'var(--red)' : 'var(--line)' }}>
              <div className="between" style={{ marginBottom: 10 }}>
                <div className="h2">Stok Menipis</div>
                <Link href="/stok" className="btn" style={{ padding: '4px 10px', fontSize: 13 }}>Kelola →</Link>
              </div>
              {data.low_stock.length === 0 && <p className="muted small" style={{ margin: 0 }}>Semua stok aman ✓</p>}
              {data.low_stock.map((i) => (
                <div key={i.id} className="between" style={{ marginBottom: 6 }}>
                  <span>{i.name}</span>
                  <span className="badge badge-red">{Number(i.stock_qty)} {i.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {data.voids && (
            <div className="card" style={{ marginTop: 12, borderColor: data.voids.count ? 'var(--red)' : 'var(--line)' }}>
              <div className="between" style={{ marginBottom: 10 }}>
                <div className="h2">🚫 Void / Pembatalan Nota</div>
                <span className="badge badge-red">{data.voids.count}× · {rupiah(data.voids.value)}</span>
              </div>
              {data.voids.count === 0 && <p className="muted small" style={{ margin: 0 }}>Tidak ada pembatalan ✓</p>}
              <div className="col" style={{ gap: 10 }}>
                {data.voids.list.map((v, i) => (
                  <div key={i} className="between" style={{ alignItems: 'flex-start', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {v.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.photo} alt="Foto void" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: 8, background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                      )}
                      <div>
                        <div className="bold">#{v.order_no} · Meja {v.table_number} {v.was_paid && <span className="badge badge-amber" style={{ marginLeft: 4 }}>sudah lunas!</span>}</div>
                        <div className="muted small">{v.void_reason || '(tanpa alasan)'}</div>
                        <div className="muted small">oleh {v.voided_by || '—'} · {jamWIB(v.at)}</div>
                      </div>
                    </div>
                    <span className="bold" style={{ color: '#ff8585', whiteSpace: 'nowrap' }}>{rupiah(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.closures && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="between" style={{ marginBottom: 10 }}>
                <div className="h2">🔒 Penutupan Kasir</div>
                <span className="badge">{data.closures.length}×</span>
              </div>
              {data.closures.length === 0 && <p className="muted small" style={{ margin: 0 }}>Belum ada penutupan kasir.</p>}
              <div className="col" style={{ gap: 10 }}>
                {data.closures.map((c, i) => (
                  <div key={i} className="between" style={{ alignItems: 'flex-start', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {c.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo} alt="Foto tutup kasir" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: 8, background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                      )}
                      <div>
                        <div className="bold">{c.closed_by || '—'}</div>
                        {c.note && <div className="muted small">{c.note}</div>}
                        <div className="muted small">{jamWIB(c.at)}</div>
                      </div>
                    </div>
                    {c.cash_total != null && <span className="bold" style={{ whiteSpace: 'nowrap' }}>{rupiah(c.cash_total)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function OwnerPage() {
  return (
    <PinGate scope="owner" title="Masuk Owner">
      <OwnerInner />
    </PinGate>
  );
}
