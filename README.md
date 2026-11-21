# cutefish.my.id (`cutefishaep`)

Web Desktop OS ringan berbasis **Vanilla HTML, CSS, dan JavaScript** dengan desain **Material 3 Matcha Tonal** — menggabungkan galeri preset editing, pemutar video *SlowTime*, serta koleksi multimedia & TikTok tools yang berjalan langsung di browser.

---

## Fitur Utama

- **Web Desktop OS & Multi-Window Stage Manager**
  - Desktop (`>= 768px`): floating window untuk 1 app, split side-by-side 2 app (dengan auto-fit *aspect ratio* video khusus SlowTime), tiling 3–4 app, dan multi-zone chaining tak terbatas untuk 5+ app.
  - Mobile (`< 768px`): rounded windowed di atas dock, split vertikal 2 app, multi-zone chaining untuk 3+ app, serta mode presentasi *fullscreen + peek* khusus saat membuka SlowTime.
- **Multi-Language Otomatis (`id` / `en`)**
  - [`core/i18n.js`](core/i18n.js) mendeteksi bahasa browser pengguna secara otomatis (mendukung override `?lang=en` / `?lang=id`).
- **Live Preset Sync via Cloudflare Pages Functions**
  - [`functions/api/presets.js`](functions/api/presets.js) menyajikan `GET /api/presets` langsung dari MongoDB (`test.presets`) dengan resolusi DoH SRV, edge caching, dan normalisasi HTTPS.
- **Zero-Bloat & CDN-Cached FFmpeg WASM**
  - [`core/ffmpeg-client.js`](core/ffmpeg-client.js) mengunduh binary FFmpeg WASM dari CDN dan menyimpannya di browser `Cache Storage` agar repo tetap di bawah batas 25 MiB Cloudflare Pages.

---

## Daftar Aplikasi (`apps/`)

| Aplikasi | Deskripsi |
| --- | --- |
| **Preset** | Galeri preset After Effects, Alight Motion, dan OFTS dengan thumbnail TikTok, preview langsung di SlowTime, serta pop-up/drawer varian download. |
| **SlowTime** | Pemutar video *immersive* bergaya QuickTime dengan kontrol melayang minimalis dan ukuran window mengikuti aspek rasio video. |
| **TikTok Enhancer** | Dua mode: **Direct** (FISH, FPS, MPEG-TS + kompresi 720p/1080p) dan **Extension Chrome** (*Fish Acceleration*, Quetta Browser, tutorial). |
| **TikTok Analytics** | Inspeksi metadata, resolusi, FPS, dan metrik video TikTok dengan cache perangkat. |
| **TikTok Downloader** | Unduh video HD maupun audio dari tautan TikTok. |
| **Video Compressor** | Kompresi video H.264 / H.265 langsung di browser via FFmpeg WASM. |
| **Video Upscaler** | Upscale video AI (SPAN 4x + WebGPU shader). |
| **Interpolation** | Penggandaan FPS video AI (RIFE v4.7: 2x / 4x / 8x). |
| **Remove BG** | Hapus atau ganti latar foto & video (transparan, blur, solid, green screen). |
| **MP4 to MP3** | Ekstrak audio MP3 / M4A / WAV dari file video. |
| **Sequence to Vid** | Gabungkan arsip ZIP urutan gambar menjadi video. |
| **Beatmark** | Konversi beat marker After Effects ke proyek XML Alight Motion. |
| **AM 5MB** | Ganti media proyek XML Alight Motion agar ringan di bawah 5 MB. |

---

## Struktur Proyek

```text
.
├── index.html                 # Landing page (cutefish.my.id)
├── home.html                  # Web Desktop OS shell
├── favicon.svg                # Ikon situs SVG manual
├── _headers                   # Aturan Cache-Control Cloudflare Pages
├── wrangler.toml              # Konfigurasi Cloudflare Pages & nodejs_compat
├── package.json               # Dependency runtime Functions (mongodb)
├── AGENTS.md                  # Panduan arsitektur & aturan pengembangan
├── functions/
│   └── api/
│       └── presets.js         # Cloudflare Pages Function: GET /api/presets
├── core/
│   ├── i18n.js                # Multi-language engine (auto id / en)
│   ├── registry.js            # Daftar aplikasi & folder dock
│   ├── window-manager.js      # Multi-window tiling, aspect-ratio, & mobile peek
│   ├── dock.js                # Flexible Dock
│   ├── folder-modal.js        # Modal folder bergaya iPadOS
│   ├── desktop.js             # Bootstrap home.html & jam Indonesia
│   ├── landing.js             # Animasi & drawer index.html
│   ├── app-utils.js           # Helper UI seragam (slider, dropzone, logger)
│   └── ffmpeg-client.js       # Loader FFmpeg WASM berbasis CDN + Cache API
├── styles/
│   ├── tokens.css             # Material 3 Matcha Tonal tokens
│   ├── base.css               # Reset global & scrollbar suppression
│   ├── landing.css            # Style index.html
│   ├── desktop.css            # Style desktop shell & jam
│   ├── dock.css               # Style dock
│   ├── folder-modal.css       # Style modal folder
│   ├── window-manager.css     # Style multi-window & SlowTime immersive bar
│   ├── app-ui.css             # Design system wajib semua aplikasi
│   └── custom/                # Override opsional per aplikasi
├── apps/                      # Modul aplikasi mandiri (13 app + _template)
└── assets/                    # Ikon SVG, inline icon map, & vendor ringan
```

---

## Deploy ke Cloudflare Pages

1. Hubungkan repositori ke **Cloudflare Pages**:
   - **Build command:** *(kosongkan)*
   - **Build output directory:** `.`
2. Tambahkan Environment Variable di **Settings → Environment Variables**:
   - `MONGODB_URI` = connection string MongoDB Atlas Anda (mendukung `mongodb+srv://` maupun `mongodb://`).
3. Pastikan **MongoDB Atlas → Network Access** mengizinkan koneksi dari edge Cloudflare (`0.0.0.0/0`).

---

## Pengembangan Lokal

Buat file `.env` di root (sudah masuk `.gitignore`):

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/test
```

Install dependency Functions lalu jalankan server dev lokal (jika tersedia di `tools/dev-server.mjs`) atau `npx wrangler pages dev .`.
