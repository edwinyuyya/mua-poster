/**
 * F&B Order System — Backend (Google Apps Script + Google Sheets)
 * Database: Google Spreadsheet. Storage: Google Drive (otomatis).
 *
 * Cara pakai (SINGLE FILE — cukup tempel file ini saja):
 *  1) Buat Google Spreadsheet baru -> Extensions -> Apps Script.
 *  2) Hapus isi Code.gs bawaan, tempel SELURUH isi file ini. Tidak perlu
 *     membuat file HTML lain — semua halaman sudah ada di dalam sini.
 *  3) Jalankan fungsi  setup  sekali (Run) lalu izinkan akses.
 *  4) Deploy -> New deployment -> Web app -> Execute as: Me,
 *     Who has access: Anyone -> Deploy. Buka URL yang diakhiri /exec.
 */

// ---------- Struktur tab (kolom) ----------
var SHEETS = {
  Config:     ['key', 'value'],
  Stations:   ['id', 'name', 'sort_order'],
  Tables:     ['id', 'table_number', 'token', 'active'],
  Categories: ['id', 'name', 'station_id', 'sort_order'],
  MenuItems:  ['id', 'category_id', 'name', 'description', 'price', 'station_id', 'available', 'sort_order'],
  Orders:     ['id', 'order_no', 'table_number', 'status', 'payment_method', 'payment_status', 'subtotal', 'tax', 'total', 'customer_name', 'note', 'created_at', 'paid_at', 'closed_at'],
  OrderItems: ['id', 'order_id', 'menu_item_id', 'name', 'price', 'qty', 'note', 'station_id', 'kitchen_status', 'created_at'],
};

var STATION_ORDER = ['shaokao', 'maincourse', 'bar'];
var SS_PROP_KEY = 'FNB_SS_ID';

// ============================================================
//  ROUTING WEB APP
// ============================================================
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'home';
  var html = TEMPLATES_[page] || TEMPLATES_.home;
  var t = HtmlService.createTemplate(html);
  t.params = (e && e.parameter) || {};
  t.baseUrl = getBaseUrl_();
  t.config = getConfig_();
  return t.evaluate()
    .setTitle('F&B Order System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return PARTIALS_[name] || '';
}

function getBaseUrl_() {
  try { return ScriptApp.getService().getUrl(); } catch (err) { return ''; }
}

// ============================================================
//  HELPER SPREADSHEET
// ============================================================
function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(SS_PROP_KEY);
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('FNB Order System DB');
  props.setProperty(SS_PROP_KEY, ss.getId());
  return ss;
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (SHEETS[name]) {
    var firstRow = sh.getRange(1, 1, 1, SHEETS[name].length).getValues()[0];
    if (firstRow.join('') === '') {
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function readObjects_(name) {
  var sh = getSheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[r][c];
    if (name !== 'Config' && obj.id === '') continue;
    out.push(obj);
  }
  return out;
}

function append_(name, obj) {
  var sh = getSheet_(name);
  var headers = SHEETS[name];
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

function updateById_(name, id, patch) {
  var sh = getSheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var r = 1; r < values.length; r++) {
    if (values[r][idCol] === id) {
      for (var c = 0; c < headers.length; c++) {
        if (patch[headers[c]] !== undefined) sh.getRange(r + 1, c + 1).setValue(patch[headers[c]]);
      }
      return true;
    }
  }
  return false;
}

function deleteById_(name, id) {
  var sh = getSheet_(name);
  var values = sh.getDataRange().getValues();
  var idCol = values[0].indexOf('id');
  for (var r = values.length - 1; r >= 1; r--) {
    if (values[r][idCol] === id) sh.deleteRow(r + 1);
  }
}

function truthy_(v) { return v === true || String(v).toLowerCase() === 'true'; }

function getConfig_() {
  var rows = readObjects_('Config');
  var o = { merchant_name: 'Restoran', tax_percent: 0 };
  rows.forEach(function (r) { if (r.key !== '') o[r.key] = r.value; });
  o.tax_percent = Number(o.tax_percent) || 0;
  return o;
}

// ============================================================
//  SETUP (jalankan sekali)
// ============================================================
function setup() {
  Object.keys(SHEETS).forEach(function (n) { getSheet_(n); });

  var cfg = getConfig_();
  var cfgRows = readObjects_('Config').map(function (r) { return r.key; });
  if (cfgRows.indexOf('merchant_name') < 0) append_('Config', { key: 'merchant_name', value: 'Restoran Saya' });
  if (cfgRows.indexOf('tax_percent') < 0) append_('Config', { key: 'tax_percent', value: 10 });

  if (readObjects_('Stations').length === 0) {
    append_('Stations', { id: 'shaokao', name: 'Station Shaokao', sort_order: 1 });
    append_('Stations', { id: 'maincourse', name: 'Station Maincourse', sort_order: 2 });
    append_('Stations', { id: 'bar', name: 'Bar Minuman', sort_order: 3 });
  }

  if (readObjects_('Categories').length === 0) {
    var c1 = Utilities.getUuid(), c2 = Utilities.getUuid(), c3 = Utilities.getUuid();
    append_('Categories', { id: c1, name: 'Shaokao (Sate Bakar)', station_id: 'shaokao', sort_order: 1 });
    append_('Categories', { id: c2, name: 'Main Course', station_id: 'maincourse', sort_order: 2 });
    append_('Categories', { id: c3, name: 'Minuman', station_id: 'bar', sort_order: 3 });
    var menu = [
      [c1, 'Sate Daging Sapi', 'Tusuk sapi bumbu cumin', 15000, 'shaokao'],
      [c1, 'Sate Ayam Pedas', 'Tusuk ayam saus pedas', 12000, 'shaokao'],
      [c1, 'Sate Jamur Enoki', 'Enoki bakar bumbu shaokao', 10000, 'shaokao'],
      [c2, 'Nasi Goreng Spesial', 'Nasi goreng + telur + ayam', 28000, 'maincourse'],
      [c2, 'Mie Goreng Seafood', 'Mie goreng udang & cumi', 32000, 'maincourse'],
      [c2, 'Ayam Kungpao + Nasi', 'Ayam kungpao pedas manis', 30000, 'maincourse'],
      [c3, 'Es Teh Manis', 'Teh manis dingin', 8000, 'bar'],
      [c3, 'Es Jeruk', 'Jeruk peras segar', 12000, 'bar'],
      [c3, 'Lemon Tea', 'Teh lemon dingin', 14000, 'bar'],
    ];
    menu.forEach(function (m, i) {
      append_('MenuItems', {
        id: Utilities.getUuid(), category_id: m[0], name: m[1], description: m[2],
        price: m[3], station_id: m[4], available: true, sort_order: i + 1,
      });
    });
  }

  if (readObjects_('Tables').length === 0) {
    ['1', '2', 'VIP-1'].forEach(function (n) {
      append_('Tables', {
        id: Utilities.getUuid(), table_number: n,
        token: 'meja-' + n.toLowerCase() + '-' + Utilities.getUuid().slice(0, 8),
        active: true,
      });
    });
  }
  return 'Setup selesai. Silakan deploy sebagai Web App.';
}

// ============================================================
//  API — dipanggil dari client via google.script.run
// ============================================================
function apiGetMenu(token) {
  var table = readObjects_('Tables').filter(function (t) { return t.token === token; })[0];
  if (!table) return { error: 'Meja tidak ditemukan' };
  if (!truthy_(table.active)) return { error: 'Meja tidak aktif' };

  var categories = readObjects_('Categories').sort(bySort_);
  var items = readObjects_('MenuItems').filter(function (m) { return truthy_(m.available); }).sort(bySort_);
  return {
    table: { table_number: table.table_number, token: table.token },
    categories: categories.map(function (c) { return { id: c.id, name: c.name, station_id: c.station_id }; }),
    items: items.map(function (m) {
      return { id: m.id, category_id: m.category_id, name: m.name, description: m.description, price: Number(m.price) };
    }),
    config: getConfig_(),
  };
}

function apiCreateOrder(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var table = readObjects_('Tables').filter(function (t) { return t.token === payload.token; })[0];
    if (!table) return { error: 'Meja tidak ditemukan' };
    if (!truthy_(table.active)) return { error: 'Meja tidak aktif' };
    if (['qris', 'cashier'].indexOf(payload.payment_method) < 0) return { error: 'Metode bayar tidak valid' };

    var menuById = {};
    readObjects_('MenuItems').forEach(function (m) { menuById[m.id] = m; });
    var catById = {};
    readObjects_('Categories').forEach(function (c) { catById[c.id] = c; });

    var lines = [];
    (payload.items || []).forEach(function (it) {
      var m = menuById[it.menu_item_id];
      if (!m || !truthy_(m.available)) return;
      var qty = Math.max(1, parseInt(it.qty, 10) || 1);
      var station = m.station_id || (catById[m.category_id] ? catById[m.category_id].station_id : '') || '';
      lines.push({
        menu_item_id: m.id, name: m.name, price: Number(m.price), qty: qty,
        note: String(it.note || '').slice(0, 200), station_id: station,
      });
    });
    if (!lines.length) return { error: 'Keranjang kosong' };

    var cfg = getConfig_();
    var subtotal = lines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
    var tax = Math.round(subtotal * cfg.tax_percent / 100);
    var total = subtotal + tax;

    var maxNo = 0;
    readObjects_('Orders').forEach(function (o) { var n = Number(o.order_no) || 0; if (n > maxNo) maxNo = n; });
    var orderNo = maxNo + 1;
    var orderId = Utilities.getUuid();
    var now = new Date().toISOString();

    append_('Orders', {
      id: orderId, order_no: orderNo, table_number: table.table_number, status: 'open',
      payment_method: payload.payment_method, payment_status: 'unpaid',
      subtotal: subtotal, tax: tax, total: total,
      customer_name: String(payload.customer_name || '').slice(0, 80),
      note: String(payload.note || '').slice(0, 300), created_at: now, paid_at: '', closed_at: '',
    });
    lines.forEach(function (l) {
      append_('OrderItems', {
        id: Utilities.getUuid(), order_id: orderId, menu_item_id: l.menu_item_id, name: l.name,
        price: l.price, qty: l.qty, note: l.note, station_id: l.station_id,
        kitchen_status: 'queued', created_at: now,
      });
    });
    return { ok: true, order_id: orderId, order_no: orderNo };
  } finally {
    lock.releaseLock();
  }
}

