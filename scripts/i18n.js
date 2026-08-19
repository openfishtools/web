(function() {
    const translations = {
        id: {
            "nav_social": "Sosial",
            "nav_preset": "Preset",
            "nav_resource": "Berkas",
            "nav_video_patcher": "Video Patcher",
            "nav_tools": "Alat",
            "nav_about": "Hubungi Kami",
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
            "tool_rembg_btn_process": "Proses Media",
            "tool_rembg_btn_another": "Proses Media Lain",
            "status_selected": "Dipilih: ",
            "status_completed": "Proses Selesai!",
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
            "patcher_overlay_desc": "Metode WMV saat ini tidak tersedia. Silakan gunakan metode BINARY atau FPS.",
            "patcher_overlay_ignore": "Abaikan",
            "patcher_method_wmv": "WMV",
            "patcher_method_binary": "BINARY",
            "patcher_method_fps": "FPS",
            "patcher_compress_title": "Compress",
            "patcher_mode_off": "OFF",
            "patcher_mode_720p": "720P",
            "patcher_mode_1080p": "1080P",
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
            "stats_resolution": "Resolusi",
            "stats_fps": "Frame Rate (FPS)",
            "stats_bitrate": "Bitrate",
            "stats_duration": "Durasi",
            "stats_size": "Ukuran File",
            "stats_method": "Method",
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
            "upscale_normalise_desc": "Potong tengah ke 1080×1920 · Simpan sebagai JPG",
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
            "interp_failed_gpu": "WebGPU: Tidak Tersedia",
            "preset_category_all": "Semua",
            "tktk_analysis_title": "Pemeriksaan Kompatibilitas Video",
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
            "legal_terms_title": "Syarat & Ketentuan",
            "legal_disclaimer_title": "Penafian & DMCA",
            "legal_privacy_content": "<p><strong>Terakhir diperbarui: 30 Juli 2026</strong></p><p>Selamat datang di <strong>cutefishaep</strong> (cutefish.my.id). Kami sangat menghargai privasi Anda dan berkomitmen untuk melindungi data pribadi Anda.</p><h4>1. Pemrosesan Berkas Lokal (Client-Side Privacy)</h4><p>Seluruh alat bantu pengolahan video, audio, dan gambar (seperti Video Compressor, Audio Extractor, AI Upscaler, Video Interpolation, dan TikTok Patcher) beroperasi <strong>100% secara lokal di browser perangkat Anda</strong> menggunakan teknologi WebAssembly (WASM) dan WebGPU. Berkas media Anda <strong>TIDAK PERNAH diunggah</strong> ke server kami atau pihak ketiga mana pun.</p><h4>2. Pengumpulan Data Anonim & Log</h4><p>Kami hanya mengumpulkan data teknis anonim seperti alamat IP (digunakan secara terbatas untuk menghitung tombol 'Suka' pada preset) serta data analitik penggunaan standar melalui Vercel Analytics.</p><h4>3. Google AdSense & Cookie DART</h4><p>cutefishaep menggunakan layanan iklan pihak ketiga seperti <strong>Google AdSense</strong>. Google dapat menggunakan cookie (termasuk Cookie DART) untuk menyajikan iklan berdasarkan kunjungan Anda ke situs ini dan situs web lainnya di internet. Anda dapat memilih untuk menolak penggunaan Cookie DART dengan mengunjungi Kebijakan Privasi Jaringan Iklan dan Konten Google di <a href=\"https://policies.google.com/technologies/ads\" target=\"_blank\" rel=\"noopener\">https://policies.google.com/technologies/ads</a>.</p><h4>4. Kontak Privasi</h4><p>Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini, silakan hubungi kami di <a href=\"mailto:cutefishaep@gmail.com\">cutefishaep@gmail.com</a>.</p>",
            "legal_terms_content": "<p><strong>Terakhir diperbarui: 30 Juli 2026</strong></p><p>Dengan mengakses dan menggunakan <strong>cutefishaep</strong>, Anda menyetujui Syarat dan Ketentuan berikut:</p><h4>1. Penggunaan Layanan</h4><p>cutefishaep menyediakan tautan sumber daya, preset video, serta alat pemrosesan media berbasis browser secara gratis untuk mendukung alur kerja para pembuat konten dan editor video.</p><h4>2. Batasan Tanggung Jawab</h4><p>Semua alat dan fitur disediakan 'sebagaimana adanya' (AS IS) tanpa jaminan apa pun. Kami tidak bertanggung jawab atas kerusakan berkas atau kehilangan data yang mungkin terjadi selama penggunaan alat pemrosesan browser.</p><h4>3. Perilaku Pengguna</h4><p>Anda setuju untuk tidak menyalahgunakan alat atau infrastruktur kami, tidak melakukan upaya scraping ilegal, atau mengunggah berkas yang mengandung perangkat lunak berbahaya.</p><h4>4. Kontak</h4><p>Pertanyaan mengenai syarat penggunaan ini dapat dikirimkan ke <a href=\"mailto:cutefishaep@gmail.com\">cutefishaep@gmail.com</a>.</p>",
            "legal_disclaimer_content": "<p><strong>Terakhir diperbarui: 30 Juli 2026</strong></p><h4>1. Penafian Sumber Daya & Tautan Pihak Ketiga</h4><p>Semua berkas preset, perangkat lunak, dan plugin yang dibagikan di cutefishaep ditujukan semata-mata untuk tujuan pembelajaran, edukasi, dan inspirasi kreatif. Tautan pihak ketiga yang ada di platform ini berada di luar kendali langsung cutefishaep.</p><h4>2. Kebijakan Hak Cipta & DMCA</h4><p>cutefishaep menghormati hak kekayaan intelektual orang lain. Jika Anda adalah pemilik sah atas suatu karya/preset/sumber daya yang ada di situs ini dan berkeberatan atas penayangannya, silakan kirimkan permohonan penurunan (DMCA Take-Down) ke email kami di <a href=\"mailto:cutefishaep@gmail.com\">cutefishaep@gmail.com</a> dengan melampirkan bukti kepemilikan. Kami akan merespons dan menindaklanjuti permohonan Anda dalam waktu 1x24 jam.</p>"
        },
        en: {
            "nav_social": "Social",
            "nav_preset": "Preset",
            "nav_resource": "Resource",
            "nav_video_patcher": "Video Patcher",
            "nav_tools": "Tools",
            "nav_about": "Contact Us",
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
            "tool_rembg_btn_process": "Process Media",
            "tool_rembg_btn_another": "Process Another Media",
            "status_selected": "Selected: ",
            "status_completed": "Completed!",
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
            "patcher_overlay_desc": "WMV method is currently unavailable. Please use BINARY or FPS method.",
            "patcher_overlay_ignore": "Ignore",
            "patcher_method_wmv": "WMV",
            "patcher_method_binary": "BINARY",
            "patcher_method_fps": "FPS",
            "patcher_compress_title": "Compress",
            "patcher_mode_off": "OFF",
            "patcher_mode_720p": "720P",
            "patcher_mode_1080p": "1080P",
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
            "stats_resolution": "Resolution",
            "stats_fps": "Frame Rate (FPS)",
            "stats_bitrate": "Bitrate",
            "stats_duration": "Duration",
            "stats_size": "File Size",
            "stats_method": "Method",
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
            "upscale_normalise_desc": "Crop center to 1080×1920 · Save as JPG",
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
            "interp_failed_gpu": "WebGPU: Unavailable",
            "preset_category_all": "All",
            "tktk_analysis_title": "Video Compatibility Check",
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
            "legal_privacy_content": "<p><strong>Last Updated: July 30, 2026</strong></p><p>Welcome to <strong>cutefishaep</strong> (cutefish.my.id). We respect your privacy and are committed to protecting your personal data.</p><h4>1. Client-Side File Processing</h4><p>All video, audio, and image processing tools (including Video Compressor, Audio Extractor, AI Upscaler, Video Interpolation, and TikTok Patcher) operate <strong>100% locally within your browser</strong> using WebAssembly (WASM) and WebGPU technologies. Your media files are <strong>NEVER uploaded</strong> to our servers or any third parties.</p><h4>2. Anonymous Data & Analytics</h4><p>We only collect limited technical data such as IP addresses (used exclusively for counting 'Likes' on presets) and standard usage analytics via Vercel Analytics.</p><h4>3. Google AdSense & DART Cookies</h4><p>cutefishaep uses third-party advertising services such as <strong>Google AdSense</strong>. Google may use cookies (including DART cookies) to serve ads based on your visits to this and other websites on the internet. You may opt out of the use of DART cookies by visiting the Google Ad and Content Network Privacy Policy at <a href=\"https://policies.google.com/technologies/ads\" target=\"_blank\" rel=\"noopener\">https://policies.google.com/technologies/ads</a>.</p><h4>4. Privacy Contact</h4><p>If you have any questions regarding this Privacy Policy, please contact us at <a href=\"mailto:cutefishaep@gmail.com\">cutefishaep@gmail.com</a>.</p>",
            "legal_terms_content": "<p><strong>Last Updated: July 30, 2026</strong></p><p>By accessing and using <strong>cutefishaep</strong>, you agree to the following Terms of Service:</p><h4>1. Use of Services</h4><p>cutefishaep provides resource links, video presets, and browser-based media processing tools free of charge to support content creators and video editors.</p><h4>2. Limitation of Liability</h4><p>All tools and features are provided 'AS IS' without warranties of any kind. We are not liable for file corruption or data loss that may occur during browser tool execution.</p><h4>3. User Conduct</h4><p>You agree not to misuse our tools or infrastructure, attempt unauthorized scraping, or upload files containing malicious software.</p><h4>4. Contact</h4><p>Inquiries regarding these terms should be sent to <a href=\"mailto:cutefishaep@gmail.com\">cutefishaep@gmail.com</a>.</p>",
            "legal_disclaimer_content": "<p><strong>Last Updated: July 30, 2026</strong></p><h4>1. Third-Party Resources Disclaimer</h4><p>All preset files, software links, and plugins shared on cutefishaep are provided solely for educational, learning, and creative inspiration purposes. Third-party links are outside cutefishaep's direct control.</p><h4>2. Copyright & DMCA Policy</h4><p>cutefishaep respects the intellectual property rights of others. If you are the copyright owner of any material listed on this site and wish to request removal, please submit a formal DMCA Take-Down notice to <a href=\"mailto:cutefishaep@gmail.com\">cutefishaep@gmail.com</a> with proof of ownership. We will process and act upon your request within 24 hours.</p>"
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
