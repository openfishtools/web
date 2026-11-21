(function () {
  "use strict";

  var U = window.AppUtils;

  var urlInput = document.getElementById("url-input");
  var errorBanner = document.getElementById("error-banner");
  var errorText = document.getElementById("error-text");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var mediaCard = document.getElementById("media-card");
  var mediaCover = document.getElementById("media-cover");
  var mediaAuthor = document.getElementById("media-author");
  var mediaHandle = document.getElementById("media-handle");
  var mediaTitle = document.getElementById("media-title");
  var metricsGrid = document.getElementById("metrics-grid");
  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var COUNTRIES = {
    ID: "Indonesia", MY: "Malaysia", SG: "Singapura", US: "Amerika Serikat",
    TH: "Thailand", VN: "Vietnam", PH: "Filipina", JP: "Jepang",
    KR: "Korea Selatan", GB: "Inggris", AU: "Australia", BR: "Brasil",
    DE: "Jerman", FR: "Prancis", IN: "India", RU: "Rusia",
    CA: "Kanada", MX: "Meksiko", IT: "Italia", ES: "Spanyol",
    NL: "Belanda", TR: "Turki", SA: "Arab Saudi", AE: "UEA",
    CN: "Tiongkok", TW: "Taiwan", HK: "Hong Kong"
  };

  var CACHE_STORAGE_KEY = "cutefish_tt_analytics_cache_v1";
  var CACHE_TTL_MS = 10 * 60 * 1000;
  var CACHE_MAX_ENTRIES = 30;
  var cache = new Map();
  var isRunning = false;

  function normalizeTikTokKey(rawUrl) {
    var u = String(rawUrl || "").trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try {
      var parsed = new URL(u);
      var host = parsed.hostname.toLowerCase();
      var path = parsed.pathname.replace(/\/+$/, "");
      var vidMatch = path.match(/\/video\/(\d+)/i);
      if (vidMatch) return "vid:" + vidMatch[1];
      return "url:" + host + path;
    } catch (_) {
      return "raw:" + u;
    }
  }

  function loadStoredCache() {
    try {
      var raw = localStorage.getItem(CACHE_STORAGE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (_) {
      return {};
    }
  }

  function getCachedAnalysis(key) {
    var now = Date.now();
    if (cache.has(key)) {
      var memEntry = cache.get(key);
      if (memEntry && (now - memEntry.ts) < CACHE_TTL_MS) return memEntry;
      cache.delete(key);
    }
    var stored = loadStoredCache();
    var entry = stored[key];
    if (entry && entry.meta && (now - entry.ts) < CACHE_TTL_MS) {
      cache.set(key, entry);
      return entry;
    }
    return null;
  }

  function saveCachedAnalysis(key, meta, streamMeta) {
    var entry = { meta: meta, streamMeta: streamMeta || null, ts: Date.now() };
    cache.set(key, entry);
    if (meta && meta.id) {
      cache.set("vid:" + meta.id, entry);
    }
    try {
      var stored = loadStoredCache();
      var now = Date.now();
      Object.keys(stored).forEach(function (k) {
        if (!stored[k] || (now - stored[k].ts) >= CACHE_TTL_MS) delete stored[k];
      });
      stored[key] = entry;
      if (meta && meta.id) stored["vid:" + meta.id] = entry;

      var keys = Object.keys(stored);
      if (keys.length > CACHE_MAX_ENTRIES) {
        keys.sort(function (a, b) { return (stored[a].ts || 0) - (stored[b].ts || 0); });
        keys.slice(0, keys.length - CACHE_MAX_ENTRIES).forEach(function (k) {
          delete stored[k];
        });
      }
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(stored));
    } catch (_) {}
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove("is-hidden");
  }

  function hideError() {
    errorBanner.classList.add("is-hidden");
  }

  function setProgress(pct, status) {
    progressBox.classList.remove("is-hidden");
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    if (status) progressStatus.textContent = status;
  }

  function formatNumber(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    try { return new Intl.NumberFormat("id-ID").format(n); } catch (_) { return String(n); }
  }

  function formatRegion(code) {
    if (!code) return "-";
    var u = String(code).toUpperCase();
    return COUNTRIES[u] || u;
  }

  function formatUploadDate(epoch) {
    if (!epoch || isNaN(epoch)) return "-";
    try {
      return new Date(epoch * 1000).toLocaleDateString("id-ID", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return "-";
    }
  }

  function cleanMethodTag(comment) {
    if (!comment || typeof comment !== "string") return "Undetected";
    var s = comment.trim().replace(/^["']|["']$/g, "").trim();
    if (!s || s === "-" || s === "\u2014") return "Undetected";
    if (s.charAt(0) === "{") return "Undetected";
    if (/^(lavf|lavc|ffmpeg|handbrake|libav|x264|x265|vid:|v\d{4,}|isom|mp42|dash|iso2|qt|avc1|mp41)/i.test(s)) return "Undetected";
    if (/^\d+$/.test(s) || !/[a-zA-Z]/.test(s)) return "Undetected";
    return s;
  }

  async function resolveMetadata(pageUrl) {
    // 1. Try /api/tiktok-resolve if available
    try {
      var res = await fetch("/api/tiktok-resolve?url=" + encodeURIComponent(pageUrl));
      var ct = (res.headers.get("content-type") || "").toLowerCase();
      if (res.ok && ct.indexOf("application/json") !== -1) {
        var json = await res.json();
        if (json && (json.play || json.hdplay)) {
          return json;
        }
      }
    } catch (_) {}

    // 2. Fallback to public TikWM API
    logger.append("Mengambil data via TikWM API...");
    var apiRes = await fetch("https://www.tikwm.com/api/?url=" + encodeURIComponent(pageUrl) + "&hd=1");
    if (!apiRes.ok) throw new Error("Gagal memuat metadata (" + apiRes.status + ").");
    var payload = await apiRes.json();
    if (!payload || payload.code !== 0 || !payload.data) {
      throw new Error((payload && payload.msg) || "Video tidak ditemukan atau bersifat privat.");
    }

    var d = payload.data;
    return {
      id: d.id,
      title: d.title || "",
      cover: d.cover || d.origin_cover || "",
      play: d.play || "",
      hdplay: d.hdplay || "",
      duration: d.duration || 0,
      size: d.size || d.hd_size || 0,
      create_time: d.create_time || 0,
      region: d.region || "",
      is_nff_or_nr: Boolean(d.is_ad || d.commercial_video_info),
      play_count: d.play_count || 0,
      digg_count: d.digg_count || 0,
      comment_count: d.comment_count || 0,
      share_count: d.share_count || 0,
      collect_count: d.collect_count || 0,
      author_nickname: (d.author && d.author.nickname) || "Creator",
      author_unique_id: (d.author && d.author.unique_id) || "tiktok"
    };
  }

  function extractMethodCommentFromMp4(data, view) {
    var decoder = new TextDecoder("utf-8", { fatal: false });
    var fallbackComment = "";

    function readDataAtomText(start, end) {
      for (var p = start; p + 16 <= end; p++) {
        if (data[p + 4] === 0x64 && data[p + 5] === 0x61 && data[p + 6] === 0x74 && data[p + 7] === 0x61) {
          var sz = view.getUint32(p, false);
          if (sz >= 16 && p + sz <= end + 8) {
            return decoder.decode(data.subarray(p + 16, p + sz)).replace(/\0+$/, "").trim();
          }
        }
      }
      return "";
    }

    for (var i = 0; i + 12 <= data.length; i++) {
      var b0 = data[i + 4], b1 = data[i + 5], b2 = data[i + 6], b3 = data[i + 7];
      // Check ©cmt (0xA9 'cmt') or ©too (0xA9 'too')
      var isCmt = b0 === 0xa9 && b1 === 0x63 && b2 === 0x6d && b3 === 0x74;
      var isToo = b0 === 0xa9 && b1 === 0x74 && b2 === 0x6f && b3 === 0x6f;
      if (isCmt || isToo) {
        var boxSize = view.getUint32(i, false);
        if (boxSize >= 24 && i + boxSize <= data.length) {
          var txt = readDataAtomText(i + 8, i + boxSize);
          if (txt) {
            if (cleanMethodTag(txt) !== "Undetected") return txt;
            if (!fallbackComment) fallbackComment = txt;
          }
        }
      }
    }
    return fallbackComment;
  }

  async function probeStreamMeta(streamUrl) {
    if (!streamUrl || streamUrl.indexOf("http") !== 0) return null;
    try {
      var res = await fetch("/api/tiktok-fps?url=" + encodeURIComponent(streamUrl));
      var ct = (res.headers.get("content-type") || "").toLowerCase();
      if (res.ok && ct.indexOf("application/json") !== -1) {
        return await res.json();
      }
    } catch (_) {}

    // Client-side range probe fallback if CORS permits
    try {
      var r = await fetch(streamUrl, { headers: { Range: "bytes=0-524287" } });
      if (!r.ok) return null;
      var buf = await r.arrayBuffer();
      var data = new Uint8Array(buf);
      var view = new DataView(buf);
      var fps = 0;
      var width = 0;
      var height = 0;
      for (var i = 0; i < data.length - 8; i++) {
        if (!fps && data[i] === 0x76 && data[i + 1] === 0x69 && data[i + 2] === 0x64 && data[i + 3] === 0x65) {
          var ts = 0;
          var sd = 0;
          for (var j = Math.max(0, i - 300); j < Math.min(data.length - 8, i + 8000); j++) {
            if (data[j] === 0x6d && data[j + 1] === 0x64 && data[j + 2] === 0x68 && data[j + 3] === 0x64) {
              var v = view.getUint8(j + 4);
              ts = v === 1 ? view.getUint32(j + 24) : view.getUint32(j + 16);
            }
            if (data[j] === 0x73 && data[j + 1] === 0x74 && data[j + 2] === 0x74 && data[j + 3] === 0x73) {
              if (view.getUint32(j + 8) > 0) sd = view.getUint32(j + 16);
            }
            if (ts && sd) {
              var f = Math.round(ts / sd);
              if (f > 0 && f < 300) { fps = f; break; }
            }
          }
        }
        if (!width && data[i] === 0x74 && data[i + 1] === 0x6b && data[i + 2] === 0x68 && data[i + 3] === 0x64) {
          var ver = view.getUint8(i + 4);
          var wOff = ver === 1 ? i + 92 : i + 80;
          var hOff = ver === 1 ? i + 96 : i + 84;
          if (hOff + 4 <= buf.byteLength) {
            var w = Math.round(view.getUint32(wOff) / 65536);
            var h = Math.round(view.getUint32(hOff) / 65536);
            if (w > 0 && h > 0 && w < 16000 && h < 16000) { width = w; height = h; }
          }
        }
      }
      var comment = extractMethodCommentFromMp4(data, view);
      return { fps: fps, width: width, height: height, comment: comment };
    } catch (_) {
      return null;
    }
  }

  async function runAnalysis() {
    if (isRunning) return;
    hideError();

    var raw = (urlInput.value || "").trim();
    if (!raw) {
      showError("Masukkan tautan video TikTok terlebih dahulu.");
      return;
    }
    var pageUrl = U.extractTikTokUrl(raw);
    if (!pageUrl) {
      showError("Tautan bukan URL TikTok yang valid.");
      return;
    }

    isRunning = true;
    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Menganalisis...';
    logger.setBadge("Running");
    setProgress(20, "Mengambil metadata video...");

    try {
      var cacheKey = normalizeTikTokKey(pageUrl);
      var cached = getCachedAnalysis(cacheKey);
      var meta;
      var streamMeta;

      if (cached) {
        logger.append("Menggunakan cache lokal perangkat (hemat kuota API)");
        meta = cached.meta;
        streamMeta = cached.streamMeta;
      } else {
        meta = await resolveMetadata(pageUrl);
      }

      mediaCover.src = meta.cover || "";
      mediaAuthor.textContent = meta.author_nickname || "Creator";
      mediaHandle.textContent = "@" + (meta.author_unique_id || "tiktok");
      mediaTitle.textContent = meta.title || "-";
      mediaCard.classList.remove("is-hidden");

      var plays = meta.play_count || 0;
      var likes = meta.digg_count || 0;
      var comments = meta.comment_count || 0;
      var shares = meta.share_count || 0;
      var saves = meta.collect_count || 0;
      var engagement = plays > 0
        ? (((likes + comments + shares + saves) / plays) * 100).toFixed(2) + "%"
        : "-";

      setText("kv-views", formatNumber(plays));
      setText("kv-likes", formatNumber(likes));
      setText("kv-comments", formatNumber(comments));
      setText("kv-shares", formatNumber(shares));
      setText("kv-saves", formatNumber(saves));
      setText("kv-engagement", engagement);
      setText("kv-region", formatRegion(meta.region));
      setText("kv-date", formatUploadDate(meta.create_time));
      setText("kv-shadowban", meta.is_nff_or_nr ? "Terbatas" : "Aman");
      metricsGrid.classList.remove("is-hidden");

      if (!cached) {
        setProgress(60, "Memeriksa stream video (FPS & resolusi)...");
        streamMeta = await probeStreamMeta(meta.play || meta.hdplay);
        if ((!streamMeta || (!streamMeta.fps && !streamMeta.width)) && meta.hdplay && meta.hdplay !== meta.play) {
          var hdStreamMeta = await probeStreamMeta(meta.hdplay);
          if (hdStreamMeta) streamMeta = hdStreamMeta;
        }
        saveCachedAnalysis(cacheKey, meta, streamMeta);
      }

      var finalSize = meta.size || (streamMeta && streamMeta.size) || 0;
      var finalDur = meta.duration || (streamMeta && streamMeta.duration) || 0;
      var resW = (streamMeta && streamMeta.width) || meta.w || 0;
      var resH = (streamMeta && streamMeta.height) || meta.h || 0;

      setText("kv-resolution", resW && resH ? (resW + " x " + resH) : "-");
      setText("kv-fps", streamMeta && streamMeta.fps ? (streamMeta.fps + " fps") : "-");
      setText("kv-duration", finalDur ? (finalDur + "s") : "-");
      setText("kv-size", finalSize ? U.formatBytes(finalSize) : "-");

      if (finalSize && finalDur) {
        var kbps = (finalSize * 8) / (finalDur * 1000);
        setText("kv-bitrate", kbps >= 1000 ? ((kbps / 1000).toFixed(2) + " Mbps") : (Math.round(kbps) + " kbps"));
      } else {
        setText("kv-bitrate", "-");
      }

      setText("kv-method", cleanMethodTag(streamMeta && streamMeta.comment));

      progressBox.classList.add("is-hidden");
      logger.setBadge("Done");
      logger.append("Analisis selesai: @" + (meta.author_unique_id || "tiktok") + " (" + formatNumber(plays) + " views, " + engagement + " ER)");
      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">query_stats</span> Analisis Video';
    } catch (err) {
      progressBox.classList.add("is-hidden");
      var msg = (err && err.message) || "Video tidak ditemukan atau tautan tidak valid.";
      showError(msg);
      logger.setBadge("Error");
      logger.append("Error: " + msg);
      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">query_stats</span> Coba Lagi';
    } finally {
      isRunning = false;
      btnStart.disabled = false;
    }
  }

  btnStart.addEventListener("click", runAnalysis);
  urlInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      runAnalysis();
    }
  });
})();
