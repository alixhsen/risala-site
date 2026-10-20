// Admin panel API. Every route here already passed requireAuth (see index.js).
// Editors may prepare drafts and send them for review; only the admin can
// publish, delete, or change team, gallery, settings and users.
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { adminOnly, requireModule } = require('../auth');
const { wrap, str, uploadUrl, httpUrl, dateOnly, timeOnly, idParam, intList } = require('../util');
const { listTemplates } = require('../documentTemplates');
const { renderDocx } = require('../docTemplates');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- uploads ----------
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_EXT[file.mimetype]),
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 30 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_EXT[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error('الملف يجب أن يكون صورة JPG أو PNG أو WEBP'), { status: 400 }));
  },
});

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار صورة' });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, kind: 'image' });
});

// Mission sub-media can also be a short video clip, which needs its own
// (much larger) size limit and mimetype allow-list.
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + VIDEO_EXT[file.mimetype]),
  }),
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (VIDEO_EXT[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error('الملف يجب أن يكون فيديو MP4 أو WEBM أو MOV'), { status: 400 }));
  },
});

router.post('/upload-video', uploadVideo.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار فيديو' });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, kind: 'video' });
});

// ---------- page access ----------
// An editor only reaches the admin pages the admin has granted them, one by
// one (see Users.jsx's per-page picker); the admin role always has full
// access. Page keys match the nav paths in AdminLayout.jsx exactly. A few
// endpoints are shared UI data for more than one page (a dropdown, a roster)
// and accept any of the pages that legitimately use them. Dashboard stats,
// /upload* (shared by every page's image fields) and settings/users
// (adminOnly below) are intentionally left ungated here.
router.use('/posts', requireModule('posts'));
router.use('/gallery', requireModule('gallery'));
// Team roster: the team page itself, member reports' per-member picker, and
// community donations' "team member" field all read it.
router.use('/team', requireModule(['team', 'member-reports', 'community-donations']));
router.use('/messages', requireModule('messages'));
router.use('/mission-types', requireModule('mission-types'));
// /reports/* backs the monthly report, the yearly report and member reports.
router.use('/reports', requireModule(['reports', 'yearly-report', 'member-reports']));
router.use('/service-types', requireModule('service-types'));
router.use('/service-logs', requireModule('service-logs'));
router.use('/shifts', requireModule('schedule'));
// Inventory items/units/categories back both the medical-stock page and the
// fixed-assets page (same table, split by an is_asset flag); the inventory
// report reads items, usage and loaned items read-only.
router.use('/inventory-items', requireModule(['inventory', 'inventory-assets', 'inventory-report']));
router.use('/inventory-units', requireModule(['inventory', 'inventory-assets']));
router.use('/inventory-categories', requireModule(['inventory', 'inventory-assets']));
router.use('/inventory-usage', requireModule(['inventory-usage', 'inventory-report']));
router.use('/loaned-items', requireModule(['loaned-items', 'inventory-report']));
// Ambulance categories feed the finance page's category dropdown too.
router.use('/ambulance-categories', requireModule(['ambulance-finance', 'ambulance-categories']));
router.use('/ambulance-transactions', requireModule('ambulance-finance'));
router.use('/ambulance-assets', requireModule('ambulance-assets'));
router.use('/blood-donations', requireModule('blood-donations'));
router.use('/blood-donors', requireModule('blood-donations'));
// Donation item types feed community donations' item picker too.
router.use('/donation-item-types', requireModule(['community-donations', 'donation-item-types']));
router.use('/community-donations', requireModule('community-donations'));
router.use('/document-templates', requireModule('documents'));

