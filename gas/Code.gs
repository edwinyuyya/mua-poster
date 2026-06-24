/**
 * F&B Order System — Backend (Google Apps Script + Google Sheets)
 * Database: Google Spreadsheet. Storage: Google Drive (otomatis).
 *
 * Cara pakai (SINGLE FILE - cukup tempel file ini saja):
 *  1) Buat Google Spreadsheet baru -> Extensions -> Apps Script.
 *  2) Hapus isi Code.gs bawaan, tempel SELURUH isi file ini.
 *  3) Jalankan fungsi  setup  sekali (Run) lalu izinkan akses.
 *  4) Deploy -> Web app -> Anyone -> pakai URL /exec.
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
  t.config = publicConfig_();
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
  if (cfgRows.indexOf('staff_pin') < 0) append_('Config', { key: 'staff_pin', value: '' });
  if (cfgRows.indexOf('qris_static') < 0) append_('Config', { key: 'qris_static', value: '' });
  if (cfgRows.indexOf('web_app_url') < 0) append_('Config', { key: 'web_app_url', value: '' });

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
    config: publicConfig_(),
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
  var co = cleanOrder_(order);
  var cfg = getConfig_();
  if (co.payment_method === 'qris' && cfg.qris_static) co.qris_payload = buildDynamicQris_(cfg.qris_static, co.total);
  return { order: co, items: items.map(cleanItem_) };
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
    baseUrl: (getConfig_().web_app_url || getBaseUrl_()),
    config: publicConfig_(),
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

// ----- Config publik (tanpa rahasia) & PIN -----
function publicConfig_() {
  var c = getConfig_();
  var out = {};
  for (var k in c) { if (k !== 'staff_pin') out[k] = c[k]; }
  out.pin_required = !!(c.staff_pin && String(c.staff_pin) !== '');
  return out;
}

function apiVerifyPin(pin) {
  var c = getConfig_();
  if (!c.staff_pin || String(c.staff_pin) === '') return { ok: true };
  return { ok: String(pin) === String(c.staff_pin) };
}

// ----- QRIS dinamis (sisipkan nominal + hitung ulang CRC) -----
function crc16_(str) {
  var crc = 0xFFFF;
  for (var i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  var hex = crc.toString(16).toUpperCase();
  while (hex.length < 4) hex = '0' + hex;
  return hex;
}

function buildDynamicQris_(staticPayload, amount) {
  var p = String(staticPayload || '');
  if (!p) return '';
  var amt = String(Math.round(Number(amount) || 0));
  if (!amt || amt === '0') return p; // tanpa nominal -> pakai apa adanya
  // static (010211) -> dynamic (010212)
  p = p.replace('010211', '010212');
  // sisipkan tag 54 (nominal) sebelum tag 58 (negara)
  var len = amt.length; var lenStr = (len < 10 ? '0' + len : '' + len);
  var tag54 = '54' + lenStr + amt;
  var idx = p.indexOf('5802');
  if (idx >= 0) p = p.slice(0, idx) + tag54 + p.slice(idx);
  // buang CRC lama lalu hitung ulang
  var ci = p.lastIndexOf('6304');
  if (ci >= 0) p = p.slice(0, ci);
  p = p + '6304';
  return p + crc16_(p);
}

function clearSheet_(name){ var sh=getSheet_(name); var last=sh.getLastRow(); if(last>1) sh.deleteRows(2,last-1); }

// Import menu BBQIU (jalankan SEKALI dari editor; mengganti Categories & MenuItems)
function importMenuBBQIU(){
  var cats=[["Sate 3.900","shaokao"],["Sate 6.900","shaokao"],["Sate Spesial 9.900","shaokao"],["Sate Premium 14.900","shaokao"],["Daging Premium (Grill)","maincourse"],["Grill & Suki","maincourse"],["Suki / Steamboat","maincourse"],["Nasi & Snack","maincourse"]];
  var items=[["Sate 6.900","Sate brokoli",6900],["Sate 6.900","jamur hioko",6900],["Sate 6.900","Sate ayam bombay",6900],["Sate 6.900","Bakso ayam",6900],["Sate 6.900","Bakso sapi",6900],["Sate 6.900","Jamur enoki",6900],["Sate 6.900","Jamur kancing",6900],["Sate 6.900","Sate ayam",6900],["Sate 3.900","Buncis",3900],["Sate 3.900","Jagung manis",3900],["Sate 3.900","Bawang bombay",3900],["Sate 3.900","Kulit ayam",3900],["Sate 3.900","Tofu Jepang",3900],["Sate 3.900","Usus ayam",3900],["Sate 3.900","Tahu",3900],["Sate 3.900","Sosis ayam",3900],["Sate 3.900","Sate jamur tiram",3900],["Sate 3.900","Sate sawi sendok",3900],["Sate 3.900","Sate kangkung",3900],["Sate Premium 14.900","Patty",14900],["Sate Premium 14.900","Beef bacon",14900],["Sate Premium 14.900","Smoked beef enoki",14900],["Sate Premium 14.900","Shortplate enoki",14900],["Sate Premium 14.900","Udang jumbo",14900],["Sate Premium 14.900","Saikoro",14900],["Sate Premium 14.900","Sirloin",14900],["Sate Premium 14.900","KAMBING",14900],["Sate Spesial 9.900","Otot sapi",9900],["Sate Spesial 9.900","Smoked beef brokoli",9900],["Sate Spesial 9.900","Sate cumi",9900],["Sate Spesial 9.900","Odeng",9900],["Sate Spesial 9.900","Siomay",9900],["Sate Spesial 9.900","Smoked chicken",9900],["Sate Spesial 9.900","Kikil sapi",9900],["Sate Spesial 9.900","Paru sapi",9900],["Daging Premium (Grill)","Saikoro",24900],["Daging Premium (Grill)","US KARUBI small (sp)",22900],["Daging Premium (Grill)","sirloin small",22900],["Daging Premium (Grill)","Tenderloin small",22900],["Daging Premium (Grill)","CHUCK CREST small",24900],["Daging Premium (Grill)","TENDON small",22900],["Daging Premium (Grill)","LIDAH small",22900],["Daging Premium (Grill)","beef bacon",22900],["Grill & Suki","Crab stick Grill Suki",14900],["Grill & Suki","Beef Patty Grill",17900],["Grill & Suki","Siomay  bikin Grill Suki",17900],["Grill & Suki","Smoked Beef Grill",17900],["Grill & Suki","Sosis Ayam Grill Suki",14900],["Grill & Suki","Sosis Sapi Grill Suki",19900],["Grill & Suki","Dendeng (porsi) Grill",19900],["Grill & Suki","crab nugget Grill Suki",19900],["Grill & Suki","otak2 singapore Grill Suki",19900],["Grill & Suki","salmon ball Grill Suki",17900],["Grill & Suki","chikuwa Grill Suki",14900],["Grill & Suki","bakso sapi Grill Suki",19900],["Grill & Suki","Fillet ayam Grill Suki",17900],["Grill & Suki","Fillet salmon Grill",19900],["Grill & Suki","Fillet Tuna Grill",17900],["Grill & Suki","Fillet dory Grill Suki",17900],["Grill & Suki","Kulit ayam Grill Suki",17900],["Grill & Suki","Udang Grill Suki",24900],["Grill & Suki","Jamur Enoki Grill Suki",12900],["Grill & Suki","Jamur Hioko Grill Suki",12900],["Grill & Suki","Onion Grill",9900],["Nasi & Snack","Nasi",6900],["Grill & Suki","Bakso Kakap Grill Suki",14900],["Grill & Suki","Jagung Manis Grill Suki",9900],["Suki / Steamboat","Brokoli Suki",19900],["Suki / Steamboat","Tofu Suki",14900],["Suki / Steamboat","Jamur Kuping Suki",12900],["Suki / Steamboat","Jamur salju Suki",12900],["Suki / Steamboat","Sawi sendok Suki",9900],["Suki / Steamboat","Sawi Putih Suki",9900],["Suki / Steamboat","Tahu Sutra Suki",9900],["Nasi & Snack","french fries",12900],["Nasi & Snack","french fries brown",34900],["Nasi & Snack","nasi goreng bawang",24900],["Nasi & Snack","soy sauce fried rice",24900],["Nasi & Snack","egg fried rice",30900]];
  var catSheet=getSheet_('Categories'); clearSheet_('Categories');
  var catId={},catStation={};
  var catRows=cats.map(function(c,i){ var id=Utilities.getUuid(); catId[c[0]]=id; catStation[c[0]]=c[1]; return [id,c[0],c[1],i+1]; });
  if(catRows.length) catSheet.getRange(2,1,catRows.length,4).setValues(catRows);
  var miSheet=getSheet_('MenuItems'); clearSheet_('MenuItems');
  var miRows=items.map(function(m,i){ return [Utilities.getUuid(),catId[m[0]],m[1],'',m[2],catStation[m[0]],true,i+1]; });
  if(miRows.length) miSheet.getRange(2,1,miRows.length,8).setValues(miRows);
  return 'Import selesai: '+items.length+' menu, '+cats.length+' kategori.';
}

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
//  HALAMAN HTML (digabung - tidak perlu file terpisah)
// ============================================================
var PARTIALS_ = {
  Styles: "<style>\n  :root{\n    --bg:#0f1115;--card:#1a1d24;--card2:#22262f;--line:#2c313c;--text:#e8eaed;\n    --muted:#9aa3b2;--brand:#ff5a36;--green:#28c46b;--red:#ef4444;--blue:#3b82f6;\n  }\n  *{box-sizing:border-box}\n  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);\n    font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}\n  a{color:inherit;text-decoration:none}\n  .container{max-width:960px;margin:0 auto;padding:16px}\n  .container-sm{max-width:640px;margin:0 auto;padding:16px}\n  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}\n  .row{display:flex;gap:12px;align-items:center}\n  .between{display:flex;justify-content:space-between;align-items:center;gap:12px}\n  .col{display:flex;flex-direction:column;gap:12px}\n  .grid{display:grid;gap:12px}\n  .muted{color:var(--muted)} .small{font-size:13px} .bold{font-weight:700}\n  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--card2);\n    color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:15px;\n    font-weight:600;cursor:pointer;transition:filter .15s}\n  .btn:hover{filter:brightness(1.15)} .btn:disabled{opacity:.5;cursor:not-allowed}\n  .btn-brand{background:var(--brand);border-color:var(--brand);color:#fff}\n  .btn-green{background:var(--green);border-color:var(--green);color:#04210f}\n  .btn-block{width:100%}\n  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;\n    background:var(--card2);border:1px solid var(--line)}\n  .badge-green{background:rgba(40,196,107,.15);color:#5ee996;border-color:transparent}\n  .badge-red{background:rgba(239,68,68,.15);color:#ff8585;border-color:transparent}\n  .badge-amber{background:rgba(255,176,32,.15);color:#ffcf6a;border-color:transparent}\n  .badge-blue{background:rgba(59,130,246,.15);color:#8fbaff;border-color:transparent}\n  .input,.select,.textarea{width:100%;background:var(--card2);color:var(--text);border:1px solid var(--line);\n    border-radius:10px;padding:10px 12px;font-size:15px}\n  .textarea{min-height:70px;resize:vertical}\n  .hr{height:1px;background:var(--line);border:0;margin:12px 0}\n  .qty{display:inline-flex;align-items:center;gap:10px}\n  .qty button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--card2);\n    color:var(--text);font-size:18px;cursor:pointer}\n  .title{font-size:22px;font-weight:800;margin:0} .h2{font-size:17px;font-weight:700;margin:0}\n  .station-shaokao{border-left:4px solid #ff5a36}\n  .station-maincourse{border-left:4px solid #ffb020}\n  .station-bar{border-left:4px solid #3b82f6}\n  @media print{\n    body{background:#fff;color:#000}.no-print{display:none!important}.ticket{page-break-after:always}\n  }\n  .ticket{background:#fff;color:#000;width:280px;margin:0 auto 18px;padding:12px;\n    font-family:'Courier New',monospace;font-size:13px;border:1px dashed #999}\n  .ticket h3{margin:0 0 4px;text-align:center}\n  .ticket .line{border-top:1px dashed #000;margin:6px 0}\n  .ticket .item{display:flex;justify-content:space-between}\n  .cut{text-align:center;color:#888;font-size:11px;margin:4px 0}\n\n  /* ===== Tema pelanggan (copper oriental) ===== */\n  :root{ --bbqiu-logo: url('data:image/png;base64,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'); }\n  body.cust{\n    background:\n      radial-gradient(120% 80% at 50% -10%, rgba(212,175,55,.20), transparent 60%),\n      repeating-linear-gradient(45deg, rgba(0,0,0,.05) 0 14px, transparent 14px 28px),\n      linear-gradient(160deg,#2e1409 0%,#5a2e18 32%,#8a4a26 64%,#b5703f 100%);\n    background-attachment:fixed; color:#f6e7d6; min-height:100vh;\n  }\n  body.cust::before{\n    content:'';position:fixed;inset:0;z-index:0;pointer-events:none;\n    background:var(--bbqiu-logo) center 42% / 78% no-repeat; opacity:.05;\n  }\n  body.cust .container-sm,body.cust .brand-hero{position:relative;z-index:1}\n  body.cust .card{ background:rgba(34,18,10,.74); border:1px solid rgba(212,175,55,.35);\n    box-shadow:0 6px 20px rgba(0,0,0,.35); color:#f6e7d6; }\n  body.cust .muted{color:#d8c3a8}\n  body.cust .title,body.cust .h2,body.cust .bold{color:#fff}\n  body.cust .btn{background:rgba(255,255,255,.08);border-color:rgba(212,175,55,.4);color:#f6e7d6}\n  body.cust .btn-brand{background:linear-gradient(135deg,#c0392b,#e0552c);border-color:#c0392b;color:#fff}\n  body.cust .btn-green{background:linear-gradient(135deg,#1f9d57,#28c46b);border-color:#28c46b;color:#04210f}\n  body.cust .input,body.cust .textarea,body.cust .select{background:rgba(0,0,0,.3);border-color:rgba(212,175,55,.35);color:#fff}\n  body.cust .hr{background:rgba(212,175,55,.28)}\n  body.cust .badge{background:rgba(0,0,0,.3);border-color:rgba(212,175,55,.35);color:#f6e7d6}\n  body.cust .qty button{background:rgba(0,0,0,.3);border-color:rgba(212,175,55,.4);color:#fff}\n  .brand-hero{ text-align:center; padding:22px 16px 6px; }\n  .brand-logo{ display:block; width:230px; max-width:74%; height:120px; margin:0 auto;\n    background:#fff var(--bbqiu-logo) center/contain no-repeat; border-radius:16px;\n    padding:12px; box-shadow:0 8px 26px rgba(0,0,0,.42); }\n  .brand-tagline{ margin-top:12px;font-size:13px;letter-spacing:3px;color:#f0d9a8;font-weight:800;text-transform:uppercase }\n  .food-strip{ display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:14px 0 4px }\n  .food-chip{ background:rgba(0,0,0,.34);border:1px solid rgba(212,175,55,.45);border-radius:999px;\n    padding:7px 14px;font-size:13px;font-weight:700;color:#ffe9c7;display:flex;align-items:center;gap:6px }\n  .food-chip .ic{ font-size:18px }\n  .brand-divider{ height:3px;width:90px;margin:14px auto 2px;border-radius:3px;\n    background:linear-gradient(90deg,transparent,#d4af37,transparent) }\n</style>\n<script>\n  // Helper bersama: panggil fungsi server sebagai Promise\n  function call(fn){\n    var args = Array.prototype.slice.call(arguments,1);\n    return new Promise(function(resolve,reject){\n      var runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);\n      runner[fn].apply(runner,args);\n    });\n  }\n  function rupiah(n){ return 'Rp ' + Number(n||0).toLocaleString('id-ID'); }\n  function go(page, params){\n    var url = BASE_URL + '?page=' + page;\n    for(var k in (params||{})) url += '&' + k + '=' + encodeURIComponent(params[k]);\n    window.open(url, '_top');\n  }\n  function esc(s){ return String(s==null?'':s).replace(/[&<>\"]/g,function(c){\n    return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]; }); }\n  // Gerbang PIN untuk halaman staf (admin/kitchen/cashier)\n  function requirePin(cb){\n    if(!window.CONFIG || !CONFIG.pin_required){ cb(); return; }\n    if(sessionStorage.getItem('staff_ok')==='1'){ cb(); return; }\n    var ov=document.createElement('div');\n    ov.style='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';\n    ov.innerHTML='<div class=\"card\" style=\"width:300px;text-align:center\">'+\n      '<div class=\"h2\">🔒 Masuk Staf</div>'+\n      '<p class=\"muted small\" style=\"margin:6px 0\">Masukkan PIN untuk lanjut</p>'+\n      '<input id=\"pinInput\" class=\"input\" type=\"password\" inputmode=\"numeric\" placeholder=\"PIN\" style=\"text-align:center;letter-spacing:6px\">'+\n      '<div id=\"pinErr\" class=\"small\" style=\"color:#ff8585;min-height:18px;margin:4px 0\"></div>'+\n      '<button class=\"btn btn-brand btn-block\" id=\"pinBtn\">Masuk</button></div>';\n    document.body.appendChild(ov);\n    function submit(){\n      var v=document.getElementById('pinInput').value;\n      var b=document.getElementById('pinBtn'); b.disabled=true;\n      call('apiVerifyPin', v).then(function(r){\n        if(r && r.ok){ sessionStorage.setItem('staff_ok','1'); ov.remove(); cb(); }\n        else { document.getElementById('pinErr').textContent='PIN salah'; b.disabled=false; }\n      }).catch(function(){ b.disabled=false; });\n    }\n    document.getElementById('pinBtn').onclick=submit;\n    document.getElementById('pinInput').addEventListener('keydown',function(e){ if(e.key==='Enter') submit(); });\n    document.getElementById('pinInput').focus();\n  }\n</script>\n",
};

var TEMPLATES_ = {
  home: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n<div class=\"container\">\n  <div style=\"padding:24px 0\">\n    <h1 class=\"title\">F&amp;B Order System</h1>\n    <p class=\"muted\">Order via QR di meja · bayar QRIS / kasir · cetak dapur ke 3 station · backend Google Sheets</p>\n  </div>\n  <div class=\"grid\" style=\"grid-template-columns:repeat(auto-fit,minmax(240px,1fr))\">\n    <a class=\"card\" onclick=\"go('kitchen')\" style=\"cursor:pointer\">\n      <div class=\"h2\">🍳 Kitchen Display</div>\n      <p class=\"muted small\">Tiket per station + cetak 1 printer untuk 3 station.</p>\n    </a>\n    <a class=\"card\" onclick=\"go('cashier')\" style=\"cursor:pointer\">\n      <div class=\"h2\">💵 Kasir</div>\n      <p class=\"muted small\">Konfirmasi pembayaran &amp; tutup bill.</p>\n    </a>\n    <a class=\"card\" onclick=\"go('admin')\" style=\"cursor:pointer\">\n      <div class=\"h2\">⚙️ Admin</div>\n      <p class=\"muted small\">Kelola menu, meja, &amp; cetak QR meja.</p>\n    </a>\n  </div>\n  <div class=\"card\" style=\"margin-top:16px\">\n    <div class=\"h2\">Alur singkat</div>\n    <ol class=\"muted small\" style=\"line-height:1.8\">\n      <li>Pelanggan scan QR di meja → buka menu → pesan.</li>\n      <li>Pilih bayar <b>QRIS</b> atau <b>bayar di kasir</b>.</li>\n      <li>Pesanan dirouting otomatis &amp; dicetak ke station sesuai.</li>\n      <li>Kasir menutup bill saat selesai.</li>\n    </ol>\n    <p class=\"small muted\">Belum ada data? Jalankan fungsi <b>setup</b> di editor Apps Script, lalu deploy ulang.</p>\n  </div>\n</div>\n</body>\n</html>\n",
  menu: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body class=\"cust\">\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var PARAMS = <?!= JSON.stringify(params) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"brand-hero\">\n  <div class=\"brand-logo\"></div>\n  <div class=\"brand-tagline\">Grill · Suki · Shao Kao</div>\n  <div class=\"food-strip\">\n    <span class=\"food-chip\"><span class=\"ic\">🍢</span>Shao Kao</span>\n    <span class=\"food-chip\"><span class=\"ic\">🍲</span>Steamboat</span>\n    <span class=\"food-chip\"><span class=\"ic\">🥩</span>Grill Daging</span>\n  </div>\n  <div class=\"brand-divider\"></div>\n</div>\n<div class=\"container-sm\" id=\"app\" style=\"padding-bottom:90px\">\n  <p class=\"muted\" style=\"padding-top:24px\">Memuat menu…</p>\n</div>\n\n<script>\nvar DATA = null;          // {table, categories, items, config}\nvar CART = {};            // menuId -> qty\nvar NOTES = {};           // menuId -> note\nvar showCart = false;\nvar payment = 'qris';\nvar submitting = false;\n\nvar token = PARAMS.token || '';\n\ncall('apiGetMenu', token).then(function(res){\n  if(res.error){ document.getElementById('app').innerHTML =\n    '<div class=\"card\" style=\"margin-top:40px\"><h1 class=\"title\">QR tidak valid</h1><p class=\"muted\">'+esc(res.error)+'</p></div>'; return; }\n  DATA = res;\n  render();\n}).catch(function(e){\n  document.getElementById('app').innerHTML='<div class=\"card\" style=\"margin-top:40px\"><p class=\"muted\">Gagal memuat. '+esc(e.message||e)+'</p></div>';\n});\n\nfunction itemById(id){ return DATA.items.filter(function(i){return i.id===id;})[0]; }\nfunction cartLines(){\n  return Object.keys(CART).filter(function(id){return CART[id]>0;}).map(function(id){\n    return { item:itemById(id), qty:CART[id], note:NOTES[id]||'' };\n  }).filter(function(l){return l.item;});\n}\nfunction totals(){\n  var lines=cartLines();\n  var subtotal=lines.reduce(function(s,l){return s+l.item.price*l.qty;},0);\n  var taxPercent=Number((DATA.config||{}).tax_percent||0);\n  var tax=Math.round(subtotal*taxPercent/100);\n  return {subtotal:subtotal,tax:tax,total:subtotal+tax,taxPercent:taxPercent,\n    qty:lines.reduce(function(s,l){return s+l.qty;},0)};\n}\nfunction setQty(id,d){\n  var n=Math.max(0,(CART[id]||0)+d);\n  if(n===0) delete CART[id]; else CART[id]=n;\n  render();\n}\n\nfunction render(){\n  var t=totals();\n  var html='';\n  html+='<header style=\"padding:16px 0\"><div class=\"muted small\">'+esc(DATA.config.merchant_name||'Restoran')+'</div>'+\n        '<h1 class=\"title\">Menu · Meja '+esc(DATA.table.table_number)+'</h1></header>';\n\n  var cats=DATA.categories.slice();\n  cats.forEach(function(c){\n    var its=DATA.items.filter(function(i){return i.category_id===c.id;});\n    if(!its.length) return;\n    html+='<section style=\"margin-bottom:18px\"><h2 class=\"h2\" style=\"margin-bottom:10px\">'+esc(c.name)+'</h2><div class=\"col\">';\n    its.forEach(function(it){ html+=itemCard(it); });\n    html+='</div></section>';\n  });\n  var unc=DATA.items.filter(function(i){return !cats.some(function(c){return c.id===i.category_id;});});\n  if(unc.length){ html+='<section style=\"margin-bottom:18px\"><h2 class=\"h2\">Lainnya</h2><div class=\"col\">';\n    unc.forEach(function(it){html+=itemCard(it);}); html+='</div></section>'; }\n\n  if(t.qty>0 && !showCart){\n    html+='<div style=\"position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--bg);border-top:1px solid var(--line);padding:12px 16px\">'+\n          '<button class=\"btn btn-brand btn-block\" onclick=\"openCart()\">Lihat Keranjang · '+t.qty+' item · '+rupiah(t.total)+'</button></div>';\n  }\n  document.getElementById('app').innerHTML=html;\n  if(showCart) renderCart();\n}\n\nfunction itemCard(it){\n  var q=CART[it.id]||0;\n  return '<div class=\"card\"><div class=\"between\"><div style=\"flex:1\">'+\n    '<div class=\"bold\">'+esc(it.name)+'</div>'+\n    (it.description?'<div class=\"muted small\" style=\"margin-top:2px\">'+esc(it.description)+'</div>':'')+\n    '<div style=\"margin-top:6px\">'+rupiah(it.price)+'</div></div>'+\n    '<div class=\"qty\">'+(q>0?'<button onclick=\"setQty(\\''+it.id+'\\',-1)\">−</button><span class=\"bold\">'+q+'</span>':'')+\n    '<button onclick=\"setQty(\\''+it.id+'\\',1)\">+</button></div></div></div>';\n}\n\nfunction openCart(){ showCart=true; render(); }\nfunction closeCart(){ showCart=false; var o=document.getElementById('cartOverlay'); if(o) o.remove(); }\n\nfunction renderCart(){\n  var t=totals(); var lines=cartLines();\n  var el=document.createElement('div');\n  el.id='cartOverlay';\n  el.style='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:30;display:flex;align-items:flex-end';\n  el.onclick=function(e){ if(e.target===el) closeCart(); };\n  var inner='<div class=\"container-sm\" style=\"background:var(--bg);border-top-left-radius:18px;border-top-right-radius:18px;max-height:88vh;overflow-y:auto;width:100%;padding-bottom:24px\" onclick=\"event.stopPropagation()\">';\n  inner+='<div class=\"between\" style=\"padding:16px 0\"><h2 class=\"h2\">Keranjang · Meja '+esc(DATA.table.table_number)+'</h2>'+\n         '<button class=\"btn\" onclick=\"closeCart()\">Tutup</button></div><div class=\"col\">';\n  lines.forEach(function(l){\n    inner+='<div class=\"card\"><div class=\"between\"><div class=\"bold\">'+esc(l.item.name)+'</div>'+\n      '<div class=\"qty\"><button onclick=\"setQty(\\''+l.item.id+'\\',-1)\">−</button><span class=\"bold\">'+l.qty+'</span>'+\n      '<button onclick=\"setQty(\\''+l.item.id+'\\',1)\">+</button></div></div>'+\n      '<div class=\"between\" style=\"margin-top:6px\"><span class=\"muted small\">'+rupiah(l.item.price)+' × '+l.qty+'</span>'+\n      '<span class=\"bold\">'+rupiah(l.item.price*l.qty)+'</span></div>'+\n      '<input class=\"input\" style=\"margin-top:8px\" placeholder=\"Catatan (mis. tidak pedas)\" value=\"'+esc(l.note)+'\" '+\n      'oninput=\"NOTES[\\''+l.item.id+'\\']=this.value\"></div>';\n  });\n  inner+='</div>';\n  inner+='<div class=\"card\" style=\"margin-top:12px\"><input id=\"custName\" class=\"input\" placeholder=\"Nama (opsional)\">'+\n         '<textarea id=\"orderNote\" class=\"textarea\" style=\"margin-top:8px\" placeholder=\"Catatan untuk seluruh pesanan (opsional)\"></textarea></div>';\n  inner+='<div class=\"card\" style=\"margin-top:12px\"><div class=\"between\"><span class=\"muted\">Subtotal</span><span>'+rupiah(t.subtotal)+'</span></div>';\n  if(t.taxPercent>0) inner+='<div class=\"between\" style=\"margin-top:6px\"><span class=\"muted\">Pajak '+t.taxPercent+'%</span><span>'+rupiah(t.tax)+'</span></div>';\n  inner+='<hr class=\"hr\"><div class=\"between\"><span class=\"bold\">Total</span><span class=\"bold\">'+rupiah(t.total)+'</span></div></div>';\n  inner+='<div class=\"card\" style=\"margin-top:12px\"><div class=\"h2\" style=\"margin-bottom:10px\">Metode Pembayaran</div><div class=\"col\">'+\n    '<label class=\"btn '+(payment==='qris'?'btn-brand':'')+'\" style=\"justify-content:flex-start\"><input type=\"radio\" name=\"pay\" '+(payment==='qris'?'checked':'')+' onchange=\"setPay(\\'qris\\')\">&nbsp;Bayar sekarang via QRIS</label>'+\n    '<label class=\"btn '+(payment==='cashier'?'btn-brand':'')+'\" style=\"justify-content:flex-start\"><input type=\"radio\" name=\"pay\" '+(payment==='cashier'?'checked':'')+' onchange=\"setPay(\\'cashier\\')\">&nbsp;Bayar di kasir</label>'+\n    '</div></div>';\n  inner+='<div id=\"cartErr\"></div>';\n  inner+='<button class=\"btn btn-green btn-block\" style=\"margin-top:14px\" id=\"submitBtn\" onclick=\"submitOrder()\">Pesan Sekarang · '+rupiah(t.total)+'</button>';\n  inner+='</div>';\n  el.innerHTML=inner;\n  document.body.appendChild(el);\n}\n\nfunction setPay(p){ payment=p; var o=document.getElementById('cartOverlay'); if(o){o.remove();renderCart();} }\n\nfunction submitOrder(){\n  if(submitting) return;\n  var lines=cartLines();\n  if(!lines.length){ document.getElementById('cartErr').innerHTML='<div class=\"card\" style=\"margin-top:12px;border-color:var(--red)\"><span style=\"color:#ff8585\">Keranjang kosong.</span></div>'; return; }\n  submitting=true;\n  var btn=document.getElementById('submitBtn'); btn.disabled=true; btn.textContent='Memproses…';\n  var payload={ token:token, payment_method:payment,\n    customer_name:(document.getElementById('custName')||{}).value||'',\n    note:(document.getElementById('orderNote')||{}).value||'',\n    items:lines.map(function(l){return {menu_item_id:l.item.id,qty:l.qty,note:l.note};}) };\n  call('apiCreateOrder', payload).then(function(res){\n    if(res.error){ submitting=false; btn.disabled=false; btn.textContent='Pesan Sekarang';\n      document.getElementById('cartErr').innerHTML='<div class=\"card\" style=\"margin-top:12px;border-color:var(--red)\"><span style=\"color:#ff8585\">'+esc(res.error)+'</span></div>'; return; }\n    go('order', {id:res.order_id});\n  }).catch(function(e){ submitting=false; btn.disabled=false; btn.textContent='Pesan Sekarang';\n    document.getElementById('cartErr').innerHTML='<div class=\"card\" style=\"margin-top:12px;border-color:var(--red)\"><span style=\"color:#ff8585\">'+esc(e.message||e)+'</span></div>'; });\n}\n</script>\n</body>\n</html>\n",
  order: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body class=\"cust\">\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var PARAMS = <?!= JSON.stringify(params) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"brand-hero\" style=\"padding-bottom:0\">\n  <div class=\"brand-logo\" style=\"width:170px;height:90px\"></div>\n</div>\n<div class=\"container-sm\" id=\"app\" style=\"padding-top:16px;padding-bottom:40px\">\n  <p class=\"muted\" style=\"padding-top:24px\">Memuat pesanan…</p>\n</div>\n\n<script>\nvar ORDER=null, ITEMS=[], confirming=false, poll=null;\nvar STATUS_LABEL={open:'Pesanan diterima',preparing:'Sedang disiapkan',served:'Sudah disajikan',closed:'Selesai',cancelled:'Dibatalkan'};\nvar id=PARAMS.id||'';\n\nfunction load(){\n  return call('apiGetOrder', id).then(function(res){\n    if(res.error){ document.getElementById('app').innerHTML='<div class=\"card\" style=\"margin-top:40px\"><h1 class=\"title\">Order tidak ditemukan</h1></div>'; return; }\n    ORDER=res.order; ITEMS=res.items; render();\n  });\n}\nload().then(function(){\n  poll=setInterval(function(){\n    if(!ORDER || ORDER.status==='closed' || ORDER.status==='cancelled'){ clearInterval(poll); return; }\n    load();\n  },5000);\n});\n\nfunction qrisUrl(){\n  var payload = ORDER.qris_payload || ((CONFIG.qris_static && CONFIG.qris_static!=='') ? CONFIG.qris_static :\n    ('QRIS|MERCHANT:'+(CONFIG.merchant_name||'Restoran')+'|ORDER:'+ORDER.order_no+'|AMOUNT:'+ORDER.total));\n  return 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(payload);\n}\n\nfunction render(){\n  var paid=ORDER.payment_status==='paid';\n  var isQris=ORDER.payment_method==='qris';\n  var h='';\n  h+='<div class=\"muted small\">'+esc(CONFIG.merchant_name||'Restoran')+'</div>';\n  h+='<h1 class=\"title\">Pesanan #'+ORDER.order_no+'</h1>';\n  h+='<div class=\"row\" style=\"margin-top:6px\"><span class=\"badge\">Meja '+esc(ORDER.table_number)+'</span>'+\n     '<span class=\"badge badge-blue\">'+esc(STATUS_LABEL[ORDER.status]||ORDER.status)+'</span>'+\n     '<span class=\"badge '+(paid?'badge-green':'badge-amber')+'\">'+(paid?'Lunas':'Belum bayar')+'</span></div>';\n\n  if(!paid && isQris){\n    h+='<div class=\"card\" style=\"margin-top:16px;text-align:center\"><div class=\"h2\">Scan untuk bayar (QRIS)</div>'+\n       '<img src=\"'+qrisUrl()+'\" alt=\"QRIS\" style=\"width:240px;height:240px;margin:12px auto;background:#fff;border-radius:12px;padding:8px\">'+\n       '<div class=\"bold\" style=\"font-size:20px\">'+rupiah(ORDER.total)+'</div>'+\n       '<p class=\"muted small\" style=\"margin-top:8px\">'+(ORDER.qris_payload?'Nominal '+rupiah(ORDER.total)+' sudah otomatis di QR. ':'')+'Setelah membayar, tekan tombol di bawah untuk konfirmasi.</p>'+\n       '<button class=\"btn btn-green btn-block\" style=\"margin-top:8px\" id=\"payBtn\" onclick=\"confirmPaid()\">Saya sudah bayar</button></div>';\n  } else if(!paid && !isQris){\n    h+='<div class=\"card\" style=\"margin-top:16px\"><div class=\"h2\">Bayar di Kasir</div>'+\n       '<p class=\"muted small\" style=\"margin-top:6px\">Tunjukkan nomor pesanan <b>#'+ORDER.order_no+'</b> di kasir untuk membayar <b>'+rupiah(ORDER.total)+'</b>.</p></div>';\n  } else {\n    h+='<div class=\"card\" style=\"margin-top:16px;border-color:var(--green)\"><div class=\"h2\" style=\"color:#5ee996\">Pembayaran diterima ✓</div>'+\n       '<p class=\"muted small\" style=\"margin-top:6px\">Pesananmu sedang diproses dapur. Terima kasih!</p></div>';\n  }\n\n  h+='<div class=\"card\" style=\"margin-top:16px\"><div class=\"h2\" style=\"margin-bottom:10px\">Rincian Pesanan</div><div class=\"col\">';\n  ITEMS.forEach(function(it){\n    h+='<div class=\"between\"><div><span class=\"bold\">'+it.qty+'×</span> '+esc(it.name)+\n       (it.note?'<div class=\"muted small\">“'+esc(it.note)+'”</div>':'')+'</div><span>'+rupiah(it.price*it.qty)+'</span></div>';\n  });\n  h+='</div><hr class=\"hr\"><div class=\"between\"><span class=\"muted\">Subtotal</span><span>'+rupiah(ORDER.subtotal)+'</span></div>';\n  if(ORDER.tax>0) h+='<div class=\"between\" style=\"margin-top:6px\"><span class=\"muted\">Pajak</span><span>'+rupiah(ORDER.tax)+'</span></div>';\n  h+='<hr class=\"hr\"><div class=\"between\"><span class=\"bold\">Total</span><span class=\"bold\">'+rupiah(ORDER.total)+'</span></div></div>';\n  document.getElementById('app').innerHTML=h;\n}\n\nfunction confirmPaid(){\n  if(confirming) return; confirming=true;\n  var b=document.getElementById('payBtn'); if(b){b.disabled=true;b.textContent='Memproses…';}\n  call('apiUpdateOrder', id, {payment_status:'paid'}).then(function(res){\n    confirming=false; if(res.order){ORDER=res.order;ITEMS=res.items;} render();\n  });\n}\n</script>\n</body>\n</html>\n",
  kitchen: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container\">\n  <div class=\"between\" style=\"padding:16px 0\">\n    <div><h1 class=\"title\">🍳 Kitchen Display</h1>\n      <p class=\"muted small\">Auto-refresh 5 detik · 1 printer untuk 3 station</p></div>\n    <button class=\"btn\" onclick=\"go('home')\">← Beranda</button>\n  </div>\n  <div class=\"row no-print\" id=\"filters\" style=\"flex-wrap:wrap;margin-bottom:14px\"></div>\n  <div id=\"board\"><p class=\"muted\">Memuat…</p></div>\n</div>\n\n<script>\nvar STATIONS=[{id:'shaokao',name:'Shaokao',cls:'station-shaokao'},\n  {id:'maincourse',name:'Maincourse',cls:'station-maincourse'},\n  {id:'bar',name:'Bar Minuman',cls:'station-bar'}];\nvar ORDERS=[], filter='all';\n\nfunction timeAgo(ts){ var s=Math.floor((Date.now()-new Date(ts).getTime())/1000);\n  if(s<60) return s+'s lalu'; return Math.floor(s/60)+'m lalu'; }\n\nfunction renderFilters(){\n  var h='<button class=\"btn '+(filter==='all'?'btn-brand':'')+'\" onclick=\"setFilter(\\'all\\')\">Semua</button>';\n  STATIONS.forEach(function(s){ h+='<button class=\"btn '+(filter===s.id?'btn-brand':'')+'\" onclick=\"setFilter(\\''+s.id+'\\')\">'+s.name+'</button>'; });\n  document.getElementById('filters').innerHTML=h;\n}\nfunction setFilter(f){ filter=f; renderFilters(); renderBoard(); }\n\nfunction load(){\n  call('apiGetKitchen').then(function(res){ ORDERS=res||[]; renderBoard(); });\n}\nrenderFilters(); requirePin(function(){ load(); setInterval(load,5000); });\n\nfunction renderBoard(){\n  var list=ORDERS;\n  if(filter!=='all'){\n    list=ORDERS.map(function(o){ var c=Object.assign({},o); c.items=o.items.filter(function(i){return i.station_id===filter;}); return c; })\n      .filter(function(o){return o.items.length;});\n  }\n  if(!list.length){ document.getElementById('board').innerHTML='<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Belum ada pesanan aktif.</p></div>'; return; }\n  var h='<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(300px,1fr))\">';\n  list.forEach(function(o){\n    h+='<div class=\"card\"><div class=\"between\"><div><span class=\"bold\">#'+o.order_no+'</span> · Meja '+esc(o.table_number)+'</div>'+\n       '<span class=\"badge\">'+timeAgo(o.created_at)+'</span></div>';\n    h+='<div class=\"row\" style=\"margin-top:6px\"><span class=\"badge '+(o.payment_status==='paid'?'badge-green':'badge-amber')+'\">'+\n       (o.payment_status==='paid'?'Lunas':(o.payment_method==='qris'?'Nunggu QRIS':'Bayar kasir'))+'</span></div>';\n    if(o.note) h+='<p class=\"muted small\" style=\"margin-top:6px\">Catatan: '+esc(o.note)+'</p>';\n    h+='<hr class=\"hr\">';\n    STATIONS.forEach(function(s){\n      var its=o.items.filter(function(i){return i.station_id===s.id;});\n      if(!its.length) return;\n      h+='<div class=\"card '+s.cls+'\" style=\"margin-bottom:8px;padding:10px\"><div class=\"bold small\" style=\"margin-bottom:6px\">'+s.name+'</div>';\n      its.forEach(function(it){\n        h+='<div class=\"between\" style=\"margin-bottom:6px\"><div><span class=\"bold\">'+it.qty+'×</span> '+esc(it.name)+\n           (it.note?'<div class=\"muted small\">“'+esc(it.note)+'”</div>':'')+\n           '<div><span class=\"badge '+(it.kitchen_status==='ready'?'badge-green':'badge-blue')+'\" style=\"font-size:10px\">'+esc(it.kitchen_status)+'</span></div></div>'+\n           '<div class=\"no-print\">'+(it.kitchen_status!=='ready'?\n              '<button class=\"btn\" style=\"padding:4px 8px;font-size:12px\" onclick=\"setStatus(\\''+it.id+'\\',\\'ready\\')\">Ready</button>':\n              '<button class=\"btn btn-green\" style=\"padding:4px 8px;font-size:12px\" onclick=\"setStatus(\\''+it.id+'\\',\\'served\\')\">Served</button>')+'</div></div>';\n      });\n      h+='</div>';\n    });\n    var others=o.items.filter(function(i){return !STATIONS.some(function(s){return s.id===i.station_id;});});\n    if(others.length){ h+='<div class=\"card\" style=\"margin-bottom:8px;padding:10px\"><div class=\"bold small\" style=\"margin-bottom:6px\">Tanpa station</div>';\n      others.forEach(function(it){ h+='<div class=\"between\"><span><span class=\"bold\">'+it.qty+'×</span> '+esc(it.name)+'</span>'+\n        '<button class=\"btn\" style=\"padding:4px 8px;font-size:12px\" onclick=\"setStatus(\\''+it.id+'\\',\\'served\\')\">Served</button></div>'; }); h+='</div>'; }\n    h+='<button class=\"btn btn-brand btn-block no-print\" onclick=\"go(\\'print\\',{order:\\''+o.id+'\\'})\">🖨️ Cetak Dapur (3 station)</button>';\n    h+='</div>';\n  });\n  h+='</div>';\n  document.getElementById('board').innerHTML=h;\n}\n\nfunction setStatus(itemId,status){ call('apiSetItemStatus',itemId,status).then(load); }\n</script>\n</body>\n</html>\n",
  print: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var PARAMS = <?!= JSON.stringify(params) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container-sm\" id=\"app\" style=\"padding-top:16px\">\n  <p class=\"muted\" style=\"padding-top:24px\">Menyiapkan struk…</p>\n</div>\n\n<script>\nvar STATIONS=[{id:'shaokao',name:'STATION SHAOKAO'},{id:'maincourse',name:'STATION MAINCOURSE'},{id:'bar',name:'BAR MINUMAN'}];\nvar id=PARAMS.order||'';\n\nfunction fmt(ts){ try{ return new Date(ts).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){return '';} }\n\ncall('apiGetOrder', id).then(function(res){\n  if(res.error){ document.getElementById('app').innerHTML='<div class=\"card\">Order tidak ditemukan.</div>'; return; }\n  render(res.order, res.items);\n});\n\nfunction render(order, items){\n  var groups=STATIONS.map(function(s){ return {id:s.id,name:s.name,items:items.filter(function(i){return i.station_id===s.id;})}; });\n  var others=items.filter(function(i){return !STATIONS.some(function(s){return s.id===i.station_id;});});\n  if(others.length) groups.push({id:'other',name:'LAINNYA',items:others});\n  var active=groups.filter(function(g){return g.items.length;});\n  var merchant=esc(CONFIG.merchant_name||'Restoran');\n\n  var h='<div class=\"between no-print\"><button class=\"btn btn-brand\" onclick=\"window.print()\">🖨️ Cetak Sekarang</button>'+\n        '<button class=\"btn\" onclick=\"markPrinted()\" id=\"markBtn\">Tandai dicetak</button>'+\n        '<button class=\"btn\" onclick=\"go(\\'kitchen\\')\">Tutup</button></div>';\n  h+='<p class=\"muted small no-print\" style=\"margin-top:8px\">Satu dokumen berisi '+active.length+' struk station — printer mencetak berurutan dengan pemisah potong.</p>';\n\n  active.forEach(function(s,idx){\n    h+='<div class=\"ticket\"><h3>'+merchant+'</h3><h3 style=\"font-size:16px\">'+s.name+'</h3><div class=\"line\"></div>'+\n       '<div class=\"item\"><span>Order</span><span>#'+order.order_no+'</span></div>'+\n       '<div class=\"item\"><span>Meja</span><span>'+esc(order.table_number)+'</span></div>'+\n       '<div class=\"item\"><span>Waktu</span><span>'+fmt(order.created_at)+'</span></div>'+\n       '<div class=\"item\"><span>Bayar</span><span>'+(order.payment_status==='paid'?'LUNAS':(order.payment_method==='qris'?'QRIS':'KASIR'))+'</span></div>'+\n       '<div class=\"line\"></div>';\n    s.items.forEach(function(it){\n      h+='<div style=\"margin-bottom:4px\"><div class=\"item\"><span><b>'+it.qty+'x</b> '+esc(it.name)+'</span></div>'+\n         (it.note?'<div style=\"font-style:italic;padding-left:8px\">* '+esc(it.note)+'</div>':'')+'</div>';\n    });\n    h+='<div class=\"line\"></div>'+(order.note?'<div>Catatan order: '+esc(order.note)+'</div>':'')+\n       '<div style=\"text-align:center;margin-top:6px\">--- '+s.name+' ---</div></div>';\n    if(idx<active.length-1) h+='<div class=\"cut no-print\">✂ — — — — potong — — — — ✂</div>';\n  });\n  if(!active.length) h+='<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Tidak ada item untuk dicetak.</p></div>';\n  document.getElementById('app').innerHTML=h;\n}\n\nfunction markPrinted(){\n  var b=document.getElementById('markBtn'); if(b){b.disabled=true;b.textContent='Ditandai ✓';}\n  // tandai semua item 'queued' di order ini jadi 'printed'\n  call('apiGetOrder', id).then(function(res){\n    (res.items||[]).forEach(function(it){ if(it.kitchen_status==='queued') call('apiSetItemStatus', it.id, 'printed'); });\n  });\n}\n</script>\n</body>\n</html>\n",
  cashier: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container\">\n  <div class=\"between\" style=\"padding:16px 0\">\n    <div><h1 class=\"title\">💵 Kasir</h1><p class=\"muted small\">Konfirmasi pembayaran &amp; tutup bill</p></div>\n    <button class=\"btn\" onclick=\"go('home')\">← Beranda</button>\n  </div>\n  <div class=\"row\" style=\"margin-bottom:14px\">\n    <button class=\"btn\" id=\"tabActive\" onclick=\"setTab('active')\">Aktif</button>\n    <button class=\"btn\" id=\"tabClosed\" onclick=\"setTab('closed')\">Selesai</button>\n  </div>\n  <div id=\"list\"><p class=\"muted\">Memuat…</p></div>\n</div>\n\n<script>\nvar TAB='active', ROWS=[], busy='';\nfunction setTab(t){ TAB=t; styleTabs(); load(); }\nfunction styleTabs(){\n  document.getElementById('tabActive').className='btn '+(TAB==='active'?'btn-brand':'');\n  document.getElementById('tabClosed').className='btn '+(TAB==='closed'?'btn-brand':'');\n}\nfunction load(){ call('apiGetCashier', TAB).then(function(res){ ROWS=res||[]; render(); }); }\nstyleTabs(); requirePin(function(){ load(); setInterval(load,6000); });\n\nfunction render(){\n  if(!ROWS.length){ document.getElementById('list').innerHTML='<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Tidak ada data.</p></div>'; return; }\n  var h='<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(320px,1fr))\">';\n  ROWS.forEach(function(o){\n    var paid=o.payment_status==='paid';\n    h+='<div class=\"card\"><div class=\"between\"><div class=\"bold\">#'+o.order_no+' · Meja '+esc(o.table_number)+'</div>'+\n       '<span class=\"badge '+(paid?'badge-green':'badge-amber')+'\">'+(paid?'Lunas':'Belum bayar')+'</span></div>';\n    h+='<div class=\"row\" style=\"margin-top:6px\"><span class=\"badge badge-blue\">'+esc(o.status)+'</span>'+\n       '<span class=\"badge\">'+(o.payment_method==='qris'?'QRIS':'Kasir')+'</span>'+\n       (o.customer_name?'<span class=\"muted small\">'+esc(o.customer_name)+'</span>':'')+'</div><hr class=\"hr\"><div class=\"col\" style=\"gap:4px\">';\n    (o.items||[]).forEach(function(it){ h+='<div class=\"between small\"><span>'+it.qty+'× '+esc(it.name)+'</span><span>'+rupiah(it.price*it.qty)+'</span></div>'; });\n    h+='</div><hr class=\"hr\"><div class=\"between\"><span class=\"bold\">Total</span><span class=\"bold\">'+rupiah(o.total)+'</span></div>';\n    if(TAB==='active'){\n      h+='<div class=\"col no-print\" style=\"margin-top:12px;gap:8px\">';\n      if(!paid) h+='<button class=\"btn btn-green btn-block\" onclick=\"patch(\\''+o.id+'\\',{payment_status:\\'paid\\'})\">Tandai Lunas</button>';\n      h+='<div class=\"row\"><button class=\"btn btn-block\" onclick=\"patch(\\''+o.id+'\\',{status:\\'closed\\'})\">Tutup Bill</button>'+\n         '<button class=\"btn btn-block\" onclick=\"patch(\\''+o.id+'\\',{status:\\'cancelled\\'})\">Batalkan</button></div>'+\n         '<button class=\"btn btn-block\" onclick=\"go(\\'print\\',{order:\\''+o.id+'\\'})\">🖨️ Cetak ulang</button></div>';\n    }\n    h+='</div>';\n  });\n  h+='</div>';\n  document.getElementById('list').innerHTML=h;\n}\nfunction patch(id,body){ call('apiUpdateOrder', id, body).then(load); }\n</script>\n</body>\n</html>\n",
  admin: "<!DOCTYPE html>\n<html lang=\"id\">\n<head><base target=\"_top\"><?!= include('Styles'); ?></head>\n<body>\n<script>\n  var BASE_URL = <?!= JSON.stringify(baseUrl) ?>;\n  var CONFIG = <?!= JSON.stringify(config) ?>;\n</script>\n\n<div class=\"container\">\n  <div class=\"between\" style=\"padding:16px 0\">\n    <div><h1 class=\"title\">⚙️ Admin</h1><p class=\"muted small\">Kelola meja, QR, dan menu</p></div>\n    <button class=\"btn\" onclick=\"go('home')\">← Beranda</button>\n  </div>\n  <div class=\"row\" style=\"margin-bottom:14px\">\n    <button class=\"btn\" id=\"tabTables\" onclick=\"setTab('tables')\">Meja &amp; QR</button>\n    <button class=\"btn\" id=\"tabMenu\" onclick=\"setTab('menu')\">Menu</button>\n  </div>\n  <div id=\"content\"><p class=\"muted\">Memuat…</p></div>\n</div>\n\n<script>\nvar TAB='tables', D=null;\nfunction setTab(t){ TAB=t; styleTabs(); render(); }\nfunction styleTabs(){\n  document.getElementById('tabTables').className='btn '+(TAB==='tables'?'btn-brand':'');\n  document.getElementById('tabMenu').className='btn '+(TAB==='menu'?'btn-brand':'');\n}\nfunction load(){ return call('apiGetAdmin').then(function(res){ D=res; render(); }); }\nstyleTabs(); requirePin(load);\n\nfunction qrImg(token){\n  var link=(D.baseUrl||BASE_URL)+'?page=menu&token='+encodeURIComponent(token);\n  return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(link);\n}\nfunction menuLink(token){ return (D.baseUrl||BASE_URL)+'?page=menu&token='+encodeURIComponent(token); }\n\nfunction render(){\n  if(!D){ return; }\n  if(TAB==='tables') renderTables(); else renderMenu();\n}\n\nfunction renderTables(){\n  var h='<div class=\"col\"><div class=\"card\"><div class=\"h2\" style=\"margin-bottom:10px\">Tambah Meja</div>'+\n    '<div class=\"row\"><input class=\"input\" id=\"newTable\" placeholder=\"Nomor / nama meja (mis. 12)\">'+\n    '<button class=\"btn btn-brand\" onclick=\"addTable()\">Tambah</button></div></div>';\n  h+='<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fill,minmax(220px,1fr))\">';\n  D.tables.forEach(function(t){\n    h+='<div class=\"card\" style=\"text-align:center\"><div class=\"between\"><span class=\"bold\">Meja '+esc(t.table_number)+'</span>'+\n       '<span class=\"badge '+(t.active?'badge-green':'badge-red')+'\">'+(t.active?'Aktif':'Nonaktif')+'</span></div>'+\n       '<img src=\"'+qrImg(t.token)+'\" alt=\"QR\" style=\"width:180px;height:180px;margin:10px auto;background:#fff;border-radius:10px;padding:6px\">'+\n       '<div class=\"muted small\" style=\"word-break:break-all\">'+esc(menuLink(t.token))+'</div>'+\n       '<div class=\"row no-print\" style=\"margin-top:10px;justify-content:center;flex-wrap:wrap\">'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"printQr(\\''+t.token+'\\',\\''+esc(t.table_number)+'\\')\">Cetak QR</button>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"call(\\'apiToggleTable\\',\\''+t.id+'\\').then(function(r){D=r;render();})\">'+(t.active?'Nonaktif':'Aktif')+'</button>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"delTable(\\''+t.id+'\\',\\''+esc(t.table_number)+'\\')\">Hapus</button></div></div>';\n  });\n  h+='</div></div>';\n  document.getElementById('content').innerHTML=h;\n}\n\nfunction addTable(){\n  var v=document.getElementById('newTable').value;\n  if(!v.trim()) return;\n  call('apiAddTable', v).then(function(r){ D=r; render(); });\n}\nfunction delTable(id,num){ if(confirm('Hapus meja '+num+'?')) call('apiDeleteTable',id).then(function(r){D=r;render();}); }\n\nfunction printQr(token,num){\n  var link=menuLink(token);\n  var w=window.open('','_blank');\n  w.document.write('<html><head><title>QR Meja '+num+'</title></head><body style=\"font-family:system-ui;text-align:center;padding:24px\">'+\n    '<h2>'+esc(CONFIG.merchant_name||'Restoran')+'</h2><div style=\"font-size:28px;font-weight:800\">MEJA '+esc(num)+'</div>'+\n    '<p style=\"font-weight:700;margin:4px 0\">Scan pakai KAMERA HP untuk lihat menu &amp; pesan</p>'+\n    '<p style=\"font-size:12px;color:#c00;max-width:300px;margin:6px auto;line-height:1.4\">Jika muncul tulisan tidak bisa membuka file: ketuk titik tiga di pojok layar lalu pilih Buka di Chrome atau browser.</p>'+\n    '<img src=\"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+encodeURIComponent(link)+'\" style=\"width:300px;height:300px\">'+\n    '<p style=\"font-size:11px;word-break:break-all\">'+esc(link)+'</p>'+\n    '<button onclick=\"window.print()\" style=\"padding:10px 16px;margin-top:12px\">Cetak</button></body></html>');\n  w.document.close();\n}\n\nfunction renderMenu(){\n  var catOpts='<option value=\"\">— Kategori —</option>'+D.categories.map(function(c){return '<option value=\"'+c.id+'\">'+esc(c.name)+'</option>';}).join('');\n  var stOpts=D.stations.map(function(s){return '<option value=\"'+s.id+'\">'+esc(s.name)+'</option>';}).join('');\n  var h='<div class=\"col\"><div class=\"card\"><div class=\"h2\" style=\"margin-bottom:10px\">Tambah Menu</div>'+\n    '<div class=\"grid\" style=\"grid-template-columns:1fr 1fr\">'+\n    '<input class=\"input\" id=\"mName\" placeholder=\"Nama menu\">'+\n    '<input class=\"input\" id=\"mPrice\" type=\"number\" placeholder=\"Harga\">'+\n    '<select class=\"select\" id=\"mCat\">'+catOpts+'</select>'+\n    '<select class=\"select\" id=\"mStation\"><option value=\"\">Station: ikut kategori</option>'+stOpts+'</select></div>'+\n    '<input class=\"input\" id=\"mDesc\" style=\"margin-top:10px\" placeholder=\"Deskripsi (opsional)\">'+\n    '<button class=\"btn btn-brand\" style=\"margin-top:10px\" onclick=\"addMenu()\">Tambah Menu</button></div>';\n  h+='<div class=\"col\">';\n  D.items.forEach(function(it){\n    var sel=D.stations.map(function(s){return '<option value=\"'+s.id+'\" '+(it.station_id===s.id?'selected':'')+'>'+esc(s.name)+'</option>';}).join('');\n    h+='<div class=\"card\"><div class=\"between\"><div><span class=\"bold\">'+esc(it.name)+'</span> · '+rupiah(it.price)+\n       (it.description?'<div class=\"muted small\">'+esc(it.description)+'</div>':'')+'</div>'+\n       '<span class=\"badge '+(it.available?'badge-green':'badge-red')+'\">'+(it.available?'Tersedia':'Habis')+'</span></div>'+\n       '<div class=\"row no-print\" style=\"margin-top:10px;flex-wrap:wrap\">'+\n       '<select class=\"select\" style=\"width:auto\" onchange=\"call(\\'apiSetItemStation\\',\\''+it.id+'\\',this.value).then(function(r){D=r;render();})\">'+\n       '<option value=\"\">Tanpa station</option>'+sel+'</select>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"call(\\'apiToggleMenuItem\\',\\''+it.id+'\\').then(function(r){D=r;render();})\">'+(it.available?'Set habis':'Set tersedia')+'</button>'+\n       '<button class=\"btn\" style=\"padding:6px 10px;font-size:13px\" onclick=\"delMenu(\\''+it.id+'\\',\\''+esc(it.name)+'\\')\">Hapus</button></div></div>';\n  });\n  h+='</div></div>';\n  document.getElementById('content').innerHTML=h;\n}\n\nfunction addMenu(){\n  var obj={ name:document.getElementById('mName').value, price:document.getElementById('mPrice').value,\n    category_id:document.getElementById('mCat').value, station_id:document.getElementById('mStation').value,\n    description:document.getElementById('mDesc').value };\n  if(!obj.name.trim()||!obj.price){ alert('Nama & harga wajib diisi'); return; }\n  call('apiAddMenuItem', obj).then(function(r){ if(r.error){alert(r.error);return;} D=r; render(); });\n}\nfunction delMenu(id,name){ if(confirm('Hapus '+name+'?')) call('apiDeleteMenuItem',id).then(function(r){D=r;render();}); }\n</script>\n</body>\n</html>\n",
};
