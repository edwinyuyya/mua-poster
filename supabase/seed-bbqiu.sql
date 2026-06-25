-- ============================================================
--  SEED MENU BBQIU (79 item) untuk Supabase
--  Jalankan SETELAH schema.sql. Mengganti kategori & menu contoh.
-- ============================================================

-- pastikan station ada
insert into stations (id,name,sort_order) values
  ('shaokao','Station Shaokao',1),('maincourse','Station Maincourse',2),('bar','Bar Minuman',3)
  on conflict (id) do nothing;

-- bersihkan menu lama (kalau ada)
delete from menu_items;
delete from categories;

-- kategori
insert into categories (name, station_id, sort_order) values
  ('Sate 3.900', 'shaokao', 1),
  ('Sate 6.900', 'shaokao', 2),
  ('Sate Spesial 9.900', 'shaokao', 3),
  ('Sate Premium 14.900', 'shaokao', 4),
  ('Daging Premium (Grill)', 'maincourse', 5),
  ('Grill & Suki', 'maincourse', 6),
  ('Suki / Steamboat', 'maincourse', 7),
  ('Nasi & Snack', 'maincourse', 8);

-- menu items (join kategori berdasarkan nama)
insert into menu_items (category_id, name, price, station_id, available, sort_order)
select c.id, m.name, m.price, c.station_id, true, m.ord
from (values
  ('Sate 6.900', 'Sate brokoli', 6900, 1),
  ('Sate 6.900', 'jamur hioko', 6900, 2),
  ('Sate 6.900', 'Sate ayam bombay', 6900, 3),
  ('Sate 6.900', 'Bakso ayam', 6900, 4),
  ('Sate 6.900', 'Bakso sapi', 6900, 5),
  ('Sate 6.900', 'Jamur enoki', 6900, 6),
  ('Sate 6.900', 'Jamur kancing', 6900, 7),
  ('Sate 6.900', 'Sate ayam', 6900, 8),
  ('Sate 3.900', 'Buncis', 3900, 9),
  ('Sate 3.900', 'Jagung manis', 3900, 10),
  ('Sate 3.900', 'Bawang bombay', 3900, 11),
  ('Sate 3.900', 'Kulit ayam', 3900, 12),
  ('Sate 3.900', 'Tofu Jepang', 3900, 13),
  ('Sate 3.900', 'Usus ayam', 3900, 14),
  ('Sate 3.900', 'Tahu', 3900, 15),
  ('Sate 3.900', 'Sosis ayam', 3900, 16),
  ('Sate 3.900', 'Sate jamur tiram', 3900, 17),
  ('Sate 3.900', 'Sate sawi sendok', 3900, 18),
  ('Sate 3.900', 'Sate kangkung', 3900, 19),
  ('Sate Premium 14.900', 'Patty', 14900, 20),
  ('Sate Premium 14.900', 'Beef bacon', 14900, 21),
  ('Sate Premium 14.900', 'Smoked beef enoki', 14900, 22),
  ('Sate Premium 14.900', 'Shortplate enoki', 14900, 23),
  ('Sate Premium 14.900', 'Udang jumbo', 14900, 24),
  ('Sate Premium 14.900', 'Saikoro', 14900, 25),
  ('Sate Premium 14.900', 'Sirloin', 14900, 26),
  ('Sate Premium 14.900', 'KAMBING', 14900, 27),
  ('Sate Spesial 9.900', 'Otot sapi', 9900, 28),
  ('Sate Spesial 9.900', 'Smoked beef brokoli', 9900, 29),
  ('Sate Spesial 9.900', 'Sate cumi', 9900, 30),
  ('Sate Spesial 9.900', 'Odeng', 9900, 31),
  ('Sate Spesial 9.900', 'Siomay', 9900, 32),
  ('Sate Spesial 9.900', 'Smoked chicken', 9900, 33),
  ('Sate Spesial 9.900', 'Kikil sapi', 9900, 34),
  ('Sate Spesial 9.900', 'Paru sapi', 9900, 35),
  ('Daging Premium (Grill)', 'Saikoro', 24900, 36),
  ('Daging Premium (Grill)', 'US KARUBI small (sp)', 22900, 37),
  ('Daging Premium (Grill)', 'sirloin small', 22900, 38),
  ('Daging Premium (Grill)', 'Tenderloin small', 22900, 39),
  ('Daging Premium (Grill)', 'CHUCK CREST small', 24900, 40),
  ('Daging Premium (Grill)', 'TENDON small', 22900, 41),
  ('Daging Premium (Grill)', 'LIDAH small', 22900, 42),
  ('Daging Premium (Grill)', 'beef bacon', 22900, 43),
  ('Grill & Suki', 'Crab stick Grill Suki', 14900, 44),
  ('Grill & Suki', 'Beef Patty Grill', 17900, 45),
  ('Grill & Suki', 'Siomay  bikin Grill Suki', 17900, 46),
  ('Grill & Suki', 'Smoked Beef Grill', 17900, 47),
  ('Grill & Suki', 'Sosis Ayam Grill Suki', 14900, 48),
  ('Grill & Suki', 'Sosis Sapi Grill Suki', 19900, 49),
  ('Grill & Suki', 'Dendeng (porsi) Grill', 19900, 50),
  ('Grill & Suki', 'crab nugget Grill Suki', 19900, 51),
  ('Grill & Suki', 'otak2 singapore Grill Suki', 19900, 52),
  ('Grill & Suki', 'salmon ball Grill Suki', 17900, 53),
  ('Grill & Suki', 'chikuwa Grill Suki', 14900, 54),
  ('Grill & Suki', 'bakso sapi Grill Suki', 19900, 55),
  ('Grill & Suki', 'Fillet ayam Grill Suki', 17900, 56),
  ('Grill & Suki', 'Fillet salmon Grill', 19900, 57),
  ('Grill & Suki', 'Fillet Tuna Grill', 17900, 58),
  ('Grill & Suki', 'Fillet dory Grill Suki', 17900, 59),
  ('Grill & Suki', 'Kulit ayam Grill Suki', 17900, 60),
  ('Grill & Suki', 'Udang Grill Suki', 24900, 61),
  ('Grill & Suki', 'Jamur Enoki Grill Suki', 12900, 62),
  ('Grill & Suki', 'Jamur Hioko Grill Suki', 12900, 63),
  ('Grill & Suki', 'Onion Grill', 9900, 64),
  ('Nasi & Snack', 'Nasi', 6900, 65),
  ('Grill & Suki', 'Bakso Kakap Grill Suki', 14900, 66),
  ('Grill & Suki', 'Jagung Manis Grill Suki', 9900, 67),
  ('Suki / Steamboat', 'Brokoli Suki', 19900, 68),
  ('Suki / Steamboat', 'Tofu Suki', 14900, 69),
  ('Suki / Steamboat', 'Jamur Kuping Suki', 12900, 70),
  ('Suki / Steamboat', 'Jamur salju Suki', 12900, 71),
  ('Suki / Steamboat', 'Sawi sendok Suki', 9900, 72),
  ('Suki / Steamboat', 'Sawi Putih Suki', 9900, 73),
  ('Suki / Steamboat', 'Tahu Sutra Suki', 9900, 74),
  ('Nasi & Snack', 'french fries', 12900, 75),
  ('Nasi & Snack', 'french fries brown', 34900, 76),
  ('Nasi & Snack', 'nasi goreng bawang', 24900, 77),
  ('Nasi & Snack', 'soy sauce fried rice', 24900, 78),
  ('Nasi & Snack', 'egg fried rice', 30900, 79)
) as m(cat, name, price, ord)
join categories c on c.name = m.cat;
