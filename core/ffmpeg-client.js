(function () {
  "use strict";

  var FFMPEG_BASE = "../../assets/vendor/ffmpeg/";
  var CACHE_NAME = "cutefish-ffmpeg-core-v1";
  var CACHE_PREFIX = "https://vendor.cutefish.local/ffmpeg/0.12.10/";
  var CDN_CORE_ST = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/",
    "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/"
  ];
  var CDN_CORE_MT = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/umd/",
    "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/umd/"
  ];

  var scriptPromise = null;
  var cachePromise = null;

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function openCoreCache() {
    if (!("caches" in window)) return Promise.resolve(null);
    if (!cachePromise) {
      cachePromise = caches.open(CACHE_NAME).catch(function () { return null; });
    }
    return cachePromise;
  }

  function isValidPayload(buf, isWasm) {
    if (!buf) return false;
    var u8 = new Uint8Array(buf);
    if (isWasm) {
      return u8.byteLength > 1000000 &&
        u8[0] === 0x00 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d;
    }
    if (u8.byteLength < 500) return false;
    var head = new TextDecoder().decode(u8.subarray(0, 32)).trim();
    return head.charAt(0) !== "<";
  }

  async function toCachedBlobURL(cacheKey, urls, mimeType, isWasm, onNetworkFetch) {
    var cache = await openCoreCache();
    if (cache) {
      try {
        var hit = await cache.match(cacheKey);
        if (hit) {
          var cachedBuf = await hit.arrayBuffer();
          if (isValidPayload(cachedBuf, isWasm)) {
            return {
              url: URL.createObjectURL(new Blob([cachedBuf], { type: mimeType })),
              fromCache: true
            };
          }
          await cache.delete(cacheKey);
        }
      } catch (_) {}
    }

    if (typeof onNetworkFetch === "function") {
      onNetworkFetch();
    }

    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], { mode: "cors" });
        if (!res.ok) {
          lastErr = new Error("HTTP " + res.status + " saat mengunduh " + urls[i]);
          continue;
        }
        var buf = await res.arrayBuffer();
        if (!isValidPayload(buf, isWasm)) {
          lastErr = new Error("Payload tidak valid dari " + urls[i]);
          continue;
        }
        if (cache) {
          try {
            await cache.put(cacheKey, new Response(buf.slice(0), {
              headers: { "Content-Type": mimeType }
            }));
          } catch (_) {}
        }
        return {
          url: URL.createObjectURL(new Blob([buf], { type: mimeType })),
          fromCache: false
        };
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error("Gagal mengunduh aset FFmpeg.");
  }

  async function toBlobURL(url, mimeType) {
    var res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " saat memuat " + url);
    var buf = await res.arrayBuffer();
    return URL.createObjectURL(new Blob([buf], { type: mimeType }));
  }

  async function fetchFile(input) {
    if (!input) return new Uint8Array(0);
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof Blob !== "undefined" && input instanceof Blob) {
      return new Uint8Array(await input.arrayBuffer());
    }
    if (typeof input === "string") {
      var res = await fetch(input);
      if (!res.ok) throw new Error("Gagal membaca " + input);
      return new Uint8Array(await res.arrayBuffer());
    }
    throw new Error("Format input FFmpeg tidak didukung.");
  }

  function loadFFmpegScript() {
    if (window.FFmpegWASM && window.FFmpegWASM.FFmpeg) {
      return Promise.resolve(true);
    }
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = FFMPEG_BASE + "ffmpeg.js";
      s.onload = function () {
        if (window.FFmpegWASM && window.FFmpegWASM.FFmpeg) {
          resolve(true);
        } else {
          reject(new Error("FFmpegWASM tidak tersedia setelah skrip dimuat."));
        }
      };
      s.onerror = function () {
        scriptPromise = null;
        reject(new Error("Gagal memuat assets/vendor/ffmpeg/ffmpeg.js"));
      };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  function buildUrls(bases, fileName, localFileName) {
    var list = bases.map(function (b) { return b + fileName; });
    if (localFileName) {
      list.push(FFMPEG_BASE + localFileName);
    }
    return list;
  }

  async function loadCore(ffmpeg, useMT, log) {
    var modeDir = useMT ? "mt/" : "st/";
    var bases = useMT ? CDN_CORE_MT : CDN_CORE_ST;
    var localPrefix = useMT ? "ffmpeg-core-mt" : "ffmpeg-core";
    var notifiedDownload = false;

    function notifyDownloading() {
      if (notifiedDownload) return;
      notifiedDownload = true;
      if (typeof log === "function") {
        log("Mengunduh engine FFmpeg dari CDN (hanya pertama kali, lalu tersimpan di cache)...");
      }
    }

    var tasks = [
      toCachedBlobURL(
        CACHE_PREFIX + modeDir + "ffmpeg-core.js",
        buildUrls(bases, "ffmpeg-core.js", localPrefix + ".js"),
        "text/javascript",
        false,
        notifyDownloading
      ),
      toCachedBlobURL(
        CACHE_PREFIX + modeDir + "ffmpeg-core.wasm",
        buildUrls(bases, "ffmpeg-core.wasm", localPrefix + ".wasm"),
        "application/wasm",
        true,
        notifyDownloading
      )
    ];

    if (useMT) {
      tasks.push(toCachedBlobURL(
        CACHE_PREFIX + modeDir + "ffmpeg-core.worker.js",
        buildUrls(bases, "ffmpeg-core.worker.js", "ffmpeg-core-mt.worker.js"),
        "text/javascript",
        false,
        notifyDownloading
      ));
    }

    var results = await Promise.all(tasks);
    var cfg = {
      coreURL: results[0].url,
      wasmURL: results[1].url
    };
    if (useMT && results[2]) {
      cfg.workerURL = results[2].url;
    }

    if (typeof log === "function" && results.every(function (r) { return r.fromCache; })) {
      log("Engine FFmpeg dimuat instan dari cache browser");
    }

    await ffmpeg.load(cfg);
  }

  /**
   * Create and load a ready-to-use FFmpeg WASM instance using Cache Storage + CDN.
   * @param {{ isMultiThread?: boolean, forceSingleThread?: boolean, log?: Function }} [opts]
   */
  async function createInstance(opts) {
    opts = opts || {};
    var log = typeof opts.log === "function" ? opts.log : function () {};

    await loadFFmpegScript();

    var canUseMT = !opts.forceSingleThread &&
      opts.isMultiThread !== false &&
      !isMobileDevice() &&
      window.crossOriginIsolated === true &&
      typeof SharedArrayBuffer !== "undefined";

    var ffmpeg = new window.FFmpegWASM.FFmpeg();

    try {
      await loadCore(ffmpeg, canUseMT, log);
      log("FFmpeg siap (" + (canUseMT ? "multi-thread" : "single-thread") + ")");
      return ffmpeg;
    } catch (err) {
      if (canUseMT) {
        log("Multi-thread gagal, beralih ke single-thread...");
        ffmpeg = new window.FFmpegWASM.FFmpeg();
        await loadCore(ffmpeg, false, log);
        log("FFmpeg siap (single-thread fallback)");
        return ffmpeg;
      }
      throw err;
    }
  }

  window.CutefishFFmpeg = {
    createInstance: createInstance,
    fetchFile: fetchFile,
    toBlobURL: toBlobURL,
    loadFFmpegScript: loadFFmpegScript
  };

  window.CutefishFFmpegLoader = {
    load: createInstance
  };
})();
