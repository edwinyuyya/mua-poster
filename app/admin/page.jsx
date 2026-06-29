'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import PinGate from '../components/PinGate';
import AlertsPanel from '../components/AlertsPanel';

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}
function randToken(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function AdminPage() {
  const [tab, setTab] = useState('tables');
  const [stations, setStations] = useState([]);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const [s, t, c, m] = await Promise.all([
      supabase.from('stations').select('*').order('sort_order'),
      supabase.from('tables').select('*').order('table_number'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order'),
    ]);
    setStations(s.data || []);
    setTables(t.data || []);
    setCategories(c.data || []);
    setItems(m.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="between" style={{ padding: '16px 0' }}>
        <div>
          <h1 className="title">⚙️ Admin</h1>
          <p className="muted small">Kelola meja, QR, dan menu</p>
        </div>
        <Link href="/" className="btn">← Beranda</Link>
      </div>

      <AlertsPanel />

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${tab === 'tables' ? 'btn-brand' : ''}`} onClick={() => setTab('tables')}>Meja &amp; QR</button>
        <button className={`btn ${tab === 'menu' ? 'btn-brand' : ''}`} onClick={() => setTab('menu')}>Menu</button>
      </div>

      {tab === 'tables' && (
        <TablesTab tables={tables} origin={origin} reload={load} />
      )}
      {tab === 'menu' && (
        <MenuTab items={items} categories={categories} stations={stations} reload={load} />
      )}
    </div>
  );
}

function TablesTab({ tables, origin, reload }) {
  const [num, setNum] = useState('');
  const [busy, setBusy] = useState(false);

  async function addTable() {
    if (!num.trim()) return;
    setBusy(true);
    await supabase.from('tables').insert({
      table_number: num.trim(),
      token: randToken(`meja-${num.trim().toLowerCase()}`),
    });
    setNum('');
    await reload();
    setBusy(false);
  }
  async function toggle(t) {
    await supabase.from('tables').update({ active: !t.active }).eq('id', t.id);
    reload();
  }
  async function del(t) {
    if (!confirm(`Hapus meja ${t.table_number}?`)) return;
    await supabase.from('tables').delete().eq('id', t.id);
    reload();
  }

  return (
    <div className="col">
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Tambah Meja</div>
        <div className="row">
          <input className="input" placeholder="Nomor / nama meja (mis. 12)" value={num} onChange={(e) => setNum(e.target.value)} />
          <button className="btn btn-brand" disabled={busy} onClick={addTable}>Tambah</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {tables.map((t) => {
          const link = `${origin}/menu/${t.token}`;
          return (
            <div key={t.id} className="card" style={{ textAlign: 'center' }}>
              <div className="between">
                <span className="bold">Meja {t.table_number}</span>
                <span className={`badge ${t.active ? 'badge-green' : 'badge-red'}`}>{t.active ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              {origin && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/qr?size=220&data=${encodeURIComponent(link)}`}
                  alt={`QR meja ${t.table_number}`}
                  style={{ width: 180, height: 180, margin: '10px auto', background: '#fff', borderRadius: 10, padding: 6 }}
                />
              )}
              <div className="muted small" style={{ wordBreak: 'break-all' }}>{link}</div>
              <div className="row no-print" style={{ marginTop: 10, justifyContent: 'center' }}>
                <Link href={`/admin/qr/${t.token}`} target="_blank" className="btn" style={{ padding: '6px 10px', fontSize: 13 }}>Cetak QR</Link>
                <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => toggle(t)}>{t.active ? 'Nonaktif' : 'Aktif'}</button>
                <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => del(t)}>Hapus</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MenuTab({ items, categories, stations, reload }) {
  const [form, setForm] = useState({ name: '', price: '', category_id: '', station_id: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', category_id: '', station_id: '', description: '' });

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  function startEdit(it) {
    setEditId(it.id);
    setEditForm({
      name: it.name || '',
      price: it.price ?? '',
      category_id: it.category_id || '',
      station_id: it.station_id || '',
      description: it.description || '',
    });
  }
  async function saveEdit(it) {
    if (!editForm.name.trim() || editForm.price === '') return;
    setBusy(true);
    const station = editForm.station_id || (editForm.category_id ? catById[editForm.category_id]?.station_id : null) || null;
    await supabase.from('menu_items').update({
      name: editForm.name.trim(),
      price: Number(editForm.price),
      description: editForm.description.trim() || null,
      category_id: editForm.category_id || null,
      station_id: station,
    }).eq('id', it.id);
    setEditId(null);
    await reload();
    setBusy(false);
  }

  async function addItem() {
    if (!form.name.trim() || !form.price) return;
    setBusy(true);
    const station = form.station_id || (form.category_id ? catById[form.category_id]?.station_id : null) || null;
    await supabase.from('menu_items').insert({
      name: form.name.trim(),
      price: Number(form.price),
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      station_id: station,
      available: true,
    });
    setForm({ name: '', price: '', category_id: '', station_id: '', description: '' });
    await reload();
    setBusy(false);
  }
  async function toggle(it) {
    await supabase.from('menu_items').update({ available: !it.available }).eq('id', it.id);
    reload();
  }
  async function del(it) {
    if (!confirm(`Hapus ${it.name}?`)) return;
    await supabase.from('menu_items').delete().eq('id', it.id);
    reload();
  }
  async function setStation(it, station_id) {
    await supabase.from('menu_items').update({ station_id: station_id || null }).eq('id', it.id);
    reload();
  }

  return (
    <div className="col">
      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>Tambah Menu</div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <input className="input" placeholder="Nama menu" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="number" placeholder="Harga" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <select className="select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">— Kategori —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={form.station_id} onChange={(e) => setForm({ ...form, station_id: e.target.value })}>
            <option value="">Station: ikut kategori</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <input className="input" style={{ marginTop: 10 }} placeholder="Deskripsi (opsional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn btn-brand" style={{ marginTop: 10 }} disabled={busy} onClick={addItem}>Tambah Menu</button>
      </div>

      <div className="col">
        {items.map((it) => (
          <div key={it.id} className="card">
            {editId === it.id ? (
              <div className="col">
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <input className="input" placeholder="Nama menu" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <input className="input" type="number" placeholder="Harga" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                  <select className="select" value={editForm.category_id} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}>
                    <option value="">— Kategori —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="select" value={editForm.station_id} onChange={(e) => setEditForm({ ...editForm, station_id: e.target.value })}>
                    <option value="">Station: ikut kategori</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <input className="input" placeholder="Deskripsi (opsional)" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                <div className="row">
                  <button className="btn btn-brand" disabled={busy} onClick={() => saveEdit(it)}>Simpan</button>
                  <button className="btn" onClick={() => setEditId(null)}>Batal</button>
                </div>
              </div>
            ) : (
              <>
                <div className="between">
                  <div>
                    <span className="bold">{it.name}</span> · {rupiah(it.price)}
                    {it.description && <div className="muted small">{it.description}</div>}
                  </div>
                  <span className={`badge ${it.available ? 'badge-green' : 'badge-red'}`}>{it.available ? 'Tersedia' : 'Habis'}</span>
                </div>
                <div className="row no-print" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <select className="select" style={{ width: 'auto' }} value={it.station_id || ''} onChange={(e) => setStation(it, e.target.value)}>
                    <option value="">Tanpa station</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className="btn btn-brand" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => startEdit(it)}>✏️ Edit</button>
                  <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => toggle(it)}>{it.available ? 'Set habis' : 'Set tersedia'}</button>
                  <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => del(it)}>Hapus</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminGated() {
  return (
    <PinGate scope="admin" title="Masuk Admin">
      <AdminPage />
    </PinGate>
  );
}
