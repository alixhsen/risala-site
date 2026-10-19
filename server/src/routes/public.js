// Everything visitors can see. Only published / visible rows leave this file.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { wrap, str, idParam } = require('../util');

const router = express.Router();

router.get('/settings', wrap(async (req, res) => {
  const rows = await query('SELECT [key], value FROM dbo.Settings');
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value || ''])));
}));

router.get('/mission-types', wrap(async (req, res) => {
  res.json(await query(
    'SELECT id, name, color FROM dbo.MissionTypes WHERE active = 1 ORDER BY sort_order, id'
  ));
}));

router.get('/posts', wrap(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 60);
  const category = str(req.query.category, 30);
  const typeId = Number(req.query.type) || null;
  const page = Math.max(Number(req.query.page) || 0, 0);

  // Legacy/simple callers (no `page`) get a plain top-N array, unchanged.
  // Paginated callers pass `page` (1-based) and get { items, total } so the
  // page can render a page count without a second round trip.
  if (!page) {
    const rows = await query(
      `SELECT p.id, p.title, p.category, p.summary, p.cover_url, p.event_date, p.published_at, p.pinned,
              mt.id AS mission_type_id, mt.name AS mission_type_name, mt.color AS mission_type_color,
              (SELECT COUNT(*) FROM dbo.PostParamedics pp WHERE pp.post_id = p.id) AS paramedic_count
       FROM dbo.Posts p
       LEFT JOIN dbo.MissionTypes mt ON mt.id = p.mission_type_id
       WHERE p.status = 'published' AND (@category IS NULL OR p.category = @category)
         AND (@typeId IS NULL OR p.mission_type_id = @typeId)
       ORDER BY p.pinned DESC, COALESCE(p.event_date, date(p.published_at)) DESC, p.id DESC
       LIMIT @limit`,
      { limit, category, typeId }
    );
    return res.json(rows);
  }

  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    query(
      `SELECT p.id, p.title, p.category, p.summary, p.cover_url, p.event_date, p.published_at, p.pinned,
              mt.id AS mission_type_id, mt.name AS mission_type_name, mt.color AS mission_type_color,
              (SELECT COUNT(*) FROM dbo.PostParamedics pp WHERE pp.post_id = p.id) AS paramedic_count
       FROM dbo.Posts p
       LEFT JOIN dbo.MissionTypes mt ON mt.id = p.mission_type_id
       WHERE p.status = 'published' AND (@category IS NULL OR p.category = @category)
         AND (@typeId IS NULL OR p.mission_type_id = @typeId)
       ORDER BY p.pinned DESC, COALESCE(p.event_date, date(p.published_at)) DESC, p.id DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { limit, offset, category, typeId }
    ),
    query(
      `SELECT COUNT(*) AS total FROM dbo.Posts p
       WHERE p.status = 'published' AND (@category IS NULL OR p.category = @category)
         AND (@typeId IS NULL OR p.mission_type_id = @typeId)`,
      { category, typeId }
    ),
  ]);
  res.json({ items: rows, total: countRows[0].total, page, pageSize: limit });
}));

router.get('/posts/:id', wrap(async (req, res) => {
  const id = idParam(req);
  if (!id) return res.status(404).json({ error: 'غير موجود' });
  const rows = await query(
    `SELECT p.id, p.title, p.category, p.summary, p.body, p.cover_url, p.event_date, p.published_at, p.pinned,
            mt.id AS mission_type_id, mt.name AS mission_type_name, mt.color AS mission_type_color
     FROM dbo.Posts p
     LEFT JOIN dbo.MissionTypes mt ON mt.id = p.mission_type_id
     WHERE p.id = @id AND p.status = 'published'`,
    { id }
  );
  if (!rows.length) return res.status(404).json({ error: 'غير موجود' });
  const images = await query(
    'SELECT id, url, kind FROM dbo.PostImages WHERE post_id = @id ORDER BY sort_order, id',
    { id }
  );
  const paramedics = await query(
    `SELECT tm.id, tm.name, tm.role_title, tm.photo_url
     FROM dbo.PostParamedics pp JOIN dbo.TeamMembers tm ON tm.id = pp.team_member_id
     WHERE pp.post_id = @id ORDER BY tm.sort_order, tm.id`,
    { id }
  );
  res.json({ ...rows[0], images, paramedics });
}));

router.get('/team', wrap(async (req, res) => {
  res.json(await query(
    `SELECT id, name, role_title, group_name, photo_url
     FROM dbo.TeamMembers WHERE visible = 1 ORDER BY sort_order, id`
  ));
}));

router.get('/shifts', wrap(async (req, res) => {
  // Only today's shift - the home page shows who's on duty right now, not
  // a week-long schedule.
  const shifts = await query(
    `SELECT id, shift_date, start_time, end_time FROM dbo.Shifts
     WHERE shift_date = date('now') ORDER BY start_time LIMIT 1`
  );
  const members = shifts.length
    ? await query(`
        SELECT sm.shift_id, tm.id, tm.name, tm.photo_url
        FROM dbo.ShiftMembers sm JOIN dbo.TeamMembers tm ON tm.id = sm.team_member_id
        WHERE sm.shift_id IN (${shifts.map((s) => s.id).join(',')}) AND tm.visible = 1
        ORDER BY tm.sort_order, tm.id`)
    : [];
  const byShift = new Map();
  for (const m of members) {
    if (!byShift.has(m.shift_id)) byShift.set(m.shift_id, []);
    byShift.get(m.shift_id).push({ id: m.id, name: m.name, photo_url: m.photo_url });
  }
  res.json(shifts.map((s) => ({ ...s, members: byShift.get(s.id) || [] })));
}));

router.get('/gallery', wrap(async (req, res) => {
  res.json(await query(
    `SELECT id, url, caption, album
     FROM dbo.GalleryImages WHERE visible = 1 ORDER BY created_at DESC, id DESC LIMIT 300`
  ));
}));

const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'أرسلت رسائل كثيرة، حاول لاحقاً' },
});

router.post('/messages', messageLimiter, wrap(async (req, res) => {
  const name = str(req.body.name, 120);
  const message = str(req.body.message, 2000);
  const phone = str(req.body.phone, 40);
  const kind = req.body.kind === 'volunteer' ? 'volunteer' : 'contact';
  if (!name || !message) return res.status(400).json({ error: 'الاسم والرسالة مطلوبان' });
  await query(
    'INSERT INTO dbo.Messages (kind, name, phone, message) VALUES (@kind, @name, @phone, @message)',
    { kind, name, phone, message }
  );
  res.status(201).json({ ok: true });
}));

module.exports = router;