function apiGetOrder(id) {
  var order = readObjects_('Orders').filter(function (o) { return o.id === id; })[0];
  if (!order) return { error: 'Order tidak ditemukan' };
  var items = readObjects_('OrderItems').filter(function (it) { return it.order_id === id; });
  return { order: cleanOrder_(order), items: items.map(cleanItem_) };
}

function apiUpdateOrder(id, patch) {
  var p = {};
  if (patch.payment_status === 'paid') { p.payment_status = 'paid'; p.paid_at = new Date().toISOString(); }
  if (patch.payment_status === 'unpaid') p.payment_status = 'unpaid';
  if (['open', 'preparing', 'served', 'closed', 'cancelled'].indexOf(patch.status) >= 0) {
    p.status = patch.status;
    if (patch.status === 'closed') p.closed_at = new Date().toISOString();
  }
  if (['qris', 'cashier'].indexOf(patch.payment_method) >= 0) p.payment_method = patch.payment_method;
  if (Object.keys(p).length === 0) return { error: 'Tidak ada perubahan' };
  updateById_('Orders', id, p);
  return apiGetOrder(id);
}

function apiGetKitchen() {
  var active = readObjects_('Orders').filter(function (o) {
    return ['open', 'preparing', 'served'].indexOf(o.status) >= 0;
  }).sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? -1 : 1; });

  var itemsByOrder = {};
  readObjects_('OrderItems').forEach(function (it) {
    if (it.kitchen_status === 'served') return;
    (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(cleanItem_(it));
  });

  return active.map(function (o) {
    return Object.assign(cleanOrder_(o), { items: itemsByOrder[o.id] || [] });
  }).filter(function (o) { return o.items.length; });
}

function apiSetItemStatus(id, status) {
  if (['queued', 'printed', 'preparing', 'ready', 'served'].indexOf(status) < 0) return { error: 'Status tidak valid' };
  updateById_('OrderItems', id, { kitchen_status: status });
  return { ok: true };
}

function apiGetCashier(mode) {
  var statuses = mode === 'closed' ? ['closed', 'cancelled'] : ['open', 'preparing', 'served'];
  var orders = readObjects_('Orders').filter(function (o) { return statuses.indexOf(o.status) >= 0; })
    .sort(function (a, b) { return String(a.created_at) > String(b.created_at) ? -1 : 1; }).slice(0, 60);
  var ids = {};
  orders.forEach(function (o) { ids[o.id] = true; });
  var itemsByOrder = {};
  readObjects_('OrderItems').forEach(function (it) {
    if (ids[it.order_id]) (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(cleanItem_(it));
  });
  return orders.map(function (o) { return Object.assign(cleanOrder_(o), { items: itemsByOrder[o.id] || [] }); });
}

// ----- Admin -----
function apiGetAdmin() {
  return {
    baseUrl: getBaseUrl_(),
    config: getConfig_(),
    stations: readObjects_('Stations').sort(bySort_).map(function (s) { return { id: s.id, name: s.name }; }),
    tables: readObjects_('Tables').map(function (t) {
      return { id: t.id, table_number: t.table_number, token: t.token, active: truthy_(t.active) };
    }),
    categories: readObjects_('Categories').sort(bySort_).map(function (c) {
      return { id: c.id, name: c.name, station_id: c.station_id };
    }),
    items: readObjects_('MenuItems').sort(bySort_).map(function (m) {
      return { id: m.id, name: m.name, price: Number(m.price), description: m.description, category_id: m.category_id, station_id: m.station_id, available: truthy_(m.available) };
    }),
  };
}

function apiAddTable(number) {
  number = String(number || '').trim();
  if (!number) return { error: 'Nomor meja kosong' };
  append_('Tables', {
    id: Utilities.getUuid(), table_number: number,
    token: 'meja-' + number.toLowerCase().replace(/\s+/g, '') + '-' + Utilities.getUuid().slice(0, 8),
    active: true,
  });
  return apiGetAdmin();
}
function apiToggleTable(id) {
  var t = readObjects_('Tables').filter(function (x) { return x.id === id; })[0];
  if (t) updateById_('Tables', id, { active: !truthy_(t.active) });
  return apiGetAdmin();
}
function apiDeleteTable(id) { deleteById_('Tables', id); return apiGetAdmin(); }

function apiAddMenuItem(obj) {
  if (!obj || !String(obj.name || '').trim() || !obj.price) return { error: 'Nama & harga wajib' };
  var station = obj.station_id;
  if (!station && obj.category_id) {
    var cat = readObjects_('Categories').filter(function (c) { return c.id === obj.category_id; })[0];
    station = cat ? cat.station_id : '';
  }
  append_('MenuItems', {
    id: Utilities.getUuid(), category_id: obj.category_id || '', name: String(obj.name).trim(),
    description: String(obj.description || '').trim(), price: Number(obj.price),
    station_id: station || '', available: true, sort_order: 999,
  });
  return apiGetAdmin();
}
function apiToggleMenuItem(id) {
  var m = readObjects_('MenuItems').filter(function (x) { return x.id === id; })[0];
  if (m) updateById_('MenuItems', id, { available: !truthy_(m.available) });
  return apiGetAdmin();
}
function apiDeleteMenuItem(id) { deleteById_('MenuItems', id); return apiGetAdmin(); }
function apiSetItemStation(id, station) { updateById_('MenuItems', id, { station_id: station || '' }); return apiGetAdmin(); }

// ----- util -----
function bySort_(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); }
function cleanOrder_(o) {
  return {
    id: o.id, order_no: Number(o.order_no), table_number: o.table_number, status: o.status,
    payment_method: o.payment_method, payment_status: o.payment_status,
    subtotal: Number(o.subtotal), tax: Number(o.tax), total: Number(o.total),
    customer_name: o.customer_name, note: o.note, created_at: String(o.created_at),
  };
}
function cleanItem_(it) {
  return {
    id: it.id, order_id: it.order_id, name: it.name, price: Number(it.price), qty: Number(it.qty),
    note: it.note, station_id: it.station_id, kitchen_status: it.kitchen_status,
  };
}


