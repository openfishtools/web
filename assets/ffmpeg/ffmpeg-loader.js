/**
 * cutefish-ffmpeg-loader.js
 * Shared helper for loading FFmpeg WASM across all tools.
 *
 * Features:
 *  • CacheStorage — first run downloads once; every run after is instant (0 MB download)
 *  • Streaming progress — logs live "45% — 14.5 MB / 32.1 MB" so UI never looks frozen
 *  • CDN-first ordering — jsDelivr has direct CORS *, no redirect chains → Safari-friendly
 *  • Stall detector — no arbitrary timeout; resets every chunk so slow connections succeed
 *  • WASM JIT timeout — 30s hard limit only on engine *init* after download finishes
 */

(function () {
'use strict';

const CACHE_NAME = 'cutefish-ffmpeg-wasm-v1';

/**
 * Fetch a URL via streaming, log MB progress, cache result in CacheStorage.
 * Safe to call for both .js and .wasm files.
 *
 * @param {string} url - Full URL to fetch
 * @param {string} mimeType - MIME type for the Blob ('text/javascript' | 'application/wasm')
 * @param {string} label - Human-readable label for log messages
 * @param {function(string):void} [logFn] - Optional log callback (defaults to console.log)
 * @returns {Promise<string>} Object URL pointing to the downloaded file bytes
 */
async function fetchWasmWithCache(url, mimeType, label, logFn) {
    const log = (typeof logFn === 'function') ? logFn : (msg) => console.log(msg);

    // 1. CacheStorage hit — instant, no network
    try {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(url);
        if (hit) {
            log(`  [Cache] ${label}: Loaded from local cache (instant).`);
            const buf = await hit.arrayBuffer();
            return URL.createObjectURL(new Blob([buf], { type: mimeType }));
        }
    } catch (_) {}

    // 2. Streaming download with live progress
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${label}`);

    const contentLength = parseInt(resp.headers.get('Content-Length') || '0');
    if (contentLength > 0) {
        log(`  Downloading ${label} (${(contentLength / 1048576).toFixed(1)} MB)...`);
    } else {
        log(`  Downloading ${label}...`);
    }

    if (!resp.body) {
        // Fallback: browsers without ReadableStream (shouldn't happen in modern browsers)
        const buf = await resp.arrayBuffer();
        try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(url, new Response(buf.slice(0), {
                headers: { 'Content-Type': mimeType, 'Content-Length': String(buf.byteLength) }
            }));
            log(`  [Cache] ${label}: Saved to local cache for future use.`);
        } catch (_) {}
        return URL.createObjectURL(new Blob([buf], { type: mimeType }));
    }

    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    let lastLogTime = 0;

    // Stall detector: 60s without ANY incoming bytes → throw
    // This replaces the old "35s flat timeout" — a slow but active download never dies.
    let stallTimer = null;
    const STALL_MS = 60000;
    const resetStall = (reject) => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(
            () => reject(new Error(`${label} download stalled (no data for 60s)`)),
            STALL_MS
        );
    };

    await new Promise((resolve, reject) => {
        resetStall(reject);
        (async () => {
            try {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) { clearTimeout(stallTimer); break; }
                    resetStall(reject); // Got a chunk — reset the stall timer
                    chunks.push(value);
                    received += value.length;
                    const now = Date.now();
                    if (contentLength > 0 && now - lastLogTime > 2000) {
                        lastLogTime = now;
                        const pct = Math.round(received / contentLength * 100);
                        const mb  = (received / 1048576).toFixed(1);
                        const tot = (contentLength / 1048576).toFixed(1);
                        log(`    ${pct}% — ${mb} MB / ${tot} MB`);
                    }
                }
                resolve();
            } catch (e) { clearTimeout(stallTimer); reject(e); }
        })();
    });

    // Merge all chunks into a single Uint8Array
    const merged = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    // 3. Save to CacheStorage — next load is instant (0 bytes downloaded)
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(url, new Response(merged.buffer, {
            headers: { 'Content-Type': mimeType, 'Content-Length': String(merged.length) }
        }));
        log(`  [Cache] ${label}: Saved to local cache for future use.`);
    } catch (_) {}

    return URL.createObjectURL(new Blob([merged], { type: mimeType }));
}

/**
 * Build and load an FFmpeg WASM instance.
 * CDN (jsDelivr) is tried first — it has direct CORS * with no redirect chains,
 * making it reliable on Safari. HuggingFace is kept as a fallback.
 *
 * @param {object} opts
 * @param {boolean} opts.isMultiThread - Whether to attempt MT core first
 * @param {function(string):void} opts.log - Log callback
 * @param {string} [opts.hfBase] - HuggingFace base URL override
 * @returns {Promise<object>} Loaded FFmpeg instance
 */
async function buildFFmpegInstance({ isMultiThread, log, hfBase }) {
    if (!window.FFmpegWASM) throw new Error('FFmpegWASM is not loaded.');
    const { FFmpeg } = window.FFmpegWASM;

    const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
    const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    const hfFfmpegBase = (hfBase || window.HF_RESOURCE_BASE || 'https://huggingface.co/cutefishae/resource-cutefish/resolve/main') + '/ffmpeg';

    // CDN first → no 302 redirect chains (Safari CORS-safe)
    // HuggingFace second → fallback
    const attempts = [];
    if (isMultiThread) {
        attempts.push({ label: 'CDN (MT)',          base: cdnBaseMT,    core: 'ffmpeg-core',    mt: true  });
        attempts.push({ label: 'HuggingFace (MT)',  base: hfFfmpegBase, core: 'ffmpeg-core',    mt: true  });
    }
    attempts.push(    { label: 'CDN (ST)',          base: cdnBaseST,    core: 'ffmpeg-core',    mt: false });
    attempts.push(    { label: 'HuggingFace (ST)',  base: hfFfmpegBase, core: 'ffmpeg-core-st', mt: false });

    const withInitTimeout = (promise, label) => new Promise((resolve, reject) => {
        // 30s only for the WASM JIT compilation step — download is already done by this point
        const t = setTimeout(() => reject(new Error(`${label} engine init timed out after 30s`)), 30000);
        promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });

    for (const attempt of attempts) {
        let instance = null;
        try {
            log(`  Loading FFmpeg Core WASM (${attempt.mt ? 'Multi-Thread' : 'Single-Thread'}, ${attempt.label})...`);
            const config = {
                coreURL: await fetchWasmWithCache(`${attempt.base}/${attempt.core}.js`,   'text/javascript',   `${attempt.label} core.js`,   log),
                wasmURL: await fetchWasmWithCache(`${attempt.base}/${attempt.core}.wasm`, 'application/wasm',  `${attempt.label} core.wasm`, log)
            };
            if (attempt.mt) {
                config.workerURL = await fetchWasmWithCache(`${attempt.base}/ffmpeg-core.worker.js`, 'text/javascript', `${attempt.label} worker.js`, log);
            }
            instance = new FFmpeg();
            await withInitTimeout(instance.load(config), attempt.label);
            log(`  FFmpeg Core WASM loaded from ${attempt.label}.`);
            return instance;
        } catch (err) {
            if (instance) { try { instance.terminate(); } catch (_) {} }
            const msg = (err instanceof Error && err.message) ? err.message : String(err);
            log(`  ${attempt.label} failed: ${msg}`);
        }
    }
    throw new Error('Failed to load FFmpeg WASM from all sources.');
}

// Expose on window for use by all tools
window.CutefishFFmpegLoader = {
    fetchWasmWithCache,
    buildFFmpegInstance,
    CACHE_NAME
};

})();
