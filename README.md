# جمعية الرسالة للإسعاف الصحي — Risala Health Ambulance Association

The public website and admin panel for **فرقة شهداء بئر حسن** (Shuhada Bir Hassan
team), operating out of **مركز الإمام علي الهادي (ع) التطوعي**. A full-stack,
Arabic-first (RTL) web app: a public site presenting the team's missions,
activities and news, and a role-based admin panel that runs the association's
day-to-day operations — field reports, inventory, the ambulance's finances,
community services, official paperwork and more — without touching code.

## Features

### Public site

- Home page with a mission-highlights board, activities, news and a
  horizontally-scrolling team roster
- Dedicated sections for missions, activities, news, gallery, team and
  about/contact
- Rich post detail pages: hero cover image, facts strip, response crew, a
  horizontally-scrolling photo/video gallery, related posts and social sharing
  (with dedicated WhatsApp/Facebook preview links via short `/s/:id` share URLs)
- Pinned posts (up to 3) surfaced across the site with a visible badge
- Fully right-to-left, Arabic layout with a self-hosted font (no external
  font CDN at runtime)

### Admin panel (`/admin`)

Role-based accounts: **admin** (full access to every page) and **editor**
(granted access page by page — an editor can prepare content and send it for
approval, but only an admin can publish, delete, or change settings and users).

**Content**
- Post editor with an in-browser **cover/frame generator** (drag, zoom, export
  as a branded image, built on Canvas) — no external design tool needed
- Posts, mission types, photo gallery, homepage pins and the team roster
- A visitor-messages inbox for the public contact form

**Field operations**
- Mission types, with monthly and yearly activity reports
- Per-paramedic (member) reports — missions and services attributed to each
  team member, with a full history view
- Medical service types and a service log (changing dressings, IV drips, blood
  pressure checks, etc.)
- A shift/duty roster scheduler

**Forms & minutes**
- The association's own official Word documents (membership requests, card
  renewal, meeting minutes, activity permits, equipment receipts, the
  ambulance vehicle form, the financial ledger) are fillable in the browser
  and downloaded as the *original* signed-ready `.docx` — never a redrawn
  lookalike. Forms without a Word source stay as plain PDF downloads to print
  and fill by hand

**Inventory**
- Medical stock items with categories and units of measure, a usage log, an
  "on loan" (عُهد) tracker for equipment lent out, and a stock report
- A separate fixed-assets register for durable, non-consumable equipment

**Ambulance**
- An income/expense ledger for the ambulance, with its own financial
  categories
- A maintenance/equipment register for the vehicle itself

**Community services**
- Blood-donation drive tracking
- In-kind community donations (medicine, baby supplies, etc.) with a
  per-type stock count and recipient log

**Administration**
- Site-wide settings: identity, contact details, hero text, logo and the
  donation link
- User management with a per-page permission picker for editors

## Tech stack

| Layer    | Stack |
|----------|-------|
| Client   | React 18, Vite 6, React Router v6, plain CSS (design-token based, no framework) |
| Server   | Node.js, Express 5 |
| Database | SQLite, via Node's built-in `node:sqlite` driver — a single file, no database server to install or run |
| Documents| `docxtemplater` / `pizzip`, filling the association's own `.docx` templates in place |
| Auth     | httpOnly session cookie + CSRF header, bcrypt password hashing |

## Project structure

```
client/                   React app (Vite)
  src/components/         shared UI (post cards, media gallery, share box, …)
  src/pages/               public pages
  src/pages/admin/          admin panel pages
  src/lib/cover.js          canvas drawing for the cover/frame generator
  public/forms/              downloadable PDF copies of the official forms
server/
  src/index.js             Express app entry point
  src/routes/               auth, public (visitor-facing), admin API routes
  src/db.js                 SQLite connection + query helper
  src/documentTemplates.js  the fillable-form registry (fields per template)
  src/docTemplates.js       fills a .docx template with submitted field values
  scripts/init-sqlite.js    creates the database, seed data and first admin account
  templates/                 the association's own .docx form templates
  uploads/                   uploaded images (served statically)
database/
  schema.sqlite.sql          full SQLite table schema, safe to run more than once
```

## Prerequisites

- Node.js 20 or newer

That's it — SQLite needs no separate server, service, or driver install.

## Getting started

```bash
npm run setup
```

This installs the root, `server` and `client` dependencies and creates
`server/.env` from `server/.env.example` (with a fresh random `JWT_SECRET`).

```bash
npm run db:init
npm run dev
```

`db:init` creates the SQLite database file, its tables, starter data and the
first admin account — **it prints the admin password once, so save it** (or
set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `server/.env` beforehand to choose
your own). Safe to run again: it never duplicates or overwrites existing data.

- Website: http://localhost:5173
- Admin panel: http://localhost:5173/admin

## Available scripts

Run from the project root:

| Command           | What it does |
|--------------------|---------------|
| `npm run setup`   | Installs all three package trees and creates `server/.env` |
| `npm run db:init` | Creates the SQLite database, schema, seed data and first admin account |
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
4. **الفريق (Team)**, **المستودع (Inventory)**, **سيارة الإسعاف (Ambulance)**,
   **الخدمات المجتمعية (Community services)** — manage the roster, equipment,
   finances and community-service logs that feed the reports.
5. **المحاضر والنماذج (Forms & minutes)** — pick a form, fill in the fields,
   and download the association's own Word document ready to print and sign.
6. **المستخدمون (Users)** — add editors and choose exactly which admin pages
   each one can reach. Only an admin can publish, delete, or change settings
   and users.

## Going live

```bash
npm run build
npm start
```

The Express server then serves the built website and the API together on the
`PORT` set in `server/.env`. Put it behind HTTPS before real use, and back up
both `server/data/risala.db` (the SQLite database) and the `server/uploads`
folder regularly — both are plain files, so a simple file copy is a complete
backup.

## Security notes

- Admin sessions use an httpOnly, `SameSite=Strict` cookie plus a required
  `X-Requested-With` header on every mutating request (basic CSRF defense)
- Passwords are hashed with bcrypt; nothing is stored in plain text
- `server/.env` (JWT secret, admin bootstrap credentials) and
  `server/data/risala.db` (the live database) are git-ignored — never commit
  them

## License

Internal project for جمعية الرسالة للإسعاف الصحي. All rights reserved.
