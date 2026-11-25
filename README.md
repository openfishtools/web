<div align="center">

  <img src="https://raw.githubusercontent.com/openfishtools/.github/main/profile/assets/projects/web.svg" width="96" height="96" alt="Website" />

  # Website
  <sub>cutefish.my.id</sub>

  **Browser-based desktop interface for editing presets, the SlowTime video player, and media utilities.**

  [![Site: cutefish.my.id](https://img.shields.io/badge/site-cutefish.my.id-9DFF00.svg)](https://cutefish.my.id)
  [![Category: Web App](https://img.shields.io/badge/category-Web_App-blue.svg)](#)

</div>

[Bahasa Indonesia](#bahasa-indonesia) • [English](#english)

---

<a name="bahasa-indonesia"></a>
## Bahasa Indonesia

### Ringkasan
Repositori web utama untuk **[cutefish.my.id](https://cutefish.my.id)** yang dibangun menggunakan HTML, CSS, dan JavaScript murni (*vanilla*). Halaman utamanya menyediakan tampilan *desktop shell* di browser untuk mengakses galeri preset editing, pemutar video *SlowTime*, daftar proyek OpenFishTools, serta alat bantu media dan TikTok.

### Arsitektur & Fitur
- **Window Manager & Dock (`core/window-manager.js`, `core/dock.js`)**:
  - **Desktop (`>= 768px`)**: Window mengambang untuk 1 aplikasi, split kiri-kanan untuk 2 aplikasi (menyesuaikan rasio video saat membuka *SlowTime*), grid 3–4 aplikasi, dan zona samping untuk 5+ aplikasi.
  - **Mobile (`< 768px`)**: Tampilan *windowed* di atas dock bawah, split vertikal untuk 2 aplikasi, navigasi antar zona untuk 3+ aplikasi, dan mode *fullscreen + peek* untuk *SlowTime*.
- **Lazy Iframe Loading**: Setiap aplikasi di folder `apps/` baru dimuat ke dalam `<iframe>` setelah animasi pembuka selesai, lalu dilepas saat window ditutup.
- **Multi-Bahasa Otomatis (`core/i18n.js`)**: Mengikuti bahasa browser (`id` / `en`) dan mendukung parameter `?lang=id` atau `?lang=en`.
- **Sinkronisasi Preset (`functions/api/presets.js`)**: Endpoint `GET /api/presets` mengambil data preset langsung dari MongoDB dengan resolusi DoH SRV dan edge caching.
- **Cache FFmpeg WASM (`core/ffmpeg-client.js`)**: Mengunduh binary FFmpeg WASM dari CDN dan menyimpannya di `Cache Storage` browser agar tidak perlu disimpan di repositori.

### Daftar Aplikasi (`apps/`)

| Aplikasi | Deskripsi |
|---|---|
| **Preset** | Daftar preset After Effects, Alight Motion, dan OFTS dengan pratinjau di *SlowTime* dan pilihan file unduhan. |
| **Projects** | Daftar proyek open-source OpenFishTools (Website, Web Tools, FishTools CEP, FishTools Studio). |
| **SlowTime** | Pemutar video bergaya QuickTime dengan kontrol minimal dan ukuran window mengikuti rasio video. |
| **TikTok Enhancer** | Dua mode: **Direct** (FISH, FPS, MPEG-TS + kompresi 720p/1080p) dan **Extension Chrome** (*Fish Acceleration*, Quetta Browser, tutorial). |
| **TikTok Analytics** | Mengecek metadata, resolusi, FPS, dan detail video TikTok dengan cache perangkat. |
| **TikTok Downloader** | Mengunduh video HD dan audio dari tautan TikTok. |
| **Video Compressor** | Kompresi ukuran video H.264 / H.265 langsung di browser melalui FFmpeg WASM. |
| **Video Upscaler** | Upscale video AI (SPAN 4x + WebGPU shader). |
| **Interpolation** | Menggandakan FPS video (RIFE v4.7: 2x / 4x / 8x). |
| **Remove BG** | Menghapus atau mengganti latar foto dan video (transparan, blur, warna solid, green screen). |
| **MP4 to MP3** | Mengekstrak audio MP3 / M4A / WAV dari file video. |
| **Sequence to Vid** | Menggabungkan arsip ZIP urutan gambar menjadi video. |
| **Beatmark** | Konversi beat marker After Effects menjadi file XML Alight Motion. |
| **AM 5MB** | Mengganti media di file XML Alight Motion agar ukuran proyek tetap di bawah 5 MB. |

### Struktur Proyek

```text
├── apps/                      # Halaman aplikasi mandiri (14 aplikasi + _template)
├── assets/                    # Ikon SVG, inline icon map (icons-data.js), vendor, & file sumber ikon
├── core/                      # Skrip inti desktop shell, i18n, window manager, & FFmpeg loader
├── functions/
│   └── api/
│       └── presets.js         # Endpoint GET /api/presets (MongoDB)
├── styles/                    # Stylesheet modular CSS (tokens, base, desktop, dock, app-ui, custom/)
├── index.html                 # Landing page (cutefish.my.id)
├── home.html                  # Desktop shell
├── favicon.svg                # Favicon SVG
├── worker.js                  # Entrypoint Cloudflare Workers
├── wrangler.jsonc             # Konfigurasi Cloudflare & custom domain
├── _headers                   # Aturan Cache-Control
├── package.json               # Dependensi runtime backend (mongodb)
└── AGENTS.md                  # Panduan struktur & aturan styling proyek
```

### Pengembangan Lokal & Deployment

1. **Buat file `.env`** di root repositori (sudah masuk `.gitignore`):
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/test
   ```
2. **Pasang dependensi**:
   ```bash
   npm install
   ```
3. **Jalankan server lokal** dengan Wrangler:
   ```bash
   npx wrangler dev
   ```
4. **Deployment ke Cloudflare**:
   - Pengaturan domain dan aset mengikuti [`wrangler.jsonc`](wrangler.jsonc) serta [`worker.js`](worker.js).
   - Tambahkan `MONGODB_URI` di environment variable Cloudflare dan izinkan akses edge (`0.0.0.0/0`) di **MongoDB Atlas → Network Access**.

### Panduan Pengembangan
Aturan penulisan kode, komponen UI, dan penambahan aplikasi tersedia di [`AGENTS.md`](AGENTS.md).

---

<a name="english"></a>
## English

### Overview
Main website repository for **[cutefish.my.id](https://cutefish.my.id)**, built with plain HTML, CSS, and JavaScript. It provides a browser-based desktop shell housing editing preset galleries, the *SlowTime* video player, the OpenFishTools project directory, and client-side media and TikTok tools.

### Architecture & Features
- **Window Manager & Dock (`core/window-manager.js`, `core/dock.js`)**:
  - **Desktop (`>= 768px`)**: Centered floating window for 1 app, side-by-side split for 2 apps (adapts to video aspect ratio when paired with *SlowTime*), 3–4 app grid tiling, and side zones for 5+ apps.
  - **Mobile (`< 768px`)**: Windowed layout above the bottom dock, vertical 50/50 split for 2 apps, horizontal zone switching for 3+ apps, and *fullscreen + peek* mode for *SlowTime*.
- **Lazy Iframe Loading**: Apps inside `apps/` are mounted into iframes after the window opening animation settles and removed immediately when closed.
- **Automatic Localization (`core/i18n.js`)**: Follows the browser language (`id` / `en`) and supports `?lang=id` or `?lang=en` overrides.
- **Preset API (`functions/api/presets.js`)**: `GET /api/presets` fetches preset records directly from MongoDB using DoH SRV resolution and edge caching.
- **CDN-Cached FFmpeg WASM (`core/ffmpeg-client.js`)**: Fetches FFmpeg WASM binaries from CDN and stores them in browser `Cache Storage` instead of committing large binaries to the repository.

### Applications (`apps/`)

| Application | Description |
|---|---|
| **Preset** | After Effects, Alight Motion, and OFTS preset gallery with *SlowTime* previews and download variants. |
| **Projects** | Directory of OpenFishTools open-source projects (Website, Web Tools, FishTools CEP, FishTools Studio). |
| **SlowTime** | Minimal QuickTime-style video player with aspect-ratio-aware window sizing. |
| **TikTok Enhancer** | Two modes: **Direct** (FISH, FPS, MPEG-TS + 720p/1080p compression) and **Chrome Extension** (*Fish Acceleration*, Quetta Browser, guide). |
| **TikTok Analytics** | Inspects TikTok video metadata, resolution, FPS, and metrics with local caching. |
| **TikTok Downloader** | Downloads HD videos and audio from TikTok links. |
| **Video Compressor** | Client-side H.264 / H.265 video compression using FFmpeg WASM. |
| **Video Upscaler** | AI video upscaling (SPAN 4x + WebGPU shaders). |
| **Interpolation** | Video frame interpolation (RIFE v4.7: 2x / 4x / 8x). |
| **Remove BG** | Removes or replaces photo and video backgrounds (transparent, blur, solid, green screen). |
| **MP4 to MP3** | Extracts MP3 / M4A / WAV audio tracks from video files. |
| **Sequence to Vid** | Converts image sequence ZIP archives into video files. |
| **Beatmark** | Converts After Effects beat markers into Alight Motion XML files. |
| **AM 5MB** | Replaces heavy media inside Alight Motion XML projects to keep files under 5 MB. |

### Project Structure

```text
├── apps/                      # Standalone app pages (14 apps + _template)
├── assets/                    # SVG icons, inline icon map (icons-data.js), vendor libs, & icon source
├── core/                      # Desktop shell, i18n, window manager, & FFmpeg client scripts
├── functions/
│   └── api/
│       └── presets.js         # GET /api/presets endpoint (MongoDB)
├── styles/                    # Modular CSS stylesheets (tokens, base, desktop, dock, app-ui, custom/)
├── index.html                 # Landing page (cutefish.my.id)
├── home.html                  # Desktop shell
├── favicon.svg                # SVG favicon
├── worker.js                  # Cloudflare Workers entrypoint
├── wrangler.jsonc             # Cloudflare & custom domain configuration
├── _headers                   # Cache-Control rules
├── package.json               # Backend runtime dependencies (mongodb)
└── AGENTS.md                  # Architecture and UI styling guidelines
```

### Local Development & Deployment

1. **Create `.env`** in the repository root (listed in `.gitignore`):
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/test
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run locally** with Wrangler:
   ```bash
   npx wrangler dev
   ```
4. **Deploy to Cloudflare**:
   - Routing and static assets are configured via [`wrangler.jsonc`](wrangler.jsonc) and [`worker.js`](worker.js).
   - Set `MONGODB_URI` in Cloudflare environment variables and allow edge access (`0.0.0.0/0`) in **MongoDB Atlas → Network Access**.

### Development Guide
Architecture conventions, UI rules, and instructions for adding apps are documented in [`AGENTS.md`](AGENTS.md).
