// SQLite via Node's built-in driver (no native build, no server process to
// hang on - the whole reason this replaced SQL Server/LocalDB). The database
// is a single file; see database/schema.sqlite.sql for its shape and
// scripts/init-sqlite.js for how it's created and seeded.
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_FILE
  ? path.resolve(__dirname, '..', process.env.DB_FILE)
  : path.join(__dirname, '..', 'data', 'risala.db');

let db = null;
function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

// Kept so index.js's boot sequence ("Connected to..." log, the one-time
// migrate()/export hooks) doesn't need to change shape - opening the file is
// synchronous and effectively instant, so this just resolves immediately.
async function getPool() {
  getDb();
  return db;
}

// query('SELECT ... WHERE id = @id', { id: 5 }) -> array of rows for a
// SELECT; for an INSERT, [{ id: lastInsertRowid }] (replacing T-SQL's
// `OUTPUT INSERTED.id`, stripped below); otherwise an empty array.
// The route files were written for SQL Server, so this also strips the
// `dbo.` schema prefix (SQLite has no schemas) and rewrites OFFSET/FETCH
// paging to LIMIT/OFFSET - both pure, unambiguous text substitutions that
// let the other ~130 query() call sites stay exactly as they were. The
// handful of T-SQL-only constructs that aren't safe to blanket-rewrite this
// way (TOP, YEAR()/MONTH()/DATEADD(), the Settings MERGE) were fixed at
// their call sites instead.
async function query(text, params = {}) {
  const conn = getDb();
  let sqlText = text
    .replace(/\bdbo\./g, '')
    .replace(/OFFSET\s+(@\w+)\s+ROWS\s+FETCH\s+NEXT\s+(@\w+)\s+ROWS\s+ONLY/i, 'LIMIT $2 OFFSET $1')
    .replace(/\s+OUTPUT\s+INSERTED\.id\b/i, '');

  // node:sqlite throws "Unknown named parameter" if `params` has a key that
  // isn't actually written as @key in the SQL text - unlike mssql, which
  // silently ignored unused params. Several call sites build their WHERE
  // clause conditionally (an optional filter's @placeholder only appears
  // when the filter is active) while always passing the full params object,
  // so only bind the names the query text actually references.
  const used = new Set([...sqlText.matchAll(/@(\w+)/g)].map((m) => m[1]));
  const bound = {};
  for (const [name, value] of Object.entries(params)) {
    if (!used.has(name)) continue;
    if (value === undefined) bound[name] = null;
    else if (typeof value === 'boolean') bound[name] = value ? 1 : 0;
    else bound[name] = value;
  }

  let stmt;
  try {
    stmt = conn.prepare(sqlText);
  } catch (err) {
    throw classifyError(err);
  }
  const isSelect = /^\s*SELECT/i.test(sqlText);
  try {
    if (isSelect) return stmt.all(bound);

    const info = stmt.run(bound);
    if (/^\s*INSERT/i.test(sqlText)) return [{ id: Number(info.lastInsertRowid) }];
    return [];
  } catch (err) {
    throw classifyError(err);
  }
}

// node:sqlite errors carry a numeric SQLite result code in err.errcode, not
// mssql's err.number - route handlers that used to check err.number for a
// duplicate-key (2627/2601) or FK-in-use (547) violation would otherwise
// silently stop working. SQLite's extended result codes encode the primary
// code in their low byte (e.g. 2067 = SQLITE_CONSTRAINT_UNIQUE = 19 | 8<<8),
// so a single classification here covers every call site instead of each one
// guessing at the driver's error shape. Errors are rethrown unchanged except
// for this one added `.kind` field, so everything else about them (message,
// stack, code) still works as before.
const SQLITE_CONSTRAINT = 19;
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;
// Primary result codes for infrastructure-level failures (the database file
// itself can't be read/written), as opposed to SQLITE_CONSTRAINT, which means
// the connection is fine but this particular row was rejected.
const SQLITE_UNAVAILABLE_CODES = new Set([5, 6, 8, 10, 11, 13, 14, 26]); // BUSY, LOCKED, READONLY, IOERR, CORRUPT, FULL, CANTOPEN, NOTADB

function classifyError(err) {
  if (typeof err.errcode !== 'number') return err;
  const primary = err.errcode & 0xff;
  if (primary === SQLITE_CONSTRAINT) {
    if (err.errcode === SQLITE_CONSTRAINT_UNIQUE) err.kind = 'unique_violation';
    else if (err.errcode === SQLITE_CONSTRAINT_FOREIGNKEY) err.kind = 'fk_violation';
    else err.kind = 'constraint_violation';
  } else if (SQLITE_UNAVAILABLE_CODES.has(primary)) {
    err.kind = 'unavailable';
  }
  return err;
}

module.exports = { query, getPool, getDb, DB_PATH };
