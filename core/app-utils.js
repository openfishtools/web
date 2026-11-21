(function () {
  "use strict";

  var loadedScripts = {};

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    var k = 1024;
    var sizes = ["B", "KB", "MB", "GB"];
    var i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function formatDuration(sec) {
    if (!sec || !isFinite(sec) || sec < 0) return "00:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function triggerDownload(blobOrUrl, filename) {
    var isBlob = typeof Blob !== "undefined" && blobOrUrl instanceof Blob;
    var url = isBlob ? URL.createObjectURL(blobOrUrl) : String(blobOrUrl || "");
    if (!url) return;
    var link = document.createElement("a");
    link.href = url;
    link.download = filename || "download";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (isBlob) {
      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (_) {}
      }, 4000);
    }
  }

  function createLogger(outputEl, badgeEl, maxLines) {
    var limit = maxLines || 120;
    var lines = [];

    function setBadge(label) {
      if (badgeEl) badgeEl.textContent = label;
    }

    function append(message) {
      if (!outputEl || !message) return;
      var text = String(message).trim();
      if (!text) return;
      var now = new Date();
      var ts =
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0") + ":" +
        String(now.getSeconds()).padStart(2, "0");
      lines.push("[" + ts + "] " + text);
      if (lines.length > limit) {
        lines = lines.slice(lines.length - limit);
      }
      outputEl.textContent = lines.join("\n");
      outputEl.scrollTop = outputEl.scrollHeight;
    }

    function clear() {
      lines = [];
      if (outputEl) outputEl.textContent = "";
    }

    return {
      append: append,
      setBadge: setBadge,
      clear: clear
    };
  }

  function bindDropzone(dropzoneEl, fileInputEl, onFile) {
    if (!dropzoneEl || !fileInputEl) return;

    dropzoneEl.addEventListener("click", function () {
      fileInputEl.value = "";
      fileInputEl.click();
    });

    dropzoneEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputEl.value = "";
        fileInputEl.click();
      }
    });

    fileInputEl.addEventListener("change", function () {
      if (fileInputEl.files && fileInputEl.files.length > 0) {
        onFile(fileInputEl.files[0]);
      }
    });

    window.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (!dropzoneEl.classList.contains("is-hidden")) {
        dropzoneEl.classList.add("is-dragover");
      }
    });

    window.addEventListener("dragleave", function (e) {
      if (e.clientX <= 0 || e.clientY <= 0) {
        dropzoneEl.classList.remove("is-dragover");
      }
    });

    window.addEventListener("drop", function (e) {
      e.preventDefault();
      dropzoneEl.classList.remove("is-dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFile(e.dataTransfer.files[0]);
      }
    });
  }

  function bindSegmented(groupEl, dataKey, onChange) {
    if (!groupEl) return;
    var items = groupEl.querySelectorAll(".m3-segment, .app-chip");
    items.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        items.forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-checked", "true");
        if (typeof onChange === "function") {
          onChange(btn.dataset[dataKey]);
        }
      });
    });
  }

  function probeVideoMetadata(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;
      probe.playsInline = true;

      function done(meta) {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute("src");
        try { probe.load(); } catch (_) {}
        URL.revokeObjectURL(url);
        resolve(meta);
      }

      probe.onloadedmetadata = function () {
        done({
          width: probe.videoWidth || 0,
          height: probe.videoHeight || 0,
          duration: isFinite(probe.duration) ? probe.duration : 0
        });
      };

      probe.onerror = function () {
        done({ width: 0, height: 0, duration: 0 });
      };

      probe.src = url;
    });
  }

  function probeImageMetadata(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var meta = { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
        URL.revokeObjectURL(url);
        resolve(meta);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  }

  function loadScriptOnce(src) {
    if (loadedScripts[src]) return loadedScripts[src];
    loadedScripts[src] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () {
        delete loadedScripts[src];
        reject(new Error("Gagal memuat " + src));
      };
      document.head.appendChild(s);
    });
    return loadedScripts[src];
  }

  async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    var urls = [
      "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
      "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js"
    ];
    for (var i = 0; i < urls.length; i++) {
      try {
        await loadScriptOnce(urls[i]);
        if (window.JSZip) return window.JSZip;
      } catch (_) {}
    }
    throw new Error("JSZip gagal dimuat. Periksa koneksi internet.");
  }

  async function ensureOnnxRuntime() {
    if (window.ort && window.ort.InferenceSession) return window.ort;
    var urls = [
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.all.min.js",
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
      "https://unpkg.com/onnxruntime-web@1.20.1/dist/ort.min.js"
    ];
    for (var i = 0; i < urls.length; i++) {
      try {
        await loadScriptOnce(urls[i]);
        if (window.ort && window.ort.InferenceSession) {
          if (window.ort.env && window.ort.env.wasm) {
            window.ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
          }
          return window.ort;
        }
      } catch (_) {}
    }
    throw new Error("ONNX Runtime Web gagal dimuat. Periksa koneksi internet.");
  }

  function syncSlider(inputEl) {
    if (!inputEl) return;
    var min = parseFloat(inputEl.min) || 0;
    var max = parseFloat(inputEl.max) || 0;
    var val = parseFloat(inputEl.value) || 0;
    var pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
    inputEl.style.setProperty("--m3-slider-pct", pct + "%");
  }

  var TIKTOK_VALID_HOSTS = [
    "tiktok.com",
    "tiktokv.com",
    "tt.site",
    "tikwm.com",
    "douyin.com",
    "iesdouyin.com"
  ];

  function extractTikTokUrl(raw) {
    if (!raw) return "";
    var text = String(raw).trim();
    if (!text) return "";
    var match = text.match(/https?:\/\/[^\s"'<>]+/i);
    var candidate = match ? match[0] : (/^[^\s]+\.[^\s]+/.test(text) ? ("https://" + text) : "");
    if (!candidate) return "";
    candidate = candidate.replace(/[.,!?;:)\]]+$/, "");
    try {
      var parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      var host = parsed.hostname.toLowerCase();
      var valid = TIKTOK_VALID_HOSTS.some(function (h) {
        return host === h || host.endsWith("." + h);
      });
      return valid ? parsed.href : "";
    } catch (_) {
      return "";
    }
  }

  window.ensureOnnxRuntime = ensureOnnxRuntime;
  window.AppUtils = {
    formatBytes: formatBytes,
    formatDuration: formatDuration,
    triggerDownload: triggerDownload,
    createLogger: createLogger,
    bindDropzone: bindDropzone,
    bindSegmented: bindSegmented,
    syncSlider: syncSlider,
    probeVideoMetadata: probeVideoMetadata,
    probeImageMetadata: probeImageMetadata,
    loadScriptOnce: loadScriptOnce,
    ensureJSZip: ensureJSZip,
    ensureOnnxRuntime: ensureOnnxRuntime,
    extractTikTokUrl: extractTikTokUrl
  };
})();
