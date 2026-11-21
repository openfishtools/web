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
  var btnStart = document.getElementById("btn-start");

  var formatGroup = document.getElementById("format-group");
  var bitrateField = document.getElementById("bitrate-field");
  var bitrateGroup = document.getElementById("bitrate-group");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statOriginal = document.getElementById("stat-original");
  var statOutput = document.getElementById("stat-output");
  var statFormat = document.getElementById("stat-format");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var FORMAT_META = {
    mp3: { codec: "libmp3lame", ext: "mp3", mime: "audio/mpeg", label: "MP3" },
    m4a: { codec: "aac", ext: "m4a", mime: "audio/mp4", label: "M4A" },
    wav: { codec: "pcm_s16le", ext: "wav", mime: "audio/wav", label: "WAV" }
  };

  var currentFile = null;
  var selectedFormat = "mp3";
  var selectedBitrate = "192k";
  var isProcessing = false;
  var ffmpeg = null;

  function setProgress(pct, status) {
    progressBox.classList.remove("is-hidden");
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    if (status) progressStatus.textContent = status;
  }

  U.bindDropzone(dropzone, fileInput, handleFile);

  btnChangeFile.addEventListener("click", function () {
    if (isProcessing) return;
    fileInput.value = "";
    fileInput.click();
  });

  U.bindSegmented(formatGroup, "format", function (fmt) {
    selectedFormat = fmt || "mp3";
    bitrateField.classList.toggle("is-hidden", selectedFormat === "wav");
  });

  U.bindSegmented(bitrateGroup, "bitrate", function (br) {
    selectedBitrate = br || "192k";
  });

  function handleFile(file) {
    if (!file) return;
    currentFile = file;
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");

    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">graphic_eq</span> Ekstrak Audio';
    logger.setBadge("Ready");

    U.probeVideoMetadata(file).then(function (meta) {
      if (currentFile !== file) return;
      var parts = [U.formatBytes(file.size)];
      if (meta.width && meta.height) parts.push(meta.width + "x" + meta.height);
      if (meta.duration) parts.push(U.formatDuration(meta.duration));
      fileDetailsEl.textContent = parts.join(" \u2022 ");
      logger.append("File dimuat: " + file.name + " (" + parts.join(", ") + ")");
    });
  }

  async function ensureEngine() {
    if (ffmpeg) return ffmpeg;
    logger.setBadge("Loading");
    logger.append("Memuat engine FFmpeg WASM...");
    ffmpeg = await FF.createInstance({
      log: function (m) { logger.append(m); }
    });
    ffmpeg.on("log", function (entry) {
      if (!entry || !entry.message) return;
      var msg = entry.message;
      if (msg.indexOf("Audio:") !== -1 || msg.indexOf("size=") !== -1 || msg.toLowerCase().indexOf("error") !== -1) {
        logger.append(msg);
      }
    });
    ffmpeg.on("progress", function (p) {
      if (typeof p.progress === "number" && p.progress >= 0 && p.progress <= 1) {
        var pct = Math.max(15, Math.min(95, Math.round(15 + p.progress * 80)));
        setProgress(pct, "Mengekstrak audio (" + pct + "%)...");
      }
    });
    return ffmpeg;
  }

  btnStart.addEventListener("click", function () {
    if (!currentFile || isProcessing) return;
    startExtraction();
  });

  async function startExtraction() {
    isProcessing = true;
    var startedAt = performance.now();
    var meta = FORMAT_META[selectedFormat] || FORMAT_META.mp3;
    var ext = (currentFile.name.split(".").pop() || "mp4").toLowerCase();
    var inputName = "input." + ext;
    var outputName = "audio." + meta.ext;
    var oomDetected = false;

    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Mengekstrak...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");
    setProgress(5, "Menyiapkan FFmpeg...");

    var onOom = function (entry) {
      var lc = String((entry && entry.message) || "").toLowerCase();
      if (lc.indexOf("oom") !== -1 || lc.indexOf("out of memory") !== -1) {
        oomDetected = true;
      }
    };

    try {
      var ff = await ensureEngine();
      ff.on("log", onOom);

      setProgress(12, "Membaca stream video...");
      await ff.writeFile(inputName, await FF.fetchFile(currentFile));

      var threads = String(Math.min(navigator.hardwareConcurrency || 2, 4));
      var args = ["-y", "-i", inputName, "-threads", threads, "-vn", "-c:a", meta.codec];
      if (selectedFormat !== "wav") {
        args.push("-b:a", selectedBitrate);
      }
      args.push(outputName);

      logger.append("Mulai ekstraksi: " + meta.label + (selectedFormat === "wav" ? " (PCM)" : " " + selectedBitrate));
      setProgress(18, "Mengekstrak audio...");

      try {
        var code = await ff.exec(args);
        if (code !== 0) throw new Error("FFmpeg exit code " + code);
      } catch (execErr) {
        var checkData = null;
        try { checkData = await ff.readFile(outputName); } catch (_) {}
        if (!checkData || checkData.byteLength < 1024) throw execErr;
      }

      if (oomDetected) throw new Error("Memori tidak cukup (file terlalu besar).");

      setProgress(97, "Menyimpan file audio...");
      var outBytes = await ff.readFile(outputName);
      if (!outBytes || outBytes.byteLength < 512) {
        throw new Error("Video tidak memiliki track audio atau hasil kosong.");
      }

      var blob = new Blob([outBytes], { type: meta.mime });
      var outName = currentFile.name.replace(/\.[^/.]+$/, "") + "." + meta.ext;
      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);

      try { await ff.deleteFile(inputName); } catch (_) {}
      try { await ff.deleteFile(outputName); } catch (_) {}

      progressBox.classList.add("is-hidden");
      statOriginal.textContent = U.formatBytes(currentFile.size);
      statOutput.textContent = U.formatBytes(blob.size);
      statFormat.textContent = meta.label;
      statsGrid.classList.remove("is-hidden");

      logger.setBadge("Done");
      logger.append("Selesai dalam " + elapsed + "s \u2022 " + U.formatBytes(blob.size));
      logger.append("Mengunduh otomatis: " + outName);
      U.triggerDownload(blob, outName);

      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">graphic_eq</span> Ekstrak Ulang';
    } catch (err) {
      logger.setBadge("Error");
      logger.append("Gagal: " + (err && err.message ? err.message : String(err)));
      progressBox.classList.add("is-hidden");
      btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">graphic_eq</span> Coba Lagi';
    } finally {
      if (ffmpeg && typeof ffmpeg.off === "function") {
        try { ffmpeg.off("log", onOom); } catch (_) {}
      }
      isProcessing = false;
      btnStart.disabled = false;
    }
  }
})();
