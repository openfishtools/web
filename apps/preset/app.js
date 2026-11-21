(function () {
  "use strict";

  var U = window.AppUtils;

  var searchInput = document.getElementById("search-input");
  var swFilter = document.getElementById("sw-filter");
  var loadingBox = document.getElementById("loading-box");
  var errorBanner = document.getElementById("error-banner");
  var errorText = document.getElementById("error-text");
  var presetGrid = document.getElementById("preset-grid");
  var variantBackdrop = document.getElementById("variant-backdrop");
  var variantPanel = document.getElementById("variant-panel");
  var variantTitle = document.getElementById("variant-title");
  var variantSub = document.getElementById("variant-sub");
  var variantClose = document.getElementById("variant-close");
  var variantList = document.getElementById("variant-list");

  var THUMB_CACHE_KEY = "cutefish_preset_thumbs_v3";
  var THUMB_TTL_MS = 12 * 60 * 60 * 1000;
  var SLOWTIME_CMD_KEY = "cutefish_slowtime_cmd_v1";
  var slowTimeChannel = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("cutefish_slowtime_channel")
    : null;

  var allPresets = [];
  var selectedSoftware = "all";
  var thumbCache = loadThumbCache();
  var thumbQueue = [];
  var isThumbWorkerRunning = false;
  var lastTikwmCallAt = 0;
  var localResolveSupported = null;
  var renderToken = 0;
  var thumbObserver = null;

  function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove("is-hidden");
  }

  function loadThumbCache() {
    try {
      var raw = localStorage.getItem(THUMB_CACHE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveThumbCacheEntry(mediaUrl, thumbUrl) {
    thumbCache[mediaUrl] = { url: thumbUrl, ts: Date.now() };
    try {
      var now = Date.now();
      Object.keys(thumbCache).forEach(function (k) {
        if (!thumbCache[k] || (now - thumbCache[k].ts) >= THUMB_TTL_MS) {
          delete thumbCache[k];
        }
      });
      localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(thumbCache));
    } catch (_) {}
  }

  function getCachedThumb(mediaUrl) {
    var entry = thumbCache[mediaUrl];
    if (entry && entry.url && (Date.now() - entry.ts) < THUMB_TTL_MS) {
      return entry.url;
    }
    return "";
  }

  function removeCachedThumb(mediaUrl) {
    if (!mediaUrl || !thumbCache[mediaUrl]) return;
    delete thumbCache[mediaUrl];
    try {
      localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(thumbCache));
    } catch (_) {}
  }

  function delayMs(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function resolveTikTokCover(mediaUrl) {
    if (localResolveSupported !== false) {
      try {
        var localRes = await fetch("/api/tiktok-resolve?url=" + encodeURIComponent(mediaUrl));
        var ct = (localRes.headers.get("content-type") || "").toLowerCase();
        if (localRes.ok && ct.indexOf("application/json") !== -1) {
          localResolveSupported = true;
          var lj = await localRes.json();
          if (lj && (lj.cover || lj.origin_cover)) {
            return lj.cover || lj.origin_cover;
          }
        } else {
          localResolveSupported = false;
        }
      } catch (_) {
        localResolveSupported = false;
      }
    }

    for (var attempt = 0; attempt < 2; attempt++) {
      var wait = Math.max(0, 1080 - (Date.now() - lastTikwmCallAt));
      if (wait > 0) await delayMs(wait);
      lastTikwmCallAt = Date.now();

      try {
        var apiRes = await fetch("https://www.tikwm.com/api/?url=" + encodeURIComponent(mediaUrl));
        if (apiRes.ok) {
          var payload = await apiRes.json();
          if (payload && payload.code === 0 && payload.data) {
            var coverUrl = payload.data.cover || payload.data.origin_cover || payload.data.ai_dynamic_cover || "";
            if (coverUrl) return coverUrl;
          }
          if (payload && payload.code === -1 && attempt === 0) {
            await delayMs(1150);
            continue;
          }
        }
      } catch (_) {}
      break;
    }

    try {
      var oeRes = await fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(mediaUrl));
      if (oeRes.ok) {
        var oe = await oeRes.json();
        if (oe && oe.thumbnail_url) return oe.thumbnail_url;
      }
    } catch (_) {}

    return "";
  }

  async function pumpThumbQueue() {
    if (isThumbWorkerRunning) return;
    isThumbWorkerRunning = true;
    try {
      while (thumbQueue.length > 0) {
        var task = thumbQueue.shift();
        if (!task || !task.imgEl || !document.body.contains(task.imgEl)) continue;
        var cached = getCachedThumb(task.mediaUrl);
        var thumbUrl = cached || await resolveTikTokCover(task.mediaUrl);
        if (thumbUrl) {
          saveThumbCacheEntry(task.mediaUrl, thumbUrl);
          if (document.body.contains(task.imgEl)) {
            task.imgEl.src = thumbUrl;
          }
        }
      }
    } finally {
      isThumbWorkerRunning = false;
      if (thumbQueue.length > 0) pumpThumbQueue();
    }
  }

  function queueThumbLoad(mediaUrl, imgEl) {
    if (!mediaUrl || !imgEl) return;
    var cached = getCachedThumb(mediaUrl);
    if (cached) {
      imgEl.src = cached;
      return;
    }
    thumbQueue.push({ mediaUrl: mediaUrl, imgEl: imgEl });
    pumpThumbQueue();
  }

  function buildPresetDownloads(preset) {
    var links = [];
    var seen = {};
    function push(badge, label, url) {
      if (!url || seen[url]) return;
      seen[url] = true;
      links.push({ badge: badge, label: label, url: url });
    }

    if (Array.isArray(preset.urls)) {
      preset.urls.forEach(function (u) {
        if (!u || !u.url) return;
        if (u.sw === "OFTS") push("OFTS", "Download OFTS", u.url);
        else if (u.sw === "AE") push("AE", "After Effects Preset", u.url);
        else if (u.sw === "AM") push("AM", "Alight Motion Preset", u.url);
        else push(u.sw || "FILE", u.sw || "Download Preset", u.url);
      });
    }
    if (preset.url) push("PRESET", "Download Preset", preset.url);
    if (preset.am5MbUrl) push("AM 5MB", "Alight Motion (< 5 MB)", preset.am5MbUrl);
    if (preset.amPremiumUrl) push("AM PRO", "Alight Motion (Premium)", preset.amPremiumUrl);
    if (preset.amXmlUrl) push("XML", "Alight Motion (XML)", preset.amXmlUrl);
    if (Array.isArray(preset.amXmlExtras)) {
      preset.amXmlExtras.forEach(function (ex) {
        if (ex && ex.url) push("EXTRA", ex.label || "File Tambahan", ex.url);
      });
    }
    return links;
  }

  function closeVariantSheet() {
    variantBackdrop.classList.add("is-hidden");
    variantList.innerHTML = "";
  }

  function openVariantSheet(preset, links) {
    variantTitle.textContent = preset.name || "Pilih Varian";
    variantSub.textContent = [
      (preset.software || []).join(" / "),
      preset.version,
      preset.size,
      preset.plugin
    ].filter(Boolean).join(" • ") || "-";
    variantList.innerHTML = "";

    links.forEach(function (lnk) {
      var a = document.createElement("a");
      a.className = "preset-variant-item";
      a.href = lnk.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      var left = document.createElement("div");
      left.className = "preset-variant-left";

      var badge = document.createElement("span");
      badge.className = "preset-variant-badge";
      badge.textContent = lnk.badge || "FILE";

      var lbl = document.createElement("span");
      lbl.className = "preset-variant-label";
      lbl.textContent = lnk.label;

      left.appendChild(badge);
      left.appendChild(lbl);

      var ico = document.createElement("span");
      ico.className = "material-symbols-rounded";
      ico.setAttribute("aria-hidden", "true");
      ico.textContent = "download";

      a.appendChild(left);
      a.appendChild(ico);
      a.addEventListener("click", function () {
        closeVariantSheet();
      });
      variantList.appendChild(a);
    });

    variantBackdrop.classList.remove("is-hidden");
  }

  function sendToSlowTime(preset, mode, triggerEl, imgEl) {
    var ratio = (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0)
      ? (imgEl.naturalWidth / imgEl.naturalHeight)
      : 0;
    var payload = {
      type: mode === "queue" ? "queue" : "play",
      ts: Date.now(),
      item: {
        id: "preset-" + (preset.presetId || preset.id),
        title: preset.name,
        mediaUrl: preset.media,
        cover: getCachedThumb(preset.media) || "",
        aspectRatio: ratio,
        meta: [
          (preset.software || []).join("/"),
          preset.version,
          preset.size,
          preset.plugin
        ].filter(Boolean).join(" \u2022 "),
        links: buildPresetDownloads(preset)
      }
    };

    try {
      localStorage.setItem(SLOWTIME_CMD_KEY, JSON.stringify([payload]));
    } catch (_) {}

    if (slowTimeChannel) {
      try {
        slowTimeChannel.postMessage(payload);
      } catch (_) {}
    }

    var hostWin = window.parent;
    if (mode !== "queue" || !(hostWin && hostWin !== window)) {
      if (hostWin && hostWin !== window && hostWin.AppWindow && hostWin.AppRegistry) {
        var slowtimeApp = hostWin.AppRegistry.getById("slowtime") || {
          id: "slowtime",
          title: "SlowTime",
          icon: "slowtime.svg",
          entry: "apps/slowtime/index.html"
        };
        hostWin.AppWindow.open(slowtimeApp, triggerEl);
      } else if (mode !== "queue") {
        window.open("../slowtime/index.html", "_blank", "noopener");
      }
    }
  }

  function buildPresetCard(preset) {
    var card = document.createElement("article");
    card.className = "preset-video-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Putar " + preset.name + " di SlowTime");

    var thumbBox = document.createElement("div");
    thumbBox.className = "preset-thumb-box";

    var img = document.createElement("img");
    img.className = "preset-thumb-img";
    img.alt = preset.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.dataset.mediaUrl = preset.media || "";
    img.addEventListener("load", function () {
      img.classList.add("is-loaded");
    });
    img.addEventListener("error", function () {
      img.classList.remove("is-loaded");
      if (!img.dataset.retried && preset.media) {
        img.dataset.retried = "1";
        removeCachedThumb(preset.media);
        queueThumbLoad(preset.media, img);
      }
    });

    var cachedThumb = getCachedThumb(preset.media);
    if (cachedThumb) {
      img.src = cachedThumb;
    } else if (thumbObserver && preset.media) {
      thumbObserver.observe(img);
    } else if (preset.media) {
      queueThumbLoad(preset.media, img);
    }

    var fallback = document.createElement("div");
    fallback.className = "preset-thumb-fallback";
    fallback.textContent = "#" + (preset.presetId || "");

    var scrim = document.createElement("div");
    scrim.className = "preset-thumb-scrim";

    var topBadges = document.createElement("div");
    topBadges.className = "preset-top-badges";

    var swPill = document.createElement("span");
    swPill.className = "preset-pill";
    swPill.textContent = (preset.software && preset.software.length > 0) ? preset.software.join(" • ") : "-";

    var idPill = document.createElement("span");
    idPill.className = "preset-pill";
    idPill.textContent = "#" + (preset.presetId || "-");

    topBadges.appendChild(swPill);
    topBadges.appendChild(idPill);

    var overlayMeta = document.createElement("div");
    overlayMeta.className = "preset-overlay-meta";

    var nameEl = document.createElement("div");
    nameEl.className = "preset-card-name";
    nameEl.textContent = preset.name;

    var subEl = document.createElement("div");
    subEl.className = "preset-card-sub";
    subEl.textContent = [preset.version, preset.size, preset.plugin].filter(Boolean).join(" • ") || "-";

    overlayMeta.appendChild(nameEl);
    overlayMeta.appendChild(subEl);

    thumbBox.appendChild(img);
    thumbBox.appendChild(fallback);
    thumbBox.appendChild(scrim);
    thumbBox.appendChild(topBadges);
    thumbBox.appendChild(overlayMeta);

    card.appendChild(thumbBox);

    var dlLinks = buildPresetDownloads(preset);
    if (dlLinks.length > 0) {
      var footer = document.createElement("div");
      footer.className = "preset-card-footer";

      if (dlLinks.length === 1) {
        var singleDl = document.createElement("a");
        singleDl.className = "preset-dl-btn";
        singleDl.href = dlLinks[0].url;
        singleDl.target = "_blank";
        singleDl.rel = "noopener noreferrer";
        singleDl.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span><span>Download</span>';
        singleDl.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        footer.appendChild(singleDl);
      } else {
        var multiBtn = document.createElement("button");
        multiBtn.type = "button";
        multiBtn.className = "preset-dl-btn";
        multiBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">download</span><span>Download</span>';
        multiBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openVariantSheet(preset, dlLinks);
        });
        footer.appendChild(multiBtn);
      }

      card.appendChild(footer);
    }

    card.addEventListener("click", function () {
      sendToSlowTime(preset, "play", card, img);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        sendToSlowTime(preset, "play", card, img);
      }
    });

    return card;
  }

  function renderGrid(items) {
    var myToken = ++renderToken;
    presetGrid.innerHTML = "";
    thumbQueue = [];
    if (thumbObserver) {
      thumbObserver.disconnect();
      thumbObserver = null;
    }

    if (items.length === 0) {
      var empty = document.createElement("div");
      empty.className = "app-list-empty";
      empty.style.gridColumn = "1 / -1";
      empty.textContent = "Tidak ada preset yang cocok.";
      presetGrid.appendChild(empty);
      return;
    }

    if ("IntersectionObserver" in window) {
      thumbObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          thumbObserver.unobserve(img);
          queueThumbLoad(img.dataset.mediaUrl, img);
        });
      }, { rootMargin: "80px" });
    }

    var BATCH_SIZE = 8;
    var offset = 0;

    function appendBatch() {
      if (myToken !== renderToken) return;
      var frag = document.createDocumentFragment();
      var end = Math.min(items.length, offset + BATCH_SIZE);
      for (var i = offset; i < end; i++) {
        frag.appendChild(buildPresetCard(items[i]));
      }
      presetGrid.appendChild(frag);
      offset = end;
      if (offset < items.length) {
        requestAnimationFrame(appendBatch);
      }
    }

    appendBatch();
  }

  function applyFilter() {
    var q = String(searchInput.value || "").trim().toLowerCase();
    var filtered = allPresets.filter(function (p) {
      if (selectedSoftware !== "all") {
        if (!Array.isArray(p.software) || p.software.indexOf(selectedSoftware) === -1) {
          return false;
        }
      }
      if (!q) return true;
      var haystack = [
        p.name,
        p.plugin,
        p.version,
        p.size,
        String(p.presetId || ""),
        (p.software || []).join(" ")
      ].join(" ").toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    renderGrid(filtered);
  }

  async function initPresets() {
    loadingBox.classList.remove("is-hidden");
    try {
      var res = await fetch("/api/presets");
      var ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.indexOf("application/json") === -1) {
        throw new Error("Endpoint /api/presets tidak aktif di server ini (" + res.status + ").");
      }
      var data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) || ("Gagal memuat data preset (" + res.status + ")."));
      }
      allPresets = Array.isArray(data && data.items) ? data.items : [];
      applyFilter();
    } catch (err) {
      showError((err && err.message) || "Gagal memuat galeri preset.");
    } finally {
      loadingBox.classList.add("is-hidden");
    }
  }

  if (U && typeof U.bindSegmented === "function") {
    U.bindSegmented(swFilter, "sw", function (sw) {
      selectedSoftware = sw || "all";
      applyFilter();
    });
  }

  variantClose.addEventListener("click", closeVariantSheet);
  variantBackdrop.addEventListener("click", function (e) {
    if (e.target === variantBackdrop) closeVariantSheet();
  });
  variantPanel.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !variantBackdrop.classList.contains("is-hidden")) {
      closeVariantSheet();
    }
  });

  searchInput.addEventListener("input", applyFilter);
  initPresets();
})();
