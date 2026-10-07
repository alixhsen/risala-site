const jwt = require('jsonwebtoken');
const { query } = require('./db');

const SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'risala_session';
const SESSION_HOURS = 12;
// Only sent over HTTPS in production, so the cookie never travels in plain HTTP.
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: `${SESSION_HOURS}h` });
}

// Reads one cookie from the Cookie header (no extra cookie-parser package needed).
function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// httpOnly keeps the token away from page scripts; SameSite=Strict stops other
// sites from sending it along with their requests.
function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: SECURE_COOKIE,
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: SECURE_COOKIE, path: '/' });
}

// Every state-changing request must send this custom header. A cross-site form
// or link cannot set custom headers, so forged requests are refused.
function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'risala-admin') return res.status(403).json({ error: 'طلب غير مقبول' });
  next();
}

// Verifies the session cookie and re-reads the user, so a disabled account or a
// role change takes effect immediately instead of when the token expires.
async function requireAuth(req, res, next) {
  try {
    const token = readCookie(req, COOKIE_NAME);
    if (!token) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    const payload = jwt.verify(token, SECRET);
    const rows = await query(
      'SELECT id, username, display_name, role FROM dbo.Users WHERE id = @id AND active = 1',
      { id: Number(payload.sub) }
    );
    if (!rows.length) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول من جديد' });
    }
    next(err);
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'هذه العملية للمدير فقط' });
  next();
}

module.exports = { signToken, setSessionCookie, clearSessionCookie, requireCsrfHeader, requireAuth, adminOnly };
