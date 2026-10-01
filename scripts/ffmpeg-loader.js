/**
 * scripts/ffmpeg-loader.js
 * Centralized Single-Source Loader for FFmpeg WASM across all tools.
 *
 * Features:
 *  • Single Source of Truth: All tools request FFmpeg through CutefishFFmpegLoader.
 *  • Shared CacheStorage: First run downloads once; every run after is instant (0 MB download).
 *  • Deduplication: Concurrent requests share the same initialization promise.
 *  • Streaming Progress: Live download progress reported to UI callbacks.
 *  • 100% Cloud CDN Fallbacks: jsDelivr -> unpkg -> HuggingFace. No local assets required.
 *  • Browser Compatibility: Safari CORS safe, stall detector (60s chunk reset), 30s JIT timeout.
 */

(function () {
'use strict';

const CACHE_NAME = 'cutefish-ffmpeg-wasm-v1';

let libLoadPromise = null;
let instancePromiseMT = null;
let instancePromiseST = null;

/**
 * Fetch a URL via streaming, log MB progress, cache result in CacheStorage.
 * Safe to call for both .js and .wasm files.
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
                    resetStall(reject);
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

    const merged = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

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
 * Dynamically load FFmpeg WASM library scripts from CDN if not present.
 * Uses promise memoization so concurrent callers only load scripts once.
 */
function loadFFmpegLibraries() {
    if (window.FFmpegWASM && window.FFmpegUtil) return Promise.resolve(true);
    if (libLoadPromise) return libLoadPromise;

    libLoadPromise = (async () => {
        const loadScript = (src) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });

        try {
            if (!window.FFmpegUtil) {
                try {
                    await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
                } catch (e) {
                    await loadScript('https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js');
                }
            }
            if (!window.FFmpegWASM) {
                // Browsers block cross-origin Web Workers (new Worker('https://cdn.../814.ffmpeg.js')).
                // Fetch both ffmpeg.js and its internal worker 814.ffmpeg.js, convert to Blob URLs to bypass CORS restriction.
                let loaded = false;
                const cdnBases = [
                    'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd',
                    'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd'
                ];

                for (const base of cdnBases) {
                    try {
                        const [ffmpegRes, workerRes] = await Promise.all([
                            fetch(`${base}/ffmpeg.js`, { mode: 'cors' }),
                            fetch(`${base}/814.ffmpeg.js`, { mode: 'cors' })
                        ]);
                        if (ffmpegRes.ok && workerRes.ok) {
                            const ffmpegCode = await ffmpegRes.text();
                            const workerCode = await workerRes.text();
                            const workerBlobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
                            const patchedCode = ffmpegCode
                                .replace(/new Worker\(new URL\(e\.p\+e\.u\(814\),e\.b\),\{type:void 0\}\)/g, `new Worker("${workerBlobUrl}")`)
                                .replace(/u:e=>e\+"\.\x66\x66\x6d\x70\x65\x67\.\x6a\x73"/g, `u:()=>"${workerBlobUrl}"`)
                                .replace(/u:e=>e\+"\x2effmpeg\x2ejs"/g, `u:()=>"${workerBlobUrl}"`);
                            const ffmpegBlobUrl = URL.createObjectURL(new Blob([patchedCode], { type: 'text/javascript' }));
                            await loadScript(ffmpegBlobUrl);
                            loaded = true;
                            break;
                        }
                    } catch (_) {}
                }

                if (!loaded) {
                    try {
                        await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
                    } catch (e) {
                        await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
                    }
                }
            }
        } catch (err) {
            console.error('Error loading FFmpeg libraries:', err);
        }
        return !!(window.FFmpegWASM && window.FFmpegUtil);
    })();

    return libLoadPromise;
}

/**
 * Build and load a fresh FFmpeg WASM instance.
 */
async function buildFFmpegInstance({ isMultiThread, log, hfBase }) {
    const logger = (typeof log === 'function') ? log : (msg) => console.log(msg);

    if (!window.FFmpegWASM || !window.FFmpegUtil) {
        await loadFFmpegLibraries();
    }
    if (!window.FFmpegWASM) throw new Error('FFmpegWASM library failed to load from CDNs.');
    const { FFmpeg } = window.FFmpegWASM;

    const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
    const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    const unpkgBaseMT = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd';
    const unpkgBaseST = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const hfFfmpegBase = (hfBase || window.HF_RESOURCE_BASE || 'https://huggingface.co/cutefishae/resource-cutefish/resolve/main') + '/ffmpeg';

    const attempts = [];
    if (isMultiThread) {
        attempts.push({ label: 'CDN jsDelivr (MT)', base: cdnBaseMT,    core: 'ffmpeg-core',    mt: true  });
        attempts.push({ label: 'CDN unpkg (MT)',    base: unpkgBaseMT,  core: 'ffmpeg-core',    mt: true  });
        attempts.push({ label: 'HuggingFace (MT)',  base: hfFfmpegBase, core: 'ffmpeg-core',    mt: true  });
    }
    attempts.push(    { label: 'CDN jsDelivr (ST)', base: cdnBaseST,    core: 'ffmpeg-core',    mt: false });
    attempts.push(    { label: 'CDN unpkg (ST)',    base: unpkgBaseST,  core: 'ffmpeg-core',    mt: false });
    attempts.push(    { label: 'HuggingFace (ST)',  base: hfFfmpegBase, core: 'ffmpeg-core-st', mt: false });

    const withInitTimeout = (promise, label) => new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${label} engine init timed out after 30s`)), 30000);
        promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });

    for (const attempt of attempts) {
        let instance = null;
        try {
            logger(`  Loading FFmpeg Core WASM (${attempt.mt ? 'Multi-Thread' : 'Single-Thread'}, ${attempt.label})...`);
            const config = {
                coreURL: await fetchWasmWithCache(`${attempt.base}/${attempt.core}.js`,   'text/javascript',   `${attempt.label} core.js`,   logger),
                wasmURL: await fetchWasmWithCache(`${attempt.base}/${attempt.core}.wasm`, 'application/wasm',  `${attempt.label} core.wasm`, logger)
            };
            if (attempt.mt) {
                config.workerURL = await fetchWasmWithCache(`${attempt.base}/ffmpeg-core.worker.js`, 'text/javascript', `${attempt.label} worker.js`, logger);
            }
            instance = new FFmpeg();
            await withInitTimeout(instance.load(config), attempt.label);
            logger(`  FFmpeg Core WASM loaded from ${attempt.label}.`);
            return instance;
        } catch (err) {
            if (instance) { try { instance.terminate(); } catch (_) {} }
            const msg = (err instanceof Error && err.message) ? err.message : String(err);
            logger(`  ${attempt.label} failed: ${msg}`);
        }
    }
    throw new Error('Failed to load FFmpeg WASM from all sources.');
}

/**
 * High-level helper: get ready FFmpeg instance.
 */
async function getFFmpegInstance(options = {}) {
    const isMultiThread = !!options.isMultiThread;
    return await buildFFmpegInstance({
        isMultiThread,
        log: options.log || console.log,
        hfBase: options.hfBase
    });
}

// Expose on window for use by all tools
window.CutefishFFmpegLoader = {
    fetchWasmWithCache,
    buildFFmpegInstance,
    getFFmpegInstance,
    loadFFmpegLibraries,
    CACHE_NAME
};

})();
