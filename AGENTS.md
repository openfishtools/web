# AGENTS.md — Panduan Proyek Web Desktop OS (`cutefish.my.id` / `cutefishaep`)

Dokumen ini adalah panduan resmi arsitektur, aturan desain, dan standar pengerjaan untuk AI coding agent maupun developer yang berkontribusi pada repositori ini.

---

## 1. Filosofi Utama (Wajib Dipatuhi)
1. **Ringan & Cepat (Zero Bloat):**
   - Gunakan pure **Vanilla HTML, CSS, dan JavaScript**. Jangan tambahkan framework frontend berat (React, Vue, Tailwind, Bootstrap, dll.) atau *build step* frontend tanpa persetujuan eksplisit.
   - Hindari efek mahal seperti `backdrop-filter: blur()`, animasi `border-radius` / `clip-path` di atas live `<iframe>`, atau shadow berlapis yang menurunkan FPS.
   - Semua aplikasi di-embed secara *lazy* (iframe baru dipasang setelah frame awal animasi buka stabil, dan langsung di-remove saat window ditutup tanpa menambah riwayat navigasi browser).
   - Binary berat seperti FFmpeg WASM (`> 25 MiB`) **tidak boleh** di-commit ke repo — muat dari CDN dan cache di browser `Cache Storage` melalui `core/ffmpeg-client.js`.
2. **Presisi (Pixel-Accurate):**
   - Tidak boleh ada elemen yang bocor melewati `border-radius` window, scrollbar liar, atau layout shift.
   - **DILARANG** membuat `<header>` atau judul aplikasi di dalam HTML aplikasi (`apps/*/index.html`), karena nama aplikasi sudah ditampilkan secara resmi di *Multitask Pill* milik OS Window Manager.
3. **100% Seragam (Unified Design System):**
   - Semua aplikasi **wajib** memakai desain Material 3 Matcha Tonal yang sama melalui `styles/tokens.css` dan `styles/app-ui.css`.
   - **Tanpa Border/Outline pada Tombol:** Semua tombol wajib murni tonal (`border: none; outline: none; text-decoration: none;`) mengandalkan kontras warna `surface` / `primary` — **jangan** menambahkan `border` atau `outline` garis luar pada tombol baru.
   - **Zero Kontrol Bawaan Browser (Full Material 3):** Semua kontrol interaktif — slider (`.m3-slider` + `AppUtils.syncSlider`), switch (`.m3-switch`), checkbox (`.m3-checkbox`/`.app-checkbox`), dropdown (`.app-select`), spinner loading (`.m3-spinner`), progress bar (`.app-progress`), input angka, dan color picker — **wajib** memakai styling Material 3 dari `styles/app-ui.css` (`appearance: none`), dilarang membiarkan tampilan default OS/browser.
   - Jangan membuat style inline atau CSS terpisah per aplikasi hanya untuk hal-hal standar (tombol, kartu, dropzone, chip, progress bar).
   - Apabila sebuah aplikasi benar-benar memerlukan tampilan khusus di luar standar, letakkan file override-nya di `styles/custom/<app-id>.css`.
4. **Multi-Language Otomatis (`id` / `en`):**
   - Seluruh halaman utama dan aplikasi wajib menyertakan `core/i18n.js` agar bahasa UI otomatis menyesuaikan bahasa browser pengguna (`id` / `en`).

---

## 2. Struktur Folder Resmi

