-- Risala team site: SQL Server schema.
-- Run by `npm run db:init` (which creates the database first), or run it
-- yourself in SSMS inside the target database. Safe to run more than once.

IF OBJECT_ID('dbo.Users', 'U') IS NULL
CREATE TABLE dbo.Users (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  username      NVARCHAR(50)  NOT NULL UNIQUE,
  password_hash NVARCHAR(200) NOT NULL,
  display_name  NVARCHAR(100) NOT NULL,
  role          NVARCHAR(20)  NOT NULL CONSTRAINT CK_Users_role CHECK (role IN ('admin','editor')),
  active        BIT           NOT NULL CONSTRAINT DF_Users_active DEFAULT 1,
  created_at    DATETIME2     NOT NULL CONSTRAINT DF_Users_created DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Settings', 'U') IS NULL
CREATE TABLE dbo.Settings (
  [key]  NVARCHAR(60)  NOT NULL PRIMARY KEY,
  value  NVARCHAR(MAX) NULL
);
GO

IF OBJECT_ID('dbo.MissionTypes', 'U') IS NULL
CREATE TABLE dbo.MissionTypes (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(80) NOT NULL UNIQUE,
  color      NVARCHAR(20) NULL,
  sort_order INT NOT NULL CONSTRAINT DF_MissionTypes_sort DEFAULT 0,
  active     BIT NOT NULL CONSTRAINT DF_MissionTypes_active DEFAULT 1
);
GO

IF OBJECT_ID('dbo.Posts', 'U') IS NULL
CREATE TABLE dbo.Posts (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  title           NVARCHAR(200) NOT NULL,
  category        NVARCHAR(30)  NOT NULL CONSTRAINT DF_Posts_cat DEFAULT 'activity',
  mission_type_id INT           NULL REFERENCES dbo.MissionTypes(id),
  summary         NVARCHAR(500) NULL,
  body            NVARCHAR(MAX) NULL,
  cover_url       NVARCHAR(300) NULL,
  event_date      DATE          NULL,
  status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_Posts_status DEFAULT 'draft'
                  CONSTRAINT CK_Posts_status CHECK (status IN ('draft','pending','published')),
  created_by      INT           NULL REFERENCES dbo.Users(id),
  created_at      DATETIME2     NOT NULL CONSTRAINT DF_Posts_created DEFAULT SYSUTCDATETIME(),
  updated_at      DATETIME2     NOT NULL CONSTRAINT DF_Posts_updated DEFAULT SYSUTCDATETIME(),
  published_at    DATETIME2     NULL
);
GO

IF OBJECT_ID('dbo.PostImages', 'U') IS NULL
CREATE TABLE dbo.PostImages (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  post_id    INT NOT NULL REFERENCES dbo.Posts(id) ON DELETE CASCADE,
  url        NVARCHAR(300) NOT NULL,
  kind       NVARCHAR(10) NOT NULL CONSTRAINT DF_PostImages_kind DEFAULT 'image'
             CONSTRAINT CK_PostImages_kind CHECK (kind IN ('image','video')),
  sort_order INT NOT NULL CONSTRAINT DF_PostImages_sort DEFAULT 0
);
GO

IF OBJECT_ID('dbo.TeamMembers', 'U') IS NULL
CREATE TABLE dbo.TeamMembers (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(120) NOT NULL,
  role_title NVARCHAR(120) NULL,
  group_name NVARCHAR(80)  NULL,
  photo_url  NVARCHAR(300) NULL,
  sort_order INT NOT NULL CONSTRAINT DF_Team_sort DEFAULT 0,
  visible    BIT NOT NULL CONSTRAINT DF_Team_visible DEFAULT 1
);
GO

IF OBJECT_ID('dbo.PostParamedics', 'U') IS NULL
CREATE TABLE dbo.PostParamedics (
  post_id        INT NOT NULL REFERENCES dbo.Posts(id) ON DELETE CASCADE,
  team_member_id INT NOT NULL REFERENCES dbo.TeamMembers(id) ON DELETE CASCADE,
  CONSTRAINT PK_PostParamedics PRIMARY KEY (post_id, team_member_id)
);
GO

IF OBJECT_ID('dbo.GalleryImages', 'U') IS NULL
CREATE TABLE dbo.GalleryImages (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  url        NVARCHAR(300) NOT NULL,
  caption    NVARCHAR(200) NULL,
  album      NVARCHAR(80)  NULL,
  visible    BIT NOT NULL CONSTRAINT DF_Gallery_visible DEFAULT 1,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_Gallery_created DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Messages', 'U') IS NULL
CREATE TABLE dbo.Messages (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  kind       NVARCHAR(20)  NOT NULL CONSTRAINT DF_Msg_kind DEFAULT 'contact',
  name       NVARCHAR(120) NOT NULL,
  phone      NVARCHAR(40)  NULL,
  message    NVARCHAR(2000) NOT NULL,
  is_read    BIT NOT NULL CONSTRAINT DF_Msg_read DEFAULT 0,
  created_at DATETIME2 NOT NULL CONSTRAINT DF_Msg_created DEFAULT SYSUTCDATETIME()
);
GO

-- Medical/consumable stock: gauze, saline, tape, etc.
IF OBJECT_ID('dbo.InventoryItems', 'U') IS NULL
CREATE TABLE dbo.InventoryItems (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  name         NVARCHAR(150) NOT NULL,
  manufacturer NVARCHAR(150) NULL,
  unit         NVARCHAR(30)  NULL,
  quantity     INT           NOT NULL CONSTRAINT DF_Inv_qty DEFAULT 0,
  expiry_date  DATE          NULL,
  source       NVARCHAR(200) NULL,
  image_url    NVARCHAR(300) NULL,
  notes        NVARCHAR(500) NULL,
  created_at   DATETIME2     NOT NULL CONSTRAINT DF_Inv_created DEFAULT SYSUTCDATETIME(),
  updated_at   DATETIME2     NOT NULL CONSTRAINT DF_Inv_updated DEFAULT SYSUTCDATETIME()
);
GO

-- Manufacturer (brand/maker, e.g. "Elsada") is distinct from Source (how it
-- was obtained - donation, purchase, hospital); older databases only have
-- the latter.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryItems') AND name = 'manufacturer')
ALTER TABLE dbo.InventoryItems ADD manufacturer NVARCHAR(150) NULL;
GO

-- Units of measure for inventory items (box, pack, bottle, pcs...) - a
-- managed list (like MissionTypes/ServiceTypes) so the admin can add new
-- ones later without a code change. InventoryItems.unit stores the chosen
-- name as plain text, not a foreign key, so removing a unit here never
-- breaks items that already used it.
IF OBJECT_ID('dbo.InventoryUnits', 'U') IS NULL
CREATE TABLE dbo.InventoryUnits (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(30) NOT NULL UNIQUE,
  sort_order INT NOT NULL CONSTRAINT DF_InvUnits_sort DEFAULT 0,
  active     BIT NOT NULL CONSTRAINT DF_InvUnits_active DEFAULT 1
);
GO

-- Seed with the units already in use, the admin's named ones (box, pack,
-- bottle, pcs) ordered first.
IF NOT EXISTS (SELECT 1 FROM dbo.InventoryUnits)
INSERT INTO dbo.InventoryUnits (name, sort_order) VALUES
  ('قطعة', 1), ('صندوق', 2), ('عبوة', 3), ('زجاجة', 4),
  ('كيس', 5), ('طقم', 6), ('لفة', 7), ('زوج', 8), ('غرام', 9);
GO

-- Categories for inventory items (PPE, Wound Care, Respiratory...) - same
-- managed-list pattern as InventoryUnits.
IF OBJECT_ID('dbo.InventoryCategories', 'U') IS NULL
CREATE TABLE dbo.InventoryCategories (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(60) NOT NULL UNIQUE,
  sort_order INT NOT NULL CONSTRAINT DF_InvCats_sort DEFAULT 0,
  active     BIT NOT NULL CONSTRAINT DF_InvCats_active DEFAULT 1
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.InventoryCategories)
INSERT INTO dbo.InventoryCategories (name, sort_order) VALUES
  ('مستلزمات الحماية الشخصية', 1), ('العناية بالجروح والضمادات', 2), ('مستلزمات الحقن والمحاليل الوريدية', 3),
  ('معدات التنفس', 4), ('القسطرة والمسالك البولية', 5),
  ('معدات الحركة والتجهيزات الطبية', 6), ('التعقيم والأدوات الجراحية', 7),
  ('النظافة والمطهرات', 8), ('مستلزمات عامة', 9);
GO

-- category: plain text, same reasoning as unit (not a foreign key, so
-- retiring a category never breaks an item that already used it).
--
-- Asset tracking: durable, reusable equipment (a wheelchair, a monitor) isn't
-- "stock that depletes" the way gauze or syringes are. is_asset marks an
-- item as a tracked asset rather than a consumable; the location/condition/
-- serial/maintenance fields only apply to those and stay blank for
-- consumables.
--
-- min_quantity: an optional reorder threshold - when quantity falls to or
-- below it, the item is flagged low-stock. Left blank until the admin sets
-- a real threshold from their own usage patterns.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryItems') AND name = 'category')
ALTER TABLE dbo.InventoryItems ADD
  category               NVARCHAR(60)  NULL,
  is_asset               BIT           NOT NULL CONSTRAINT DF_Inv_is_asset DEFAULT 0,
  location               NVARCHAR(120) NULL,
  asset_condition        NVARCHAR(30)  NULL,
  serial_number          NVARCHAR(100) NULL,
  last_maintenance_date  DATE          NULL,
  min_quantity           INT           NULL;
GO

-- A log of stock drawn from InventoryItems and what it was used for; each
-- row also decrements the item's quantity (handled in the API, not a trigger).
IF OBJECT_ID('dbo.InventoryUsage', 'U') IS NULL
CREATE TABLE dbo.InventoryUsage (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  item_id    INT NOT NULL REFERENCES dbo.InventoryItems(id) ON DELETE CASCADE,
  quantity   INT NOT NULL,
  purpose    NVARCHAR(500) NOT NULL,
  used_at    DATE NOT NULL,
  used_by    INT NULL REFERENCES dbo.Users(id),
  created_at DATETIME2 NOT NULL CONSTRAINT DF_Usage_created DEFAULT SYSUTCDATETIME()
);
GO

-- Durable equipment (wheelchairs, oxygen bottles...) lent out and expected
-- back; a signed receipt PDF is generated client-side from this data.
IF OBJECT_ID('dbo.LoanedItems', 'U') IS NULL
CREATE TABLE dbo.LoanedItems (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  item_name       NVARCHAR(150) NOT NULL,
  recipient_name  NVARCHAR(150) NOT NULL,
  recipient_phone NVARCHAR(40)  NULL,
  loan_date       DATE NOT NULL,
  return_date     DATE NULL,
  status          NVARCHAR(20) NOT NULL CONSTRAINT DF_Loan_status DEFAULT 'out'
                  CONSTRAINT CK_Loan_status CHECK (status IN ('out','returned')),
  image_url       NVARCHAR(300) NULL,
  notes           NVARCHAR(500) NULL,
  created_by      INT NULL REFERENCES dbo.Users(id),
  created_at      DATETIME2 NOT NULL CONSTRAINT DF_Loan_created DEFAULT SYSUTCDATETIME()
);
GO

-- Medical services performed (wound dressing, sutures, IV hookup...), admin
-- only - feeds the monthly report, never shown on the public site.
IF OBJECT_ID('dbo.ServiceTypes', 'U') IS NULL
CREATE TABLE dbo.ServiceTypes (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL CONSTRAINT DF_SvcTypes_sort DEFAULT 0,
  active     BIT NOT NULL CONSTRAINT DF_SvcTypes_active DEFAULT 1
);
GO

IF OBJECT_ID('dbo.ServiceLogs', 'U') IS NULL
CREATE TABLE dbo.ServiceLogs (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  service_type_id INT NOT NULL REFERENCES dbo.ServiceTypes(id),
  title           NVARCHAR(200) NULL,
  cover_url       NVARCHAR(300) NULL,
  quantity        INT NOT NULL CONSTRAINT DF_SvcLog_qty DEFAULT 1,
  service_date    DATE NOT NULL,
  notes           NVARCHAR(500) NULL,
  created_by      INT NULL REFERENCES dbo.Users(id),
  created_at      DATETIME2 NOT NULL CONSTRAINT DF_SvcLog_created DEFAULT SYSUTCDATETIME()
);
GO

-- Team members who took part in a logged service - many-to-many, same shape
-- as PostParamedics for missions.
IF OBJECT_ID('dbo.ServiceLogMembers', 'U') IS NULL
CREATE TABLE dbo.ServiceLogMembers (
  service_log_id INT NOT NULL REFERENCES dbo.ServiceLogs(id) ON DELETE CASCADE,
  team_member_id INT NOT NULL REFERENCES dbo.TeamMembers(id) ON DELETE CASCADE,
  CONSTRAINT PK_ServiceLogMembers PRIMARY KEY (service_log_id, team_member_id)
);
GO

-- Migration guards: add new columns to a Posts/PostImages table created before
-- mission types and media kind existed, so this file stays safe to re-run.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Posts') AND name = 'mission_type_id')
ALTER TABLE dbo.Posts ADD mission_type_id INT NULL REFERENCES dbo.MissionTypes(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PostImages') AND name = 'kind')
ALTER TABLE dbo.PostImages ADD kind NVARCHAR(10) NOT NULL CONSTRAINT DF_PostImages_kind DEFAULT 'image'
  CONSTRAINT CK_PostImages_kind CHECK (kind IN ('image','video'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Posts_status_date')
CREATE INDEX IX_Posts_status_date ON dbo.Posts (status, published_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Posts_mission_type')
CREATE INDEX IX_Posts_mission_type ON dbo.Posts (mission_type_id) WHERE mission_type_id IS NOT NULL;
GO

-- Pinned posts: the admin can pin up to 3 published posts (any category) to
-- keep them at the top of the public lists; enforced in the API, not here.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Posts') AND name = 'pinned')
ALTER TABLE dbo.Posts ADD pinned BIT NOT NULL CONSTRAINT DF_Posts_pinned DEFAULT 0;
GO

-- Member register: personal, contact and enrolment details kept for each team
-- member (admin only; the public team page never selects these columns).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TeamMembers') AND name = 'father_name')
ALTER TABLE dbo.TeamMembers ADD
  father_name  NVARCHAR(120) NULL,
  mother_name  NVARCHAR(120) NULL,
  nickname     NVARCHAR(80)  NULL,
  birth_date   DATE          NULL,
  birth_place  NVARCHAR(120) NULL,
  blood_type   NVARCHAR(5)   NULL,
  registry_no  NVARCHAR(40)  NULL,
  education    NVARCHAR(80)  NULL,
  phone        NVARCHAR(40)  NULL,
  address      NVARCHAR(200) NULL,
  joined_on    DATE          NULL,
  scout_unit   NVARCHAR(120) NULL,
  district     NVARCHAR(120) NULL,
  region       NVARCHAR(120) NULL,
  town         NVARCHAR(120) NULL,
  notes        NVARCHAR(1000) NULL;
GO

-- Names: `name` holds the full name (first + father + family), built on save
-- from the separate first_name, father_name and family_name columns.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TeamMembers') AND name = 'first_name')
BEGIN
  ALTER TABLE dbo.TeamMembers ADD first_name NVARCHAR(120) NULL, family_name NVARCHAR(120) NULL;
  ALTER TABLE dbo.TeamMembers ALTER COLUMN name NVARCHAR(400) NOT NULL;
END
GO

-- Driving license: whether the member holds one, its number, and photos of
-- both sides (admin only; the public team page never selects these columns).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TeamMembers') AND name = 'has_license')
ALTER TABLE dbo.TeamMembers ADD
  has_license        BIT NOT NULL CONSTRAINT DF_Team_has_license DEFAULT 0,
  license_number     NVARCHAR(50)  NULL,
  license_front_url  NVARCHAR(300) NULL,
  license_back_url   NVARCHAR(300) NULL;
GO

-- Ambulance finance: income sources (donations, grants...) and outcome types
-- (fuel, maintenance...) are each a managed list, same pattern as
-- InventoryUnits/InventoryCategories. `kind` separates the two lists.
IF OBJECT_ID('dbo.AmbulanceCategories', 'U') IS NULL
CREATE TABLE dbo.AmbulanceCategories (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(100) NOT NULL,
  kind       NVARCHAR(10) NOT NULL CONSTRAINT CK_AmbCat_kind CHECK (kind IN ('income','outcome')),
  sort_order INT NOT NULL CONSTRAINT DF_AmbCat_sort DEFAULT 0,
  active     BIT NOT NULL CONSTRAINT DF_AmbCat_active DEFAULT 1,
  CONSTRAINT UQ_AmbCat_name_kind UNIQUE (name, kind)
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AmbulanceCategories)
INSERT INTO dbo.AmbulanceCategories (name, kind, sort_order) VALUES
  (N'تبرعات', 'income', 1), (N'دعم جهة مانحة', 'income', 2), (N'اشتراكات', 'income', 3), (N'إيرادات أخرى', 'income', 4),
  (N'وقود', 'outcome', 1), (N'صيانة', 'outcome', 2), (N'تأمين', 'outcome', 3), (N'رسوم وضرائب', 'outcome', 4), (N'مصاريف أخرى', 'outcome', 5);
GO

-- Income & expense ledger for the ambulance (money, not stock). One combined
-- fund today (ambulance_number defaults to the only vehicle, 160) - the
-- column lets future vehicles be filtered separately without a migration.
IF OBJECT_ID('dbo.AmbulanceTransactions', 'U') IS NULL
CREATE TABLE dbo.AmbulanceTransactions (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  type             NVARCHAR(10) NOT NULL CONSTRAINT CK_AmbTx_type CHECK (type IN ('income','outcome')),
  amount           DECIMAL(12,2) NOT NULL CONSTRAINT CK_AmbTx_amount CHECK (amount >= 0),
  category         NVARCHAR(100) NULL,
  ambulance_number NVARCHAR(20) NOT NULL CONSTRAINT DF_AmbTx_number DEFAULT N'160',
  party            NVARCHAR(150) NULL,
  transaction_date DATE NOT NULL,
  receipt_url      NVARCHAR(300) NULL,
  notes            NVARCHAR(500) NULL,
  created_by       INT NULL REFERENCES dbo.Users(id),
  created_at       DATETIME2 NOT NULL CONSTRAINT DF_AmbTx_created DEFAULT SYSUTCDATETIME()
);
GO

-- Durable equipment carried on the ambulance (spinal board, scoop stretcher,
-- field stretcher...) - distinct from the warehouse assets page since it's
-- vehicle gear, tracked the same way (condition/serial/maintenance).
IF OBJECT_ID('dbo.AmbulanceAssets', 'U') IS NULL
CREATE TABLE dbo.AmbulanceAssets (
  id                    INT IDENTITY(1,1) PRIMARY KEY,
  name                  NVARCHAR(150) NOT NULL,
  manufacturer          NVARCHAR(150) NULL,
  category              NVARCHAR(60) NULL,
  quantity              INT NOT NULL CONSTRAINT DF_AmbAsset_qty DEFAULT 1,
  ambulance_number      NVARCHAR(20) NOT NULL CONSTRAINT DF_AmbAsset_number DEFAULT N'160',
  asset_condition       NVARCHAR(30) NULL,
  serial_number         NVARCHAR(100) NULL,
  last_maintenance_date DATE NULL,
  source                NVARCHAR(200) NULL,
  image_url             NVARCHAR(300) NULL,
  notes                 NVARCHAR(500) NULL,
  created_at            DATETIME2 NOT NULL CONSTRAINT DF_AmbAsset_created DEFAULT SYSUTCDATETIME(),
  updated_at            DATETIME2 NOT NULL CONSTRAINT DF_AmbAsset_updated DEFAULT SYSUTCDATETIME()
);
GO

-- Shift schedule: a time range on a given day, with the team members on duty
-- for it. The admin can generate a branded image of a date range's shifts
-- for sharing, same spirit as the activity cover generator.
IF OBJECT_ID('dbo.Shifts', 'U') IS NULL
CREATE TABLE dbo.Shifts (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  notes      NVARCHAR(300) NULL,
  created_by INT NULL REFERENCES dbo.Users(id),
  created_at DATETIME2 NOT NULL CONSTRAINT DF_Shift_created DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Shifts_date')
CREATE INDEX IX_Shifts_date ON dbo.Shifts (shift_date, start_time);
GO

-- Who's on duty for a shift - same composite-key join pattern as
-- PostParamedics.
IF OBJECT_ID('dbo.ShiftMembers', 'U') IS NULL
CREATE TABLE dbo.ShiftMembers (
  shift_id       INT NOT NULL REFERENCES dbo.Shifts(id) ON DELETE CASCADE,
  team_member_id INT NOT NULL REFERENCES dbo.TeamMembers(id) ON DELETE CASCADE,
  CONSTRAINT PK_ShiftMembers PRIMARY KEY (shift_id, team_member_id)
);
GO

-- Blood donations the association coordinates between a donor and a
-- recipient/hospital. A flat record, not tied to a managed list.
IF OBJECT_ID('dbo.BloodDonations', 'U') IS NULL
CREATE TABLE dbo.BloodDonations (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  donor_name     NVARCHAR(150) NOT NULL,
  donation_date  DATE NOT NULL,
  blood_type     NVARCHAR(5) NULL,
  hospital       NVARCHAR(150) NULL,
  recipient_name NVARCHAR(150) NULL,
  notes          NVARCHAR(500) NULL,
  created_by     INT NULL REFERENCES dbo.Users(id),
  created_at     DATETIME2 NOT NULL CONSTRAINT DF_BloodDon_created DEFAULT SYSUTCDATETIME()
);
GO

-- Public blood-donor registry: anyone can submit their own info from the
-- public site. Staff search this list by blood type when a need comes in,
-- then mark whoever actually gave blood - last_donation_date drives the
-- six-month cooldown so the same donor isn't called again too soon.
CREATE TABLE dbo.BloodDonors (
  id                 INT IDENTITY(1,1) PRIMARY KEY,
  name               NVARCHAR(150) NOT NULL,
  phone              NVARCHAR(40) NOT NULL,
  blood_type         NVARCHAR(5) NOT NULL CONSTRAINT CK_BloodDonors_type CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  area               NVARCHAR(100) NULL,
  notes              NVARCHAR(500) NULL,
  birth_date         DATE NULL,
  discarded          BIT NOT NULL CONSTRAINT DF_BloodDonors_discarded DEFAULT 0,
  last_donation_date DATE NULL,
  active             BIT NOT NULL CONSTRAINT DF_BloodDonors_active DEFAULT 1,
  created_at         DATETIME2 NOT NULL CONSTRAINT DF_BloodDonors_created DEFAULT SYSUTCDATETIME()
);
GO

-- Donated-item types (دواء، حفاضات أطفال، حليب أطفال...) - managed list,
-- same pattern as ServiceTypes.
IF OBJECT_ID('dbo.DonationItemTypes', 'U') IS NULL
CREATE TABLE dbo.DonationItemTypes (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL CONSTRAINT DF_DonItemTypes_sort DEFAULT 0,
  active     BIT NOT NULL CONSTRAINT DF_DonItemTypes_active DEFAULT 1
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.DonationItemTypes)
INSERT INTO dbo.DonationItemTypes (name, sort_order) VALUES
  (N'دواء', 1), (N'حفاضات أطفال', 2), (N'حليب أطفال', 3);
GO

-- Social/charitable donations handed to the community (medicine, baby
-- diapers, infant formula...) - same type+log pattern as ServiceTypes/Logs,
-- plus who gave it out and who received it. `item_detail` holds the
-- specific name when the type needs one (e.g. the medicine's name).
IF OBJECT_ID('dbo.CommunityDonations', 'U') IS NULL
CREATE TABLE dbo.CommunityDonations (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  item_type_id   INT NOT NULL REFERENCES dbo.DonationItemTypes(id),
  item_detail    NVARCHAR(150) NULL,
  team_member_id INT NULL REFERENCES dbo.TeamMembers(id),
  recipient_name NVARCHAR(150) NULL,
  donation_date  DATE NOT NULL,
  notes          NVARCHAR(500) NULL,
  created_by     INT NULL REFERENCES dbo.Users(id),
  created_at     DATETIME2 NOT NULL CONSTRAINT DF_ComDon_created DEFAULT SYSUTCDATETIME()
);
GO

-- Donation items now carry their own stock (a photo, quantity on hand and an
-- optional expiry - medicine in particular needs this) rather than being a
-- bare category name.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DonationItemTypes') AND name = 'image_url')
ALTER TABLE dbo.DonationItemTypes ADD
  image_url   NVARCHAR(300) NULL,
  quantity    INT NOT NULL CONSTRAINT DF_DonItem_qty DEFAULT 0,
  expiry_date DATE NULL;
GO

-- How many units a community donation handed out - drawn from, and
-- restored to, the item's own stock (same pattern as InventoryUsage).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CommunityDonations') AND name = 'quantity')
ALTER TABLE dbo.CommunityDonations ADD quantity INT NOT NULL CONSTRAINT DF_ComDon_qty DEFAULT 1;
GO

-- Which admin pages an editor can reach (JSON array of page keys, e.g.
-- '["posts","reports"]'). NULL/empty means none yet. Ignored for admins,
-- who always have full access - see requireModule in server/src/auth.js.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'permissions')
ALTER TABLE dbo.Users ADD permissions NVARCHAR(MAX) NULL;
GO
