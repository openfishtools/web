<div align="center">

  <img src="https://raw.githubusercontent.com/openfishtools/.github/main/profile/assets/projects/web.svg" width="96" height="96" alt="Website" />

  # Website
  <sub>cutefish.my.id</sub>

  **Material 3 Matcha Tonal Web Desktop OS with preset galleries, SlowTime player, and client-side multimedia tools.**

  [![Site: cutefish.my.id](https://img.shields.io/badge/site-cutefish.my.id-9cb477.svg)](https://cutefish.my.id)
  [![Category: Web App](https://img.shields.io/badge/category-Web_App-blue.svg)](#)
  [![Architecture: Vanilla Web](https://img.shields.io/badge/architecture-Vanilla_HTML%2FCSS%2FJS-lightgrey.svg)](#)

</div>

[Bahasa Indonesia](#bahasa-indonesia) • [English](#english)

---

<a name="bahasa-indonesia"></a>
## Bahasa Indonesia

### Ringkasan
Website utama ekosistem OpenFishTools (**[cutefish.my.id](https://cutefish.my.id)**) yang menghadirkan **Web Desktop OS** berbasis **Vanilla HTML, CSS, dan JavaScript** tanpa framework frontend atau *build step* berat. Mengusung sistem desain **Material 3 Matcha Tonal**, platform ini menggabungkan galeri preset editing, pemutar video *SlowTime*, etalase proyek OpenFishTools, serta berbagai utilitas media dan TikTok langsung di peramban.

### Arsitektur & Fitur Utama
- **Web Desktop OS & Multi-Window Stage Manager**:
  - **Desktop (`>= 768px`)**: Window mengambang untuk 1 aplikasi, split kiri-kanan untuk 2 aplikasi (otomatis menyesuaikan rasio video saat dipasangkan dengan *SlowTime*), tiling 3–4 aplikasi, serta multi-zone chaining ke samping untuk 5+ aplikasi.
  - **Mobile (`< 768px`)**: Tata letak *windowed* membulat di atas dock yang selalu tampil, split vertikal untuk 2 aplikasi, navigasi antar zona untuk 3+ aplikasi, serta mode *fullscreen + peek* khusus saat membuka *SlowTime*.
- **Design System Material 3 Matcha Tonal (`styles/`)**: Seluruh aplikasi berbagi token warna dan komponen standar (`styles/tokens.css`, `styles/app-ui.css`) tanpa border/outline pada tombol serta tanpa kontrol bawaan browser.
- **Lazy Iframe Embedding**: Aplikasi di dalam folder `apps/` baru dimuat ke dalam `<iframe>` setelah animasi pembuka stabil dan langsung dilepas saat window ditutup agar memori tetap ringan.
- **Multi-Language Otomatis (`core/i18n.js`)**: Bahasa antarmuka (`id` / `en`) menyesuaikan bahasa browser pengguna secara otomatis (mendukung parameter `?lang=id` atau `?lang=en`).
- **Live Preset Sync (`functions/api/presets.js`)**: Endpoint `GET /api/presets` terhubung langsung ke MongoDB dengan resolusi DoH SRV, edge caching, dan normalisasi HTTPS.
- **CDN-Cached FFmpeg WASM (`core/ffmpeg-client.js`)**: Binary FFmpeg WASM dimuat dari CDN dan disimpan di `Cache Storage` browser sehingga repositori tetap ringan di bawah batas aset Cloudflare.

### Daftar Aplikasi (`apps/`)

| Aplikasi | Deskripsi |
|---|---|
| **Preset** | Galeri preset After Effects, Alight Motion, dan OFTS dengan thumbnail TikTok, pratinjau langsung di *SlowTime*, serta laci varian unduhan. |
| **Projects** | Direktori proyek dan ekosistem *open-source* OpenFishTools (Website, Web Tools, FishTools CEP, FishTools Studio). |
| **SlowTime** | Pemutar video *immersive* bergaya QuickTime dengan kontrol melayang minimalis dan ukuran window mengikuti aspek rasio video. |
| **TikTok Enhancer** | Dua mode: **Direct** (FISH, FPS, MPEG-TS + kompresi 720p/1080p) dan **Extension Chrome** (*Fish Acceleration*, Quetta Browser, tutorial). |
| **TikTok Analytics** | Inspeksi metadata, resolusi, FPS, dan metrik video TikTok dengan cache perangkat. |
| **TikTok Downloader** | Unduh video HD maupun audio dari tautan TikTok. |
| **Video Compressor** | Kompresi ukuran video H.264 / H.265 langsung di peramban via FFmpeg WASM. |
| **Video Upscaler** | Peningkatan resolusi dan ketajaman video AI (SPAN 4x + WebGPU shader). |
| **Interpolation** | Penggandaan FPS video AI (RIFE v4.7: 2x / 4x / 8x). |
| **Remove BG** | Hapus atau ganti latar belakang foto dan video (transparan, blur, solid, green screen). |
| **MP4 to MP3** | Ekstrak trek audio MP3 / M4A / WAV dari file video. |
| **Sequence to Vid** | Gabungkan arsip ZIP urutan gambar menjadi video. |
| **Beatmark** | Konversi beat marker After Effects menjadi proyek XML Alight Motion. |
| **AM 5MB** | Ganti media di dalam proyek XML Alight Motion agar tetap ringan di bawah 5 MB. |

### Struktur Direktori Proyek

```text
├── apps/                      # Modul aplikasi mandiri (14 aplikasi + _template)
├── assets/                    # Ikon SVG, inline icon map (icons-data.js), vendor, & sumber desain
├── core/                      # Engine inti Desktop OS & utilitas halaman
│   ├── i18n.js                # Engine multi-bahasa otomatis (id / en)
│   ├── registry.js            # Single Source of Truth daftar aplikasi & folder dock
│   ├── window-manager.js      # Multi-window tiling, aspect-ratio, & mobile peek
│   ├── dock.js                # Flexible Dock
│   ├── folder-modal.js        # Modal folder bergaya iPadOS
│   ├── desktop.js             # Bootstrap home.html & jam Indonesia
│   ├── landing.js             # Logika & laci halaman index.html
│   ├── app-utils.js           # Utilitas UI seragam antar aplikasi
│   ├── tutorial.js            # Sistem tutorial interaktif
│   └── ffmpeg-client.js       # Loader FFmpeg WASM berbasis CDN + Cache Storage
├── functions/
│   └── api/
│       └── presets.js         # Cloudflare Pages Function: GET /api/presets
├── styles/                    # Stylesheet modular Material 3 (tokens, base, desktop, dock, app-ui, custom/)
├── index.html                 # Landing page (cutefish.my.id)
├── home.html                  # Web Desktop OS shell
├── favicon.svg                # Ikon situs SVG
├── worker.js                  # Entrypoint Cloudflare Workers & static asset handler
├── wrangler.jsonc             # Konfigurasi Cloudflare (custom domain & nodejs_compat)
├── _headers                   # Aturan Cache-Control Cloudflare
├── package.json               # Dependensi runtime backend (mongodb)
└── AGENTS.md                  # Panduan arsitektur, desain, & konvensi pengembangan
```

### Pengembangan Lokal & Deployment (Cloudflare)

1. **Siapkan variabel lingkungan** dengan membuat file `.env` di root repositori (sudah diabaikan oleh `.gitignore`):
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/test
   ```
2. **Pasang dependensi** untuk fungsi backend:
   ```bash
   npm install
   ```
3. **Jalankan pratinjau lokal** menggunakan Wrangler:
   ```bash
   npx wrangler dev
   ```
   *(Atau `npx wrangler pages dev .` bila menjalankan mode Pages).*
4. **Deployment ke Cloudflare**:
   - Konfigurasi domain dan aset statis mengikuti [`wrangler.jsonc`](wrangler.jsonc) dan [`worker.js`](worker.js).
   - Tambahkan secret/environment variable `MONGODB_URI` di dashboard Cloudflare, lalu pastikan **MongoDB Atlas → Network Access** mengizinkan koneksi dari edge Cloudflare (`0.0.0.0/0`).

### Panduan untuk AI Agent
Developer maupun AI coding agent wajib membaca dan mematuhi [`AGENTS.md`](AGENTS.md) terkait filosofi *zero bloat*, aturan Material 3 Matcha Tonal, konvensi Window Manager, dan standar verifikasi.

---

<a name="english"></a>
## English

### Overview
The flagship web portal of the OpenFishTools ecosystem (**[cutefish.my.id](https://cutefish.my.id)**), implemented as a lightweight **Web Desktop OS** using pure **Vanilla HTML, CSS, and JavaScript** with zero frontend frameworks or heavy build pipelines. Built on a unified **Material 3 Matcha Tonal** design system, it integrates editing preset galleries, the *SlowTime* video player, the OpenFishTools project showcase, and browser-based media & TikTok utilities.

### Key Architecture & Features
- **Web Desktop OS & Multi-Window Stage Manager**:
  - **Desktop (`>= 768px`)**: Centered floating window for 1 app, side-by-side split for 2 apps (automatically adapts to video aspect ratio when paired with *SlowTime*), 3–4 app tiling grids, and infinite horizontal multi-zone chaining for 5+ apps.
  - **Mobile (`< 768px`)**: Rounded windowed viewport above a persistent bottom dock, vertical 50/50 split for 2 apps, horizontal zone switching for 3+ apps, and a dedicated *fullscreen + peek* mode for *SlowTime*.
- **Unified Material 3 Matcha Tonal Design (`styles/`)**: All embedded apps share centralized design tokens and components (`styles/tokens.css`, `styles/app-ui.css`) with borderless tonal buttons and fully styled custom controls.
- **Lazy Iframe Embedding**: Individual apps under `apps/` are mounted into iframes only after initial window opening animation settles and are removed immediately on close to keep memory overhead minimal.
- **Automatic Multi-Language (`core/i18n.js`)**: Automatically detects the user's browser language (`id` / `en`) and supports explicit `?lang=id` or `?lang=en` overrides.
- **Live Preset Sync (`functions/api/presets.js`)**: Serves `GET /api/presets` directly from MongoDB with DoH SRV resolution, edge caching, and HTTPS normalization.
- **CDN-Cached FFmpeg WASM (`core/ffmpeg-client.js`)**: Loads FFmpeg WASM binaries on demand from CDN and caches them in browser `Cache Storage`, keeping the repository lightweight and within Cloudflare asset limits.

### Applications Catalog (`apps/`)

| Application | Description |
|---|---|
| **Preset** | Curated gallery of After Effects, Alight Motion, and OFTS presets with TikTok thumbnails, direct *SlowTime* previews, and variant download drawers. |
| **Projects** | Directory showcasing OpenFishTools open-source projects (Website, Web Tools, FishTools CEP, FishTools Studio). |
| **SlowTime** | Immersive QuickTime-style video player featuring minimal floating controls and aspect-ratio-aware window sizing. |
| **TikTok Enhancer** | Two modes: **Direct** (FISH, FPS, MPEG-TS + 720p/1080p compression) and **Chrome Extension** (*Fish Acceleration*, Quetta Browser, tutorials). |
| **TikTok Analytics** | Inspects TikTok video metadata, resolution, FPS, and metrics with local device caching. |
| **TikTok Downloader** | Downloads watermark-free HD videos or extracted audio from TikTok links. |
| **Video Compressor** | Client-side H.264 / H.265 video compression powered by FFmpeg WASM. |
| **Video Upscaler** | AI video upscaling and sharpening (SPAN 4x + WebGPU shaders). |
| **Interpolation** | AI frame-rate multiplication for smoother motion (RIFE v4.7: 2x / 4x / 8x). |
| **Remove BG** | Removes or replaces image and video backgrounds (transparent, blur, solid color, green screen). |
| **MP4 to MP3** | Extracts MP3 / M4A / WAV audio tracks from video files. |
| **Sequence to Vid** | Compiles ZIP archives of image sequences into video files. |
| **Beatmark** | Converts After Effects beat markers into Alight Motion XML project files. |
| **AM 5MB** | Replaces heavy media references inside Alight Motion XML projects to stay under 5 MB. |

### Project Structure

```text
├── apps/                      # Standalone app modules (14 apps + _template)
├── assets/                    # SVG icons, inline icon map (icons-data.js), vendor libs, & icon sources
├── core/                      # Core Desktop OS engine & page scripts
│   ├── i18n.js                # Automatic multi-language engine (id / en)
│   ├── registry.js            # Single Source of Truth for apps & dock folders
│   ├── window-manager.js      # Multi-window tiling, aspect-ratio, & mobile peek
│   ├── dock.js                # Flexible Dock
│   ├── folder-modal.js        # iPadOS-style folder modal
│   ├── desktop.js             # home.html bootstrapper & Indonesia clock
│   ├── landing.js             # index.html animations & drawers
│   ├── app-utils.js           # Shared UI utilities across apps
│   ├── tutorial.js            # Interactive tutorial controller
│   └── ffmpeg-client.js       # CDN + Cache Storage FFmpeg WASM loader
├── functions/
│   └── api/
│       └── presets.js         # Cloudflare Pages Function: GET /api/presets
├── styles/                    # Modular Material 3 stylesheets (tokens, base, desktop, dock, app-ui, custom/)
├── index.html                 # Landing page (cutefish.my.id)
├── home.html                  # Web Desktop OS shell
├── favicon.svg                # Site SVG favicon
├── worker.js                  # Cloudflare Workers & static asset entrypoint
├── wrangler.jsonc             # Cloudflare configuration (custom domains & nodejs_compat)
├── _headers                   # Cloudflare Cache-Control rules
├── package.json               # Backend runtime dependencies (mongodb)
└── AGENTS.md                  # Architecture rules, design tokens, & conventions
```

### Local Development & Deployment (Cloudflare)

1. **Configure environment variables** by creating a `.env` file in the repository root (excluded via `.gitignore`):
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/test
   ```
2. **Install runtime dependencies**:
   ```bash
   npm install
   ```
3. **Run locally** using Wrangler:
   ```bash
   npx wrangler dev
   ```
   *(Or `npx wrangler pages dev .` for Pages Functions emulation).*
4. **Deploy to Cloudflare**:
   - Routing and static asset binding are configured in [`wrangler.jsonc`](wrangler.jsonc) and [`worker.js`](worker.js).
   - Set `MONGODB_URI` in Cloudflare environment variables/secrets and ensure **MongoDB Atlas → Network Access** permits Cloudflare edge connections (`0.0.0.0/0`).

### AI Agent Guidance
Contributors and autonomous coding agents should read and follow [`AGENTS.md`](AGENTS.md) for zero-bloat principles, Material 3 Matcha Tonal design rules, Window Manager behavior, and verification steps.
