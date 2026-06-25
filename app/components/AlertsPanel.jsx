'use client';

import { useEffect, useState } from 'react';

function expLabel(d) {
  if (d < 0) return { text: `Lewat ${Math.abs(d)} hari`, cls: 'badge-red' };
  if (d === 0) return { text: 'Kadaluarsa HARI INI', cls: 'badge-red' };
  if (d === 1) return { text: 'Besok', cls: 'badge-red' };
  return { text: `${d} hari lagi`, cls: 'badge-amber' };
}

// Panel alert bahan mendekati kadaluarsa + saran menu. compact: tampilan ringkas.
export default function AlertsPanel({ compact = false }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () => fetch('/api/alerts').then((r) => r.json()).then((d) => { if (!stop) setData(d); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  if (!data) return null;
  const near = data.near_expiry || [];
  const sugg = (data.suggestions || []).filter((s) => s.menus.length > 0);

  if (near.length === 0) {
    if (compact) return null;
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="h2">⏰ Kadaluarsa</div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>Tidak ada bahan yang mendekati kadaluarsa ✓</p>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginBottom: 12 }}>
      <div className="card" style={{ borderColor: 'var(--red)' }}>
        <div className="h2" style={{ marginBottom: 8 }}>⚠️ Mendekati Kadaluarsa ({near.length})</div>
        {near.map((i) => {
          const l = expLabel(i.days_left);
          return (
            <div key={i.id} className="between" style={{ marginBottom: 6 }}>
              <span>
                {i.name} <span className="muted small">· {Number(i.stock_qty)} {i.unit}</span>
                {i.estimated && <span className="muted small" title={i.basis || ''}> · estimasi</span>}
              </span>
              <span className={`badge ${l.cls}`}>{l.text}</span>
            </div>
          );
        })}
      </div>

      {sugg.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--brand2)' }}>
          <div className="h2" style={{ marginBottom: 8 }}>💡 Saran Menu of the Day / Promo</div>
          <p className="muted small" style={{ margin: '0 0 8px' }}>Pakai bahan yang mau habis masa simpan jadi promo:</p>
          {sugg.map((s, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div className="small"><b>{s.ingredient}</b> <span className="muted">({s.days_left < 0 ? 'lewat' : s.days_left + ' hari lagi'})</span></div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {s.menus.map((m) => (
                  <span key={m.id} className="badge badge-amber">{m.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
