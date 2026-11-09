// Equipment & custody management (إدارة العُهد والتجهيزات).
//
// Mounted at /api/admin/equipment (see admin.js). Access:
//   admin                  everything
//   'equipment-handle'     deliver, return, replace, record losses (the
//                          "authorised officer")
//   'equipment-types'      manage item types and warehouse stock
//   'equipment'            read-only view of the section and its reports
// Any of the three grants read access, so a handler can always see what they
// are handling.
//
// Every state-changing operation runs inside one synchronous SQLite
// transaction on the shared connection. There is deliberately no `await`
// between BEGIN and COMMIT: node:sqlite is synchronous, so no other request
// can interleave statements into the transaction, and stock can never be
// double-booked. Every movement is appended to EquipmentTransactions, an
// append-only table (database triggers refuse UPDATE and DELETE).
const express = require('express');
const { getDb } = require('../db');
const { adminOnly, requireModule } = require('../auth');
const { wrap, str, dateOnly, idParam } = require('../util');

const router = express.Router();

const canView = requireModule(['equipment', 'equipment-handle', 'equipment-types']);
const canHandle = requireModule('equipment-handle');
const canManage = requireModule('equipment-types');

// Member statuses (TeamMembers.member_status). Everything except 'active'
// means the person no longer serves, so any custody they hold is flagged.
const MEMBER_STATUS = {
  active: 'فعّال',
  suspended: 'متوقف عن الخدمة',
  withdrawn: 'منسحب',
  dismissed: 'مفصول من الفرقة',
  inactive: 'غير فعّال',
};
const RETURN_CONDITIONS = ['good', 'needs_maintenance', 'damaged'];

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const today = () => new Date().toISOString().slice(0, 10);
const posInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const nonNegInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

// Runs fn(db) inside BEGIN IMMEDIATE ... COMMIT; any throw rolls everything back.
function inTransaction(fn) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw err;
  }
}

const all = (sql, ...params) => getDb().prepare(sql).all(...params);
const one = (sql, ...params) => getDb().prepare(sql).get(...params);

// ---------- helpers ----------
const OUTSTANDING = '(c.quantity - c.returned_qty - c.returned_damaged_qty - c.damaged_qty - c.lost_qty)';

function parseSizes(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
function readSizes(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[,،\n]/);
  const out = [];
  for (const s of list) {
    const t = String(s).trim().slice(0, 30);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 40);
}

