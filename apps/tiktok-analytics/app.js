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

  var CACHE_STORAGE_KEY = "cutefish_tt_analytics_cache_v2";
  var CACHE_TTL_MS = 60 * 1000;
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

  function isCacheEntryValid(entry, now) {
    return Boolean(
      entry &&
      entry.meta &&
      typeof entry.ts === "number" &&
      isFinite(entry.ts) &&
      entry.ts > 0 &&
      (now - entry.ts) < CACHE_TTL_MS
    );
  }

  function cleanupExpiredCache() {
    var now = Date.now();
    cache.forEach(function (val, k) {
      if (!isCacheEntryValid(val, now)) {
        cache.delete(k);
      }
    });
    try {
      localStorage.removeItem("cutefish_tt_analytics_cache_v1");
      var stored = loadStoredCache();
      var changed = false;
      Object.keys(stored).forEach(function (k) {
        if (!isCacheEntryValid(stored[k], now)) {
          delete stored[k];
          changed = true;
        }
      });
      if (changed) {
        if (Object.keys(stored).length === 0) {
          localStorage.removeItem(CACHE_STORAGE_KEY);
        } else {
          localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(stored));
        }
      }
    } catch (_) {}
  }

  function getCachedAnalysis(key) {
    cleanupExpiredCache();
    var now = Date.now();
    if (cache.has(key)) {
      var memEntry = cache.get(key);
      if (isCacheEntryValid(memEntry, now)) return memEntry;
      cache.delete(key);
    }
    var stored = loadStoredCache();
    var entry = stored[key];
    if (isCacheEntryValid(entry, now)) {
      cache.set(key, entry);
      return entry;
    }
    return null;
  }

  cleanupExpiredCache();
  setInterval(cleanupExpiredCache, CACHE_TTL_MS);

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
        if (!isCacheEntryValid(stored[k], now)) delete stored[k];
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
    logger.append("Mengambil metadata video...");
    var res = await fetch("/api/tiktok-resolve?url=" + encodeURIComponent(pageUrl));
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.indexOf("application/json") === -1) {
      throw new Error("Endpoint /api/tiktok-resolve tidak aktif di server ini (" + res.status + ").");
    }
    var json = await res.json();
    if (!res.ok) {
      throw new Error((json && json.error) || ("Gagal memuat metadata (" + res.status + ")."));
    }
    if (!json || (!json.play && !json.hdplay)) {
      throw new Error("Stream video tidak ditemukan dari metadata TikTok.");
    }
    return json;
  }

  async function probeStreamMeta(streamUrl) {
    if (!streamUrl || streamUrl.indexOf("http") !== 0) return null;
    var res = await fetch("/api/tiktok-fps?url=" + encodeURIComponent(streamUrl));
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.indexOf("application/json") === -1) {
      throw new Error("Endpoint /api/tiktok-fps tidak aktif di server ini (" + res.status + ").");
    }
    var json = await res.json();
    if (!res.ok) {
      throw new Error((json && json.error) || ("Gagal memeriksa stream video (" + res.status + ")."));
    }
    return json;
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
