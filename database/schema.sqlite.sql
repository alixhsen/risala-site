-- Risala team site: SQLite schema. Equivalent to schema.sql (SQL Server),
-- flattened into one clean set of CREATE TABLEs (SQLite has no ALTER-COLUMN
-- migration story worth having, so the incremental ALTERs from the SQL
-- Server version are merged in here directly, column for column). No seed
-- data here - scripts/import-sqlite.js brings in the real rows exported
-- from the live SQL Server database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','editor')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  permissions   TEXT
);

CREATE TABLE IF NOT EXISTS Settings (
  [key]  TEXT PRIMARY KEY,
  value  TEXT
);

CREATE TABLE IF NOT EXISTS MissionTypes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'activity',
  mission_type_id INTEGER REFERENCES MissionTypes(id),
  summary         TEXT,
  body            TEXT,
  cover_url       TEXT,
  event_date      TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published')),
  created_by      INTEGER REFERENCES Users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  published_at    TEXT,
  pinned          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS IX_Posts_status_date ON Posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS IX_Posts_mission_type ON Posts (mission_type_id) WHERE mission_type_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS PostImages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES Posts(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS TeamMembers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  role_title         TEXT,
  group_name         TEXT,
  photo_url          TEXT,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  visible            INTEGER NOT NULL DEFAULT 1,
  father_name        TEXT,
  mother_name        TEXT,
  nickname           TEXT,
  birth_date         TEXT,
  birth_place        TEXT,
  blood_type         TEXT,
  registry_no        TEXT,
  education          TEXT,
  phone              TEXT,
  address            TEXT,
  joined_on          TEXT,
  scout_unit         TEXT,
  district           TEXT,
  region             TEXT,
  town               TEXT,
  notes              TEXT,
  first_name         TEXT,
  family_name        TEXT,
  has_license        INTEGER NOT NULL DEFAULT 0,
  license_number     TEXT,
  license_front_url  TEXT,
  license_back_url   TEXT
);

CREATE TABLE IF NOT EXISTS PostParamedics (
  post_id        INTEGER NOT NULL REFERENCES Posts(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES TeamMembers(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, team_member_id)
);

CREATE TABLE IF NOT EXISTS GalleryImages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL,
  caption    TEXT,
  album      TEXT,
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'contact',
  name       TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS InventoryItems (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  manufacturer          TEXT,
  unit                  TEXT,
  quantity              INTEGER NOT NULL DEFAULT 0,
  expiry_date           TEXT,
  source                TEXT,
  image_url             TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  category              TEXT,
  is_asset              INTEGER NOT NULL DEFAULT 0,
  location              TEXT,
  asset_condition       TEXT,
  serial_number         TEXT,
  last_maintenance_date TEXT,
  min_quantity          INTEGER
);

CREATE TABLE IF NOT EXISTS InventoryUnits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS InventoryCategories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS InventoryUsage (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES InventoryItems(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL,
  purpose    TEXT NOT NULL,
  used_at    TEXT NOT NULL,
  used_by    INTEGER REFERENCES Users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS LoanedItems (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name       TEXT NOT NULL,
  recipient_name  TEXT NOT NULL,
  recipient_phone TEXT,
  loan_date       TEXT NOT NULL,
  return_date     TEXT,
  status          TEXT NOT NULL DEFAULT 'out' CHECK (status IN ('out','returned')),
  image_url       TEXT,
  notes           TEXT,
  created_by      INTEGER REFERENCES Users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ServiceTypes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ServiceLogs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  service_type_id INTEGER NOT NULL REFERENCES ServiceTypes(id),
  title           TEXT,
  cover_url       TEXT,
  quantity        INTEGER NOT NULL DEFAULT 1,
  service_date    TEXT NOT NULL,
  notes           TEXT,
  created_by      INTEGER REFERENCES Users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Team members who took part in a logged service - many-to-many, same shape
-- as PostParamedics for missions, so a service can credit more than one
-- member in the per-member reports.
CREATE TABLE IF NOT EXISTS ServiceLogMembers (
  service_log_id INTEGER NOT NULL REFERENCES ServiceLogs(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES TeamMembers(id) ON DELETE CASCADE,
  PRIMARY KEY (service_log_id, team_member_id)
);

CREATE TABLE IF NOT EXISTS AmbulanceCategories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('income','outcome')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  UNIQUE (name, kind)
);

CREATE TABLE IF NOT EXISTS AmbulanceTransactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  type             TEXT NOT NULL CHECK (type IN ('income','outcome')),
  amount           REAL NOT NULL CHECK (amount >= 0),
  category         TEXT,
  ambulance_number TEXT NOT NULL DEFAULT '160',
  party            TEXT,
  transaction_date TEXT NOT NULL,
  receipt_url      TEXT,
  notes            TEXT,
  created_by       INTEGER REFERENCES Users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS AmbulanceAssets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  manufacturer          TEXT,
  category              TEXT,
  quantity              INTEGER NOT NULL DEFAULT 1,
  ambulance_number      TEXT NOT NULL DEFAULT '160',
  asset_condition       TEXT,
  serial_number         TEXT,
  last_maintenance_date TEXT,
  source                TEXT,
  image_url             TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Shifts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  notes      TEXT,
  created_by INTEGER REFERENCES Users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS IX_Shifts_date ON Shifts (shift_date, start_time);

CREATE TABLE IF NOT EXISTS ShiftMembers (
  shift_id       INTEGER NOT NULL REFERENCES Shifts(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES TeamMembers(id) ON DELETE CASCADE,
  PRIMARY KEY (shift_id, team_member_id)
);

CREATE TABLE IF NOT EXISTS BloodDonations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_name     TEXT NOT NULL,
  donation_date  TEXT NOT NULL,
  blood_type     TEXT,
  hospital       TEXT,
  recipient_name TEXT,
  notes          TEXT,
  created_by     INTEGER REFERENCES Users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Public blood-donor registry: anyone can submit their own info from the
-- public site. Staff search this list by blood type when a need comes in,
-- then mark whoever actually gave blood - last_donation_date drives the
-- six-month cooldown so the same donor isn't called again too soon.
CREATE TABLE IF NOT EXISTS BloodDonors (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  phone              TEXT NOT NULL,
  blood_type         TEXT NOT NULL CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  area               TEXT,
  notes              TEXT,
  birth_date         TEXT,
  discarded          INTEGER NOT NULL DEFAULT 0,
  last_donation_date TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS DonationItemTypes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  image_url   TEXT,
  quantity    INTEGER NOT NULL DEFAULT 0,
  expiry_date TEXT
);

CREATE TABLE IF NOT EXISTS CommunityDonations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type_id   INTEGER NOT NULL REFERENCES DonationItemTypes(id),
  item_detail    TEXT,
  team_member_id INTEGER REFERENCES TeamMembers(id),
  recipient_name TEXT,
  donation_date  TEXT NOT NULL,
  notes          TEXT,
  created_by     INTEGER REFERENCES Users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  quantity       INTEGER NOT NULL DEFAULT 1
);
