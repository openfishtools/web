# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CHROS is a Material You (MD3) web application providing social links, video presets, downloadable resources, tools, and admin chat functionality.

## Commands

```bash
npm start       # Run Express server (api/index.js)
npm run dev     # Run with nodemon for development
```

## Architecture

### Backend (Node.js/Express)

- **API Server**: [api/index.js](api/index.js) - Express app with MongoDB integration
- **Database Models**: [api/models/](api/models/) - Mongoose schemas (Admin, Session)
- **Serverless-First**: Uses cached DB connection pattern for Vercel/serverless environments

**Key API patterns:**
- Admin routes protected by `requireAdmin` middleware (JWT Bearer token)
- Sessions stored in MongoDB (not memory) for serverless compatibility
- File uploads via Supabase Storage (`/api/upload`)
- TikTok resolution uses upstream APIs with local caching (1hr TTL)

### Frontend

- **Main App**: [index.html](index.html) - Single-page with tabbed sections (Social, Preset, Resource, Tools, Chat)
- **Admin Panel**: [admin.html](admin.html) - Separate admin dashboard
- **Scripts**: [scripts/app.js](scripts/app.js) - Main UI logic, chat functionality
- **FFmpeg Tool**: [scripts/ffmpeg-tool.js](scripts/ffmpeg-tool.js) - Client-side video compression using WASM
- **TikTok Stats**: [scripts/tiktok-stats-tool.js](scripts/tiktok-stats-tool.js) - Video metadata extraction

### Design System

- **Greentea Theme**: Green-based tonal palettes defined in [styles/main.css](styles/main.css)
- **Responsive Layouts**: Mobile-first with breakpoints at 600px (Rail) and 1024px (Drawer) in [styles/responsive.css](styles/responsive.css)
- **Admin Styles**: [styles/admin.css](styles/admin.css) - Separate admin panel styling

### Storage & Services

- **MongoDB**: Primary database (Mongoose models for Chat, Messages, Presets, Resources, Socials)
- **Supabase**: File storage via bucket, configured via environment variables
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

## Key Data Models

| Model | Purpose |
|-------|---------|
| `Admin` | Admin credentials (username + bcrypt hash) |
| `Session` | Auth tokens with expiry for admin sessions |
| `Chat` | User chat sessions (linked by IP) |
| `Message` | Chat messages within a chat |
| `Preset` | Video presets (AE, CapCut, etc.) with download URLs |
| `Resource` | Downloadable software resources with version info |
| `Social` | Social media link items |
| `Like` | Preset like tracking by IP |

## Design Rules

- Material You (MD3) design language
- Greentea theme: Green-based tonal palettes
- 8dp grid system, 12px/16px/28px corner radius
- No inline CSS or JS in HTML files
- No comments in code files
- CSS/JS in separate files from HTML