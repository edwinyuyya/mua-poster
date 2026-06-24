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
| `Code.gs` | Backend: routing web app + semua fungsi `apiXxx` + akses Sheets |
| `Styles.html` | CSS + helper JS bersama |
| `Home.html` | Halaman beranda (link kitchen/kasir/admin) |
| `Menu.html` | Menu pelanggan (scan QR meja) |
| `Order.html` | Status pesanan + QRIS / info bayar kasir |
| `Kitchen.html` | Layar dapur per station |
| `Print.html` | Cetak 1 dokumen → 3 struk station |
| `Cashier.html` | Kasir: konfirmasi bayar, tutup bill |
| `Admin.html` | Kelola meja + QR, kelola menu |
| `appsscript.json` | Manifest (timezone, akses web app) |

## Cara deploy (langkah demi langkah)

1. **Buat Spreadsheet baru** di Google Drive (beri nama mis. "FNB DB").
2. Menu **Extensions → Apps Script**. Editor Apps Script terbuka.
3. **Salin semua file** dari folder `gas/` ke project Apps Script:
   - Buat file `Code.gs` → tempel isi `Code.gs`.
   - Untuk tiap `*.html`: **+ → HTML**, beri nama **persis** (mis. `Menu`,
     `Styles`, `Home`, `Order`, `Kitchen`, `Print`, `Cashier`, `Admin`),
     lalu tempel isinya.
   - (Opsional) Aktifkan manifest: **Project Settings → centang "Show
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

## Batasan & catatan
- Cetak memakai **dialog cetak browser** (bukan langsung ke thermal ESC/POS).
  Untuk printer thermal, arahkan printer default browser ke printer struk.
- Pembayaran QRIS masih **konfirmasi manual** ("Saya sudah bayar"). Untuk
  konfirmasi otomatis butuh payment gateway (di luar lingkup Apps Script murni).
- Apps Script punya kuota harian (cukup untuk skala 1 resto). Untuk volume
  sangat tinggi, pertimbangkan database sungguhan.
