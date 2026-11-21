(function () {
  "use strict";

  var U = window.AppUtils;

  var urlInput = document.getElementById("url-input");
  var qualityGroup = document.getElementById("quality-group");
  var errorBanner = document.getElementById("error-banner");
  var errorText = document.getElementById("error-text");

  var mediaCard = document.getElementById("media-card");
  var mediaCover = document.getElementById("media-cover");
  var mediaAuthor = document.getElementById("media-author");
  var mediaHandle = document.getElementById("media-handle");
  var mediaTitle = document.getElementById("media-title");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statSize = document.getElementById("stat-size");
  var statDuration = document.getElementById("stat-duration");
  var statMode = document.getElementById("stat-mode");

  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var selectedQuality = "hd";
  var isBusy = false;

  U.bindSegmented(qualityGroup, "quality", function (q) {
    selectedQuality = q || "hd";
  });

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

  async function resolveTikTokMeta(pageUrl) {
    // 1. Try local /api/tiktok-resolve if hosted with backend proxy
    try {
      var localRes = await fetch("/api/tiktok-resolve?url=" + encodeURIComponent(pageUrl));
      var ct = (localRes.headers.get("content-type") || "").toLowerCase();
      if (localRes.ok && ct.indexOf("application/json") !== -1) {
        var localJson = await localRes.json();
        if (localJson && (localJson.play || localJson.hdplay)) {
          logger.append("Metadata diambil melalui /api/tiktok-resolve");
          return { meta: localJson, hasProxy: true };
        }
      }
    } catch (_) {}

    // 2. Static-host fallback via public TikWM API
    logger.append("Mengambil metadata melalui TikWM API...");
    var apiUrl = "https://www.tikwm.com/api/?url=" + encodeURIComponent(pageUrl) + "&hd=1";
    var res = await fetch(apiUrl);
    if (!res.ok) throw new Error("Gagal menghubungi layanan TikTok (" + res.status + ").");
    var payload = await res.json();
    if (!payload || payload.code !== 0 || !payload.data) {
      throw new Error((payload && payload.msg) || "Video tidak ditemukan atau bersifat privat.");
    }

    var d = payload.data;
    return {
      hasProxy: false,
      meta: {
        id: d.id,
        title: d.title || "",
        cover: d.cover || d.origin_cover || "",
        play: d.play || "",
        hdplay: d.hdplay || d.play || "",
        music: d.music || "",
        duration: d.duration || 0,
        size: d.hd_size || d.size || 0,
        author_nickname: (d.author && d.author.nickname) || "Creator",
        author_unique_id: (d.author && d.author.unique_id) || "tiktok"
      }
    };
  }

  async function fetchStreamWithProgress(url, mime) {
    var response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);

    var total = parseInt(response.headers.get("content-length") || "0", 10) || 0;
    if (!response.body || typeof response.body.getReader !== "function") {
      return await response.blob();
    }

    var reader = response.body.getReader();
    var chunks = [];
    var loaded = 0;

    while (true) {
      var step = await reader.read();
      if (step.done) break;
      chunks.push(step.value);
      loaded += step.value.length;
      if (total > 0) {
        var pct = Math.min(99, Math.round((loaded / total) * 100));
        setProgress(pct, "Mengunduh (" + pct + "%)...");
      }
    }

    return new Blob(chunks, { type: mime });
  }

  async function handleDownload() {
    if (isBusy) return;
    hideError();

    var raw = (urlInput.value || "").trim();
    if (!raw) {
      showError("Masukkan tautan video TikTok terlebih dahulu.");
      return;
    }
    var url = U.extractTikTokUrl(raw);
    if (!url) {
      showError("Tautan bukan URL TikTok yang valid.");
      return;
    }

    isBusy = true;
    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Mengambil...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");
    setProgress(10, "Mengambil info video...");

    try {
      var resolved = await resolveTikTokMeta(url);
      var meta = resolved.meta;

      mediaCover.src = meta.cover || "";
      mediaAuthor.textContent = meta.author_nickname || "Creator";
      mediaHandle.textContent = "@" + (meta.author_unique_id || "tiktok");
      mediaTitle.textContent = meta.title || "-";
      mediaCard.classList.remove("is-hidden");

      var targetUrl = "";
      var ext = "mp4";
      var mime = "video/mp4";
      var modeLabel = "HD";

      if (selectedQuality === "audio") {
        targetUrl = meta.music || meta.play;
        ext = "mp3";
        mime = "audio/mpeg";
        modeLabel = "MP3";
      } else if (selectedQuality === "sd") {
        targetUrl = meta.play || meta.hdplay;
        modeLabel = "Standar";
      } else {
        targetUrl = (meta.hdplay && meta.hdplay.indexOf("http") === 0) ? meta.hdplay : meta.play;
        modeLabel = "HD";
      }

      if (!targetUrl) {
        throw new Error("Stream media tidak tersedia untuk tautan ini.");
      }

      var filename = "tiktok_" + (meta.author_unique_id || "video") + "_" + Date.now() + "." + ext;
      setProgress(25, "Mengunduh media...");
      logger.append("Mengunduh (" + modeLabel + "): " + filename);

      var blob = null;
      if (resolved.hasProxy) {
        try {
          blob = await fetchStreamWithProgress("/api/proxy?url=" + encodeURIComponent(targetUrl), mime);
        } catch (_) {}
      }

      if (!blob) {
        try {
          blob = await fetchStreamWithProgress(targetUrl, mime);
        } catch (corsErr) {
          logger.append("CORS membatasi stream langsung — membuka unduhan langsung...");
          U.triggerDownload(targetUrl, filename);
        }
      }

      progressBox.classList.add("is-hidden");
      statSize.textContent = blob ? U.formatBytes(blob.size) : (meta.size ? U.formatBytes(meta.size) : "-");
      statDuration.textContent = meta.duration ? (meta.duration + "s") : "-";
      statMode.textContent = modeLabel;
      statsGrid.classList.remove("is-hidden");

      if (blob) {
        U.triggerDownload(blob, filename);
        logger.append("Mengunduh otomatis: " + filename + " (" + U.formatBytes(blob.size) + ")");
      }

      logger.setBadge("Done");
      urlInput.value = "";
      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span> Unduh Video';
    } catch (err) {
      progressBox.classList.add("is-hidden");
      var msg = (err && err.message) || "Gagal mengunduh video.";
      showError(msg);
      logger.setBadge("Error");
      logger.append("Error: " + msg);
      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span> Coba Lagi';
    } finally {
      isBusy = false;
      btnStart.disabled = false;
    }
  }

  btnStart.addEventListener("click", handleDownload);
  urlInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleDownload();
    }
  });
})();
