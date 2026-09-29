# 🤖 Project Agent Instructions & Commands

Repository: **Editorstuff** (`cutefishaep/editorstuff`)  
Focus: Media utilities, Creator tools, and TikTok Quality Bypass Research.

---

## ⚡ Custom Commands

### `/newmethod`
Ketika user mengetik atau memerintahkan `/newmethod`, agent harus menjalankan alur kerja riset eksperimental berikut secara otonom tanpa berhenti hingga metode baru berhasil:

1. **Analisa State & Histori Riset**:
   - Buka dan baca `Experiment/agen.md` untuk memahami metode apa saja yang sudah diuji, mana yang gagal, dan mana yang berhasil (`binary`, `StreamShield`).
   - Periksa script pipeline di folder `Experiment/` (`encode.js`, `newMethod.js`, `run.js`, `analyze.js`, `upload.js`, `config.json`).

2. **Rancang Hipotesis / Engine Metode Baru**:
   - Buat variasi atau pendekatan arsitektur manipulasi atom MP4 baru (misalnya manipulasi track time offset, auxiliary media streams, atom tagging, timescale trick, unindexed chunk placement, atau boundary spoofing).
   - **Batasan Mutlak**:
     - **0% Kompresi Lossless**: Dilarang keras melakukan FFmpeg re-encode lossy (tanpa menurunkan CRF/bitrate visual). Harus pure container/atom pass-through.
     - **Ringan & Cepat**: Eksekusi patch dalam memori harus instan (< 1 detik).
     - **Minimal Token Log**: Jangan gunakan emoji berlebihan atau banner ASCII art di log konsol.

3. **Implementasi & Uji Coba Otomatis**:
   - Terapkan kode metode baru ke dalam `Experiment/newMethod.js` atau modul engine di `Experiment/`.
   - Jalankan master runner untuk tes langsung:
     ```bash
     node Experiment/run.js --method <method_name> --force
     ```
   - **PENTING**: `run.js` sudah otomatis melakukan encode, upload ke TikTok `@fur.ae`, menunggu status publish, dan inspeksi atom stream live TikTok CDN. Dilarang melakukan double analyze terpisah jika `run.js` sudah menampilkannya.

4. **Iterasi Sampai Berhasil**:
   - Jika hasil inspeksi CDN live menunjukkan transcode/kompresi paksa ByteDance (misal 576x1024 SD @ 30fps), analisa penyebab kegagalannya dan ulangi langkah 2–3 dengan hipotesis baru.
   - Lakukan iterasi terus menerus hingga diperoleh hasil CDN live: **1080x1920 @ 60 FPS** tanpa degradasi bitrate.

5. **Dokumentasi & Penyimpanan**:
   - Simpan script metode yang berhasil ke dalam folder `Experiment/Working Method/<nama_metode>.js`.
   - Update tabel pengujian dan temuan teknis di `Experiment/agen.md`.
   - Berikan laporan hasil akhir yang ringkas, perbandingan bitrate/resolusi, dan tautan video TikTok hasil tes ke user.

---

## 🛠️ General Guidelines

- **UI & Code Consistency**: Setiap perubahan pada file di `scripts/`, `styles/`, atau `index.html` harus disinkronkan ke direktori build `dist-cf/`.
- **Branding**: Metode baru yang telah terbukti berhasil diimplementasikan di UI menggunakan nama **FISH** (bukan StreamShield di UI user-facing).
- **Format Deskripsi UI**: Gunakan format deskripsi modular (`[format]`, `[mode]`, `[resolution]`, `[info]`) tanpa menambahkan baris metode berulang atau kata-kata teknis internal yang tidak relevan bagi user.

---

## 📐 Arsitektur Pipeline Patcher & CMT

Konsep alur kerja mutlak:
$$\text{Upload} \longrightarrow \text{Method (Compress ON / OFF)} \longrightarrow \text{Process} \longrightarrow \text{Finalize}$$

1. **Upload**: User mengunggah video $\rightarrow$ sistem menginspeksi metadata atom (`inspectMp4Meta`) dan deteksi userscript.
2. **Method (Compress ON / OFF)**:
   - Pemilihan kategori & metode (Rekomendasi: `FISH`, `BINARY`, `F R Y`; Backup: `FPS`, `WMV`).
   - Pemilihan mode kompresi (`OFF`, `720P`, `1080P`). Video > 1080p otomatis dikunci ke 1080P.
3. **Process**:
   - Jika kompresi aktif $\rightarrow$ jalankan pipeline kompresi (`compress.js`).
   - Terapkan patch atom MP4 murni dalam memori sesuai engine metode yang dipilih tanpa re-encode lossy.
4. **Finalize**:
   - Seluruh hasil patch WAJIB dialirkan ke `finalize.js` (`finalizePatcherDownload`).
   - Format nama output distandarisasi ke: `(nama file)_hd.mp4`.
   - Menangani trigger auto-download, tombol download modal, progres 100%, toast notifikasi, dan prompt upload TikTok Studio.

