'use client';

import { useEffect, useState } from 'react';

// Gerbang PIN untuk halaman staf/owner. scope: 'staff' | 'owner'.
export default function PinGate({ scope = 'staff', title = 'Masuk Staf', children }) {
  const [state, setState] = useState('checking'); // checking | locked | open
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const key = `pin_ok_${scope}`;

  useEffect(() => {
    if (sessionStorage.getItem(key) === '1') { setState('open'); return; }
    fetch(`/api/pin?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => setState(d.required ? 'locked' : 'open'))
      .catch(() => setState('locked'));
  }, [scope, key]);

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, scope }),
      });
      const d = await r.json();
      if (d.ok) { sessionStorage.setItem(key, '1'); setState('open'); }
      else setErr('PIN salah');
    } catch { setErr('Gagal memverifikasi'); }
    finally { setBusy(false); }
  }

  if (state === 'open') return children;
  if (state === 'checking') return <div className="container" style={{ paddingTop: 40 }}><p className="muted">Memuat…</p></div>;

  return (
    <div className="container-sm" style={{ paddingTop: 60 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 320, margin: '0 auto', textAlign: 'center' }}>
        <div className="h2">🔒 {title}</div>
        <p className="muted small" style={{ margin: '6px 0' }}>Masukkan PIN untuk lanjut</p>
        <input
          className="input" type="password" inputMode="numeric" placeholder="PIN"
          style={{ textAlign: 'center', letterSpacing: 6 }}
          value={pin} onChange={(e) => setPin(e.target.value)} autoFocus
        />
        <div className="small" style={{ color: '#ff8585', minHeight: 18, margin: '4px 0' }}>{err}</div>
        <button className="btn btn-brand btn-block" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
      </form>
    </div>
  );
}
