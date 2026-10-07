const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { signToken, setSessionCookie, clearSessionCookie, requireCsrfHeader, requireAuth } = require('../auth');
const { wrap, str } = require('../util');

const router = express.Router();

// Failed attempts count against the limit; successful logins do not, so a
// signed-in admin is never locked out by their own logins.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'محاولات كثيرة، حاول بعد قليل' },
});

// Compared when the username does not exist, so an unknown user takes as long
// to answer as a wrong password and the response does not reveal which it was.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', requireCsrfHeader, loginLimiter, wrap(async (req, res) => {
  const username = str(req.body.username, 50);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !password) return res.status(400).json({ error: 'أدخل اسم المستخدم وكلمة المرور' });

  const rows = await query(
    'SELECT id, username, display_name, role, password_hash FROM dbo.Users WHERE username = @u AND active = 1',
    { u: username }
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

  setSessionCookie(res, signToken(user));
  res.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } });
}));

router.post('/logout', requireCsrfHeader, (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