// ============================================================
//  HALAMAN HTML (digabung — tidak perlu file terpisah)
// ============================================================
var PARTIALS_ = {
  Styles: "<style>\n  :root{\n    --bg:#0f1115;--card:#1a1d24;--card2:#22262f;--line:#2c313c;--text:#e8eaed;\n    --muted:#9aa3b2;--brand:#ff5a36;--green:#28c46b;--red:#ef4444;--blue:#3b82f6;\n  }\n  *{box-sizing:border-box}\n  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);\n    font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}\n  a{color:inherit;text-decoration:none}\n  .container{max-width:960px;margin:0 auto;padding:16px}\n  .container-sm{max-width:640px;margin:0 auto;padding:16px}\n  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}\n  .row{display:flex;gap:12px;align-items:center}\n  .between{display:flex;justify-content:space-between;align-items:center;gap:12px}\n  .col{display:flex;flex-direction:column;gap:12px}\n  .grid{display:grid;gap:12px}\n  .muted{color:var(--muted)} .small{font-size:13px} .bold{font-weight:700}\n  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--card2);\n    color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:15px;\n    font-weight:600;cursor:pointer;transition:filter .15s}\n  .btn:hover{filter:brightness(1.15)} .btn:disabled{opacity:.5;cursor:not-allowed}\n  .btn-brand{background:var(--brand);border-color:var(--brand);color:#fff}\n  .btn-green{background:var(--green);border-color:var(--green);color:#04210f}\n  .btn-block{width:100%}\n  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;\n    background:var(--card2);border:1px solid var(--line)}\n  .badge-green{background:rgba(40,196,107,.15);color:#5ee996;border-color:transparent}\n  .badge-red{background:rgba(239,68,68,.15);color:#ff8585;border-color:transparent}\n  .badge-amber{background:rgba(255,176,32,.15);color:#ffcf6a;border-color:transparent}\n  .badge-blue{background:rgba(59,130,246,.15);color:#8fbaff;border-color:transparent}\n  .input,.select,.textarea{width:100%;background:var(--card2);color:var(--text);border:1px solid var(--line);\n    border-radius:10px;padding:10px 12px;font-size:15px}\n  .textarea{min-height:70px;resize:vertical}\n  .hr{height:1px;background:var(--line);border:0;margin:12px 0}\n  .qty{display:inline-flex;align-items:center;gap:10px}\n  .qty button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--card2);\n    color:var(--text);font-size:18px;cursor:pointer}\n  .title{font-size:22px;font-weight:800;margin:0} .h2{font-size:17px;font-weight:700;margin:0}\n  .station-shaokao{border-left:4px solid #ff5a36}\n  .station-maincourse{border-left:4px solid #ffb020}\n  .station-bar{border-left:4px solid #3b82f6}\n  @media print{\n    body{background:#fff;color:#000}.no-print{display:none!important}.ticket{page-break-after:always}\n  }\n  .ticket{background:#fff;color:#000;width:280px;margin:0 auto 18px;padding:12px;\n    font-family:'Courier New',monospace;font-size:13px;border:1px dashed #999}\n  .ticket h3{margin:0 0 4px;text-align:center}\n  .ticket .line{border-top:1px dashed #000;margin:6px 0}\n  .ticket .item{display:flex;justify-content:space-between}\n  .cut{text-align:center;color:#888;font-size:11px;margin:4px 0}\n</style>\n<script>\n  // Helper bersama: panggil fungsi server sebagai Promise\n  function call(fn){\n    var args = Array.prototype.slice.call(arguments,1);\n    return new Promise(function(resolve,reject){\n      var runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);\n      runner[fn].apply(runner,args);\n    });\n  }\n  function rupiah(n){ return 'Rp ' + Number(n||0).toLocaleString('id-ID'); }\n  function go(page, params){\n    var url = BASE_URL + '?page=' + page;\n    for(var k in (params||{})) url += '&' + k + '=' + encodeURIComponent(params[k]);\n    window.open(url, '_top');\n  }\n  function esc(s){ return String(s==null?'':s).replace(/[&<>\"]/g,function(c){\n    return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]; }); }\n</script>\n",
};

