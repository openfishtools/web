(function () {
  "use strict";

  var U = window.AppUtils;
  var FF = window.CutefishFFmpeg;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("file-input");
  var workspace = document.getElementById("workspace");
  var fileNameEl = document.getElementById("file-name");
  var fileDetailsEl = document.getElementById("file-details");
  var btnChangeFile = document.getElementById("btn-change-file");

  var fpsInputVal = document.getElementById("fps-input-val");
  var fpsTargetVal = document.getElementById("fps-target-val");
  var multGroup = document.getElementById("mult-group");
  var engineNoticeText = document.getElementById("engine-notice-text");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statFrames = document.getElementById("stat-frames");
  var statSize = document.getElementById("stat-size");
  var statElapsed = document.getElementById("stat-elapsed");

  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var currentFile = null;
  var originalFps = 30;
  var multiplier = 2;
  var isProcessing = false;
  var ffmpeg = null;

  (async function checkWebGpu() {
    var hasGpu = false;
    if (navigator.gpu) {
      try {
        var adapter = await Promise.race([
          navigator.gpu.requestAdapter(),
          new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, 1500); })
        ]);
        if (adapter) hasGpu = true;
      } catch (_) {}
    }
    engineNoticeText.textContent = hasGpu
      ? "WebGPU tersedia — inferensi RIFE v4.7 berjalan di GPU."
      : "WebGPU tidak tersedia — menggunakan CPU WASM.";
  })();

  function setProgress(pct, status) {
    progressBox.classList.remove("is-hidden");
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    if (status) progressStatus.textContent = status;
  }

  function updateFpsLabels() {
    fpsInputVal.textContent = Math.round(originalFps) + " FPS";
    fpsTargetVal.textContent = Math.round(originalFps * multiplier) + " FPS";
  }

  function detectFps(file) {
    return new Promise(function (resolve) {
      var video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      var url = URL.createObjectURL(file);
      video.src = url;
      var resolved = false;
      function done(fps) {
        if (resolved) return;
        resolved = true;
        try { video.pause(); } catch (_) {}
        URL.revokeObjectURL(url);
        resolve(fps);
      }

      if ("requestVideoFrameCallback" in video) {
        var frames = [];
        var timer = setTimeout(function () { done(30); }, 2500);
        var cb = function (_now, meta) {
          frames.push(meta.mediaTime);
          if (frames.length < 8) {
            video.requestVideoFrameCallback(cb);
          } else {
            clearTimeout(timer);
            var diffs = [];
            for (var k = 1; k < frames.length; k++) {
              var d = frames[k] - frames[k - 1];
              if (d > 0.001) diffs.push(d);
            }
            if (!diffs.length) return done(30);
            var avg = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length;
            var raw = 1 / avg;
            var common = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
            var nearest = common.reduce(function (p, c) { return Math.abs(c - raw) < Math.abs(p - raw) ? c : p; });
            done(nearest);
          }
        };
        video.oncanplay = function () {
          video.currentTime = 0;
          video.requestVideoFrameCallback(cb);
          video.play().catch(function () { clearTimeout(timer); done(30); });
        };
        video.onerror = function () { clearTimeout(timer); done(30); };
      } else {
        video.onloadedmetadata = function () { done(30); };
        video.onerror = function () { done(30); };
      }
    });
  }

  async function fetchRifeModel() {
    var fileName = "rife47_ensemble_True_scale_1_sim.onnx";
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
          logger.append("Model RIFE dimuat dari cache lokal");
          return await hit.arrayBuffer();
        }
      } catch (_) {}
    }

    var urls = [
      "../../assets/models/" + fileName,
      "https://huggingface.co/cutefishae/resource-cutefish/resolve/main/models/" + fileName,
      "https://cdn.jsdelivr.net/gh/openfishtools/web-tools@main/ai/models/" + fileName,
      "https://huggingface.co/yuvraj108c/rife-onnx/resolve/main/" + fileName
    ];

    for (var i = 0; i < urls.length; i++) {
      try {
        logger.append("Mengunduh model RIFE v4.7...");
        var res = await fetch(urls[i]);
        if (res.ok) {
          var buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 1000000) {
            var head = new TextDecoder().decode(new Uint8Array(buf.slice(0, 32)));
            if (head.indexOf("<!DOCTYPE") === -1 && head.indexOf("File size exceeded") === -1) {
              if (cache) {
                try {
                  await cache.put(cacheKey, new Response(buf.slice(0), { headers: { "Content-Type": "application/octet-stream" } }));
                } catch (_) {}
              }
              return buf;
            }
          }
        }
      } catch (_) {}
    }
    throw new Error("Gagal mengunduh model RIFE v4.7.");
  }

  function createRifeEngine(origW, origH) {
    var w = Math.ceil(origW / 32) * 32;
    var h = Math.ceil(origH / 32) * 32;
    var total = w * h;

    var c0 = document.createElement("canvas");
    c0.width = w;
    c0.height = h;
    var ctx0 = c0.getContext("2d", { willReadFrequently: true });

    var c1 = document.createElement("canvas");
    c1.width = w;
    c1.height = h;
    var ctx1 = c1.getContext("2d", { willReadFrequently: true });

    var interpC = document.createElement("canvas");
    interpC.width = w;
    interpC.height = h;
    var interpCtx = interpC.getContext("2d", { willReadFrequently: true });

    var float0 = new Float32Array(total * 3);
    var float1 = new Float32Array(total * 3);
    var targetImg = interpCtx.createImageData(w, h);
    var targetU32 = new Uint32Array(targetImg.data.buffer);
    var session = null;
    var modelBuf = null;
    var useGpu = false;

    async function init() {
      if (navigator.gpu) {
        try {
          var ad = await Promise.race([
            navigator.gpu.requestAdapter(),
            new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, 1500); })
          ]);
          if (ad) useGpu = true;
        } catch (_) {}
      }
      var ort = await U.ensureOnnxRuntime();
      if (ort.env && ort.env.wasm) {
        ort.env.wasm.numThreads = FF.isMobileDevice() ? 1 : Math.min(4, navigator.hardwareConcurrency || 4);
        ort.env.wasm.simd = true;
      }

      modelBuf = await fetchRifeModel();
      var epList = useGpu ? [{ name: "webgpu", powerPreference: "high-performance" }, "wasm"] : ["wasm"];
      try {
        session = await ort.InferenceSession.create(modelBuf.slice(0), {
          executionProviders: epList,
          graphOptimizationLevel: "all"
        });
      } catch (_) {
        useGpu = false;
        session = await ort.InferenceSession.create(modelBuf.slice(0), {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all"
        });
      }
      logger.append("RIFE v4.7 siap (" + (useGpu ? "WebGPU" : "WASM") + ")");
    }

    async function interpolate(src0, src1, progressVal, outCanvas) {
      var ort = window.ort;
      ctx0.clearRect(0, 0, w, h);
      ctx0.drawImage(src0, 0, 0, origW, origH, 0, 0, w, h);
      var d0 = ctx0.getImageData(0, 0, w, h).data;

      ctx1.clearRect(0, 0, w, h);
      ctx1.drawImage(src1, 0, 0, origW, origH, 0, 0, w, h);
      var d1 = ctx1.getImageData(0, 0, w, h).data;

      var inv = 1 / 255;
      var go = total;
      var bo = total * 2;
      for (var i = 0, p = 0; i < total; i++, p += 4) {
        float0[i] = d0[p] * inv;
        float0[go + i] = d0[p + 1] * inv;
        float0[bo + i] = d0[p + 2] * inv;
        float1[i] = d1[p] * inv;
        float1[go + i] = d1[p + 1] * inv;
        float1[bo + i] = d1[p + 2] * inv;
      }

      var t0 = new ort.Tensor("float32", float0, [1, 3, h, w]);
      var t1 = new ort.Tensor("float32", float1, [1, 3, h, w]);
      var tt = new ort.Tensor("float32", new Float32Array([progressVal]), [1]);

      var names = session.inputNames;
      var n0 = names.find(function (n) { return n.indexOf("0") !== -1 || n.indexOf("img0") !== -1; }) || names[0];
      var n1 = names.find(function (n) { return n.indexOf("1") !== -1 || n.indexOf("img1") !== -1; }) || names[1];
      var nt = names.find(function (n) { return n.indexOf("time") !== -1; }) || (names.length > 2 ? names[2] : null);

      var feeds = {};
      feeds[n0] = t0;
      feeds[n1] = t1;
      if (nt) feeds[nt] = tt;

      var res;
      try {
        res = await session.run(feeds);
      } catch (err) {
        if (useGpu && modelBuf) {
          useGpu = false;
          session = await ort.InferenceSession.create(modelBuf.slice(0), {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all"
          });
          res = await session.run(feeds);
        } else {
          throw err;
        }
      }

      try {
        var out = res[session.outputNames[0]].data;
        for (var j = 0; j < total; j++) {
          var r = Math.min(255, Math.max(0, (out[j] * 255) | 0));
          var g = Math.min(255, Math.max(0, (out[go + j] * 255) | 0));
          var b = Math.min(255, Math.max(0, (out[bo + j] * 255) | 0));
          targetU32[j] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
        interpCtx.putImageData(targetImg, 0, 0);
        var oc = outCanvas.getContext("2d");
        oc.clearRect(0, 0, origW, origH);
        oc.drawImage(interpC, 0, 0, w, h, 0, 0, origW, origH);
      } finally {
        try { t0.dispose(); } catch (_) {}
        try { t1.dispose(); } catch (_) {}
        try { tt.dispose(); } catch (_) {}
        if (res) {
          Object.keys(res).forEach(function (k) {
            try { if (res[k] && typeof res[k].dispose === "function") res[k].dispose(); } catch (_) {}
          });
        }
      }
    }

    function destroy() {
      if (session && typeof session.release === "function") {
        try { session.release(); } catch (_) {}
      }
      session = null;
      modelBuf = null;
    }

    return { init: init, interpolate: interpolate, destroy: destroy };
  }

  U.bindDropzone(dropzone, fileInput, handleFile);

  btnChangeFile.addEventListener("click", function () {
    if (isProcessing) return;
    fileInput.value = "";
    fileInput.click();
  });

  U.bindSegmented(multGroup, "mult", function (m) {
    multiplier = parseInt(m, 10) || 2;
    updateFpsLabels();
  });

  function handleFile(file) {
    if (!file || !file.type.startsWith("video/")) {
      logger.setBadge("Error");
      logger.append("Pilih file video yang valid.");
      return;
    }

    currentFile = file;
    originalFps = 30;
    updateFpsLabels();

    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">slow_motion_video</span> Mulai Interpolasi';
    logger.setBadge("Ready");

    Promise.all([U.probeVideoMetadata(file), detectFps(file)]).then(function (results) {
      if (currentFile !== file) return;
      var meta = results[0];
      originalFps = results[1] || 30;
      updateFpsLabels();

      var parts = [U.formatBytes(file.size)];
      if (meta.width && meta.height) parts.push(meta.width + "x" + meta.height);
      parts.push(Math.round(originalFps) + " FPS");
      if (meta.duration) parts.push(U.formatDuration(meta.duration));
      fileDetailsEl.textContent = parts.join(" \u2022 ");
      logger.append("Video dimuat: " + file.name + " (" + parts.join(", ") + ")");
    });
  }

  btnStart.addEventListener("click", async function () {
    if (!currentFile || isProcessing) return;
    isProcessing = true;
    var startedAt = performance.now();
    var outIdx = 0;
    var totalIn = 0;
    var inName = null;
    var rife = null;

    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Menginterpolasi...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");
    setProgress(5, "Menyiapkan FFmpeg WASM...");

    try {
      if (!ffmpeg) {
        ffmpeg = await FF.createInstance({ log: function (m) { logger.append(m); } });
      }

      var meta = await U.probeVideoMetadata(currentFile);
      var origW = (meta.width || 640) & ~1;
      var origH = (meta.height || 360) & ~1;
      var maxDim = FF.isMobileDevice() ? 640 : 960;
      var scale = Math.max(origW, origH) > maxDim ? (maxDim / Math.max(origW, origH)) : 1;
      var procW = Math.max(64, Math.round(origW * scale) & ~1);
      var procH = Math.max(64, Math.round(origH * scale) & ~1);
      var targetFps = Math.round(originalFps * multiplier);

      logger.append("Resolusi inferensi: " + procW + "x" + procH + " (" + Math.round(originalFps) + " \u2192 " + targetFps + " FPS)");
      setProgress(15, "Memuat model AI RIFE v4.7...");
      rife = createRifeEngine(procW, procH);
      await rife.init();

      var ext = (currentFile.name.split(".").pop() || "mp4").toLowerCase();
      inName = "input." + ext;
      await ffmpeg.writeFile(inName, await FF.fetchFile(currentFile));

      setProgress(28, "Mengekstrak frame video...");
      await ffmpeg.exec(["-i", inName, "-vf", "scale=" + procW + ":" + procH, "-vsync", "0", "-qscale:v", "3", "in_%05d.jpg"]);

      while (true) {
        try {
          var check = await ffmpeg.readFile("in_" + String(totalIn + 1).padStart(5, "0") + ".jpg");
          if (!check || !check.byteLength) break;
          totalIn++;
        } catch (_) {
          break;
        }
      }
      if (totalIn < 2) throw new Error("Frame tidak cukup untuk interpolasi.");

      var totalOut = (totalIn - 1) * multiplier + 1;
      logger.append("Diekstrak " + totalIn + " frame \u2192 menghasilkan " + totalOut + " frame");

      var c0 = document.createElement("canvas");
      c0.width = procW;
      c0.height = procH;
      var ctx0 = c0.getContext("2d", { willReadFrequently: true });

      var c1 = document.createElement("canvas");
      c1.width = procW;
      c1.height = procH;
      var ctx1 = c1.getContext("2d", { willReadFrequently: true });

      var outC = document.createElement("canvas");
      outC.width = procW;
      outC.height = procH;

      async function writeFrame(canvas) {
        var b = await new Promise(function (r) { canvas.toBlob(r, "image/jpeg", 0.88); });
        await ffmpeg.writeFile("frame_" + String(outIdx++).padStart(5, "0") + ".jpg", new Uint8Array(await b.arrayBuffer()));
      }

      var f1 = await ffmpeg.readFile("in_00001.jpg");
      var img0 = await createImageBitmap(new Blob([f1], { type: "image/jpeg" }));
      ctx0.drawImage(img0, 0, 0, procW, procH);
      img0.close();
      try { await ffmpeg.deleteFile("in_00001.jpg"); } catch (_) {}

      for (var i = 2; i <= totalIn; i++) {
        var fName = "in_" + String(i).padStart(5, "0") + ".jpg";
        var fData = await ffmpeg.readFile(fName);
        var img1 = await createImageBitmap(new Blob([fData], { type: "image/jpeg" }));
        ctx1.clearRect(0, 0, procW, procH);
        ctx1.drawImage(img1, 0, 0, procW, procH);
        img1.close();
        try { await ffmpeg.deleteFile(fName); } catch (_) {}

        for (var s = 0; s < multiplier; s++) {
          var p = s / multiplier;
          if (p === 0) {
            await writeFrame(c0);
          } else {
            await rife.interpolate(c0, c1, p, outC);
            await writeFrame(outC);
          }
        }

        ctx0.clearRect(0, 0, procW, procH);
        ctx0.drawImage(c1, 0, 0);

        var pct = 35 + Math.round(((i - 1) / totalIn) * 50);
        setProgress(Math.min(85, pct), "Interpolasi " + outIdx + "/" + totalOut + " frame...");
        if (i % 10 === 0) logger.append("Progress: " + outIdx + "/" + totalOut + " frame");
        if (i % 2 === 0) await new Promise(function (r) { setTimeout(r, 4); });
      }
      await writeFrame(c0);

      setProgress(88, "Encoding video " + targetFps + " FPS...");
      var threads = String(Math.min(4, navigator.hardwareConcurrency || 4));
      var args = ["-y", "-framerate", String(targetFps), "-threads", threads, "-i", "frame_%05d.jpg", "-i", inName];
      if (scale < 1) args.push("-vf", "scale=" + origW + ":" + origH + ":flags=bicubic");
      args.push("-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(targetFps), "-preset", "ultrafast", "-movflags", "+faststart", "-shortest", "output.mp4");

      await ffmpeg.exec(args);

      setProgress(96, "Menyimpan MP4...");
      var outBytes = await ffmpeg.readFile("output.mp4");
      if (!outBytes || outBytes.byteLength < 1024) throw new Error("Render video interpolasi gagal.");

      var blob = new Blob([outBytes], { type: "video/mp4" });
      var outName = currentFile.name.replace(/\.[^/.]+$/, "") + "_" + multiplier + "x_" + targetFps + "fps.mp4";
      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1) + "s";

      progressBox.classList.add("is-hidden");
      statFrames.textContent = String(outIdx);
      statSize.textContent = U.formatBytes(blob.size);
      statElapsed.textContent = elapsed;
      statsGrid.classList.remove("is-hidden");

      logger.setBadge("Done");
      logger.append("Selesai dalam " + elapsed + " \u2022 " + outIdx + " frame @ " + targetFps + " FPS");
      logger.append("Mengunduh otomatis: " + outName);
      U.triggerDownload(blob, outName);

      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">slow_motion_video</span> Interpolasi Ulang';
    } catch (err) {
      progressBox.classList.add("is-hidden");
      logger.setBadge("Error");
      logger.append("Gagal: " + (err && err.message ? err.message : String(err)));
      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">slow_motion_video</span> Coba Lagi';
    } finally {
      if (rife) rife.destroy();
      if (ffmpeg) {
        for (var a = 0; a < outIdx; a++) {
          try { await ffmpeg.deleteFile("frame_" + String(a).padStart(5, "0") + ".jpg"); } catch (_) {}
        }
        for (var b = 1; b <= totalIn; b++) {
          try { await ffmpeg.deleteFile("in_" + String(b).padStart(5, "0") + ".jpg"); } catch (_) {}
        }
        if (inName) try { await ffmpeg.deleteFile(inName); } catch (_) {}
        try { await ffmpeg.deleteFile("output.mp4"); } catch (_) {}
      }
      isProcessing = false;
      btnStart.disabled = false;
    }
  });
})();