// ---------- dashboard ----------
router.get('/stats', wrap(async (req, res) => {
  const [row] = await query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'pending')   AS pending,
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'draft')     AS drafts,
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'published' AND category = 'mission'
        AND strftime('%Y-%m', event_date) = strftime('%Y-%m', 'now')) AS missionsThisMonth,
      (SELECT COUNT(*) FROM dbo.TeamMembers)                      AS team,
      (SELECT COUNT(*) FROM dbo.GalleryImages)                    AS gallery,
      (SELECT COUNT(*) FROM dbo.Messages WHERE is_read = 0)       AS unread,
      (SELECT COUNT(*) FROM dbo.InventoryItems WHERE expiry_date IS NOT NULL
        AND expiry_date <= date('now', '+30 days'))  AS expiringSoon,
      (SELECT COUNT(*) FROM dbo.LoanedItems WHERE status = 'out')  AS itemsOnLoan,
      (SELECT COUNT(*) FROM dbo.BloodDonations
        WHERE strftime('%Y-%m', donation_date) = strftime('%Y-%m', 'now')) AS bloodDonationsThisMonth,
      (SELECT COUNT(*) FROM dbo.CommunityDonations
        WHERE strftime('%Y-%m', donation_date) = strftime('%Y-%m', 'now')) AS communityDonationsThisMonth`);
  res.json(row);
}));

// ---------- posts ----------
const CATEGORIES = ['mission', 'activity', 'news'];

function readPost(body) {
  const category = CATEGORIES.includes(body.category) ? body.category : 'activity';
  return {
    title: str(body.title, 200),
    category,
    mission_type_id: category === 'mission' && Number.isInteger(Number(body.mission_type_id)) ? Number(body.mission_type_id) : null,
    summary: str(body.summary, 500),
    body: str(body.body, 20000),
    cover_url: uploadUrl(body.cover_url),
    event_date: dateOnly(body.event_date),
  };
}

// Editors can never set "published"; anything else falls back to draft.
function allowedStatus(requested, user) {
  if (requested === 'published') return user.role === 'admin' ? 'published' : 'pending';
  return requested === 'pending' ? 'pending' : 'draft';
}

async function replaceImages(postId, images) {
  if (!Array.isArray(images)) return;
  await query('DELETE FROM dbo.PostImages WHERE post_id = @id', { id: postId });
  const items = images
    .map((i) => ({ url: uploadUrl(i && i.url), kind: i && i.kind === 'video' ? 'video' : 'image' }))
    .filter((i) => i.url)
    .slice(0, 60);
  for (let i = 0; i < items.length; i++) {
    await query('INSERT INTO dbo.PostImages (post_id, url, kind, sort_order) VALUES (@id, @url, @kind, @i)',
      { id: postId, url: items[i].url, kind: items[i].kind, i });
  }
}

async function replaceParamedics(postId, ids) {
  await query('DELETE FROM dbo.PostParamedics WHERE post_id = @id', { id: postId });
  for (const memberId of intList(ids)) {
    await query('INSERT INTO dbo.PostParamedics (post_id, team_member_id) VALUES (@id, @m)', { id: postId, m: memberId });
  }
}

router.get('/posts', wrap(async (req, res) => {
  res.json(await query(`
    SELECT p.id, p.title, p.category, p.status, p.cover_url, p.event_date, p.updated_at, p.pinned, u.display_name AS author,
           mt.name AS mission_type_name,
           (SELECT COUNT(*) FROM dbo.PostParamedics pp WHERE pp.post_id = p.id) AS paramedic_count
    FROM dbo.Posts p
    LEFT JOIN dbo.Users u ON u.id = p.created_by
    LEFT JOIN dbo.MissionTypes mt ON mt.id = p.mission_type_id
    ORDER BY p.pinned DESC, p.updated_at DESC`));
}));

const MAX_PINNED = 3;

// Pin or unpin a post (any category share the same cap of 3). Admin-only,
// like publishing - pinning controls what the public sees first.
router.put('/posts/:id/pin', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  const pin = req.body.pinned !== false;
  if (pin) {
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM dbo.Posts WHERE pinned = 1 AND id <> @id', { id });
    if (n >= MAX_PINNED) {
      return res.status(400).json({ error: `يمكن تثبيت ${MAX_PINNED} منشورات كحد أقصى. ألغِ تثبيت واحد أولاً.` });
    }
  }
  await query('UPDATE dbo.Posts SET pinned = @pin WHERE id = @id', { id, pin: pin ? 1 : 0 });
  res.json({ ok: true, pinned: pin });
}));

router.get('/posts/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const rows = id ? await query('SELECT * FROM dbo.Posts WHERE id = @id', { id }) : [];
  if (!rows.length) return res.status(404).json({ error: 'غير موجود' });
  const images = await query('SELECT url, kind FROM dbo.PostImages WHERE post_id = @id ORDER BY sort_order, id', { id });
  const paramedics = await query('SELECT team_member_id FROM dbo.PostParamedics WHERE post_id = @id', { id });
  res.json({ ...rows[0], images, paramedic_ids: paramedics.map((p) => p.team_member_id) });
}));

router.post('/posts', wrap(async (req, res) => {
  const p = readPost(req.body);
  if (!p.title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const status = allowedStatus(req.body.status, req.user);
  const [row] = await query(`
    INSERT INTO dbo.Posts (title, category, mission_type_id, summary, body, cover_url, event_date, status, created_by, published_at)
    OUTPUT INSERTED.id
    VALUES (@title, @category, @mission_type_id, @summary, @body, @cover_url, @event_date, @status, @uid,
            CASE WHEN @status = 'published' THEN datetime('now') END)`,
    { ...p, status, uid: req.user.id });
  await replaceImages(row.id, req.body.images);
  await replaceParamedics(row.id, req.body.paramedic_ids);
  res.status(201).json({ id: row.id, status });
}));

router.put('/posts/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const rows = id ? await query('SELECT status FROM dbo.Posts WHERE id = @id', { id }) : [];
  if (!rows.length) return res.status(404).json({ error: 'غير موجود' });
  // An editor changing a live post would bypass review, so that is admin-only.
  if (rows[0].status === 'published' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'المنشور منشور، تعديله للمدير فقط' });
  }
  const p = readPost(req.body);
  if (!p.title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const status = allowedStatus(req.body.status, req.user);
  await query(`
    UPDATE dbo.Posts SET title = @title, category = @category, mission_type_id = @mission_type_id,
      summary = @summary, body = @body, cover_url = @cover_url, event_date = @event_date, status = @status,
      updated_at = datetime('now'),
      published_at = CASE WHEN @status = 'published' THEN COALESCE(published_at, datetime('now')) ELSE NULL END
    WHERE id = @id`, { ...p, status, id });
  await replaceImages(id, req.body.images);
  await replaceParamedics(id, req.body.paramedic_ids);
  res.json({ id, status });
}));

router.delete('/posts/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.Posts WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- mission types ----------
router.get('/mission-types', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.MissionTypes ORDER BY sort_order, id'));
}));

router.post('/mission-types', adminOnly, wrap(async (req, res) => {
  const name = str(req.body.name, 80);
  if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const color = str(req.body.color, 20) || '#2f9e3a';
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [row] = await query(
      'INSERT INTO dbo.MissionTypes (name, color, sort_order) OUTPUT INSERTED.id VALUES (@name, @color, @sort_order)',
      { name, color, sort_order }
    );
    res.status(201).json({ id: row.id });
  } catch (err) {
    if (err.kind === 'unique_violation') return res.status(409).json({ error: 'هذا النوع موجود مسبقاً' });
    throw err;
  }
}));

router.put('/mission-types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const name = str(req.body.name, 80);
  if (!id || !name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const color = str(req.body.color, 20) || '#2f9e3a';
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  const active = req.body.active === false ? 0 : 1;
  await query(
    'UPDATE dbo.MissionTypes SET name = @name, color = @color, sort_order = @sort_order, active = @active WHERE id = @id',
    { id, name, color, sort_order, active }
  );
  res.json({ ok: true });
}));

router.delete('/mission-types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('UPDATE dbo.Posts SET mission_type_id = NULL WHERE mission_type_id = @id', { id });
  if (id) await query('DELETE FROM dbo.MissionTypes WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- reports ----------
router.get('/reports/paramedics', adminOnly, wrap(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Math.min(Math.max(Number(req.query.month) || now.getUTCMonth() + 1, 1), 12);

  const missions = await query(
    `SELECT p.id, p.title, p.event_date, mt.name AS type_name
     FROM dbo.Posts p LEFT JOIN dbo.MissionTypes mt ON mt.id = p.mission_type_id
     WHERE p.category = 'mission' AND p.status = 'published'
       AND CAST(strftime('%Y', p.event_date) AS INTEGER) = @year AND CAST(strftime('%m', p.event_date) AS INTEGER) = @month
     ORDER BY p.event_date`,
    { year, month }
  );

  const links = missions.length
    ? await query(
        `SELECT pp.post_id, tm.id, tm.name, tm.group_name, tm.photo_url
         FROM dbo.PostParamedics pp JOIN dbo.TeamMembers tm ON tm.id = pp.team_member_id
         WHERE pp.post_id IN (${missions.map((m) => m.id).join(',')})`
      )
    : [];

  const byMember = new Map();
  for (const link of links) {
    if (!byMember.has(link.id)) {
      byMember.set(link.id, { id: link.id, name: link.name, group_name: link.group_name, photo_url: link.photo_url, missions: [] });
    }
    const mission = missions.find((m) => m.id === link.post_id);
    byMember.get(link.id).missions.push({ id: mission.id, title: mission.title, event_date: mission.event_date, type_name: mission.type_name });
  }

  const paramedics = [...byMember.values()]
    .map((p) => ({ ...p, count: p.missions.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));

  res.json({ year, month, totalMissions: missions.length, paramedics });
}));

// ---------- team ----------
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// The stored name is the full name: first name + father + family name. Every
// screen that shows `name` therefore shows the full name.
const readMember = (b) => {
  const first_name = str(b.first_name, 120) || str(b.name, 120);
  const father_name = str(b.father_name, 120);
  const family_name = str(b.family_name, 120);
  return {
    ...readMemberFields(b),
    first_name,
    father_name,
    family_name,
    name: str([first_name, father_name, family_name].filter(Boolean).join(' '), 400),
  };
};

const readMemberFields = (b) => ({
  role_title: str(b.role_title, 120),
  group_name: str(b.group_name, 80),
  photo_url: uploadUrl(b.photo_url),
  sort_order: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0,
  visible: b.visible === false ? 0 : 1,
  mother_name: str(b.mother_name, 120),
  nickname: str(b.nickname, 80),
  birth_date: dateOnly(b.birth_date),
  birth_place: str(b.birth_place, 120),
  blood_type: BLOOD_TYPES.includes(b.blood_type) ? b.blood_type : null,
  registry_no: str(b.registry_no, 40),
  education: str(b.education, 80),
  phone: str(b.phone, 40),
  address: str(b.address, 200),
  joined_on: dateOnly(b.joined_on),
  scout_unit: str(b.scout_unit, 120),
  district: str(b.district, 120),
  region: str(b.region, 120),
  town: str(b.town, 120),
  notes: str(b.notes, 1000),
  has_license: b.has_license ? 1 : 0,
  license_number: str(b.license_number, 50),
  license_front_url: uploadUrl(b.license_front_url),
  license_back_url: uploadUrl(b.license_back_url),
});

const MEMBER_COLUMNS = `name, first_name, family_name, role_title, group_name, photo_url, sort_order, visible,
  father_name, mother_name, nickname, birth_date, birth_place, blood_type, registry_no,
  education, phone, address, joined_on, scout_unit, district, region, town, notes,
  has_license, license_number, license_front_url, license_back_url`;
const MEMBER_PARAMS = `@name, @first_name, @family_name, @role_title, @group_name, @photo_url, @sort_order, @visible,
  @father_name, @mother_name, @nickname, @birth_date, @birth_place, @blood_type, @registry_no,
  @education, @phone, @address, @joined_on, @scout_unit, @district, @region, @town, @notes,
  @has_license, @license_number, @license_front_url, @license_back_url`;

router.get('/team', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.TeamMembers ORDER BY sort_order, id'));
}));

// One member's history for a chosen month and year (month 0 = whole year; the
// default is the current month). Each list is paginated, so a long history
// never has to load at once.
const HISTORY_PAGE = 10;
router.get('/team/:id/history', wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  const now = new Date();
  const reqYear = Number(req.query.year);
  const year = Number.isInteger(reqYear) && reqYear >= 2000 && reqYear <= 2100 ? reqYear : now.getFullYear();
  const month = req.query.month === undefined ? now.getMonth() + 1 : Math.min(Math.max(Number(req.query.month) || 0, 0), 12);
  const pageOf = (v) => Math.max(1, Number.parseInt(v, 10) || 1);

  const mWhere = `CAST(strftime('%Y', p.event_date) AS INTEGER) = @year${month ? " AND CAST(strftime('%m', p.event_date) AS INTEGER) = @month" : ''}`;
  const sWhere = `CAST(strftime('%Y', l.service_date) AS INTEGER) = @year${month ? " AND CAST(strftime('%m', l.service_date) AS INTEGER) = @month" : ''}`;
  const period = { id, year, month };

  const [mCount] = await query(
    `SELECT COUNT(*) AS n FROM dbo.PostParamedics pp JOIN dbo.Posts p ON p.id = pp.post_id
     WHERE pp.team_member_id = @id AND p.category = 'mission' AND ${mWhere}`,
    period
  );
  const [sCount] = await query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(l.quantity), 0) AS qty
     FROM dbo.ServiceLogs l WHERE l.team_member_id = @id AND ${sWhere}`,
    period
  );
  const mPages = Math.max(1, Math.ceil(mCount.n / HISTORY_PAGE));
  const sPages = Math.max(1, Math.ceil(sCount.n / HISTORY_PAGE));
  const mpage = Math.min(pageOf(req.query.mpage), mPages);
  const spage = Math.min(pageOf(req.query.spage), sPages);

  const missions = await query(
    `SELECT p.id, p.title, p.event_date, p.status, mt.name AS type_name
     FROM dbo.PostParamedics pp
     JOIN dbo.Posts p ON p.id = pp.post_id
     LEFT JOIN dbo.MissionTypes mt ON mt.id = p.mission_type_id
     WHERE pp.team_member_id = @id AND p.category = 'mission' AND ${mWhere}
     ORDER BY p.event_date DESC, p.id DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...period, offset: (mpage - 1) * HISTORY_PAGE, size: HISTORY_PAGE }
  );
  const services = await query(
    `SELECT l.id, l.quantity, l.service_date, l.notes, st.name AS type_name
     FROM dbo.ServiceLogs l
     JOIN dbo.ServiceTypes st ON st.id = l.service_type_id
     WHERE l.team_member_id = @id AND ${sWhere}
     ORDER BY l.service_date DESC, l.id DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...period, offset: (spage - 1) * HISTORY_PAGE, size: HISTORY_PAGE }
  );

  // Every year this member has any record in, so the year picker only offers real periods.
  const yearRows = await query(
    `SELECT DISTINCT CAST(strftime('%Y', p.event_date) AS INTEGER) AS y FROM dbo.PostParamedics pp
       JOIN dbo.Posts p ON p.id = pp.post_id
       WHERE pp.team_member_id = @id AND p.category = 'mission' AND p.event_date IS NOT NULL
     UNION
     SELECT DISTINCT CAST(strftime('%Y', service_date) AS INTEGER) AS y FROM dbo.ServiceLogs WHERE team_member_id = @id
     ORDER BY y DESC`,
    { id }
  );

  res.json({
    year,
    month,
    years: yearRows.map((r) => r.y).filter(Boolean),
    missions: { total: mCount.n, page: mpage, pages: mPages, pageSize: HISTORY_PAGE, items: missions },
    services: { total: sCount.n, quantity: sCount.qty, page: spage, pages: sPages, pageSize: HISTORY_PAGE, items: services },
  });
}));