function appendTx(db, user, t) {
  db.prepare(`INSERT INTO EquipmentTransactions
    (kind, direction, member_id, member_name, type_id, type_name, inventory_id, custody_id, issue_id,
     size, serial_number, quantity, condition, party_name, occurred_on, notes, user_id, user_name)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    t.kind, t.direction || null, t.member_id || null, t.member_name || null, t.type_id, t.type_name,
    t.inventory_id || null, t.custody_id || null, t.issue_id || null,
    t.size || null, t.serial_number || null, t.quantity, t.condition || null, t.party_name || null,
    t.occurred_on, t.notes || null, user.id, user.display_name || user.username
  );
}

function lineLabel(line) {
  return [line.type_name, line.size, line.serial_number ? `#${line.serial_number}` : ''].filter(Boolean).join(' · ');
}

function getLine(db, id) {
  return db.prepare(`SELECT i.*, t.name AS type_name, t.active AS type_active, t.tracks_serial
    FROM EquipmentInventory i JOIN EquipmentTypes t ON t.id = i.type_id WHERE i.id = ?`).get(id);
}

// ---------- members (read-only view of the existing roster) ----------
router.get('/members', canView, wrap(async (req, res) => {
  const rows = all(`
    SELECT m.id, m.name, m.phone, m.photo_url, m.group_name, m.role_title, m.member_status,
           COALESCE(SUM(${OUTSTANDING}), 0) AS outstanding,
           COUNT(CASE WHEN ${OUTSTANDING} > 0 THEN 1 END) AS open_lines
    FROM TeamMembers m LEFT JOIN MemberEquipment c ON c.member_id = m.id
    GROUP BY m.id ORDER BY m.sort_order, m.id`);
  res.json(rows);
}));

// ---------- custody lines ----------
// Filters shared by the custody list and the reports.
function custodyFilters(q) {
  const where = [];
  const params = [];
  const memberId = posInt(q.member_id);
  if (memberId) { where.push('c.member_id = ?'); params.push(memberId); }
  const typeId = posInt(q.type_id);
  if (typeId) { where.push('c.type_id = ?'); params.push(typeId); }
  if (q.custody_status === 'active') where.push(`${OUTSTANDING} > 0`);
  if (q.custody_status === 'closed') where.push(`${OUTSTANDING} = 0`);
  if (q.member_status === 'inactive_any') where.push("m.member_status <> 'active'");
  else if (MEMBER_STATUS[q.member_status]) { where.push('m.member_status = ?'); params.push(q.member_status); }
  const issuedFrom = dateOnly(q.issued_from);
  const issuedTo = dateOnly(q.issued_to);
  if (issuedFrom) { where.push('c.issued_on >= ?'); params.push(issuedFrom); }
  if (issuedTo) { where.push('c.issued_on <= ?'); params.push(issuedTo); }
  const retFrom = dateOnly(q.returned_from);
  const retTo = dateOnly(q.returned_to);
  if (retFrom) { where.push('last_return_on >= ?'); params.push(retFrom); }
  if (retTo) { where.push('last_return_on <= ?'); params.push(retTo); }
  return { where, params };
}

function custodyRows(q) {
  const { where, params } = custodyFilters(q);
  // last_return_on is a derived column, so the filters run on the wrapped query.
  return all(`
    SELECT * FROM (
      SELECT c.*, ${OUTSTANDING} AS outstanding,
             m.name AS member_name, m.member_status, m.phone AS member_phone,
             t.name AS type_name, t.category AS type_category,
             iss.issuer_name,
             (SELECT MAX(x.occurred_on) FROM EquipmentTransactions x
               WHERE x.custody_id = c.id AND x.direction = 'in' AND x.kind IN ('return','replace')) AS last_return_on
      FROM MemberEquipment c
      JOIN TeamMembers m ON m.id = c.member_id
      JOIN EquipmentTypes t ON t.id = c.type_id
      JOIN EquipmentIssues iss ON iss.id = c.issue_id
      WHERE 1 = 1 ${where.filter((w) => !w.startsWith('last_return_on')).map((w) => `AND ${w}`).join(' ')}
    ) WHERE 1 = 1 ${where.filter((w) => w.startsWith('last_return_on')).map((w) => `AND ${w}`).join(' ')}
    ORDER BY issued_on DESC, id DESC`, ...params);
}

router.get('/custody', canView, wrap(async (req, res) => {
  res.json(custodyRows(req.query));
}));

// One member: the roster fields, every custody line and the unreturned total.
router.get('/members/:id', canView, wrap(async (req, res) => {
  const id = idParam(req);
  const member = id && one('SELECT id, name, phone, photo_url, group_name, role_title, member_status FROM TeamMembers WHERE id = ?', id);
  if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
  const custody = custodyRows({ member_id: id });
  const outstanding = custody.reduce((n, r) => n + r.outstanding, 0);
  res.json({ member, custody, outstanding, status_label: MEMBER_STATUS[member.member_status] });
}));

// ---------- delivery ----------
router.post('/issues', canHandle, wrap(async (req, res) => {
  const memberId = posInt(req.body.member_id);
  const issueDate = dateOnly(req.body.issue_date) || today();
  const issuer = str(req.body.issuer_name, 120);
  const notes = str(req.body.notes, 1000);
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!memberId) throw bad('اختر العضو');
  if (!issuer) throw bad('اسم المسؤول عن التسليم مطلوب');
  if (rawItems.length === 0) throw bad('اختر غرضاً واحداً على الأقل');

  // Same stock line chosen twice -> one line with the summed quantity.
  const wanted = new Map();
  for (const it of rawItems) {
    const invId = posInt(it.inventory_id);
    const qty = posInt(it.quantity);
    if (!invId || !qty) throw bad('تأكد من الغرض والكمية في كل سطر');
    wanted.set(invId, (wanted.get(invId) || 0) + qty);
  }

  const result = inTransaction((db) => {
    const member = db.prepare('SELECT id, name, member_status FROM TeamMembers WHERE id = ?').get(memberId);
    if (!member) throw bad('العضو غير موجود', 404);
    if (member.member_status !== 'active') {
      throw bad(`لا يمكن تسليم عُهدة لعضو حالته «${MEMBER_STATUS[member.member_status]}»`, 409);
    }
    const issueId = Number(db.prepare(
      'INSERT INTO EquipmentIssues (member_id, issue_date, issuer_name, notes, created_by) VALUES (?,?,?,?,?)'
    ).run(memberId, issueDate, issuer, notes, req.user.id).lastInsertRowid);

    const custodyIds = [];
    for (const [invId, qty] of wanted) {
      const line = getLine(db, invId);
      if (!line) throw bad('أحد الأغراض المختارة غير موجود', 404);
      if (!line.type_active) throw bad(`النوع «${line.type_name}» معطّل`, 409);
      if (line.in_stock < qty) {
        throw bad(`الكمية المتوفرة من «${lineLabel(line)}» هي ${line.in_stock} فقط`, 409);
      }
      const upd = db.prepare('UPDATE EquipmentInventory SET in_stock = in_stock - ?, updated_at = datetime(\'now\') WHERE id = ? AND in_stock >= ?').run(qty, invId, qty);
      if (upd.changes !== 1) throw bad(`تعذّر حجز «${lineLabel(line)}»، حدّث الصفحة وأعد المحاولة`, 409);
      const custodyId = Number(db.prepare(`INSERT INTO MemberEquipment
        (issue_id, member_id, type_id, inventory_id, size, serial_number, quantity, issued_on, notes)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(issueId, memberId, line.type_id, invId, line.size, line.serial_number, qty, issueDate, notes).lastInsertRowid);
      custodyIds.push(custodyId);
      appendTx(db, req.user, {
        kind: 'issue', direction: 'out', member_id: memberId, member_name: member.name, type_id: line.type_id, type_name: line.type_name,
        inventory_id: invId, custody_id: custodyId, issue_id: issueId, size: line.size, serial_number: line.serial_number,
        quantity: qty, party_name: issuer, occurred_on: issueDate, notes,
      });
    }
    return { id: issueId, custody_ids: custodyIds };
  });
  res.status(201).json(result);
}));

// Data for the printable receipt form.
router.get('/issues/:id', canView, wrap(async (req, res) => {
  const id = idParam(req);
  const issue = id && one(`SELECT i.*, m.name AS member_name, m.phone AS member_phone, m.member_status
    FROM EquipmentIssues i JOIN TeamMembers m ON m.id = i.member_id WHERE i.id = ?`, id);
  if (!issue) return res.status(404).json({ error: 'سجل التسليم غير موجود' });
  const items = all(`SELECT c.id, c.quantity, c.size, c.serial_number, t.name AS type_name, t.category
    FROM MemberEquipment c JOIN EquipmentTypes t ON t.id = c.type_id WHERE c.issue_id = ? ORDER BY c.id`, id);
  res.json({ issue, items });
}));

router.get('/members/:id/issues', canView, wrap(async (req, res) => {
  const id = idParam(req);
  res.json(id ? all(`SELECT i.id, i.issue_date, i.issuer_name,
      (SELECT COUNT(*) FROM MemberEquipment c WHERE c.issue_id = i.id) AS lines
    FROM EquipmentIssues i WHERE i.member_id = ? ORDER BY i.issue_date DESC, i.id DESC`, id) : []);
}));

// ---------- return / loss / replacement ----------
function getCustody(db, id) {
  return db.prepare(`SELECT c.*, ${OUTSTANDING} AS outstanding, m.name AS member_name, t.name AS type_name
    FROM MemberEquipment c JOIN TeamMembers m ON m.id = c.member_id JOIN EquipmentTypes t ON t.id = c.type_id
    WHERE c.id = ?`).get(id);
}
function closeIfDone(db, custodyId, date) {
  db.prepare(`UPDATE MemberEquipment SET closed_on = ?
    WHERE id = ? AND quantity - returned_qty - returned_damaged_qty - damaged_qty - lost_qty = 0 AND closed_on IS NULL`).run(date, custodyId);
}

// Moves `qty` of a custody line back into the warehouse (good condition) or
// the maintenance pile (damaged). Shared by returns and replacements.
function applyReturn(db, user, c, qty, condition, date, receiver, notes, kind) {
  if (qty > c.outstanding) throw bad(`المتبقي بحوزة العضو من «${c.type_name}» هو ${c.outstanding} فقط`, 409);
  const good = condition === 'good';
  db.prepare(`UPDATE MemberEquipment SET ${good ? 'returned_qty = returned_qty + ?' : 'returned_damaged_qty = returned_damaged_qty + ?'} WHERE id = ?`).run(qty, c.id);
  db.prepare(`UPDATE EquipmentInventory SET ${good ? 'in_stock = in_stock + ?' : 'damaged = damaged + ?'}, updated_at = datetime('now') WHERE id = ?`).run(qty, c.inventory_id);
  closeIfDone(db, c.id, date);
  appendTx(db, user, {
    kind, direction: 'in', member_id: c.member_id, member_name: c.member_name, type_id: c.type_id, type_name: c.type_name,
    inventory_id: c.inventory_id, custody_id: c.id, issue_id: c.issue_id, size: c.size, serial_number: c.serial_number,
    quantity: qty, condition, party_name: receiver, occurred_on: date, notes,
  });
}

// Body: { date, receiver, items: [{ custody_id, quantity, condition, notes }] }
// Returning only some lines (or only part of a line) leaves the rest open.
router.post('/returns', canHandle, wrap(async (req, res) => {
  const date = dateOnly(req.body.date) || today();
  const receiver = str(req.body.receiver, 120);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!receiver) throw bad('اسم المسؤول عن الاستلام مطلوب');
  if (items.length === 0) throw bad('اختر غرضاً واحداً على الأقل');
  inTransaction((db) => {
    for (const it of items) {
      const qty = posInt(it.quantity);
      if (!qty) throw bad('الكمية غير صحيحة');
      if (!RETURN_CONDITIONS.includes(it.condition)) throw bad('حالة الغرض غير صحيحة');
      const c = getCustody(db, posInt(it.custody_id));
      if (!c) throw bad('بند العهدة غير موجود', 404);
      if (it.condition !== 'good' && !str(it.notes, 1000)) throw bad(`اكتب ملاحظة عن حالة «${c.type_name}»`);
      applyReturn(db, req.user, c, qty, it.condition, date, receiver, str(it.notes, 1000), 'return');
    }
  });
  res.json({ ok: true });
}));

// Documents an item that will not come back: lost, or damaged beyond use.
router.post('/custody/:id/loss', canHandle, wrap(async (req, res) => {
  const id = idParam(req);
  const qty = posInt(req.body.quantity);
  const kind = req.body.kind === 'damaged' ? 'damaged' : req.body.kind === 'lost' ? 'lost' : null;
  const date = dateOnly(req.body.date) || today();
  const person = str(req.body.person, 120);
  const notes = str(req.body.notes, 1000);
  if (!id || !qty || !kind) throw bad('بيانات غير مكتملة');
  if (!person) throw bad('اسم المسؤول مطلوب');
  if (!notes) throw bad('الملاحظات مطلوبة لتوثيق التلف أو الفقدان');
  inTransaction((db) => {
    const c = getCustody(db, id);
    if (!c) throw bad('بند العهدة غير موجود', 404);
    if (qty > c.outstanding) throw bad(`المتبقي بحوزة العضو من «${c.type_name}» هو ${c.outstanding} فقط`, 409);
    db.prepare(`UPDATE MemberEquipment SET ${kind === 'lost' ? 'lost_qty = lost_qty + ?' : 'damaged_qty = damaged_qty + ?'} WHERE id = ?`).run(qty, id);
    closeIfDone(db, id, date);
    appendTx(db, req.user, {
      kind, member_id: c.member_id, member_name: c.member_name, type_id: c.type_id, type_name: c.type_name,
      inventory_id: c.inventory_id, custody_id: id, issue_id: c.issue_id, size: c.size, serial_number: c.serial_number,
      quantity: qty, party_name: person, occurred_on: date, notes,
    });
  });
  res.json({ ok: true });
}));

// Swaps an old item for a new one: the old is taken back (or written off) and
// the replacement is issued to the same member under a new receipt.
router.post('/custody/:id/replace', canHandle, wrap(async (req, res) => {
  const id = idParam(req);
  const qty = posInt(req.body.quantity);
  const newInvId = posInt(req.body.new_inventory_id);
  const oldCondition = ['good', 'needs_maintenance', 'damaged', 'lost'].includes(req.body.old_condition) ? req.body.old_condition : null;
  const date = dateOnly(req.body.date) || today();
  const person = str(req.body.person, 120);
  const notes = str(req.body.notes, 1000);
  if (!id || !qty || !newInvId || !oldCondition) throw bad('بيانات غير مكتملة');
  if (!person) throw bad('اسم المسؤول مطلوب');
  if (oldCondition !== 'good' && !notes) throw bad('اكتب ملاحظة عن حالة الغرض القديم');

  const result = inTransaction((db) => {
    const c = getCustody(db, id);
    if (!c) throw bad('بند العهدة غير موجود', 404);
    const member = db.prepare('SELECT member_status FROM TeamMembers WHERE id = ?').get(c.member_id);
    if (member.member_status !== 'active') throw bad('لا يمكن تبديل غرض لعضو غير فعّال، استرجعه بدلاً من ذلك', 409);
    if (qty > c.outstanding) throw bad(`المتبقي بحوزة العضو من «${c.type_name}» هو ${c.outstanding} فقط`, 409);

    // 1. take the old item back
    if (oldCondition === 'lost') {
      db.prepare('UPDATE MemberEquipment SET lost_qty = lost_qty + ? WHERE id = ?').run(qty, id);
      closeIfDone(db, id, date);
      appendTx(db, req.user, {
        kind: 'replace', member_id: c.member_id, member_name: c.member_name, type_id: c.type_id, type_name: c.type_name,
        inventory_id: c.inventory_id, custody_id: id, issue_id: c.issue_id, size: c.size, serial_number: c.serial_number,
        quantity: qty, condition: 'lost', party_name: person, occurred_on: date, notes: notes ? `تبديل (القديم مفقود): ${notes}` : 'تبديل (القديم مفقود)',
      });
    } else {
      applyReturn(db, req.user, c, qty, oldCondition, date, person, notes ? `تبديل: ${notes}` : 'تبديل', 'replace');
    }

    // 2. issue the new one to the same member
    const line = getLine(db, newInvId);
    if (!line) throw bad('الغرض الجديد غير موجود', 404);
    if (!line.type_active) throw bad(`النوع «${line.type_name}» معطّل`, 409);
    if (line.in_stock < qty) throw bad(`الكمية المتوفرة من «${lineLabel(line)}» هي ${line.in_stock} فقط`, 409);
    const upd = db.prepare('UPDATE EquipmentInventory SET in_stock = in_stock - ?, updated_at = datetime(\'now\') WHERE id = ? AND in_stock >= ?').run(qty, newInvId, qty);
    if (upd.changes !== 1) throw bad('تعذّر حجز الغرض الجديد، أعد المحاولة', 409);
    const issueId = Number(db.prepare('INSERT INTO EquipmentIssues (member_id, issue_date, issuer_name, notes, created_by) VALUES (?,?,?,?,?)')
      .run(c.member_id, date, person, notes ? `تبديل: ${notes}` : 'تبديل غرض', req.user.id).lastInsertRowid);
    const newCustody = Number(db.prepare(`INSERT INTO MemberEquipment
      (issue_id, member_id, type_id, inventory_id, size, serial_number, quantity, issued_on, replaced_from_id, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(issueId, c.member_id, line.type_id, newInvId, line.size, line.serial_number, qty, date, id, notes).lastInsertRowid);
    appendTx(db, req.user, {
      kind: 'replace', direction: 'out', member_id: c.member_id, member_name: c.member_name, type_id: line.type_id, type_name: line.type_name,
      inventory_id: newInvId, custody_id: newCustody, issue_id: issueId, size: line.size, serial_number: line.serial_number,
      quantity: qty, party_name: person, occurred_on: date, notes: notes ? `تبديل (الجديد): ${notes}` : 'تبديل (الجديد)',
    });
    return { issue_id: issueId };
  });
  res.status(201).json(result);
}));

// ---------- item types ----------
const typeStockSql = `
  SELECT t.*,
    COALESCE((SELECT SUM(i.in_stock) FROM EquipmentInventory i WHERE i.type_id = t.id), 0) AS in_stock,
    COALESCE((SELECT SUM(i.damaged) FROM EquipmentInventory i WHERE i.type_id = t.id), 0) AS damaged,
    COALESCE((SELECT SUM(${OUTSTANDING}) FROM MemberEquipment c WHERE c.type_id = t.id), 0) AS with_members
  FROM EquipmentTypes t`;

const withSizes = (row) => ({ ...row, sizes: parseSizes(row.sizes), tracks_serial: !!row.tracks_serial, active: !!row.active });

router.get('/types', canView, wrap(async (req, res) => {
  res.json(all(`${typeStockSql} ORDER BY t.active DESC, t.category, t.name`).map(withSizes));
}));

function readType(b) {
  const name = str(b.name, 120);
  if (!name) throw bad('اسم الغرض مطلوب');
  const minStock = b.min_stock === '' || b.min_stock === null || b.min_stock === undefined ? null : nonNegInt(b.min_stock);
  if (b.min_stock !== '' && b.min_stock !== null && b.min_stock !== undefined && minStock === null) throw bad('الحد الأدنى للمخزون رقم صحيح');
  return {
    name, category: str(b.category, 80), description: str(b.description, 500),
    sizes: JSON.stringify(readSizes(b.sizes)), tracks_serial: b.tracks_serial ? 1 : 0,
    min_stock: minStock, active: b.active === false ? 0 : 1,
  };
}
const dupMessage = (err) => (err.kind === 'unique_violation' || /UNIQUE/i.test(err.message) ? bad('يوجد غرض بهذا الاسم مسبقاً', 409) : err);

router.post('/types', canManage, wrap(async (req, res) => {
  const t = readType(req.body);
  try {
    const info = getDb().prepare('INSERT INTO EquipmentTypes (name, category, description, sizes, tracks_serial, min_stock, active) VALUES (?,?,?,?,?,?,?)')
      .run(t.name, t.category, t.description, t.sizes, t.tracks_serial, t.min_stock, t.active);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (err) { throw dupMessage(err); }
}));

router.put('/types/:id', canManage, wrap(async (req, res) => {
  const id = idParam(req);
  const t = readType(req.body);
  const cur = id && one('SELECT tracks_serial FROM EquipmentTypes WHERE id = ?', id);
  if (!cur) throw bad('غير موجود', 404);
  if (!!cur.tracks_serial !== !!t.tracks_serial && one('SELECT 1 AS x FROM EquipmentInventory WHERE type_id = ?', id)) {
    throw bad('لا يمكن تغيير طريقة التتبع بالرقم التسلسلي بعد إضافة مخزون لهذا الغرض', 409);
  }
  try {
    getDb().prepare(`UPDATE EquipmentTypes SET name=?, category=?, description=?, sizes=?, tracks_serial=?, min_stock=?, active=?, updated_at=datetime('now') WHERE id=?`)
      .run(t.name, t.category, t.description, t.sizes, t.tracks_serial, t.min_stock, t.active, id);
  } catch (err) { throw dupMessage(err); }
  res.json({ ok: true });
}));

// A type with stock or history is deactivated instead of deleted.
router.delete('/types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.json({ ok: true });
  if (one('SELECT 1 AS x FROM EquipmentInventory WHERE type_id = ?', id) || one('SELECT 1 AS x FROM EquipmentTransactions WHERE type_id = ?', id)) {
    throw bad('لهذا الغرض مخزون أو سجل حركات، عطّله بدلاً من حذفه للحفاظ على السجل', 409);
  }
  getDb().prepare('DELETE FROM EquipmentTypes WHERE id = ?').run(id);
  res.json({ ok: true });
}));

// ---------- warehouse stock ----------
router.get('/inventory', canView, wrap(async (req, res) => {
  const typeId = posInt(req.query.type_id);
  res.json(all(`
    SELECT i.*, t.name AS type_name, t.category, t.active AS type_active, t.tracks_serial,
      COALESCE((SELECT SUM(${OUTSTANDING}) FROM MemberEquipment c WHERE c.inventory_id = i.id), 0) AS with_members
    FROM EquipmentInventory i JOIN EquipmentTypes t ON t.id = i.type_id
    ${typeId ? 'WHERE i.type_id = ?' : ''} ORDER BY t.name, i.size, i.serial_number`, ...(typeId ? [typeId] : []))
    .map((r) => ({ ...r, type_active: !!r.type_active, tracks_serial: !!r.tracks_serial })));
}));

// Adds stock. A (type, size) line that already exists just gains quantity.
router.post('/inventory', canManage, wrap(async (req, res) => {
  const typeId = posInt(req.body.type_id);
  const notes = str(req.body.notes, 500);
  const date = dateOnly(req.body.date) || today();
  const id = inTransaction((db) => {
    const type = typeId && db.prepare('SELECT * FROM EquipmentTypes WHERE id = ?').get(typeId);
    if (!type) throw bad('اختر نوع الغرض', 404);
    const sizes = parseSizes(type.sizes);
    const size = str(req.body.size, 30) || '';
    if (sizes.length && !sizes.includes(size)) throw bad('اختر مقاساً من المقاسات المتاحة لهذا الغرض');
    if (!sizes.length && size) throw bad('هذا الغرض لا يحتوي مقاسات');
    let serial = str(req.body.serial_number, 80);
    let qty = posInt(req.body.quantity);
    if (type.tracks_serial) {
      if (!serial) throw bad('الرقم التسلسلي مطلوب لهذا الغرض');
      qty = 1;
    } else {
      serial = null;
      if (!qty) throw bad('الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر');
    }
    let lineId;
    try {
      const existing = serial ? null : db.prepare('SELECT id FROM EquipmentInventory WHERE type_id = ? AND size = ? AND serial_number IS NULL').get(typeId, size);
      if (existing) {
        db.prepare("UPDATE EquipmentInventory SET in_stock = in_stock + ?, updated_at = datetime('now') WHERE id = ?").run(qty, existing.id);
        lineId = existing.id;
      } else {
        lineId = Number(db.prepare('INSERT INTO EquipmentInventory (type_id, size, serial_number, in_stock, notes) VALUES (?,?,?,?,?)')
          .run(typeId, size, serial, qty, notes).lastInsertRowid);
      }
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw bad('هذا الرقم التسلسلي مسجّل مسبقاً لهذا الغرض', 409);
      throw err;
    }
    appendTx(db, req.user, {
      kind: 'adjust', direction: 'in', type_id: typeId, type_name: type.name, inventory_id: lineId, size, serial_number: serial,
      quantity: qty, occurred_on: date, notes: notes || 'إدخال إلى المخزون',
    });
    return lineId;
  });
  res.status(201).json({ id });
}));

// Corrects a stock line's counts. Each changed counter is logged with the
// mandatory reason. Items currently held by members are not touched here.
router.post('/inventory/:id/adjust', canManage, wrap(async (req, res) => {
  const id = idParam(req);
  const reason = str(req.body.reason, 500);
  if (!reason) throw bad('سبب التعديل مطلوب');
  const inStock = nonNegInt(req.body.in_stock);
  const damaged = nonNegInt(req.body.damaged);
  if (inStock === null || damaged === null) throw bad('الكميات يجب أن تكون أرقاماً صحيحة (صفر أو أكثر)');
  inTransaction((db) => {
    const line = id && getLine(db, id);
    if (!line) throw bad('غير موجود', 404);
    if (line.tracks_serial) {
      const held = db.prepare(`SELECT COALESCE(SUM(${OUTSTANDING}), 0) AS n FROM MemberEquipment c WHERE c.inventory_id = ?`).get(id).n;
      if (inStock + damaged + held > 1) throw bad('الغرض ذو الرقم التسلسلي وحدة واحدة فقط');
    }
    const date = dateOnly(req.body.date) || today();
    const changes = [
      ['in_stock', inStock - line.in_stock, 'متوفر في المستودع'],
      ['damaged', damaged - line.damaged, 'تالف / يحتاج صيانة'],
    ].filter(([, d]) => d !== 0);
    if (changes.length === 0) throw bad('لم تتغير أي كمية');
    db.prepare("UPDATE EquipmentInventory SET in_stock = ?, damaged = ?, updated_at = datetime('now') WHERE id = ?").run(inStock, damaged, id);
    for (const [, delta, label] of changes) {
      appendTx(db, req.user, {
        kind: 'adjust', direction: delta > 0 ? 'in' : 'out', type_id: line.type_id, type_name: line.type_name, inventory_id: id,
        size: line.size, serial_number: line.serial_number, quantity: Math.abs(delta), condition: label === 'تالف / يحتاج صيانة' ? 'damaged' : 'good',
        occurred_on: date, notes: `تعديل كمية (${label}): ${reason}`,
      });
    }
  });
  res.json({ ok: true });
}));

router.delete('/inventory/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.json({ ok: true });
  if (one('SELECT 1 AS x FROM MemberEquipment WHERE inventory_id = ?', id)) {
    throw bad('هذا الغرض سُلِّم لأعضاء من قبل، لا يمكن حذفه، صفِّر كميته بدلاً من ذلك', 409);
  }
  const line = one('SELECT in_stock, damaged FROM EquipmentInventory WHERE id = ?', id);
  if (line && line.in_stock + line.damaged > 0) throw bad('صفِّر الكمية أولاً (تعديل كمية) ثم احذف السطر', 409);
  try {
    getDb().prepare('DELETE FROM EquipmentInventory WHERE id = ?').run(id);
  } catch (err) {
    if (/FOREIGN KEY/i.test(err.message)) throw bad('له سجل حركات، لا يمكن حذفه، اترك كميته صفراً', 409);
    throw err;
  }
  res.json({ ok: true });
}));

