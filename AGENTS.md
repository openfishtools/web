# AGENTS.md - CHROS Project Guidelines

## Project Overview
CHROS (chros-web) adalah "The Ultimate Resource Hub for Video Editor" - aplikasi Material You (MD3) SPA yang menyediakan social links, video presets, downloadable resources, client-side video tools, dan admin dashboard.

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express 4.19
- **Database**: MongoDB (via Mongoose 8.3)
- **Auth**: Bearer token + MongoDB sessions
- **File Storage**: None (manual URL input)
- **Deployment**: Vercel (serverless)

### Frontend
- **Framework**: Vanilla JS (ES6+) - No framework
- **Styling**: CSS3 (Material You / MD3)
- **AI/ML**: ONNX Runtime Web (WebGPU) - Upscaling, Interpolation
- **Video Processing**: FFmpeg WASM (client-side)
- **PWA**: Minimal Service Worker

## Project Structure

```
editorstuff/
├── index.html              # Main SPA (5 tabs: Social, Preset, Resource, Tools, Contact)
├── admin.html              # Admin dashboard
├── api/
│   ├── index.js            # Express API server (all routes)
│   └── models/             # Mongoose schemas
│       ├── Admin.js
│       └── Session.js
├── scripts/                # Frontend JS modules
│   ├── app.js              # Main SPA logic
│   ├── admin.js            # Admin panel logic
│   ├── i18n.js             # Internationalization (ID/EN)
│   ├── ffmpeg-tool.js      # Video compressor
│   ├── tiktok-*.js         # TikTok tools
│   ├── upscale-tool.js     # AI upscaler
│   └── video-interpolation.js
├── styles/
│   ├── main.css            # Core design system + Greentea theme
│   ├── responsive.css      # Mobile-first breakpoints
│   └── admin.css           # Admin styles
├── assets/
│   ├── fonts/              # Self-hosted fonts
│   ├── icon/               # PNG icons
│   ├── svg/                # OS icons
│   ├── ffmpeg/             # FFmpeg WASM binaries
│   └── models/             # ONNX AI models
└── vercel.json             # Vercel deployment config
```

## Key Commands

```bash
npm start           # Run Express server (api/index.js)
npm run dev         # Run with nodemon for development
```

## Architecture

### Frontend (SPA with Hash Routing)
- Tab-based navigation: Bottom nav (mobile), Rail (tablet), Drawer (desktop)
- 5 main tabs: Social, Preset, Resource, Tools, Contact
- No build step - Raw JS/CSS/HTML loaded directly
- i18n: Indonesian (id) + English (en), auto-detected
- Theme: "Greentea" - green tonal Material You palette, dark mode

### Backend (Serverless-First)
- Single file API: All routes in `api/index.js`
- Cached DB connection across serverless invocations
- Admin auth: Bearer token in MongoDB sessions (8hr expiry)
- TikTok proxy with 4hr caching

### Client-Side Tools
Semua tools berjalan di browser (tidak ada server processing):
1. TikTok Quality Patcher V3 (Pure JS Binary MP4 patcher with 10-byte filler NAL units, adaptive video chunking, and edts cleanup)
2. Video Compressor (FFmpeg WASM)
3. Audio Extractor (FFmpeg WASM)
4. Image Sequence to Video (JSZip + FFmpeg)
5. 5MB XML Generator (Alight Motion)
6. AE to AM Beatmark Converter
7. AI Upscaler (RealESRGAN via ONNX + WebGPU)
8. Video Interpolation (RIFE v4.7 via ONNX + WebGPU)

## Data Models

| Model | Purpose |
|-------|---------|
| Admin | Credentials (username + bcrypt hash) |
| Session | Auth tokens with expiry (TTL index) |
| Social | Social media links |
| Contact | Contact/support links |
| Preset | Video presets with download URLs |
| Resource | Downloadable software/plugins |
| Like | Preset likes by IP |
| TikTokCache | TikTok resolution cache (4hr TTL) |

