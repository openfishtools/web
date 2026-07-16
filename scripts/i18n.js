(function() {
    const translations = {
        id: {
            // General Tabs & Navigation
            "nav_social": "Sosial",
            "nav_preset": "Preset",
            "nav_resource": "Resource",
            "nav_video_patcher": "Video Patcher",
            "nav_tools": "Alat & Fitur",
            "nav_about": "Hubungi Kami",
            
            // Video Patcher Section
            "patcher_subtitle": "TikTok HQ Upload",
            "patcher_drop_label": "Drag & drop video di sini atau klik untuk memilih",
            "patcher_ver_title": "Pilih Versi TikTok:",
            "patcher_variant_title": "Alight Motion Download Variant (Opsional):",
            "patcher_variant_none": "Tidak Ada",
            "patcher_variant_5mb": "5MB Premium",
            "patcher_variant_xml": "5MB Free XML",
            "patcher_variant_preset": "Premium (Full Preset)",
            "patcher_btn_process": "Proses Video",
            
            // Tools Section
            "tool_compressor_title": "Video Compressor",
            "tool_compressor_desc": "Kompres video ke ukuran tertentu",
            "tool_compressor_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_compressor_size": "Target Ukuran File (MB)",
            "tool_compressor_btn": "Mulai Kompresi",

            "tool_audio_extractor_title": "Audio Extractor",
            "tool_audio_extractor_desc": "Ekstrak audio dari video ke MP3",
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
            "tool_upscale_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_upscale_scale": "Faktor Skala",
            "tool_upscale_btn": "Mulai Proses",

            "tool_interp_title": "Video Interpolation",
            "tool_interp_desc": "FPS Upscaler",
            "tool_interp_drop": "Drag & drop video di sini atau klik untuk memilih",
            "tool_interp_factor": "Faktor Interpolasi (2x = Double FPS)",
            "tool_interp_btn": "Mulai Interpolasi",

            // Statuses and messages
            "status_selected": "Dipilih: ",
            "status_completed": "Proses Selesai!",
            "status_processing": "Memproses...",
            "status_error": "Terjadi kesalahan: ",
            "status_cleanup": "Membersihkan memory cache...",
            
            // iOS Warning
            "ios_warn_title": "Pemberitahuan Kompatibilitas iOS",
            "ios_warn_desc": "<p>Metode V2 ini mungkin tidak dapat berjalan atau terunggah dengan sempurna pada perangkat iOS, iPadOS, dan VisionOS. Kamu mungkin akan menemui error saat mencoba mengunggah video yang sudah diproses melalui TikTok Studio.</p><p>Untuk hasil terbaik, kami merekomendasikan penggunaan <strong>macOS, Windows, atau Android</strong> dengan browser desktop seperti <strong>Chrome, Firefox, atau Edge</strong> (tidak termasuk Safari).</p><p>Atau, gunakan <strong>Metode V1</strong> yang sudah stabil di semua perangkat.</p>",
            "ios_warn_cancel": "Batal",
            "ios_warn_proceed": "Lanjutkan Saja",

            // General Status Labels
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


            // Section Titles
            "social_title": "Link Saya",
            "preset_title": "Jelajahi",
            "resource_title": "Resource",
            "resource_search_placeholder": "Cari resource...",
            "tools_title": "Alat",
            "contact_title": "Hubungi Kami",

            // Patcher Overlay
            "patcher_overlay_title": "Metode Ter-patch",
            "patcher_overlay_desc": "Metode V1 dan V2 saat ini tidak tersedia.",
            "patcher_overlay_ignore": "Abaikan",

            // Patcher Compression Switcher
            "patcher_compress_title": "Preset Kompresi",
            "patcher_mode_off": "Mati",
            "patcher_mode_compatibility": "Kompatibilitas",
            "patcher_mode_quality": "Kualitas",
            "patcher_mode_off_desc": "Patch Langsung | Mem-patch video asli secara langsung tanpa kompresi. Mempertahankan kualitas asli, tetapi mungkin menyebabkan lag atau kegagalan pemutaran pada perangkat yang tidak mendukung resolusi/framerate tersebut.",
            "patcher_mode_fast_desc": "720p, 60fps | H.264 VBR 16 Mbps (10M-22M), preset veryslow | Mengompresi video ke 720p untuk kualitas maksimal dan kepatuhan. Berjalan lancar tanpa lag di semua perangkat.",
            "patcher_mode_hd_desc": "1080p, 60fps | H.264 VBR 19 Mbps (12M-26M), preset veryslow | Mengompresi video ke 1080p untuk mempertahankan kualitas premium dan ketajaman. Mungkin menyebabkan lag atau tersendat pada beberapa perangkat.",

            // Ffmpeg presets
            "preset_slow": "Lambat",
            "preset_medium": "Sedang",
            "preset_fast": "Cepat",

            // Ffmpeg preset descriptions
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

            // Stats items
            "stats_resolution": "Resolusi",
            "stats_fps": "Frame Rate (FPS)",
            "stats_bitrate": "Bitrate",
            "stats_duration": "Durasi",
            "stats_size": "Ukuran File",

            // General UI Buttons
            "btn_copy": "Salin",
            "btn_copied": "Tersalin!",
            "btn_preview": "Pratinjau",
            "btn_cancel": "Batal",
            "btn_upscale_another": "Tingkatkan File Lain",
            "btn_interp_another": "Interpolasi File Lain",

            // System checking title
            "system_checking_title": "Memeriksa Kompatibilitas Sistem...",

            // Process Logs Title
            "process_logs_title": "Log Proses:",

            // Qualitelio Enhancer Preset / Timing Panels
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

            // Video Interpolation Panel
            "interp_input_label": "Input",
            "interp_output_label": "Output",
            "interp_multiplier_title": "FPS Multiplier",
            "interp_original_label": "Asli",
            "interp_interpolated_label": "Interpolasi",

            // Dynamic Compatibility Check Strings
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
            "interp_ready_gpu": "WebGPU: Didukung",
            "interp_failed_gpu": "WebGPU: Tidak Didukung (Eksekusi Diblokir)",

            "preset_category_all": "Semua"
        },
        en: {
            // General Tabs & Navigation
            "nav_social": "Social",
            "nav_preset": "Preset",
            "nav_resource": "Resource",
            "nav_video_patcher": "Video Patcher",
            "nav_tools": "Tools & Features",
            "nav_about": "Contact Us",
            
            // Video Patcher Section
            "patcher_subtitle": "TikTok HQ Upload",
            "patcher_drop_label": "Drag & drop video here or click to select",
            "patcher_ver_title": "Select TikTok Version:",
            "patcher_variant_title": "AM Download Variant (Optional):",
            "patcher_variant_none": "None",
            "patcher_variant_5mb": "5MB Premium",
            "patcher_variant_xml": "5MB Free XML",
            "patcher_variant_preset": "Premium (Full Preset)",
            "patcher_btn_process": "Process Video",
            
            // Tools Section
            "tool_compressor_title": "Video Compressor",
            "tool_compressor_desc": "Compress video to custom sizes",
            "tool_compressor_drop": "Drag & drop video here or click to select",
            "tool_compressor_size": "Target File Size (MB)",
            "tool_compressor_btn": "Start Compression",

            "tool_audio_extractor_title": "Audio Extractor",
            "tool_audio_extractor_desc": "Extract audio from video to MP3",
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
            "tool_upscale_drop": "Drag & drop video here or click to select",
            "tool_upscale_scale": "Scale Factor",
            "tool_upscale_btn": "Start Processing",

            "tool_interp_title": "Video Interpolation",
            "tool_interp_desc": "FPS Upscaler",
            "tool_interp_drop": "Drag & drop video here or click to select",
            "tool_interp_factor": "Interpolation Factor (2x = Double FPS)",
            "tool_interp_btn": "Start Interpolation",

            // Statuses and messages
            "status_selected": "Selected: ",
            "status_completed": "Completed!",
            "status_processing": "Processing...",
            "status_error": "An error occurred: ",
            "status_cleanup": "Cleaning up memory cache...",

            // iOS Warning
            "ios_warn_title": "iOS Compatibility Warning",
            "ios_warn_desc": "<p>This V2 method may not run or upload perfectly on iOS, iPadOS, and VisionOS devices. You may encounter errors when attempting to upload the patched video via TikTok Studio.</p><p>For the best experience, we recommend performing the upload on <strong>macOS, Windows, or Android</strong> using desktop browsers like <strong>Chrome, Firefox, or Edge</strong> (excluding Safari).</p><p>Alternatively, please use the <strong>V1 method</strong> which has been fully stabilized across all devices.</p>",
            "ios_warn_cancel": "Cancel",
            "ios_warn_proceed": "Proceed Anyway",

            // General Status Labels
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


            // Section Titles
            "social_title": "My Links",
            "preset_title": "Explore",
            "resource_title": "Resources",
            "resource_search_placeholder": "Search resources...",
            "tools_title": "Tools",
            "contact_title": "Contact Us",

            // Patcher Overlay
            "patcher_overlay_title": "Method Patched",
            "patcher_overlay_desc": "Both V1 and V2 are currently unavailable.",
            "patcher_overlay_ignore": "Ignore",

            // Patcher Compression Switcher
            "patcher_compress_title": "Compress preset",
            "patcher_mode_off": "OFF",
            "patcher_mode_compatibility": "Compatibility",
            "patcher_mode_quality": "Quality",
            "patcher_mode_off_desc": "Direct patch | Patches the original video directly without compression. Keeps original quality, but might cause lag or playback failures on devices that do not support the resolution/framerate.",
            "patcher_mode_fast_desc": "720p, 60fps | H.264 VBR 16 Mbps (10M-22M), preset veryslow | Compresses video to 720p for optimal quality and compliance. Runs smoothly without lag on all devices.",
            "patcher_mode_hd_desc": "1080p, 60fps | H.264 VBR 19 Mbps (12M-26M), preset veryslow | Compresses video to 1080p to preserve premium quality and sharpness. Might cause lag or playback stutters on some devices.",

            // Ffmpeg presets
            "preset_slow": "Slow",
            "preset_medium": "Medium",
            "preset_fast": "Fast",

            // Ffmpeg preset descriptions
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

            // Stats items
            "stats_resolution": "Resolution",
            "stats_fps": "Frame Rate (FPS)",
            "stats_bitrate": "Bitrate",
            "stats_duration": "Duration",
            "stats_size": "File Size",

            // General UI Buttons
            "btn_copy": "Copy",
            "btn_copied": "Copied!",
            "btn_preview": "Preview",
            "btn_cancel": "Cancel",
            "btn_upscale_another": "Upscale Another",
            "btn_interp_another": "Interpolate Another",

            // System checking title
            "system_checking_title": "Checking System Compatibility...",

            // Process Logs Title
            "process_logs_title": "Process Logs:",

            // Qualitelio Enhancer Preset / Timing Panels
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

            // Video Interpolation Panel
            "interp_input_label": "Input",
            "interp_output_label": "Output",
            "interp_multiplier_title": "FPS Multiplier",
            "interp_original_label": "Original",
            "interp_interpolated_label": "Interpolated",

            // Dynamic Compatibility Check Strings
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
            "interp_ready_gpu": "WebGPU: Supported",
            "interp_failed_gpu": "WebGPU: Not Supported (Execution Blocked)",

            "preset_category_all": "All"
        }
    };

    let userLang = 'en';
    
    // Check primary browser language only — do NOT use timezone as a fallback
    // so users with English browser language always get English
    const matchesPrimaryLang = navigator.language && navigator.language.startsWith('id');
    // Check secondary browser languages
    const hasIndonesianLang = navigator.languages && navigator.languages.some(lang => lang.toLowerCase().startsWith('id'));

    if (matchesPrimaryLang || hasIndonesianLang) {
        userLang = 'id';
    }

    window.getTranslation = function(key) {
        return (translations[userLang] && translations[userLang][key]) || translations['en'][key] || key;
    };

    window.translateUI = function() {
        // Handle standard text translation
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

        // Handle HTML translation (preserves inner tags like <p>, <strong>, etc.)
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const translation = window.getTranslation(key);
            el.innerHTML = translation;
        });
    };

    // Auto-run on load
    document.addEventListener('DOMContentLoaded', () => {
        window.translateUI();
    });
})();
