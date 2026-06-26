import QRCode from 'qrcode';
import { supabaseServer } from '../../../lib/supabaseServer';
import { buildDynamicQris } from '../../../lib/qris';
import OrderClient from './OrderClient';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }) {
  const { id } = await params;
  const db = supabaseServer();

  const { data: order } = await db.from('orders').select('*').eq('id', id).single();

  if (!order) {
    return (
      <div className="container-sm" style={{ paddingTop: 48 }}>
        <div className="card">
          <h1 className="title">Order tidak ditemukan</h1>
        </div>
      </div>
    );
  }

  const { data: items } = await db
    .from('order_items')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  // Generate QRIS untuk pembayaran. Jika ada payload statis merchant,
  // ubah jadi DINAMIS (nominal = total order). Jika tidak, pakai mock.
  let qrDataUrl = null;
  let qrisDynamic = false;
  if (order.payment_method === 'qris') {
    const staticQris = process.env.NEXT_PUBLIC_QRIS_STATIC;
    let payload;
    if (staticQris) {
      payload = buildDynamicQris(staticQris, order.total);
      qrisDynamic = true;
    } else {
      payload = `QRIS|MERCHANT:${process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran'}|ORDER:${order.order_no}|AMOUNT:${order.total}`;
    }
    qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 1 });
  }

  return (
    <OrderClient
      initialOrder={order}
      items={items || []}
      qrDataUrl={qrDataUrl}
      qrisDynamic={qrisDynamic}
      merchant={process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran'}
    />
  );
}