router.post('/team', adminOnly, wrap(async (req, res) => {
  const m = readMember(req.body);
  if (!m.name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const [row] = await query(`
    INSERT INTO dbo.TeamMembers (${MEMBER_COLUMNS})
    OUTPUT INSERTED.id VALUES (${MEMBER_PARAMS})`, m);
  res.status(201).json({ id: row.id });
}));

router.put('/team/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const m = readMember(req.body);
  if (!id || !m.name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const sets = MEMBER_COLUMNS.split(',').map((c) => c.trim()).map((c) => `${c} = @${c}`).join(', ');
  await query(`UPDATE dbo.TeamMembers SET ${sets} WHERE id = @id`, { ...m, id });
  res.json({ ok: true });
}));

router.delete('/team/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.TeamMembers WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- gallery ----------
router.get('/gallery', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.GalleryImages ORDER BY created_at DESC, id DESC'));
}));

router.post('/gallery', adminOnly, upload.array('images', 30), wrap(async (req, res) => {
  const album = str(req.body.album, 80);
  for (const file of req.files || []) {
    await query('INSERT INTO dbo.GalleryImages (url, album) VALUES (@url, @album)', { url: `/uploads/${file.filename}`, album });
  }
  res.status(201).json({ added: (req.files || []).length });
}));

router.put('/gallery/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  await query('UPDATE dbo.GalleryImages SET caption = @caption, album = @album, visible = @visible WHERE id = @id', {
    id, caption: str(req.body.caption, 200), album: str(req.body.album, 80), visible: req.body.visible === false ? 0 : 1,
  });
  res.json({ ok: true });
}));

router.delete('/gallery/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.GalleryImages WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- settings ----------
const TEXT_KEYS = ['site_name', 'line1', 'line2', 'line3', 'tagline', 'about_text', 'history_text',
  'phone', 'whatsapp', 'stat_volunteers', 'stat_vehicles', 'stat_missions', 'stat_years',
  'hero_quote', 'hero_quote_author', 'report_photos', 'blood_phones'];
const IMAGE_KEYS = ['logo_url', 'hero_url'];
const LINK_KEYS = ['facebook', 'instagram', 'donate_url', 'whatsapp_channel'];

router.put('/settings', adminOnly, wrap(async (req, res) => {
  const values = {};
  for (const k of TEXT_KEYS) if (k in req.body) values[k] = str(req.body[k], 8000) || '';
  for (const k of IMAGE_KEYS) if (k in req.body) values[k] = uploadUrl(req.body[k]) || '';
  for (const k of LINK_KEYS) if (k in req.body) values[k] = httpUrl(req.body[k]);
  for (const [k, v] of Object.entries(values)) {
    await query(`
      INSERT INTO dbo.Settings ([key], value) VALUES (@k, @v)
      ON CONFLICT([key]) DO UPDATE SET value = excluded.value`, { k, v });
  }
  res.json({ ok: true });
}));

// ---------- messages ----------
router.get('/messages', adminOnly, wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.Messages ORDER BY created_at DESC LIMIT 500'));
}));

router.put('/messages/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('UPDATE dbo.Messages SET is_read = @r WHERE id = @id', { id, r: req.body.is_read ? 1 : 0 });
  res.json({ ok: true });
}));

router.delete('/messages/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.Messages WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- users ----------
// Every grantable admin page. Keep in sync with PAGE_GROUPS in
// client/src/pages/admin/Users.jsx and the nav paths in AdminLayout.jsx.
const MODULE_KEYS = [
  'posts', 'generator', 'gallery', 'team', 'messages',
  'mission-types', 'reports', 'yearly-report', 'member-reports', 'service-types', 'service-logs', 'schedule',
  'inventory', 'inventory-assets', 'inventory-units', 'inventory-categories', 'inventory-usage', 'loaned-items', 'inventory-report',
  'ambulance-finance', 'ambulance-categories', 'ambulance-assets',
  'blood-donations', 'community-donations', 'donation-item-types',
  'documents',
];
const readPermissions = (body) => (
  Array.isArray(body.permissions) ? JSON.stringify(body.permissions.filter((k) => MODULE_KEYS.includes(k))) : null
);
const parsePermissions = (row) => {
  let permissions = [];
  try { permissions = JSON.parse(row.permissions || '[]'); } catch { permissions = []; }
  return { ...row, permissions: Array.isArray(permissions) ? permissions : [] };
};

router.get('/users', adminOnly, wrap(async (req, res) => {
  const rows = await query('SELECT id, username, display_name, role, permissions, active, created_at FROM dbo.Users ORDER BY id');
  res.json(rows.map(parsePermissions));
}));

router.post('/users', adminOnly, wrap(async (req, res) => {
  const username = str(req.body.username, 50);
  const display_name = str(req.body.display_name, 100) || username;
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role === 'admin' ? 'admin' : 'editor';
  if (!username || !/^[A-Za-z0-9._-]{3,50}$/.test(username)) return res.status(400).json({ error: 'اسم المستخدم: أحرف إنجليزية وأرقام (3 على الأقل)' });
  if (password.length < 8) return res.status(400).json({ error: 'كلمة المرور 8 أحرف على الأقل' });
  const exists = await query('SELECT 1 AS x FROM dbo.Users WHERE username = @u', { u: username });
  if (exists.length) return res.status(409).json({ error: 'اسم المستخدم مستعمل' });
  await query('INSERT INTO dbo.Users (username, password_hash, display_name, role, permissions) VALUES (@u, @p, @d, @r, @perm)',
    { u: username, p: await bcrypt.hash(password, 12), d: display_name, r: role, perm: role === 'admin' ? null : readPermissions(req.body) });
  res.status(201).json({ ok: true });
}));

router.put('/users/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  if (id === req.user.id && req.body.active === false) return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك' });
  if (id === req.user.id && req.body.role === 'editor') return res.status(400).json({ error: 'لا يمكنك إزالة صلاحية المدير عن حسابك' });
  if (typeof req.body.active === 'boolean') {
    await query('UPDATE dbo.Users SET active = @a WHERE id = @id', { id, a: req.body.active ? 1 : 0 });
  }
  if (req.body.role === 'admin' || req.body.role === 'editor') {
    await query('UPDATE dbo.Users SET role = @r, permissions = @perm WHERE id = @id',
      { id, r: req.body.role, perm: req.body.role === 'admin' ? null : readPermissions(req.body) });
  }
  if (typeof req.body.password === 'string' && req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'كلمة المرور 8 أحرف على الأقل' });
    await query('UPDATE dbo.Users SET password_hash = @p WHERE id = @id', { id, p: await bcrypt.hash(req.body.password, 12) });
  }
  res.json({ ok: true });
}));

