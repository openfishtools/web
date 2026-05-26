# CLAUDE.md

Guidance for Claude Code when working with code here.

## Project Overview

CHROS — Material You (MD3) app: social links, video presets, downloads, tools, admin chat.

## Commands

```bash
npm start       # Run Express server (api/index.js)
npm run dev     # Run with nodemon for development
```

## Architecture

### Backend (Node.js/Express)

- **API Server**: [api/index.js](api/index.js) — Express + MongoDB
- **Database Models**: [api/models/](api/models/) — Mongoose schemas (Admin, Session)
- **Serverless-First**: Cached DB connection for Vercel/serverless

**Key patterns:**
- Admin routes use `requireAdmin` middleware (JWT Bearer)
- Sessions in MongoDB (not memory) for serverless
- Uploads via Supabase Storage (`/api/upload`)
- TikTok resolution via upstream APIs, 1hr local cache

### Frontend

- **Main App**: [index.html](index.html) — SPA, tabs (Social, Preset, Resource, Tools, Chat)
- **Admin Panel**: [admin.html](admin.html) — separate dashboard
- **Scripts**: [scripts/app.js](scripts/app.js) — UI logic, chat
- **FFmpeg Tool**: [scripts/ffmpeg-tool.js](scripts/ffmpeg-tool.js) — WASM video compression
- **TikTok Stats**: [scripts/tiktok-stats-tool.js](scripts/tiktok-stats-tool.js) — metadata extraction

### Design System

- **Greentea Theme**: Green tonal palettes in [styles/main.css](styles/main.css)
- **Responsive**: Mobile-first, breakpoints at 600px (Rail), 1024px (Drawer) — [styles/responsive.css](styles/responsive.css)
- **Admin Styles**: [styles/admin.css](styles/admin.css)

### Storage & Services

- **MongoDB**: Primary DB (Mongoose: Chat, Messages, Presets, Resources, Socials, Likes)
- **Supabase**: File storage via bucket
- **Web Push**: Admin notifications via VAPID keys

## Environment Variables

```
MONGODB_URI          # MongoDB connection string
SUPABASE_URL         # Supabase project URL
SUPABASE_KEY         # Supabase API key
SUPABASE_BUCKET      # Storage bucket name
VAPID_PUBLIC_KEY     # Web push public key
VAPID_PRIVATE_KEY   # Web push private key
```

## Data Models

| Model | Purpose |
|-------|---------|
| `Admin` | Credentials (username + bcrypt hash) |
| `Session` | Auth tokens with expiry |
| `Chat` | User chat sessions (IP-linked) |
| `Message` | Chat messages |
| `Preset` | Video presets (AE, CapCut, etc.) with download URLs |
| `Resource` | Downloads with version info |
| `Social` | Socials media links |
| `Like` | Preset likes by IP |

## Design Rules

- Material You (MD3)
- Greentea theme: Green tonal palettes
- 8dp grid, 12px/16px/28px corner radius
- No inline CSS/JS in HTML
- No comments in code
- CSS/JS in separate files from HTML