(function () {
  "use strict";

  var U = window.AppUtils;

  var CMD_STORAGE_KEY = "cutefish_slowtime_cmd_v1";
  var STREAM_CACHE_KEY = "cutefish_slowtime_streams_v1";
  var STREAM_TTL_MS = 25 * 60 * 1000;
  var channel = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("cutefish_slowtime_channel")
    : null;

  var stage = document.getElementById("player-stage");
  var mainVideo = document.getElementById("main-video");
  var embedSlot = document.getElementById("embed-slot");
  var emptyState = document.getElementById("empty-state");
  var emptyForm = document.getElementById("empty-form");
  var emptyInput = document.getElementById("empty-input");
  var stageLoading = document.getElementById("stage-loading");
  var errorBanner = document.getElementById("error-banner");
  var errorText = document.getElementById("error-text");
  var floatingDock = document.getElementById("floating-dock");

  var seekSlider = document.getElementById("seek-slider");
  var scrubberWrap = document.getElementById("scrubber-wrap");
  var timeCur = document.getElementById("time-cur");
  var timeDur = document.getElementById("time-dur");

  var btnRew = document.getElementById("btn-rew");
  var btnPlay = document.getElementById("btn-play");
  var playIcon = document.getElementById("play-icon");
  var btnFwd = document.getElementById("btn-fwd");

  var isSeeking = false;
  var idleTimer = null;
  var errorTimer = null;
  var resolveToken = 0;
  var streamCache = loadStreamCache();

  mainVideo.loop = true;
  floatingDock.classList.add("is-hidden");

  function loadStreamCache() {
    try {
      var raw = localStorage.getItem(STREAM_CACHE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveStreamCache(key, info) {
    streamCache[key] = { info: info, ts: Date.now() };
    try {
      var now = Date.now();
      Object.keys(streamCache).forEach(function (k) {
        if (!streamCache[k] || (now - streamCache[k].ts) >= STREAM_TTL_MS) {
          delete streamCache[k];
        }
      });
      localStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(streamCache));
    } catch (_) {}
  }

  function showError(msg) {
    clearTimeout(errorTimer);
    errorText.textContent = msg;
    errorBanner.classList.remove("is-hidden");
    errorTimer = setTimeout(function () {
      errorBanner.classList.add("is-hidden");
    }, 3600);
  }

  function hideError() {
    clearTimeout(errorTimer);
    errorBanner.classList.add("is-hidden");
  }

  function notifyHostAspect(ratio) {
    if (!ratio || !isFinite(ratio) || ratio < 0.2 || ratio > 5) return;
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "cutefish:window-aspect", ratio: ratio }, "*");
      } catch (_) {}
    }
  }

  function notifyHostIdle(idle) {
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "cutefish:player-idle", idle: Boolean(idle) }, "*");
      } catch (_) {}
    }
  }

  function wakeControls() {
    stage.classList.remove("is-idle");
    notifyHostIdle(false);
    clearTimeout(idleTimer);
    var isVideoPlaying = !mainVideo.classList.contains("is-hidden") && !mainVideo.paused;
    if (isVideoPlaying) {
      idleTimer = setTimeout(function () {
        stage.classList.add("is-idle");
        notifyHostIdle(true);
      }, 2400);
    }
  }

  function extractTikTokVideoId(url) {
    var m = String(url || "").match(/\/video\/(\d+)/i);
    return m ? m[1] : "";
  }

  function normalizeSingleUrl(raw) {
    var tok = String(raw || "").trim();
    if (!tok) return "";
    var tt = U && typeof U.extractTikTokUrl === "function" ? U.extractTikTokUrl(tok) : "";
    if (tt) return tt;
    var candidate = /^https?:\/\//i.test(tok) ? tok : (/^[^\s]+\.[^\s]+/.test(tok) ? ("https://" + tok) : "");
    if (!candidate) return "";
    try {
      var parsed = new URL(candidate);
      return (parsed.protocol === "http:" || parsed.protocol === "https:") ? parsed.href : "";
    } catch (_) {
      return "";
    }
  }

  async function resolveStreamInfo(url) {
    if (!url) return null;
    var hit = streamCache[url];
    if (hit && hit.info && (Date.now() - hit.ts) < STREAM_TTL_MS) {
      return hit.info;
    }

    var isTikTok = U && typeof U.extractTikTokUrl === "function" && Boolean(U.extractTikTokUrl(url));
    if (!isTikTok) {
      return { streamUrl: url, cover: "", embedUrl: "" };
    }

    var vidId = extractTikTokVideoId(url);
    var embedFallback = vidId ? ("https://www.tiktok.com/player/v1/" + vidId + "?autoplay=1") : "";

    try {
      var localRes = await fetch("/api/tiktok-resolve?url=" + encodeURIComponent(url));
      var ct = (localRes.headers.get("content-type") || "").toLowerCase();
      if (localRes.ok && ct.indexOf("application/json") !== -1) {
        var lj = await localRes.json();
        if (lj && (lj.hdplay || lj.play)) {
          var lInfo = {
            streamUrl: lj.hdplay || lj.play,
            cover: lj.cover || "",
            embedUrl: embedFallback
          };
          saveStreamCache(url, lInfo);
          return lInfo;
        }
      }
    } catch (_) {}

    try {
      var apiRes = await fetch("https://www.tikwm.com/api/?url=" + encodeURIComponent(url) + "&hd=1");
      if (apiRes.ok) {
        var payload = await apiRes.json();
        if (payload && payload.code === 0 && payload.data) {
          var d = payload.data;
          var tInfo = {
            streamUrl: d.hdplay || d.play || "",
            cover: d.cover || d.origin_cover || "",
            embedUrl: embedFallback || (d.id ? ("https://www.tiktok.com/player/v1/" + d.id + "?autoplay=1") : "")
          };
          if (tInfo.streamUrl) {
            saveStreamCache(url, tInfo);
            return tInfo;
          }
        }
      }
    } catch (_) {}

    if (embedFallback) {
      return { streamUrl: "", cover: "", embedUrl: embedFallback };
    }
    throw new Error("Video gagal dimuat dari tautan tersebut.");
  }

  function clearEmbed() {
    embedSlot.innerHTML = "";
    embedSlot.classList.add("is-hidden");
  }

  function mountEmbed(url) {
    embedSlot.innerHTML = "";
    var ifr = document.createElement("iframe");
    ifr.className = "slowtime-embed";
    ifr.allow = "autoplay; encrypted-media; picture-in-picture";
    ifr.allowFullscreen = true;
    ifr.src = url;
    embedSlot.classList.remove("is-hidden");
    embedSlot.appendChild(ifr);
  }

  function stopCurrentMedia() {
    mainVideo.pause();
    mainVideo.removeAttribute("src");
    mainVideo.removeAttribute("poster");
    mainVideo.load();
    mainVideo.classList.add("is-hidden");
    clearEmbed();
    floatingDock.classList.add("is-hidden");
    playIcon.textContent = "play_arrow";
    timeCur.textContent = "00:00";
    timeDur.textContent = "00:00";
    seekSlider.value = 0;
    if (U) U.syncSlider(seekSlider);
  }

  async function playVideoUrl(url, cover) {
    if (!url) return;
    hideError();
    stopCurrentMedia();
    wakeControls();

    var token = ++resolveToken;
    emptyState.classList.add("is-hidden");
    stageLoading.classList.remove("is-hidden");

    try {
      var info = await resolveStreamInfo(url);
      if (token !== resolveToken) return;
      stageLoading.classList.add("is-hidden");

      if (info && info.streamUrl) {
        clearEmbed();
        scrubberWrap.classList.remove("is-hidden");
        mainVideo.poster = cover || info.cover || "";
        mainVideo.src = info.streamUrl;
        mainVideo.loop = true;
        mainVideo.classList.remove("is-hidden");
        floatingDock.classList.remove("is-hidden");
        try {
          await mainVideo.play();
        } catch (_) {}
      } else if (info && info.embedUrl) {
        mainVideo.pause();
        mainVideo.classList.add("is-hidden");
        floatingDock.classList.add("is-hidden");
        mountEmbed(info.embedUrl);
        notifyHostAspect(9 / 16);
      }
      wakeControls();
    } catch (err) {
      if (token !== resolveToken) return;
      stageLoading.classList.add("is-hidden");
      emptyState.classList.remove("is-hidden");
      floatingDock.classList.add("is-hidden");
      showError((err && err.message) || "Gagal memuat video.");
    }
  }

  function handleIncomingCommand(cmd) {
    if (!cmd || !cmd.item || !cmd.item.mediaUrl) return;
    if (cmd.item.aspectRatio > 0) {
      notifyHostAspect(cmd.item.aspectRatio);
    }
    playVideoUrl(cmd.item.mediaUrl, cmd.item.cover || "");
  }

  function togglePlayPause() {
    if (mainVideo.classList.contains("is-hidden") || !mainVideo.src) return;
    if (mainVideo.paused) {
      mainVideo.play().catch(function () {});
    } else {
      mainVideo.pause();
    }
    wakeControls();
  }

  mainVideo.addEventListener("click", togglePlayPause);
  mainVideo.addEventListener("play", function () {
    playIcon.textContent = "pause";
    wakeControls();
  });
  mainVideo.addEventListener("pause", function () {
    playIcon.textContent = "play_arrow";
    wakeControls();
  });

  mainVideo.addEventListener("loadedmetadata", function () {
    if (mainVideo.videoWidth > 0 && mainVideo.videoHeight > 0) {
      notifyHostAspect(mainVideo.videoWidth / mainVideo.videoHeight);
    }
    var dur = mainVideo.duration || 0;
    timeDur.textContent = U ? U.formatDuration(dur) : "00:00";
    if (!isSeeking) {
      seekSlider.value = 0;
      if (U) U.syncSlider(seekSlider);
    }
  });

  mainVideo.addEventListener("timeupdate", function () {
    if (isSeeking || !mainVideo.duration) return;
    var cur = mainVideo.currentTime || 0;
    timeCur.textContent = U ? U.formatDuration(cur) : "00:00";
    seekSlider.value = Math.round((cur / mainVideo.duration) * 1000);
    if (U) U.syncSlider(seekSlider);
  });

  seekSlider.addEventListener("input", function () {
    isSeeking = true;
    if (U) U.syncSlider(seekSlider);
    if (mainVideo.duration) {
      timeCur.textContent = U.formatDuration((Number(seekSlider.value) / 1000) * mainVideo.duration);
    }
    wakeControls();
  });

  seekSlider.addEventListener("change", function () {
    if (mainVideo.duration) {
      mainVideo.currentTime = (Number(seekSlider.value) / 1000) * mainVideo.duration;
    }
    isSeeking = false;
    wakeControls();
  });

  btnPlay.addEventListener("click", togglePlayPause);

  btnRew.addEventListener("click", function () {
    mainVideo.currentTime = Math.max(0, (mainVideo.currentTime || 0) - 5);
    wakeControls();
  });

  btnFwd.addEventListener("click", function () {
    mainVideo.currentTime = Math.min(mainVideo.duration || 9999, (mainVideo.currentTime || 0) + 5);
    wakeControls();
  });

  emptyForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var clean = normalizeSingleUrl(emptyInput.value);
    if (!clean) {
      showError("Masukkan tautan video yang valid.");
      return;
    }
    emptyInput.value = "";
    playVideoUrl(clean, "");
  });

  stage.addEventListener("mousemove", wakeControls);
  stage.addEventListener("touchstart", wakeControls, { passive: true });

  if (channel) {
    channel.onmessage = function (ev) {
      if (ev && ev.data) {
        try { localStorage.removeItem(CMD_STORAGE_KEY); } catch (_) {}
        handleIncomingCommand(ev.data);
      }
    };
  }

  try {
    var pendingRaw = localStorage.getItem(CMD_STORAGE_KEY);
    if (pendingRaw) {
      var parsed = JSON.parse(pendingRaw);
      var list = Array.isArray(parsed) ? parsed : [parsed];
      var latest = list[list.length - 1];
      if (latest && (Date.now() - (latest.ts || 0)) < 60000) {
        handleIncomingCommand(latest);
      }
      localStorage.removeItem(CMD_STORAGE_KEY);
    }
  } catch (_) {}

  if (U) U.syncSlider(seekSlider);
  wakeControls();
})();
