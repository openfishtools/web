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

  var fpsInput = document.getElementById("fps-input");
  var bitrateInput = document.getElementById("bitrate-input");

  var audioBar = document.getElementById("audio-bar");
  var audioInput = document.getElementById("audio-input");
  var audioNameEl = document.getElementById("audio-name");
  var audioHintEl = document.getElementById("audio-hint");
  var btnRemoveAudio = document.getElementById("btn-remove-audio");

  var progressBox = document.getElementById("progress-box");
  var progressStatus = document.getElementById("progress-status");
  var progressPercent = document.getElementById("progress-percent");
  var progressFill = document.getElementById("progress-fill");

  var statsGrid = document.getElementById("stats-grid");
  var statFrames = document.getElementById("stat-frames");
  var statFps = document.getElementById("stat-fps");
  var statSize = document.getElementById("stat-size");

  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var currentZip = null;
  var selectedAudio = null;
  var isProcessing = false;
  var ffmpeg = null;

  function setProgress(pct, status) {
    progressBox.classList.remove("is-hidden");
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    if (status) progressStatus.textContent = status;
  }

  U.bindDropzone(dropzone, fileInput, handleZipFile);

  btnChangeFile.addEventListener("click", function () {
    if (isProcessing) return;
    fileInput.value = "";
    fileInput.click();
  });

  audioBar.addEventListener("click", function (e) {
    if (isProcessing || e.target.closest("#btn-remove-audio")) return;
    audioInput.value = "";
    audioInput.click();
  });

  audioBar.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isProcessing) {
        audioInput.value = "";
        audioInput.click();
      }
    }
  });

  audioInput.addEventListener("change", function () {
    if (audioInput.files && audioInput.files[0]) {
      selectedAudio = audioInput.files[0];
      audioNameEl.textContent = selectedAudio.name;
      audioHintEl.textContent = U.formatBytes(selectedAudio.size);
      btnRemoveAudio.classList.remove("is-hidden");
      logger.append("Audio terlampir: " + selectedAudio.name);
    }
  });

  btnRemoveAudio.addEventListener("click", function (e) {
    e.stopPropagation();
    if (isProcessing) return;
    selectedAudio = null;
    audioInput.value = "";
    audioNameEl.textContent = "Tambahkan audio / soundtrack";
    audioHintEl.textContent = "MP3, WAV, M4A, AAC, MP4";
    btnRemoveAudio.classList.add("is-hidden");
  });

  function handleZipFile(file) {
    if (!file || !/\.zip$/i.test(file.name)) {
      logger.setBadge("Error");
      logger.append("Pilih file arsip .zip yang berisi image sequence.");
      return;
    }

    currentZip = file;
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    statsGrid.classList.add("is-hidden");
    progressBox.classList.add("is-hidden");
    btnStart.disabled = false;
    btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">movie_creation</span> Konversi ke Video';
    logger.setBadge("Ready");
    logger.append("Arsip ZIP dimuat: " + file.name + " (" + U.formatBytes(file.size) + ")");
  }

  async function ensureEngine() {
    if (ffmpeg) return ffmpeg;
    logger.append("Memuat engine FFmpeg WASM...");
    ffmpeg = await FF.createInstance({
      log: function (m) { logger.append(m); }
    });
    return ffmpeg;
  }

  btnStart.addEventListener("click", function () {
    if (!currentZip || isProcessing) return;
    processSequence();
  });

  async function processSequence() {
    isProcessing = true;
    var startedAt = performance.now();
    var writtenFiles = [];
    var oomDetected = false;

    var fps = Math.max(1, Math.min(240, parseInt(fpsInput.value, 10) || 30));
    var bitrate = Math.max(1, Math.min(50, parseInt(bitrateInput.value, 10) || 12));
    fpsInput.value = fps;
    bitrateInput.value = bitrate;

    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="m3-spinner" aria-hidden="true"></span> Memproses...';
    statsGrid.classList.add("is-hidden");
    logger.setBadge("Running");
    setProgress(5, "Membaca arsip ZIP...");

    var onLog = function (entry) {
      var msg = String((entry && entry.message) || "");
      var lc = msg.toLowerCase();
      if (lc.indexOf("oom") !== -1 || lc.indexOf("out of memory") !== -1) oomDetected = true;
      if (msg.indexOf("frame=") !== -1 || lc.indexOf("error") !== -1) logger.append(msg);
    };

    var onProg = function (p) {
      if (typeof p.progress === "number" && p.progress >= 0 && p.progress <= 1) {
        var pct = Math.max(65, Math.min(96, Math.round(65 + p.progress * 31)));
        setProgress(pct, "Encoding video (" + pct + "%)...");
      }
    };

    try {
      var JSZip = await U.ensureJSZip();
      var zip = await JSZip.loadAsync(currentZip);

      var validExts = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
      var entries = [];
      zip.forEach(function (relPath, entry) {
        var lower = relPath.toLowerCase();
        if (entry.dir || lower.indexOf("__macosx/") === 0) return;
        var parts = lower.split("/");
        if (parts.some(function (p) { return p.indexOf(".") === 0; })) return;
        if (validExts.some(function (ext) { return lower.endsWith(ext); })) {
          entries.push(entry);
        }
      });

      if (entries.length === 0) {
        throw new Error("Tidak ditemukan gambar (PNG/JPG/WebP/BMP) di dalam ZIP.");
      }

      entries.sort(function (a, b) {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });

      var firstExt = (entries[0].name.split(".").pop() || "png").toLowerCase();
      if (firstExt === "jpeg") firstExt = "jpg";

      fileDetailsEl.textContent = U.formatBytes(currentZip.size) + " \u2022 " + entries.length + " frame";
      logger.append("Ditemukan " + entries.length + " frame (." + firstExt + ")");

      setProgress(12, "Menyiapkan FFmpeg...");
      var ff = await ensureEngine();
      ff.on("log", onLog);
      ff.on("progress", onProg);

      for (var i = 0; i < entries.length; i++) {
        var buf = await entries[i].async("arraybuffer");
        var fname = "frame_" + String(i).padStart(6, "0") + "." + firstExt;
        await ff.writeFile(fname, new Uint8Array(buf));
        writtenFiles.push(fname);

        if (i % 15 === 0 || i === entries.length - 1) {
          var pct = Math.round(15 + (i / entries.length) * 45);
          setProgress(pct, "Mengekstrak frame " + (i + 1) + "/" + entries.length + "...");
        }
      }

      var audioFileName = null;
      if (selectedAudio) {
        setProgress(62, "Melampirkan audio...");
        var audioExt = (selectedAudio.name.split(".").pop() || "mp3").toLowerCase();
        audioFileName = "audio." + audioExt;
        await ff.writeFile(audioFileName, await FF.fetchFile(selectedAudio));
        writtenFiles.push(audioFileName);
      }

      var threads = String(Math.min(navigator.hardwareConcurrency || 2, 4));
      var args = ["-y", "-framerate", String(fps), "-i", "frame_%06d." + firstExt];
      if (audioFileName) {
        args.push("-i", audioFileName, "-c:a", "aac", "-b:a", "192k", "-shortest");
      }
      args.push(
        "-threads", threads,
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264",
        "-b:v", bitrate + "M",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "output.mp4"
      );

      logger.append("Mulai encoding " + entries.length + " frame @ " + fps + " FPS (" + bitrate + " Mbps)");
      setProgress(66, "Merender video MP4...");

      var exitCode = await ff.exec(args);
      if (exitCode !== 0) throw new Error("FFmpeg exit code " + exitCode);
      if (oomDetected) throw new Error("FFmpeg kehabisan memori. Kurangi jumlah/resolusi frame.");

      setProgress(98, "Menyimpan MP4...");
      var outBytes = await ff.readFile("output.mp4");
      if (!outBytes || outBytes.byteLength < 1024) {
        throw new Error("Gagal menghasilkan file video output.");
      }

      var blob = new Blob([outBytes], { type: "video/mp4" });
      var outName = currentZip.name.replace(/\.[^/.]+$/, "") + "_" + fps + "fps.mp4";
      var elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);

      progressBox.classList.add("is-hidden");
      statFrames.textContent = String(entries.length);
      statFps.textContent = fps + " FPS";
      statSize.textContent = U.formatBytes(blob.size);
      statsGrid.classList.remove("is-hidden");

      logger.setBadge("Done");
      logger.append("Selesai dalam " + elapsed + "s \u2022 " + U.formatBytes(blob.size));
      logger.append("Mengunduh otomatis: " + outName);
      U.triggerDownload(blob, outName);

      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">movie_creation</span> Konversi Ulang';
    } catch (err) {
      logger.setBadge("Error");
      logger.append("Gagal: " + (err && err.message ? err.message : String(err)));
      progressBox.classList.add("is-hidden");
      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">movie_creation</span> Coba Lagi';
    } finally {
      if (ffmpeg) {
        if (typeof ffmpeg.off === "function") {
          try { ffmpeg.off("log", onLog); } catch (_) {}
          try { ffmpeg.off("progress", onProg); } catch (_) {}
        }
        try { await ffmpeg.deleteFile("output.mp4"); } catch (_) {}
        for (var k = 0; k < writtenFiles.length; k++) {
          try { await ffmpeg.deleteFile(writtenFiles[k]); } catch (_) {}
        }
      }
      isProcessing = false;
      btnStart.disabled = false;
    }
  }
})();
