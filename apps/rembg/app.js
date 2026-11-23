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
  var btnChangeFile = document.getElementById("btn-change-file");

  var compareStage = document.getElementById("compare-stage");
  var origClip = document.getElementById("orig-clip");
  var compareClip = document.getElementById("compare-clip");
  var compareDivider = document.getElementById("compare-divider");
  var layerOrig = document.getElementById("layer-orig");
  var layerEnhanced = document.getElementById("layer-enhanced");
  var previewVideo = document.getElementById("preview-video");
  var previewImage = document.getElementById("preview-image");
  var enhancedVideo = document.getElementById("enhanced-video");
  var previewCanvas = document.getElementById("preview-canvas");
  var unprocessedOverlay = document.getElementById("unprocessed-overlay");
  var labelRight = document.getElementById("label-right");
  var zoomBadge = document.getElementById("zoom-badge");

  var scrubberRow = document.getElementById("scrubber-row");
  var durationSlider = document.getElementById("duration-slider");
  var durationLabel = document.getElementById("duration-label");

  var modelGroup = document.getElementById("model-group");
  var deviceGroup = document.getElementById("device-group");
  var btnDeviceGpu = document.getElementById("btn-device-gpu");
  var btnDeviceCpu = document.getElementById("btn-device-cpu");
  var bgGroup = document.getElementById("bg-group");
  var colorRow = document.getElementById("color-row");
  var colorPicker = document.getElementById("color-picker");
  var colorHex = document.getElementById("color-hex");
  var formatField = document.getElementById("format-field");
  var formatGroup = document.getElementById("format-group");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statOriginal = document.getElementById("stat-original");
  var statOutput = document.getElementById("stat-output");
  var statElapsed = document.getElementById("stat-elapsed");

  var btnPreview = document.getElementById("btn-preview");
  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var MODEL_META = {
    selfie_segmenter: { file: "selfie_segmenter.onnx", type: "selfie", w: 256, h: 256 },
    rvm_mobilenetv3: { file: "rvm_mobilenetv3_fp32.onnx", type: "rvm", w: 512, h: 512 },
    modnet: { file: "modnet.onnx", type: "modnet", w: 512, h: 512 }
  };

  var IMAGE_FORMATS = [
    { id: "png", label: "PNG (Alpha)", ext: "png", mime: "image/png" },
    { id: "webp", label: "WebP (Alpha)", ext: "webp", mime: "image/webp" }
  ];

  var VIDEO_FORMATS = [
    { id: "mov", label: "MOV (RGBA)", ext: "mov", mime: "video/quicktime" },
    { id: "webm", label: "WebM (VP9)", ext: "webm", mime: "video/webm" },
    { id: "mp4", label: "MP4 (HEVC)", ext: "mp4", mime: "video/mp4" }
  ];

  var currentFile = null;
  var currentObjectUrl = null;
  var enhancedVideoUrl = null;
  var isImageMode = true;
  var isProcessing = false;
  var isGeneratingPreview = false;
  var previewActive = false;

  var sliderPos = 50;
  var zoom = 1;
  var pan = { x: 0, y: 0 };

  var selectedModel = "selfie_segmenter";
  var selectedDevice = "gpu";
  var isWebGpuAvailable = true;
  var selectedBg = "transparent";
  var selectedFormat = "png";
  var customColor = "#0842a0";
  var sessionCache = {};
  var recurrentStates = null;
  var cachedMaskCanvas = null;
  var cachedFrameSource = null;
  var ffmpeg = null;

  (async function checkGpu() {
    var hasGpu = false;
    if (navigator.gpu) {
      try {
        var adapter = await navigator.gpu.requestAdapter();
        if (adapter) hasGpu = true;
      } catch (_) {}
    }
    if (!hasGpu) {
      isWebGpuAvailable = false;
      btnDeviceGpu.disabled = true;
      selectedDevice = "cpu";
      btnDeviceGpu.classList.remove("is-active");
      btnDeviceGpu.setAttribute("aria-checked", "false");
      btnDeviceCpu.classList.add("is-active");
      btnDeviceCpu.setAttribute("aria-checked", "true");
    }
  })();

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

  function isImageFile(file) {
    if (!file) return true;
    if (file.type && file.type.startsWith("image/")) return true;
    if (file.type && file.type.startsWith("video/")) return false;
    return /\.(png|jpe?g|webp|bmp|gif|avif|jfif)$/i.test(file.name || "");
  }

  function renderFormatOptions() {
    var list = isImageMode ? IMAGE_FORMATS : VIDEO_FORMATS;
    selectedFormat = list[0].id;
    formatGroup.innerHTML = "";

    list.forEach(function (opt, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m3-segment" + (idx === 0 ? " is-active" : "");
      btn.dataset.format = opt.id;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", idx === 0 ? "true" : "false");
      btn.textContent = opt.label;
      formatGroup.appendChild(btn);
    });

    U.bindSegmented(formatGroup, "format", function (fmt) {
      selectedFormat = fmt || list[0].id;
    });
  }

  /* ===== Before / After Comparison Stage ===== */
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

  function clearPreviewResult(invalidateMask) {
    previewActive = false;
    if (invalidateMask) {
      cachedMaskCanvas = null;
      cachedFrameSource = null;
    }
    unprocessedOverlay.classList.remove("is-hidden");
    labelRight.textContent = "Asli";
    enhancedVideo.pause();
    enhancedVideo.classList.add("is-hidden");
    previewCanvas.classList.remove("is-hidden");
    drawOriginalToRightCanvas();
  }

  function recomposePreviewIfCached() {
    if (!previewActive || !cachedMaskCanvas || !cachedFrameSource) return;
    var out = compositeWithMask(
      cachedFrameSource,
      cachedMaskCanvas,
      cachedFrameSource.naturalWidth || cachedFrameSource.width,
      cachedFrameSource.naturalHeight || cachedFrameSource.height
    );
    previewCanvas.width = out.width;
    previewCanvas.height = out.height;
    previewCanvas.getContext("2d").drawImage(out, 0, 0);
  }

  function setBusy(busy) {
    btnPreview.disabled = busy;
    btnStart.disabled = busy;
    btnChangeFile.disabled = busy;
    durationSlider.disabled = busy || isImageMode || !(isFinite(previewVideo.duration) && previewVideo.duration > 0);
    colorPicker.disabled = busy;
    colorHex.disabled = busy;
    modelGroup.querySelectorAll(".m3-segment").forEach(function (b) { b.disabled = busy; });
    deviceGroup.querySelectorAll(".m3-segment").forEach(function (b) {
      b.disabled = (b === btnDeviceGpu && !isWebGpuAvailable) ? true : busy;
    });
    bgGroup.querySelectorAll(".app-chip").forEach(function (b) { b.disabled = busy; });
    formatGroup.querySelectorAll(".m3-segment").forEach(function (b) { b.disabled = busy; });
  }

  /* ===== Events ===== */
  U.bindDropzone(dropzone, fileInput, handleFile);

  btnChangeFile.addEventListener("click", function () {
    if (isProcessing || isGeneratingPreview) return;
    fileInput.value = "";
    fileInput.click();
  });

  U.bindSegmented(modelGroup, "model", function (m) {
    selectedModel = m || "selfie_segmenter";
    if (currentFile) clearPreviewResult(true);
  });

  U.bindSegmented(deviceGroup, "device", function (d) {
    selectedDevice = d || "cpu";
    if (currentFile) clearPreviewResult(true);
  });

  U.bindSegmented(bgGroup, "bg", function (bg) {
    selectedBg = bg || "transparent";
    colorRow.classList.toggle("is-hidden", selectedBg !== "color");
    formatField.classList.toggle("is-hidden", selectedBg !== "transparent");
    recomposePreviewIfCached();
  });

  colorPicker.addEventListener("input", function () {
    customColor = colorPicker.value;
    colorHex.value = customColor;
    if (selectedBg === "color") recomposePreviewIfCached();
  });

  colorHex.addEventListener("input", function () {
    var val = colorHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      customColor = val;
      colorPicker.value = val;
      if (selectedBg === "color") recomposePreviewIfCached();
    }
  });

  durationSlider.addEventListener("input", function () {
    U.syncSlider(durationSlider);
    var t = parseFloat(durationSlider.value) || 0;
    try { previewVideo.currentTime = t; } catch (_) {}
    durationLabel.textContent = formatScrubTime(t);
    if (previewActive || cachedMaskCanvas) {
      clearPreviewResult(true);
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

  function handleFile(file) {
    if (!file) return;
    currentFile = file;
    isImageMode = isImageFile(file);
    cachedMaskCanvas = null;
    cachedFrameSource = null;

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    if (enhancedVideoUrl) {
      URL.revokeObjectURL(enhancedVideoUrl);
      enhancedVideoUrl = null;
    }
    currentObjectUrl = URL.createObjectURL(file);

    fileIconEl.textContent = isImageMode ? "image" : "video_file";
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");

    scrubberRow.classList.toggle("is-hidden", isImageMode);
    durationSlider.disabled = true;
    durationSlider.max = 0;
    durationSlider.value = 0;
    U.syncSlider(durationSlider);
    durationLabel.textContent = "00:00.0";

    previewActive = false;
    unprocessedOverlay.classList.remove("is-hidden");
    labelRight.textContent = "Asli";
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

    renderFormatOptions();
    formatField.classList.toggle("is-hidden", selectedBg !== "transparent");
    setBusy(false);
    btnPreview.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">visibility</span> Preview';
    btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">content_cut</span> Hapus Background';
    logger.setBadge("Ready");

    if (isImageMode) {
      U.probeImageMetadata(file).then(function (meta) {
        if (currentFile !== file) return;
        var text = U.formatBytes(file.size) + (meta.width ? (" \u2022 " + meta.width + "x" + meta.height) : "");
        fileDetailsEl.textContent = text;
        logger.append("Gambar dimuat: " + file.name + " (" + text + ")");
      });
    } else {
      U.probeVideoMetadata(file).then(function (meta) {
        if (currentFile !== file) return;
        var parts = [U.formatBytes(file.size)];
        if (meta.width && meta.height) parts.push(meta.width + "x" + meta.height);
        if (meta.duration) parts.push(U.formatDuration(meta.duration));
        fileDetailsEl.textContent = parts.join(" \u2022 ");
        logger.append("Video dimuat: " + file.name + " (" + parts.join(", ") + ")");
      });
    }
  }

  /* ===== Model & Segmentation ===== */
  async function fetchModelBuffer(fileName) {
    var cacheName = "cutefish-ai-models-v1";
    var cache = null;
    if ("caches" in window) {
      try { cache = await caches.open(cacheName); } catch (_) {}
    }
    var cacheKey = "https://models.cutefish.local/" + fileName;
    if (cache) {
      try {
        var hit = await cache.match(cacheKey);
        if (hit) {
          logger.append("Model " + fileName + " dimuat dari cache lokal");
          return await hit.arrayBuffer();
        }
      } catch (_) {}
    }

    var urls = [
      "../../assets/models/" + fileName,
      "https://cdn.jsdelivr.net/gh/openfishtools/web-tools@main/ai/models/" + fileName,
      "https://raw.githubusercontent.com/openfishtools/web-tools/main/ai/models/" + fileName,
      "https://huggingface.co/cutefishae/resource-cutefish/resolve/main/models/" + fileName
    ];

    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i]);
        if (res.ok) {
          var buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 100000) {
            if (cache) {
              try {
                await cache.put(cacheKey, new Response(buf.slice(0), { headers: { "Content-Type": "application/octet-stream" } }));
              } catch (_) {}
            }
            return buf;
          }
        }
      } catch (_) {}
    }

    throw new Error("Model AI " + fileName + " gagal diunduh.");
  }

  async function getSession(modelId) {
    var key = modelId + "__" + selectedDevice;
    if (sessionCache[key]) return sessionCache[key];

    var ort = await U.ensureOnnxRuntime();
    if (ort.env && ort.env.wasm) {
      ort.env.wasm.numThreads = FF.isMobileDevice() ? 1 : Math.min(4, navigator.hardwareConcurrency || 4);
      ort.env.wasm.simd = true;
    }

    var meta = MODEL_META[modelId];
    logger.append("Memuat model " + meta.file + " [" + selectedDevice.toUpperCase() + "]...");
    var buf = await fetchModelBuffer(meta.file);

    var epList = selectedDevice === "cpu" || meta.type === "rvm"
      ? ["wasm"]
      : [{ name: "webgpu", powerPreference: "high-performance" }, "wasm"];

    var session = null;
    var usedEp = "wasm";
    for (var i = 0; i < epList.length; i++) {
      try {
        session = await ort.InferenceSession.create(buf.slice(0), {
          executionProviders: [epList[i]],
          graphOptimizationLevel: "all"
        });
        usedEp = typeof epList[i] === "string" ? epList[i] : epList[i].name;
        break;
      } catch (_) {}
    }
    if (!session) {
      session = await ort.InferenceSession.create(buf.slice(0), { executionProviders: ["wasm"] });
    }

    recurrentStates = null;
    sessionCache[key] = session;
    logger.append("Model siap (" + usedEp.toUpperCase() + ")");
    return session;
  }

  function smoothstepAlpha(raw) {
    if (raw <= 0.15) return 0;
    if (raw >= 0.70) return 1;
    var t = (raw - 0.15) / 0.55;
    return t * t * (3 - 2 * t);
  }

  async function segmentSource(srcLike) {
    var ort = await U.ensureOnnxRuntime();
    var session = await getSession(selectedModel);
    var cfg = MODEL_META[selectedModel];

    var srcW = srcLike.videoWidth || srcLike.naturalWidth || srcLike.width;
    var srcH = srcLike.videoHeight || srcLike.naturalHeight || srcLike.height;
    var inferW = cfg.w;
    var inferH = cfg.h;
    if (cfg.type === "rvm") {
      inferW = Math.max(256, Math.min(768, Math.round(srcW / 64) * 64));
      inferH = Math.max(256, Math.min(768, Math.round(srcH / 64) * 64));
    }

    var inCanvas = document.createElement("canvas");
    inCanvas.width = inferW;
    inCanvas.height = inferH;
    var ictx = inCanvas.getContext("2d", { willReadFrequently: true });
    ictx.imageSmoothingEnabled = true;
    ictx.imageSmoothingQuality = "high";
    ictx.drawImage(srcLike, 0, 0, inferW, inferH);
    var px = ictx.getImageData(0, 0, inferW, inferH).data;

    var total = inferW * inferH;
    var floatData = new Float32Array(3 * total);
    if (cfg.type === "modnet") {
      var inv127 = 1 / 127.5;
      for (var i = 0, p = 0; i < total; i++, p += 4) {
        floatData[i] = px[p] * inv127 - 1;
        floatData[total + i] = px[p + 1] * inv127 - 1;
        floatData[2 * total + i] = px[p + 2] * inv127 - 1;
      }
    } else {
      var inv255 = 1 / 255;
      for (var j = 0, q = 0; j < total; j++, q += 4) {
        floatData[j] = px[q] * inv255;
        floatData[total + j] = px[q + 1] * inv255;
        floatData[2 * total + j] = px[q + 2] * inv255;
      }
    }

    var inputTensor = new ort.Tensor("float32", floatData, [1, 3, inferH, inferW]);
    var feeds = {};
    if (cfg.type === "rvm") {
      feeds.src = inputTensor;
      if (!recurrentStates) {
        recurrentStates = {
          r1: new ort.Tensor("float32", new Float32Array([0]), [1, 1, 1, 1]),
          r2: new ort.Tensor("float32", new Float32Array([0]), [1, 1, 1, 1]),
          r3: new ort.Tensor("float32", new Float32Array([0]), [1, 1, 1, 1]),
          r4: new ort.Tensor("float32", new Float32Array([0]), [1, 1, 1, 1])
        };
      }
      feeds.r1i = recurrentStates.r1;
      feeds.r2i = recurrentStates.r2;
      feeds.r3i = recurrentStates.r3;
      feeds.r4i = recurrentStates.r4;
      feeds.downsample_ratio = new ort.Tensor("float32", new Float32Array([0.25]), [1]);
    } else {
      feeds[session.inputNames[0]] = inputTensor;
    }

    var res = await session.run(feeds);
    var alphaData = null;
    var maskW = inferW;
    var maskH = inferH;

    if (cfg.type === "rvm") {
      var phaKey = Object.keys(res).find(function (k) { return k.toLowerCase().indexOf("pha") !== -1; }) || "pha";
      var pha = res[phaKey];
      maskW = pha.dims[3] || inferW;
      maskH = pha.dims[2] || inferH;
      alphaData = pha.data.subarray(0, maskW * maskH);
      if (res.r1o) {
        recurrentStates = { r1: res.r1o, r2: res.r2o, r3: res.r3o, r4: res.r4o };
      }
    } else if (cfg.type === "modnet") {
      var rawMod = res[session.outputNames[0]].data;
      alphaData = new Float32Array(total);
      for (var m = 0; m < total; m++) alphaData[m] = smoothstepAlpha(rawMod[m]);
    } else {
      var outT = res[session.outputNames[0]];
      var raw = outT.data;
      maskW = outT.dims[outT.dims.length - 1] || inferW;
      maskH = outT.dims[outT.dims.length - 2] || inferH;
      var area = maskW * maskH;
      alphaData = new Float32Array(area);
      if (outT.dims[1] === 2) {
        for (var k = 0; k < area; k++) {
          alphaData[k] = smoothstepAlpha(1 / (1 + Math.exp(raw[k] - raw[area + k])));
        }
      } else {
        for (var l = 0; l < area; l++) alphaData[l] = smoothstepAlpha(raw[l]);
      }
    }

    var maskCanvas = document.createElement("canvas");
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    var mctx = maskCanvas.getContext("2d");
    var imgData = mctx.createImageData(maskW, maskH);
    for (var n = 0; n < maskW * maskH; n++) {
      imgData.data[n * 4] = 255;
      imgData.data[n * 4 + 1] = 255;
      imgData.data[n * 4 + 2] = 255;
      imgData.data[n * 4 + 3] = Math.max(0, Math.min(255, Math.round(alphaData[n] * 255)));
    }
    mctx.putImageData(imgData, 0, 0);
    return maskCanvas;
  }

  function compositeWithMask(srcLike, maskCanvas, w, h) {
    var maskFull = document.createElement("canvas");
    maskFull.width = w;
    maskFull.height = h;
    var mx = maskFull.getContext("2d");
    mx.imageSmoothingEnabled = true;
    mx.imageSmoothingQuality = "high";
    mx.drawImage(maskCanvas, 0, 0, w, h);

    var fg = document.createElement("canvas");
    fg.width = w;
    fg.height = h;
    var fx = fg.getContext("2d");
    fx.drawImage(srcLike, 0, 0, w, h);
    fx.globalCompositeOperation = "destination-in";
    fx.drawImage(maskFull, 0, 0);

    var out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    var ox = out.getContext("2d");
    if (selectedBg === "green") {
      ox.fillStyle = "#00FF00";
      ox.fillRect(0, 0, w, h);
    } else if (selectedBg === "color") {
      ox.fillStyle = customColor || "#0842a0";
      ox.fillRect(0, 0, w, h);
    } else if (selectedBg === "blur") {
      ox.filter = "blur(16px)";
      ox.drawImage(srcLike, 0, 0, w, h);
      ox.filter = "none";
    }
    ox.drawImage(fg, 0, 0);
    return out;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Gagal membaca gambar.")); };
      img.src = url;
    });
  }

  /* ===== Single-Frame Preview ===== */
  async function generatePreview() {
    if (!currentFile || isProcessing || isGeneratingPreview) return;
    isGeneratingPreview = true;
    var startedAt = performance.now();

    setBusy(true);
    btnPreview.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Preview...';
    logger.setBadge("Preview");
    setProgress(15, "Menyiapkan frame preview...");

    try {
      var frameSource;
      var w = 0;
      var h = 0;

      if (isImageMode) {
        if (!previewImage.complete) {
          await new Promise(function (r) { previewImage.onload = r; });
        }
        frameSource = previewImage;
        w = previewImage.naturalWidth;
        h = previewImage.naturalHeight;
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
        w = frameSource.width;
        h = frameSource.height;
        logger.append("Frame diambil @ " + formatScrubTime(previewVideo.currentTime) + " (" + w + "x" + h + ")");
      }

      setProgress(45, "Menjalankan segmentasi AI (1 frame)...");
      var mask = await segmentSource(frameSource);
      cachedMaskCanvas = mask;
      cachedFrameSource = frameSource;

      setProgress(85, "Menggabungkan hasil preview...");
      var outCanvas = compositeWithMask(frameSource, mask, w, h);

      previewCanvas.width = outCanvas.width;
      previewCanvas.height = outCanvas.height;
      previewCanvas.getContext("2d").drawImage(outCanvas, 0, 0);
      previewCanvas.classList.remove("is-hidden");
      enhancedVideo.classList.add("is-hidden");
      unprocessedOverlay.classList.add("is-hidden");
      labelRight.textContent = "No BG";
      previewActive = true;

      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";
      progressBox.classList.add("is-hidden");
      logger.setBadge("Preview OK");
      logger.append("Preview 1 frame selesai dalam " + elapsed + " (" + outCanvas.width + "x" + outCanvas.height + ")");
    } catch (err) {
      progressBox.classList.add("is-hidden");
      clearPreviewResult(true);
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
  async function processImage() {
    setProgress(15, "Memuat gambar...");
    var img = await loadImage(currentFile);
    setProgress(40, "Menjalankan segmentasi AI...");
    var mask = cachedMaskCanvas || await segmentSource(img);
    cachedMaskCanvas = mask;
    cachedFrameSource = img;
    setProgress(80, "Menggabungkan hasil...");
    var outCanvas = compositeWithMask(img, mask, img.naturalWidth, img.naturalHeight);

    previewCanvas.width = outCanvas.width;
    previewCanvas.height = outCanvas.height;
    previewCanvas.getContext("2d").drawImage(outCanvas, 0, 0);
    unprocessedOverlay.classList.add("is-hidden");
    labelRight.textContent = "No BG";
    previewActive = true;

    var fmt = selectedBg === "transparent"
      ? (IMAGE_FORMATS.find(function (f) { return f.id === selectedFormat; }) || IMAGE_FORMATS[0])
      : IMAGE_FORMATS[0];

    setProgress(94, "Menyimpan " + fmt.ext.toUpperCase() + "...");
    var blob = await new Promise(function (r) { outCanvas.toBlob(r, fmt.mime, 0.95); });
    if (!blob) throw new Error("Gagal mengodekan gambar hasil.");

    var suffix = selectedBg === "transparent" ? "_nobg." + fmt.ext : "_" + selectedBg + "." + fmt.ext;
    var outName = currentFile.name.replace(/\.[^/.]+$/, "") + suffix;
    return { blob: blob, outName: outName };
  }

  async function processVideo() {
    setProgress(8, "Memuat FFmpeg WASM...");
    if (!ffmpeg) {
      ffmpeg = await FF.createInstance({ log: function (m) { logger.append(m); } });
    }

    var ext = (currentFile.name.split(".").pop() || "mp4").toLowerCase();
    var inName = "input." + ext;
    await ffmpeg.writeFile(inName, await FF.fetchFile(currentFile));

    var meta = await U.probeVideoMetadata(currentFile);
    var w = (meta.width || 640) & ~1;
    var h = (meta.height || 360) & ~1;
    var fps = 30;

    setProgress(15, "Mengekstrak frame video...");
    logger.append("Mengekstrak frame video (" + w + "x" + h + ")...");
    await ffmpeg.exec(["-i", inName, "-vf", "scale=" + w + ":" + h, "-vsync", "0", "-qscale:v", "2", "in_%05d.jpg"]);

    var totalFrames = 0;
    while (true) {
      try {
        var check = await ffmpeg.readFile("in_" + String(totalFrames + 1).padStart(5, "0") + ".jpg");
        if (!check || !check.byteLength) break;
        totalFrames++;
      } catch (_) {
        break;
      }
    }
    if (totalFrames === 0) throw new Error("Tidak ada frame yang berhasil diekstrak.");
    if (meta.duration > 0) fps = Math.max(10, Math.min(60, Math.round(totalFrames / meta.duration)));

    logger.append("Memproses " + totalFrames + " frame @ " + fps + " FPS...");
    recurrentStates = null;

    var isTransparent = selectedBg === "transparent";
    var frameExt = isTransparent ? "png" : "jpg";
    var frameCanvas = document.createElement("canvas");
    frameCanvas.width = w;
    frameCanvas.height = h;
    var fctx = frameCanvas.getContext("2d", { willReadFrequently: true });

    try {
      for (var i = 0; i < totalFrames; i++) {
        var inFrame = "in_" + String(i + 1).padStart(5, "0") + ".jpg";
        var fData = await ffmpeg.readFile(inFrame);
        var bmp = await createImageBitmap(new Blob([fData], { type: "image/jpeg" }));
        fctx.clearRect(0, 0, w, h);
        fctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        try { await ffmpeg.deleteFile(inFrame); } catch (_) {}

        var mask = await segmentSource(frameCanvas);
        var outCanvas = compositeWithMask(frameCanvas, mask, w, h);
        var fBlob = await new Promise(function (r) {
          outCanvas.toBlob(r, isTransparent ? "image/png" : "image/jpeg", 0.94);
        });
        await ffmpeg.writeFile("out_" + String(i).padStart(5, "0") + "." + frameExt, new Uint8Array(await fBlob.arrayBuffer()));

        var pct = 18 + Math.round(((i + 1) / totalFrames) * 68);
        setProgress(Math.min(86, pct), "Segmentasi frame " + (i + 1) + "/" + totalFrames + "...");
        if ((i + 1) % 10 === 0 || i + 1 === totalFrames) {
          logger.append("Progress frame: " + (i + 1) + "/" + totalFrames);
          await new Promise(function (r) { setTimeout(r, 4); });
        }
      }

      var threads = String(Math.min(4, navigator.hardwareConcurrency || 4));
      var outFile = "matting.mp4";
      var outMime = "video/mp4";
      var outName = currentFile.name.replace(/\.[^/.]+$/, "") + "_" + selectedBg + ".mp4";

      setProgress(88, "Merender video hasil...");
      if (isTransparent) {
        var fmtMeta = VIDEO_FORMATS.find(function (f) { return f.id === selectedFormat; }) || VIDEO_FORMATS[0];
        outFile = "matting." + fmtMeta.ext;
        outMime = fmtMeta.mime;
        outName = currentFile.name.replace(/\.[^/.]+$/, "") + "_nobg." + fmtMeta.ext;

        if (fmtMeta.id === "mov") {
          await ffmpeg.exec(["-y", "-framerate", String(fps), "-threads", threads, "-i", "out_%05d.png", "-i", inName, "-map", "0:v", "-map", "1:a?", "-c:v", "png", "-pix_fmt", "rgba", "-r", String(fps), "-c:a", "copy", "-shortest", outFile]);
        } else if (fmtMeta.id === "webm") {
          await ffmpeg.exec(["-y", "-framerate", String(fps), "-threads", threads, "-i", "out_%05d.png", "-i", inName, "-map", "0:v", "-map", "1:a?", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-r", String(fps), "-c:a", "libopus", "-shortest", outFile]);
        } else {
          await ffmpeg.exec(["-y", "-framerate", String(fps), "-threads", threads, "-i", "out_%05d.png", "-i", inName, "-map", "0:v", "-map", "1:a?", "-c:v", "libx265", "-pix_fmt", "yuva420p", "-r", String(fps), "-c:a", "copy", "-shortest", outFile]);
        }
      } else {
        await ffmpeg.exec(["-y", "-framerate", String(fps), "-threads", threads, "-i", "out_%05d.jpg", "-i", inName, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", String(fps), "-c:a", "copy", "-shortest", outFile]);
      }

      var data = await ffmpeg.readFile(outFile);
      if (!data || data.byteLength < 512) throw new Error("Gagal merender video hasil.");
      try { await ffmpeg.deleteFile(outFile); } catch (_) {}

      return { blob: new Blob([data], { type: outMime }), outName: outName };
    } finally {
      try { await ffmpeg.deleteFile(inName); } catch (_) {}
      for (var c = 0; c < totalFrames; c++) {
        try { await ffmpeg.deleteFile("in_" + String(c + 1).padStart(5, "0") + ".jpg"); } catch (_) {}
        try { await ffmpeg.deleteFile("out_" + String(c).padStart(5, "0") + "." + frameExt); } catch (_) {}
      }
    }
  }

  btnStart.addEventListener("click", async function () {
    if (!currentFile || isProcessing || isGeneratingPreview) return;
    isProcessing = true;
    var startedAt = performance.now();

    setBusy(true);
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Memproses...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");

    try {
      var res = isImageMode ? await processImage() : await processVideo();
      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";

      progressBox.classList.add("is-hidden");
      statOriginal.textContent = U.formatBytes(currentFile.size);
      statOutput.textContent = U.formatBytes(res.blob.size);
      statElapsed.textContent = elapsed;
      statsGrid.classList.remove("is-hidden");

      logger.setBadge("Done");
      logger.append("Selesai dalam " + elapsed + " \u2022 " + U.formatBytes(res.blob.size));
      logger.append("Mengunduh otomatis: " + res.outName);
      U.triggerDownload(res.blob, res.outName);

      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">content_cut</span> Proses Ulang';
    } catch (err) {
      progressBox.classList.add("is-hidden");
      logger.setBadge("Error");
      logger.append("Gagal: " + (err && err.message ? err.message : String(err)));
      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">content_cut</span> Coba Lagi';
    } finally {
      isProcessing = false;
      setBusy(false);
    }
  });

  window.addEventListener("pagehide", function () {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    if (enhancedVideoUrl) URL.revokeObjectURL(enhancedVideoUrl);
  });
})();