// ---------- inventory: medical/consumable stock ----------
const ASSET_CONDITIONS = ['ممتاز', 'جيد', 'يحتاج صيانة', 'خارج الخدمة'];
const intOrNull = (v) => (v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null);

// `manufacturer` (brand/maker, e.g. "Elsada") is distinct from `source`
// (how it was obtained - donation, purchase, hospital). `is_asset` marks
// durable, reusable equipment (a wheelchair, a monitor) rather than stock
// that depletes - the location/condition/serial/maintenance fields are only
// meaningful for those. `min_quantity` is an optional reorder threshold.
const readInventoryItem = (b) => ({
  name: str(b.name, 150),
  manufacturer: str(b.manufacturer, 150),
  category: str(b.category, 60),
  unit: str(b.unit, 30),
  quantity: Number.isInteger(Number(b.quantity)) && Number(b.quantity) >= 0 ? Number(b.quantity) : 0,
  min_quantity: intOrNull(b.min_quantity),
  expiry_date: dateOnly(b.expiry_date),
  source: str(b.source, 200),
  image_url: uploadUrl(b.image_url),
  notes: str(b.notes, 500),
  is_asset: b.is_asset ? 1 : 0,
  location: b.is_asset ? str(b.location, 120) : null,
  asset_condition: b.is_asset && ASSET_CONDITIONS.includes(b.asset_condition) ? b.asset_condition : null,
  serial_number: b.is_asset ? str(b.serial_number, 100) : null,
  last_maintenance_date: b.is_asset ? dateOnly(b.last_maintenance_date) : null,
});

router.get('/inventory-items', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.InventoryItems ORDER BY name'));
}));

router.post('/inventory-items', wrap(async (req, res) => {
  const it = readInventoryItem(req.body);
  if (!it.name) return res.status(400).json({ error: 'اسم المادة مطلوب' });
  const [row] = await query(`
    INSERT INTO dbo.InventoryItems (
      name, manufacturer, category, unit, quantity, min_quantity, expiry_date, source, image_url, notes,
      is_asset, location, asset_condition, serial_number, last_maintenance_date)
    OUTPUT INSERTED.id VALUES (
      @name, @manufacturer, @category, @unit, @quantity, @min_quantity, @expiry_date, @source, @image_url, @notes,
      @is_asset, @location, @asset_condition, @serial_number, @last_maintenance_date)`, it);
  res.status(201).json({ id: row.id });
}));

router.put('/inventory-items/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const it = readInventoryItem(req.body);
  if (!id || !it.name) return res.status(400).json({ error: 'اسم المادة مطلوب' });
  await query(`
    UPDATE dbo.InventoryItems SET name = @name, manufacturer = @manufacturer, category = @category, unit = @unit,
      quantity = @quantity, min_quantity = @min_quantity, expiry_date = @expiry_date, source = @source,
      image_url = @image_url, notes = @notes, is_asset = @is_asset, location = @location,
      asset_condition = @asset_condition, serial_number = @serial_number, last_maintenance_date = @last_maintenance_date,
      updated_at = datetime('now') WHERE id = @id`,
    { ...it, id });
  res.json({ ok: true });
}));

router.delete('/inventory-items/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.InventoryItems WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- inventory units of measure (box, pack, bottle, pcs...) ----------
router.get('/inventory-units', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.InventoryUnits ORDER BY sort_order, id'));
}));

router.post('/inventory-units', adminOnly, wrap(async (req, res) => {
  const name = str(req.body.name, 30);
  if (!name) return res.status(400).json({ error: 'اسم الوحدة مطلوب' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [row] = await query(
      'INSERT INTO dbo.InventoryUnits (name, sort_order) OUTPUT INSERTED.id VALUES (@name, @sort_order)',
      { name, sort_order }
    );
    res.status(201).json({ id: row.id });
  } catch (err) {
    if (err.kind === 'unique_violation') return res.status(409).json({ error: 'هذه الوحدة موجودة مسبقاً' });
    throw err;
  }
}));

router.put('/inventory-units/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const name = str(req.body.name, 30);
  if (!id || !name) return res.status(400).json({ error: 'اسم الوحدة مطلوب' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  const active = req.body.active === false ? 0 : 1;
  await query('UPDATE dbo.InventoryUnits SET name = @name, sort_order = @sort_order, active = @active WHERE id = @id',
    { id, name, sort_order, active });
  res.json({ ok: true });
}));

router.delete('/inventory-units/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.InventoryUnits WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- inventory categories (PPE, Wound Care, Respiratory...) ----------
router.get('/inventory-categories', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.InventoryCategories ORDER BY sort_order, id'));
}));

router.post('/inventory-categories', adminOnly, wrap(async (req, res) => {
  const name = str(req.body.name, 60);
  if (!name) return res.status(400).json({ error: 'اسم الفئة مطلوب' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [row] = await query(
      'INSERT INTO dbo.InventoryCategories (name, sort_order) OUTPUT INSERTED.id VALUES (@name, @sort_order)',
      { name, sort_order }
    );
    res.status(201).json({ id: row.id });
  } catch (err) {
    if (err.kind === 'unique_violation') return res.status(409).json({ error: 'هذه الفئة موجودة مسبقاً' });
    throw err;
  }
}));

router.put('/inventory-categories/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const name = str(req.body.name, 60);
  if (!id || !name) return res.status(400).json({ error: 'اسم الفئة مطلوب' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  const active = req.body.active === false ? 0 : 1;
  await query('UPDATE dbo.InventoryCategories SET name = @name, sort_order = @sort_order, active = @active WHERE id = @id',
    { id, name, sort_order, active });
  res.json({ ok: true });
}));

router.delete('/inventory-categories/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.InventoryCategories WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- inventory usage: what stock was drawn and why ----------
router.get('/inventory-usage', wrap(async (req, res) => {
  res.json(await query(`
    SELECT u.id, u.item_id, i.name AS item_name, i.unit, u.quantity, u.purpose, u.used_at, u.created_at,
           usr.display_name AS used_by_name
    FROM dbo.InventoryUsage u
    JOIN dbo.InventoryItems i ON i.id = u.item_id
    LEFT JOIN dbo.Users usr ON usr.id = u.used_by
    ORDER BY u.used_at DESC, u.id DESC`));
}));

router.post('/inventory-usage', wrap(async (req, res) => {
  const item_id = Number(req.body.item_id);
  const quantity = Number(req.body.quantity);
  const purpose = str(req.body.purpose, 500);
  const used_at = dateOnly(req.body.used_at) || new Date().toISOString().slice(0, 10);
  if (!Number.isInteger(item_id) || item_id <= 0) return res.status(400).json({ error: 'اختر المادة' });
  if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'الكمية غير صالحة' });
  if (!purpose) return res.status(400).json({ error: 'سبب الاستخدام مطلوب' });

  const rows = await query('SELECT quantity FROM dbo.InventoryItems WHERE id = @id', { id: item_id });
  if (!rows.length) return res.status(404).json({ error: 'المادة غير موجودة' });
  if (rows[0].quantity < quantity) return res.status(400).json({ error: `الكمية المتوفرة ${rows[0].quantity} فقط` });

  await query(`UPDATE dbo.InventoryItems SET quantity = quantity - @q, updated_at = datetime('now') WHERE id = @id`,
    { id: item_id, q: quantity });
  const [row] = await query(`
    INSERT INTO dbo.InventoryUsage (item_id, quantity, purpose, used_at, used_by)
    OUTPUT INSERTED.id VALUES (@item_id, @quantity, @purpose, @used_at, @uid)`,
    { item_id, quantity, purpose, used_at, uid: req.user.id });
  res.status(201).json({ id: row.id });
}));

