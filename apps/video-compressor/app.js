(function () {
  "use strict";

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("file-input");
  var workspace = document.getElementById("workspace");
  var fileNameEl = document.getElementById("file-name");
  var fileDetailsEl = document.getElementById("file-details");
  var btnChangeFile = document.getElementById("btn-change-file");
  var btnStart = document.getElementById("btn-start");
  var logsOutput = document.getElementById("logs-output");
  var logsBadge = document.getElementById("logs-badge");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statOriginal = document.getElementById("stat-original");
  var statCompressed = document.getElementById("stat-compressed");
  var statSavings = document.getElementById("stat-savings");

  var checkAudio = document.getElementById("check-audio");
  var canvas = document.getElementById("offscreen-canvas");
  var ctx = canvas.getContext("2d");

  var FF = window.CutefishFFmpeg;
  var MAX_SHORT_SIDE = 1080;

  /**
   * Tuned HD encoding profiles per codec.
   * All presets preserve native HD (<= 1080p) and cap bitrate dynamically below
   * the input video's bitrate so Fast > Medium > Slow < Input holds consistently.
   */
  var CODEC_PROFILES = {
    h264: {
      fast:   { preset: "veryfast", crf: 21, capRatio: 0.78, ceilingKbps: 6500, aqStrength: "1.00", deblock: "0,0" },
      medium: { preset: "medium",   crf: 23, capRatio: 0.56, ceilingKbps: 4200, aqStrength: "1.05", deblock: "-1,-1" },
      slow:   { preset: "slow",     crf: 24, capRatio: 0.38, ceilingKbps: 2600, aqStrength: "1.10", deblock: "-1,-1" }
    },
    hevc: {
      fast:   { preset: "superfast", crf: 23, capRatio: 0.68, ceilingKbps: 4200, psyRd: "1.4" },
      medium: { preset: "faster",    crf: 25, capRatio: 0.48, ceilingKbps: 2800, psyRd: "1.5" },
      slow:   { preset: "medium",    crf: 27, capRatio: 0.32, ceilingKbps: 1700, psyRd: "1.5" }
    }
  };

  var currentFile = null;
  var currentVideoUrl = null;
  var compressedBlobUrl = null;
  var currentMeta = { width: 0, height: 0, duration: 0 };
  var metadataPromise = null;
  var isProcessing = false;
  var jobStartedAt = 0;

  var selectedCodec = "h264";
  var selectedPreset = "medium";

  var ffmpeg = null;
  var isEngineReady = false;
  var isEngineLoading = false;
  var MAX_LOG_LINES = 120;
  var logLines = [];

  function setLogBadge(label) {
    if (logsBadge) logsBadge.textContent = label;
  }

  function appendLog(message) {
    if (!logsOutput || !message) return;
    var text = String(message).trim();
    if (!text) return;
    var now = new Date();
    var ts =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0") + ":" +
      String(now.getSeconds()).padStart(2, "0");
    logLines.push("[" + ts + "] " + text);
    if (logLines.length > MAX_LOG_LINES) {
      logLines = logLines.slice(logLines.length - MAX_LOG_LINES);
    }
    logsOutput.textContent = logLines.join("\n");
    logsOutput.scrollTop = logsOutput.scrollHeight;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    var k = 1024;
    var sizes = ["B", "KB", "MB", "GB"];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return "00:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function probeVideoMetadata(url, fileSize) {
    return new Promise(function (resolve) {
      var probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;

      function cleanup() {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute("src");
        probe.load();
      }

      probe.onloadedmetadata = function () {
        var meta = {
          width: probe.videoWidth || 0,
          height: probe.videoHeight || 0,
          duration: probe.duration || 0
        };
        if (currentVideoUrl === url) {
          currentMeta = meta;
          fileDetailsEl.textContent =
            formatBytes(fileSize) + " \u2022 " +
            meta.width + "x" + meta.height + " \u2022 " +
            formatDuration(meta.duration);
        }
        cleanup();
        resolve(meta);
      };

      probe.onerror = function () {
        cleanup();
        resolve({ width: 0, height: 0, duration: 0 });
      };

      probe.src = url;
    });
  }

  async function initFFmpeg() {
    if (isEngineReady) return ffmpeg;
    if (isEngineLoading) {
      while (isEngineLoading) {
        await new Promise(function (r) { setTimeout(r, 100); });
      }
      return ffmpeg;
    }

    if (!FF || typeof FF.createInstance !== "function") {
      return null;
    }

    isEngineLoading = true;
    setLogBadge("Loading Engine");
    appendLog("Memuat engine FFmpeg WASM...");
    try {
      ffmpeg = await FF.createInstance({ log: appendLog });
      ffmpeg.on("log", function (entry) {
        if (!entry || !entry.message) return;
        var msg = entry.message;
        if (msg.indexOf("frame=") !== -1 || msg.indexOf("error") !== -1 || msg.indexOf("Output #0") !== -1) {
          appendLog(msg);
        }
      });

      ffmpeg.on("progress", function (p) {
        if (typeof p.progress === "number" && p.progress >= 0 && p.progress <= 1) {
          var pct = Math.min(99, Math.round(p.progress * 100));
          progressFill.style.width = pct + "%";
          progressPercent.textContent = pct + "%";
          progressStatus.textContent = "Mengompresi video (" + pct + "%)...";
        }
      });

      isEngineReady = true;
      setLogBadge("Ready");
    } catch (err) {
      setLogBadge("Fallback");
      appendLog("FFmpeg gagal dimuat, mode fallback aktif");
      console.error("FFmpeg init failed:", err);
    } finally {
      isEngineLoading = false;
    }

    return ffmpeg;
  }

  // Lazy pre-warm FFmpeg shortly after app opens
  setTimeout(function () {
    initFFmpeg().catch(function () {});
  }, 400);

  // Dropzone & File Selection
  dropzone.addEventListener("click", function () { fileInput.click(); });
  dropzone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  btnChangeFile.addEventListener("click", function () {
    fileInput.value = "";
    fileInput.click();
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });

  function bindSegmentedGroup(groupSelector, dataKey, onChange) {
    var segments = document.querySelectorAll(groupSelector + " .m3-segment");
    segments.forEach(function (seg) {
      seg.addEventListener("click", function () {
        segments.forEach(function (s) {
          s.classList.remove("is-active");
          s.setAttribute("aria-checked", "false");
        });
        seg.classList.add("is-active");
        seg.setAttribute("aria-checked", "true");
        onChange(seg.dataset[dataKey]);
      });
    });
  }

  bindSegmentedGroup("#codec-group", "codec", function (codec) {
    selectedCodec = codec;
  });

  bindSegmentedGroup("#preset-group", "preset", function (preset) {
    selectedPreset = preset;
  });

  function handleFile(file) {
    if (!file || !file.type.startsWith("video/")) {
      alert("Pilih file video yang valid.");
      return;
    }

    currentFile = file;
    currentMeta = { width: 0, height: 0, duration: 0 };
    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
    compressedBlobUrl = null;

    currentVideoUrl = URL.createObjectURL(file);

    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");

    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">compress</span> Mulai Kompresi';

    metadataPromise = probeVideoMetadata(currentVideoUrl, file.size).then(function (meta) {
      appendLog("File dimuat: " + file.name + " (" + formatBytes(file.size) + ", " + meta.width + "x" + meta.height + ", " + formatDuration(meta.duration) + ")");
      return meta;
    });
  }

  function buildVideoScaleFilter(meta) {
    var w = meta.width;
    var h = meta.height;

    if (w > 0 && h > 0) {
      var shortSide = Math.min(w, h);
      if (shortSide > MAX_SHORT_SIDE) {
        // Scale 2K/4K sources cleanly down to crisp 1080p Full HD
        return w >= h
          ? "scale=-2:" + MAX_SHORT_SIDE + ":flags=lanczos"
          : "scale=" + MAX_SHORT_SIDE + ":-2:flags=lanczos";
      }
      if (w % 2 === 0 && h % 2 === 0) {
        return null;
      }
    }

    // Keep native HD dimensions, ensuring even numbers for yuv420p
    return "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  }

  function computeBitrateBudget(meta, fileSize, keepAudio, profile) {
    var durationSec = Math.max(1, meta.duration || 10);
    var origTotalKbps = (fileSize * 8) / durationSec / 1000;
    var audioKbps = keepAudio ? (origTotalKbps < 1200 ? 96 : 128) : 0;
    var origVideoKbps = Math.max(250, origTotalKbps - audioKbps);
    var maxRateKbps = Math.max(180, Math.min(profile.ceilingKbps, Math.round(origVideoKbps * profile.capRatio)));

    return {
      audioKbps: audioKbps,
      maxRateKbps: maxRateKbps,
      bufSizeKbps: Math.round(maxRateKbps * 1.6)
    };
  }

  function buildFFmpegArgs(inputName, outputName, meta) {
    var keepAudio = checkAudio.checked;
    var profile = CODEC_PROFILES[selectedCodec][selectedPreset];
    var budget = computeBitrateBudget(meta, currentFile.size, keepAudio, profile);
    var scaleFilter = buildVideoScaleFilter(meta);

    var args = ["-i", inputName];

    if (scaleFilter) {
      args.push("-vf", scaleFilter);
    }

    if (selectedCodec === "hevc") {
      args.push(
        "-c:v", "libx265",
        "-preset", profile.preset,
        "-crf", String(profile.crf),
        "-tag:v", "hvc1",
        "-pix_fmt", "yuv420p",
        "-x265-params",
        "aq-mode=2:psy-rd=" + profile.psyRd +
          ":vbv-maxrate=" + budget.maxRateKbps +
          ":vbv-bufsize=" + budget.bufSizeKbps +
          ":log-level=error"
      );
    } else {
      args.push(
        "-c:v", "libx264",
        "-profile:v", "high",
        "-preset", profile.preset,
        "-crf", String(profile.crf),
        "-maxrate", budget.maxRateKbps + "k",
        "-bufsize", budget.bufSizeKbps + "k",
        "-pix_fmt", "yuv420p",
        "-x264-params",
        "aq-mode=2:aq-strength=" + profile.aqStrength + ":deblock=" + profile.deblock
      );
    }

    if (keepAudio) {
      args.push("-c:a", "aac", "-b:a", budget.audioKbps + "k");
    } else {
      args.push("-an");
    }

    args.push("-movflags", "+faststart", "-y", outputName);
    return args;
  }

  btnStart.addEventListener("click", function () {
    if (!currentFile || isProcessing) return;
    startCompression();
  });

  async function startCompression() {
    isProcessing = true;
    jobStartedAt = performance.now();
    setLogBadge("Running");
    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Mengompresi...';

    progressBox.classList.remove("is-hidden");
    progressFill.style.width = "0%";
    progressPercent.textContent = "0%";
    progressStatus.textContent = "Mempersiapkan engine FFmpeg...";
    statsGrid.classList.add("is-hidden");

    if (metadataPromise && (!currentMeta.duration || !currentMeta.width)) {
      await metadataPromise;
    }

    try {
      var ff = await initFFmpeg();
      if (ff && isEngineReady) {
        await runFFmpegCompress(ff);
        return;
      }
    } catch (err) {
      appendLog("FFmpeg error: " + (err && err.message ? err.message : String(err)) + " — beralih ke fallback");
      console.warn("FFmpeg error, switching to native fallback:", err);
    }

    runCanvasFallbackCompress();
  }

  async function runFFmpegCompress(ff) {
    var ext = currentFile.name.split(".").pop().toLowerCase() || "mp4";
    var inputName = "input." + ext;
    var outputName = "output.mp4";

    progressStatus.textContent = "Membaca file video...";
    var fileData = new Uint8Array(await currentFile.arrayBuffer());
    await ff.writeFile(inputName, fileData);

    var profile = CODEC_PROFILES[selectedCodec][selectedPreset];
    var budget = computeBitrateBudget(currentMeta, currentFile.size, checkAudio.checked, profile);
    appendLog("Mulai " + selectedCodec.toUpperCase() + " [" + selectedPreset.toUpperCase() + "] • preset=" + profile.preset + " crf=" + profile.crf + " maxrate=" + budget.maxRateKbps + "k");

    var args = buildFFmpegArgs(inputName, outputName, currentMeta);

    progressStatus.textContent = "Mengompresi (" + selectedCodec.toUpperCase() + " \u2022 " + selectedPreset + ")...";
    var exitCode = await ff.exec(args);

    if (exitCode !== 0) {
      throw new Error("FFmpeg exit code " + exitCode);
    }

    progressStatus.textContent = "Menyimpan hasil...";
    var outBytes = await ff.readFile(outputName);
    var blob = new Blob([outBytes.buffer], { type: "video/mp4" });

    try { await ff.deleteFile(inputName); } catch (e) {}
    try { await ff.deleteFile(outputName); } catch (e) {}

    onCompressionComplete(blob, "mp4");
  }

  function runCanvasFallbackCompress() {
    progressStatus.textContent = "Memproses video...";
    var video = document.createElement("video");
    video.src = currentVideoUrl;
    video.muted = !checkAudio.checked;
    video.playsInline = true;

    video.onloadedmetadata = function () {
      var origW = video.videoWidth || 1280;
      var origH = video.videoHeight || 720;
      var duration = video.duration || 1;

      var targetW = origW;
      var targetH = origH;
      var shortSide = Math.min(origW, origH);

      if (shortSide > MAX_SHORT_SIDE) {
        var scale = MAX_SHORT_SIDE / shortSide;
        targetW = Math.round((origW * scale) / 2) * 2;
        targetH = Math.round((origH * scale) / 2) * 2;
      }

      canvas.width = targetW;
      canvas.height = targetH;

      var profile = CODEC_PROFILES[selectedCodec][selectedPreset];
      var budget = computeBitrateBudget({ width: origW, height: origH, duration: duration }, currentFile.size, checkAudio.checked, profile);
      var targetBitrate = budget.maxRateKbps * 1000;

      var stream = canvas.captureStream(30);

      if (checkAudio.checked) {
        try {
          var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          var source = audioCtx.createMediaElementSource(video);
          var dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          source.connect(audioCtx.destination);
          var audioTracks = dest.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
          }
        } catch (err) {}
      }

      var mimeType = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/webm";
        }
      }

      var recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: targetBitrate
        });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      var chunks = [];
      recorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = function () {
        var blob = new Blob(chunks, { type: mimeType });
        onCompressionComplete(blob, "webm");
      };

      recorder.start(100);
      video.play();

      var animId;
      function renderLoop() {
        if (video.paused || video.ended) {
          if (video.ended) {
            recorder.stop();
            cancelAnimationFrame(animId);
            return;
          }
        }

        ctx.drawImage(video, 0, 0, targetW, targetH);

        var pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
        progressFill.style.width = pct + "%";
        progressPercent.textContent = pct + "%";
        progressStatus.textContent = "Mengompresi (" + formatDuration(video.currentTime) + " / " + formatDuration(duration) + ")...";

        animId = requestAnimationFrame(renderLoop);
      }

      video.onplay = function () {
        renderLoop();
      };

      video.onerror = function () {
        alert("Gagal membaca video.");
        resetProcessingState();
      };
    };
  }

  function triggerDownload(url, filename) {
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function onCompressionComplete(blob, ext) {
    isProcessing = false;
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">compress</span> Kompresi Ulang';

    progressFill.style.width = "100%";
    progressPercent.textContent = "100%";
    progressStatus.textContent = "Selesai";
    progressBox.classList.add("is-hidden");

    if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
    compressedBlobUrl = URL.createObjectURL(blob);

    var origSize = currentFile.size;
    var compSize = blob.size;
    var savedPct = Math.max(0, Math.round(((origSize - compSize) / origSize) * 100));
    var elapsedSec = jobStartedAt ? ((performance.now() - jobStartedAt) / 1000).toFixed(1) : "0.0";

    var baseName = currentFile.name.replace(/\.[^/.]+$/, "");
    var outputFileName = baseName + "_compressed_" + selectedCodec + "." + ext;

    setLogBadge("Done");
    appendLog("Selesai dalam " + elapsedSec + "s \u2022 " + formatBytes(origSize) + " \u2192 " + formatBytes(compSize) + " (-" + savedPct + "%)");
    appendLog("Mengunduh otomatis: " + outputFileName);

    statOriginal.textContent = formatBytes(origSize);
    statCompressed.textContent = formatBytes(compSize);
    statSavings.textContent = "-" + savedPct + "%";
    statsGrid.classList.remove("is-hidden");

    triggerDownload(compressedBlobUrl, outputFileName);
  }

  function resetProcessingState() {
    isProcessing = false;
    setLogBadge("Error");
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">compress</span> Mulai Kompresi';
    progressBox.classList.add("is-hidden");
  }

  // Clean up memory when window closes
  window.addEventListener("pagehide", function () {
    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
  });
})();
