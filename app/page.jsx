import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Home() {
  const links = [
    {
      href: '/owner',
      title: '📊 Dashboard Owner',
      desc: 'Pantau omzet, pembayaran, per station, menu terlaris & stok menipis.',
    },
    {
      href: '/kitchen',
      title: '🍳 Kitchen Display',
      desc: 'Tiket masuk per station (Shaokao, Maincourse, Bar) + cetak 1 printer.',
    },
    {
      href: '/cashier',
      title: '💵 Kasir',
      desc: 'Daftar bill, tandai lunas (QRIS / tunai), tutup meja.',
    },
    {
      href: '/stok',
      title: '📦 Stok & Belanja',
      desc: 'Update stok saat barang datang (tap / scan barcode), opname, low-stock.',
    },
    {
      href: '/admin',
      title: '⚙️ Admin',
      desc: 'Kelola menu, meja, dan cetak QR code meja.',
    },
  ];

  return (
    <div className="container">
      <div style={{ padding: '24px 0' }}>
        <h1 className="title">F&amp;B Order System</h1>
        <p className="muted">
          Order via QR di meja · bayar QRIS atau di kasir · cetak dapur otomatis
          ke 3 station.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card" style={{ display: 'block' }}>
            <div className="h2">{l.title}</div>
            <p className="muted small" style={{ margin: '8px 0 0' }}>{l.desc}</p>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Alur singkat</div>
        <ol className="muted small" style={{ lineHeight: 1.8 }}>
          <li>Pelanggan scan QR di meja → buka menu → pesan.</li>
          <li>Pilih bayar <b>QRIS</b> (langsung) atau <b>bayar di kasir</b>.</li>
          <li>Pesanan otomatis dirouting &amp; dicetak ke station yang sesuai.</li>
          <li>Kasir menutup bill saat selesai.</li>
        </ol>
        <p className="small muted" style={{ marginTop: 8 }}>
          Buka <b>/admin</b> untuk cetak QR meja dan menambah menu. Jalankan{' '}
          <code>schema.sql</code> di Supabase dulu untuk data awal.
        </p>
      </div>
    </div>
  );
}