router.delete('/inventory-usage/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) {
    // Deleting a usage record (correcting a mistake) restores the stock it drew.
    const rows = await query('SELECT item_id, quantity FROM dbo.InventoryUsage WHERE id = @id', { id });
    if (rows.length) {
      await query('UPDATE dbo.InventoryItems SET quantity = quantity + @q WHERE id = @item',
        { q: rows[0].quantity, item: rows[0].item_id });
      await query('DELETE FROM dbo.InventoryUsage WHERE id = @id', { id });
    }
  }
  res.json({ ok: true });
}));

// ---------- loaned items (عهدة): durable equipment lent out, expected back ----------
const readLoan = (b) => ({
  item_name: str(b.item_name, 150),
  recipient_name: str(b.recipient_name, 150),
  recipient_phone: str(b.recipient_phone, 40),
  loan_date: dateOnly(b.loan_date),
  image_url: uploadUrl(b.image_url),
  notes: str(b.notes, 500),
});

router.get('/loaned-items', wrap(async (req, res) => {
  res.json(await query(`
    SELECT l.*, u.display_name AS created_by_name FROM dbo.LoanedItems l
    LEFT JOIN dbo.Users u ON u.id = l.created_by
    ORDER BY CASE WHEN l.status = 'out' THEN 0 ELSE 1 END, l.loan_date DESC, l.id DESC`));
}));

router.post('/loaned-items', wrap(async (req, res) => {
  const l = readLoan(req.body);
  if (!l.item_name || !l.recipient_name || !l.loan_date) {
    return res.status(400).json({ error: 'اسم الغرض واسم المستلم وتاريخ التسليم مطلوبة' });
  }
  const [row] = await query(`
    INSERT INTO dbo.LoanedItems (item_name, recipient_name, recipient_phone, loan_date, image_url, notes, created_by)
    OUTPUT INSERTED.id VALUES (@item_name, @recipient_name, @recipient_phone, @loan_date, @image_url, @notes, @uid)`,
    { ...l, uid: req.user.id });
  res.status(201).json({ id: row.id });
}));

router.put('/loaned-items/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const l = readLoan(req.body);
  if (!id || !l.item_name || !l.recipient_name || !l.loan_date) {
    return res.status(400).json({ error: 'اسم الغرض واسم المستلم وتاريخ التسليم مطلوبة' });
  }
  await query(`
    UPDATE dbo.LoanedItems SET item_name = @item_name, recipient_name = @recipient_name,
      recipient_phone = @recipient_phone, loan_date = @loan_date, image_url = @image_url, notes = @notes
    WHERE id = @id`, { ...l, id });
  res.json({ ok: true });
}));

router.put('/loaned-items/:id/return', wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  const returned = req.body.returned !== false;
  await query('UPDATE dbo.LoanedItems SET status = @status, return_date = @rd WHERE id = @id', {
    id,
    status: returned ? 'returned' : 'out',
    rd: returned ? (dateOnly(req.body.return_date) || new Date().toISOString().slice(0, 10)) : null,
  });
  res.json({ ok: true });
}));

router.delete('/loaned-items/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.LoanedItems WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- medical service types (admin-only, feeds the monthly report) ----------
router.get('/service-types', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.ServiceTypes ORDER BY sort_order, id'));
}));

router.post('/service-types', adminOnly, wrap(async (req, res) => {
  const name = str(req.body.name, 100);
  if (!name) return res.status(400).json({ error: 'اسم الخدمة مطلوب' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [row] = await query(
      'INSERT INTO dbo.ServiceTypes (name, sort_order) OUTPUT INSERTED.id VALUES (@name, @sort_order)',
      { name, sort_order }
    );
    res.status(201).json({ id: row.id });
  } catch (err) {
    if (err.kind === 'unique_violation') return res.status(409).json({ error: 'هذه الخدمة موجودة مسبقاً' });
    throw err;
  }
}));

router.put('/service-types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const name = str(req.body.name, 100);
  if (!id || !name) return res.status(400).json({ error: 'اسم الخدمة مطلوب' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  const active = req.body.active === false ? 0 : 1;
  await query('UPDATE dbo.ServiceTypes SET name = @name, sort_order = @sort_order, active = @active WHERE id = @id',
    { id, name, sort_order, active });
  res.json({ ok: true });
}));

router.delete('/service-types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.json({ ok: true });
  try {
    await query('DELETE FROM dbo.ServiceTypes WHERE id = @id', { id });
  } catch (err) {
    // FK violation: logs still reference this type - deactivate instead of deleting.
    if (err.kind === 'fk_violation') return res.status(409).json({ error: 'لا يمكن حذف هذا النوع لوجود سجلات خدمات مرتبطة به. يمكنك إخفاؤه بدلاً من حذفه.' });
    throw err;
  }
  res.json({ ok: true });
}));

// ---------- medical service logs ----------
router.get('/service-logs', wrap(async (req, res) => {
  res.json(await query(`
    SELECT l.id, l.service_type_id, st.name AS service_type_name, l.team_member_id, tm.name AS team_member_name,
           l.quantity, l.service_date, l.notes, l.created_at, u.display_name AS created_by_name
    FROM dbo.ServiceLogs l
    JOIN dbo.ServiceTypes st ON st.id = l.service_type_id
    LEFT JOIN dbo.TeamMembers tm ON tm.id = l.team_member_id
    LEFT JOIN dbo.Users u ON u.id = l.created_by
    ORDER BY l.service_date DESC, l.id DESC`));
}));

router.post('/service-logs', wrap(async (req, res) => {
  const service_type_id = Number(req.body.service_type_id);
  const team_member_id = Number(req.body.team_member_id) || null;
  const quantity = Number.isInteger(Number(req.body.quantity)) && Number(req.body.quantity) > 0 ? Number(req.body.quantity) : 1;
  const service_date = dateOnly(req.body.service_date) || new Date().toISOString().slice(0, 10);
  const notes = str(req.body.notes, 500);
  if (!Number.isInteger(service_type_id) || service_type_id <= 0) return res.status(400).json({ error: 'اختر نوع الخدمة' });
  const [row] = await query(`
    INSERT INTO dbo.ServiceLogs (service_type_id, team_member_id, quantity, service_date, notes, created_by)
    OUTPUT INSERTED.id VALUES (@service_type_id, @team_member_id, @quantity, @service_date, @notes, @uid)`,
    { service_type_id, team_member_id, quantity, service_date, notes, uid: req.user.id });
  res.status(201).json({ id: row.id });
}));

