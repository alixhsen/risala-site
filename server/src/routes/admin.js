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
const { adminOnly } = require('../auth');
const { wrap, str, uploadUrl, httpUrl, dateOnly, idParam, intList } = require('../util');

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

// ---------- dashboard ----------
router.get('/stats', wrap(async (req, res) => {
  const [row] = await query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'pending')   AS pending,
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'draft')     AS drafts,
      (SELECT COUNT(*) FROM dbo.Posts WHERE status = 'published' AND category = 'mission'
        AND YEAR(event_date) = YEAR(SYSUTCDATETIME()) AND MONTH(event_date) = MONTH(SYSUTCDATETIME())) AS missionsThisMonth,
      (SELECT COUNT(*) FROM dbo.TeamMembers)                      AS team,
      (SELECT COUNT(*) FROM dbo.GalleryImages)                    AS gallery,
      (SELECT COUNT(*) FROM dbo.Messages WHERE is_read = 0)       AS unread,
      (SELECT COUNT(*) FROM dbo.InventoryItems WHERE expiry_date IS NOT NULL
        AND expiry_date <= DATEADD(day, 30, CAST(SYSUTCDATETIME() AS DATE)))  AS expiringSoon,
      (SELECT COUNT(*) FROM dbo.LoanedItems WHERE status = 'out')  AS itemsOnLoan`);
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
            CASE WHEN @status = 'published' THEN SYSUTCDATETIME() END)`,
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
      updated_at = SYSUTCDATETIME(),
      published_at = CASE WHEN @status = 'published' THEN COALESCE(published_at, SYSUTCDATETIME()) ELSE NULL END
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
    if (err.number === 2627 || err.number === 2601) return res.status(409).json({ error: 'هذا النوع موجود مسبقاً' });
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
       AND YEAR(p.event_date) = @year AND MONTH(p.event_date) = @month
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
});

const MEMBER_COLUMNS = `name, first_name, family_name, role_title, group_name, photo_url, sort_order, visible,
  father_name, mother_name, nickname, birth_date, birth_place, blood_type, registry_no,
  education, phone, address, joined_on, scout_unit, district, region, town, notes`;
const MEMBER_PARAMS = `@name, @first_name, @family_name, @role_title, @group_name, @photo_url, @sort_order, @visible,
  @father_name, @mother_name, @nickname, @birth_date, @birth_place, @blood_type, @registry_no,
  @education, @phone, @address, @joined_on, @scout_unit, @district, @region, @town, @notes`;

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

  const mWhere = `YEAR(p.event_date) = @year${month ? ' AND MONTH(p.event_date) = @month' : ''}`;
  const sWhere = `YEAR(l.service_date) = @year${month ? ' AND MONTH(l.service_date) = @month' : ''}`;
  const period = { id, year, month };

  const [mCount] = await query(
    `SELECT COUNT(*) AS n FROM dbo.PostParamedics pp JOIN dbo.Posts p ON p.id = pp.post_id
     WHERE pp.team_member_id = @id AND p.category = 'mission' AND ${mWhere}`,
    period
  );
  const [sCount] = await query(
    `SELECT COUNT(*) AS n, ISNULL(SUM(l.quantity), 0) AS qty
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
    `SELECT DISTINCT YEAR(p.event_date) AS y FROM dbo.PostParamedics pp
       JOIN dbo.Posts p ON p.id = pp.post_id
       WHERE pp.team_member_id = @id AND p.category = 'mission' AND p.event_date IS NOT NULL
     UNION
     SELECT DISTINCT YEAR(service_date) AS y FROM dbo.ServiceLogs WHERE team_member_id = @id
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
  'hero_quote', 'hero_quote_author', 'report_photos'];
const IMAGE_KEYS = ['logo_url', 'hero_url'];
const LINK_KEYS = ['facebook', 'instagram', 'donate_url', 'whatsapp_channel'];

