import { supabaseServer } from '../../../lib/supabaseServer';
import MenuClient from './MenuClient';

export const dynamic = 'force-dynamic';

export default async function MenuPage({ params }) {
  const { token } = await params;
  const db = supabaseServer();

  const { data: table } = await db
    .from('tables')
    .select('id, table_number, active')
    .eq('token', token)
    .single();

  if (!table) {
    return (
      <div className="container-sm" style={{ paddingTop: 48 }}>
        <div className="card">
          <h1 className="title">QR tidak valid</h1>
          <p className="muted">
            Meja tidak ditemukan. Silakan minta bantuan staf untuk QR yang benar.
          </p>
        </div>
      </div>
    );
  }

  if (table.active === false) {
    return (
      <div className="container-sm" style={{ paddingTop: 48 }}>
        <div className="card">
          <h1 className="title">Meja tidak aktif</h1>
          <p className="muted">Meja ini sedang dinonaktifkan. Hubungi staf.</p>
        </div>
      </div>
    );
  }

  // Ambil menu + kategori (urut), hanya yang tersedia
  const { data: categories } = await db
    .from('categories')
    .select('id, name, station_id, sort_order')
    .order('sort_order', { ascending: true });

  const { data: items } = await db
    .from('menu_items')
    .select('id, category_id, name, description, price, station_id, image_url, available, sort_order')
    .eq('available', true)
    .order('sort_order', { ascending: true });

  return (
    <MenuClient
      token={token}
      table={table}
      categories={categories || []}
      items={items || []}
      taxPercent={Number(process.env.NEXT_PUBLIC_TAX_PERCENT || 0)}
      merchant={process.env.NEXT_PUBLIC_MERCHANT_NAME || 'Restoran'}
    />
  );
}
