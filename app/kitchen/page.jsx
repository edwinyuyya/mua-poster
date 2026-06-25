'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import PinGate from '../components/PinGate';

const STATIONS = [
  { id: 'shaokao', name: 'Shaokao', cls: 'station-shaokao' },
  { id: 'maincourse', name: 'Maincourse', cls: 'station-maincourse' },
  { id: 'bar', name: 'Bar Minuman', cls: 'station-bar' },
];

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s lalu`;
  const m = Math.floor(s / 60);
  return `${m}m lalu`;
}

function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [pendingPrints, setPendingPrints] = useState({}); // order_id -> print_job
  const [stationFilter, setStationFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: ords } = await supabase
      .from('orders')
      .select('id, order_no, table_number, status, payment_method, payment_status, created_at, note')
      .in('status', ['open', 'preparing', 'served'])
      .order('created_at', { ascending: true });

    const ids = (ords || []).map((o) => o.id);
    let items = [];
    let jobs = [];
    if (ids.length) {
      const r1 = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', ids)
        .neq('kitchen_status', 'served');
      items = r1.data || [];
      const r2 = await supabase
        .from('print_jobs')
        .select('*')
        .in('order_id', ids)
        .eq('status', 'pending');
      jobs = r2.data || [];
    }

    const itemsByOrder = {};
    for (const it of items) (itemsByOrder[it.order_id] ||= []).push(it);

    setOrders(
      (ords || [])
        .map((o) => ({ ...o, items: itemsByOrder[o.id] || [] }))
        .filter((o) => o.items.length)
    );
    setPendingPrints(Object.fromEntries(jobs.map((j) => [j.order_id, j])));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function setItemStatus(itemId, status) {
    await fetch(`/api/order-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_status: status }),
    });
    load();
  }

  const visibleOrders = useMemo(() => {
    if (stationFilter === 'all') return orders;
    return orders
      .map((o) => ({ ...o, items: o.items.filter((i) => i.station_id === stationFilter) }))
      .filter((o) => o.items.length);
  }, [orders, stationFilter]);

  return (
    <div className="container">
      <div className="between" style={{ padding: '16px 0' }}>
        <div>
          <h1 className="title">🍳 Kitchen Display</h1>
          <p className="muted small">Auto-refresh tiap 5 detik · 1 printer untuk 3 station</p>
        </div>
        <Link href="/" className="btn">← Beranda</Link>
      </div>

      <div className="row no-print" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <button
          className={`btn ${stationFilter === 'all' ? 'btn-brand' : ''}`}
          onClick={() => setStationFilter('all')}
        >
          Semua
        </button>
        {STATIONS.map((s) => (
          <button
            key={s.id}
            className={`btn ${stationFilter === s.id ? 'btn-brand' : ''}`}
            onClick={() => setStationFilter(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Memuat…</p>}
      {!loading && visibleOrders.length === 0 && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Belum ada pesanan aktif.</p></div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        {visibleOrders.map((o) => {
          const byStation = STATIONS.map((s) => ({
            ...s,
            items: o.items.filter((i) => i.station_id === s.id),
          })).filter((s) => s.items.length);
          const otherItems = o.items.filter(
            (i) => !STATIONS.some((s) => s.id === i.station_id)
          );

          return (
            <div key={o.id} className="card">
              <div className="between">
                <div>
                  <span className="bold">#{o.order_no}</span> · Meja {o.table_number}
                </div>
                <span className="badge">{timeAgo(o.created_at)}</span>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`badge ${o.payment_status === 'paid' ? 'badge-green' : 'badge-amber'}`}>
                  {o.payment_status === 'paid' ? 'Lunas' : o.payment_method === 'qris' ? 'Nunggu QRIS' : 'Bayar kasir'}
                </span>
                {pendingPrints[o.id] && <span className="badge badge-red">Belum dicetak</span>}
              </div>
              {o.note && <p className="muted small" style={{ marginTop: 6 }}>Catatan: {o.note}</p>}

              <hr className="hr" />

              {byStation.map((s) => (
                <div key={s.id} className={`card ${s.cls}`} style={{ marginBottom: 8, padding: 10 }}>
                  <div className="bold small" style={{ marginBottom: 6 }}>{s.name}</div>
                  {s.items.map((it) => (
                    <div key={it.id} className="between" style={{ marginBottom: 6 }}>
                      <div>
                        <span className="bold">{it.qty}×</span> {it.name}
                        {it.note && <div className="muted small">“{it.note}”</div>}
                        <div>
                          <span className={`badge ${it.kitchen_status === 'ready' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: 10 }}>
                            {it.kitchen_status}
                          </span>
                        </div>
                      </div>
                      <div className="col no-print" style={{ gap: 4 }}>
                        {it.kitchen_status !== 'ready' ? (
                          <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setItemStatus(it.id, 'ready')}>Ready</button>
                        ) : (
                          <button className="btn btn-green" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setItemStatus(it.id, 'served')}>Served</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {otherItems.length > 0 && (
                <div className="card" style={{ marginBottom: 8, padding: 10 }}>
                  <div className="bold small" style={{ marginBottom: 6 }}>Tanpa station</div>
                  {otherItems.map((it) => (
                    <div key={it.id} className="between">
                      <span><span className="bold">{it.qty}×</span> {it.name}</span>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setItemStatus(it.id, 'served')}>Served</button>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href={`/kitchen/print/${o.id}`}
                target="_blank"
                className="btn btn-brand btn-block no-print"
              >
                🖨️ Cetak Dapur (3 station)
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KitchenGated() {
  return (
    <PinGate scope="staff" title="Masuk Staf">
      <KitchenPage />
    </PinGate>
  );
}
