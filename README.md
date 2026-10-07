# جمعية الرسالة للإسعاف الصحي — Risala Health Ambulance Association

The public website and admin panel for **فرقة شهداء بئر حسن** (Shuhada Bir Hassan
team), operating out of **مركز الإمام علي الهادي (ع) التطوعي**. A full-stack,
Arabic-first (RTL) web app: a public site presenting the team's missions,
activities and news, and a role-based admin panel for staff to run it —
publishing posts, managing the roster, tracking inventory and service logs,
and generating branded cover images, all without touching code.

## Features

**Public site**
- Home page with a mission highlights board, activities, news and a
  horizontally-scrolling team roster
- Dedicated sections for missions, activities, news, gallery, team and about/contact
- Rich post detail pages: hero cover image, facts strip, response crew,
  a horizontally-scrolling photo/video gallery, related posts and social sharing
- Pinned posts (up to 3) surfaced across the site with a visible badge
- Fully right-to-left, Arabic layout with a self-hosted font (no external
  font CDN at runtime)

**Admin panel** (`/admin`)
- Role-based accounts: **admin** (full access) and **editor** (drafts posts,
  sends them for approval)
- Post editor with an in-browser **cover/frame generator** (drag, zoom, export
  as a branded image) built on Canvas
- Posts, mission types, team roster, gallery and homepage pin management
- Inventory items, usage log and loaned-items tracking
- Service types and service logs, with member and usage reports
- Visitor messages inbox and site-wide settings (identity, phone numbers,
  texts, logo)

## Tech stack

| Layer    | Stack |
|----------|-------|
| Client   | React 18, Vite 6, React Router v6, plain CSS (design-token based, no framework) |
| Server   | Node.js, Express 5, `mssql` / `msnodesqlv8` (Windows auth support) |
| Database | Microsoft SQL Server |
| Auth     | httpOnly session cookie + CSRF header, bcrypt password hashing |

## Project structure

```
client/                React app (Vite)
  src/components/      shared UI (post cards, media gallery, share box, …)
  src/pages/           public pages
  src/pages/admin/      admin panel pages
  src/lib/cover.js      canvas drawing for the cover/frame generator
server/
  src/index.js         Express app entry point
  src/routes/          auth, public (visitor-facing), admin API routes
  src/db.js            SQL Server connection + query helper
  scripts/init-db.js   creates the database, seed data and first admin account
  uploads/              uploaded images (served statically)
database/
  schema.sql            full table schema, safe to run more than once
```

## Prerequisites

- Node.js 20 or newer
- Microsoft SQL Server (Express edition is fine) with:
  - **TCP/IP enabled** (SQL Server Configuration Manager → Protocols)
  - **SQL Server and Windows Authentication mode** (SSMS → server Properties → Security)
  - a SQL login that can create a database (for example `sa`), or your own
    Windows login for LocalDB

## Getting started

```bash
npm run setup
```

This installs the root, `server` and `client` dependencies and creates
`server/.env` from `server/.env.example` (with a fresh random `JWT_SECRET`).
Open `server/.env` and set `DB_USER` / `DB_PASSWORD` — or leave both empty to
connect with your own Windows login (e.g. with LocalDB:
`DB_SERVER=(localdb)\MSSQLLocalDB`).

```bash
npm run db:init
npm run dev
```

`db:init` creates the `RisalaSite` database, its tables, starter data and the
first admin account — **it prints the admin password once, so save it.**

- Website: http://localhost:5173
- Admin panel: http://localhost:5173/admin

## Available scripts

Run from the project root:

| Command           | What it does |
|--------------------|---------------|
| `npm run setup`   | Installs all three package trees and creates `server/.env` |
| `npm run db:init` | Creates the database, schema, seed data and first admin account |
| `npm run dev`     | Runs the API and the client dev server together (with hot reload) |
| `npm run build`   | Builds the production client bundle |
| `npm start`       | Starts the production server (serves the API and the built client) |

## Using the admin panel

1. **الإعدادات (Settings)** — set the three identity lines (the third is your
   centre/team name), phone numbers, texts and the logo. These feed both the
   website and the cover generator.
2. **مولّد الصور (Cover generator)** — upload a photo, choose "activity cover"
   or "simple frame", type the title, drag and zoom the photo, then download
   or attach it directly to a post.
3. **المنشورات (Posts)** — write a post, build its cover with the generator,
   add album photos/videos, optionally pin it (up to 3 pinned posts
   site-wide), then publish.
4. **الفريق (Team)**, **المستودع (Inventory)**, **سجلّات الخدمة (Service
   logs)** — manage the roster, equipment and activity logs that feed the
   reports.
5. **المستخدمون (Users)** — add editors. An editor can prepare posts and send
   them for approval; only an admin can publish, delete or change settings.

## Going live

```bash
npm run build
npm start
```

The Express server then serves the built website and the API together on the
`PORT` set in `server/.env`. Put it behind HTTPS before real use, and back up
both the SQL database and the `server/uploads` folder regularly.

## Security notes

- Admin sessions use an httpOnly, `SameSite=Strict` cookie plus a required
  `X-Requested-With` header on every mutating request (basic CSRF defense)
- Passwords are hashed with bcrypt; nothing is stored in plain text
- `server/.env` (database credentials, JWT secret) is git-ignored — never
  commit it

## License

Internal project for جمعية الرسالة للإسعاف الصحي. All rights reserved.
