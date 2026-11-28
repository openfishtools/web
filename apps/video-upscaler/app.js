(function () {
  "use strict";

  var U = window.AppUtils;
  var FF = window.CutefishFFmpeg;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("file-input");
  var workspace = document.getElementById("workspace");
  var fileIconEl = document.getElementById("file-icon");
  var fileNameEl = document.getElementById("file-name");
  var fileDetailsEl = document.getElementById("file-details");
  var btnAddFiles = document.getElementById("btn-add-files");
  var btnChangeFile = document.getElementById("btn-change-file");

  var queuePanel = document.getElementById("queue-panel");
  var queueList = document.getElementById("queue-list");
  var queueCountBadge = document.getElementById("queue-count-badge");

  var compareStage = document.getElementById("compare-stage");
  var origClip = document.getElementById("orig-clip");
  var compareClip = document.getElementById("compare-clip");
  var compareDivider = document.getElementById("compare-divider");
  var layerOrig = document.getElementById("layer-orig");
  var layerEnhanced = document.getElementById("layer-enhanced");
  var previewVideo = document.getElementById("preview-video");
  var previewImage = document.getElementById("preview-image");
  var origFrameCanvas = document.getElementById("orig-frame");
  var enhancedVideo = document.getElementById("enhanced-video");
  var previewCanvas = document.getElementById("preview-canvas");
  var unprocessedOverlay = document.getElementById("unprocessed-overlay");
  var labelRight = document.getElementById("label-right");
  var zoomBadge = document.getElementById("zoom-badge");

  var scrubberRow = document.getElementById("scrubber-row");
  var durationSlider = document.getElementById("duration-slider");
  var durationLabel = document.getElementById("duration-label");

  var presetGroup = document.getElementById("preset-group");
  var timingGroup = document.getElementById("timing-group");
  var checkNormalise = document.getElementById("check-normalise");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statOriginal = document.getElementById("stat-original");
  var statOutput = document.getElementById("stat-output");
  var statElapsed = document.getElementById("stat-elapsed");

  var btnPreview = document.getElementById("btn-preview");
  var btnDownloadAll = document.getElementById("btn-download-all");
  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var PRESETS = {
    cartoonist: { sharpen: 14, unsharpAmount: 107, unsharpRadius: 5.1, denoise: 2.9, shadows: 2, saturation: 1 },
    cartoonist2: { sharpen: 20, unsharpAmount: 120, unsharpRadius: 10, denoise: 2, shadows: 4, saturation: 1.3 },
    humanDetail: { sharpen: 100, denoise: 1.2 },
    smoothFace: { sharpen: 26, unsharpRadius: 4.5 },
    idgaf: { sharpen: 100 },
    none: {}
  };

  var UPSCALE_FACTOR = 4;
  var queueItems = [];
  var nextQueueId = 1;
  var filePickMode = "replace";
  var currentFile = null;
  var currentObjectUrl = null;
  var enhancedVideoUrl = null;
  var isImageMode = false;
  var activePreset = "cartoonist";
  var enhanceTiming = "before";
  var isProcessing = false;
  var isGeneratingPreview = false;
  var previewActive = false;

  var sliderPos = 50;
  var zoom = 1;
  var pan = { x: 0, y: 0 };

  var gpuEnhancer = null;
  var worker = null;
  var activeJob = null;
  var ffmpeg = null;

  function setProgress(pct, status) {
    progressBox.classList.remove("is-hidden");
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    if (status) progressStatus.textContent = status;
  }

  function formatScrubTime(sec) {
    if (!sec || !isFinite(sec) || sec < 0) return "00:00.0";
    var m = Math.floor(sec / 60);
    var s = (sec - m * 60).toFixed(1);
    return String(m).padStart(2, "0") + ":" + (parseFloat(s) < 10 ? "0" : "") + s;
  }

  function isSupportedMediaFile(file) {
    if (!file) return false;
    if (file.type && (file.type.startsWith("image/") || file.type.startsWith("video/"))) return true;
    return /\.(png|jpe?g|webp|bmp|gif|avif|mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name || "");
  }

  function isBatchMode() {
    return queueItems.length > 1;
  }

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    if (file.type && file.type.startsWith("video/")) return false;
    return /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(file.name || "");
  }

  function getPresetParams(id) {
    var p = PRESETS[id] || PRESETS.cartoonist;
    return {
      sharpen: p.sharpen || 0,
      unsharpAmount: p.unsharpAmount || 0,
      unsharpRadius: p.unsharpRadius || 0,
      denoise: p.denoise || 0,
      brightness: p.brightness || 0,
      contrast: p.contrast || 1,
      shadows: p.shadows || 0,
      hue: p.hue || 0,
      saturation: p.saturation !== undefined ? p.saturation : 1
    };
  }

  function applyCropTo916(src) {
    var w = src.naturalWidth || src.width;
    var h = src.naturalHeight || src.height;
    if (!w || !h) return null;
    var targetAspect = 9 / 16;
    var srcAspect = w / h;
    if (Math.abs(srcAspect - targetAspect) < 0.001) return null;
    var cropW = srcAspect > targetAspect ? Math.round(h * targetAspect) : w;
    var cropH = srcAspect > targetAspect ? h : Math.round(w / targetAspect);
    var cropX = Math.floor((w - cropW) / 2);
    var cropY = Math.floor((h - cropH) / 2);
    var out = document.createElement("canvas");
    out.width = cropW;
    out.height = cropH;
    var ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return out;
  }

  function resizeTo1080x1920(src) {
    var out = document.createElement("canvas");
    out.width = 1080;
    out.height = 1920;
    var ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, 1080, 1920);
    return out;
  }

  /* ===== Before / After Slider, Zoom & Pan ===== */
  function updateSliderVisuals() {
    origClip.style.clipPath = "polygon(0 0, " + sliderPos + "% 0, " + sliderPos + "% 100%, 0 100%)";
    compareClip.style.clipPath = "polygon(" + sliderPos + "% 0, 100% 0, 100% 100%, " + sliderPos + "% 100%)";
    compareDivider.style.left = sliderPos + "%";
  }

  function applyTransform() {
    var transform = "translate(" + pan.x + "px, " + pan.y + "px) scale(" + zoom + ")";
    layerOrig.style.transform = transform;
    layerEnhanced.style.transform = transform;
  }

  function clampPan() {
    var maxX = (compareStage.offsetWidth * (zoom - 1)) / 2;
    var maxY = (compareStage.offsetHeight * (zoom - 1)) / 2;
    pan.x = Math.max(-maxX, Math.min(maxX, pan.x));
    pan.y = Math.max(-maxY, Math.min(maxY, pan.y));
  }

  function updateZoomBadge() {
    if (zoom > 1.01) {
      zoomBadge.textContent = zoom.toFixed(1) + "x";
      zoomBadge.classList.remove("is-hidden");
    } else {
      zoomBadge.classList.add("is-hidden");
    }
  }

  function resetViewTransform() {
    zoom = 1;
    pan = { x: 0, y: 0 };
    sliderPos = 50;
    applyTransform();
    updateSliderVisuals();
    updateZoomBadge();
  }

  (function bindCompareStage() {
    var activePointers = new Map();
    var isDraggingSlider = false;
    var isPanning = false;
    var isPinching = false;
    var panStart = { x: 0, y: 0 };
    var panOrigin = { x: 0, y: 0 };
    var pinchStartDist = 0;
    var pinchStartZoom = 1;

    function updateCursor() {
      compareStage.style.cursor = zoom > 1 ? (isPanning ? "grabbing" : "grab") : "col-resize";
    }

    function moveSlider(clientX) {
      var rect = compareStage.getBoundingClientRect();
      if (rect.width <= 0) return;
      sliderPos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      updateSliderVisuals();
    }

    function isNearDivider(clientX) {
      var rect = compareStage.getBoundingClientRect();
      if (rect.width <= 0) return false;
      var dividerX = rect.left + (sliderPos / 100) * rect.width;
      return Math.abs(clientX - dividerX) < 34;
    }

    compareStage.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { compareStage.setPointerCapture(e.pointerId); } catch (_) {}

      if (activePointers.size === 2) {
        isPinching = true;
        isDraggingSlider = false;
        isPanning = false;
        var pts = Array.from(activePointers.values());
        pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchStartZoom = zoom;
        return;
      }

      if (zoom <= 1 || isNearDivider(e.clientX)) {
        isDraggingSlider = true;
        isPanning = false;
        moveSlider(e.clientX);
      } else {
        isPanning = true;
        isDraggingSlider = false;
        panStart = { x: e.clientX, y: e.clientY };
        panOrigin = { x: pan.x, y: pan.y };
        updateCursor();
      }
    });

    compareStage.addEventListener("pointermove", function (e) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (isPinching && activePointers.size >= 2) {
        var pts = Array.from(activePointers.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchStartDist > 0) {
          zoom = Math.max(1, Math.min(5, pinchStartZoom * (dist / pinchStartDist)));
          if (zoom <= 1) { zoom = 1; pan = { x: 0, y: 0 }; }
          clampPan();
          applyTransform();
          updateZoomBadge();
        }
        return;
      }

      if (isDraggingSlider) {
        moveSlider(e.clientX);
      } else if (isPanning) {
        pan.x = panOrigin.x + (e.clientX - panStart.x);
        pan.y = panOrigin.y + (e.clientY - panStart.y);
        clampPan();
        applyTransform();
      }
    });

    function onEnd(e) {
      activePointers.delete(e.pointerId);
      try { compareStage.releasePointerCapture(e.pointerId); } catch (_) {}
      if (activePointers.size < 2) isPinching = false;
      if (activePointers.size === 0) {
        isDraggingSlider = false;
        isPanning = false;
        updateCursor();
      }
    }

    compareStage.addEventListener("pointerup", onEnd);
    compareStage.addEventListener("pointercancel", onEnd);

    compareStage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.max(1, Math.min(5, zoom * factor));
      if (zoom <= 1) { zoom = 1; pan = { x: 0, y: 0 }; }
      clampPan();
      applyTransform();
      updateCursor();
      updateZoomBadge();
    }, { passive: false });
  })();

  function drawOriginalToRightCanvas() {
    var src = isImageMode ? previewImage : previewVideo;
    var w = src.naturalWidth || src.videoWidth || 0;
    var h = src.naturalHeight || src.videoHeight || 0;
    if (!w || !h) return;

    var maxLimit = FF.isMobileDevice() ? 960 : 1920;
    var dw = w;
    var dh = h;
    if (Math.max(w, h) > maxLimit) {
      var s = maxLimit / Math.max(w, h);
      dw = Math.round(w * s);
      dh = Math.round(h * s);
    }
    previewCanvas.width = dw;
    previewCanvas.height = dh;
    previewCanvas.getContext("2d").drawImage(src, 0, 0, dw, dh);
  }

  function clearPreviewResult() {
    previewActive = false;
    unprocessedOverlay.classList.remove("is-hidden");
    labelRight.textContent = "Asli";
    origFrameCanvas.classList.add("is-hidden");

    enhancedVideo.pause();
    enhancedVideo.classList.add("is-hidden");
    previewCanvas.classList.remove("is-hidden");

    if (enhancedVideoUrl) {
      URL.revokeObjectURL(enhancedVideoUrl);
      enhancedVideoUrl = null;
    }

    if (isImageMode) {
      previewImage.classList.remove("is-hidden");
      previewVideo.classList.add("is-hidden");
    } else {
      previewVideo.classList.remove("is-hidden");
      previewImage.classList.add("is-hidden");
    }
    drawOriginalToRightCanvas();
  }

  function syncVideos(a, b) {
    if (a._syncBound) return;
    a._syncBound = true;
    function sync(from, to) {
      if (from._syncLock || Math.abs(from.currentTime - to.currentTime) <= 0.18) return;
      from._syncLock = true;
      try { to.currentTime = from.currentTime; } catch (_) {}
      setTimeout(function () { from._syncLock = false; }, 120);
      if (!from.paused && to.paused) to.play().catch(function () {});
    }
    a.addEventListener("timeupdate", function () { sync(a, b); });
    b.addEventListener("timeupdate", function () { sync(b, a); });
  }

  function showEnhancedVideoResult(blob) {
    if (enhancedVideoUrl) URL.revokeObjectURL(enhancedVideoUrl);
    enhancedVideoUrl = URL.createObjectURL(blob);
    enhancedVideo.src = enhancedVideoUrl;
    enhancedVideo.classList.remove("is-hidden");
    previewCanvas.classList.add("is-hidden");
    unprocessedOverlay.classList.add("is-hidden");
    origFrameCanvas.classList.add("is-hidden");
    previewVideo.classList.remove("is-hidden");
    labelRight.textContent = "Enhanced";
    previewActive = true;

    syncVideos(previewVideo, enhancedVideo);
    enhancedVideo.onloadedmetadata = function () {
      try { enhancedVideo.currentTime = previewVideo.currentTime || 0; } catch (_) {}
      enhancedVideo.play().catch(function () {});
    };
  }

  /* ===== GPU & AI Worker ===== */
  function getWorker() {
    if (worker) return worker;
    try {
      worker = new Worker("../../assets/vendor/upscale/upscaleWorker.js");
      worker.addEventListener("message", function (e) {
        var d = e.data || {};
        if (d.info) logger.append("[SPAN] " + d.info);
        if (d.progress !== undefined && activeJob && activeJob.onProgress) {
          activeJob.onProgress(d.progress);
        }
        if (d.alertmsg && activeJob) {
          var rej = activeJob.reject;
          activeJob = null;
          rej(new Error(d.alertmsg));
        }
        if (d.done && d.output && activeJob) {
          var job = activeJob;
          activeJob = null;
          var w = job.w * UPSCALE_FACTOR;
          var h = job.h * UPSCALE_FACTOR;
          job.target.width = w;
          job.target.height = h;
          var ctx = job.target.getContext("2d");
          var imgData = ctx.createImageData(w, h);
          imgData.data.set(new Uint8ClampedArray(d.output));
          ctx.putImageData(imgData, 0, 0);
          job.resolve();
        }
      });
      worker.addEventListener("error", function (err) {
        if (activeJob) {
          var rej = activeJob.reject;
          activeJob = null;
          rej(new Error(err.message || "Worker error"));
        }
      });
      return worker;
    } catch (_) {
      return null;
    }
  }

  function runSpanFrame(source, targetCanvas, onProgress) {
    return new Promise(function (resolve, reject) {
      var wkr = getWorker();
      if (!wkr) return reject(new Error("AI Worker tidak tersedia."));

      var w = source.naturalWidth || source.videoWidth || source.width || 0;
      var h = source.naturalHeight || source.videoHeight || source.height || 0;
      var maxDim = FF.isMobileDevice() ? 800 : 1280;
      var procW = w;
      var procH = h;
      if (Math.max(w, h) > maxDim) {
        var s = maxDim / Math.max(w, h);
        procW = Math.round(w * s);
        procH = Math.round(h * s);
      }

      var off = document.createElement("canvas");
      off.width = procW;
      off.height = procH;
      var ctx = off.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, procW, procH);
      var imgData = ctx.getImageData(0, 0, procW, procH);

      activeJob = { resolve: resolve, reject: reject, onProgress: onProgress, target: targetCanvas, w: procW, h: procH };
      wkr.postMessage({
        input: imgData.data.buffer,
        width: procW,
        height: procH,
        factor: UPSCALE_FACTOR,
        tile_size: 128,
        min_lap: 8,
        model_type: "span",
        model: "span4x_128",
        backend: "webgl",
        hasAlpha: false
      }, [imgData.data.buffer]);
    });
  }

  function applyShader(source, params, target) {
    if (!gpuEnhancer && window.UpscaleGpuEnhancer) {
      try { gpuEnhancer = new window.UpscaleGpuEnhancer(); } catch (_) {}
    }
    var w = source.naturalWidth || source.videoWidth || source.width;
    var h = source.naturalHeight || source.videoHeight || source.height;
    target.width = w;
    target.height = h;
    if (gpuEnhancer && activePreset !== "none") {
      gpuEnhancer.process(source, params, target);
    } else {
      target.getContext("2d").drawImage(source, 0, 0);
    }
  }

  function loadImageEl(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Gagal membaca frame gambar.")); };
      img.src = url;
    });
  }

  function setBusy(busy) {
    btnPreview.disabled = busy;
    btnStart.disabled = busy;
    btnAddFiles.disabled = busy;
    btnChangeFile.disabled = busy;
    btnDownloadAll.disabled = busy;
    durationSlider.disabled = busy || isBatchMode() || isImageMode || !(isFinite(previewVideo.duration) && previewVideo.duration > 0);
    checkNormalise.disabled = busy;
    presetGroup.querySelectorAll(".app-chip").forEach(function (b) { b.disabled = busy; });
    timingGroup.querySelectorAll(".m3-segment").forEach(function (b) { b.disabled = busy; });
    queueList.querySelectorAll("[data-queue-remove]").forEach(function (b) { b.disabled = busy; });
  }

  function invalidateOnSettingChange() {
    if (isBatchMode()) {
      btnDownloadAll.classList.add("is-hidden");
      var anyDone = queueItems.some(function (it) { return it.status === "done"; });
      if (anyDone) {
        queueItems.forEach(function (it) {
          it.status = "pending";
          it.progress = 0;
          it.errorMsg = "";
          it.resultBlob = null;
          it.outName = "";
        });
        renderQueueList();
        updateStartButtonLabel();
      }
    } else if (currentFile) {
      clearPreviewResult();
    }
  }

  /* ===== Events & Controls (Multi-File Dropzone + Batch Queue) ===== */
  dropzone.addEventListener("click", function () {
    if (isProcessing || isGeneratingPreview) return;
    filePickMode = "replace";
    fileInput.value = "";
    fileInput.click();
  });

  dropzone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isProcessing || isGeneratingPreview) return;
      filePickMode = "replace";
      fileInput.value = "";
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFiles(fileInput.files, filePickMode === "append");
    }
  });

  window.addEventListener("dragover", function (e) {
    e.preventDefault();
    if (!dropzone.classList.contains("is-hidden")) {
      dropzone.classList.add("is-dragover");
    }
  });

  window.addEventListener("dragleave", function (e) {
    if (e.clientX <= 0 || e.clientY <= 0) {
      dropzone.classList.remove("is-dragover");
    }
  });

  window.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
    if (isProcessing || isGeneratingPreview) return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files, queueItems.length > 0);
    }
  });

  btnAddFiles.addEventListener("click", function () {
    if (isProcessing || isGeneratingPreview) return;
    filePickMode = "append";
    fileInput.value = "";
    fileInput.click();
  });

  btnChangeFile.addEventListener("click", function () {
    if (isProcessing || isGeneratingPreview) return;
    if (isBatchMode()) {
      resetQueue();
      return;
    }
    filePickMode = "replace";
    fileInput.value = "";
    fileInput.click();
  });

  btnDownloadAll.addEventListener("click", function () {
    if (isProcessing) return;
    var doneItems = queueItems.filter(function (it) { return it.status === "done" && it.resultBlob; });
    if (!doneItems.length) return;
    downloadAllResults(doneItems);
  });

  queueList.addEventListener("click", function (e) {
    var dlBtn = e.target.closest("[data-queue-download]");
    if (dlBtn) {
      var dlId = Number(dlBtn.getAttribute("data-queue-download"));
      var dlItem = queueItems.find(function (it) { return it.id === dlId; });
      if (dlItem && dlItem.resultBlob) {
        U.triggerDownload(dlItem.resultBlob, dlItem.outName || dlItem.file.name);
      }
      return;
    }
    var rmBtn = e.target.closest("[data-queue-remove]");
    if (rmBtn && !isProcessing && !isGeneratingPreview) {
      var rmId = Number(rmBtn.getAttribute("data-queue-remove"));
      removeQueueItem(rmId);
    }
  });

  U.bindSegmented(presetGroup, "preset", function (p) {
    activePreset = p || "cartoonist";
    invalidateOnSettingChange();
  });

  U.bindSegmented(timingGroup, "timing", function (t) {
    enhanceTiming = t || "before";
    invalidateOnSettingChange();
  });

  checkNormalise.addEventListener("change", function () {
    invalidateOnSettingChange();
  });

  durationSlider.addEventListener("input", function () {
    U.syncSlider(durationSlider);
    var t = parseFloat(durationSlider.value) || 0;
    try { previewVideo.currentTime = t; } catch (_) {}
    durationLabel.textContent = formatScrubTime(t);
    if (previewActive) {
      clearPreviewResult();
      logger.append("Posisi frame diubah ke " + formatScrubTime(t) + " — preview direset");
    }
  });

  previewImage.addEventListener("load", function () {
    if (!previewActive) drawOriginalToRightCanvas();
  });

  previewVideo.addEventListener("loadedmetadata", function () {
    if (isFinite(previewVideo.duration) && previewVideo.duration > 0) {
      durationSlider.max = previewVideo.duration;
      durationSlider.value = 0;
      durationSlider.disabled = false;
      U.syncSlider(durationSlider);
      durationLabel.textContent = formatScrubTime(0);
    }
  });

  previewVideo.addEventListener("loadeddata", function () {
    if (!previewActive) drawOriginalToRightCanvas();
  });

  previewVideo.addEventListener("seeked", function () {
    if (!previewActive && !isGeneratingPreview) drawOriginalToRightCanvas();
  });

  function updateStartButtonLabel() {
    if (isBatchMode()) {
      var pendingCount = queueItems.filter(function (it) { return it.status !== "done"; }).length;
      if (pendingCount === 0) {
        btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_fix_high</span> Upscale Ulang';
      } else {
        btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_fix_high</span> Mulai Batch (' + pendingCount + ')';
      }
    } else {
      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_fix_high</span> Mulai Upscale';
    }
  }

  function updateBatchHeaderMeta() {
    var imgCount = 0;
    var vidCount = 0;
    var totalBytes = 0;
    queueItems.forEach(function (it) {
      if (it.isImage) imgCount++;
      else vidCount++;
      totalBytes += it.file.size || 0;
    });
    fileIconEl.textContent = "layers";
    fileNameEl.textContent = queueItems.length + " file dalam antrean";
    var parts = [];
    if (imgCount > 0) parts.push(imgCount + " gambar");
    if (vidCount > 0) parts.push(vidCount + " video");
    parts.push(U.formatBytes(totalBytes));
    fileDetailsEl.textContent = parts.join(" \u2022 ");
  }

  function renderQueueList() {
    var doneCount = queueItems.filter(function (it) { return it.status === "done"; }).length;
    queueCountBadge.textContent = doneCount + "/" + queueItems.length;

    queueList.innerHTML = "";
    var frag = document.createDocumentFragment();

    queueItems.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "app-list-item" + (item.status === "processing" ? " is-selected" : "");

      var left = document.createElement("div");
      left.className = "app-list-left";

      var ico = document.createElement("span");
      ico.className = "material-symbols-rounded notranslate";
      ico.setAttribute("translate", "no");
      ico.setAttribute("aria-hidden", "true");
      ico.textContent = item.isImage ? "image" : "video_file";

      var textWrap = document.createElement("div");
      textWrap.className = "app-list-text";

      var title = document.createElement("div");
      title.className = "app-list-title";
      title.textContent = item.file.name;

      var sub = document.createElement("div");
      sub.className = "app-list-sub";
      if (item.status === "done" && item.resultBlob) {
        sub.textContent = U.formatBytes(item.file.size) + " \u2192 " + U.formatBytes(item.resultBlob.size);
      } else if (item.status === "error" && item.errorMsg) {
        sub.textContent = item.errorMsg;
      } else {
        sub.textContent = item.metaText || U.formatBytes(item.file.size);
      }

      textWrap.appendChild(title);
      textWrap.appendChild(sub);
      left.appendChild(ico);
      left.appendChild(textWrap);

      var actions = document.createElement("div");
      actions.className = "app-inline-actions";

      var badge = document.createElement("span");
      badge.className = "app-list-badge";
      if (item.status === "processing") {
        badge.textContent = Math.max(0, Math.min(100, Math.round(item.progress || 0))) + "%";
      } else if (item.status === "done") {
        badge.textContent = "Selesai";
      } else if (item.status === "error") {
        badge.textContent = "Gagal";
      } else {
        badge.textContent = "Menunggu";
      }
      actions.appendChild(badge);

      if (item.status === "done" && item.resultBlob) {
        var dlBtn = document.createElement("button");
        dlBtn.type = "button";
        dlBtn.className = "app-icon-btn";
        dlBtn.setAttribute("data-queue-download", String(item.id));
        dlBtn.setAttribute("aria-label", "Unduh " + item.file.name);
        dlBtn.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">download</span>';
        actions.appendChild(dlBtn);
      } else if (!isProcessing) {
        var rmBtn = document.createElement("button");
        rmBtn.type = "button";
        rmBtn.className = "app-icon-btn";
        rmBtn.setAttribute("data-queue-remove", String(item.id));
        rmBtn.setAttribute("aria-label", "Hapus " + item.file.name);
        rmBtn.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">close</span>';
        actions.appendChild(rmBtn);
      }

      row.appendChild(left);
      row.appendChild(actions);
      frag.appendChild(row);
    });

    queueList.appendChild(frag);
  }

  function resetQueue() {
    queueItems = [];
    currentFile = null;
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    if (enhancedVideoUrl) {
      URL.revokeObjectURL(enhancedVideoUrl);
      enhancedVideoUrl = null;
    }
    previewVideo.pause();
    enhancedVideo.pause();
    previewVideo.removeAttribute("src");
    previewImage.removeAttribute("src");
    workspace.classList.add("is-hidden");
    dropzone.classList.remove("is-hidden");
    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");
    btnDownloadAll.classList.add("is-hidden");
    logger.setBadge("Ready");
  }

  function removeQueueItem(id) {
    queueItems = queueItems.filter(function (it) { return it.id !== id; });
    if (!queueItems.some(function (it) { return it.status === "done" && it.resultBlob; })) {
      btnDownloadAll.classList.add("is-hidden");
    }
    if (queueItems.length === 0) {
      resetQueue();
      return;
    }
    syncWorkspaceView();
  }

  function probeQueueItemMeta(item) {
    if (item.isImage) {
      U.probeImageMetadata(item.file).then(function (meta) {
        if (!queueItems.some(function (q) { return q.id === item.id; })) return;
        item.metaText = U.formatBytes(item.file.size) + (meta.width ? (" \u2022 " + meta.width + "x" + meta.height) : "");
        if (isBatchMode()) {
          renderQueueList();
        } else if (currentFile === item.file) {
          fileDetailsEl.textContent = item.metaText;
        }
      });
    } else {
      U.probeVideoMetadata(item.file).then(function (meta) {
        if (!queueItems.some(function (q) { return q.id === item.id; })) return;
        var parts = [U.formatBytes(item.file.size)];
        if (meta.width && meta.height) parts.push(meta.width + "x" + meta.height);
        if (meta.duration) parts.push(U.formatDuration(meta.duration));
        item.metaText = parts.join(" \u2022 ");
        if (isBatchMode()) {
          renderQueueList();
        } else if (currentFile === item.file) {
          fileDetailsEl.textContent = item.metaText;
        }
      });
    }
  }

  function loadSingleCompareFile(file) {
    currentFile = file;
    isImageMode = isImageFile(file);

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    if (enhancedVideoUrl) {
      URL.revokeObjectURL(enhancedVideoUrl);
      enhancedVideoUrl = null;
    }
    currentObjectUrl = URL.createObjectURL(file);

    fileIconEl.textContent = isImageMode ? "image" : "video_file";
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = (queueItems[0] && queueItems[0].metaText) || U.formatBytes(file.size);

    scrubberRow.classList.toggle("is-hidden", isImageMode);
    durationSlider.disabled = true;
    durationSlider.max = 0;
    durationSlider.value = 0;
    U.syncSlider(durationSlider);
    durationLabel.textContent = "00:00.0";

    previewActive = false;
    unprocessedOverlay.classList.remove("is-hidden");
    labelRight.textContent = "Asli";
    origFrameCanvas.classList.add("is-hidden");
    enhancedVideo.pause();
    enhancedVideo.classList.add("is-hidden");
    previewCanvas.classList.remove("is-hidden");
    resetViewTransform();

    if (isImageMode) {
      previewVideo.classList.add("is-hidden");
      previewVideo.removeAttribute("src");
      previewImage.src = currentObjectUrl;
      previewImage.classList.remove("is-hidden");
    } else {
      previewImage.classList.add("is-hidden");
      previewImage.removeAttribute("src");
      previewVideo.src = currentObjectUrl;
      previewVideo.classList.remove("is-hidden");
      previewVideo.load();
    }
  }

  function syncWorkspaceView() {
    if (queueItems.length === 0) {
      resetQueue();
      return;
    }

    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    progressBox.classList.add("is-hidden");

    if (isBatchMode()) {
      currentFile = null;
      previewVideo.pause();
      enhancedVideo.pause();
      compareStage.classList.add("is-hidden");
      scrubberRow.classList.add("is-hidden");
      btnPreview.classList.add("is-hidden");
      queuePanel.classList.remove("is-hidden");
      btnChangeFile.textContent = "Reset";
      updateBatchHeaderMeta();
      renderQueueList();
    } else {
      queuePanel.classList.add("is-hidden");
      btnDownloadAll.classList.add("is-hidden");
      compareStage.classList.remove("is-hidden");
      btnPreview.classList.remove("is-hidden");
      btnChangeFile.textContent = "Ganti";
      loadSingleCompareFile(queueItems[0].file);
    }

    setBusy(false);
    btnPreview.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">visibility</span> Preview';
    updateStartButtonLabel();
    logger.setBadge("Ready");
  }

  function handleFiles(fileList, append) {
    var valid = Array.from(fileList || []).filter(isSupportedMediaFile);
    if (!valid.length) return;

    if (!append) {
      queueItems = [];
      btnDownloadAll.classList.add("is-hidden");
    }
    statsGrid.classList.add("is-hidden");

    var added = valid.map(function (file) {
      var item = {
        id: nextQueueId++,
        file: file,
        isImage: isImageFile(file),
        metaText: U.formatBytes(file.size),
        status: "pending",
        progress: 0,
        errorMsg: "",
        resultBlob: null,
        outName: ""
      };
      queueItems.push(item);
      return item;
    });

    syncWorkspaceView();
    added.forEach(probeQueueItemMeta);

    if (isBatchMode()) {
      logger.append("Batch antrean: " + queueItems.length + " file siap diproses");
    } else {
      logger.append((added[0].isImage ? "Gambar" : "Video") + " dimuat: " + added[0].file.name);
    }
  }

  /* ===== Single-Frame Preview ===== */
  async function generatePreview() {
    if (!currentFile || isProcessing || isGeneratingPreview) return;
    isGeneratingPreview = true;
    var startedAt = performance.now();

    setBusy(true);
    btnPreview.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Preview...';
    logger.setBadge("Preview");
    setProgress(10, "Menyiapkan frame preview...");

    try {
      var frameSource;
      if (isImageMode) {
        if (!previewImage.complete) {
          await new Promise(function (r) { previewImage.onload = r; });
        }
        frameSource = previewImage;
      } else {
        previewVideo.pause();
        if (previewVideo.readyState < 2) {
          await new Promise(function (r) {
            previewVideo.addEventListener("loadeddata", r, { once: true });
            setTimeout(r, 2000);
          });
        }
        var wantT = parseFloat(durationSlider.value) || 0;
        if (Math.abs((previewVideo.currentTime || 0) - wantT) > 0.03) {
          await new Promise(function (r) {
            previewVideo.addEventListener("seeked", r, { once: true });
            try { previewVideo.currentTime = wantT; } catch (_) { r(); }
            setTimeout(r, 1800);
          });
        }
        frameSource = document.createElement("canvas");
        frameSource.width = previewVideo.videoWidth;
        frameSource.height = previewVideo.videoHeight;
        frameSource.getContext("2d").drawImage(previewVideo, 0, 0);
        logger.append("Frame diambil @ " + formatScrubTime(previewVideo.currentTime) + " (" + frameSource.width + "x" + frameSource.height + ")");
      }

      var normalise = checkNormalise.checked;
      if (normalise) {
        var cropped = applyCropTo916(frameSource);
        if (cropped) frameSource = cropped;
      }

      var maxDim = FF.isMobileDevice() ? 800 : 1280;
      var sw = frameSource.naturalWidth || frameSource.width;
      var sh = frameSource.naturalHeight || frameSource.height;
      if (Math.max(sw, sh) > maxDim) {
        var scale = maxDim / Math.max(sw, sh);
        var clamped = document.createElement("canvas");
        clamped.width = Math.round(sw * scale);
        clamped.height = Math.round(sh * scale);
        clamped.getContext("2d").drawImage(frameSource, 0, 0, clamped.width, clamped.height);
        frameSource = clamped;
      }

      if (normalise) {
        origFrameCanvas.width = frameSource.naturalWidth || frameSource.width;
        origFrameCanvas.height = frameSource.naturalHeight || frameSource.height;
        origFrameCanvas.getContext("2d").drawImage(frameSource, 0, 0);
        origFrameCanvas.classList.remove("is-hidden");
        previewImage.classList.add("is-hidden");
        previewVideo.classList.add("is-hidden");
      }

      var params = getPresetParams(activePreset);
      var outCanvas = document.createElement("canvas");

      if (enhanceTiming === "before") {
        setProgress(25, "Menerapkan GPU filter...");
        var filtered = document.createElement("canvas");
        applyShader(frameSource, params, filtered);
        setProgress(35, "AI Upscaling preview...");
        try {
          await runSpanFrame(filtered, outCanvas, function (p) {
            setProgress(35 + Math.round((p / 100) * 55), "AI Upscaling preview (" + Math.round(p) + "%)...");
          });
        } catch (aiErr) {
          logger.append("AI worker fallback ke filter GPU: " + aiErr.message);
          outCanvas = filtered;
        }
      } else {
        setProgress(25, "AI Upscaling preview...");
        var upscaled = document.createElement("canvas");
        try {
          await runSpanFrame(frameSource, upscaled, function (p) {
            setProgress(25 + Math.round((p / 100) * 60), "AI Upscaling preview (" + Math.round(p) + "%)...");
          });
        } catch (aiErr) {
          logger.append("AI worker fallback ke filter GPU: " + aiErr.message);
          upscaled = frameSource;
        }
        setProgress(88, "Menerapkan GPU filter...");
        applyShader(upscaled, params, outCanvas);
      }

      if (normalise) {
        outCanvas = resizeTo1080x1920(outCanvas);
      }

      previewCanvas.width = outCanvas.width;
      previewCanvas.height = outCanvas.height;
      previewCanvas.getContext("2d").drawImage(outCanvas, 0, 0);
      previewCanvas.classList.remove("is-hidden");
      enhancedVideo.classList.add("is-hidden");
      unprocessedOverlay.classList.add("is-hidden");
      labelRight.textContent = "Enhanced";
      previewActive = true;

      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";
      progressBox.classList.add("is-hidden");
      logger.setBadge("Preview OK");
      logger.append("Preview selesai dalam " + elapsed + " (" + outCanvas.width + "x" + outCanvas.height + ")");
    } catch (err) {
      progressBox.classList.add("is-hidden");
      clearPreviewResult();
      logger.setBadge("Error");
      logger.append("Preview gagal: " + (err && err.message ? err.message : String(err)));
    } finally {
      isGeneratingPreview = false;
      setBusy(false);
      btnPreview.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">visibility</span> Preview';
    }
  }

  btnPreview.addEventListener("click", generatePreview);

  /* ===== Full Export Pipeline ===== */
  async function processImage(file, onProgress, updatePreview) {
    var report = onProgress || setProgress;
    var normalise = checkNormalise.checked;
    var url = URL.createObjectURL(file);
    var img = await loadImageEl(url);
    URL.revokeObjectURL(url);

    var work = img;
    if (normalise) {
      var cropped = applyCropTo916(img);
      if (cropped) work = cropped;
    }

    var params = getPresetParams(activePreset);
    var outCanvas = document.createElement("canvas");

    if (enhanceTiming === "before") {
      report(20, "Menerapkan GPU filter...");
      var filtered = document.createElement("canvas");
      applyShader(work, params, filtered);
      report(30, "Menjalankan AI Upscale 4x...");
      try {
        await runSpanFrame(filtered, outCanvas, function (p) {
          report(30 + Math.round((p / 100) * 60), "AI Upscaling (" + Math.round(p) + "%)...");
        });
      } catch (aiErr) {
        logger.append("AI worker fallback ke filter GPU: " + aiErr.message);
        outCanvas = filtered;
      }
    } else {
      report(20, "Menjalankan AI Upscale 4x...");
      var upscaled = document.createElement("canvas");
      try {
        await runSpanFrame(work, upscaled, function (p) {
          report(20 + Math.round((p / 100) * 65), "AI Upscaling (" + Math.round(p) + "%)...");
        });
      } catch (aiErr) {
        logger.append("AI worker fallback ke filter GPU: " + aiErr.message);
        upscaled = work;
      }
      report(88, "Menerapkan GPU filter...");
      applyShader(upscaled, params, outCanvas);
    }

    if (normalise) {
      report(93, "Normalisasi 1080x1920...");
      outCanvas = resizeTo1080x1920(outCanvas);
    }

    if (updatePreview !== false) {
      previewCanvas.width = outCanvas.width;
      previewCanvas.height = outCanvas.height;
      previewCanvas.getContext("2d").drawImage(outCanvas, 0, 0);
      unprocessedOverlay.classList.add("is-hidden");
      labelRight.textContent = "Enhanced";
      previewActive = true;
    }

    var mime = normalise ? "image/jpeg" : "image/png";
    var ext = normalise ? "jpg" : "png";
    var blob = await new Promise(function (r) { outCanvas.toBlob(r, mime, 0.92); });
    if (!blob) throw new Error("Gagal menyimpan gambar.");
    return {
      blob: blob,
      outName: file.name.replace(/\.[^/.]+$/, "") + "_enhanced." + ext
    };
  }

  async function processVideo(file, onProgress, updatePreview) {
    var report = onProgress || setProgress;
    var normalise = checkNormalise.checked;
    report(8, "Memuat FFmpeg WASM...");
    if (!ffmpeg) {
      ffmpeg = await FF.createInstance({ log: function (m) { logger.append(m); } });
    }

    var ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    var inName = "input." + ext;
    await ffmpeg.writeFile(inName, await FF.fetchFile(file));

    var useAiFrames = !FF.isMobileDevice() && Boolean(getWorker());
    var params = getPresetParams(activePreset);

    if (useAiFrames) {
      logger.append("Pipeline AI SPAN 4x aktif untuk video");
      report(12, "Mengekstrak frame video...");
      await ffmpeg.exec(["-i", inName, "-vsync", "0", "-qscale:v", "2", "f_%05d.jpg"]);

      var total = 0;
      while (true) {
        try {
          var check = await ffmpeg.readFile("f_" + String(total + 1).padStart(5, "0") + ".jpg");
          if (!check || !check.byteLength) break;
          total++;
        } catch (_) {
          break;
        }
      }
      if (!total) throw new Error("Tidak ada frame yang diekstrak.");

      var meta = await U.probeVideoMetadata(file);
      var fps = meta.duration > 0 ? Math.min(60, Math.max(1, total / meta.duration)) : 30;
      var maxFrames = 400;
      var step = total > maxFrames ? Math.ceil(total / maxFrames) : 1;
      var outIdx = 0;
      var selectedCount = Math.ceil(total / step);

      logger.append("Memproses " + selectedCount + "/" + total + " frame...");

      try {
        for (var i = 0; i < total; i++) {
          var fname = "f_" + String(i + 1).padStart(5, "0") + ".jpg";
          if (i % step !== 0) {
            try { await ffmpeg.deleteFile(fname); } catch (_) {}
            continue;
          }
          var fdata = await ffmpeg.readFile(fname);
          var furl = URL.createObjectURL(new Blob([fdata], { type: "image/jpeg" }));
          try {
            var img = await loadImageEl(furl);
            var work = img;
            if (normalise) {
              var c = applyCropTo916(img);
              if (c) work = c;
            }
            var out = document.createElement("canvas");
            if (enhanceTiming === "before") {
              var flt = document.createElement("canvas");
              applyShader(work, params, flt);
              await runSpanFrame(flt, out, null);
            } else {
              var up = document.createElement("canvas");
              await runSpanFrame(work, up, null);
              applyShader(up, params, out);
            }
            if (normalise) out = resizeTo1080x1920(out);

            var oblob = await new Promise(function (r) { out.toBlob(r, "image/jpeg", 0.92); });
            outIdx++;
            await ffmpeg.writeFile("u_" + String(outIdx).padStart(5, "0") + ".jpg", new Uint8Array(await oblob.arrayBuffer()));
          } finally {
            URL.revokeObjectURL(furl);
            try { await ffmpeg.deleteFile(fname); } catch (_) {}
          }

          var pct = 15 + Math.round((outIdx / selectedCount) * 72);
          report(Math.min(87, pct), "AI Upscaling frame " + outIdx + "/" + selectedCount + "...");
          await new Promise(function (r) { setTimeout(r, 4); });
        }

        report(90, "Merakit video MP4...");
        var outFps = (fps / step).toFixed(3);
        await ffmpeg.exec([
          "-y", "-framerate", outFps, "-i", "u_%05d.jpg", "-i", inName,
          "-map", "0:v:0", "-map", "1:a:0?",
          "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
          "enhanced.mp4"
        ]);
      } finally {
        for (var k = 1; k <= outIdx; k++) {
          try { await ffmpeg.deleteFile("u_" + String(k).padStart(5, "0") + ".jpg"); } catch (_) {}
        }
      }
    } else {
      logger.append("Pipeline FFmpeg filter cepat aktif");
      var vf = "unsharp=5:5:1.0:5:5:0.0";
      if (activePreset === "cartoonist") vf = "unsharp=7:7:1.5:7:7:0.5,eq=contrast=1.1:saturation=1.15";
      if (activePreset === "cartoonist2") vf = "unsharp=9:9:2.0:9:9:0.8,eq=contrast=1.15:saturation=1.25";
      if (activePreset === "humanDetail") vf = "unsharp=5:5:1.2:5:5:0.3,hqdn3d=1.5:1.5:3:3";
      if (activePreset === "smoothFace") vf = "hqdn3d=2.5:2.5:4:4,unsharp=5:5:0.8";
      if (activePreset === "none") vf = "null";

      if (normalise) {
        vf = "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=1080:1920,setsar=1" + (vf === "null" ? "" : ("," + vf));
      } else {
        vf = "scale=trunc(iw/2)*2:trunc(ih/2)*2" + (vf === "null" ? "" : ("," + vf));
      }

      report(40, "Meningkatkan kualitas video...");
      await ffmpeg.exec([
        "-y", "-i", inName, "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", vf, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-movflags", "+faststart", "enhanced.mp4"
      ]);
    }

    var data = await ffmpeg.readFile("enhanced.mp4");
    try { await ffmpeg.deleteFile("enhanced.mp4"); } catch (_) {}
    try { await ffmpeg.deleteFile(inName); } catch (_) {}

    if (!data || data.byteLength < 1024) throw new Error("Gagal menghasilkan video output.");
    var blob = new Blob([data], { type: "video/mp4" });
    if (updatePreview !== false) {
      showEnhancedVideoResult(blob);
    }
    return {
      blob: blob,
      outName: file.name.replace(/\.[^/.]+$/, "") + "_enhanced.mp4"
    };
  }

  async function downloadAllResults(doneItems) {
    if (!doneItems || !doneItems.length) return;
    logger.append("Mengunduh " + doneItems.length + " file hasil batch...");
    for (var d = 0; d < doneItems.length; d++) {
      U.triggerDownload(doneItems[d].resultBlob, doneItems[d].outName || doneItems[d].file.name);
      if (d < doneItems.length - 1) {
        await new Promise(function (r) { setTimeout(r, 240); });
      }
    }
  }

  async function runBatchExport() {
    var targets = queueItems.filter(function (it) { return it.status !== "done"; });
    if (targets.length === 0) {
      queueItems.forEach(function (it) {
        it.status = "pending";
        it.progress = 0;
        it.errorMsg = "";
        it.resultBlob = null;
        it.outName = "";
      });
      targets = queueItems.slice();
    }

    btnDownloadAll.classList.add("is-hidden");

    var startedAt = performance.now();
    var totalTargets = targets.length;

    for (var i = 0; i < totalTargets; i++) {
      var item = targets[i];
      item.status = "processing";
      item.progress = 0;
      item.errorMsg = "";
      renderQueueList();

      var labelPrefix = "[" + (i + 1) + "/" + totalTargets + "] " + item.file.name;
      logger.append("Memulai " + labelPrefix);

      try {
        var onItemProgress = function (pct, statusText) {
          item.progress = pct;
          var overall = Math.round(((i + (pct / 100)) / totalTargets) * 100);
          setProgress(overall, "[" + (i + 1) + "/" + totalTargets + "] " + (statusText || "Memproses..."));
          renderQueueList();
        };
        var res = item.isImage
          ? await processImage(item.file, onItemProgress, false)
          : await processVideo(item.file, onItemProgress, false);

        item.resultBlob = res.blob;
        item.outName = res.outName;
        item.status = "done";
        item.progress = 100;
        logger.append("Selesai " + labelPrefix + " (" + U.formatBytes(res.blob.size) + ")");
      } catch (err) {
        item.status = "error";
        item.errorMsg = (err && err.message) ? err.message : String(err);
        logger.append("Gagal " + labelPrefix + ": " + item.errorMsg);
      }
      renderQueueList();
    }

    var doneItems = queueItems.filter(function (it) { return it.status === "done" && it.resultBlob; });
    var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";

    progressBox.classList.add("is-hidden");
    if (doneItems.length > 0) {
      var totalIn = doneItems.reduce(function (sum, it) { return sum + (it.file.size || 0); }, 0);
      var totalOut = doneItems.reduce(function (sum, it) { return sum + (it.resultBlob.size || 0); }, 0);
      statOriginal.textContent = U.formatBytes(totalIn);
      statOutput.textContent = U.formatBytes(totalOut);
      statElapsed.textContent = elapsed;
      statsGrid.classList.remove("is-hidden");

      btnDownloadAll.classList.remove("is-hidden");
      await downloadAllResults(doneItems);
      logger.setBadge(doneItems.length === queueItems.length ? "Done" : "Partial");
    } else {
      logger.setBadge("Error");
    }
  }

  btnStart.addEventListener("click", async function () {
    if (queueItems.length === 0 || isProcessing || isGeneratingPreview) return;
    isProcessing = true;
    var startedAt = performance.now();

    setBusy(true);
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Memproses...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");

    try {
      if (isBatchMode()) {
        await runBatchExport();
      } else {
        var singleFile = queueItems[0].file;
        var res = isImageMode
          ? await processImage(singleFile, setProgress, true)
          : await processVideo(singleFile, setProgress, true);
        var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";

        progressBox.classList.add("is-hidden");
        statOriginal.textContent = U.formatBytes(singleFile.size);
        statOutput.textContent = U.formatBytes(res.blob.size);
        statElapsed.textContent = elapsed;
        statsGrid.classList.remove("is-hidden");

        logger.setBadge("Done");
        logger.append("Selesai dalam " + elapsed + " \u2022 " + U.formatBytes(res.blob.size));
        logger.append("Mengunduh otomatis: " + res.outName);
        U.triggerDownload(res.blob, res.outName);
      }
    } catch (err) {
      progressBox.classList.add("is-hidden");
      logger.setBadge("Error");
      logger.append("Gagal: " + (err && err.message ? err.message : String(err)));
    } finally {
      isProcessing = false;
      setBusy(false);
      if (isBatchMode()) {
        renderQueueList();
        updateStartButtonLabel();
      } else {
        btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_fix_high</span> Upscale Ulang';
      }
    }
  });

  window.addEventListener("pagehide", function () {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    if (enhancedVideoUrl) URL.revokeObjectURL(enhancedVideoUrl);
    if (worker) {
      try { worker.terminate(); } catch (_) {}
      worker = null;
    }
  });
})();