router.put('/settings', adminOnly, wrap(async (req, res) => {
  const values = {};
  for (const k of TEXT_KEYS) if (k in req.body) values[k] = str(req.body[k], 8000) || '';
  for (const k of IMAGE_KEYS) if (k in req.body) values[k] = uploadUrl(req.body[k]) || '';
  for (const k of LINK_KEYS) if (k in req.body) values[k] = httpUrl(req.body[k]);
  for (const [k, v] of Object.entries(values)) {
    await query(`
      MERGE dbo.Settings AS t USING (SELECT @k AS [key]) AS s ON t.[key] = s.[key]
      WHEN MATCHED THEN UPDATE SET value = @v
      WHEN NOT MATCHED THEN INSERT ([key], value) VALUES (@k, @v);`, { k, v });
  }
  res.json({ ok: true });
}));

// ---------- messages ----------
router.get('/messages', adminOnly, wrap(async (req, res) => {
  res.json(await query('SELECT TOP (500) * FROM dbo.Messages ORDER BY created_at DESC'));
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
router.get('/users', adminOnly, wrap(async (req, res) => {
  res.json(await query('SELECT id, username, display_name, role, active, created_at FROM dbo.Users ORDER BY id'));
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
  await query('INSERT INTO dbo.Users (username, password_hash, display_name, role) VALUES (@u, @p, @d, @r)',
    { u: username, p: await bcrypt.hash(password, 12), d: display_name, r: role });
  res.status(201).json({ ok: true });
}));

router.put('/users/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  if (id === req.user.id && req.body.active === false) return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك' });
  if (typeof req.body.active === 'boolean') {
    await query('UPDATE dbo.Users SET active = @a WHERE id = @id', { id, a: req.body.active ? 1 : 0 });
  }
  if (typeof req.body.password === 'string' && req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'كلمة المرور 8 أحرف على الأقل' });
    await query('UPDATE dbo.Users SET password_hash = @p WHERE id = @id', { id, p: await bcrypt.hash(req.body.password, 12) });
  }
  res.json({ ok: true });
}));

// ---------- inventory: medical/consumable stock ----------
const readInventoryItem = (b) => ({
  name: str(b.name, 150),
  unit: str(b.unit, 30),
  quantity: Number.isInteger(Number(b.quantity)) && Number(b.quantity) >= 0 ? Number(b.quantity) : 0,
  expiry_date: dateOnly(b.expiry_date),
  source: str(b.source, 200),
  image_url: uploadUrl(b.image_url),
  notes: str(b.notes, 500),
});

router.get('/inventory-items', wrap(async (req, res) => {
  res.json(await query('SELECT * FROM dbo.InventoryItems ORDER BY name'));
}));

router.post('/inventory-items', wrap(async (req, res) => {
  const it = readInventoryItem(req.body);
  if (!it.name) return res.status(400).json({ error: 'اسم المادة مطلوب' });
  const [row] = await query(`
    INSERT INTO dbo.InventoryItems (name, unit, quantity, expiry_date, source, image_url, notes)
    OUTPUT INSERTED.id VALUES (@name, @unit, @quantity, @expiry_date, @source, @image_url, @notes)`, it);
  res.status(201).json({ id: row.id });
}));

router.put('/inventory-items/:id', wrap(async (req, res) => {
  const id = idParam(req);
  const it = readInventoryItem(req.body);
  if (!id || !it.name) return res.status(400).json({ error: 'اسم المادة مطلوب' });
  await query(`
    UPDATE dbo.InventoryItems SET name = @name, unit = @unit, quantity = @quantity, expiry_date = @expiry_date,
      source = @source, image_url = @image_url, notes = @notes, updated_at = SYSUTCDATETIME() WHERE id = @id`,
    { ...it, id });
  res.json({ ok: true });
}));

router.delete('/inventory-items/:id', adminOnly, wrap(async (req, res) => {
  const id = idParam(req);
  if (id) await query('DELETE FROM dbo.InventoryItems WHERE id = @id', { id });
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

  await query('UPDATE dbo.InventoryItems SET quantity = quantity - @q, updated_at = SYSUTCDATETIME() WHERE id = @id',
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
    if (err.number === 2627 || err.number === 2601) return res.status(409).json({ error: 'هذه الخدمة موجودة مسبقاً' });
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
    if (err.number === 547) return res.status(409).json({ error: 'لا يمكن حذف هذا النوع لوجود سجلات خدمات مرتبطة به. يمكنك إخفاؤه بدلاً من حذفه.' });
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
     WHERE YEAR(l.service_date) = @year AND MONTH(l.service_date) = @month
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

module.exports = router;