var TEMPLATES_ = {
  home: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n<div class=\"container\">\n  <div style=\"padding:24px 0\">\n    <h1 class=\"title\">F&amp;B Order System</h1>\n    <p class=\"muted\">Order via QR di meja · bayar QRIS / kasir · cetak dapur ke 3 station · backend Google Sheets</p>\n  </div>\n  <div class=\"grid\" style=\"grid-template-columns:repeat(auto-fit,minmax(240px,1fr))\">\n    <a class=\"card\" onclick=\"go('kitchen')\" style=\"cursor:pointer\">\n      <div class=\"h2\">🍳 Kitchen Display</div>\n      <p class=\"muted small\">Tiket per station + cetak 1 printer untuk 3 station.</p>\n    </a>\n    <a class=\"card\" onclick=\"go('cashier')\" style=\"cursor:pointer\">\n      <div class=\"h2\">💵 Kasir</div>\n      <p class=\"muted small\">Konfirmasi pembayaran &amp; tutup bill.</p>\n    </a>\n    <a class=\"card\" onclick=\"go('admin')\" style=\"cursor:pointer\">\n      <div class=\"h2\">⚙️ Admin</div>\n      <p class=\"muted small\">Kelola menu, meja, &amp; cetak QR meja.</p>\n    </a>\n  </div>\n  <div class=\"card\" style=\"margin-top:16px\">\n    <div class=\"h2\">Alur singkat</div>\n    <ol class=\"muted small\" style=\"line-height:1.8\">\n      <li>Pelanggan scan QR di meja → buka menu → pesan.</li>\n      <li>Pilih bayar <b>QRIS</b> atau <b>bayar di kasir</b>.</li>\n      <li>Pesanan dirouting otomatis &amp; dicetak ke station sesuai.</li>\n      <li>Kasir menutup bill saat selesai.</li>\n    </ol>\n    <p class=\"small muted\">Belum ada data? Jalankan fungsi <b>setup</b> di editor Apps Script, lalu deploy ulang.</p>\n  </div>\n</div>\n</body>\n</html>\n",
  menu: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var PARAMS = <?!= JSON.stringify(params) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container-sm\" id=\"app\" style=\"padding-bottom:90px\">\n  <p class=\"muted\" style=\"padding-top:24px\">Memuat menu…</p>\n</div>\n\n<script>\nvar DATA = null;          // {table, categories, items, config}\nvar CART = {};            // menuId -> qty\nvar NOTES = {};           // menuId -> note\nvar showCart = false;\nvar payment = 'qris';\nvar submitting = false;\n\nvar token = PARAMS.token || '';\n\ncall('apiGetMenu', token).then(function(res){\n  if(res.error){ document.getElementById('app').innerHTML =\n    '<div class=\"card\" style=\"margin-top:40px\"><h1 class=\"title\">QR tidak valid</h1><p class=\"muted\">'+esc(res.error)+'</p></div>'; return; }\n  DATA = res;\n  render();\n}).catch(function(e){\n  document.getElementById('app').innerHTML='<div class=\"card\" style=\"margin-top:40px\"><p class=\"muted\">Gagal memuat. '+esc(e.message||e)+'</p></div>';\n});\n\nfunction itemById(id){ return DATA.items.filter(function(i){return i.id===id;})[0]; }\nfunction cartLines(){\n  return Object.keys(CART).filter(function(id){return CART[id]>0;}).map(function(id){\n    return { item:itemById(id), qty:CART[id], note:NOTES[id]||'' };\n  }).filter(function(l){return l.item;});\n}\nfunction totals(){\n  var lines=cartLines();\n  var subtotal=lines.reduce(function(s,l){return s+l.item.price*l.qty;},0);\n  var taxPercent=Number((DATA.config||{}).tax_percent||0);\n  var tax=Math.round(subtotal*taxPercent/100);\n  return {subtotal:subtotal,tax:tax,total:subtotal+tax,taxPercent:taxPercent,\n    qty:lines.reduce(function(s,l){return s+l.qty;},0)};\n}\nfunction setQty(id,d){\n  var n=Math.max(0,(CART[id]||0)+d);\n  if(n===0) delete CART[id]; else CART[id]=n;\n  render();\n}\n\nfunction render(){\n  var t=totals();\n  var html='';\n  html+='<header style=\"padding:16px 0\"><div class=\"muted small\">'+esc(DATA.config.merchant_name||'Restoran')+'</div>'+\n        '<h1 class=\"title\">Menu · Meja '+esc(DATA.table.table_number)+'</h1></header>';\n\n  var cats=DATA.categories.slice();\n  cats.forEach(function(c){\n    var its=DATA.items.filter(function(i){return i.category_id===c.id;});\n    if(!its.length) return;\n    html+='<section style=\"margin-bottom:18px\"><h2 class=\"h2\" style=\"margin-bottom:10px\">'+esc(c.name)+'</h2><div class=\"col\">';\n    its.forEach(function(it){ html+=itemCard(it); });\n    html+='</div></section>';\n  });\n  var unc=DATA.items.filter(function(i){return !cats.some(function(c){return c.id===i.category_id;});});\n  if(unc.length){ html+='<section style=\"margin-bottom:18px\"><h2 class=\"h2\">Lainnya</h2><div class=\"col\">';\n    unc.forEach(function(it){html+=itemCard(it);}); html+='</div></section>'; }\n\n  if(t.qty>0 && !showCart){\n    html+='<div style=\"position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--bg);border-top:1px solid var(--line);padding:12px 16px\">'+\n          '<button class=\"btn btn-brand btn-block\" onclick=\"openCart()\">Lihat Keranjang · '+t.qty+' item · '+rupiah(t.total)+'</button></div>';\n  }\n  document.getElementById('app').innerHTML=html;\n  if(showCart) renderCart();\n}\n\nfunction itemCard(it){\n  var q=CART[it.id]||0;\n  return '<div class=\"card\"><div class=\"between\"><div style=\"flex:1\">'+\n    '<div class=\"bold\">'+esc(it.name)+'</div>'+\n    (it.description?'<div class=\"muted small\" style=\"margin-top:2px\">'+esc(it.description)+'</div>':'')+\n    '<div style=\"margin-top:6px\">'+rupiah(it.price)+'</div></div>'+\n    '<div class=\"qty\">'+(q>0?'<button onclick=\"setQty(\\''+it.id+'\\',-1)\">−</button><span class=\"bold\">'+q+'</span>':'')+\n    '<button onclick=\"setQty(\\''+it.id+'\\',1)\">+</button></div></div></div>';\n}\n\nfunction openCart(){ showCart=true; render(); }\nfunction closeCart(){ showCart=false; var o=document.getElementById('cartOverlay'); if(o) o.remove(); }\n\nfunction renderCart(){\n  var t=totals(); var lines=cartLines();\n  var el=document.createElement('div');\n  el.id='cartOverlay';\n  el.style='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:30;display:flex;align-items:flex-end';\n  el.onclick=function(e){ if(e.target===el) closeCart(); };\n  var inner='<div class=\"container-sm\" style=\"background:var(--bg);border-top-left-radius:18px;border-top-right-radius:18px;max-height:88vh;overflow-y:auto;width:100%;padding-bottom:24px\" onclick=\"event.stopPropagation()\">';\n  inner+='<div class=\"between\" style=\"padding:16px 0\"><h2 class=\"h2\">Keranjang · Meja '+esc(DATA.table.table_number)+'</h2>'+\n         '<button class=\"btn\" onclick=\"closeCart()\">Tutup</button></div><div class=\"col\">';\n  lines.forEach(function(l){\n    inner+='<div class=\"card\"><div class=\"between\"><div class=\"bold\">'+esc(l.item.name)+'</div>'+\n      '<div class=\"qty\"><button onclick=\"setQty(\\''+l.item.id+'\\',-1)\">−</button><span class=\"bold\">'+l.qty+'</span>'+\n      '<button onclick=\"setQty(\\''+l.item.id+'\\',1)\">+</button></div></div>'+\n      '<div class=\"between\" style=\"margin-top:6px\"><span class=\"muted small\">'+rupiah(l.item.price)+' × '+l.qty+'</span>'+\n      '<span class=\"bold\">'+rupiah(l.item.price*l.qty)+'</span></div>'+\n      '<input class=\"input\" style=\"margin-top:8px\" placeholder=\"Catatan (mis. tidak pedas)\" value=\"'+esc(l.note)+'\" '+\n      'oninput=\"NOTES[\\''+l.item.id+'\\']=this.value\"></div>';\n  });\n  inner+='</div>';\n  inner+='<div class=\"card\" style=\"margin-top:12px\"><input id=\"custName\" class=\"input\" placeholder=\"Nama (opsional)\">'+\n         '<textarea id=\"orderNote\" class=\"textarea\" style=\"margin-top:8px\" placeholder=\"Catatan untuk seluruh pesanan (opsional)\"></textarea></div>';\n  inner+='<div class=\"card\" style=\"margin-top:12px\"><div class=\"between\"><span class=\"muted\">Subtotal</span><span>'+rupiah(t.subtotal)+'</span></div>';\n  if(t.taxPercent>0) inner+='<div class=\"between\" style=\"margin-top:6px\"><span class=\"muted\">Pajak '+t.taxPercent+'%</span><span>'+rupiah(t.tax)+'</span></div>';\n  inner+='<hr class=\"hr\"><div class=\"between\"><span class=\"bold\">Total</span><span class=\"bold\">'+rupiah(t.total)+'</span></div></div>';\n  inner+='<div class=\"card\" style=\"margin-top:12px\"><div class=\"h2\" style=\"margin-bottom:10px\">Metode Pembayaran</div><div class=\"col\">'+\n    '<label class=\"btn '+(payment==='qris'?'btn-brand':'')+'\" style=\"justify-content:flex-start\"><input type=\"radio\" name=\"pay\" '+(payment==='qris'?'checked':'')+' onchange=\"setPay(\\'qris\\')\">&nbsp;Bayar sekarang via QRIS</label>'+\n    '<label class=\"btn '+(payment==='cashier'?'btn-brand':'')+'\" style=\"justify-content:flex-start\"><input type=\"radio\" name=\"pay\" '+(payment==='cashier'?'checked':'')+' onchange=\"setPay(\\'cashier\\')\">&nbsp;Bayar di kasir</label>'+\n    '</div></div>';\n  inner+='<div id=\"cartErr\"></div>';\n  inner+='<button class=\"btn btn-green btn-block\" style=\"margin-top:14px\" id=\"submitBtn\" onclick=\"submitOrder()\">Pesan Sekarang · '+rupiah(t.total)+'</button>';\n  inner+='</div>';\n  el.innerHTML=inner;\n  document.body.appendChild(el);\n}\n\nfunction setPay(p){ payment=p; var o=document.getElementById('cartOverlay'); if(o){o.remove();renderCart();} }\n\nfunction submitOrder(){\n  if(submitting) return;\n  var lines=cartLines();\n  if(!lines.length){ document.getElementById('cartErr').innerHTML='<div class=\"card\" style=\"margin-top:12px;border-color:var(--red)\"><span style=\"color:#ff8585\">Keranjang kosong.</span></div>'; return; }\n  submitting=true;\n  var btn=document.getElementById('submitBtn'); btn.disabled=true; btn.textContent='Memproses…';\n  var payload={ token:token, payment_method:payment,\n    customer_name:(document.getElementById('custName')||{}).value||'',\n    note:(document.getElementById('orderNote')||{}).value||'',\n    items:lines.map(function(l){return {menu_item_id:l.item.id,qty:l.qty,note:l.note};}) };\n  call('apiCreateOrder', payload).then(function(res){\n    if(res.error){ submitting=false; btn.disabled=false; btn.textContent='Pesan Sekarang';\n      document.getElementById('cartErr').innerHTML='<div class=\"card\" style=\"margin-top:12px;border-color:var(--red)\"><span style=\"color:#ff8585\">'+esc(res.error)+'</span></div>'; return; }\n    go('order', {id:res.order_id});\n  }).catch(function(e){ submitting=false; btn.disabled=false; btn.textContent='Pesan Sekarang';\n    document.getElementById('cartErr').innerHTML='<div class=\"card\" style=\"margin-top:12px;border-color:var(--red)\"><span style=\"color:#ff8585\">'+esc(e.message||e)+'</span></div>'; });\n}\n</script>\n</body>\n</html>\n",
  order: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var PARAMS = <?!= JSON.stringify(params) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container-sm\" id=\"app\" style=\"padding-top:16px;padding-bottom:40px\">\n  <p class=\"muted\" style=\"padding-top:24px\">Memuat pesanan…</p>\n</div>\n\n<script>\nvar ORDER=null, ITEMS=[], confirming=false, poll=null;\nvar STATUS_LABEL={open:'Pesanan diterima',preparing:'Sedang disiapkan',served:'Sudah disajikan',closed:'Selesai',cancelled:'Dibatalkan'};\nvar id=PARAMS.id||'';\n\nfunction load(){\n  return call('apiGetOrder', id).then(function(res){\n    if(res.error){ document.getElementById('app').innerHTML='<div class=\"card\" style=\"margin-top:40px\"><h1 class=\"title\">Order tidak ditemukan</h1></div>'; return; }\n    ORDER=res.order; ITEMS=res.items; render();\n  });\n}\nload().then(function(){\n  poll=setInterval(function(){\n    if(!ORDER || ORDER.status==='closed' || ORDER.status==='cancelled'){ clearInterval(poll); return; }\n    load();\n  },5000);\n});\n\nfunction qrisUrl(){\n  var payload = (CONFIG.qris_static && CONFIG.qris_static!=='') ? CONFIG.qris_static :\n    ('QRIS|MERCHANT:'+(CONFIG.merchant_name||'Restoran')+'|ORDER:'+ORDER.order_no+'|AMOUNT:'+ORDER.total);\n  return 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(payload);\n}\n\nfunction render(){\n  var paid=ORDER.payment_status==='paid';\n  var isQris=ORDER.payment_method==='qris';\n  var h='';\n  h+='<div class=\"muted small\">'+esc(CONFIG.merchant_name||'Restoran')+'</div>';\n  h+='<h1 class=\"title\">Pesanan #'+ORDER.order_no+'</h1>';\n  h+='<div class=\"row\" style=\"margin-top:6px\"><span class=\"badge\">Meja '+esc(ORDER.table_number)+'</span>'+\n     '<span class=\"badge badge-blue\">'+esc(STATUS_LABEL[ORDER.status]||ORDER.status)+'</span>'+\n     '<span class=\"badge '+(paid?'badge-green':'badge-amber')+'\">'+(paid?'Lunas':'Belum bayar')+'</span></div>';\n\n  if(!paid && isQris){\n    h+='<div class=\"card\" style=\"margin-top:16px;text-align:center\"><div class=\"h2\">Scan untuk bayar (QRIS)</div>'+\n       '<img src=\"'+qrisUrl()+'\" alt=\"QRIS\" style=\"width:240px;height:240px;margin:12px auto;background:#fff;border-radius:12px;padding:8px\">'+\n       '<div class=\"bold\" style=\"font-size:20px\">'+rupiah(ORDER.total)+'</div>'+\n       '<p class=\"muted small\" style=\"margin-top:8px\">Setelah membayar, tekan tombol di bawah untuk konfirmasi.</p>'+\n       '<button class=\"btn btn-green btn-block\" style=\"margin-top:8px\" id=\"payBtn\" onclick=\"confirmPaid()\">Saya sudah bayar</button></div>';\n  } else if(!paid && !isQris){\n    h+='<div class=\"card\" style=\"margin-top:16px\"><div class=\"h2\">Bayar di Kasir</div>'+\n       '<p class=\"muted small\" style=\"margin-top:6px\">Tunjukkan nomor pesanan <b>#'+ORDER.order_no+'</b> di kasir untuk membayar <b>'+rupiah(ORDER.total)+'</b>.</p></div>';\n  } else {\n    h+='<div class=\"card\" style=\"margin-top:16px;border-color:var(--green)\"><div class=\"h2\" style=\"color:#5ee996\">Pembayaran diterima ✓</div>'+\n       '<p class=\"muted small\" style=\"margin-top:6px\">Pesananmu sedang diproses dapur. Terima kasih!</p></div>';\n  }\n\n  h+='<div class=\"card\" style=\"margin-top:16px\"><div class=\"h2\" style=\"margin-bottom:10px\">Rincian Pesanan</div><div class=\"col\">';\n  ITEMS.forEach(function(it){\n    h+='<div class=\"between\"><div><span class=\"bold\">'+it.qty+'×</span> '+esc(it.name)+\n       (it.note?'<div class=\"muted small\">“'+esc(it.note)+'”</div>':'')+'</div><span>'+rupiah(it.price*it.qty)+'</span></div>';\n  });\n  h+='</div><hr class=\"hr\"><div class=\"between\"><span class=\"muted\">Subtotal</span><span>'+rupiah(ORDER.subtotal)+'</span></div>';\n  if(ORDER.tax>0) h+='<div class=\"between\" style=\"margin-top:6px\"><span class=\"muted\">Pajak</span><span>'+rupiah(ORDER.tax)+'</span></div>';\n  h+='<hr class=\"hr\"><div class=\"between\"><span class=\"bold\">Total</span><span class=\"bold\">'+rupiah(ORDER.total)+'</span></div></div>';\n  document.getElementById('app').innerHTML=h;\n}\n\nfunction confirmPaid(){\n  if(confirming) return; confirming=true;\n  var b=document.getElementById('payBtn'); if(b){b.disabled=true;b.textContent='Memproses…';}\n  call('apiUpdateOrder', id, {payment_status:'paid'}).then(function(res){\n    confirming=false; if(res.order){ORDER=res.order;ITEMS=res.items;} render();\n  });\n}\n</script>\n</body>\n</html>\n",
  kitchen: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container\">\n  <div class=\"between\" style=\"padding:16px 0\">\n    <div><h1 class=\"title\">🍳 Kitchen Display</h1>\n      <p class=\"muted small\">Auto-refresh 5 detik · 1 printer untuk 3 station</p></div>\n    <button class=\"btn\" onclick=\"go('home')\">← Beranda</button>\n  </div>\n  <div class=\"row no-print\" id=\"filters\" style=\"flex-wrap:wrap;margin-bottom:14px\"></div>\n  <div id=\"board\"><p class=\"muted\">Memuat…</p></div>\n</div>\n\n<script>\nvar STATIONS=[{id:'shaokao',name:'Shaokao',cls:'station-shaokao'},\n  {id:'maincourse',name:'Maincourse',cls:'station-maincourse'},\n  {id:'bar',name:'Bar Minuman',cls:'station-bar'}];\nvar ORDERS=[], filter='all';\n\nfunction timeAgo(ts){ var s=Math.floor((Date.now()-new Date(ts).getTime())/1000);\n  if(s<60) return s+'s lalu'; return Math.floor(s/60)+'m lalu'; }\n\nfunction renderFilters(){\n  var h='<button class=\"btn '+(filter==='all'?'btn-brand':'')+'\" onclick=\"setFilter(\\'all\\')\">Semua</button>';\n  STATIONS.forEach(function(s){ h+='<button class=\"btn '+(filter===s.id?'btn-brand':'')+'\" onclick=\"setFilter(\\''+s.id+'\\')\">'+s.name+'</button>'; });\n  document.getElementById('filters').innerHTML=h;\n}\nfunction setFilter(f){ filter=f; renderFilters(); renderBoard(); }\n\nfunction load(){\n  call('apiGetKitchen').then(function(res){ ORDERS=res||[]; renderBoard(); });\n}\nrenderFilters(); load(); setInterval(load,5000);\n\nfunction renderBoard(){\n  var list=ORDERS;\n  if(filter!=='all'){\n    list=ORDERS.map(function(o){ var c=Object.assign({},o); c.items=o.items.filter(function(i){return i.station_id===filter;}); return c; })\n      .filter(function(o){return o.items.length;});\n  }\n  if(!list.length){ document.getElementById('board').innerHTML='<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Belum ada pesanan aktif.</p></div>'; return; }\n  var h='<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(300px,1fr))\">';\n  list.forEach(function(o){\n    h+='<div class=\"card\"><div class=\"between\"><div><span class=\"bold\">#'+o.order_no+'</span> · Meja '+esc(o.table_number)+'</div>'+\n       '<span class=\"badge\">'+timeAgo(o.created_at)+'</span></div>';\n    h+='<div class=\"row\" style=\"margin-top:6px\"><span class=\"badge '+(o.payment_status==='paid'?'badge-green':'badge-amber')+'\">'+\n       (o.payment_status==='paid'?'Lunas':(o.payment_method==='qris'?'Nunggu QRIS':'Bayar kasir'))+'</span></div>';\n    if(o.note) h+='<p class=\"muted small\" style=\"margin-top:6px\">Catatan: '+esc(o.note)+'</p>';\n    h+='<hr class=\"hr\">';\n    STATIONS.forEach(function(s){\n      var its=o.items.filter(function(i){return i.station_id===s.id;});\n      if(!its.length) return;\n      h+='<div class=\"card '+s.cls+'\" style=\"margin-bottom:8px;padding:10px\"><div class=\"bold small\" style=\"margin-bottom:6px\">'+s.name+'</div>';\n      its.forEach(function(it){\n        h+='<div class=\"between\" style=\"margin-bottom:6px\"><div><span class=\"bold\">'+it.qty+'×</span> '+esc(it.name)+\n           (it.note?'<div class=\"muted small\">“'+esc(it.note)+'”</div>':'')+\n           '<div><span class=\"badge '+(it.kitchen_status==='ready'?'badge-green':'badge-blue')+'\" style=\"font-size:10px\">'+esc(it.kitchen_status)+'</span></div></div>'+\n           '<div class=\"no-print\">'+(it.kitchen_status!=='ready'?\n              '<button class=\"btn\" style=\"padding:4px 8px;font-size:12px\" onclick=\"setStatus(\\''+it.id+'\\',\\'ready\\')\">Ready</button>':\n              '<button class=\"btn btn-green\" style=\"padding:4px 8px;font-size:12px\" onclick=\"setStatus(\\''+it.id+'\\',\\'served\\')\">Served</button>')+'</div></div>';\n      });\n      h+='</div>';\n    });\n    var others=o.items.filter(function(i){return !STATIONS.some(function(s){return s.id===i.station_id;});});\n    if(others.length){ h+='<div class=\"card\" style=\"margin-bottom:8px;padding:10px\"><div class=\"bold small\" style=\"margin-bottom:6px\">Tanpa station</div>';\n      others.forEach(function(it){ h+='<div class=\"between\"><span><span class=\"bold\">'+it.qty+'×</span> '+esc(it.name)+'</span>'+\n        '<button class=\"btn\" style=\"padding:4px 8px;font-size:12px\" onclick=\"setStatus(\\''+it.id+'\\',\\'served\\')\">Served</button></div>'; }); h+='</div>'; }\n    h+='<button class=\"btn btn-brand btn-block no-print\" onclick=\"go(\\'print\\',{order:\\''+o.id+'\\'})\">🖨️ Cetak Dapur (3 station)</button>';\n    h+='</div>';\n  });\n  h+='</div>';\n  document.getElementById('board').innerHTML=h;\n}\n\nfunction setStatus(itemId,status){ call('apiSetItemStatus',itemId,status).then(load); }\n</script>\n</body>\n</html>\n",
  print: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var PARAMS = <?!= JSON.stringify(params) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container-sm\" id=\"app\" style=\"padding-top:16px\">\n  <p class=\"muted\" style=\"padding-top:24px\">Menyiapkan struk…</p>\n</div>\n\n<script>\nvar STATIONS=[{id:'shaokao',name:'STATION SHAOKAO'},{id:'maincourse',name:'STATION MAINCOURSE'},{id:'bar',name:'BAR MINUMAN'}];\nvar id=PARAMS.order||'';\n\nfunction fmt(ts){ try{ return new Date(ts).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){return '';} }\n\ncall('apiGetOrder', id).then(function(res){\n  if(res.error){ document.getElementById('app').innerHTML='<div class=\"card\">Order tidak ditemukan.</div>'; return; }\n  render(res.order, res.items);\n});\n\nfunction render(order, items){\n  var groups=STATIONS.map(function(s){ return {id:s.id,name:s.name,items:items.filter(function(i){return i.station_id===s.id;})}; });\n  var others=items.filter(function(i){return !STATIONS.some(function(s){return s.id===i.station_id;});});\n  if(others.length) groups.push({id:'other',name:'LAINNYA',items:others});\n  var active=groups.filter(function(g){return g.items.length;});\n  var merchant=esc(CONFIG.merchant_name||'Restoran');\n\n  var h='<div class=\"between no-print\"><button class=\"btn btn-brand\" onclick=\"window.print()\">🖨️ Cetak Sekarang</button>'+\n        '<button class=\"btn\" onclick=\"markPrinted()\" id=\"markBtn\">Tandai dicetak</button>'+\n        '<button class=\"btn\" onclick=\"go(\\'kitchen\\')\">Tutup</button></div>';\n  h+='<p class=\"muted small no-print\" style=\"margin-top:8px\">Satu dokumen berisi '+active.length+' struk station — printer mencetak berurutan dengan pemisah potong.</p>';\n\n  active.forEach(function(s,idx){\n    h+='<div class=\"ticket\"><h3>'+merchant+'</h3><h3 style=\"font-size:16px\">'+s.name+'</h3><div class=\"line\"></div>'+\n       '<div class=\"item\"><span>Order</span><span>#'+order.order_no+'</span></div>'+\n       '<div class=\"item\"><span>Meja</span><span>'+esc(order.table_number)+'</span></div>'+\n       '<div class=\"item\"><span>Waktu</span><span>'+fmt(order.created_at)+'</span></div>'+\n       '<div class=\"item\"><span>Bayar</span><span>'+(order.payment_status==='paid'?'LUNAS':(order.payment_method==='qris'?'QRIS':'KASIR'))+'</span></div>'+\n       '<div class=\"line\"></div>';\n    s.items.forEach(function(it){\n      h+='<div style=\"margin-bottom:4px\"><div class=\"item\"><span><b>'+it.qty+'x</b> '+esc(it.name)+'</span></div>'+\n         (it.note?'<div style=\"font-style:italic;padding-left:8px\">* '+esc(it.note)+'</div>':'')+'</div>';\n    });\n    h+='<div class=\"line\"></div>'+(order.note?'<div>Catatan order: '+esc(order.note)+'</div>':'')+\n       '<div style=\"text-align:center;margin-top:6px\">--- '+s.name+' ---</div></div>';\n    if(idx<active.length-1) h+='<div class=\"cut no-print\">✂ — — — — potong — — — — ✂</div>';\n  });\n  if(!active.length) h+='<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Tidak ada item untuk dicetak.</p></div>';\n  document.getElementById('app').innerHTML=h;\n}\n\nfunction markPrinted(){\n  var b=document.getElementById('markBtn'); if(b){b.disabled=true;b.textContent='Ditandai ✓';}\n  // tandai semua item 'queued' di order ini jadi 'printed'\n  call('apiGetOrder', id).then(function(res){\n    (res.items||[]).forEach(function(it){ if(it.kitchen_status==='queued') call('apiSetItemStatus', it.id, 'printed'); });\n  });\n}\n</script>\n</body>\n</html>\n",
  cashier: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container\">\n  <div class=\"between\" style=\"padding:16px 0\">\n    <div><h1 class=\"title\">💵 Kasir</h1><p class=\"muted small\">Konfirmasi pembayaran &amp; tutup bill</p></div>\n    <button class=\"btn\" onclick=\"go('home')\">← Beranda</button>\n  </div>\n  <div class=\"row\" style=\"margin-bottom:14px\">\n    <button class=\"btn\" id=\"tabActive\" onclick=\"setTab('active')\">Aktif</button>\n    <button class=\"btn\" id=\"tabClosed\" onclick=\"setTab('closed')\">Selesai</button>\n  </div>\n  <div id=\"list\"><p class=\"muted\">Memuat…</p></div>\n</div>\n\n<script>\nvar TAB='active', ROWS=[], busy='';\nfunction setTab(t){ TAB=t; styleTabs(); load(); }\nfunction styleTabs(){\n  document.getElementById('tabActive').className='btn '+(TAB==='active'?'btn-brand':'');\n  document.getElementById('tabClosed').className='btn '+(TAB==='closed'?'btn-brand':'');\n}\nfunction load(){ call('apiGetCashier', TAB).then(function(res){ ROWS=res||[]; render(); }); }\nstyleTabs(); load(); setInterval(load,6000);\n\nfunction render(){\n  if(!ROWS.length){ document.getElementById('list').innerHTML='<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Tidak ada data.</p></div>'; return; }\n  var h='<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(320px,1fr))\">';\n  ROWS.forEach(function(o){\n    var paid=o.payment_status==='paid';\n    h+='<div class=\"card\"><div class=\"between\"><div class=\"bold\">#'+o.order_no+' · Meja '+esc(o.table_number)+'</div>'+\n       '<span class=\"badge '+(paid?'badge-green':'badge-amber')+'\">'+(paid?'Lunas':'Belum bayar')+'</span></div>';\n    h+='<div class=\"row\" style=\"margin-top:6px\"><span class=\"badge badge-blue\">'+esc(o.status)+'</span>'+\n       '<span class=\"badge\">'+(o.payment_method==='qris'?'QRIS':'Kasir')+'</span>'+\n       (o.customer_name?'<span class=\"muted small\">'+esc(o.customer_name)+'</span>':'')+'</div><hr class=\"hr\"><div class=\"col\" style=\"gap:4px\">';\n    (o.items||[]).forEach(function(it){ h+='<div class=\"between small\"><span>'+it.qty+'× '+esc(it.name)+'</span><span>'+rupiah(it.price*it.qty)+'</span></div>'; });\n    h+='</div><hr class=\"hr\"><div class=\"between\"><span class=\"bold\">Total</span><span class=\"bold\">'+rupiah(o.total)+'</span></div>';\n    if(TAB==='active'){\n      h+='<div class=\"col no-print\" style=\"margin-top:12px;gap:8px\">';\n      if(!paid) h+='<button class=\"btn btn-green btn-block\" onclick=\"patch(\\''+o.id+'\\',{payment_status:\\'paid\\'})\">Tandai Lunas</button>';\n      h+='<div class=\"row\"><button class=\"btn btn-block\" onclick=\"patch(\\''+o.id+'\\',{status:\\'closed\\'})\">Tutup Bill</button>'+\n         '<button class=\"btn btn-block\" onclick=\"patch(\\''+o.id+'\\',{status:\\'cancelled\\'})\">Batalkan</button></div>'+\n         '<button class=\"btn btn-block\" onclick=\"go(\\'print\\',{order:\\''+o.id+'\\'})\">🖨️ Cetak ulang</button></div>';\n    }\n    h+='</div>';\n  });\n  h+='</div>';\n  document.getElementById('list').innerHTML=h;\n}\nfunction patch(id,body){ call('apiUpdateOrder', id, body).then(load); }\n</script>\n</body>\n</html>\n",
  admin: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container\">\n  <div class=\"between\" style=\"padding:16px 0\">\n    <div><h1 class=\"title\">⚙️ Admin</h1><p class=\"muted small\">Kelola meja, QR, dan menu</p></div>\n    <button class=\"btn\" onclick=\"go('home')\">← Beranda</button>\n  </div>\n  <div class=\"row\" style=\"margin-bottom:14px\">\n    <button class=\"btn\" id=\"tabTables\" onclick=\"setTab('tables')\">Meja &amp; QR</button>\n    <button class=\"btn\" id=\"tabMenu\" onclick=\"setTab('menu')\">Menu</button>\n  </div>\n  <div id=\"content\"><p class=\"muted\">Memuat…</p></div>\n</div>\n\n<script>\nvar TAB='tables', D=null;\nfunction setTab(t){ TAB=t; styleTabs(); render(); }\nfunction styleTabs(){\n  document.getElementById('tabTables').className='btn '+(TAB==='tables'?'btn-brand':'');\n  document.getElementById('tabMenu').className='btn '+(TAB==='menu'?'btn-brand':'');\n}\nfunction load(){ return call('apiGetAdmin').then(function(res){ D=res; render(); }); }\nstyleTabs(); load();\n\nfunction qrImg(token){\n  var link=(D.baseUrl||BASE_URL)+'?page=menu&token='+encodeURIComponent(token);\n  return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(link);\n}\nfunction menuLink(token){ return (D.baseUrl||BASE_URL)+'?page=menu&token='+encodeURIComponent(token); }\n\nfunction render(){\n  if(!D){ return; }\n  if(TAB==='tables') renderTables(); else renderMenu();\n}\n\nfunction renderTables(){\n  var h='<div class=\"col\"><div class=\"card\"><div class=\"h2\" style=\"margin-bottom:10px\">Tambah Meja</div>'+\n    '<div class=\"row\"><input class=\"input\" id=\"newTable\" placeholder=\"Nomor / nama meja (mis. 12)\">'+\n    '<button class=\"btn btn-brand\" onclick=\"addTable()\">Tambah</button></div></div>';\n  h+='<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(220px,1fr))\">';\n  D.tables.forEach(function(t){\n    h+='<div class=\"card\" style=\"text-align:center\"><div class=\"between\"><span class=\"bold\">Meja '+esc(t.table_number)+'</span>'+\n       '<span class=\"badge '+(t.active?'badge-green':'badge-red')+'\">'+(t.active?'Aktif':'Nonaktif')+'</span></div>'+\n       '<img src=\"'+qrImg(t.token)+'\" alt=\"QR\" style=\"width:180px;height:180px;margin:10px auto;background:#fff;border-radius:10px;padding:6px\">'+\n       '<div class=\"muted small\" style=\"word-break:break-all\">'+esc(menuLink(t.token))+'</div>'+\n       '<div class=\"row no-print\" style=\"margin-top:10px;justify-content:center;flex-wrap:wrap\">'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"printQr(\\''+t.token+'\\',\\''+esc(t.table_number)+'\\')\">Cetak QR</button>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"call(\\'apiToggleTable\\',\\''+t.id+'\\').then(function(r){D=r;render();})\">'+(t.active?'Nonaktif':'Aktif')+'</button>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"delTable(\\''+t.id+'\\',\\''+esc(t.table_number)+'\\')\">Hapus</button></div></div>';\n  });\n  h+='</div></div>';\n  document.getElementById('content').innerHTML=h;\n}\n\nfunction addTable(){\n  var v=document.getElementById('newTable').value;\n  if(!v.trim()) return;\n  call('apiAddTable', v).then(function(r){ D=r; render(); });\n}\nfunction delTable(id,num){ if(confirm('Hapus meja '+num+'?')) call('apiDeleteTable',id).then(function(r){D=r;render();}); }\n\nfunction printQr(token,num){\n  var link=menuLink(token);\n  var w=window.open('','_blank');\n  w.document.write('<html><head><title>QR Meja '+num+'</title></head><body style=\"font-family:system-ui;text-align:center;padding:24px\">'+\n    '<h2>'+esc(CONFIG.merchant_name||'Restoran')+'</h2><div style=\"font-size:28px;font-weight:800\">MEJA '+esc(num)+'</div>'+\n    '<p>Scan untuk lihat menu &amp; pesan</p>'+\n    '<img src=\"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+encodeURIComponent(link)+'\" style=\"width:300px;height:300px\">'+\n    '<p style=\"font-size:11px;word-break:break-all\">'+esc(link)+'</p>'+\n    '<button onclick=\"window.print()\" style=\"padding:10px 16px;margin-top:12px\">Cetak</button></body></html>');\n  w.document.close();\n}\n\nfunction renderMenu(){\n  var catOpts='<option value=\"\">— Kategori —</option>'+D.categories.map(function(c){return '<option value=\"'+c.id+'\">'+esc(c.name)+'</option>';}).join('');\n  var stOpts=D.stations.map(function(s){return '<option value=\"'+s.id+'\">'+esc(s.name)+'</option>';}).join('');\n  var h='<div class=\"col\"><div class=\"card\"><div class=\"h2\" style=\"margin-bottom:10px\">Tambah Menu</div>'+\n    '<div class=\"grid\" style=\"grid-template-columns:1fr 1fr\">'+\n    '<input class=\"input\" id=\"mName\" placeholder=\"Nama menu\">'+\n    '<input class=\"input\" id=\"mPrice\" type=\"number\" placeholder=\"Harga\">'+\n    '<select class=\"select\" id=\"mCat\">'+catOpts+'</select>'+\n    '<select class=\"select\" id=\"mStation\"><option value=\"\">Station: ikut kategori</option>'+stOpts+'</select></div>'+\n    '<input class=\"input\" id=\"mDesc\" style=\"margin-top:10px\" placeholder=\"Deskripsi (opsional)\">'+\n    '<button class=\"btn btn-brand\" style=\"margin-top:10px\" onclick=\"addMenu()\">Tambah Menu</button></div>';\n  h+='<div class=\"col\">';\n  D.items.forEach(function(it){\n    var sel=D.stations.map(function(s){return '<option value=\"'+s.id+'\" '+(it.station_id===s.id?'selected':'')+'>'+esc(s.name)+'</option>';}).join('');\n    h+='<div class=\"card\"><div class=\"between\"><div><span class=\"bold\">'+esc(it.name)+'</span> · '+rupiah(it.price)+\n       (it.description?'<div class=\"muted small\">'+esc(it.description)+'</div>':'')+'</div>'+\n       '<span class=\"badge '+(it.available?'badge-green':'badge-red')+'\">'+(it.available?'Tersedia':'Habis')+'</span></div>'+\n       '<div class=\"row no-print\" style=\"margin-top:10px;flex-wrap:wrap\">'+\n       '<select class=\"select\" style=\"width:auto\" onchange=\"call(\\'apiSetItemStation\\',\\''+it.id+'\\',this.value).then(function(r){D=r;render();})\">'+\n       '<option value=\"\">Tanpa station</option>'+sel+'</select>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"call(\\'apiToggleMenuItem\\',\\''+it.id+'\\').then(function(r){D=r;render();})\">'+(it.available?'Set habis':'Set tersedia')+'</button>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"delMenu(\\''+it.id+'\\',\\''+esc(it.name)+'\\')\">Hapus</button></div></div>';\n  });\n  h+='</div></div>';\n  document.getElementById('content').innerHTML=h;\n}\n\nfunction addMenu(){\n  var obj={ name:document.getElementById('mName').value, price:document.getElementById('mPrice').value,\n    category_id:document.getElementById('mCat').value, station_id:document.getElementById('mStation').value,\n    description:document.getElementById('mDesc').value };\n  if(!obj.name.trim()||!obj.price){ alert('Nama & harga wajib diisi'); return; }\n  call('apiAddMenuItem', obj).then(function(r){ if(r.error){alert(r.error);return;} D=r; render(); });\n}\nfunction delMenu(id,name){ if(confirm('Hapus '+name+'?')) call('apiDeleteMenuItem',id).then(function(r){D=r;render();}); }\n</script>\n</body>\n</html>\n",
};
