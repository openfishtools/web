(function() {
    const translations = {
        id: {
            "nav_social": "Sosial",
            "nav_preset": "Preset",
            "nav_resource": "Berkas",
            "nav_video_patcher": "Video Patcher",
            "nav_tools": "Alat",
            "nav_about": "Hubungi Kami",
            "tool_patcher_title": "TikTok Quality Patcher",
            "tool_patcher_desc": "TikTok HQ Upload",
            "tool_media_drop": "Drag & drop video atau gambar di sini atau klik untuk memilih",
            "tool_drop_formats_video": "Mendukung MP4, MOV, WebM",
            "tool_drop_formats_media": "Mendukung MP4, MOV, WebM, PNG, JPG, WebP",
            "tool_drop_formats_zip": "Mendukung ZIP berisi gambar PNG, JPG, WebP",
            "tool_drop_formats_xml": "Mendukung file project XML (.xml)",
            "tool_drop_formats_ae": "Mendukung After Effects XML (.xml/.aepx)",
            "patcher_subtitle": "TikTok HQ Upload",
            "patcher_partially_patched": "Ter-patch Sebagian",
            "patcher_drop_label": "Drag & drop video di sini atau klik untuk memilih",
            "patcher_ver_title": "Pilih Metode:",
            "patcher_variant_title": "Alight Motion Download Variant (Opsional):",
            "patcher_variant_none": "Tidak Ada",
            "patcher_variant_5mb": "5MB Premium",
            "patcher_variant_xml": "5MB Free XML",
            "patcher_variant_preset": "Premium (Full Preset)",
            "patcher_btn_process": "Proses Video",
            "tool_compressor_title": "Video Compressor",
            "tool_compressor_desc": "Kompres video ke ukuran tertentu",
            "tool_compressor_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_compressor_size": "Target Ukuran File (MB)",
            "tool_compressor_btn": "Mulai Kompresi",
            "tool_audio_extractor_title": "Audio Extractor",
            "tool_audio_extractor_desc": "Video to Audio",
            "tool_audio_extractor_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_audio_extractor_btn": "Ekstrak Audio",
            "tool_seq_title": "Image Sequence to Video",
            "tool_seq_desc": "AM Zip Exporter",
            "tool_seq_drop": "Drag & drop AM Export .zip di sini atau klik untuk memilih",
            "tool_seq_audio_drop": "Drag & drop audio/video di sini atau klik untuk memilih (Optional)",
            "tool_seq_fps": "Framerate (FPS)",
            "tool_seq_bitrate": "Video Bitrate (Mbps)",
            "tool_seq_btn": "Convert to Video",
            "tool_fivemb_title": "5MB XML Generator",
            "tool_fivemb_desc": "Alight Motion",
            "tool_fivemb_drop": "Drag & drop Alight Motion XML di sini untuk diproses",
            "tool_ae_am_title": "AE to AM",
            "tool_ae_am_desc": "Beatmark Converter",
            "tool_ae_am_drop": "Drag & drop AE XML (.xml/.aepx) di sini atau klik untuk memilih",
            "tool_ae_am_config_title": "Pengaturan Proyek Alight Motion",
            "tool_ae_am_comp": "Komposisi",
            "tool_ae_am_title_input": "Judul Proyek",
            "tool_ae_am_width": "Lebar",
            "tool_ae_am_height": "Tinggi",
            "tool_ae_am_fps": "Frame Rate (FPS)",
            "tool_ae_am_duration": "Durasi Total (ms)",
            "tool_ae_am_btn": "Konversi & Unduh XML",
            "tool_ae_am_analyzing": "Menganalisa berkas AE...",
            "tool_ae_am_success": "Konversi selesai. XML telah diunduh.",
            "tool_ae_am_no_beats": "Tidak ada beatmark di komposisi ini.",
            "tool_ae_am_beats_loaded": "{count} beatmark dimuat.",
            "tool_ae_am_no_beats_alert": "Komposisi terpilih tidak memiliki beatmark.",
            "tool_ae_am_error_invalid": "Berkas bukan After Effects XML.",
            "tool_ae_am_error_no_comp": "Tidak ditemukan komposisi dalam berkas ini.",
            "tool_stats_title": "TikTok Statistics",
            "tool_stats_desc": "Metadata & Stream Analyser",
            "tool_stats_url": "TikTok Video URL",
            "tool_stats_btn": "Ambil Statistik",
            "tool_downloader_title": "TikTok Downloader",
            "tool_downloader_desc": "Powered By TikWm",
            "tool_downloader_url": "TikTok Video URL",
            "tool_downloader_btn": "Unduh Video",
            "tool_webcodecs_title": "WebCodecs Compressor",
            "tool_webcodecs_desc": "Kompresi video cepat menggunakan hardware acceleration",
            "tool_webcodecs_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_webcodecs_fps": "Framerate (FPS)",
            "tool_webcodecs_btn": "Mulai Kompresi",
            "tool_upscale_title": "Qualitelio Enhancer",
            "tool_upscale_desc": "Media Upscaler",
            "tool_upscale_drop": "Drag & drop foto / video di sini (bisa pilih beberapa file) atau klik untuk memilih",
            "tool_upscale_scale": "Faktor Skala",
            "tool_upscale_btn": "Mulai Proses",
            "tool_interp_title": "Video Interpolation",
            "tool_interp_desc": "FPS Upscaler",
            "tool_interp_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_interp_factor": "Faktor Interpolasi (2x = Double FPS)",
            "tool_rembg_title": "Remove Background",
            "tool_rembg_desc": "AI Matting & Penghapus Background",
            "tool_rembg_drop": "Drag & drop video atau gambar di sini atau klik untuk memilih",
            "tool_rembg_model_title": "Model AI",
            "tool_rembg_bg_title": "Pilihan Background",
            "tool_rembg_bg_transparent": "Transparan",
            "tool_rembg_bg_green": "Green Screen",
            "tool_rembg_bg_color": "Warna Solid",
            "tool_rembg_bg_blur": "Blur",
            "tool_rembg_bg_image": "Gambar Kustom",
            "tool_rembg_device_title": "Perangkat",
            "tool_rembg_device_gpu": "GPU",
            "tool_rembg_device_cpu": "CPU",
            "tool_rembg_format_title": "Format",
            "tool_rembg_format_mov": "MOV (PNG/RGBA)",
            "tool_rembg_format_webm": "WebM (VP9/Alpha)",
            "tool_rembg_format_mp4": "MP4 (HEVC/Alpha)",
            "tool_rembg_mov_preview_title": "Pratinjau MOV Tidak Tersedia",
            "tool_rembg_mov_preview_desc": "MOV (PNG/RGBA) tidak bisa diputar di browser. Unduh untuk menonton.",
            "tool_rembg_btn_process": "Proses Media",
            "tool_rembg_btn_another": "Proses Media Lain",
            "status_selected": "Dipilih: ",
            "status_completed": "Proses Selesai!",
            "status_process_another": "Proses Media Lain",
            "status_completed_toast": "Media berhasil ditingkatkan!",
            "res_modal_copy": "Salin",
            "copy_failed": "Gagal menyalin ke clipboard",
            "copied": "Tersalin!",
            "category_all": "Semua",
            "no_results": "Tidak ada hasil ditemukan",
            "cache_purging_toast": "Membersihkan semua cache & hard refresh...",
            "cache_cleared": "✓ Cache dibersihkan & memori direset",
            "patcher_logs_title": "Log Proses:",
            "logs_copied": "Log tersalin!",
            "patcher_clear_cache": "Bersihkan cache & reset memori",
            "status_initializing": "Inisialisasi...",
            "status_reading_file": "Membaca berkas...",
            "status_fps_adjusting": "Menyesuaikan FPS...",
            "fps_patch_completed": "Patch FPS selesai!",
            "compressor_preset_title": "Pilih Preset Kompresi",
            "tool_interp_btn": "Interpolasi Video",
            "tool_audio_btn": "Ekstrak Audio",
            "tool_drop_formats": "Mendukung MP4, MOV, WebM",
            "tool_ae_am_btn_convert": "Konversi & Unduh XML",
            "tool_ae_am_select_comp": "Pilih Komposisi",
            "tool_ae_am_project_title": "Judul Proyek",
            "nav_home": "Beranda",
            "nav_contact": "Hubungi Kami",
            "hero_bio_text": "Editor video dan pengembang software. Berfokus membangun aplikasi web performa tinggi, utilitas pemrosesan video, dan alat kreatif untuk editor.",
            "hero_btn_journey": "Perjalanan Saya",
            "hero_btn_contact": "Hubungi Kami",
            "journey_pill": "Linimasa",
            "journey_title": "Perjalanan Saya",
            "journey_item1_title": "Semua Dimulai dari Kinemaster",
            "journey_item1_desc": "Aplikasi editing pertama saya adalah Kinemaster. Waktu itu YouTube sedang booming dan banyak orang mulai jadi YouTuber, dan saya ikut membuat konten Minecraft yang saya edit di Kinemaster. Selain itu, saat Musical.ly dan TikTok lagi ramai, saya juga sempat mencoba trend slow-mo ala Video Star pakai Kinemaster, meski nggak pernah saya upload, karena pernah di-bully setelah memposting video di IG, padahal saya cuma ingin mengekspresikan diri.",
            "journey_item2_title": "Era Transisi & Jedag-Jedug",
            "journey_item2_desc": "Pada 2019, trend editing transisi (biasa disebut TCC) sedang populer. Saya mulai menggunakan CuteCut untuk mengedit transisi. Karena tidak ada fitur motion tile bawaan, saya mengakalinya dengan aplikasi grid ala Instagram untuk membuat mirror grid photo sebagai efek motion tile. CapCut saya pakai untuk konten sederhana seperti tugas sekolah, dan sempat juga mencoba gaya jedag-jedug meski hasilnya kurang bagus. Saya juga mencoba aplikasi lain seperti Funimate dan Node Video. Node Video kurang cocok untuk saya karena sistem caching-nya, tapi Funimate cukup saya sukai. Kombinasi gaya VideoStar dan CapCut membuatnya cukup lengkap, dengan library effects dan kontrol 3D seperti 3D view, null, dan kamera. Sayangnya di Android tidak bisa mengimpor model 3D sendiri.",
            "journey_item3_title": "Era Alight Motion",
            "journey_item3_desc": "Menjelang 2020, masa-masa pandemi, saya mulai tertarik dengan Alight Motion, karena hasil editan jedag-jedugnya terlihat lebih rapi dibanding CapCut maupun Avee Player pada masa itu. Saya mendapat 5 ribu followers pertama saya berkat editan Alight Motion tersebut, dan cukup kaget karena editan yang sederhana bisa mendapat respons sebesar itu. Salah satu editan yang membuat akun saya cukup ramai adalah <a href=\"https://www.tiktok.com/@cutefishrbx/video/6975763680843533570\" target=\"_blank\" rel=\"noopener noreferrer\">video ini</a>. Pernah lihat? Itu editan saya dulu, hehe.",
            "journey_item4_year": "2021 - Sekarang",
            "journey_item4_title": "Laptop Kentang & After Effects",
            "journey_item4_desc": "Dengan bermodalkan laptop Lenovo S145-14AST RAM 4GB, saya memutuskan beralih ke After Effects. Versi awal yang saya gunakan adalah CC 2021, yang saat itu terasa cukup berat di laptop saya. Bahkan setelah mencoba CC 2022, CC 2021 tetap terasa paling berat. Sempat ragu apakah saya bisa mengedit di After Effects sama sekali, sampai saya tahu banyak orang menggunakan versi CS6 karena lebih ringan dan lancar di laptop spesifikasi rendah. Saya kurang suka dengan RAM preview yang mengharuskan render selesai dulu sebelum bisa diputar. Akhirnya ada yang membagikan CC 2018 dan saya pindah ke versi itu, dan ternyata jauh lebih ringan, bahkan lebih ringan dibanding Alight Motion di HP Redmi 9 saya.<br><br>Saat itu saya masih mengedit tanpa plugin, karena mendapatkan plugin seperti Sapphire cukup sulit dan saya belum familiar dengan software bajakan. Plugin pertama yang saya gunakan adalah Twixtor versi trial. Seiring waktu, saya akhirnya memiliki hampir semua plugin After Effects yang saya butuhkan lewat jalur bajakan.<br><br>Waktu berlalu, dan sekarang saya menggunakan laptop dengan spesifikasi yang lebih memadai untuk After Effects. Laptop saya sebenarnya MSI Modern 14 C11M, tapi karena adik saya ingin laptop untuk bermain Roblox, saya memutuskan membeli Axioo Hype 5 AMD dan memberikan MSI tersebut kepadanya.<br><br>Meski hardware sudah lebih memadai, bukan berarti tidak ada masalah lain di luar crash sesekali. Saya pribadi kurang setuju dengan harga plugin yang menurut saya terlalu mahal, terutama sistem berlangganan bulanan untuk tools yang sebenarnya cukup sederhana. Menurut saya, semua orang berhak berkarya tanpa terhalang keterbatasan finansial. Karena itu saya membuat sebuah extension bernama <a href=\"https://github.com/cutefishaep/OpenFishTools\" target=\"_blank\" rel=\"noopener noreferrer\">OpenFishTools</a>.<br><br>Tools ini gratis dan open source, dan akan tetap seperti itu, tidak akan menjadi berbayar di kemudian hari. Kemungkinan yang ada hanyalah versi forkingan dari tools ini, atau penjual tidak resmi yang menjual ulang tools serupa secara terpisah.",
            "tiktok_latest_title": "Postingan Terbaru",
            "footer_made_by": "Dibuat oleh cutefishaep",
            "social_connect_title": "Terhubung Dengan Saya",
            "tools_creative_title": "Alat Kreatif",
            "tools_search_placeholder": "Cari alat...",
            "res_modal_platform": "PILIH PLATFORM",
            "res_modal_version": "PILIH VERSI",
            "res_modal_guide": "PANDUAN INSTALASI",
            "res_modal_password": "KATA SANDI ARSIP",
            "res_modal_get": "Ambil Resource",
            "res_modal_select_os": "Pilih platform untuk melanjutkan",
            "res_no_link": "Tautan tidak tersedia",
            "res_no_versions": "Tidak ada versi tersedia",
            "res_no_platforms": "Tidak ada platform tersedia",
            "status_processing": "Memproses...",
            "status_error": "Terjadi kesalahan: ",
            "status_cleanup": "Membersihkan memory cache...",
            "offline_notice": "Kamu sedang offline, kamu hanya bisa mengakses Tools",
            "online_connected": "Kamu terhubung kembali",
            "offline_download_prompt": "Apakah kamu ingin mengunduh berkas yang diperlukan agar bisa bekerja secara offline?",
            "btn_download_files": "Unduh",
            "btn_later": "Nanti",
            "offline_downloading": "Mengunduh berkas offline...",
            "offline_download_complete": "Berkas offline siap digunakan!",
            "ios_warn_title": "Pemberitahuan Kompatibilitas iOS",
            "ios_warn_desc": "<p>Tool ini tidak didukung pada perangkat iOS, iPadOS, dan VisionOS. Video yang diproses di iOS mungkin tidak akan terunggah dengan sempurna melalui TikTok Studio.</p><p>Untuk hasil terbaik, silakan gunakan perangkat <strong>macOS, Windows, atau Android</strong>.</p>",
            "ios_warn_cancel": "Tutup",
            "ios_warn_proceed": "Mengerti",
            "ios_not_supported_err": "Perangkat iOS tidak didukung. Silakan gunakan PC (Windows/macOS) atau Android.",
            "v3_warn_title": "Peringatan Metode V3",
            "v3_warn_desc": "<p>Metode V3 menggunakan FastStart, pembersihan track data timecode, dan alignment padding 79KB. Pilih OFF (Direct Patch) untuk proses kilat tanpa kompresi, atau pilih preset HD/Compatibility untuk kompresi aman tanpa Out Of Memory.</p>",
            "v3_warn_cancel": "Batal",
            "v3_warn_proceed": "Lanjutkan",
            "ad_consent_title": "Suka pakai cutefish?",
            "ad_consent_desc": "<p>Tool ini 100% gratis dan berjalan langsung di browser kamu. Kalau tool ini ngebantu, boleh banget donasi buat bantu pengembangan. Opsional!</p>",
            "ad_consent_decline": "Nanti aja",
            "ad_consent_accept": "Oke, Donasi",
            "ad_notice": "Beberapa iklan di atas mungkin akan mengarahkanmu ke situs yang tidak kamu inginkan, jangan diklik",
            "compress_oom_title": "Video Terlalu Besar",
            "compress_oom_desc": "<p>Video kamu terlalu besar untuk dikompresi di browser dan bisa menyebabkan error <strong>Out of Memory</strong>. Kompresi video terlebih dahulu menggunakan:</p>",
            "compress_oom_cancel": "Batal",
            "compress_oom_proceed": "Tetap Lanjut",
            "compress_oom_device": "Perangkat",
            "compress_oom_cpu": "CPU Cores",
            "compress_oom_filesize": "Ukuran File",
            "compress_oom_fps": "Frame Rate",
            "compress_oom_resolution": "Resolusi",
            "compress_oom_aspect": "Aspect Ratio",
            "status_extracting_frames": "Extracting frames...",
            "status_loading_engine": "Loading engine...",
            "status_writing_frames": "Writing frames to virtual engine...",
            "status_writing_audio": "Writing audio to virtual engine...",
            "status_encoding": "Encoding video...",
            "status_finalizing": "Finalizing download...",
            "status_unzipped": "ZIP extracted successfully!",
            "status_empty_zip": "No valid frames found in ZIP.",
            "status_download_success": "Video berhasil diunduh!",
            "status_xml_success": "XML diproses dan diunduh otomatis!",
            "tool_fivemb_select_all": "Pilih Semua",
            "tool_fivemb_deselect_all": "Hapus Semua Pilihan",
            "tool_fivemb_layer_list_title": "Pilih Layer untuk Diganti Placeholder:",
            "tool_fivemb_btn_export": "Proses",
            "tool_fivemb_type_photo": "Foto",
            "tool_fivemb_type_video": "Video",
            "tool_fivemb_type_audio": "Suara",
            "tool_fivemb_no_layers": "Tidak ditemukan layer foto, video, atau suara.",
            "tool_fivemb_filter_all": "Semua",
            "tool_fivemb_filter_photo": "Foto",
            "tool_fivemb_filter_video": "Video",
            "tool_fivemb_filter_audio": "Suara",
            "social_title": "Link Saya",
            "preset_title": "Jelajahi",
            "resource_title": "Resource",
            "resource_search_placeholder": "Cari resource...",
            "tools_title": "Alat",
            "contact_title": "Hubungi Kami",
            "patcher_overlay_title": "Metode Ter-patch",
            "patcher_overlay_desc": "Metode WMV saat ini tidak tersedia. Silakan gunakan metode F R Y atau FPS.",
            "patcher_overlay_ignore": "Abaikan",
            "patcher_method_wmv": "WMV",
            "patcher_method_fry": "F R Y",
            "patcher_method_binary": "BINARY",
            "patcher_method_fps": "FPS",
            "patcher_method_tbt": "TEMP",
            "patcher_compress_title": "Compress",
            "patcher_mode_off": "OFF",
            "patcher_mode_720p": "720P",
            "patcher_mode_1080p": "1080P",
            "patcher_fixaudio_label": "Perbaiki audio tak teridentifikasi",
            "patcher_fixaudio_title": "Menambahkan track audio kedua yang bersih agar TikTok tidak salah membaca suara.",
            "patcher_ext_warn_title": "Bypass Cloud Canvas Diperlukan (>1080p / 120 FPS)",
            "patcher_ext_warn_body": "Video Anda memiliki resolusi tinggi (>1080p) atau frame rate 120 FPS. Userscript wajib aktif di browser Anda agar TikTok Studio tidak men-downscale video ke 720p.",
            "patcher_ext_optional_title": "Opsional",
            "patcher_ext_optional_body": "Pasang userscript ini jika hasil video yang Anda unggah ke TikTok Studio otomatis ter-downscale atau terlihat buram. Userscript akan menonaktifkan modul editor cloud TikTok agar kualitas asli video tetap terjaga.",
            "patcher_ext_btn_userscript": "Userscript",
            "patcher_ext_btn_install": "Install",
            "patcher_ext_recheck_btn": "Periksa Ulang",
            "patcher_ext_btn_blocked": "Userscript Diperlukan (>1080p/120fps)",
            "patcher_ext_blocked_toast": "Video >1080p atau 120 FPS wajib memasang userscript TikTok Cloud Edit Disabler.",
            "patcher_compress_required_toast": "Resolusi video > 1080p wajib dikompres (pilih 1080P atau 720P).",
            "patcher_ext_detected_toast": "TikTok Cloud Edit Disabler aktif!",
            "patcher_ext_not_found_toast": "Userscript belum terdeteksi aktif.",
            "patcher_ext_active_notice": "Userscript <strong>TikTok Cloud Edit Disabler</strong> aktif. Pembatasan Cloud Canvas dinonaktifkan, video siap diproses.",
            "patcher_ext_update_title": "Pembaruan Userscript Diperlukan",
            "patcher_ext_update_body": "Userscript Anda terdeteksi versi lama (aktif: <strong>v{active}</strong>, dibutuhkan: <strong>v{target}</strong>). Silahkan perbarui userscript ke versi terbaru agar pembatasan Cloud Canvas dinonaktifkan.",
            "patcher_ext_btn_update": "Update Userscript",
            "patcher_upload_studio_title": "Video siap diunggah",
            "patcher_upload_studio_desc": "Video telah berhasil dipatch. Buka TikTok Studio untuk melanjutkan proses upload.",
            "patcher_upload_studio_btn": "Buka TikTok Studio",
            "patcher_notice_res_limit": "Resolusi <strong>{res}</strong> (&gt; 1080p) terdeteksi. Kompresi otomatis diatur ke <strong>1080p</strong>.",
            "patcher_notice_fps_direct": "Video <strong>{fps} FPS</strong> (&gt; 60 FPS) terdeteksi. Dikonversi ke <strong>60 FPS slow motion</strong>.",
            "patcher_notice_fps_emergency": "Video <strong>{fps} FPS</strong> (&gt; 60 FPS) terdeteksi. Dikonversi ke <strong>60 FPS slow motion</strong> sebelum patch <strong>{method}</strong>.",
            "patcher_desc_wmv": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .wmv</li>
                        <li><span class="material-symbols-rounded">memory</span><strong>Codec:</strong> WMV2</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengonversi video ke format Windows Media Video (.wmv) melalui penyandian ulang lossless untuk melewati pembatasan bitrate bawaan platform.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fry_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Metode:</strong> F R Y Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Menata ulang metadata MP4 tanpa encode ulang, menjaga kualitas video dan audio tetap asli.</span>
                    </div>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>Terima kasih untuk <a href="https://www.tiktok.com/@itsmefachry" target="_blank" rel="noopener noreferrer">@itsmefachry</a> &amp; <a href="https://www.tiktok.com/@adek.jamannow" target="_blank" rel="noopener noreferrer">@adek.jamannow</a> karena sudah membagikan source method-nya dan membantu fix method ini.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fry_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi:</strong> 720p</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Metode:</strong> Kompresi + F R Y Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengompresi video ke 720p agar ukuran file lebih ringan, lalu menerapkan patch metadata MP4.</span>
                    </div>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>Terima kasih untuk <a href="https://www.tiktok.com/@itsmefachry" target="_blank" rel="noopener noreferrer">@itsmefachry</a> &amp; <a href="https://www.tiktok.com/@adek.jamannow" target="_blank" rel="noopener noreferrer">@adek.jamannow</a> karena sudah membagikan source method-nya dan membantu fix method ini.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fry_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi:</strong> 1080p</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Metode:</strong> Kompresi + F R Y Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengompresi video ke Full HD 1080p untuk menjaga ketajaman, lalu menerapkan patch metadata MP4.</span>
                    </div>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>Terima kasih untuk <a href="https://www.tiktok.com/@itsmefachry" target="_blank" rel="noopener noreferrer">@itsmefachry</a> &amp; <a href="https://www.tiktok.com/@adek.jamannow" target="_blank" rel="noopener noreferrer">@adek.jamannow</a> karena sudah membagikan source method-nya dan membantu fix method ini.</span>
                    </div>
                </div>
            `,
            "patcher_desc_binary_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Mode:</strong> Direct Pass-Through</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Menata ulang struktur metadata dan susunan streaming MP4 secara langsung tanpa kompresi, menjaga resolusi serta kualitas visual asli tetap utuh 100%.</span>
                    </div>
                </div>
            `,
            "patcher_desc_binary_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi:</strong> 720p</li>
                        <li><span class="material-symbols-rounded">memory</span><strong>Codec:</strong> H.264</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengompresi dan menyesuaikan batas resolusi ke 720p dengan alokasi bitrate teroptimasi, lalu menerapkan rekonstruksi metadata kontainer MP4.</span>
                    </div>
                </div>
            `,
            "patcher_desc_binary_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi:</strong> 1080p</li>
                        <li><span class="material-symbols-rounded">memory</span><strong>Codec:</strong> H.264</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengompresi video pada resolusi Full HD 1080p dengan batas bitrate tinggi untuk menjaga ketajaman gerak, dilanjutkan dengan rekonstruksi metadata kontainer MP4.</span>
                    </div>
                </div>
            `,
            "patcher_desc_tbt_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4 (Faststart)</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Bitrate:</strong> Capped 9.5 Mbps (Sweetspot)</li>
                        <li><span class="material-symbols-rounded">palette</span><strong>Color:</strong> Rec.709 (CFR)</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Optimasi stream cerdas agar tepat di bawah ambang pemicu kompresi TikTok (CRF 18, GOP 60) tanpa memanipulasi durasi kontainer.</span>
                    </div>
                </div>
            `,
            "patcher_desc_tbt_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4 (Faststart)</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi:</strong> 720p</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Bitrate:</strong> Capped 6.0 Mbps</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Konversi ke 720p dengan profil ingest optimal untuk hemat kuota dan unggahan kilat tanpa degradasi warna.</span>
                    </div>
                </div>
            `,
            "patcher_desc_tbt_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4 (Faststart)</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi:</strong> 1080p Full HD</li>
                        <li><span class="material-symbols-rounded">auto_fix_high</span><strong>Detail:</strong> Micro-Unsharp Sharpener</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Menyelaraskan resolusi ke standar 1080p dengan penajaman mikro dan batas bitrate 9.5 Mbps untuk hasil upload paling jernih.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Frame Rate:</strong> 30 FPS</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Video akan terlihat slow motion di galeri offline, namun otomatis berjalan mulus (smooth 60 FPS) saat diunggah ke TikTok.</span>
                    </div>
                    <div class="tiktok-desc-warning-row">
                        <span class="material-symbols-rounded">warning</span>
                        <span>Metode ini tidak membypass quality, hanya FPS saja.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">speed</span><strong>Kecepatan:</strong> Sangat Cepat (Tanpa Encode Ulang)</li>
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">auto_fix_high</span><strong>Modifikasi:</strong> Timescale & Duration Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Video akan terlihat slow motion di galeri offline, namun otomatis berjalan mulus (smooth 60 FPS) saat diunggah ke TikTok.</span>
                    </div>
                    <div class="tiktok-desc-warning-row">
                        <span class="material-symbols-rounded">warning</span>
                        <span>Metode ini tidak membypass quality, hanya FPS saja.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi Target:</strong> HD 720p</li>
                        <li><span class="material-symbols-rounded">compress</span><strong>Kompresi:</strong> H.264 VBR Hemat Ukuran</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Frame Rate:</strong> 30 FPS Presentation Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengompresi video ke 720p dengan bitrate hemat MB, lalu menerapkan timescale patch agar playback di TikTok berjalan halus.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolusi Target:</strong> Full HD 1080p</li>
                        <li><span class="material-symbols-rounded">compress</span><strong>Kompresi:</strong> H.264 HD Crisp (Film Tune)</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Frame Rate:</strong> 30 FPS Presentation Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Mengompresi video pada resolusi Full HD 1080p dengan ukuran MB kecil dan tajam pada pergerakan cepat, lalu menerapkan timescale patch.</span>
                    </div>
                </div>
            `,
            "offline_title": "Sumber Daya Offline Belum Lengkap",
            "offline_desc": "Unduh paket resource FFmpeg & AI Model offline agar semua tools dapat berjalan lancar tanpa koneksi internet.",
            "offline_btn_download": "Unduh Sekarang",
            "offline_btn_later": "Nanti",
            "offline_status_downloading": "Mengunduh sumber daya...",
            "offline_status_complete": "Semua sumber daya offline berhasil diunduh!",
            "preset_slow": "Lambat",
            "preset_medium": "Sedang",
            "preset_fast": "Cepat",
            "ffmpeg_preset_slow_desc": `
                <div style="background: var(--md-sys-color-surface-container); padding: 16px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 16px; text-align: left;">
                    <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
                        <li style="display: flex; align-items: center;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">memory</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Codec:</strong> H.264 (libx264)</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">speed</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Preset:</strong> Lambat</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">high_quality</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">CRF:</strong> 20 (Kualitas Tinggi)</li>
                    </ul>
                    <hr style="border: none; border-top: 1px dashed var(--md-sys-color-outline-variant); margin: 12px 0;">
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start;">
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary); flex-shrink: 0; margin-top: 2px;">info</span>
                        <span>Memprioritaskan kualitas maksimal dan ukuran file terkecil dengan konsekuensi waktu penyandian (encoding) yang jauh lebih lama.</span>
                    </div>
                </div>
            `,
            "ffmpeg_preset_medium_desc": `
                <div style="background: var(--md-sys-color-surface-container); padding: 16px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 16px; text-align: left;">
                    <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
                        <li style="display: flex; align-items: center;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">memory</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Codec:</strong> H.264 (libx264)</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">speed</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Preset:</strong> Sedang</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">high_quality</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">CRF:</strong> 20 (Kualitas Tinggi)</li>
                    </ul>
                    <hr style="border: none; border-top: 1px dashed var(--md-sys-color-outline-variant); margin: 12px 0;">
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start;">
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary); flex-shrink: 0; margin-top: 2px;">info</span>
                        <span>Menawarkan keseimbangan yang seimbang antara kecepatan encoding, ukuran file, dan kualitas visual. Direkomendasikan untuk penggunaan umum.</span>
                    </div>
                </div>
            `,
            "ffmpeg_preset_fast_desc": `
                <div style="background: var(--md-sys-color-surface-container); padding: 16px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 16px; text-align: left;">
                    <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
                        <li style="display: flex; align-items: center;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">memory</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Codec:</strong> H.265 / HEVC (libx265)</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">speed</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Preset:</strong> Sangat Cepat</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">high_quality</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">CRF:</strong> 20 (Kualitas Tinggi)</li>
                    </ul>
                    <hr style="border: none; border-top: 1px dashed var(--md-sys-color-outline-variant); margin: 12px 0;">
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start;">
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary); flex-shrink: 0; margin-top: 2px;">info</span>
                        <span>Menggunakan HEVC dengan preset encoding sangat cepat untuk kompresi yang lebih cepat. Ukuran file sedikit lebih besar dari preset lambat, namun tetap menjaga kualitas dengan baik.</span>
                    </div>
                </div>
            `,
            "stats_upload_date": "Tanggal Upload",
            "stats_region": "Region",
            "stats_shadowban": "Shadowban",
            "stats_resolution": "Resolusi",
            "stats_fps": "Frame Rate (FPS)",
            "stats_bitrate": "Bitrate",
            "stats_duration": "Durasi",
            "stats_size": "Ukuran File",
            "stats_method": "Method",
            "stats_views": "Views",
            "stats_likes": "Likes",
            "stats_comments": "Komentar",
            "stats_shares": "Dibagikan",
            "stats_saves": "Disimpan",
            "stats_engagement": "Engagement",
            "stats_safe": "Aman",
            "stats_restricted": "Dibatasi",
            "stats_err_enter_url": "Silakan masukkan URL video TikTok yang valid.",
            "stats_err_invalid_url": "URL bukan tautan TikTok yang valid.",
            "stats_status_analysing_video": "Menganalisis Metadata Video (FPS & Resolusi)...",
            "stats_err_failed": "Analisis gagal.",
            "btn_copy": "Salin",
            "btn_copied": "Tersalin!",
            "btn_preview": "Pratinjau",
            "btn_cancel": "Batal",
            "btn_continue": "Lanjutkan",
            "tktk_err_fps_fractional": "FPS tidak bulat ({fps} fps). Akan dinormalisasi ke {target} fps.",
            "tktk_err_fps_over120": "FPS melebihi 120 fps (maks 120 fps). Harus dikompresi.",
            "tktk_err_res_2k": "Resolusi melebihi 1080p ({res}). Harus dikompresi ke 1080p.",
            "tktk_err_size_30mb": "Ukuran file melebihi 50 MB (wajib dikompresi)",
            "tktk_err_mode_off": "Mode OFF tidak dapat digunakan untuk video ini",
            "btn_upscale_another": "Tingkatkan File Lain",
            "btn_interp_another": "Interpolasi File Lain",
            "system_checking_title": "Memeriksa Kompatibilitas Sistem...",
            "process_logs_title": "Log Proses:",
            "upscale_preset_title": "Preset Peningkatan",
            "upscale_timing_title": "Waktu Peningkatan",
            "upscale_timing_before": "Sebelum Upscale",
            "upscale_timing_after": "Setelah Upscale",
            "upscale_output_title": "Output",
            "upscale_normalise_title": "Normalisasi Ukuran",
            "upscale_normalise_desc": "Potong tengah ke 1080�1920 · Simpan sebagai JPG",
            "upscale_logs_title": "Log Proses",
            "upscale_preview_generating": "Membuat Pratinjau...",
            "upscale_preview_done": "Pratinjau siap!",
            "upscale_preview_failed": "Pratinjau gagal",
            "upscale_unprocessed_title": "Belum Diproses",
            "upscale_unprocessed_desc": "Tekan preview untuk melihat hasil proses",
            "upscale_norm_output": "Menormalisasi output ke 1080�1920...",
            "upscale_batch_drop": "Letakkan foto/video di sini atau klik untuk menambah",
            "upscale_batch_add": "Tambah File",
            "upscale_batch_remove": "Hapus",
            "upscale_batch_ready": "Siap",
            "upscale_batch_failed": "Gagal",
            "upscale_zip_preparing": "Menyiapkan ZIP...",
            "upscale_duration_title": "Posisi Frame",
            "tool_rembg_label_result": "Tanpa BG",
            "upscale_duration_title": "Durasi",
            "upscale_label_enhanced_ai": "Ditingkatkan + 4x AI",
            "upscale_label_live_enhanced": "Peningkatan Instan (1x)",
            "upscale_label_original": "Asli (1x)",
            "btn_start_batch": "Mulai Batch Processing",
            "btn_next_settings": "Next",
            "btn_back_files": "Kembali ke Daftar File",
            "btn_download_all_zip": "Unduh Semua (.zip)",
            "btn_upscale_another_batch": "Proses Batch Lain",
            "upscale_batch_title": "Batch Processing",
            "upscale_batch_step1_title": "Daftar File Dipilih",
            "upscale_batch_step2_title": "Pengaturan Batch Upscale",
            "upscale_batch_desc": "Memproses beberapa file media secara berurutan",
            "status_queued": "Mengantri",
            "interp_input_label": "Input",
            "interp_output_label": "Output",
            "interp_multiplier_title": "FPS Multiplier",
            "interp_original_label": "Asli",
            "interp_interpolated_label": "Interpolasi",
            "upscale_checking_ai": "AI Engine: Memeriksa...",
            "upscale_checking_gpu": "GPU Canvas: Memeriksa...",
            "upscale_checking_ffmpeg": "FFmpeg WASM: Memeriksa...",
            "upscale_ready_ai": "AI Engine: Siap",
            "upscale_ready_gpu": "GPU Canvas: Siap",
            "upscale_ready_ffmpeg": "FFmpeg WASM: Siap",
            "upscale_failed_ai": "AI Engine: Waktu Habis/Gagal",
            "upscale_failed_gpu": "GPU Canvas: Tidak Tersedia",
            "upscale_failed_ffmpeg": "FFmpeg WASM: Tidak Tersedia",
            "interp_checking_gpu": "WebGPU: Memeriksa...",
            "interp_ready_gpu": "WebGPU: Tersedia",
            "preset_category_all": "Semua",
            "preset_choose_version": "Pilih Versi",
            "preset_select_software": "Pilih software yang ingin kamu unduh:",
            "preset_choose_variant": "Pilih Varian",
            "preset_select_variant": "Pilih varian yang ingin kamu unduh:",
            "preset_am_premium": "Alight Motion Premium",
            "preset_am_5mb": "Alight Motion 5MB",
            "preset_xml": "XML",
            "preset_additional_files": "File Tambahan:",
            "preset_required_plugins": "Plugin yang Dibutuhkan:",
            "preset_download_btn": "Unduh Preset",
            "preset_download_xml_downloading": "Mengunduh XML...",
            "preset_thumbnail_unavailable": "Thumbnail Tidak Tersedia",
            "preset_video_unavailable": "Video Tidak Tersedia",
            "tktk_analysis_subtitle": "Menganalisis video Anda sebelum melakukan patch/kompresi",
            "tktk_label_fps": "Frame Rate",
            "tktk_label_res": "Resolusi",
            "tktk_label_size": "Ukuran File",
            "tktk_val_analyzing": "Menganalisis...",
            "tktk_ready_to_process": "Ready to Process", 
            "upload_guide_title": "Panduan Upload HD",
            "upload_guide_body": "<div class=\"ug-steps\"><div class=\"ug-step\"><div class=\"ug-badge\"><span class=\"material-symbols-rounded\">language</span></div><div class=\"ug-body\"><div class=\"ug-title\">Buka TikTok Studio</div><div class=\"ug-desc\">Pergi ke <a class=\"ug-link\" href=\"https://www.tiktok.com/tiktokstudio/upload\" target=\"_blank\" rel=\"noopener\">tiktok.com/tiktokstudio/upload</a></div></div></div><div class=\"ug-step\"><div class=\"ug-badge\"><span class=\"material-symbols-rounded\">qr_code_scanner</span></div><div class=\"ug-body\"><div class=\"ug-title\">Login Akun</div><div class=\"ug-desc\">Login dengan akunmu. Saran kami login pakai <strong>QR code</strong>.</div></div></div><div class=\"ug-step\"><div class=\"ug-badge\"><span class=\"material-symbols-rounded\">upload_file</span></div><div class=\"ug-body\"><div class=\"ug-title\">Upload Video</div><div class=\"ug-desc\">Upload video hasil patch <span class=\"ug-file\">{filename}</span>. Isi caption dan tag <strong>@cutefishaep</strong> (opsional). <strong>Jangan mengedit atau menambahkan sound</strong> setelah patch. Untuk sampul tidak apa apa.</div></div></div><div class=\"ug-step ug-step-done\"><div class=\"ug-badge ug-badge-done\"><span class=\"material-symbols-rounded\">check_circle</span></div><div class=\"ug-body\"><div class=\"ug-title\">Selesai</div><div class=\"ug-desc\">Videomu akan terupload dengan kualitas HD.</div></div></div></div>",
            "upload_guide_close": "Tutup",
            "upload_guide_upload": "Upload",

            "footer_rights": "Hak Cipta Dilindungi Undang-Undang.",
            "footer_build_date": "Build code:",
            "footer_privacy": "Kebijakan Privasi",
            "footer_terms": "Syarat & Ketentuan",
            "footer_disclaimer": "Penafian & DMCA",
            "legal_privacy_title": "Kebijakan Privasi",
            "legal_terms_title": "Syarat &amp; Ketentuan",
            "legal_disclaimer_title": "Penafian &amp; DMCA",
            "legal_privacy_content": "<p><strong>Terakhir diperbarui: 22 Agustus 2026</strong></p><p>Kebijakan Privasi ini menjelaskan bagaimana cutefishaep (cutefish.my.id) mengelola data saat Anda menggunakan layanan kami.</p><h4>1. Pemrosesan Data di Sisi Klien</h4><p>Sebagian besar tool pemrosesan media (termasuk Video Compressor, Audio Extractor, Image Sequence, 5MB XML, AE&#8594;AM Converter, TikTok Patcher, Qualitelio Enhancer, Video Interpolation, dan Remove Background) beroperasi sepenuhnya pada peramban pengguna menggunakan teknologi <a href='https://ffmpegwasm.netlify.app/' target='_blank' rel='noopener'>FFmpeg.wasm</a>, <a href='https://onnxruntime.ai/' target='_blank' rel='noopener'>ONNX Runtime Web</a>, dan WebGL. Berkas media yang diproses tidak dikirimkan ke server kami. Komunikasi ke server hanya terjadi untuk permintaan API di Vercel, seperti penghitungan interaksi like preset secara anonim, bantuan resolusi URL, dan metrik analitik dasar.</p><h4>2. Data yang Dikumpulkan</h4><p>cutefishaep hanya mencatat data teknis minimal yang diperlukan untuk operasional: (a) alamat IP anonim untuk mencegah duplikasi interaksi pada preset; (b) data statistik agregat melalui <a href='https://vercel.com/docs/analytics' target='_blank' rel='noopener'>Vercel Analytics</a> berupa jumlah kunjungan dan asal negara; serta (c) penyimpanan lokal (<code>localStorage</code> dan <code>Cache API</code>) pada perangkat pengguna untuk menyimpan preferensi tampilan, pilihan bahasa, dan cache modul offline. cutefishaep tidak menggunakan cookie pelacak pihak ketiga untuk periklanan.</p><h4>3. Layanan Pihak Ketiga</h4><p>Beberapa pustaka dan aset dimuat melalui jaringan distribusi konten (CDN) terpercaya: <a href='https://www.jsdelivr.com/' target='_blank' rel='noopener'>jsdelivr.net</a> untuk pustaka FFmpeg dan ONNX, <a href='https://fonts.google.com/' target='_blank' rel='noopener'>fonts.googleapis.com</a> untuk tipografi, serta <a href='https://huggingface.co/' target='_blank' rel='noopener'>huggingface.co</a> untuk model pemrosesan. Akses ke layanan CDN tersebut tunduk pada kebijakan privasi masing-masing penyedia.</p><h4>4. Kontak</h4><p>Pertanyaan seputar kebijakan privasi dapat disampaikan melalui email: <a href='mailto:cutefishaep@gmail.com'>cutefishaep@gmail.com</a>.</p>",
            "legal_terms_content": "<p><strong>Terakhir diperbarui: 22 Agustus 2026</strong></p><p>Dengan mengakses dan menggunakan layanan cutefishaep (cutefish.my.id), Anda menyatakan telah membaca, memahami, dan menyetujui Syarat &amp; Ketentuan ini.</p><h4>1. Deskripsi Layanan</h4><p>cutefishaep menyediakan kumpulan tautan sumber daya, preset video, dan tool pemrosesan media berbasis peramban untuk kreator konten. Layanan ini disediakan secara independen.</p><h4>2. Batasan Tanggung Jawab</h4><p>Seluruh layanan dan tool disediakan sebagaimana adanya (<em>as-is</em>) tanpa jaminan apa pun. cutefishaep tidak bertanggung jawab atas potensi kerusakan berkas, kehilangan data, atau kendala teknis yang timbul selama pemrosesan di peramban pengguna. Pengguna disarankan untuk selalu menyimpan salinan cadangan berkas asli.</p><h4>3. Ketentuan Penggunaan</h4><p>Pengguna wajib menggunakan layanan secara wajar dan dilarang: (a) melakukan tindakan yang dapat mengganggu integritas atau kinerja server; (b) melakukan pengambilan data otomatis (scraping) tanpa izin; (c) memproses atau menyebarkan berkas berbahaya.</p><h4>4. Ketentuan Penggunaan Tool Patcher</h4><p>Tool <strong>TikTok Quality Patcher</strong> disediakan untuk tujuan pengoptimalan teknis dan eksperimen berkas video secara lokal. Pengguna bertanggung jawab penuh untuk memastikan bahwa konten dan penggunaannya selaras dengan <a href='https://www.tiktok.com/legal/page/global/terms-of-service/en' target='_blank' rel='noopener'>Syarat Layanan TikTok</a> serta pedoman platform terkait lainnya. cutefishaep tidak terafiliasi dengan TikTok maupun ByteDance Ltd.</p><h4>5. Perubahan Ketentuan</h4><p>Syarat &amp; Ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan mulai berlaku efektif sejak tanggal pembaruan yang tercantum.</p><h4>6. Kontak</h4><p>Pertanyaan mengenai ketentuan layanan dapat dikirimkan ke: <a href='mailto:cutefishaep@gmail.com'>cutefishaep@gmail.com</a>.</p>",
            "legal_disclaimer_content": "<p><strong>Terakhir diperbarui: 22 Agustus 2026</strong></p><h4>1. Penafian Sumber Daya &amp; Tautan Luar</h4><p>Preset, materi, dan referensi yang tercantum pada cutefishaep ditujukan semata-mata sebagai referensi edukatif dan inspirasi kreatif. Tautan yang mengarah ke situs web eksternal berada di luar kendali cutefishaep, dan kami tidak bertanggung jawab atas isi maupun ketersediaan situs bersangkutan. Seluruh berkas berhak cipta tetap berada pada penyedia sumber aslinya.</p><h4>2. Penghargaan Proyek Sumber Terbuka</h4><p>cutefishaep memanfaatkan beberapa komponen dan proyek sumber terbuka (open source). Terima kasih kepada para pengembang dan komunitas proyek berikut:</p><ul><li><strong>FFmpeg</strong> (LGPL 2.1) - <a href='https://ffmpeg.org' target='_blank' rel='noopener'>ffmpeg.org</a> · <a href='https://github.com/ffmpegwasm/ffmpeg.wasm' target='_blank' rel='noopener'>github.com/ffmpegwasm</a></li><li><strong>ONNX Runtime Web</strong> (MIT) - <a href='https://onnxruntime.ai' target='_blank' rel='noopener'>onnxruntime.ai</a> · <a href='https://github.com/microsoft/onnxruntime' target='_blank' rel='noopener'>github.com/microsoft/onnxruntime</a></li><li><strong>MediaPipe Selfie Segmentation</strong> (Apache 2.0) - <a href='https://github.com/google-ai-edge/mediapipe' target='_blank' rel='noopener'>github.com/google-ai-edge/mediapipe</a></li><li><strong>Robust Video Matting (RVM)</strong> (MIT) - <a href='https://github.com/PeterL1n/RobustVideoMatting' target='_blank' rel='noopener'>github.com/PeterL1n/RobustVideoMatting</a></li><li><strong>MODNet</strong> (MIT) - <a href='https://github.com/ZHKKKe/MODNet' target='_blank' rel='noopener'>github.com/ZHKKKe/MODNet</a></li><li><strong>RIFE v4.7</strong> (MIT) - <a href='https://github.com/hzwer/ECCV2022-RIFE' target='_blank' rel='noopener'>github.com/hzwer/ECCV2022-RIFE</a></li><li><strong>Real-ESRGAN</strong> (BSD 3-Clause) - <a href='https://github.com/xinntao/Real-ESRGAN' target='_blank' rel='noopener'>github.com/xinntao/Real-ESRGAN</a></li><li><strong>JSZip</strong> (MIT) - <a href='https://stuk.github.io/jszip/' target='_blank' rel='noopener'>stuk.github.io/jszip</a></li><li><strong>Material Symbols</strong> &amp; <strong>Bootstrap Icons</strong> - <a href='https://fonts.google.com/icons' target='_blank' rel='noopener'>Google Icons</a> · <a href='https://icons.getbootstrap.com' target='_blank' rel='noopener'>Bootstrap Icons</a></li><li><strong>Tipografi</strong>: Unbounded, Outfit, Plus Jakarta Sans (OFL 1.1) - <a href='https://fonts.google.com' target='_blank' rel='noopener'>Google Fonts</a></li></ul><h4>3. Layanan &amp; Integrasi Pihak Ketiga</h4><p>Pengambilan data publik dan bantuan resolusi memanfaatkan endpoint publik serta layanan <a href='https://tikwm.com' target='_blank' rel='noopener'>TikWM</a>. Pengelolaan database dan layanan analitik berjalan di tingkat server Vercel tanpa memaparkan kredensial sensitif pada sisi klien.</p><h4>4. Prosedur Pemberitahuan DMCA</h4><p>cutefishaep menghargai hak kekayaan intelektual sesuai dengan ketentuan <a href='https://www.copyright.gov/dmca/' target='_blank' rel='noopener'>Digital Millennium Copyright Act (DMCA)</a>. Jika Anda pemilik sah suatu materi dan meyakini bahwa terdapat konten yang melanggar hak cipta Anda, silakan kirimkan pemberitahuan resmi beserta bukti kepemilikan ke <a href='mailto:cutefishaep@gmail.com'>cutefishaep@gmail.com</a> untuk segera ditindaklanjuti.</p>",
        },
        en: {
            "nav_social": "Social",
            "nav_preset": "Preset",
            "nav_resource": "Resource",
            "nav_video_patcher": "Video Patcher",
            "nav_tools": "Tools",
            "nav_about": "Contact Us",
            "tool_patcher_title": "TikTok Quality Patcher",
            "tool_patcher_desc": "TikTok HQ Upload",
            "tool_media_drop": "Drag & drop video or image here or click to select",
            "tool_drop_formats_video": "Supports MP4, MOV, WebM",
            "tool_drop_formats_media": "Supports MP4, MOV, WebM, PNG, JPG, WebP",
            "tool_drop_formats_zip": "Supports ZIP containing PNG, JPG, WebP",
            "tool_drop_formats_xml": "Supports Alight Motion project (.xml)",
            "tool_drop_formats_ae": "Supports After Effects XML (.xml/.aepx)",
            "patcher_subtitle": "TikTok HQ Upload",
            "patcher_partially_patched": "Partially patched",
            "patcher_drop_label": "Drag & drop video here or click to select",
            "patcher_ver_title": "Choose Method:",
            "patcher_variant_title": "AM Download Variant (Optional):",
            "patcher_variant_none": "None",
            "patcher_variant_5mb": "5MB Premium",
            "patcher_variant_xml": "5MB Free XML",
            "patcher_variant_preset": "Premium (Full Preset)",
            "patcher_btn_process": "Process Video",
            "tool_compressor_title": "Video Compressor",
            "tool_compressor_desc": "Compress video to custom sizes",
            "tool_compressor_drop": "Drag & drop video here or click to select",
            "tool_compressor_size": "Target File Size (MB)",
            "tool_compressor_btn": "Start Compression",
            "tool_audio_extractor_title": "Audio Extractor",
            "tool_audio_extractor_desc": "Video to Audio",
            "tool_audio_extractor_drop": "Drag & drop video here or click to select",
            "tool_audio_extractor_btn": "Extract Audio",
            "tool_seq_title": "Image Sequence to Video",
            "tool_seq_desc": "AM Zip Exporter",
            "tool_seq_drop": "Drag & drop AM Export .zip here or click to select",
            "tool_seq_audio_drop": "Drag & drop audio/video here or click to select (Optional)",
            "tool_seq_fps": "Framerate (FPS)",
            "tool_seq_bitrate": "Video Bitrate (Mbps)",
            "tool_seq_btn": "Convert to Video",
            "tool_fivemb_title": "5MB XML Generator",
            "tool_fivemb_desc": "Alight Motion",
            "tool_fivemb_drop": "Drag & drop Alight Motion XML here to process",
            "tool_ae_am_title": "AE to AM",
            "tool_ae_am_desc": "Beatmark Converter",
            "tool_ae_am_drop": "Drag & drop AE XML (.xml/.aepx) here or click to select",
            "tool_ae_am_config_title": "Alight Motion Project Settings",
            "tool_ae_am_comp": "Composition",
            "tool_ae_am_title_input": "Project Title",
            "tool_ae_am_width": "Width",
            "tool_ae_am_height": "Height",
            "tool_ae_am_fps": "Frame Rate (FPS)",
            "tool_ae_am_duration": "Total Duration (ms)",
            "tool_ae_am_btn": "Convert & Download XML",
            "tool_ae_am_analyzing": "Analyzing AE file...",
            "tool_ae_am_success": "Conversion complete. XML downloaded.",
            "tool_ae_am_no_beats": "No beatmarks detected in this composition.",
            "tool_ae_am_beats_loaded": "{count} beatmarks loaded.",
            "tool_ae_am_no_beats_alert": "Selected composition has no beatmarks.",
            "tool_ae_am_error_invalid": "File is not a valid After Effects XML.",
            "tool_ae_am_error_no_comp": "No compositions found in this file.",
            "tool_stats_title": "TikTok Statistics",
            "tool_stats_desc": "Metadata & Stream Analyser",
            "tool_stats_url": "TikTok Video URL",
            "tool_stats_btn": "Get Statistics",
            "tool_downloader_title": "TikTok Downloader",
            "tool_downloader_desc": "Powered By TikWm",
            "tool_downloader_url": "TikTok Video URL",
            "tool_downloader_btn": "Download Video",
            "tool_webcodecs_title": "WebCodecs Compressor",
            "tool_webcodecs_desc": "Fast video compression using hardware acceleration",
            "tool_webcodecs_drop": "Drag & drop video here or click to select",
            "tool_webcodecs_fps": "Framerate (FPS)",
            "tool_webcodecs_btn": "Start Compression",
            "tool_upscale_title": "Qualitelio Enhancer",
            "tool_upscale_desc": "Media Upscaler",
            "tool_upscale_drop": "Drag & drop photos / videos here (multiple files supported) or click to select",
            "tool_upscale_scale": "Scale Factor",
            "tool_upscale_btn": "Start Processing",
            "tool_interp_title": "Video Interpolation",
            "tool_interp_desc": "FPS Upscaler",
            "tool_interp_drop": "Drag & drop video here or click to select",
            "tool_interp_factor": "Interpolation Factor (2x = Double FPS)",
            "tool_rembg_title": "Remove Background",
            "tool_rembg_desc": "AI Matting & Background Removal",
            "tool_rembg_drop": "Drag & drop video or image here or click to select",
            "tool_rembg_model_title": "AI Model",
            "tool_rembg_bg_title": "Background Option",
            "tool_rembg_bg_transparent": "Transparent",
            "tool_rembg_bg_green": "Green Screen",
            "tool_rembg_bg_color": "Solid Color",
            "tool_rembg_bg_blur": "Blur",
            "tool_rembg_bg_image": "Custom Image",
            "tool_rembg_device_title": "Device",
            "tool_rembg_device_gpu": "GPU",
            "tool_rembg_device_cpu": "CPU",
            "tool_rembg_format_title": "Format",
            "tool_rembg_format_mov": "MOV (PNG/RGBA)",
            "tool_rembg_format_webm": "WebM (VP9/Alpha)",
            "tool_rembg_format_mp4": "MP4 (HEVC/Alpha)",
            "tool_rembg_mov_preview_title": "MOV Preview Unavailable",
            "tool_rembg_mov_preview_desc": "MOV (PNG/RGBA) cannot be played in browser. Download to view.",
            "tool_rembg_btn_process": "Process Media",
            "tool_rembg_btn_another": "Process Another Media",
            "status_selected": "Selected: ",
            "status_completed": "Completed!",
            "status_process_another": "Process Another",
            "status_completed_toast": "Media enhanced successfully!",
            "res_modal_copy": "Copy",
            "copy_failed": "Failed to copy to clipboard",
            "copied": "Copied!",
            "category_all": "All",
            "no_results": "No results found",
            "cache_purging_toast": "Purging all cache & hard refreshing...",
            "cache_cleared": "✓ Cache cleared & memory reset",
            "patcher_logs_title": "Process Logs:",
            "logs_copied": "Logs copied!",
            "patcher_clear_cache": "Clear cache & reset memory",
            "status_initializing": "Initializing...",
            "status_reading_file": "Reading file...",
            "status_fps_adjusting": "Adjusting FPS...",
            "fps_patch_completed": "FPS patch completed!",
            "compressor_preset_title": "Choose Compression Preset",
            "tool_interp_btn": "Interpolate Video",
            "tool_audio_btn": "Extract Audio",
            "tool_drop_formats": "Supports MP4, MOV, WebM",
            "tool_ae_am_btn_convert": "Convert & Download XML",
            "tool_ae_am_select_comp": "Select Composition",
            "tool_ae_am_project_title": "Project Title",
            "nav_home": "Home",
            "nav_contact": "Contact Us",
            "hero_bio_text": "Video editor and software developer. Focused on building high-performance web applications, video processing utilities, and creative tools for editors.",
            "hero_btn_journey": "My Journey",
            "hero_btn_contact": "Contact Us",
            "journey_pill": "Timeline",
            "journey_title": "My Journey",
            "journey_item1_title": "It All Started with Kinemaster",
            "journey_item1_desc": "My first editing app was Kinemaster. At the time, YouTube was booming and a lot of people were starting to become YouTubers. I made Minecraft content and edited it in Kinemaster. Around the same period, when Musical.ly and TikTok were popular, I also tried the Video Star–style slow-mo trend using Kinemaster, though I never actually uploaded those, since I'd been bullied before after posting videos on Instagram, even though all I wanted was to express myself.",
            "journey_item2_title": "Transitions & Beat Drop Era",
            "journey_item2_desc": "In 2019, transition-style editing (often called TCC) became popular, so I started using CuteCut for transitions. Since it didn't have a built-in motion tile feature, I worked around it with an Instagram-grid-style app to create mirror grid photos for a similar effect. I used CapCut mainly for simple content like school assignments, and tried the jedag-jedug style too, though the results weren't great. I also tried apps like Funimate and Node Video. Node Video wasn't really for me because of its caching system, but I liked Funimate. It combined elements of VideoStar and CapCut, with a fairly complete effects and 3D library, including 3D controls like 3D view, nulls, and cameras. The only downside was that Android didn't support importing custom 3D models.",
            "journey_item3_title": "The Alight Motion Era",
            "journey_item3_desc": "Around 2020, during the pandemic, I got interested in Alight Motion because its jedag-jedug edits looked noticeably cleaner than CapCut or Avee Player at the time. I got my first 5,000 followers from my Alight Motion edits, and I was genuinely surprised that such simple edits could get that kind of response. One of the edits that helped grow my account is <a href=\"https://www.tiktok.com/@cutefishrbx/video/6975763680843533570\" target=\"_blank\" rel=\"noopener noreferrer\">this one</a>. Ever seen it? Yep, that's my old edit, haha.",
            "journey_item4_year": "2021 - Present",
            "journey_item4_title": "Potato Laptop & After Effects",
            "journey_item4_desc": "Using a Lenovo S145-14AST with 4GB of RAM, I decided to switch to After Effects. The first version I used was CC 2021, which felt quite heavy on my laptop. Even after trying CC 2022 later on, CC 2021 still felt like the heaviest version I'd used. I wasn't sure I'd be able to edit in After Effects at all, until I found out a lot of people used CS6 since it ran lighter and smoother on lower-spec laptops. I wasn't a fan of RAM preview, since it required rendering everything before playback. Eventually someone shared CC 2018 with me, and it turned out to be much lighter, even lighter than Alight Motion on my Redmi 9.<br><br>At that point I was still editing without plugins, since getting something like Sapphire was hard to come by and I wasn't familiar with pirated software yet. The first plugin I used was a trial version of Twixtor. Over time, I eventually got access to most of the After Effects plugins I needed through unofficial sources.<br><br>Time passed, and now I use a laptop with specs that are actually suited for After Effects. It's technically an MSI Modern 14 C11M, but since my younger sibling wanted a laptop for Roblox, I ended up buying an Axioo Hype 5 AMD and giving them the MSI instead.<br><br>Even with better hardware, occasional crashes aside, there are things I'm still not fond of, particularly plugin pricing that I think is unreasonably high, especially subscription-based pricing for tools that are essentially simple shortcuts. I believe everyone should be able to create without being limited by cost, which is why I built an extension called <a href=\"https://github.com/cutefishaep/OpenFishTools\" target=\"_blank\" rel=\"noopener noreferrer\">OpenFishTools</a>.<br><br>It's free and open source, and it's staying that way, it won't become paid down the line. The only likely alternatives are forked versions of the tool, or unofficial resellers offering similar tools separately.",
            "tiktok_latest_title": "Latest Posts",
            "footer_made_by": "Made by cutefishaep",
            "social_connect_title": "Connect With Me",
            "tools_creative_title": "Creative Tools",
            "tools_search_placeholder": "Search tools...",
            "res_modal_platform": "CHOOSE PLATFORM",
            "res_modal_version": "CHOOSE VERSION",
            "res_modal_guide": "INSTALLATION GUIDE",
            "res_modal_password": "ARCHIVE PASSWORD",
            "res_modal_get": "Get Resource",
            "res_modal_select_os": "Select a platform to continue",
            "res_no_link": "No link available",
            "res_no_versions": "No versions available",
            "res_no_platforms": "No platforms available",
            "status_processing": "Processing...",
            "status_error": "An error occurred: ",
            "status_cleanup": "Cleaning up memory cache...",
            "offline_notice": "You are offline, you can only access Tools",
            "online_connected": "You're Connected",
            "offline_download_prompt": "Do you want to download required files to work offline?",
            "btn_download_files": "Download",
            "btn_later": "Later",
            "offline_downloading": "Downloading offline files...",
            "offline_download_complete": "Offline files ready to use!",
            "ios_warn_title": "iOS Compatibility Warning",
            "ios_warn_desc": "<p>This tool is not supported on iOS, iPadOS, and VisionOS devices. Patched videos on iOS may fail to upload via TikTok Studio.</p><p>For the best experience, please use <strong>macOS, Windows, or Android</strong> devices.</p>",
            "ios_warn_cancel": "Close",
            "ios_warn_proceed": "Understood",
            "ios_not_supported_err": "iOS devices are not supported. Please use PC (Windows/macOS) or Android.",
            "v3_warn_title": "V3 Method Warning",
            "v3_warn_desc": "<p>V3 Method applies FastStart, data track cleaning, and 79KB alignment padding. Select OFF (Direct Patch) for instant 0% loss pass-through, or select HD/Compatibility for memory-safe compression without OOM crashes.</p>",
            "v3_warn_cancel": "Cancel",
            "v3_warn_proceed": "Proceed",
            "ad_consent_title": "Enjoying cutefish?",
            "ad_consent_desc": "<p>This tool is 100% free and runs entirely in your browser. If it helps you out, consider donating to support development. It's totally optional!</p>",
            "ad_consent_decline": "Maybe later",
            "ad_consent_accept": "Sure, Donate",
            "ad_notice": "Some ads above may redirect you to sites you didn't intend to visit, don't click them",
            "compress_oom_title": "Video Too Large",
            "compress_oom_desc": "<p>Your video is too large to compress in the browser and may cause an <strong>Out of Memory</strong> error. Compress your video first using:</p>",
            "compress_oom_cancel": "Cancel",
            "compress_oom_proceed": "Proceed Anyway",
            "compress_oom_device": "Device",
            "compress_oom_cpu": "CPU Cores",
            "compress_oom_filesize": "File Size",
            "compress_oom_fps": "Frame Rate",
            "compress_oom_resolution": "Resolution",
            "compress_oom_aspect": "Aspect Ratio",
            "status_extracting_frames": "Extracting frames...",
            "status_loading_engine": "Loading engine...",
            "status_writing_frames": "Writing frames to virtual engine...",
            "status_writing_audio": "Writing audio to virtual engine...",
            "status_encoding": "Encoding video...",
            "status_finalizing": "Finalizing download...",
            "status_unzipped": "ZIP extracted successfully!",
            "status_empty_zip": "No valid frames found in ZIP.",
            "status_download_success": "Video successfully downloaded!",
            "status_xml_success": "XML processed and downloaded successfully!",
            "tool_fivemb_select_all": "Select All",
            "tool_fivemb_deselect_all": "Deselect All",
            "tool_fivemb_layer_list_title": "Select Layers to Replace with Placeholders:",
            "tool_fivemb_btn_export": "Process",
            "tool_fivemb_type_photo": "Photo",
            "tool_fivemb_type_video": "Video",
            "tool_fivemb_type_audio": "Sound",
            "tool_fivemb_no_layers": "No photo, video, or sound layers found.",
            "tool_fivemb_filter_all": "All",
            "tool_fivemb_filter_photo": "Photo",
            "tool_fivemb_filter_video": "Video",
            "tool_fivemb_filter_audio": "Audio",
            "social_title": "My Links",
            "preset_title": "Explore",
            "resource_title": "Resources",
            "resource_search_placeholder": "Search resources...",
            "tools_title": "Tools",
            "contact_title": "Contact Us",
            "patcher_overlay_title": "Method Patched",
            "patcher_overlay_desc": "WMV method is currently unavailable. Please use F R Y or FPS method.",
            "patcher_overlay_ignore": "Ignore",
            "patcher_method_wmv": "WMV",
            "patcher_method_fry": "F R Y",
            "patcher_method_binary": "BINARY",
            "patcher_method_fps": "FPS",
            "patcher_method_tbt": "TEMP",
            "patcher_compress_title": "Compress",
            "patcher_mode_off": "OFF",
            "patcher_mode_720p": "720P",
            "patcher_mode_1080p": "1080P",
            "patcher_fixaudio_label": "Fix unidentified audio",
            "patcher_fixaudio_title": "Adds a second clean audio track so TikTok does not misidentify the sound.",
            "patcher_ext_warn_title": "Cloud Canvas Bypass Required (>1080p / 120 FPS)",
            "patcher_ext_warn_body": "Your video exceeds 1080p or has 120 FPS. The userscript is strictly required to disable Cloud Canvas and prevent TikTok Studio from force-downscaling to 720p.",
            "patcher_ext_optional_title": "Optional",
            "patcher_ext_optional_body": "Install this userscript if your uploaded video to TikTok Studio is automatically downscaled or loses quality. It disables TikTok's cloud canvas editor pipeline to preserve your native video resolution.",
            "patcher_ext_btn_userscript": "Userscript",
            "patcher_ext_btn_install": "Install",
            "patcher_ext_recheck_btn": "Recheck",
            "patcher_ext_btn_blocked": "Userscript Required (>1080p/120fps)",
            "patcher_ext_blocked_toast": "Videos >1080p or 120 FPS require the TikTok Cloud Edit Disabler userscript.",
            "patcher_compress_required_toast": "Video resolution > 1080p must be compressed (select 1080P or 720P).",
            "patcher_ext_detected_toast": "TikTok Cloud Edit Disabler is active!",
            "patcher_ext_not_found_toast": "Userscript is not detected yet.",
            "patcher_ext_active_notice": "Userscript <strong>TikTok Cloud Edit Disabler</strong> is active. Cloud Canvas restriction disabled, video ready to process.",
            "patcher_ext_update_title": "Userscript Update Required",
            "patcher_ext_update_body": "Your Userscript version is outdated (active: <strong>v{active}</strong>, required: <strong>v{target}</strong>). Please update the userscript to the latest version to bypass Cloud Canvas.",
            "patcher_ext_btn_update": "Update Userscript",
            "patcher_upload_studio_title": "Ready to upload",
            "patcher_upload_studio_desc": "Video has been patched. Open TikTok Studio to proceed with your upload.",
            "patcher_upload_studio_btn": "Open TikTok Studio",
            "patcher_notice_res_limit": "Video resolution <strong>{res}</strong> (&gt; 1080p) detected. Auto-compression set to <strong>1080p</strong>.",
            "patcher_notice_fps_direct": "Video <strong>{fps} FPS</strong> (&gt; 60 FPS) detected. Converted to <strong>60 FPS slow motion</strong>.",
            "patcher_notice_fps_emergency": "Video <strong>{fps} FPS</strong> (&gt; 60 FPS) detected. Converted to <strong>60 FPS slow motion</strong> before <strong>{method}</strong> patch.",
            "patcher_desc_wmv": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .wmv</li>
                        <li><span class="material-symbols-rounded">memory</span><strong>Codec:</strong> WMV2</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Converts video to Windows Media Video (.wmv) format via lossless re-encoding to bypass platform-side bitrate ingestion constraints.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fry_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Method:</strong> F R Y Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Rearranges MP4 metadata without re-encoding, keeping original video and audio quality intact.</span>
                    </div>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>Thanks to <a href="https://www.tiktok.com/@itsmefachry" target="_blank" rel="noopener noreferrer">@itsmefachry</a> &amp; <a href="https://www.tiktok.com/@adek.jamannow" target="_blank" rel="noopener noreferrer">@adek.jamannow</a> for sharing the method source and helping fix this method.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fry_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolution:</strong> 720p</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Method:</strong> Compression + F R Y Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Compresses video to 720p for a smaller file size, then applies MP4 metadata patch.</span>
                    </div>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>Thanks to <a href="https://www.tiktok.com/@itsmefachry" target="_blank" rel="noopener noreferrer">@itsmefachry</a> &amp; <a href="https://www.tiktok.com/@adek.jamannow" target="_blank" rel="noopener noreferrer">@adek.jamannow</a> for sharing the method source and helping fix this method.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fry_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolution:</strong> 1080p</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Method:</strong> Compression + F R Y Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Compresses video to Full HD 1080p to preserve sharpness, then applies MP4 metadata patch.</span>
                    </div>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>Thanks to <a href="https://www.tiktok.com/@itsmefachry" target="_blank" rel="noopener noreferrer">@itsmefachry</a> &amp; <a href="https://www.tiktok.com/@adek.jamannow" target="_blank" rel="noopener noreferrer">@adek.jamannow</a> for sharing the method source and helping fix this method.</span>
                    </div>
                </div>
            `,
            "patcher_desc_binary_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">tune</span><strong>Mode:</strong> Direct Pass-Through</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Restructures MP4 container metadata and stream layout directly without compression, preserving 100% of original visual quality and resolution.</span>
                    </div>
                </div>
            `,
            "patcher_desc_binary_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolution:</strong> 720p</li>
                        <li><span class="material-symbols-rounded">memory</span><strong>Codec:</strong> H.264</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Compresses and scales resolution up to 720p with optimized bitrate allocation, followed by MP4 container metadata reconstruction.</span>
                    </div>
                </div>
            `,
            "patcher_desc_binary_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolution:</strong> 1080p</li>
                        <li><span class="material-symbols-rounded">memory</span><strong>Codec:</strong> H.264</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Compresses video at Full HD 1080p resolution with high bitrate allocation to preserve motion clarity, followed by MP4 container metadata reconstruction.</span>
                    </div>
                </div>
            `,
            "patcher_desc_tbt_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4 (Faststart)</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Bitrate:</strong> Capped 9.5 Mbps (Sweetspot)</li>
                        <li><span class="material-symbols-rounded">palette</span><strong>Color:</strong> Rec.709 (CFR)</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Smart stream optimization tuned right below TikTok's compression threshold (CRF 18, GOP 60) without container header corruption.</span>
                    </div>
                </div>
            `,
            "patcher_desc_tbt_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4 (Faststart)</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolution:</strong> 720p</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Bitrate:</strong> Capped 6.0 Mbps</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>720p conversion with optimized ingest profile for fast, bandwidth-friendly uploads without color degradation.</span>
                    </div>
                </div>
            `,
            "patcher_desc_tbt_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4 (Faststart)</li>
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Resolution:</strong> 1080p Full HD</li>
                        <li><span class="material-symbols-rounded">auto_fix_high</span><strong>Detail:</strong> Micro-Unsharp Sharpener</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Aligns video to 1080p Full HD standard with micro-sharpening and capped 9.5 Mbps bitrate for ultra-crisp playback.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Frame Rate:</strong> 30 FPS</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Video will appear in slow motion in local playback, but will play smoothly at 60 FPS once uploaded to TikTok.</span>
                    </div>
                    <div class="tiktok-desc-warning-row">
                        <span class="material-symbols-rounded">warning</span>
                        <span>This method does not bypass quality, only FPS.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps_off": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">speed</span><strong>Speed:</strong> Instant (No Re-encoding)</li>
                        <li><span class="material-symbols-rounded">movie</span><strong>Format:</strong> .mp4</li>
                        <li><span class="material-symbols-rounded">auto_fix_high</span><strong>Patch:</strong> Timescale & Duration Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Video will appear in slow motion in local playback, but will play smoothly at 60 FPS once uploaded to TikTok.</span>
                    </div>
                    <div class="tiktok-desc-warning-row">
                        <span class="material-symbols-rounded">warning</span>
                        <span>This method does not bypass quality, only FPS.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps_720p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Target Resolution:</strong> HD 720p</li>
                        <li><span class="material-symbols-rounded">compress</span><strong>Compression:</strong> Light H.264 VBR</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Frame Rate:</strong> 30 FPS Presentation Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Compresses video to 720p for low file size, then applies timescale patch for smooth playback on TikTok.</span>
                    </div>
                </div>
            `,
            "patcher_desc_fps_1080p": `
                <div class="tiktok-desc-card">
                    <ul class="tiktok-desc-list">
                        <li><span class="material-symbols-rounded">aspect_ratio</span><strong>Target Resolution:</strong> Full HD 1080p</li>
                        <li><span class="material-symbols-rounded">compress</span><strong>Compression:</strong> Crisp H.264 (Film Tune)</li>
                        <li><span class="material-symbols-rounded">speed</span><strong>Frame Rate:</strong> 30 FPS Presentation Patch</li>
                    </ul>
                    <hr class="tiktok-desc-divider">
                    <div class="tiktok-desc-footer">
                        <span class="material-symbols-rounded">info</span>
                        <span>Compresses video at Full HD 1080p with optimized compact file size and high motion retention, then applies timescale patch.</span>
                    </div>
                </div>
            `,
            "offline_title": "Offline Resources Incomplete",
            "offline_desc": "Download FFmpeg & AI Model offline packages so all tools work smoothly without an internet connection.",
            "offline_btn_download": "Download Now",
            "offline_btn_later": "Later",
            "offline_status_downloading": "Downloading resources...",
            "offline_status_complete": "All offline resources downloaded successfully!",
            "preset_slow": "Slow",
            "preset_medium": "Medium",
            "preset_fast": "Fast",
            "ffmpeg_preset_slow_desc": `
                <div style="background: var(--md-sys-color-surface-container); padding: 16px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 16px; text-align: left;">
                    <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
                        <li style="display: flex; align-items: center;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">memory</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Codec:</strong> H.264 (libx264)</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">speed</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Preset:</strong> Slow</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">high_quality</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">CRF:</strong> 20 (High Quality)</li>
                    </ul>
                    <hr style="border: none; border-top: 1px dashed var(--md-sys-color-outline-variant); margin: 12px 0;">
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start;">
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary); flex-shrink: 0; margin-top: 2px;">info</span>
                        <span>Prioritizes maximum quality and smallest file size at the cost of significantly longer encoding time.</span>
                    </div>
                </div>
            `,
            "ffmpeg_preset_medium_desc": `
                <div style="background: var(--md-sys-color-surface-container); padding: 16px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 16px; text-align: left;">
                    <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
                        <li style="display: flex; align-items: center;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">memory</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Codec:</strong> H.264 (libx264)</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">speed</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Preset:</strong> Medium</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">high_quality</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">CRF:</strong> 20 (High Quality)</li>
                    </ul>
                    <hr style="border: none; border-top: 1px dashed var(--md-sys-color-outline-variant); margin: 12px 0;">
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start;">
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary); flex-shrink: 0; margin-top: 2px;">info</span>
                        <span>Offers a balanced trade-off between encoding speed, file size, and visual quality. Recommended for general use.</span>
                    </div>
                </div>
            `,
            "ffmpeg_preset_fast_desc": `
                <div style="background: var(--md-sys-color-surface-container); padding: 16px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 16px; text-align: left;">
                    <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
                        <li style="display: flex; align-items: center;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">memory</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Codec:</strong> H.265 / HEVC (libx265)</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">speed</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">Preset:</strong> Very Fast</li>
                        <li style="display: flex; align-items: center; margin-top: 4px;"><span class="material-symbols-rounded" style="font-size: 18px; margin-right: 8px; color: var(--md-sys-color-primary);">high_quality</span><strong style="color: var(--md-sys-color-on-surface); margin-right: 4px;">CRF:</strong> 20 (High Quality)</li>
                    </ul>
                    <hr style="border: none; border-top: 1px dashed var(--md-sys-color-outline-variant); margin: 12px 0;">
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 13px; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start;">
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary); flex-shrink: 0; margin-top: 2px;">info</span>
                        <span>Utilizes HEVC with a very fast encoding preset for faster compression. File size is slightly larger than slow preset, but still maintains good quality.</span>
                    </div>
                </div>
            `,
            "stats_upload_date": "Upload Date",
            "stats_region": "Region",
            "stats_shadowban": "Shadowban",
            "stats_resolution": "Resolution",
            "stats_fps": "Frame Rate (FPS)",
            "stats_bitrate": "Bitrate",
            "stats_duration": "Duration",
            "stats_size": "File Size",
            "stats_method": "Method",
            "stats_views": "Views",
            "stats_likes": "Likes",
            "stats_comments": "Comments",
            "stats_shares": "Shares",
            "stats_saves": "Saves",
            "stats_engagement": "Engagement",
            "stats_safe": "Safe",
            "stats_restricted": "Restricted",
            "stats_err_enter_url": "Please enter a valid TikTok video URL.",
            "stats_err_invalid_url": "URL is not a valid TikTok link.",
            "stats_status_analysing_video": "Analysing Video Metadata (FPS & Resolution)...",
            "stats_err_failed": "Analysis failed.",
            "btn_copy": "Copy",
            "btn_copied": "Copied!",
            "btn_preview": "Preview",
            "btn_cancel": "Cancel",
            "btn_continue": "Continue",
            "tktk_err_fps_fractional": "Fractional FPS detected ({fps} fps). Will be normalized to {target} fps.",
            "tktk_err_fps_over120": "FPS exceeds 120 fps limit (max 120 fps). Must be compressed.",
            "tktk_err_res_2k": "Resolution exceeds 1080p ({res}). Must be compressed to 1080p.",
            "tktk_err_size_30mb": "Exceeds 50 MB (compression required)",
            "tktk_err_mode_off": "Mode OFF cannot be used for this video",
            "btn_upscale_another": "Upscale Another",
            "btn_interp_another": "Interpolate Another",
            "system_checking_title": "Checking System Compatibility...",
            "process_logs_title": "Process Logs:",
            "upscale_preset_title": "Enhancement Preset",
            "upscale_timing_title": "Enhance Timing",
            "upscale_timing_before": "Before Upscale",
            "upscale_timing_after": "After Upscale",
            "upscale_output_title": "Output",
            "upscale_normalise_title": "Normalise Size",
            "upscale_normalise_desc": "Crop center to 1080�1920 · Save as JPG",
            "upscale_logs_title": "Process Logs",
            "upscale_preview_generating": "Generating Preview...",
            "upscale_preview_done": "Preview ready!",
            "upscale_preview_failed": "Preview failed",
            "upscale_unprocessed_title": "Unprocessed",
            "upscale_unprocessed_desc": "Press preview to view the processed file",
            "upscale_norm_output": "Normalising output to 1080x1920...",
            "upscale_batch_drop": "Drop photos / videos here or click to add",
            "upscale_batch_add": "Add Files",
            "upscale_batch_remove": "Remove",
            "upscale_batch_ready": "Ready",
            "upscale_batch_failed": "Failed",
            "upscale_zip_preparing": "Preparing ZIP...",
            "upscale_duration_title": "Frame Position",
            "tool_rembg_label_result": "No BG",
            "upscale_duration_title": "Duration",
            "upscale_label_enhanced_ai": "Enhanced + 4x AI",
            "upscale_label_live_enhanced": "Live Enhanced (1x)",
            "upscale_label_original": "Original (1x)",
            "btn_start_batch": "Start Batch Processing",
            "btn_next_settings": "Next",
            "btn_back_files": "Back to Selected Files",
            "btn_download_all_zip": "Download All (.zip)",
            "btn_upscale_another_batch": "Process Another Batch",
            "upscale_batch_title": "Batch Processing",
            "upscale_batch_step1_title": "Selected Media Files",
            "upscale_batch_step2_title": "Batch Enhancement Settings",
            "upscale_batch_desc": "Processing multiple media files sequentially",
            "status_queued": "Queued",
            "interp_input_label": "Input",
            "interp_output_label": "Output",
            "interp_multiplier_title": "FPS Multiplier",
            "interp_original_label": "Original",
            "interp_interpolated_label": "Interpolated",
            "upscale_checking_ai": "AI Engine: Checking...",
            "upscale_checking_gpu": "GPU Canvas: Checking...",
            "upscale_checking_ffmpeg": "FFmpeg WASM: Checking...",
            "upscale_ready_ai": "AI Engine: Ready",
            "upscale_ready_gpu": "GPU Canvas: Ready",
            "upscale_ready_ffmpeg": "FFmpeg WASM: Ready",
            "upscale_failed_ai": "AI Engine: Timeout/Failed",
            "upscale_failed_gpu": "GPU Canvas: Unavailable",
            "upscale_failed_ffmpeg": "FFmpeg WASM: Unavailable",
            "interp_checking_gpu": "WebGPU: Checking...",
            "interp_ready_gpu": "WebGPU: Available",
            "preset_category_all": "All",
            "preset_choose_version": "Choose Version",
            "preset_select_software": "Select the software you want to download for:",
            "preset_choose_variant": "Choose Variant",
            "preset_select_variant": "Select the variant you want to download:",
            "preset_am_premium": "Alight Motion Premium",
            "preset_am_5mb": "Alight Motion 5MB",
            "preset_xml": "XML",
            "preset_additional_files": "Additional Files:",
            "preset_required_plugins": "Required Plugins:",
            "preset_download_btn": "Download Preset",
            "preset_download_xml_downloading": "Downloading XML...",
            "preset_thumbnail_unavailable": "Thumbnail Unavailable",
            "preset_video_unavailable": "Video Unavailable",
            "tktk_analysis_subtitle": "Analyzing your video before direct patch",
            "tktk_label_fps": "Frame Rate",
            "tktk_label_res": "Resolution",
            "tktk_label_size": "File Size",
            "tktk_val_analyzing": "Analyzing...",
            "tktk_ready_to_process": "Ready to Process", 
            "upload_guide_title": "HD Upload Guide",
            "upload_guide_body": "<div class=\"ug-steps\"><div class=\"ug-step\"><div class=\"ug-badge\"><span class=\"material-symbols-rounded\">language</span></div><div class=\"ug-body\"><div class=\"ug-title\">Open TikTok Studio</div><div class=\"ug-desc\">Go to <a class=\"ug-link\" href=\"https://www.tiktok.com/tiktokstudio/upload\" target=\"_blank\" rel=\"noopener\">tiktok.com/tiktokstudio/upload</a></div></div></div><div class=\"ug-step\"><div class=\"ug-badge\"><span class=\"material-symbols-rounded\">qr_code_scanner</span></div><div class=\"ug-body\"><div class=\"ug-title\">Login Account</div><div class=\"ug-desc\">Login with your account. <strong>QR code</strong> login is recommended.</div></div></div><div class=\"ug-step\"><div class=\"ug-badge\"><span class=\"material-symbols-rounded\">upload_file</span></div><div class=\"ug-body\"><div class=\"ug-title\">Upload Video</div><div class=\"ug-desc\">Upload the patched video <span class=\"ug-file\">{filename}</span>. Add a caption and tag <strong>@cutefishaep</strong> (optional). Do <strong>not</strong> edit or add sound after patching. Selecting a cover is fine.</div></div></div><div class=\"ug-step ug-step-done\"><div class=\"ug-badge ug-badge-done\"><span class=\"material-symbols-rounded\">check_circle</span></div><div class=\"ug-body\"><div class=\"ug-title\">Done</div><div class=\"ug-desc\">Your video will be uploaded in HD quality.</div></div></div></div>",
            "upload_guide_close": "Close",
            "upload_guide_upload": "Upload",

            "footer_rights": "All Rights Reserved.",
            "footer_build_date": "Build code:",
            "footer_privacy": "Privacy Policy",
            "footer_terms": "Terms of Service",
            "footer_disclaimer": "Disclaimer & DMCA",
            "legal_privacy_title": "Privacy Policy",
            "legal_terms_title": "Terms of Service",
            "legal_disclaimer_title": "Disclaimer & DMCA",
            "legal_privacy_content": "<p><strong>Last Updated: August 22, 2026</strong></p><p>This Privacy Policy outlines how cutefishaep (cutefish.my.id) handles information when you use our services.</p><h4>1. Client-Side Data Processing</h4><p>Most media processing tools (including Video Compressor, Audio Extractor, Image Sequence, 5MB XML, AE&#8594;AM Converter, TikTok Patcher, Qualitelio Enhancer, Video Interpolation, and Remove Background) operate entirely within the user's browser via <a href='https://ffmpegwasm.netlify.app/' target='_blank' rel='noopener'>FFmpeg.wasm</a>, <a href='https://onnxruntime.ai/' target='_blank' rel='noopener'>ONNX Runtime Web</a>, and WebGL. Media files processed by these tools are not transmitted to our servers. Server communication is limited to API requests on Vercel, such as anonymous preset like interactions, URL resolution assistance, and basic usage analytics.</p><h4>2. Information Collected</h4><p>cutefishaep only collects minimal technical information required for operations: (a) anonymous IP addresses to prevent duplicate preset interactions; (b) aggregate usage statistics via <a href='https://vercel.com/docs/analytics' target='_blank' rel='noopener'>Vercel Analytics</a> regarding visitor volume and regional distribution; and (c) local storage (<code>localStorage</code> and <code>Cache API</code>) on the user device to persist interface settings, language choice, and offline module caches. cutefishaep does not use third-party tracking cookies for advertising.</p><h4>3. Third-Party Services</h4><p>Certain libraries and assets are loaded via reputable content delivery networks (CDNs): <a href='https://www.jsdelivr.com/' target='_blank' rel='noopener'>jsdelivr.net</a> for FFmpeg and ONNX runtime libraries, <a href='https://fonts.google.com/' target='_blank' rel='noopener'>fonts.googleapis.com</a> for typography, and <a href='https://huggingface.co/' target='_blank' rel='noopener'>huggingface.co</a> for processing models. Interaction with these CDNs is subject to their respective privacy terms.</p><h4>4. Contact</h4><p>For questions concerning this privacy policy, please contact: <a href='mailto:cutefishaep@gmail.com'>cutefishaep@gmail.com</a>.</p>",
            "legal_terms_content": "<p><strong>Last Updated: August 22, 2026</strong></p><p>By accessing and using cutefishaep (cutefish.my.id), you acknowledge that you have read, understood, and agree to these Terms of Service.</p><h4>1. Service Description</h4><p>cutefishaep provides curated creator resources, video presets, and browser-based media utility tools. The service operates independently.</p><h4>2. Limitation of Liability</h4><p>All utilities and materials are provided on an &quot;as is&quot; basis without warranties of any kind. cutefishaep is not liable for file corruption, data loss, or technical errors occurring during local browser processing. Users are encouraged to maintain independent backups of their original files.</p><h4>3. Acceptable Use</h4><p>Users agree to use the service responsibly and must not: (a) attempt to disrupt server stability or performance; (b) perform unauthorized automated scraping; (c) process or distribute harmful software.</p><h4>4. TikTok Patcher Tool Terms</h4><p>The <strong>TikTok Quality Patcher</strong> tool is provided for local technical experimentation and media optimization. Users are responsible for ensuring that their files and usage comply with the <a href='https://www.tiktok.com/legal/page/global/terms-of-service/en' target='_blank' rel='noopener'>TikTok Terms of Service</a> and applicable platform guidelines. cutefishaep is not affiliated with or endorsed by TikTok or ByteDance Ltd.</p><h4>5. Changes to Terms</h4><p>These terms may be updated periodically. Updates take effect immediately upon the revised date stated above.</p><h4>6. Contact</h4><p>Inquiries regarding these terms may be sent to: <a href='mailto:cutefishaep@gmail.com'>cutefishaep@gmail.com</a>.</p>",
            "legal_disclaimer_content": "<p><strong>Last Updated: August 22, 2026</strong></p><h4>1. Third-Party Resources &amp; Links</h4><p>Presets, software references, and plugins on cutefishaep are provided for educational and creative inspiration. External links point to third-party services outside our direct control, and cutefishaep is not responsible for their content or availability. Copyrighted resources remain hosted by their respective source providers.</p><h4>2. Open Source Acknowledgments</h4><p>cutefishaep utilizes open-source components and software libraries. We gratefully acknowledge the following projects and their communities:</p><ul><li><strong>FFmpeg</strong> (LGPL 2.1) - <a href='https://ffmpeg.org' target='_blank' rel='noopener'>ffmpeg.org</a> · <a href='https://github.com/ffmpegwasm/ffmpeg.wasm' target='_blank' rel='noopener'>github.com/ffmpegwasm</a></li><li><strong>ONNX Runtime Web</strong> (MIT) - <a href='https://onnxruntime.ai' target='_blank' rel='noopener'>onnxruntime.ai</a> · <a href='https://github.com/microsoft/onnxruntime' target='_blank' rel='noopener'>github.com/microsoft/onnxruntime</a></li><li><strong>MediaPipe Selfie Segmentation</strong> (Apache 2.0) - <a href='https://github.com/google-ai-edge/mediapipe' target='_blank' rel='noopener'>github.com/google-ai-edge/mediapipe</a></li><li><strong>Robust Video Matting (RVM)</strong> (MIT) - <a href='https://github.com/PeterL1n/RobustVideoMatting' target='_blank' rel='noopener'>github.com/PeterL1n/RobustVideoMatting</a></li><li><strong>MODNet</strong> (MIT) - <a href='https://github.com/ZHKKKe/MODNet' target='_blank' rel='noopener'>github.com/ZHKKKe/MODNet</a></li><li><strong>RIFE v4.7</strong> (MIT) - <a href='https://github.com/hzwer/ECCV2022-RIFE' target='_blank' rel='noopener'>github.com/hzwer/ECCV2022-RIFE</a></li><li><strong>Real-ESRGAN</strong> (BSD 3-Clause) - <a href='https://github.com/xinntao/Real-ESRGAN' target='_blank' rel='noopener'>github.com/xinntao/Real-ESRGAN</a></li><li><strong>JSZip</strong> (MIT) - <a href='https://stuk.github.io/jszip/' target='_blank' rel='noopener'>stuk.github.io/jszip</a></li><li><strong>Material Symbols</strong> &amp; <strong>Bootstrap Icons</strong> - <a href='https://fonts.google.com/icons' target='_blank' rel='noopener'>Google Icons</a> · <a href='https://icons.getbootstrap.com' target='_blank' rel='noopener'>Bootstrap Icons</a></li><li><strong>Typography</strong>: Unbounded, Outfit, Plus Jakarta Sans (OFL 1.1) - <a href='https://fonts.google.com' target='_blank' rel='noopener'>Google Fonts</a></li></ul><h4>3. Third-Party Integrations</h4><p>Public data fetching and resolution assistance utilize publicly accessible endpoints and <a href='https://tikwm.com' target='_blank' rel='noopener'>TikWM</a>. Database operations and analytics run server-side on Vercel without exposing backend credentials to client applications.</p><h4>4. DMCA Notice Procedure</h4><p>cutefishaep respects intellectual property rights pursuant to the <a href='https://www.copyright.gov/dmca/' target='_blank' rel='noopener'>Digital Millennium Copyright Act (DMCA)</a>. If you are a copyright owner and believe that material on this website infringes upon your copyright, please submit a written notification with proof of ownership to <a href='mailto:cutefishaep@gmail.com'>cutefishaep@gmail.com</a> for prompt review.</p>"
        }
    };
    let userLang = 'en';
    const matchesPrimaryLang = navigator.language && navigator.language.startsWith('id');
    const hasIndonesianLang = navigator.languages && navigator.languages.some(lang => lang.toLowerCase().startsWith('id'));
    if (matchesPrimaryLang || hasIndonesianLang) {
        userLang = 'id';
    }
    window.getTranslation = function(key) {
        return (translations[userLang] && translations[userLang][key]) || translations['en'][key] || key;
    };
    window.translateUI = function() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = window.getTranslation(key);
            if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
                el.setAttribute('placeholder', translation);
            } else if (el.tagName === 'OPTION') {
                el.text = translation;
            } else {
                let hasIcon = false;
                el.childNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('material-symbols-rounded')) {
                        hasIcon = true;
                    }
                });
                if (hasIcon) {
                    el.childNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                            node.nodeValue = translation;
                        }
                    });
                } else {
                    el.textContent = translation;
                }
            }
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const translation = window.getTranslation(key);
            el.innerHTML = translation;
        });
        if (typeof window.renderFooterBuildDate === 'function') {
            window.renderFooterBuildDate(window.cachedBuildData);
        }
    };
    document.addEventListener('DOMContentLoaded', () => {
        window.translateUI();
    });
})();
