(function () {
  "use strict";

  var U = window.AppUtils;
  var FF = window.CutefishFFmpeg;

  var STRINGS = {
    status_encoding: "Mengompresi video",
    status_finalizing: "Menyimpan hasil...",
    status_completed: "Selesai",
    status_completed_toast: "Video selesai diproses"
  };
  window.getTranslation = function (key) {
    return STRINGS[key] || key;
  };

  var enhancerModeGroup = document.getElementById("enhancer-mode-group");
  var directPane = document.getElementById("direct-pane");
  var extensionPane = document.getElementById("extension-pane");
  var extVer = document.getElementById("ext-ver");
  var extSize = document.getElementById("ext-size");
  var extDate = document.getElementById("ext-date");
  var extBtnDownload = document.getElementById("ext-btn-download");
  var extBtnGithub = document.getElementById("ext-btn-github");
  var extVideoWrap = document.getElementById("ext-video-wrap");
  var extVideoStub = document.getElementById("ext-video-stub");

  var EXT_GITHUB_LATEST = "https://api.github.com/repos/cutefishaep/fp-ext/releases/latest";
  var EXT_JSDELIVR_PKGS = "https://data.jsdelivr.com/v1/packages/gh/cutefishaep/fp-ext";
  var EXT_RELEASES_URL = "https://github.com/cutefishaep/fp-ext/releases";
  var EXT_CACHE_KEY = "fp_ext_latest_loader_cache";
  var EXT_TUTORIAL_WATCH = "https://www.youtube.com/shorts/xftaz12NQMo";
  var EXT_TUTORIAL_EMBED = "https://www.youtube-nocookie.com/embed/xftaz12NQMo?rel=0&autoplay=1";
  var extLoadedOnce = false;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("file-input");
  var workspace = document.getElementById("workspace");
  var fileNameEl = document.getElementById("file-name");
  var fileDetailsEl = document.getElementById("file-details");
  var btnChangeFile = document.getElementById("btn-change-file");

  var methodGroup = document.getElementById("method-group");
  var compressField = document.getElementById("compress-field");
  var compressGroup = document.getElementById("compress-group");
  var compressOffBtn = document.getElementById("compress-off-btn");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statOriginal = document.getElementById("stat-original");
  var statOutput = document.getElementById("stat-output");
  var statMethod = document.getElementById("stat-method");

  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var sharedConfig = null;
  var currentFile = null;
  var currentBuffer = null;
  var currentSpecs = null;
  var selectedMethod = "fish";
  var compressMode = "off";
  var isProcessing = false;

  (async function loadSharedMethodsConfig() {
    try {
      var res = await fetch("../../assets/vendor/tiktok-method/methods.json", { cache: "no-store" });
      if (!res.ok) return;
      var cfg = await res.json();
      if (!cfg || !Array.isArray(cfg.methods)) return;
      sharedConfig = cfg;
      if (window._tktk && cfg.compress) window._tktk.compressConfig = cfg.compress;
      if (cfg.defaultMethod) selectedMethod = cfg.defaultMethod;

      if (methodGroup && cfg.methods.length) {
        methodGroup.innerHTML = cfg.methods.map(function (m) {
          var active = m.id === selectedMethod;
          return '<button type="button" class="m3-segment' + (active ? ' is-active' : '') + '" data-method="' + m.id + '" role="radio" aria-checked="' + (active ? 'true' : 'false') + '">' + (m.name || m.id) + '</button>';
        }).join("");
        U.bindSegmented(methodGroup, "method", function (m) {
          selectedMethod = m || selectedMethod;
          syncCompressUI();
        });
      }

      if (compressGroup && Array.isArray(cfg.compressModes) && cfg.compressModes.length) {
        compressGroup.innerHTML = cfg.compressModes.map(function (cm) {
          var active = cm.id === compressMode;
          var extraId = cm.id === "off" ? ' id="compress-off-btn"' : "";
          return '<button type="button" class="m3-segment' + (active ? ' is-active' : '') + '" data-compress="' + cm.id + '"' + extraId + ' role="radio" aria-checked="' + (active ? 'true' : 'false') + '">' + (cm.label || cm.id) + '</button>';
        }).join("");
        compressOffBtn = document.getElementById("compress-off-btn");
        U.bindSegmented(compressGroup, "compress", function (c) {
          compressMode = c || "off";
        });
      }

      var loadedItems = (window.TikTokMethods && Array.isArray(window.TikTokMethods._items)) ? window.TikTokMethods._items : [];
      cfg.methods.forEach(function (m) {
        if (!m.file || loadedItems.some(function (x) { return x.id === m.id; })) return;
        var s = document.createElement("script");
        s.src = "../../assets/vendor/tiktok-method/" + m.file;
        s.defer = true;
        document.head.appendChild(s);
      });
      syncCompressUI();
    } catch (_) {}
  })();

  function setProgress(pct, status) {
    progressBox.classList.remove("is-hidden");
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    if (status) progressStatus.textContent = status;
  }

  function parseFpsFromMp4(buffer) {
    return window.CutefishMethodEngine ? window.CutefishMethodEngine.parseFpsFromMp4(buffer) : 60;
  }

  function parseResolutionFromMp4(buffer) {
    return window.CutefishMethodEngine ? window.CutefishMethodEngine.parseResolutionFromMp4(buffer) : { width: 1080, height: 1920 };
  }

  function computeVideoProcessingOptions(w, h, fps, fileMB, mode) {
    if (window.CutefishMethodEngine) {
      return window.CutefishMethodEngine.computeVideoProcessingOptions(w, h, fps, fileMB, mode);
    }
    return { width: w || 1080, height: h || 1920, vfString: 'format=yuv420p' };
  }

  async function inspectSpecs(file) {
    var meta = await U.probeVideoMetadata(file);
    var head = await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer();
    var fps = parseFpsFromMp4(head);
    var res = parseResolutionFromMp4(head);
    if ((!fps || fps === 60) && file.size > 2 * 1024 * 1024) {
      var tailStart = Math.max(0, file.size - 4 * 1024 * 1024);
      var tail = await file.slice(tailStart, file.size).arrayBuffer();
      var tailFps = parseFpsFromMp4(tail);
      if (tailFps) fps = tailFps;
    }
    return {
      width: meta.width || res.width || 1080,
      height: meta.height || res.height || 1920,
      duration: meta.duration || 0,
      fps: fps || 60,
      size: file.size || 0
    };
  }

  function isOver1080p() {
    if (!currentSpecs || !window.CutefishMethodEngine) return false;
    return window.CutefishMethodEngine.checkVideoLimits(currentSpecs, sharedConfig && sharedConfig.compress).exceedsLimit;
  }

  function syncCompressUI() {
    var methodObj = window.TikTokMethods ? window.TikTokMethods.getById(selectedMethod) : null;
    var supportsCompress = !methodObj || methodObj.supportsCompress !== false;
    compressField.classList.toggle("is-hidden", !supportsCompress);

    var mustCompress = supportsCompress && isOver1080p();
    compressOffBtn.disabled = mustCompress;
    if (mustCompress && compressMode === "off") {
      compressMode = "1080p";
    }

    compressGroup.querySelectorAll(".m3-segment").forEach(function (seg) {
      var active = seg.dataset.compress === compressMode;
      seg.classList.toggle("is-active", active);
      seg.setAttribute("aria-checked", active ? "true" : "false");
    });

  }

  window._tktk = {
    get isProcessing() { return isProcessing; },
    set isProcessing(v) { isProcessing = v; },
    get currentFileBuffer() { return currentBuffer; },
    set currentFileBuffer(v) { currentBuffer = v; },
    get selectedFile() { return currentFile; },
    set selectedFile(v) { currentFile = v; },
    get compressMode() { return compressMode; },
    activeContext: { headless: true },
    statusText: {
      set innerHTML(val) {
        progressStatus.textContent = String(val || "").replace(/<[^>]+>/g, "").trim();
      }
    },
    progressFill: progressFill,
    progressPercent: progressPercent,
    progressText: progressStatus,
    logsEl: {
      get textContent() { return ""; },
      set textContent(v) {
        if (v) logger.append(v);
      }
    },
    log: function (m) { logger.append(m); },
    logSection: function (title) { logger.append("--- " + title + " ---"); },
    logEnd: function () {},
    appendToLogsEl: function (m) {
      var s = String(m || "");
      if (s.indexOf("frame=") !== -1 || s.toLowerCase().indexOf("error") !== -1) {
        logger.append(s);
      }
    },
    loadFFmpegLibraries: FF.loadFFmpegLibraries || FF.loadFFmpegScript,
    toBlobURL: FF.toBlobURL,
    loadFFmpegHelper: function (_ff, _toBlob, forceST) {
      return FF.createInstance({
        forceSingleThread: Boolean(forceST),
        log: function (m) { logger.append(m); }
      });
    },
    parseFpsFromMp4: parseFpsFromMp4,
    parseResolutionFromMp4: parseResolutionFromMp4,
    computeVideoProcessingOptions: computeVideoProcessingOptions,
    isMobileDevice: FF.isMobileDevice
  };

  async function loadExtensionRelease() {
    if (extLoadedOnce) return;
    extLoadedOnce = true;
    var release = null;

    try {
      var cachedRaw = sessionStorage.getItem(EXT_CACHE_KEY);
      if (cachedRaw) {
        var cachedParsed = JSON.parse(cachedRaw);
        if (cachedParsed && (Date.now() - cachedParsed.timestamp) < 10 * 60 * 1000 && cachedParsed.data) {
          release = cachedParsed.data;
        }
      }
    } catch (_) {}

    if (!release) {
      try {
        var ghRes = await fetch(EXT_GITHUB_LATEST, { headers: { Accept: "application/vnd.github.v3+json" } });
        if (ghRes.ok) {
          var ghData = await ghRes.json();
          var zipAsset = Array.isArray(ghData.assets)
            ? (
                ghData.assets.find(function (a) { return String(a.name || "").toLowerCase() === "loader.zip"; }) ||
                ghData.assets.find(function (a) {
                  var name = String(a.name || "").toLowerCase();
                  return name.endsWith(".zip") && name !== "core.zip";
                })
              )
            : null;
          if (ghData.tag_name && zipAsset) {
            release = {
              tag: ghData.tag_name,
              publishedAt: ghData.published_at || null,
              zipUrl: zipAsset.browser_download_url,
              zipSize: zipAsset.size || null,
              releaseUrl: ghData.html_url || EXT_RELEASES_URL
            };
          }
        }
      } catch (_) {}
    }

    if (!release) {
      try {
        var jdRes = await fetch(EXT_JSDELIVR_PKGS);
        if (jdRes.ok) {
          var jdData = await jdRes.json();
          var versions = Array.isArray(jdData.versions) ? jdData.versions : [];
          var latest = versions.find(function (v) { return v && v.version && !v.dev; });
          if (latest) {
            var rawVer = String(latest.version).trim();
            var tag = rawVer.startsWith("v") ? rawVer : ("v" + rawVer);
            release = {
              tag: tag,
              publishedAt: null,
              zipUrl: EXT_RELEASES_URL + "/download/" + tag + "/loader.zip",
              zipSize: null,
              releaseUrl: EXT_RELEASES_URL + "/tag/" + tag
            };
          }
        }
      } catch (_) {}
    }

    if (release) {
      try {
        sessionStorage.setItem(EXT_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: release }));
      } catch (_) {}
    }

    extVer.textContent = release && release.tag ? release.tag : "\u2014";
    extSize.textContent = (release && release.zipSize) ? U.formatBytes(release.zipSize) : "\u2014";
    if (release && release.publishedAt) {
      try {
        var dateLocale = (window.CutefishI18n && typeof window.CutefishI18n.locale === "function")
          ? window.CutefishI18n.locale()
          : "id-ID";
        extDate.textContent = new Date(release.publishedAt).toLocaleDateString(dateLocale, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch (_) {
        extDate.textContent = "\u2014";
      }
    } else {
      extDate.textContent = "\u2014";
    }
    if (release && release.zipUrl) {
      extBtnDownload.href = release.zipUrl;
      extBtnDownload.setAttribute("download", "loader.zip");
    }
    if (release && release.releaseUrl) extBtnGithub.href = release.releaseUrl;
  }

  U.bindSegmented(enhancerModeGroup, "mode", function (m) {
    var isExt = m === "extension";
    directPane.classList.toggle("is-hidden", isExt);
    extensionPane.classList.toggle("is-hidden", !isExt);
    if (isExt) loadExtensionRelease();
  });

  if (extVideoStub) {
    extVideoStub.addEventListener("click", function () {
      if (window.crossOriginIsolated === true) {
        window.open(EXT_TUTORIAL_WATCH, "_blank", "noopener,noreferrer");
        return;
      }
      var ifr = document.createElement("iframe");
      ifr.className = "enhancer-video-frame";
      ifr.src = EXT_TUTORIAL_EMBED;
      ifr.title = "Tutorial Fish Acceleration";
      ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      ifr.referrerPolicy = "strict-origin-when-cross-origin";
      ifr.allowFullscreen = true;
      extVideoWrap.innerHTML = "";
      extVideoWrap.appendChild(ifr);
    });
  }

  U.bindDropzone(dropzone, fileInput, handleFile);

  btnChangeFile.addEventListener("click", function () {
    if (isProcessing) return;
    fileInput.value = "";
    fileInput.click();
  });

  U.bindSegmented(methodGroup, "method", function (m) {
    selectedMethod = m || "fish";
    syncCompressUI();
  });

  U.bindSegmented(compressGroup, "compress", function (c) {
    compressMode = c || "off";
  });

  async function handleFile(file) {
    if (!file || !file.type.startsWith("video/")) {
      logger.setBadge("Error");
      logger.append("Pilih file video yang valid.");
      return;
    }

    currentFile = file;
    currentBuffer = null;
    currentSpecs = null;
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_awesome</span> Proses Video';
    logger.setBadge("Ready");

    currentSpecs = await inspectSpecs(file);
    if (currentFile !== file) return;

    var details = [
      U.formatBytes(file.size),
      currentSpecs.width + "x" + currentSpecs.height,
      currentSpecs.fps + " FPS"
    ];
    if (currentSpecs.duration) details.push(U.formatDuration(currentSpecs.duration));
    fileDetailsEl.textContent = details.join(" \u2022 ");
    logger.append("Video dimuat: " + file.name + " (" + details.join(", ") + ")");
    syncCompressUI();
  }

  btnStart.addEventListener("click", function () {
    if (!currentFile || isProcessing) return;
    runPipeline();
  });

  async function runPipeline() {
    var activeMethod = window.TikTokMethods ? window.TikTokMethods.getById(selectedMethod) : null;
    if (!activeMethod || typeof activeMethod.patch !== "function") {
      logger.setBadge("Error");
      logger.append("Engine metode " + selectedMethod.toUpperCase() + " belum siap.");
      return;
    }

    isProcessing = true;
    var startedAt = performance.now();
    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Memproses...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");
    setProgress(5, "Membaca buffer video...");

    try {
      if (!currentBuffer) {
        currentBuffer = await currentFile.arrayBuffer();
      }

      var eng = window.CutefishMethodEngine;
      var pipeRes = await eng.runPipeline({
        file: currentFile,
        buffer: currentBuffer,
        duration: currentSpecs ? currentSpecs.duration : 0,
        methodId: selectedMethod,
        compressMode: compressMode,
        doBypass: true,
        compressCfg: sharedConfig ? sharedConfig.compress : null,
        _tktk: window._tktk,
        onProgress: setProgress,
        log: function (m) { logger.append(m); }
      });

      var finalized = window.finalizePatcherDownload(currentFile, pipeRes.bytes, pipeRes.outputOptions || "hd");
      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);

      progressBox.classList.add("is-hidden");
      statOriginal.textContent = U.formatBytes(currentFile.size);
      statOutput.textContent = U.formatBytes(finalized.blob.size);
      statMethod.textContent = activeMethod.name;
      statsGrid.classList.remove("is-hidden");

      logger.setBadge("Done");
      logger.append("Selesai dalam " + elapsed + "s \u2022 " + U.formatBytes(finalized.blob.size));
      logger.append("Mengunduh otomatis: " + finalized.filename);
      U.triggerDownload(finalized.url, finalized.filename);

      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_awesome</span> Proses Ulang';
    } catch (err) {
      logger.setBadge("Error");
      logger.append("Gagal: " + (err && err.message ? err.message : String(err)));
      progressBox.classList.add("is-hidden");
      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_awesome</span> Coba Lagi';
    } finally {
      isProcessing = false;
      btnStart.disabled = false;
    }
  }
})();
