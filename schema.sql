-- Jalankan di Supabase → SQL Editor → New Query

-- Tabel akun MUA
create table accounts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  ig_user_id text not null,
  token text not null,
  created_at timestamp default now()
);

-- Tabel antrian post
create table queue (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references accounts(id) on delete cascade,
  account_name text,
  image_url text not null,
  caption text not null,
  schedule_at timestamp not null,
  status text default 'pending', -- pending | posting | done | failed
  post_id text,
  error_msg text,
  created_at timestamp default now(),
  done_at timestamp
);

-- Index untuk efisiensi query scheduler
create index idx_queue_status_schedule on queue(status, schedule_at);

-- Aktifkan Row Level Security (RLS) - boleh dimatikan untuk simplicity
alter table accounts enable row level security;
alter table queue enable row level security;

-- Policy: allow all (sesuaikan jika mau lebih secure)
create policy "allow all accounts" on accounts for all using (true) with check (true);
create policy "allow all queue" on queue for all using (true) with check (true);
