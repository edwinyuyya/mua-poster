import QRCode from 'qrcode';
import { supabaseServer } from '../../../../lib/supabaseServer';
import QrPrintButton from './QrPrintButton';

export const dynamic = 'force-dynamic';

export default async function QrCardPage({ params }) {
  const { token } = await params;
  const db = supabaseServer();

  const { data: table } = await db
    .from('tables')
    .select('table_number, token')
    .eq('token', token)
    .single();

  if (!table) {
    return <div className="container-sm" style={{ paddingTop: 40 }}><div className="card">Meja tidak ditemukan.</div></div>;
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const link = `${base}/menu/${table.token}`;
  const dataUrl = await QRCode.toDataURL(link, { width: 360, margin: 1 });
  const merchant = process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran';

  return (
    <div className="container-sm" style={{ paddingTop: 16 }}>
      <QrPrintButton />
      <div
        className="ticket"
        style={{ width: 320, padding: 20, fontFamily: 'system-ui, sans-serif' }}
      >
        <h3 style={{ fontSize: 18 }}>{merchant}</h3>
        <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, margin: '4px 0' }}>
          MEJA {table.table_number}
        </div>
        <div style={{ textAlign: 'center', margin: '8px 0' }}>Scan untuk lihat menu &amp; pesan</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR meja" style={{ width: 280, height: 280, display: 'block', margin: '0 auto' }} />
        <div style={{ textAlign: 'center', fontSize: 11, marginTop: 8, wordBreak: 'break-all' }}>{link}</div>
      </div>
      {!base && (
        <p className="muted small no-print" style={{ marginTop: 10 }}>
          Catatan: <code>NEXT_PUBLIC_BASE_URL</code> belum diisi, jadi link QR memakai
          path relatif. Isi di environment untuk URL absolut yang bisa discan.
        </p>
      )}
    </div>
  );
}
