// Wraps an async route so rejected promises reach the error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const str = (v, max) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

// Only files stored by our own upload endpoint may be referenced.
const uploadUrl = (v) => {
  const s = str(v, 300);
  return s && /^\/uploads\/[A-Za-z0-9._-]+$/.test(s) ? s : null;
};

const httpUrl = (v) => {
  const s = str(v, 300);
  return s && /^https?:\/\//i.test(s) ? s : '';
};

const dateOnly = (v) => {
  const s = str(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const timeOnly = (v) => {
  const s = str(v, 5);
  return s && /^\d{2}:\d{2}$/.test(s) ? s : null;
};

// Whole-years-old as of today, computed in UTC so the server's local
// timezone can't shift someone across their birthday by a day.
const isAdult = (birthDate) => {
  if (!dateOnly(birthDate)) return true; // unknown birth date: don't discard
  const dob = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthdayThisYear = now.getUTCMonth() < dob.getUTCMonth()
    || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthdayThisYear) age--;
  return age >= 18;
};

const idParam = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Normalizes a body field that should be an array of positive integer ids
// (e.g. the paramedics on a mission) into a deduped array, dropping junk.
const intList = (v) => {
  if (!Array.isArray(v)) return [];
  const ids = v.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(ids)];
};

module.exports = { wrap, str, uploadUrl, httpUrl, dateOnly, timeOnly, isAdult, idParam, intList };
