-- ============================================================
--  F&B Ordering System - Skema Database (Supabase / Postgres)
--  Jalankan di Supabase -> SQL Editor -> New Query
-- ============================================================

-- Bersihkan jika ingin reset (hati-hati di produksi)
-- drop table if exists print_jobs, order_items, orders, menu_items, categories, tables, stations cascade;

-- ---------- STATION (dapur & bar) ----------
create table if not exists stations (
  id          text primary key,        -- 'shaokao' | 'maincourse' | 'bar'
  name        text not null,
  sort_order  int  default 0
);

-- ---------- MEJA ----------
create table if not exists tables (
  id           uuid default gen_random_uuid() primary key,
  table_number text not null unique,    -- nomor / nama meja, mis. "12", "VIP-1"
  token        text not null unique,    -- token unik untuk QR di meja
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ---------- KATEGORI MENU ----------
create table if not exists categories (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  station_id  text references stations(id),  -- default station utk item di kategori ini
  sort_order  int  default 0
);

-- ---------- MENU ----------
create table if not exists menu_items (
  id           uuid default gen_random_uuid() primary key,
  category_id  uuid references categories(id) on delete set null,
  name         text not null,
  description  text,
  price        numeric not null default 0,
  station_id   text references stations(id),  -- override station (opsional)
  image_url    text,
  available    boolean default true,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- ---------- ORDER (bill per meja) ----------
create table if not exists orders (
  id             uuid default gen_random_uuid() primary key,
  order_no       serial,
  table_id       uuid references tables(id),
  table_number   text,
  status         text default 'open',      -- open | preparing | served | closed | cancelled
  payment_method text,                      -- 'qris' | 'cashier'
  payment_status text default 'unpaid',     -- unpaid | paid
  subtotal       numeric default 0,
  tax            numeric default 0,
  total          numeric default 0,
  customer_name  text,
  note           text,
  created_at     timestamptz default now(),
  paid_at        timestamptz,
  closed_at      timestamptz,
  cancelled_at   timestamptz,               -- waktu pembatalan (void)
  void_reason    text,                       -- alasan pembatalan
  voided_by      text,                       -- nama/inisial petugas yang membatalkan
  void_photo     text                        -- foto wajah petugas saat void (data URL)
);

-- untuk database yang sudah ada (aman dijalankan ulang):
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists void_reason text;
alter table orders add column if not exists voided_by text;
alter table orders add column if not exists void_photo text;

-- ---------- ITEM PADA ORDER ----------
create table if not exists order_items (
  id             uuid default gen_random_uuid() primary key,
  order_id       uuid references orders(id) on delete cascade,
  menu_item_id   uuid references menu_items(id),
  name           text not null,
  price          numeric not null,
  qty            int not null default 1,
  note           text,
  station_id     text references stations(id),   -- station tujuan cetak
  kitchen_status text default 'queued',          -- queued | printed | preparing | ready | served
  created_at     timestamptz default now()
);

-- ---------- ANTRIAN CETAK DAPUR ----------
create table if not exists print_jobs (
  id         uuid default gen_random_uuid() primary key,
  order_id   uuid references orders(id) on delete cascade,
  status     text default 'pending',   -- pending | printed
  created_at timestamptz default now(),
  printed_at timestamptz
);

-- ---------- INDEX ----------
create index if not exists idx_orders_status   on orders(status);
create index if not exists idx_order_items_ord on order_items(order_id);
create index if not exists idx_order_items_st  on order_items(station_id, kitchen_status);
create index if not exists idx_print_jobs_st   on print_jobs(status, created_at);

-- ============================================================
--  RLS (allow-all utk MVP; perketat utk produksi)
-- ============================================================
alter table stations    enable row level security;
alter table tables      enable row level security;
alter table categories  enable row level security;
alter table menu_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table print_jobs  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['stations','tables','categories','menu_items','orders','order_items','print_jobs']
  loop
    execute format('drop policy if exists "allow all %1$s" on %1$s;', t);
    execute format('create policy "allow all %1$s" on %1$s for all using (true) with check (true);', t);
  end loop;
end $$;

-- Beri izin akses ke role Data API (anon & authenticated).
-- WAJIB: tanpa GRANT ini, PostgREST menyembunyikan tabel -> error 404.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select, update on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select, update on sequences to anon, authenticated;
notify pgrst, 'reload schema';

-- ============================================================
--  SEED DATA (3 station + contoh menu)
-- ============================================================
insert into stations (id, name, sort_order) values
  ('shaokao',    'Station Shaokao',    1),
  ('maincourse', 'Station Maincourse', 2),
  ('bar',        'Bar Minuman',        3)
on conflict (id) do nothing;

-- Kategori
insert into categories (name, station_id, sort_order) values
  ('Shaokao (Sate Bakar)', 'shaokao',    1),
  ('Main Course',          'maincourse', 2),
  ('Minuman',              'bar',        3)
on conflict do nothing;

-- Contoh menu (ambil category_id dinamis)
insert into menu_items (category_id, name, description, price, station_id, sort_order)
select c.id, m.name, m.description, m.price, c.station_id, m.sort_order
from (values
  ('Shaokao (Sate Bakar)', 'Sate Daging Sapi',   'Tusuk sapi bumbu cumin',          15000, 1),
  ('Shaokao (Sate Bakar)', 'Sate Ayam Pedas',    'Tusuk ayam saus pedas',           12000, 2),
  ('Shaokao (Sate Bakar)', 'Sate Jamur Enoki',   'Enoki bakar bumbu shaokao',       10000, 3),
  ('Main Course',          'Nasi Goreng Spesial','Nasi goreng + telur + ayam',      28000, 1),
  ('Main Course',          'Mie Goreng Seafood', 'Mie goreng udang & cumi',         32000, 2),
  ('Main Course',          'Ayam Kungpao + Nasi','Ayam kungpao pedas manis',        30000, 3),
  ('Minuman',              'Es Teh Manis',       'Teh manis dingin',                 8000, 1),
  ('Minuman',              'Es Jeruk',           'Jeruk peras segar',               12000, 2),
  ('Minuman',              'Lemon Tea',          'Teh lemon dingin',                14000, 3)
) as m(cat, name, description, price, sort_order)
join categories c on c.name = m.cat
on conflict do nothing;

-- Contoh meja
insert into tables (table_number, token) values
  ('1',  'meja-1-' || substr(md5(random()::text),1,8)),
  ('2',  'meja-2-' || substr(md5(random()::text),1,8)),
  ('VIP-1', 'meja-vip1-' || substr(md5(random()::text),1,8))
on conflict (table_number) do nothing;

-- ============================================================
--  INVENTORY / STOK & BELANJA BARANG
-- ============================================================
create table if not exists inventory_items (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  unit        text default 'pcs',        -- satuan: pcs | kg | gram | pack | liter | ikat
  category    text,                       -- mis. Daging, Sayur, Bumbu, Minuman
  stock_qty   numeric default 0,
  min_stock   numeric default 0,          -- ambang stok menipis
  cost_price  numeric default 0,          -- harga beli per satuan
  supplier    text,
  barcode     text,                        -- opsional (untuk scan)
  expiry_date date,                         -- tanggal kadaluarsa (jika diketahui)
  received_date date,                       -- tanggal barang datang / beli
  shelf_life_days numeric,                  -- override masa simpan (hari); kosong = estimasi otomatis
  created_at  timestamptz default now()
);

-- untuk database yang sudah ada (jalankan ulang aman):
alter table inventory_items add column if not exists expiry_date date;
alter table inventory_items add column if not exists received_date date;
alter table inventory_items add column if not exists shelf_life_days numeric;

create table if not exists stock_movements (
  id          uuid default gen_random_uuid() primary key,
  item_id     uuid references inventory_items(id) on delete cascade,
  type        text default 'in',          -- in (barang datang) | out (pemakaian) | adjust (opname)
  qty         numeric not null,
  cost        numeric default 0,          -- nilai belanja (qty * harga beli) untuk tipe 'in'
  note        text,
  created_at  timestamptz default now()
);

create index if not exists idx_inv_barcode on inventory_items(barcode);
create index if not exists idx_stockmov_item on stock_movements(item_id, created_at);
create index if not exists idx_stockmov_date on stock_movements(created_at);

alter table inventory_items enable row level security;
alter table stock_movements enable row level security;
do $$
declare t text;
begin
  foreach t in array array['inventory_items','stock_movements']
  loop
    execute format('drop policy if exists "allow all %1$s" on %1$s;', t);
    execute format('create policy "allow all %1$s" on %1$s for all using (true) with check (true);', t);
  end loop;
end $$;

-- contoh barang (boleh dihapus)
insert into inventory_items (name, unit, category, stock_qty, min_stock, cost_price, supplier) values
  ('Daging Sapi Slice', 'kg', 'Daging', 0, 5, 120000, 'Supplier A'),
  ('Ayam Fillet', 'kg', 'Daging', 0, 5, 35000, 'Supplier A'),
  ('Jamur Enoki', 'pack', 'Sayur', 0, 10, 6000, 'Pasar'),
  ('Tusuk Sate', 'pack', 'Lainnya', 0, 5, 15000, 'Toko Plastik'),
  ('Arang', 'kg', 'Lainnya', 0, 10, 12000, 'Supplier B')
on conflict do nothing;

-- ============================================================
--  PENUTUPAN KASIR / AKHIR SHIFT (dengan foto wajah - keamanan)
-- ============================================================
create table if not exists cashier_closures (
  id          uuid default gen_random_uuid() primary key,
  closed_by   text,                  -- nama/inisial kasir
  cash_total  numeric,               -- total uang kas di laci (opsional)
  note        text,
  photo       text,                  -- foto wajah kasir saat tutup (data URL)
  created_at  timestamptz default now()
);
create index if not exists idx_closures_date on cashier_closures(created_at);

alter table cashier_closures enable row level security;
drop policy if exists "allow all cashier_closures" on cashier_closures;
create policy "allow all cashier_closures" on cashier_closures for all using (true) with check (true);

-- Pastikan tabel baru punya izin Data API + refresh sekali lagi.
grant select, insert, update, delete on inventory_items, stock_movements, cashier_closures to anon, authenticated;
notify pgrst, 'reload schema';
