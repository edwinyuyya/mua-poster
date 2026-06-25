'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PinGate from '../components/PinGate';
import BarcodeScanner from './BarcodeScanner';

function rupiah(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
const UNITS = ['pcs', 'kg', 'gram', 'pack', 'liter', 'ikat', 'box'];

function StokInner() {
  const [tab, setTab] = useState('receive'); // receive | stock | add
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch('/api/inventory');
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="between" style={{ padding: '16px 0' }}>
        <div>
          <h1 className="title">📦 Stok & Belanja</h1>
          <p className="muted small">Update stok saat barang datang — cepat, satu tangan</p>
        </div>
        <Link href="/" className="btn">← Beranda</Link>
      </div>

      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'receive' ? 'btn-brand' : ''}`} onClick={() => setTab('receive')}>📥 Barang Datang</button>
        <button className={`btn ${tab === 'stock' ? 'btn-brand' : ''}`} onClick={() => setTab('stock')}>Daftar Stok</button>
        <button className={`btn ${tab === 'add' ? 'btn-brand' : ''}`} onClick={() => setTab('add')}>+ Barang</button>
      </div>

      {loading ? <p className="muted">Memuat…</p> : (
        <>
          {tab === 'receive' && <Receive items={items} reload={load} />}
          {tab === 'stock' && <StockList items={items} reload={load} />}
          {tab === 'add' && <AddItem reload={load} onDone={() => setTab('stock')} />}
        </>
      )}
    </div>
  );
}

/* ---------- Barang Datang (receiving) ---------- */
function Receive({ items, reload }) {
  const [q, setQ] = useState('');
  const [cart, setCart] = useState({}); // id -> qty
  const [exp, setExp] = useState({});   // id -> tanggal kadaluarsa (opsional)
  const [scan, setScan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => !s || i.name.toLowerCase().includes(s) || (i.category || '').toLowerCase().includes(s));
  }, [items, q]);

  const add = (id, d) => setCart((c) => {
    const n = Math.max(0, (Number(c[id]) || 0) + d);
    const copy = { ...c }; if (n === 0) delete copy[id]; else copy[id] = n; return copy;
  });
  const setQty = (id, v) => setCart((c) => {
    const n = Math.max(0, Number(v) || 0); const copy = { ...c }; if (n === 0) delete copy[id]; else copy[id] = n; return copy;
  });

  function onScan(code) {
    setScan(false);
    const it = items.find((i) => i.barcode && String(i.barcode) === String(code));
    if (it) { add(it.id, 1); setMsg(`+1 ${it.name}`); setTimeout(() => setMsg(''), 1500); }
    else { setQ(code); setMsg('Barcode belum terdaftar. Cari/daftarkan di Daftar Stok.'); setTimeout(() => setMsg(''), 3000); }
  }

  const lines = Object.entries(cart).filter(([, v]) => v > 0);
  const totalQty = lines.reduce((s, [, v]) => s + Number(v), 0);

  async function save() {
    if (!lines.length) return;
    setSaving(true);
    const payload = { action: 'receive', items: lines.map(([id, qty]) => ({ item_id: id, qty, expiry_date: exp[id] || undefined })) };
    const r = await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) { setCart({}); setExp({}); setMsg('Stok diperbarui ✓'); await reload(); setTimeout(() => setMsg(''), 2000); }
    setSaving(false);
  }

  return (
    <div className="col" style={{ paddingBottom: 90 }}>
      <div className="row">
        <input className="input" placeholder="Cari barang…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setScan(true)}>📷 Scan</button>
      </div>
      {msg && <div className="card" style={{ padding: '8px 12px' }}><span className="small">{msg}</span></div>}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {filtered.map((it) => {
          const inCart = Number(cart[it.id]) || 0;
          return (
            <div key={it.id} className="card" style={inCart ? { borderColor: 'var(--green)' } : null}>
              <div className="between">
                <div>
                  <div className="bold">{it.name}</div>
                  <div className="muted small">Stok: {Number(it.stock_qty)} {it.unit}{it.category ? ` · ${it.category}` : ''}</div>
                </div>
                <span className="badge">{it.unit}</span>
              </div>
              <div className="row" style={{ marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => add(it.id, 1)} style={{ fontSize: 16, fontWeight: 800 }}>+1</button>
                <button className="btn" onClick={() => add(it.id, 5)} style={{ fontSize: 16, fontWeight: 800 }}>+5</button>
                <input className="input" type="number" inputMode="decimal" style={{ width: 90 }} placeholder="qty"
                  value={inCart || ''} onChange={(e) => setQty(it.id, e.target.value)} />
                {inCart > 0 && <button className="btn" onClick={() => add(it.id, -1)}>−</button>}
              </div>
              {inCart > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="small bold" style={{ color: '#5ee996' }}>Akan ditambah: +{inCart} {it.unit}</div>
                  <div className="row" style={{ alignItems: 'center', marginTop: 6 }}>
                    <span className="muted small">Kadaluarsa:</span>
                    <input className="input" type="date" style={{ width: 'auto' }}
                      value={exp[it.id] || ''} onChange={(e) => setExp((x) => ({ ...x, [it.id]: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Tidak ada barang. Tambah di tab “+ Barang”.</p></div>}
      </div>

      {totalQty > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'var(--bg)', borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
          <div className="container" style={{ padding: 0 }}>
            <button className="btn btn-green btn-block" disabled={saving} onClick={save}>
              {saving ? 'Menyimpan…' : `Simpan Barang Datang · ${lines.length} item`}
            </button>
          </div>
        </div>
      )}

      {scan && <BarcodeScanner onDetected={onScan} onClose={() => setScan(false)} />}
    </div>
  );
}

/* ---------- Daftar Stok ---------- */
function StockList({ items, reload }) {
  const [edit, setEdit] = useState(null);
  async function adjust(it, mode) {
    const label = mode === 'set' ? `Set stok ${it.name} jadi berapa?` : `Pakai/keluar berapa ${it.unit} ${it.name}?`;
    const v = prompt(label, mode === 'set' ? String(it.stock_qty) : '');
    if (v === null) return;
    await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'adjust', item_id: it.id, mode, qty: Number(v) }) });
    reload();
  }
  async function del(it) {
    if (!confirm(`Hapus ${it.name}?`)) return;
    await fetch(`/api/inventory/${it.id}`, { method: 'DELETE' });
    reload();
  }
  return (
    <div className="col">
      {items.map((it) => {
        const low = Number(it.stock_qty) <= Number(it.min_stock);
        return (
          <div key={it.id} className="card" style={low ? { borderColor: 'var(--red)' } : null}>
            <div className="between">
              <div>
                <span className="bold">{it.name}</span>
                {it.category && <span className="muted small"> · {it.category}</span>}
                <div className="muted small">Min: {Number(it.min_stock)} {it.unit} · Beli {rupiah(it.cost_price)}/{it.unit}{it.supplier ? ` · ${it.supplier}` : ''}{it.barcode ? ` · 🏷️${it.barcode}` : ''}</div>
              </div>
              <span className={`badge ${low ? 'badge-red' : 'badge-green'}`}>{Number(it.stock_qty)} {it.unit}</span>
            </div>
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => adjust(it, 'set')}>Opname (set)</button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => adjust(it, 'out')}>Pakai (−)</button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => setEdit(it)}>Edit</button>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => del(it)}>Hapus</button>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Belum ada barang.</p></div>}
      {edit && <EditModal item={edit} onClose={() => setEdit(null)} reload={reload} />}
    </div>
  );
}

function EditModal({ item, onClose, reload }) {
  const [f, setF] = useState({ ...item });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.name, unit: f.unit, category: f.category, min_stock: f.min_stock, cost_price: f.cost_price, supplier: f.supplier, barcode: f.barcode, expiry_date: f.expiry_date || '' }),
    });
    await reload(); setBusy(false); onClose();
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="h2" style={{ marginBottom: 10 }}>Edit Barang</div>
        <div className="col" style={{ gap: 8 }}>
          <input className="input" placeholder="Nama" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="row">
            <select className="select" value={f.unit || 'pcs'} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <input className="input" placeholder="Kategori" value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </div>
          <div className="row">
            <input className="input" type="number" placeholder="Stok minimum" value={f.min_stock ?? ''} onChange={(e) => setF({ ...f, min_stock: e.target.value })} />
            <input className="input" type="number" placeholder="Harga beli" value={f.cost_price ?? ''} onChange={(e) => setF({ ...f, cost_price: e.target.value })} />
          </div>
          <input className="input" placeholder="Supplier" value={f.supplier || ''} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
          <input className="input" placeholder="Barcode (opsional)" value={f.barcode || ''} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
          <label className="muted small">Tanggal kadaluarsa<input className="input" type="date" value={f.expiry_date ? String(f.expiry_date).slice(0, 10) : ''} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-brand btn-block" disabled={busy} onClick={save}>Simpan</button>
          <button className="btn btn-block" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tambah Barang ---------- */
function AddItem({ reload, onDone }) {
  const [f, setF] = useState({ name: '', unit: 'pcs', category: '', stock_qty: '', min_stock: '', cost_price: '', supplier: '', barcode: '', expiry_date: '' });
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  async function save() {
    if (!f.name.trim()) return;
    setBusy(true);
    await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    await reload(); setBusy(false); onDone();
  }
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="h2" style={{ marginBottom: 10 }}>Tambah Barang</div>
      <div className="col" style={{ gap: 8 }}>
        <input className="input" placeholder="Nama barang" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="row">
          <select className="select" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          <input className="input" placeholder="Kategori (mis. Daging)" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        </div>
        <div className="row">
          <input className="input" type="number" placeholder="Stok awal" value={f.stock_qty} onChange={(e) => setF({ ...f, stock_qty: e.target.value })} />
          <input className="input" type="number" placeholder="Stok minimum" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} />
        </div>
        <div className="row">
          <input className="input" type="number" placeholder="Harga beli / satuan" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} />
          <input className="input" placeholder="Supplier" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
        </div>
        <div className="row">
          <input className="input" placeholder="Barcode (opsional)" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
          <button className="btn" onClick={() => setScan(true)}>📷</button>
        </div>
        <label className="muted small">Tanggal kadaluarsa (opsional)
          <input className="input" type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} />
        </label>
      </div>
      <button className="btn btn-brand btn-block" style={{ marginTop: 12 }} disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan Barang'}</button>
      {scan && <BarcodeScanner onDetected={(c) => { setF((x) => ({ ...x, barcode: c })); setScan(false); }} onClose={() => setScan(false)} />}
    </div>
  );
}

export default function StokPage() {
  return (
    <PinGate scope="staff" title="Masuk Staf">
      <StokInner />
    </PinGate>
  );
}
