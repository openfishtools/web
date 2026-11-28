(function () {
  "use strict";

  /**
   * Single Source of Truth — Daftar Aplikasi Desktop OS.
   *
   * Untuk menambah aplikasi baru:
   * 1. Copy folder `apps/_template/` -> `apps/<id-app>/`
   * 2. Tambahkan 1 objek di array APPS di bawah dengan `entry: "apps/<id-app>/index.html"`
   *    (Gunakan `entry: null` jika aplikasi belum memiliki halaman HTML / masih kosong).
   */
  var APPS = [
    { id: "preset", title: "Preset", icon: "preset.svg", entry: "apps/preset/index.html", description: "Kumpulan preset editing After Effects & Alight Motion" },
    { id: "projects", title: "Projects", icon: "projects.svg", entry: "apps/projects/index.html", description: "Kumpulan proyek & karya open source" },
    { id: "video-compressor", title: "Video Compressor", icon: "video-compressor.svg", entry: "apps/video-compressor/index.html", description: "Untuk mengkompres ukuran video", defaultSize: { width: 420, height: 360 } },
    { id: "video-upscaler", title: "Media Upscaler", icon: "video-upscaler.svg", entry: "apps/video-upscaler/index.html", description: "Untuk memperjelas & upscale gambar dan video AI", defaultSize: { width: 420, height: 360 } },
    { id: "tiktok-downloader", title: "TikTok Downloader", icon: "tiktok-downloader.svg", entry: "apps/tiktok-downloader/index.html", description: "Untuk mengunduh video & audio TikTok", defaultSize: { width: 420, height: 420 } },
    { id: "tiktok-analytics", title: "TikTok Analytics", icon: "tiktok-analytics.svg", entry: "apps/tiktok-analytics/index.html", description: "Untuk mengecek metrik & detail video TikTok", defaultSize: { width: 420, height: 340 } },
    { id: "tiktok-enhancer", title: "TikTok Enhancer", icon: "tiktok-enhancer.svg", entry: "apps/tiktok-enhancer/index.html", description: "Untuk mengoptimalkan kualitas upload TikTok", defaultSize: { width: 420, height: 410 } },
    { id: "rembg", title: "Remove BG", icon: "rembg.svg", entry: "apps/rembg/index.html", description: "Untuk menghapus atau mengganti latar foto & video", defaultSize: { width: 420, height: 360 } },
    { id: "mp4-to-mp3", title: "MP4 to MP3", icon: "mp4-to-mp3.svg", entry: "apps/mp4-to-mp3/index.html", description: "Untuk mengekstrak audio dari file video", defaultSize: { width: 420, height: 360 } },
    { id: "video-interpolation", title: "Interpolation", icon: "interpolation.svg", entry: "apps/video-interpolation/index.html", description: "Untuk menggandakan FPS video lebih halus", defaultSize: { width: 420, height: 360 } },
    { id: "sequence-to-video", title: "Sequence to Vid", icon: "sequence-to-video.svg", entry: "apps/sequence-to-video/index.html", description: "Untuk menggabungkan ZIP gambar menjadi video", defaultSize: { width: 420, height: 360 } },
    { id: "ae-to-am-beatmark", title: "Beatmark", icon: "ae-to-am-beatmark.svg", entry: "apps/ae-to-am-beatmark/index.html", description: "Untuk konversi beat After Effects ke Alight Motion", defaultSize: { width: 420, height: 360 } },
    { id: "am-5mb", title: "AM 5MB", icon: "am-5mb.svg", entry: "apps/am-5mb/index.html", description: "Untuk mengganti media proyek XML Alight Motion", defaultSize: { width: 420, height: 360 } },
    { id: "pre-gen", title: "Pre-Gen", icon: "pre-gen.svg", entry: "apps/pre-gen/index.html", description: "Premium generator Alight Motion", defaultSize: { width: 400, height: 330 } },
    { id: "slowtime", title: "SlowTime", icon: "slowtime.svg", entry: "apps/slowtime/index.html", description: "Pemutar video ala QuickTime untuk multi link & preset" }
  ];

  var FOLDERS = [
    {
      id: "folder-tiktok",
      title: "TikTok",
      ids: ["tiktok-downloader", "tiktok-analytics", "tiktok-enhancer"]
    },
    {
      id: "folder-am",
      title: "Alight Motion Tools",
      ids: ["sequence-to-video", "ae-to-am-beatmark", "am-5mb", "pre-gen"]
    },
    {
      id: "folder-video-ai",
      title: "Video & AI",
      wide: true,
      ids: ["video-compressor", "video-upscaler", "video-interpolation", "rembg", "mp4-to-mp3", "slowtime"]
    }
  ];

  function getAll() {
    return APPS.slice();
  }

  function getFolders() {
    return FOLDERS.map(function (f) {
      return { id: f.id, title: f.title, wide: Boolean(f.wide), ids: f.ids.slice() };
    });
  }

  function getById(id) {
    return APPS.find(function (app) { return app.id === id; }) || null;
  }

  var svgUid = 0;

  function makeSquircleSvg(inner) {
    return (
      '<svg class="app-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="64" height="64" rx="15.6" class="icon-bg" fill="var(--icon-bg, #212a1a)"/>' +
      inner +
      "</svg>"
    );
  }

  var FG = 'class="icon-fg" fill="var(--icon-fg, #c7dc9c)"';
  var IN = 'class="icon-inner" fill="var(--icon-inner, #212a1a)"';
  var AE_BADGE =
    '<rect ' + IN + ' x="38" y="38" width="19" height="19" rx="4.6"/>' +
    '<rect ' + FG + ' x="39.6" y="39.6" width="15.8" height="15.8" rx="3.4"/>' +
    '<text ' + IN + ' x="47.5" y="50.5" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9.2" font-weight="800" letter-spacing="-0.4">Ae</text>';

  var CONTACT_ITEMS = [
    {
      id: "contact-whatsapp",
      title: "WhatsApp",
      description: "Hubungi langsung lewat WhatsApp",
      url: "https://wa.me/6285150763332",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' d="M32 16.5c-8.56 0-15.5 6.86-15.5 15.32 0 2.95.84 5.8 2.44 8.24L17 47.5l7.74-2c2.25 1.2 4.76 1.84 7.26 1.84 8.56 0 15.5-6.86 15.5-15.32S40.56 16.5 32 16.5z"/>' +
        '<path ' + IN + ' d="M39.3 36.2c-.34.96-1.98 1.82-2.74 1.92-.7.1-1.58.14-2.56-.17-.6-.19-1.36-.45-2.34-.87-4.12-1.78-6.8-5.92-7-6.2-.2-.28-1.67-2.22-1.67-4.24s1.06-3.02 1.44-3.42c.38-.41.82-.52 1.1-.52h.78c.26 0 .6-.1.92.7.34.83 1.16 2.85 1.26 3.06.1.2.17.45.04.73-.13.28-.2.45-.41.7-.2.24-.43.54-.61.73-.2.2-.42.43-.18.85.24.41 1.07 1.76 2.3 2.86 1.58 1.4 2.9 1.84 3.32 2.05.42.2.66.17.9-.1.25-.28 1.04-1.21 1.32-1.62.28-.41.55-.34.92-.2.38.14 2.39 1.13 2.8 1.33.42.2.69.31.79.48.1.17.1 1-.24 1.94z"/>'
      )
    },
    {
      id: "contact-telegram",
      title: "Telegram",
      description: "Kirim pesan lewat Telegram",
      url: "https://t.me/cutefishaep",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' d="M47.6 18.4c.55-2.3-.95-3.2-2.8-2.45L15.9 27.1c-1.95.78-1.9 1.9-.35 2.38l7.4 2.31 17.15-10.82c.8-.5 1.55-.22.94.32L27.15 33.8l-.52 7.7c.76 0 1.1-.35 1.52-.76l3.66-3.56 7.62 5.62c1.4.77 2.4.37 2.75-1.3l5.42-23.1z"/>'
      )
    },
    {
      id: "social-donate",
      title: "DONATE",
      description: "Dukung karya lewat Saweria",
      url: "https://saweria.co/cutefishaep",
      svgHtml: makeSquircleSvg(
        '<circle ' + FG + ' cx="32" cy="32" r="17"/>' +
        '<circle ' + IN + ' cx="32" cy="32" r="13.8"/>' +
        '<circle ' + FG + ' cx="32" cy="32" r="12.2"/>' +
        '<text ' + IN + ' x="32" y="36.6" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13.5" font-weight="800" letter-spacing="-0.4">Rp</text>'
      )
    }
  ];

  var SOCIAL_LINKS = [
    {
      id: "social-instagram",
      title: "Instagram",
      description: "Profil & update di Instagram",
      url: "https://www.instagram.com/cutefishaep/",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' fill-rule="evenodd" clip-rule="evenodd" d="M24.2 16h15.6c4.53 0 8.2 3.67 8.2 8.2v15.6c0 4.53-3.67 8.2-8.2 8.2H24.2c-4.53 0-8.2-3.67-8.2-8.2V24.2c0-4.53 3.67-8.2 8.2-8.2zm0 3.6c-2.54 0-4.6 2.06-4.6 4.6v15.6c0 2.54 2.06 4.6 4.6 4.6h15.6c2.54 0 4.6-2.06 4.6-4.6V24.2c0-2.54-2.06-4.6-4.6-4.6H24.2z"/>' +
        '<path ' + FG + ' fill-rule="evenodd" clip-rule="evenodd" d="M32 23.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zm0 3.5a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8z"/>' +
        '<circle ' + FG + ' cx="40.8" cy="23.2" r="2"/>'
      )
    },
    {
      id: "social-tiktok-aep",
      title: "TikTok Editing",
      description: "Konten editing di TikTok",
      url: "https://www.tiktok.com/@cutefishaep",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' d="M35.8 15.5h4.9c.38 3.9 2.9 6.8 6.8 7.3v4.8c-2.6-.1-4.9-.95-6.8-2.4v11.3c0 5.75-4.65 10.4-10.4 10.4S19.9 42.25 19.9 36.5s4.65-10.4 10.4-10.4c.65 0 1.3.08 1.9.2v5.05c-.6-.2-1.25-.35-1.9-.35-3 0-5.4 2.45-5.4 5.5s2.4 5.5 5.4 5.5c3.1 0 5.5-2.35 5.5-5.9V15.5z"/>' +
        AE_BADGE
      )
    },
    {
      id: "social-tiktok-rbx",
      title: "TikTok Roblox",
      description: "Konten Roblox di TikTok",
      url: "https://www.tiktok.com/@cutefishrbx",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' d="M35.8 15.5h4.9c.38 3.9 2.9 6.8 6.8 7.3v4.8c-2.6-.1-4.9-.95-6.8-2.4v11.3c0 5.75-4.65 10.4-10.4 10.4S19.9 42.25 19.9 36.5s4.65-10.4 10.4-10.4c.65 0 1.3.08 1.9.2v5.05c-.6-.2-1.25-.35-1.9-.35-3 0-5.4 2.45-5.4 5.5s2.4 5.5 5.4 5.5c3.1 0 5.5-2.35 5.5-5.9V15.5z"/>' +
        '<g transform="rotate(14 47.5 46.5)">' +
        '<rect ' + IN + ' x="40" y="39" width="15" height="15" rx="3.4"/>' +
        '<rect ' + FG + ' x="41.5" y="40.5" width="12" height="12" rx="2.4"/>' +
        '<rect ' + IN + ' x="45.8" y="44.8" width="3.4" height="3.4" rx="0.6"/>' +
        '</g>'
      )
    },
    {
      id: "social-yt-edit",
      title: "YouTube Editing",
      description: "Tutorial & showcase editing",
      url: "https://www.youtube.com/@cutefishYT",
      svgHtml: makeSquircleSvg(
        '<rect ' + FG + ' x="14.5" y="20" width="35" height="24" rx="7"/>' +
        '<polygon ' + IN + ' points="28.2,26.8 28.2,37.2 37.8,32"/>' +
        AE_BADGE
      )
    },
    {
      id: "social-yt-rbx",
      title: "YouTube Roblox",
      description: "Konten gaming Roblox",
      url: "https://www.youtube.com/@cutefishrbx",
      svgHtml: makeSquircleSvg(
        '<rect ' + FG + ' x="14.5" y="20" width="35" height="24" rx="7"/>' +
        '<polygon ' + IN + ' points="28.2,26.8 28.2,37.2 37.8,32"/>' +
        '<g transform="rotate(14 47.5 46)">' +
        '<rect ' + IN + ' x="40.5" y="39" width="14" height="14" rx="3.2"/>' +
        '<rect ' + FG + ' x="42" y="40.5" width="11" height="11" rx="2.2"/>' +
        '<rect ' + IN + ' x="45.9" y="44.4" width="3.2" height="3.2" rx="0.6"/>' +
        '</g>'
      )
    },
    {
      id: "social-github",
      title: "Github Profile",
      description: "Repositori kode & open source",
      url: "https://github.com/cutefishaep",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' fill-rule="evenodd" clip-rule="evenodd" d="M32 16c-8.84 0-16 7.16-16 16 0 7.07 4.58 13.06 10.94 15.18.8.15 1.09-.35 1.09-.77 0-.38-.01-1.64-.02-2.97-4.02.73-5.06-.98-5.38-1.88-.18-.46-.96-1.88-1.64-2.26-.56-.3-1.36-1.05-.02-1.07 1.26-.02 2.16 1.16 2.46 1.64 1.44 2.42 3.74 1.74 4.66 1.32.14-1.04.56-1.74 1.02-2.14-3.56-.4-7.3-1.78-7.3-7.92 0-1.75.62-3.19 1.65-4.31-.16-.4-.72-2.05.16-4.27 0 0 1.35-.43 4.4 1.65a15.2 15.2 0 0 1 8.02 0c3.05-2.08 4.4-1.65 4.4-1.65.88 2.22.32 3.87.16 4.27 1.03 1.12 1.65 2.56 1.65 4.31 0 6.16-3.75 7.52-7.32 7.91.58.5 1.08 1.46 1.08 2.95 0 2.13-.02 3.85-.02 4.38 0 .42.29.93 1.1.77A16.01 16.01 0 0 0 48 32c0-8.84-7.16-16-16-16z"/>'
      )
    },
    {
      id: "social-whatsapp",
      title: "Channel WhatsApp",
      description: "Gabung saluran informasi WhatsApp",
      url: "https://whatsapp.com/channel/0029VbDWmbe2kNFxcRD5Lj2z",
      svgHtml: makeSquircleSvg(
        '<path ' + FG + ' d="M32 16.5c-8.56 0-15.5 6.86-15.5 15.32 0 2.95.84 5.8 2.44 8.24L17 47.5l7.74-2c2.25 1.2 4.76 1.84 7.26 1.84 8.56 0 15.5-6.86 15.5-15.32S40.56 16.5 32 16.5z"/>' +
        '<path ' + IN + ' d="M39.3 36.2c-.34.96-1.98 1.82-2.74 1.92-.7.1-1.58.14-2.56-.17-.6-.19-1.36-.45-2.34-.87-4.12-1.78-6.8-5.92-7-6.2-.2-.28-1.67-2.22-1.67-4.24s1.06-3.02 1.44-3.42c.38-.41.82-.52 1.1-.52h.78c.26 0 .6-.1.92.7.34.83 1.16 2.85 1.26 3.06.1.2.17.45.04.73-.13.28-.2.45-.41.7-.2.24-.43.54-.61.73-.2.2-.42.43-.18.85.24.41 1.07 1.76 2.3 2.86 1.58 1.4 2.9 1.84 3.32 2.05.42.2.66.17.9-.1.25-.28 1.04-1.21 1.32-1.62.28-.41.55-.34.92-.2.38.14 2.39 1.13 2.8 1.33.42.2.69.31.79.48.1.17.1 1-.24 1.94z"/>' +
        '<circle ' + IN + ' cx="47.5" cy="46.5" r="8.2"/>' +
        '<circle ' + FG + ' cx="47.5" cy="46.5" r="6.6"/>' +
        '<text ' + IN + ' x="47.5" y="49.3" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="7.2" font-weight="800" letter-spacing="-0.3">CH</text>'
      )
    }
  ];

  function scopeSvgIds(svgHtml) {
    if (!svgHtml || svgHtml.indexOf("id=") === -1) return svgHtml;
    var suffix = "_i" + (++svgUid);
    var ids = {};
    var out = svgHtml.replace(/\bid="([^"]+)"/g, function (_m, id) {
      ids[id] = id + suffix;
      return 'id="' + ids[id] + '"';
    });
    out = out.replace(/url\(#([^)]+)\)/g, function (m, id) {
      return ids[id] ? "url(#" + ids[id] + ")" : m;
    });
    return out.replace(/(\b(?:xlink:)?href="#)([^"]+)(")/g, function (m, pre, id, post) {
      return ids[id] ? pre + ids[id] + post : m;
    });
  }

  function getIconHtml(iconName) {
    if (typeof APP_SVG_ICONS !== "undefined" && APP_SVG_ICONS[iconName]) {
      return scopeSvgIds(APP_SVG_ICONS[iconName]);
    }
    return '<img src="assets/icons/' + iconName + '" class="app-icon" alt="" />';
  }

  function getContacts() {
    return CONTACT_ITEMS.slice();
  }

  function getSocialLinks() {
    return SOCIAL_LINKS.slice();
  }

  function getItemIconHtml(item) {
    if (!item) return "";
    return item.svgHtml || getIconHtml(item.icon);
  }

  function launch(item, triggerEl) {
    if (!item) return;
    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (window.AppWindow && typeof window.AppWindow.open === "function") {
      window.AppWindow.open(item, triggerEl);
    }
  }

  window.AppRegistry = {
    getAll: getAll,
    getFolders: getFolders,
    getById: getById,
    getContacts: getContacts,
    getSocialLinks: getSocialLinks,
    getIconHtml: getIconHtml,
    getItemIconHtml: getItemIconHtml,
    launch: launch
  };
})();