// ---------- audit log ----------
function txFilters(q) {
  const where = [];
  const params = [];
  if (['issue', 'return', 'replace', 'adjust', 'damaged', 'lost'].includes(q.kind)) { where.push('x.kind = ?'); params.push(q.kind); }
  const memberId = posInt(q.member_id);
  if (memberId) { where.push('x.member_id = ?'); params.push(memberId); }
  const typeId = posInt(q.type_id);
  if (typeId) { where.push('x.type_id = ?'); params.push(typeId); }
  const from = dateOnly(q.from);
  const to = dateOnly(q.to);
  if (from) { where.push('x.occurred_on >= ?'); params.push(from); }
  if (to) { where.push('x.occurred_on <= ?'); params.push(to); }
  return { where, params };
}

router.get('/transactions', canView, wrap(async (req, res) => {
  const { where, params } = txFilters(req.query);
  const limit = Math.min(posInt(req.query.limit) || 50, 5000);
  const offset = nonNegInt(req.query.offset) || 0;
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = one(`SELECT COUNT(*) AS n FROM EquipmentTransactions x ${clause}`, ...params).n;
  const rows = all(`SELECT x.*, m.member_status FROM EquipmentTransactions x LEFT JOIN TeamMembers m ON m.id = x.member_id
    ${clause} ORDER BY x.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  res.json({ total, rows });
}));

// ---------- dashboard ----------
router.get('/dashboard', canView, wrap(async (req, res) => {
  const s = one(`
    SELECT
      (SELECT COALESCE(SUM(in_stock + damaged), 0) FROM EquipmentInventory)
        + (SELECT COALESCE(SUM(${OUTSTANDING}), 0) FROM MemberEquipment c) AS total_items,
      (SELECT COALESCE(SUM(${OUTSTANDING}), 0) FROM MemberEquipment c) AS with_members,
      (SELECT COALESCE(SUM(in_stock), 0) FROM EquipmentInventory) AS in_warehouse,
      (SELECT COALESCE(SUM(returned_qty + returned_damaged_qty), 0) FROM MemberEquipment) AS returned,
      (SELECT COALESCE(SUM(damaged), 0) FROM EquipmentInventory) AS needs_maintenance,
      (SELECT COALESCE(SUM(damaged_qty + lost_qty), 0) FROM MemberEquipment) AS written_off,
      (SELECT COUNT(DISTINCT c.member_id) FROM MemberEquipment c WHERE ${OUTSTANDING} > 0) AS members_with_items,
      (SELECT COALESCE(SUM(${OUTSTANDING}), 0) FROM MemberEquipment c JOIN TeamMembers m ON m.id = c.member_id
         WHERE m.member_status <> 'active') AS inactive_items`);
  const alerts = all(`
    SELECT m.id AS member_id, m.name AS member_name, m.member_status, SUM(${OUTSTANDING}) AS outstanding
    FROM MemberEquipment c JOIN TeamMembers m ON m.id = c.member_id
    WHERE m.member_status <> 'active' GROUP BY m.id HAVING SUM(${OUTSTANDING}) > 0 ORDER BY outstanding DESC`);
  const recent = all(`SELECT * FROM EquipmentTransactions WHERE kind IN ('issue','return','replace','damaged','lost') ORDER BY id DESC LIMIT 12`);
  const lowStock = all(`SELECT * FROM (${typeStockSql}) WHERE active = 1 AND min_stock IS NOT NULL AND in_stock < min_stock ORDER BY name`)
    .map(withSizes);
  res.json({ stats: s, alerts, recent, lowStock });
}));

// ---------- reports ----------
// One endpoint per report kind; the client renders, prints and exports them.
router.get('/reports/:kind', canView, wrap(async (req, res) => {
  const { kind } = req.params;
  const q = req.query;
  switch (kind) {
    case 'member-custody':
      if (!posInt(q.member_id)) throw bad('اختر المسعف لعرض تقرير عهدته');
      return res.json({ rows: custodyRows(q) });
    case 'held': {
      // Aggregated per item (type + size): how many are out, and with how many members.
      const groups = new Map();
      for (const r of custodyRows({ ...q, custody_status: 'active' })) {
        const key = `${r.type_id}|${r.size}`;
        const g = groups.get(key) || { type_id: r.type_id, type_name: r.type_name, category: r.type_category, size: r.size, held: 0, members: new Set(), serials: [] };
        g.held += r.outstanding;
        g.members.add(r.member_id);
        if (r.serial_number) g.serials.push(r.serial_number);
        groups.set(key, g);
      }
      return res.json({ rows: [...groups.values()].map((g) => ({ ...g, members: g.members.size, serials: g.serials.join('، ') }))
        .sort((a, b) => a.type_name.localeCompare(b.type_name, 'ar') || a.size.localeCompare(b.size)) });
    }
    case 'unreturned':
      return res.json({ rows: custodyRows({ ...q, custody_status: 'active' }) });
    case 'inactive-members':
      return res.json({ rows: custodyRows({ ...q, custody_status: 'active', member_status: q.member_status && q.member_status !== 'active' ? q.member_status : 'inactive_any' }) });
    case 'warehouse': {
      const typeId = posInt(q.type_id);
      const rows = all(`
        SELECT i.id, t.name AS type_name, t.category, i.size, i.serial_number, i.in_stock, i.damaged,
          COALESCE((SELECT SUM(${OUTSTANDING}) FROM MemberEquipment c WHERE c.inventory_id = i.id), 0) AS with_members, t.min_stock
        FROM EquipmentInventory i JOIN EquipmentTypes t ON t.id = i.type_id
        ${typeId ? 'WHERE i.type_id = ?' : ''} ORDER BY t.name, i.size, i.serial_number`, ...(typeId ? [typeId] : []));
      return res.json({ rows });
    }
    case 'movements': {
      const { where, params } = txFilters({ ...q, kind: q.kind });
      where.push("x.kind IN ('issue','return','replace')");
      return res.json({ rows: all(`SELECT x.*, m.member_status FROM EquipmentTransactions x LEFT JOIN TeamMembers m ON m.id = x.member_id
        WHERE ${where.join(' AND ')} ORDER BY x.occurred_on DESC, x.id DESC LIMIT 5000`, ...params) });
    }
    case 'damaged-lost': {
      const { where, params } = txFilters(q);
      where.push("(x.kind IN ('damaged','lost') OR x.condition IN ('damaged','needs_maintenance','lost'))");
      where.push("x.kind <> 'adjust'");
      return res.json({ rows: all(`SELECT x.*, m.member_status FROM EquipmentTransactions x LEFT JOIN TeamMembers m ON m.id = x.member_id
        WHERE ${where.join(' AND ')} ORDER BY x.occurred_on DESC, x.id DESC LIMIT 5000`, ...params) });
    }
    default:
      return res.status(404).json({ error: 'تقرير غير معروف' });
  }
}));

module.exports = router;
