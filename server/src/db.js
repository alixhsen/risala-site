// Leaving DB_USER empty means "connect with my own Windows login" (e.g. to
// LocalDB, or a local SQL Server instance with Windows auth). That needs the
// native msnodesqlv8 driver instead of the pure-JS tedious driver that plain
// `mssql` uses for SQL Server Authentication (DB_USER/DB_PASSWORD).
const windowsAuth = !process.env.DB_USER;
const sql = windowsAuth ? require('mssql/msnodesqlv8') : require('mssql');

// mssql's own Windows-auth connection string defaults to the legacy "SQL
// Server Native Client 11.0" driver, which isn't installed on modern
// machines. Build the ODBC connection string ourselves with a driver that
// actually ships today.
const ODBC_DRIVER = 'ODBC Driver 17 for SQL Server';

function buildConfig(database) {
  const pool = { max: 10, min: 0, idleTimeoutMillis: 30000 };
  if (windowsAuth) {
    const server = process.env.DB_SERVER || 'localhost';
    return {
      connectionString: `Driver={${ODBC_DRIVER}};Server=${server};Database=${database};Trusted_Connection=Yes;`,
      pool,
    };
  }
  const instance = (process.env.DB_INSTANCE || '').trim();
  const port = (process.env.DB_PORT || '').trim();
  const cfg = {
    server: process.env.DB_SERVER || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: true,
    },
    pool,
  };
  if (instance) cfg.options.instanceName = instance;
  else cfg.port = Number(port) || 1433;
  return cfg;
}

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig(process.env.DB_NAME || 'RisalaSite'))
      .connect()
      .catch((err) => {
        poolPromise = null; // allow a retry on the next request
        throw err;
      });
  }
  return poolPromise;
}

// query('SELECT ... WHERE id = @id', { id: 5 }) -> array of rows
async function query(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string') request.input(name, sql.NVarChar(sql.MAX), value);
    else request.input(name, value === undefined ? null : value);
  }
  const result = await request.query(text);
  return result.recordset || [];
}

module.exports = { sql, query, getPool, buildConfig };