router.delete('/service-logs/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.ServiceLogs WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- medical services monthly report ----------
router.get('/reports/services', adminOnly, wrap(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Math.min(Math.max(Number(req.query.month) || now.getUTCMonth() + 1, 1), 12);

  const logs = await query(
    `SELECT l.id, l.quantity, l.service_date, st.name AS type_name,
            tm.id AS member_id, tm.name AS member_name, tm.group_name, tm.photo_url
     FROM dbo.ServiceLogs l
     JOIN dbo.ServiceTypes st ON st.id = l.service_type_id
     LEFT JOIN dbo.TeamMembers tm ON tm.id = l.team_member_id
     WHERE CAST(strftime('%Y', l.service_date) AS INTEGER) = @year AND CAST(strftime('%m', l.service_date) AS INTEGER) = @month
     ORDER BY l.service_date`,
    { year, month }
  );

  const totalServices = logs.reduce((sum, l) => sum + l.quantity, 0);

  const byType = new Map();
  for (const l of logs) byType.set(l.type_name, (byType.get(l.type_name) || 0) + l.quantity);
  const types = [...byType.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const byMember = new Map();
  for (const l of logs) {
    if (!l.member_id) continue;
    if (!byMember.has(l.member_id)) {
      byMember.set(l.member_id, { id: l.member_id, name: l.member_name, group_name: l.group_name, photo_url: l.photo_url, services: [] });
    }
    byMember.get(l.member_id).services.push({ id: l.id, type_name: l.type_name, quantity: l.quantity, service_date: l.service_date });
  }
  const paramedics = [...byMember.values()]
    .map((p) => ({ ...p, count: p.services.reduce((s, x) => s + x.quantity, 0) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));

  res.json({ year, month, totalServices, types, paramedics });
}));

// ---------- blood donations monthly report ----------
router.get('/reports/blood-donations', adminOnly, wrap(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Math.min(Math.max(Number(req.query.month) || now.getUTCMonth() + 1, 1), 12);

  const donations = await query(
    `SELECT id, donor_name, donation_date, blood_type, hospital, recipient_name, notes
     FROM dbo.BloodDonations
     WHERE CAST(strftime('%Y', donation_date) AS INTEGER) = @year AND CAST(strftime('%m', donation_date) AS INTEGER) = @month
     ORDER BY donation_date`,
    { year, month }
  );

  const byType = new Map();
  for (const d of donations) {
    const t = d.blood_type || 'غير محدّدة';
    byType.set(t, (byType.get(t) || 0) + 1);
  }
  const types = [...byType.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  res.json({ year, month, total: donations.length, types, donations });
}));

// ---------- community (in-kind) donations monthly report ----------
router.get('/reports/community-donations', adminOnly, wrap(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Math.min(Math.max(Number(req.query.month) || now.getUTCMonth() + 1, 1), 12);

  const donations = await query(
    `SELECT d.id, d.item_detail, d.quantity, d.recipient_name, d.donation_date,
            it.name AS item_type_name, tm.name AS team_member_name
     FROM dbo.CommunityDonations d
     JOIN dbo.DonationItemTypes it ON it.id = d.item_type_id
     LEFT JOIN dbo.TeamMembers tm ON tm.id = d.team_member_id
     WHERE CAST(strftime('%Y', d.donation_date) AS INTEGER) = @year AND CAST(strftime('%m', d.donation_date) AS INTEGER) = @month
     ORDER BY d.donation_date`,
    { year, month }
  );

  const byType = new Map();
  for (const d of donations) byType.set(d.item_type_name, (byType.get(d.item_type_name) || 0) + d.quantity);
  const types = [...byType.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const totalQuantity = donations.reduce((s, d) => s + d.quantity, 0);

  res.json({ year, month, total: donations.length, totalQuantity, types, donations });
}));

// ---------- activities (non-mission posts) monthly count ----------
router.get('/reports/activities', adminOnly, wrap(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Math.min(Math.max(Number(req.query.month) || now.getUTCMonth() + 1, 1), 12);

  const [row] = await query(
    `SELECT COUNT(*) AS total FROM dbo.Posts
     WHERE status = 'published' AND category = 'activity'
       AND CAST(strftime('%Y', event_date) AS INTEGER) = @year AND CAST(strftime('%m', event_date) AS INTEGER) = @month`,
    { year, month }
  );
  res.json({ year, month, total: row.total });
}));

// ---------- ambulance finance categories (income sources / outcome types) ----------
router.get('/ambulance-categories', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.AmbulanceCategories ORDER BY kind, sort_order, id'));
}));

router.post('/ambulance-categories', adminOnly, wrap(async (req, res) => {
  const name = str(req.body.name, 100);
  const kind = ['income', 'outcome'].includes(req.body.kind) ? req.body.kind : null;
  if (!name || !kind) return res.status(400).json({ error: 'اسم الفئة ونوعها (إيراد أو مصروف) مطلوبان' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  try {
    const [row] = await query(
      'INSERT INTO dbo.AmbulanceCategories (name, kind, sort_order) OUTPUT INSERTED.id VALUES (@name, @kind, @sort_order)',
      { name, kind, sort_order }
    );
    res.status(201).json({ id: row.id });
  } catch (err) {
    if (err.kind === 'unique_violation') return res.status(409).json({ error: 'هذه الفئة موجودة مسبقاً' });
    throw err;
  }
}));

router.put('/ambulance-categories/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const name = str(req.body.name, 100);
  const kind = ['income', 'outcome'].includes(req.body.kind) ? req.body.kind : null;
  if (!id || !name || !kind) return res.status(400).json({ error: 'اسم الفئة ونوعها (إيراد أو مصروف) مطلوبان' });
  const sort_order = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  const active = req.body.active === false ? 0 : 1;
  await query('UPDATE dbo.AmbulanceCategories SET name = @name, kind = @kind, sort_order = @sort_order, active = @active WHERE id = @id',
    { id, name, kind, sort_order, active });
  res.json({ ok: true });
}));

router.delete('/ambulance-categories/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.AmbulanceCategories WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- ambulance income & expense ledger ----------
const readAmbulanceTransaction = (b) => ({
  type: ['income', 'outcome'].includes(b.type) ? b.type : null,
  amount: Number.isFinite(Number(b.amount)) && Number(b.amount) >= 0 ? Number(b.amount) : null,
  category: str(b.category, 100),
  ambulance_number: str(b.ambulance_number, 20) || '160',
  party: str(b.party, 150),
  transaction_date: dateOnly(b.transaction_date),
  receipt_url: uploadUrl(b.receipt_url),
  notes: str(b.notes, 500),
});

router.get('/ambulance-transactions', wrap(async (req, res) => {
  res.json(await query(`
    SELECT t.*, u.display_name AS created_by_name FROM dbo.AmbulanceTransactions t
    LEFT JOIN dbo.Users u ON u.id = t.created_by
    ORDER BY t.transaction_date DESC, t.id DESC`));
}));

router.post('/ambulance-transactions', wrap(async (req, res) => {
  const t = readAmbulanceTransaction(req.body);
  if (!t.type || t.amount == null || !t.transaction_date) {
    return res.status(400).json({ error: 'النوع والمبلغ والتاريخ مطلوبة' });
  }
  const [row] = await query(`
    INSERT INTO dbo.AmbulanceTransactions (type, amount, category, ambulance_number, party, transaction_date, receipt_url, notes, created_by)
    OUTPUT INSERTED.id VALUES (@type, @amount, @category, @ambulance_number, @party, @transaction_date, @receipt_url, @notes, @uid)`,
    { ...t, uid: req.user.id });
  res.status(201).json({ id: row.id });
}));

router.put('/ambulance-transactions/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const t = readAmbulanceTransaction(req.body);
  if (!id || !t.type || t.amount == null || !t.transaction_date) {
    return res.status(400).json({ error: 'النوع والمبلغ والتاريخ مطلوبة' });
  }
  await query(`
    UPDATE dbo.AmbulanceTransactions SET type = @type, amount = @amount, category = @category,
      ambulance_number = @ambulance_number, party = @party, transaction_date = @transaction_date,
      receipt_url = @receipt_url, notes = @notes WHERE id = @id`,
    { ...t, id });
  res.json({ ok: true });
}));

router.delete('/ambulance-transactions/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.AmbulanceTransactions WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- ambulance equipment (spinal board, scoop stretcher, field stretcher...) ----------
const readAmbulanceAsset = (b) => ({
  name: str(b.name, 150),
  manufacturer: str(b.manufacturer, 150),
  category: str(b.category, 60),
  quantity: Number.isInteger(Number(b.quantity)) && Number(b.quantity) >= 0 ? Number(b.quantity) : 1,
  ambulance_number: str(b.ambulance_number, 20) || '160',
  asset_condition: ASSET_CONDITIONS.includes(b.asset_condition) ? b.asset_condition : null,
  serial_number: str(b.serial_number, 100),
  last_maintenance_date: dateOnly(b.last_maintenance_date),
  source: str(b.source, 200),
  image_url: uploadUrl(b.image_url),
  notes: str(b.notes, 500),
});

router.get('/ambulance-assets', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.AmbulanceAssets ORDER BY name'));
}));

router.post('/ambulance-assets', wrap(async (req, res) => {
  const a = readAmbulanceAsset(req.body);
  if (!a.name) return res.status(400).json({ error: 'اسم المعدة مطلوب' });
  const [row] = await query(`
    INSERT INTO dbo.AmbulanceAssets (
      name, manufacturer, category, quantity, ambulance_number, asset_condition, serial_number,
      last_maintenance_date, source, image_url, notes)
    OUTPUT INSERTED.id VALUES (
      @name, @manufacturer, @category, @quantity, @ambulance_number, @asset_condition, @serial_number,
      @last_maintenance_date, @source, @image_url, @notes)`, a);
  res.status(201).json({ id: row.id });
}));

