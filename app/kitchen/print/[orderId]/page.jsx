import { supabaseServer } from '../../../../lib/supabaseServer';
import PrintControls from './PrintControls';

export const dynamic = 'force-dynamic';

const STATIONS = [
  { id: 'shaokao', name: 'STATION SHAOKAO' },
  { id: 'maincourse', name: 'STATION MAINCOURSE' },
  { id: 'bar', name: 'BAR MINUMAN' },
];

function fmtTime(ts) {
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default async function PrintPage({ params }) {
  const { orderId } = await params;
  const db = supabaseServer();

  const { data: order } = await db.from('orders').select('*').eq('id', orderId).single();
  if (!order) {
    return <div className="container-sm" style={{ paddingTop: 40 }}><div className="card">Order tidak ditemukan.</div></div>;
  }

  const { data: items } = await db
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  const { data: jobs } = await db
    .from('print_jobs')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);
  const jobId = jobs?.[0]?.id || null;

  // Kelompokkan item per station (routing cetak)
  const grouped = STATIONS.map((s) => ({
    ...s,
    items: (items || []).filter((i) => i.station_id === s.id),
  }));
  const others = (items || []).filter((i) => !STATIONS.some((s) => s.id === i.station_id));
  if (others.length) grouped.push({ id: 'other', name: 'LAINNYA', items: others });

  const activeStations = grouped.filter((g) => g.items.length);
  const merchant = process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran';

  return (
    <div className="container-sm" style={{ paddingTop: 16 }}>
      <PrintControls jobId={jobId} />

      <p className="muted small no-print" style={{ marginTop: 8 }}>
        Satu dokumen ini berisi {activeStations.length} struk station — printer akan
        mencetak berurutan dengan pemisah potong di antaranya.
      </p>

      {activeStations.map((s, idx) => (
        <div key={s.id}>
          <div className="ticket">
            <h3>{merchant}</h3>
            <h3 style={{ fontSize: 16 }}>{s.name}</h3>
            <div className="line" />
            <div className="item"><span>Order</span><span>#{order.order_no}</span></div>
            <div className="item"><span>Meja</span><span>{order.table_number}</span></div>
            <div className="item"><span>Waktu</span><span>{fmtTime(order.created_at)}</span></div>
            <div className="item">
              <span>Bayar</span>
              <span>{order.payment_status === 'paid' ? 'LUNAS' : (order.payment_method === 'qris' ? 'QRIS' : 'KASIR')}</span>
            </div>
            <div className="line" />
            {s.items.map((it) => (
              <div key={it.id} style={{ marginBottom: 4 }}>
                <div className="item">
                  <span><b>{it.qty}x</b> {it.name}</span>
                </div>
                {it.note && <div style={{ fontStyle: 'italic', paddingLeft: 8 }}>* {it.note}</div>}
              </div>
            ))}
            <div className="line" />
            {order.note && <div>Catatan order: {order.note}</div>}
            <div style={{ textAlign: 'center', marginTop: 6 }}>--- {s.name} ---</div>
          </div>
          {idx < activeStations.length - 1 && (
            <div className="cut no-print">✂ — — — — potong — — — — ✂</div>
          )}
        </div>
      ))}

      {activeStations.length === 0 && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Tidak ada item untuk dicetak.</p></div>
      )}
    </div>
  );
}
