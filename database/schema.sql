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
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(150) NOT NULL,
  unit        NVARCHAR(30)  NULL,
  quantity    INT           NOT NULL CONSTRAINT DF_Inv_qty DEFAULT 0,
  expiry_date DATE          NULL,
  source      NVARCHAR(200) NULL,
  image_url   NVARCHAR(300) NULL,
  notes       NVARCHAR(500) NULL,
  created_at  DATETIME2     NOT NULL CONSTRAINT DF_Inv_created DEFAULT SYSUTCDATETIME(),
  updated_at  DATETIME2     NOT NULL CONSTRAINT DF_Inv_updated DEFAULT SYSUTCDATETIME()
);
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
  team_member_id  INT NULL REFERENCES dbo.TeamMembers(id),
  quantity        INT NOT NULL CONSTRAINT DF_SvcLog_qty DEFAULT 1,
  service_date    DATE NOT NULL,
  notes           NVARCHAR(500) NULL,
  created_by      INT NULL REFERENCES dbo.Users(id),
  created_at      DATETIME2 NOT NULL CONSTRAINT DF_SvcLog_created DEFAULT SYSUTCDATETIME()
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