router.put('/ambulance-assets/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const a = readAmbulanceAsset(req.body);
  if (!id || !a.name) return res.status(400).json({ error: 'اسم المعدة مطلوب' });
  await query(`
    UPDATE dbo.AmbulanceAssets SET name = @name, manufacturer = @manufacturer, category = @category,
      quantity = @quantity, ambulance_number = @ambulance_number, asset_condition = @asset_condition,
      serial_number = @serial_number, last_maintenance_date = @last_maintenance_date, source = @source,
      image_url = @image_url, notes = @notes, updated_at = datetime('now') WHERE id = @id`,
    { ...a, id });
  res.json({ ok: true });
}));

router.delete('/ambulance-assets/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.AmbulanceAssets WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- shift schedule (time ranges with the members on duty) ----------
async function replaceShiftMembers(shiftId, ids) {
  await query('DELETE FROM dbo.ShiftMembers WHERE shift_id = @id', { id: shiftId });
  for (const memberId of intList(ids)) {
    await query('INSERT INTO dbo.ShiftMembers (shift_id, team_member_id) VALUES (@id, @m)', { id: shiftId, m: memberId });
  }
}

router.get('/shifts', wrap(async (req, res) => {
  const from = dateOnly(req.query.from);
  const to = dateOnly(req.query.to);
  const where = [];
  const params = {};
  if (from) { where.push('shift_date >= @from'); params.from = from; }
  if (to) { where.push('shift_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const shifts = await query(`SELECT * FROM dbo.Shifts ${whereSql} ORDER BY shift_date, start_time`, params);

  const members = shifts.length
    ? await query(`
        SELECT sm.shift_id, tm.id, tm.name, tm.photo_url
        FROM dbo.ShiftMembers sm JOIN dbo.TeamMembers tm ON tm.id = sm.team_member_id
        WHERE sm.shift_id IN (${shifts.map((s) => s.id).join(',')})
        ORDER BY tm.sort_order, tm.id`)
    : [];
  const byShift = new Map();
  for (const m of members) {
    if (!byShift.has(m.shift_id)) byShift.set(m.shift_id, []);
    byShift.get(m.shift_id).push({ id: m.id, name: m.name, photo_url: m.photo_url });
  }
  res.json(shifts.map((s) => ({ ...s, members: byShift.get(s.id) || [] })));
}));

router.post('/shifts', wrap(async (req, res) => {
  const shift_date = dateOnly(req.body.shift_date);
  const start_time = timeOnly(req.body.start_time);
  const end_time = timeOnly(req.body.end_time);
  const notes = str(req.body.notes, 300);
  if (!shift_date || !start_time || !end_time) return res.status(400).json({ error: 'التاريخ ووقتا البداية والنهاية مطلوبة' });
  const [row] = await query(`
    INSERT INTO dbo.Shifts (shift_date, start_time, end_time, notes, created_by)
    OUTPUT INSERTED.id VALUES (@shift_date, @start_time, @end_time, @notes, @uid)`,
    { shift_date, start_time, end_time, notes, uid: req.user.id });
  await replaceShiftMembers(row.id, req.body.member_ids);
  res.status(201).json({ id: row.id });
}));

router.put('/shifts/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const shift_date = dateOnly(req.body.shift_date);
  const start_time = timeOnly(req.body.start_time);
  const end_time = timeOnly(req.body.end_time);
  const notes = str(req.body.notes, 300);
  if (!id || !shift_date || !start_time || !end_time) return res.status(400).json({ error: 'التاريخ ووقتا البداية والنهاية مطلوبة' });
  await query('UPDATE dbo.Shifts SET shift_date = @shift_date, start_time = @start_time, end_time = @end_time, notes = @notes WHERE id = @id',
    { id, shift_date, start_time, end_time, notes });
  await replaceShiftMembers(id, req.body.member_ids);
  res.json({ ok: true });
}));

router.delete('/shifts/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.Shifts WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- blood donations ----------
const readBloodDonation = (b) => ({
  donor_name: str(b.donor_name, 150),
  donation_date: dateOnly(b.donation_date),
  blood_type: BLOOD_TYPES.includes(b.blood_type) ? b.blood_type : null,
  hospital: str(b.hospital, 150),
  recipient_name: str(b.recipient_name, 150),
  notes: str(b.notes, 500),
});

router.get('/blood-donations', wrap(async (req, res) => {
  res.json(await query(`
    SELECT d.*, u.display_name AS created_by_name FROM dbo.BloodDonations d
    LEFT JOIN dbo.Users u ON u.id = d.created_by
    ORDER BY d.donation_date DESC, d.id DESC`));
}));

router.post('/blood-donations', wrap(async (req, res) => {
  const d = readBloodDonation(req.body);
  if (!d.donor_name || !d.donation_date) return res.status(400).json({ error: 'اسم المتبرّع والتاريخ مطلوبان' });
  const [row] = await query(`
    INSERT INTO dbo.BloodDonations (donor_name, donation_date, blood_type, hospital, recipient_name, notes, created_by)
    OUTPUT INSERTED.id VALUES (@donor_name, @donation_date, @blood_type, @hospital, @recipient_name, @notes, @uid)`,
    { ...d, uid: req.user.id });
  res.status(201).json({ id: row.id });
}));

router.put('/blood-donations/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const d = readBloodDonation(req.body);
  if (!id || !d.donor_name || !d.donation_date) return res.status(400).json({ error: 'اسم المتبرّع والتاريخ مطلوبان' });
  await query(`
    UPDATE dbo.BloodDonations SET donor_name = @donor_name, donation_date = @donation_date, blood_type = @blood_type,
      hospital = @hospital, recipient_name = @recipient_name, notes = @notes WHERE id = @id`,
    { ...d, id });
  res.json({ ok: true });
}));

router.delete('/blood-donations/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.BloodDonations WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- blood donor registry ----------
// Public-submitted list staff search by blood type when a need comes in.
// `available` is computed, not stored: a donor is available once active and
// either never donated or it's been 6+ months since their last donation.
const readBloodDonor = (b) => ({
  name: str(b.name, 150),
  phone: str(b.phone, 40),
  blood_type: BLOOD_TYPES.includes(b.blood_type) ? b.blood_type : null,
  area: str(b.area, 100),
  notes: str(b.notes, 500),
});

router.get('/blood-donors', wrap(async (req, res) => {
  const type = BLOOD_TYPES.includes(req.query.type) ? req.query.type : null;
  const onlyAvailable = req.query.available === '1';
  const where = ['1=1'];
  const params = { type };
  if (type) where.push('blood_type = @type');
  if (onlyAvailable) where.push("active = 1 AND (last_donation_date IS NULL OR date(last_donation_date) <= date('now', '-6 months'))");
  res.json(await query(`
    SELECT *,
      CASE WHEN active = 1 AND (last_donation_date IS NULL OR date(last_donation_date) <= date('now', '-6 months'))
        THEN 1 ELSE 0 END AS available
    FROM dbo.BloodDonors
    WHERE ${where.join(' AND ')}
    ORDER BY blood_type, name`, params));
}));

router.post('/blood-donors', wrap(async (req, res) => {
  const d = readBloodDonor(req.body);
  if (!d.name || !d.phone || !d.blood_type) return res.status(400).json({ error: 'الاسم والهاتف وفئة الدم مطلوبة' });
  const [row] = await query(`
    INSERT INTO dbo.BloodDonors (name, phone, blood_type, area, notes)
    OUTPUT INSERTED.id VALUES (@name, @phone, @blood_type, @area, @notes)`, d);
  res.status(201).json({ id: row.id });
}));

router.put('/blood-donors/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const d = readBloodDonor(req.body);
  if (!id || !d.name || !d.phone || !d.blood_type) return res.status(400).json({ error: 'الاسم والهاتف وفئة الدم مطلوبة' });
  await query(`
    UPDATE dbo.BloodDonors SET name = @name, phone = @phone, blood_type = @blood_type, area = @area, notes = @notes
    WHERE id = @id`, { ...d, id });
  res.json({ ok: true });
}));

router.post('/blood-donors/:id/mark-donated', wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  const donation_date = dateOnly(req.body.donation_date) || dateOnly(new Date().toISOString());
  await query('UPDATE dbo.BloodDonors SET last_donation_date = @donation_date WHERE id = @id', { id, donation_date });
  res.json({ ok: true });
}));

