/**
 * F&B Order System — Backend (Google Apps Script + Google Sheets)
 * Database: Google Spreadsheet. Storage: Google Drive (otomatis).
 *
 * Cara pakai cepat:
 *  1) Buat Google Spreadsheet baru -> Extensions -> Apps Script.
 *  2) Tempel semua file (Code.gs + *.html + appsscript.json) ke project.
 *  3) Jalankan fungsi `setup` sekali (buat tab + data contoh).
 *  4) Deploy -> New deployment -> Web app -> Execute as: Me,
 *     Who has access: Anyone -> Deploy. Pakai URL /exec.
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
  var map = {
    home: 'Home', menu: 'Menu', order: 'Order', kitchen: 'Kitchen',
    print: 'Print', cashier: 'Cashier', admin: 'Admin',
  };
  var file = map[page] || 'Home';
  var t = HtmlService.createTemplateFromFile(file);
  t.params = (e && e.parameter) || {};
  t.baseUrl = getBaseUrl_();
  t.config = getConfig_();
  return t.evaluate()
    .setTitle('F&B Order System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
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
