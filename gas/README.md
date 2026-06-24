# F&B Order System — Versi Google Apps Script + Google Sheets

Versi ini **tidak butuh server sendiri**. Backend = **Google Apps Script**,
database = **Google Spreadsheet**, storage = **Google Drive** (otomatis).
Gratis, dan dikelola lewat akun Google biasa.

> ⚠️ Catatan: versi ini **butuh internet** (Apps Script & Sheets adalah layanan
> cloud Google). Kalau butuh benar-benar offline / jaringan lokal saja, gunakan
> pendekatan server lokal (lihat README utama di root repo).

## Isi folder
| File | Fungsi |
|------|--------|
| `Code.gs` | **SATU file berisi semua** — backend + semua halaman (Menu, Order, Kitchen, Print, Cashier, Admin) sudah digabung di dalamnya |
| `appsscript.json` | Manifest (timezone, akses web app) — **opsional** |

> ✅ **Cukup tempel 1 file (`Code.gs`).** Tidak perlu lagi membuat file HTML
> satu per satu — semua halaman sudah ada di dalam `Code.gs`.

## Cara deploy (langkah demi langkah)

1. **Buat Spreadsheet baru** di Google Drive (beri nama mis. "FNB DB").
2. Menu **Extensions → Apps Script**. Editor Apps Script terbuka.
3. **Tempel 1 file saja:**
   - Di editor sudah ada file `Code.gs` (atau `Code`). **Hapus seluruh isi
     bawaannya**, lalu **tempel SELURUH isi `gas/Code.gs`** dari repo ini.
   - Klik **Simpan** (ikon disket / Ctrl+S). Selesai — tidak ada file lain.
   - (Opsional) Untuk set timezone: **Project Settings → centang "Show
     appsscript.json"**, lalu tempel isi `appsscript.json`.
4. Di editor, pilih fungsi **`setup`** lalu klik **Run**. Pertama kali akan
   diminta **otorisasi** — izinkan. Ini membuat tab + data contoh (3 station,
   menu, 3 meja).
5. Klik **Deploy → New deployment → pilih "Web app"**:
   - **Execute as:** Me (akun kamu)
   - **Who has access:** **Anyone** (agar pelanggan bisa pesan tanpa login)
   - **Deploy**, salin **Web app URL** (berakhiran `/exec`).
6. Buka URL itu → halaman beranda. Buka **Admin** untuk cetak QR meja.

> Setiap kali kamu ubah kode, **Deploy → Manage deployments → Edit → New
> version** agar perubahan tampil di URL yang sama.

## Konfigurasi
Edit di tab **Config** pada Spreadsheet:
| key | contoh | arti |
|-----|--------|------|
| `merchant_name` | Restoran Saya | nama yang tampil di menu & struk |
| `tax_percent` | 10 | persen pajak (0 = tanpa pajak) |
| `qris_static` | (kode QRIS) | (opsional) payload QRIS statis merchant kamu |

Jika `qris_static` diisi dengan **kode QRIS statis** dari penyedia
(GoPay/Dana/dll), halaman pembayaran akan menampilkan QR itu. Jika kosong,
ditampilkan QR contoh (mock) untuk uji coba.

## Cara kerja routing 1 printer → 3 station
Tiap menu punya `station_id` (Shaokao / Maincourse / Bar), atau diwarisi dari
kategori. Saat order dibuat, tiap item menyimpan station-nya. Halaman **Print**
mengelompokkan item per station menjadi **struk terpisah dalam satu dokumen**
(dengan penanda potong), sehingga **satu printer dapur** mencetak tiket untuk
**tiga station** sekaligus.

## Alur QR meja
QR berisi: `<WEB_APP_URL>?page=menu&token=<token meja>`. Saat dipindai,
pelanggan langsung masuk ke menu meja tersebut. Cetak QR dari halaman **Admin**.

## ⚠️ Penting: QR & "tidak bisa membuka file"
Web app Apps Script **diblokir Google saat dibuka di in-app browser / webview**
(browser internal di app QR scanner, atau kamera bawaan sebagian HP
Xiaomi/Oppo/Vivo/Samsung). Gejalanya: link **berhasil bila diketik di Chrome**,
tapi **gagal "tidak bisa membuka file" bila discan**.

Ini **batasan Google**, bukan bug kode — halaman Google-nya error sebelum kode
kita jalan, jadi tidak bisa diperbaiki dari sisi aplikasi. Solusi:
- Pelanggan: **scan lalu buka di Chrome/Safari** (ketuk titik tiga → *Buka di
  browser*). Kartu QR yang dicetak sudah memuat petunjuk ini.
- Solusi tuntas (tanpa kendala webview): pakai versi **Next.js + Supabase**
  (folder `app/`) yang halamannya domain biasa dan bisa discan semua HP.

## Batasan & catatan
- Cetak memakai **dialog cetak browser** (bukan langsung ke thermal ESC/POS).
  Untuk printer thermal, arahkan printer default browser ke printer struk.
- Pembayaran QRIS masih **konfirmasi manual** ("Saya sudah bayar"). Untuk
  konfirmasi otomatis butuh payment gateway (di luar lingkup Apps Script murni).
- Apps Script punya kuota harian (cukup untuk skala 1 resto). Untuk volume
  sangat tinggi, pertimbangkan database sungguhan.