```text
Web2/
├── AGENTS.md                 # Panduan proyek ini
├── README.md                 # Dokumentasi ringkas proyek & deploy
├── index.html                # Landing page (cutefish.my.id)
├── home.html                 # Web Desktop OS shell
├── favicon.svg               # Favicon SVG manual
├── _headers                  # Header Cache-Control Cloudflare Pages
├── wrangler.toml             # Konfigurasi Cloudflare Pages & nodejs_compat
├── package.json              # Dependency Cloudflare Functions (mongodb)
│
├── functions/                # Cloudflare Pages Functions (server-side)
│   └── api/
│       └── presets.js        # GET /api/presets (live MongoDB + edge cache)
│
├── apps/                     # Modul aplikasi (1 folder = 1 aplikasi HTML mandiri)
│   ├── _template/            # Boilerplate standar (copy-paste untuk app baru)
│   │   ├── index.html
│   │   └── app.js
│   └── <app-id>/             # Folder per aplikasi
│
├── core/                     # Engine inti Desktop OS & halaman
│   ├── i18n.js               # Auto multi-language (id / en)
│   ├── registry.js           # Single Source of Truth daftar aplikasi & folder
│   ├── window-manager.js     # Multi-window Stage Manager, tiling, aspect-ratio, mobile peek
│   ├── dock.js               # Flexible Dock
│   ├── folder-modal.js       # iPadOS Folder Modal
│   ├── desktop.js            # Bootstrap home.html & jam Indonesia
│   ├── landing.js            # Logic khusus index.html
│   ├── app-utils.js          # Utilitas UI seragam antar aplikasi
│   └── ffmpeg-client.js      # Loader FFmpeg WASM via CDN + Cache Storage
│
├── styles/                   # Modular CSS
│   ├── tokens.css            # Material 3 color tokens (light & dark)
│   ├── base.css              # Reset, view-transition, scrollbar suppression
│   ├── landing.css           # Style khusus index.html
│   ├── desktop.css           # Style desktop shell, doodle, jam, & big folder
│   ├── dock.css              # Style khusus Dock
│   ├── folder-modal.css      # Style khusus Folder Modal
│   ├── window-manager.css    # Style Multi-Window, Pill Header, Resize Handles, SlowTime bar
│   ├── app-ui.css            # Style SERAGAM wajib untuk semua aplikasi
│   └── custom/               # Override opsional khusus app non-standar
│
└── assets/                   # Pure static assets
    ├── icons/                # File SVG ikon aplikasi
    ├── icons-data.js         # Inline SVG map untuk render dock instan
    └── vendor/               # Library/helper ringan pihak ketiga (tanpa binary > 25 MiB)
```

---

## 3. Cara Menambah Aplikasi Baru
Cukup **2 langkah**:
1. Salin folder `apps/_template/` lalu ubah namanya menjadi `apps/<app-id>/`.
   - Pastikan `index.html` memuat `../../styles/tokens.css`, `../../styles/app-ui.css`, dan `../../core/i18n.js` — **dilarang** menimpa visual standar komponen di luar `styles/custom/`.
   - Gunakan struktur & kelas UI standar di `styles/app-ui.css` (`.app-shell`, `.app-dropzone`, `.app-stack`, `.app-file-meta`, `.app-card.app-stack-fill`, `.app-card-body`, `.app-card-footer`, `.m3-segmented`, `.m3-switch`, `.app-btn`, `.app-progress`, `.app-stats-grid`, `.app-logs.app-logs-responsive`).
2. Daftarkan atau aktifkan `entry` di `core/registry.js`:
   ```js
   {
     id: "<app-id>",
     title: "Nama Aplikasi",
     icon: "<app-id>.svg",
     entry: "apps/<app-id>/index.html",
     description: "Deskripsi singkat aplikasi"
   }
   ```
   *(Set `entry: null` jika aplikasi masih berupa placeholder window kosong).*

---

## 4. Konvensi Desktop OS & Window Manager
- **Desktop (>= 768px):**
  - 1 window: floating di tengah (bisa di-drag & di-resize); window dengan `aspectRatio` (mis. SlowTime) menyesuaikan rasio video otomatis.
  - 2 window: split kiri-kanan (50/50, atau mengikuti rasio video jika dipasangkan dengan SlowTime).
  - 3 window: 2 di atas, 1 lebar penuh di bawah (fleksibel).
  - 4 window: grid 2×2.
  - 5+ window: chaining tak terbatas ke zona kanan (`Zone 1, 2, ...`), mengintip `54px` di tepi kanan/kiri, geser otomatis saat hover/klik/trackpad swipe.
- **Mobile (< 768px):**
  - Tetap windowed (*rounded* `20px`) dengan **Dock selalu terlihat** di bawah (semua window berhenti di atas dock, tidak draggable/resizable).
  - 1 window: penuh sampai atas dock.
  - 2 window: split vertikal (atas-bawah 50/50), kecuali saat SlowTime aktif (app sebelumnya bergeser sedikit ke kiri & mengecil sebagai *peek*, SlowTime tampil penuh di atas dock).
  - 3+ window: chaining ke zona kanan (maks 2 window split vertikal per zona), dilengkapi tombol panah mengambang `<` / `>` di tepi untuk geser antar zona.
- **Verifikasi & Keamanan:**
  - Cek sintaks JS dengan `node -c <file>.js` setelah mengedit file JavaScript.
  - Pastikan `.env` tidak pernah ter-commit (`.gitignore` & `.assetsignore`).
  - Jangan membuka browser otomatis yang mengganggu jika user sedang aktif membuka tab `localhost:4174/home.html`.