## API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/get-ip` | No | Client IP detection |
| GET | `/api/version` | No | App version & Vercel build date (`buildDateId`, `buildDateEn`, `buildDateIso`) |
| GET | `/api/tiktok-fps` | No | TikTok video FPS/metadata |
| GET | `/api/tiktok-resolve` | No | TikTok URL resolution |
| GET | `/api/proxy` | No | Generic HTTP proxy |
| POST | `/api/admin/login` | No | Admin authentication |
| GET | `/api/admin/session` | Yes | Session validation |
| POST | `/api/admin/logout` | Yes | Session destruction |
| CRUD | `/api/socials[/:id]` | GET: No / Others: Yes | Social links |
| CRUD | `/api/contacts[/:id]` | GET: No / Others: Yes | Contact links |
| CRUD | `/api/presets[/:id]` | GET: No / Others: Yes | Presets |
| POST | `/api/presets/:id/like` | No | Toggle like (IP-based) |
| CRUD | `/api/resources[/:id]` | GET: No / Others: Yes | Resources |

## Design System Rules

### Material You (MD3)
- Theme: **Greentea** (Green-based tonal palettes)
- Use dynamic color tokens based on HSL variables
- 8dp grid system for spacing
- Rounded corners: Medium (12px), Large (16px), Extra Large (28px)
- Smooth transitions (250ms) using cubic-bezier(0.2, 0, 0, 1)

### Responsive Breakpoints
- **Mobile (< 600px)**: Bottom navigation, full-screen content
- **Tablet (600px - 1024px)**: Left Navigation Rail (80px, icon-only)
- **Desktop (> 1024px)**: Left Navigation Drawer (280px, full-width pills)
- No top app bar or brand logo in main activity

## Coding Rules

### HTML
- Use semantic HTML5 elements
- **Zero-Inline Purity**: No inline CSS (`style="..."`) or inline JS (event handlers)
- All styling/scripts must be in separate files

### CSS/JS
- Never combine CSS and JS into one file
- Do not add comments inside code files
- Preserve responsiveness and "greentea" theme consistency
- Maintain "CHROS" branding throughout

### General
- Proactively audit logic before implementing changes
- Ensure proper error handling for new features
- Check cross-file integrity when modifying HTML/CSS/JS
- Verify syntax and structure before saving files

## Environment Variables

```
MONGODB_URI          # MongoDB connection string
```

## Deployment

### Vercel
- Static files served from root
- API routes → `api/index.js` (serverless function)
- `vercel.json` configures rewrites and COOP/COEP headers

### Development
- `run.bat` / `run.sh`: npm start + Cloudflare Tunnel
- `server.py`: Fallback static server (no API)

## Codebase Size (approx)

| Category | Files | Lines |
|----------|-------|-------|
| Backend JS | 3 | ~709 |
| Frontend JS | 14 | ~9,547 |
| CSS | 3 | ~4,624 |
| HTML | 2 | ~2,464 |
| **Total** | **29** | **~17,747** |

## Agent Guidelines

1. **Proactive Logic Audits**: Analyze logic before implementing. Fix flaws proactively.
2. **Robustness First**: Ensure error handling and no conflicts with existing features.
3. **Cross-File Integrity**: When modifying HTML, verify CSS/JS consistency.
4. **Bug Prevention**: Prioritize fixing bugs over following instructions blindly.
5. **Syntax Vigilance**: Always verify syntax before saving files.
6. **Zero-Inline**: Absolutely no inline CSS or JS in HTML files.
7. **Proactive Cleanup**: Delete unused CSS classes when features are removed.
8. **Tool & App Versioning**: Selalu update nomor versi badge tool terkait (`.tool-ver-badge` di `index.html`) dan update versi cache aplikasi (`APP_VERSION` di `sw.js`) setiap kali melakukan perubahan, perbaikan, atau update fitur pada suatu tool.