router.put('/blood-donors/:id/active', wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  await query('UPDATE dbo.BloodDonors SET active = @active WHERE id = @id', { id, active: req.body.active ? 1 : 0 });
  res.json({ ok: true });
}));

router.delete('/blood-donors/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.BloodDonors WHERE id = @id', { id });
  res.json({ ok: true });
}));

// ---------- donation item types (دواء، حفاضات أطفال، حليب أطفال...) ----------
router.get('/donation-item-types', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.DonationItemTypes ORDER BY sort_order, id'));
}));

const readDonationItem = (b) => ({
  name: str(b.name, 100),
  image_url: uploadUrl(b.image_url),
  quantity: Number.isInteger(Number(b.quantity)) && Number(b.quantity) >= 0 ? Number(b.quantity) : 0,
  expiry_date: dateOnly(b.expiry_date),
  sort_order: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0,
  active: b.active === false ? 0 : 1,
});

router.post('/donation-item-types', adminOnly, wrap(async (req, res) => {
  const t = readDonationItem(req.body);
  if (!t.name) return res.status(400).json({ error: 'اسم الصنف مطلوب' });
  try {
    const [row] = await query(
      `INSERT INTO dbo.DonationItemTypes (name, image_url, quantity, expiry_date, sort_order)
       OUTPUT INSERTED.id VALUES (@name, @image_url, @quantity, @expiry_date, @sort_order)`,
      t
    );
    res.status(201).json({ id: row.id });
  } catch (err) {
    if (err.kind === 'unique_violation') return res.status(409).json({ error: 'هذا الصنف موجود مسبقاً' });
    throw err;
  }
}));

router.put('/donation-item-types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  const t = readDonationItem(req.body);
  if (!id || !t.name) return res.status(400).json({ error: 'اسم الصنف مطلوب' });
  await query(`
    UPDATE dbo.DonationItemTypes SET name = @name, image_url = @image_url, quantity = @quantity,
      expiry_date = @expiry_date, sort_order = @sort_order, active = @active WHERE id = @id`,
    { ...t, id });
  res.json({ ok: true });
}));

router.delete('/donation-item-types/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.json({ ok: true });
  try {
    await query('DELETE FROM dbo.DonationItemTypes WHERE id = @id', { id });
  } catch (err) {
    if (err.kind === 'fk_violation') return res.status(409).json({ error: 'لا يمكن حذف هذا الصنف لوجود تبرعات مرتبطة به. يمكنك إخفاؤه بدلاً من حذفه.' });
    throw err;
  }
  res.json({ ok: true });
}));

// ---------- community donations (in-kind aid handed out: medicine, diapers, formula...) ----------
router.get('/community-donations', wrap(async (req, res) => {
  res.json(await query(`
    SELECT d.id, d.item_type_id, it.name AS item_type_name, d.item_detail, d.quantity, d.team_member_id, tm.name AS team_member_name,
           d.recipient_name, d.donation_date, d.notes, d.created_at, u.display_name AS created_by_name
    FROM dbo.CommunityDonations d
    JOIN dbo.DonationItemTypes it ON it.id = d.item_type_id
    LEFT JOIN dbo.TeamMembers tm ON tm.id = d.team_member_id
    LEFT JOIN dbo.Users u ON u.id = d.created_by
    ORDER BY d.donation_date DESC, d.id DESC`));
}));

router.post('/community-donations', wrap(async (req, res) => {
  const item_type_id = Number(req.body.item_type_id);
  const item_detail = str(req.body.item_detail, 150);
  const team_member_id = Number(req.body.team_member_id) || null;
  const recipient_name = str(req.body.recipient_name, 150);
  const donation_date = dateOnly(req.body.donation_date);
  const notes = str(req.body.notes, 500);
  const quantity = Number.isInteger(Number(req.body.quantity)) && Number(req.body.quantity) > 0 ? Number(req.body.quantity) : 1;
  if (!Number.isInteger(item_type_id) || item_type_id <= 0 || !donation_date) {
    return res.status(400).json({ error: 'الصنف والتاريخ مطلوبان' });
  }

  const items = await query('SELECT quantity FROM dbo.DonationItemTypes WHERE id = @id', { id: item_type_id });
  if (!items.length) return res.status(404).json({ error: 'الصنف غير موجود' });
  if (items[0].quantity < quantity) return res.status(400).json({ error: `الكمية المتوفرة من هذا الصنف ${items[0].quantity} فقط` });

  await query('UPDATE dbo.DonationItemTypes SET quantity = quantity - @q WHERE id = @id', { id: item_type_id, q: quantity });
  const [row] = await query(`
    INSERT INTO dbo.CommunityDonations (item_type_id, item_detail, quantity, team_member_id, recipient_name, donation_date, notes, created_by)
    OUTPUT INSERTED.id VALUES (@item_type_id, @item_detail, @quantity, @team_member_id, @recipient_name, @donation_date, @notes, @uid)`,
    { item_type_id, item_detail, quantity, team_member_id, recipient_name, donation_date, notes, uid: req.user.id });
  res.status(201).json({ id: row.id });
}));

router.put('/community-donations/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const item_type_id = Number(req.body.item_type_id);
  const item_detail = str(req.body.item_detail, 150);
  const team_member_id = Number(req.body.team_member_id) || null;
  const recipient_name = str(req.body.recipient_name, 150);
  const donation_date = dateOnly(req.body.donation_date);
  const notes = str(req.body.notes, 500);
  const quantity = Number.isInteger(Number(req.body.quantity)) && Number(req.body.quantity) > 0 ? Number(req.body.quantity) : 1;
  if (!id || !Number.isInteger(item_type_id) || item_type_id <= 0 || !donation_date) {
    return res.status(400).json({ error: 'الصنف والتاريخ مطلوبان' });
  }

  const existing = await query('SELECT item_type_id, quantity FROM dbo.CommunityDonations WHERE id = @id', { id });
  if (!existing.length) return res.status(404).json({ error: 'غير موجود' });
  const prev = existing[0];

  const target = await query('SELECT quantity FROM dbo.DonationItemTypes WHERE id = @id', { id: item_type_id });
  if (!target.length) return res.status(404).json({ error: 'الصنف غير موجود' });
  // Editing in place on the same item gives back what this donation already
  // drew before checking, so the same amount can be re-entered.
  const available = target[0].quantity + (item_type_id === prev.item_type_id ? prev.quantity : 0);
  if (available < quantity) return res.status(400).json({ error: `الكمية المتوفرة من هذا الصنف ${available} فقط` });

  await query('UPDATE dbo.DonationItemTypes SET quantity = quantity + @q WHERE id = @id', { id: prev.item_type_id, q: prev.quantity });
  await query('UPDATE dbo.DonationItemTypes SET quantity = quantity - @q WHERE id = @id', { id: item_type_id, q: quantity });

  await query(`
    UPDATE dbo.CommunityDonations SET item_type_id = @item_type_id, item_detail = @item_detail, quantity = @quantity,
      team_member_id = @team_member_id, recipient_name = @recipient_name, donation_date = @donation_date, notes = @notes
    WHERE id = @id`,
    { id, item_type_id, item_detail, quantity, team_member_id, recipient_name, donation_date, notes });
  res.json({ ok: true });
}));

router.delete('/community-donations/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) {
    // Deleting a donation record (correcting a mistake) restores the stock it drew.
    const rows = await query('SELECT item_type_id, quantity FROM dbo.CommunityDonations WHERE id = @id', { id });
    if (rows.length) {
      await query('UPDATE dbo.DonationItemTypes SET quantity = quantity + @q WHERE id = @item',
        { q: rows[0].quantity, item: rows[0].item_type_id });
      await query('DELETE FROM dbo.CommunityDonations WHERE id = @id', { id });
    }
  }
  res.json({ ok: true });
}));

// ---------- document templates ----------
// Fills the association's own Word templates (server/templates/*.docx) and
// streams back the same file with its blanks filled in — never a redrawn
// lookalike. Nothing is persisted; each fill is generated on demand.
router.get('/document-templates', wrap(async (req, res) => {
  res.json(listTemplates());
}));

router.post('/document-templates/:id/fill', wrap(async (req, res) => {
  const { buffer, filename } = renderDocx(req.params.id, req.body || {});
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
}));

module.exports = router;
