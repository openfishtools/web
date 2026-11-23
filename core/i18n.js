(function () {
  "use strict";

  var STORAGE_KEY = "cutefish_lang";

  function detectLang() {
    try {
      var params = new URLSearchParams(window.location.search);
      var qp = (params.get("lang") || "").toLowerCase();
      if (qp === "id" || qp === "en") return qp;
    } catch (_) {}

    try {
      var saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
      if (saved === "id" || saved === "en") return saved;
    } catch (_) {}

    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || "en"];

    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || "").toLowerCase();
      if (code === "id" || code.indexOf("id-") === 0) return "id";
      if (code === "en" || code.indexOf("en-") === 0) return "en";
    }
    return "en";
  }

  var activeLang = detectLang();
  document.documentElement.lang = activeLang;

  var ID_TO_EN = {
    "Kumpulan preset editing After Effects & Alight Motion": "After Effects & Alight Motion editing presets",
    "Untuk mengkompres ukuran video": "Compress video file size",
    "Untuk memperjelas & upscale video AI": "Enhance & AI upscale videos",
    "Untuk mengunduh video & audio TikTok": "Download TikTok videos & audio",
    "Untuk mengecek metrik & detail video TikTok": "Inspect TikTok video metrics & details",
    "Untuk mengoptimalkan kualitas upload TikTok": "Optimize TikTok upload quality",
    "Untuk menghapus atau mengganti latar foto & video": "Remove or replace photo & video backgrounds",
    "Untuk mengekstrak audio dari file video": "Extract audio from video files",
    "Untuk menggandakan FPS video lebih halus": "Smoothly multiply video frame rate",
    "Untuk menggabungkan ZIP gambar menjadi video": "Combine an image ZIP sequence into video",
    "Untuk konversi beat After Effects ke Alight Motion": "Convert After Effects beats to Alight Motion",
    "Untuk mengganti media proyek XML Alight Motion": "Replace media inside Alight Motion XML projects",
    "Pemutar video ala QuickTime untuk multi link & preset": "QuickTime-style video player for links & presets",
    "Klik untuk ganti WIB / WITA / WIT": "Click to switch WIB / WITA / WIT",
    "Pintasan Aplikasi": "App Shortcuts",
    "Jam Indonesia": "Indonesia Clock",
    "Geser ke kiri": "Swipe left",
    "Geser ke kanan": "Swipe right",
    "Putar ulang tutorial": "Replay tutorial",
    "Panduan Desktop": "Desktop Guide",
    "Lewati": "Skip",
    "Kembali": "Back",
    "Lanjut": "Next",
    "Selesai": "Done",
    "Menampilkan waktu saat ini. Klik bagian tanggal di bawah jam untuk mengganti zona waktu antara WIB, WITA, atau WIT.": "Shows the current time. Click the date below the clock to switch between WIB, WITA, or WIT.",
    "Galeri Preset": "Preset Gallery",
    "Klik ikon ini untuk membuka kumpulan preset editing After Effects dan Alight Motion.": "Click this icon to open the After Effects and Alight Motion editing presets.",
    "Folder Aplikasi": "App Folders",
    "Aplikasi lainnya dikelompokkan ke dalam folder di desktop agar layar tetap rapi.": "Other apps are grouped into desktop folders to keep the screen tidy.",
    "Isi Folder": "Folder Contents",
    "Saat folder dibuka, semua aplikasi di dalamnya tampil di sini. Pilih salah satu untuk langsung menjalankannya.": "When a folder is opened, all apps inside appear here. Pick any app to launch it.",
    "Apps Dock": "Apps Dock",
    "Gunakan dock di bagian bawah untuk membuka aplikasi dengan cepat atau berpindah antar jendela yang sedang aktif.": "Use the bottom dock to quickly open apps or switch between active windows.",
    "Putar Ulang Panduan": "Replay Guide",
    "Jika ingin melihat panduan ini lagi kapan saja, cukup klik ikon tanda tanya di pojok kanan atas.": "If you want to view this guide again anytime, just click the question mark icon in the top right corner.",

    "Pilih atau seret video ke sini": "Select or drag a video here",
    "Pilih atau seret file video": "Select or drag a video file",
    "Pilih atau seret gambar / video": "Select or drag an image / video",
    "Pilih atau seret gambar atau video": "Select or drag an image or video",
    "Pilih atau seret video atau gambar": "Select or drag a video or image",
    "Pilih atau seret arsip ZIP frame": "Select or drag a frame ZIP archive",
    "Pilih atau seret arsip ZIP image sequence": "Select or drag an image sequence ZIP archive",
    "Pilih atau seret proyek After Effects": "Select or drag an After Effects project",
    "Pilih atau seret file proyek After Effects": "Select or drag an After Effects project file",
    "Pilih atau seret XML Alight Motion": "Select or drag an Alight Motion XML",
    "Pilih atau seret file XML Alight Motion": "Select or drag an Alight Motion XML file",
    "Mendukung MP4, MOV, WebM": "Supports MP4, MOV, WebM",
    "Mendukung MP4, MOV, WebM, MKV, AVI": "Supports MP4, MOV, WebM, MKV, AVI",
    "Mendukung MP4, WebM, MOV, HEVC": "Supports MP4, WebM, MOV, HEVC",
    "Mendukung PNG, JPG, WebP, BMP di dalam .zip": "Supports PNG, JPG, WebP, BMP inside .zip",
    "Mendukung PNG, JPG, WebP, MP4, MOV, WebM": "Supports PNG, JPG, WebP, MP4, MOV, WebM",
    "Mendukung After Effects XML (.xml, .aepx)": "Supports After Effects XML (.xml, .aepx)",
    "Mendukung proyek ekspor .xml": "Supports exported .xml projects",
    "Ganti": "Change",
    "Hapus": "Remove",
    "Simpan": "Save",
    "Tutup": "Close",
    "Putar": "Play",
    "Putar / Jeda": "Play / Pause",
    "Putar atau jeda": "Play or pause",
    "Semua": "All",
    "Pilih Semua": "Select All",
    "Awal": "Original",
    "Asli": "Original",
    "Hasil": "Output",
    "Hemat": "Saved",
    "Ukuran": "Size",
    "Durasi": "Duration",
    "Resolusi": "Resolution",
    "Lebar": "Width",
    "Tinggi": "Height",
    "Waktu": "Time",
    "Wilayah": "Region",
    "Versi": "Version",
    "Diperbarui": "Updated",
    "Status": "Status",
    "Metode": "Method",
    "Mode": "Mode",
    "Format": "Format",
    "Kompresi": "Compression",
    "Perangkat": "Device",
    "Perangkat Pemrosesan": "Processing Device",
    "Urutan Proses": "Processing Order",
    "Latar Belakang": "Background",
    "Transparan": "Transparent",
    "Warna Solid": "Solid Color",
    "Kode warna hex": "Hex color code",
    "Pilih warna latar": "Pick background color",
    "Standar": "Standard",
    "Diganti": "Replaced",
    "Belum diproses": "Not processed yet",
    "Memproses...": "Processing...",
    "Mengunduh...": "Downloading...",
    "Menganalisis video...": "Analyzing video...",
    "Proses Video": "Process Video",
    "Proses Ulang": "Process Again",
    "Coba Lagi": "Try Again",
    "Unduh Video": "Download Video",
    "Unduh": "Download",
    "Bagikan": "Share",
    "Komentar": "Comments",
    "Tanggal Unggah": "Upload Date",
    "Tautan Video TikTok": "TikTok Video Link",
    "Analisis Video": "Analyze Video",
    "Format Unduhan": "Download Format",
    "Format Output": "Output Format",
    "Format Audio": "Audio Format",
    "Format Alpha": "Alpha Format",
    "Bitrate Audio": "Audio Bitrate",
    "Codec Video": "Video Codec",
    "Ekstrak Audio": "Extract Audio",
    "Pertahankan Audio": "Keep Audio",
    "Audio (Opsional)": "Audio (Optional)",
    "Tambahkan audio / soundtrack": "Add audio / soundtrack",
    "Hapus audio": "Remove audio",
    "Hapus Background": "Remove Background",
    "Mulai Kompresi": "Start Compression",
    "Mulai Upscale": "Start Upscale",
    "Mulai Interpolasi": "Start Interpolation",
    "Konversi ke Video": "Convert to Video",
    "Konversi ke AM XML": "Convert to AM XML",
    "Buat XML 5MB": "Generate 5MB XML",
    "Judul Proyek": "Project Title",
    "Komposisi After Effects": "After Effects Composition",
    "Layer Media untuk Diganti": "Media Layers to Replace",
    "Filter Jenis Layer": "Layer Type Filter",
    "Filter Software": "Software Filter",
    "Preset Kompresi": "Compression Preset",
    "Preset Kompresi (HD)": "Compression Preset (HD)",
    "Preset Filter": "Filter Preset",
    "Pengali FPS": "FPS Multiplier",
    "FPS Asli": "Source FPS",
    "FPS Target": "Target FPS",
    "Normalisasi 9:16 (1080×1920)": "Normalize 9:16 (1080×1920)",
    "Memeriksa akselerasi WebGPU...": "Checking WebGPU acceleration...",
    "Tekan Preview untuk melihat hasil": "Press Preview to inspect the result",
    "Perbandingan sebelum dan sesudah": "Before and after comparison",
    "Posisi frame video": "Video frame position",
    "Posisi video": "Video position",

    "Cari preset, plugin, versi...": "Search presets, plugins, versions...",
    "Memuat galeri preset...": "Loading preset gallery...",
    "Tidak ada preset yang cocok.": "No matching presets found.",
    "UI pemilihan varian ini sudah deprecated dan tidak akan digunakan lagi ke depannya.": "This variant picker UI is deprecated and will not be used in future releases.",
    "Daftar Preset": "Preset List",
    "Tempel link video...": "Paste video link...",
    "-5 detik": "-5 seconds",
    "+5 detik": "+5 seconds",
    "Mundur 5 detik": "Rewind 5 seconds",
    "Maju 5 detik": "Forward 5 seconds",
    "Masukkan tautan video yang valid.": "Please enter a valid video link.",
    "Video gagal dimuat dari tautan tersebut.": "Failed to load video from that link.",
    "Gagal memuat video.": "Failed to load video.",
    "Gagal memuat galeri preset.": "Failed to load preset gallery.",

    "Mode TikTok Enhancer": "TikTok Enhancer Mode",
    "Metode Patch": "Patch Method",
    "Mode Kompresi": "Compression Mode",
    "FISH — 64-bit Duration Sentinel (Engine 5.0), lossless tanpa re-encode.": "FISH — 64-bit Duration Sentinel (Engine 5.0), lossless without re-encoding.",
    "FISH — 64-bit Duration Sentinel (Engine 5.0), mdat byte-identical tanpa re-encode.": "FISH — 64-bit Duration Sentinel (Engine 5.0), byte-identical mdat without re-encoding.",
    "FISH + 720p — Kompresi 720p hemat ukuran, dilanjutkan Duration Sentinel.": "FISH + 720p — Space-saving 720p compression, followed by Duration Sentinel.",
    "FISH + 1080p — Kompresi Full HD 1080p, dilanjutkan Duration Sentinel.": "FISH + 1080p — Full HD 1080p compression, followed by Duration Sentinel.",
    "FPS — Patch timescale 30 FPS (slow motion di lokal, mulus 60 FPS saat upload TikTok).": "FPS — 30 FPS timescale patch (slow motion locally, smooth 60 FPS on TikTok upload).",
    "FPS + 720p — Kompresi 720p lalu patch timescale untuk kelancaran 60 FPS.": "FPS + 720p — 720p compression followed by timescale patch for smooth 60 FPS.",
    "FPS + 1080p — Kompresi 1080p lalu patch timescale untuk kelancaran 60 FPS.": "FPS + 1080p — 1080p compression followed by timescale patch for smooth 60 FPS.",
    "MPEG-TS — Stream copy lossless (-c copy) ke container MPEG-TS berekstensi .mp4.": "MPEG-TS — Lossless stream copy (-c copy) into an MPEG-TS container with .mp4 extension.",
    "Download Ekstensi (Fish Acceleration)": "Download Extension (Fish Acceleration)",
    "Menonaktifkan Cloud Canvas TikTok Studio langsung di browser agar upload 1080p / 120 FPS tidak di-downscale ke 720p.": "Disables TikTok Studio Cloud Canvas directly in the browser so 1080p / 120 FPS uploads are not downscaled to 720p.",
    "Khusus pengguna HP Android untuk memasang ekstensi Chrome langsung di smartphone.": "For Android mobile users to install Chrome extensions directly on their phone.",
    "Tutorial Video": "Video Tutorial",
    "Putar video tutorial": "Play tutorial video",
    "Pilih file video yang valid.": "Please select a valid video file.",
    "Membaca buffer video...": "Reading video buffer...",
    "Normalisasi stream MP4...": "Normalizing MP4 stream...",
    "Mengompresi video": "Compressing video",
    "Menyimpan hasil...": "Saving output...",
    "Selesai": "Done",
    "Video selesai diproses": "Video processing complete",
    "AI Super-Resolution SPAN 4x + GPU Shader": "AI Super-Resolution SPAN 4x + GPU Shader",
    "Interpolasi FPS AI RIFE v4.7 (2x / 4x / 8x)": "AI FPS Interpolation RIFE v4.7 (2x / 4x / 8x)"
  };

  var EN_TO_ID = {
    "My time right now:": "Waktu saya saat ini:",
    "What are you looking here ?": "Apa yang sedang kamu cari di sini?",
    "Not Now": "Nanti Saja",
    "Then you came in the right place!": "Kamu datang di tempat yang tepat!",
    ". lemme redirect you to my desktop.": ". biar kuarahkan ke desktop-ku.",
    "That's not my project": "Itu bukan proyek-ku",
    ", but here I'll redirect you to that website.": ", tapi biar kuarahkan ke situs tersebut.",
    "cutefish.my.id is not affiliated with cutefish.org. I do wish they'll continue the Cutefish OS project until a stable release. It was good at first, but the original developer ghosted us and left us at v0.8.": "cutefish.my.id tidak berafiliasi dengan cutefish.org. Saya berharap proyek Cutefish OS bisa terus dilanjutkan hingga rilis stabil. Awalnya sangat bagus, namun pengembang aslinya menghilang di versi v0.8.",
    "More Apps": "Aplikasi Lainnya",
    "Toggle Fullscreen": "Layar Penuh",
    "Close App": "Tutup Aplikasi",
    "Close folder": "Tutup folder",
    "Visit desktop": "Buka desktop",
    "Visit cutefish.org": "Kunjungi cutefish.org",
    "You recently accessed": "Kamu baru saja membuka",
    ". Redirecting...": ". Mengalihkan...",
    "No thanks": "Tidak, terima kasih"
  };

  var DYNAMIC_ID_TO_EN = [
    [/^Video dimuat:\s*/i, "Video loaded: "],
    [/^Selesai dalam\s+/i, "Done in "],
    [/^Mengunduh otomatis:\s*/i, "Auto-downloading: "],
    [/^Tahap 1: Kompresi\s+/i, "Stage 1: Compressing "],
    [/^Mengompresi video\s*\(/i, "Compressing video ("],
    [/^Menerapkan metode\s+/i, "Applying method "],
    [/^Gagal:\s*/i, "Failed: "],
    [/^Gagal memuat data preset\s*/i, "Failed to load presets "],
    [/^Endpoint \/api\/presets tidak aktif di server ini\s*/i, "Endpoint /api/presets is unavailable on this server "]
  ];

  function translateString(raw) {
    if (typeof raw !== "string") return raw;
    var trimmed = raw.trim();
    if (!trimmed) return raw;

    var lead = raw.match(/^\s*/)[0];
    var trail = raw.match(/\s*$/)[0];

    if (activeLang === "en") {
      if (Object.prototype.hasOwnProperty.call(ID_TO_EN, trimmed)) {
        return lead + ID_TO_EN[trimmed] + trail;
      }
      for (var i = 0; i < DYNAMIC_ID_TO_EN.length; i++) {
        var rule = DYNAMIC_ID_TO_EN[i];
        if (rule[0].test(trimmed)) {
          return lead + trimmed.replace(rule[0], rule[1]) + trail;
        }
      }
      if (trimmed.indexOf("Resolusi > 1080p terdeteksi") !== -1) {
        return lead + trimmed
          .replace("Resolusi > 1080p terdeteksi, kompresi otomatis aktif.", "Resolution > 1080p detected, compression enabled automatically.")
          .replace(/Video (\d+) FPS akan dinormalisasi ke 60 FPS slowmo\./, "$1 FPS video will be normalized to 60 FPS slowmo.") + trail;
      }
      return raw;
    }

    if (activeLang === "id") {
      if (Object.prototype.hasOwnProperty.call(EN_TO_ID, trimmed)) {
        return lead + EN_TO_ID[trimmed] + trail;
      }
    }

    return raw;
  }

  var ATTRS = ["placeholder", "title", "aria-label"];

  function translateAttributes(el) {
    if (!el || el.nodeType !== 1) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var attr = ATTRS[i];
      var val = el.getAttribute(attr);
      if (!val) continue;
      var next = translateString(val);
      if (next !== val) el.setAttribute(attr, next);
    }
  }

  function protectIcons(root) {
    if (!root) return;
    var selector = ".material-symbols-rounded, .material-symbols-outlined, .material-icons, [class*='material-symbols']";
    if (root.nodeType === 1) {
      if (root.classList && (root.classList.contains("material-symbols-rounded") || root.classList.contains("material-symbols-outlined") || root.classList.contains("material-icons"))) {
        if (root.getAttribute("translate") !== "no") root.setAttribute("translate", "no");
        if (!root.classList.contains("notranslate")) root.classList.add("notranslate");
      }
      if (root.querySelectorAll) {
        var list = root.querySelectorAll(selector);
        for (var i = 0; i < list.length; i++) {
          var el = list[i];
          if (el.getAttribute("translate") !== "no") el.setAttribute("translate", "no");
          if (!el.classList.contains("notranslate")) el.classList.add("notranslate");
        }
      }
    } else if ((root.nodeType === 9 || root.nodeType === 11) && root.querySelectorAll) {
      var all = root.querySelectorAll(selector);
      for (var j = 0; j < all.length; j++) {
        var item = all[j];
        if (item.getAttribute("translate") !== "no") item.setAttribute("translate", "no");
        if (!item.classList.contains("notranslate")) item.classList.add("notranslate");
      }
    }
  }

  function translateNodeTree(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      var parent = root.parentElement;
      if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.classList.contains("material-symbols-rounded") || parent.classList.contains("notranslate"))) {
        return;
      }
      var next = translateString(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }

    if (root.nodeType === 1) {
      if (root.tagName === "SCRIPT" || root.tagName === "STYLE" || root.classList.contains("material-symbols-rounded") || root.classList.contains("notranslate")) {
        return;
      }
      translateAttributes(root);
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        var p = node.parentElement;
        if (p && (p.tagName === "SCRIPT" || p.tagName === "STYLE" || p.classList.contains("material-symbols-rounded") || p.classList.contains("notranslate"))) {
          continue;
        }
        var tVal = translateString(node.nodeValue);
        if (tVal !== node.nodeValue) node.nodeValue = tVal;
      } else if (node.nodeType === 1) {
        if (node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.classList.contains("material-symbols-rounded") || node.classList.contains("notranslate")) {
          continue;
        }
        translateAttributes(node);
      }
    }
  }

  var observer = null;
  var pendingNodes = [];
  var flushScheduled = false;

  function flushPending() {
    flushScheduled = false;
    var batch = pendingNodes.splice(0, pendingNodes.length);
    for (var i = 0; i < batch.length; i++) {
      protectIcons(batch[i]);
      translateNodeTree(batch[i]);
    }
  }

  function startObserver() {
    if (observer || !document.body || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "characterData" && m.target) {
          pendingNodes.push(m.target);
        } else if (m.type === "childList") {
          for (var j = 0; j < m.addedNodes.length; j++) {
            pendingNodes.push(m.addedNodes[j]);
          }
        }
      }
      if (pendingNodes.length > 0 && !flushScheduled) {
        flushScheduled = true;
        requestAnimationFrame(flushPending);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function init() {
    protectIcons(document);
    translateNodeTree(document.body);
    startObserver();
  }

  try {
    protectIcons(document);
  } catch (_) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.CutefishI18n = {
    lang: activeLang,
    isId: function () { return activeLang === "id"; },
    locale: function () { return activeLang === "id" ? "id-ID" : "en-US"; },
    t: function (idText, enText) { return activeLang === "id" ? idText : enText; },
    translate: translateString,
    apply: function (el) {
      var target = el || document.body;
      protectIcons(target);
      translateNodeTree(target);
    },
    setLang: function (nextLang) {
      try {
        if (nextLang === "id" || nextLang === "en") {
          localStorage.setItem(STORAGE_KEY, nextLang);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (_) {}
      window.location.reload();
    }
  };
})();
