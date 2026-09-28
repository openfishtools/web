(function() {
    'use strict';

    function t(key) {
        if (typeof window.getTranslation === 'function') {
            const res = window.getTranslation(key);
            if (res && res !== key) return res;
        }
        return key;
    }

    let selectedFile = null;
    let isProcessing = false;
    let selectedPreset = 'medium';

    const MAX_FILE_MB_HARD = 1500;
    const MAX_DIMENSION = 3840;

    function appendToLogsEl(msg) {
        const logsEl = document.getElementById('compressor-logs');
        if (logsEl) {
            logsEl.textContent += msg + '\n';
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    }

    function log(msg) { appendToLogsEl(msg); }
    function logSection(title) { appendToLogsEl(`\n=== ${title} ===`); }
    function logEnd() { appendToLogsEl('====================\n'); }

    function updateDesc() {
        const descEl = document.getElementById('compressor-info-desc');
        if (!descEl) return;
        descEl.innerHTML = t('ffmpeg_preset_' + selectedPreset + '_desc');
    }

    function initCompressorUI() {
        const optContainer = document.getElementById('tool-dynamic-options');
        if (!optContainer) return;

        optContainer.innerHTML = `
            <div class="tiktok-switcher-label">${t('compressor_preset_title') || 'Choose Compression Preset'}</div>
            <div class="tiktok-switch-track" id="compressor-preset-switch" data-selected="${selectedPreset}">
                <div class="tiktok-switch-indicator"></div>
                <div class="tiktok-switch-option ${selectedPreset === 'slow' ? 'active' : ''}" data-preset="slow">SLOW</div>
                <div class="tiktok-switch-option ${selectedPreset === 'medium' ? 'active' : ''}" data-preset="medium">MEDIUM</div>
                <div class="tiktok-switch-option ${selectedPreset === 'fast' ? 'active' : ''}" data-preset="fast">FAST</div>
            </div>

            <div class="tiktok-preset-desc" id="compressor-info-desc"></div>

            <div class="process-logs-wrap hidden" id="compressor-logs-container">
                <div class="process-logs-header">
                    <span class="process-logs-title">${t('patcher_logs_title') || 'Process Logs'}</span>
                    <button type="button" class="btn-copy-logs" id="btn-copy-compressor-logs">
                        <span class="material-symbols-rounded">content_copy</span>
                        <span>${t('res_modal_copy') || 'Copy'}</span>
                    </button>
                </div>
                <pre class="process-logs-pre" id="compressor-logs"></pre>
            </div>
        `;

        updateDesc();

        const pSwitch = document.getElementById('compressor-preset-switch');
        if (pSwitch) {
            pSwitch.querySelectorAll('.tiktok-switch-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    pSwitch.querySelectorAll('.tiktok-switch-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    selectedPreset = opt.getAttribute('data-preset') || 'medium';
                    pSwitch.setAttribute('data-selected', selectedPreset);
                    updateDesc();
                });
            });
        }

        const copyLogsBtn = document.getElementById('btn-copy-compressor-logs');
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => {
                const logsEl = document.getElementById('compressor-logs');
                if (logsEl && logsEl.textContent) {
                    navigator.clipboard.writeText(logsEl.textContent);
                    if (typeof window.showToast === 'function') {
                        window.showToast(t('logs_copied'));
                    }
                }
            });
        }
    }

    async function getVideoDimensions(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            const url = URL.createObjectURL(file);
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(url);
                resolve({ width: video.videoWidth, height: video.videoHeight });
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ width: 0, height: 0 });
            };
            video.src = url;
            setTimeout(() => resolve({ width: 0, height: 0 }), 3000);
        });
    }

    async function loadFFmpegLibraries() {
        if (window.FFmpegWASM && window.FFmpegUtil) return true;
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
                    await loadScript('assets/ffmpeg/index.js');
                } catch (e) {
                    await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
                }
            }
            if (!window.FFmpegWASM) {
                try {
                    await loadScript('assets/ffmpeg/ffmpeg.js');
                } catch (e) {
                    await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
                }
            }
        } catch (err) {
            console.error('Error loading FFmpeg libraries:', err);
        }
        return !!(window.FFmpegWASM && window.FFmpegUtil);
    }

    async function processVideoCompressor(file) {
        if (!file || isProcessing) return;
        isProcessing = true;

        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        const progressSec = document.getElementById('tool-progress-section');
        const progressFill = document.getElementById('tool-progress-fill');
        const progressPercent = document.getElementById('tool-progress-percent');
        const progressStatus = document.getElementById('tool-progress-status');
        const logsContainer = document.getElementById('compressor-logs-container');
        const logsEl = document.getElementById('compressor-logs');

        if (processBtn) processBtn.disabled = true;
        if (progressSec) progressSec.classList.remove('hidden');
        if (logsContainer) logsContainer.classList.remove('hidden');
        if (logsEl) logsEl.textContent = '';
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressStatus) progressStatus.textContent = t('status_initializing');
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-video-compressor', { isProcessing: true, percent: 0, status: t('status_initializing'), file });
        }

        const fileMB = file.size / (1024 * 1024);
        logSection('Video Compressor — Initializing');
        log(`  File : ${file.name} (${fileMB.toFixed(2)} MB)`);
        log(`  Preset : ${selectedPreset.toUpperCase()}`);
        logEnd();

        if (fileMB > MAX_FILE_MB_HARD) {
            const err = new Error(`File too large (${fileMB.toFixed(0)} MB). Maximum limit is ${MAX_FILE_MB_HARD} MB.`);
            log(`\n!! Error: ${err.message}`);
            if (progressStatus) progressStatus.textContent = `Error: ${err.message}`;
            if (typeof window.showToast === 'function') window.showToast(err.message);
            if (window.ToolProgressManager) window.ToolProgressManager.clear('tool-video-compressor');
            isProcessing = false;
            if (processBtn) processBtn.disabled = false;
            return;
        }

        try {
            if (progressStatus) progressStatus.textContent = t('status_reading_file');
            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-video-compressor', { isProcessing: true, percent: 5, status: t('status_reading_file'), file });
            }
            const { width, height } = await getVideoDimensions(file);
            const needsScale = width > MAX_DIMENSION || height > MAX_DIMENSION;
            if (needsScale) {
                log(`  Auto-scaling: ${width}x${height} -> max ${MAX_DIMENSION}px`);
            }

            const isReady = await loadFFmpegLibraries();
            if (!isReady) {
                throw new Error('FFmpeg library failed to load. Please check your network connection.');
            }

            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            let ffmpeg = null;
            let oomDetected = false;

            // Some failures from ffmpeg.load()/toBlobURL are not Error objects,
            // so always extract a readable string (never log "undefined").
            const errMsg = (e) => {
                if (!e) return 'unknown error';
                if (e instanceof Error && e.message) return e.message;
                if (typeof e === 'string') return e;
                try { return JSON.stringify(e); } catch (_) { return String(e); }
            };

            const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
            const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

            // SharedArrayBuffer exists on Android Chrome even WITHOUT
            // cross-origin isolation, but it cannot be shared with workers
            // there -> the MT core hangs forever. Don't trust flags alone:
            // prove it by actually sharing a SAB with a worker.
            const canShareSABWithWorker = () => new Promise((resolve) => {
                let w = null;
                const timer = setTimeout(() => { if (w) { try { w.terminate(); } catch (_) {} } resolve(false); }, 2000);
                try {
                    if (typeof SharedArrayBuffer === 'undefined' || typeof Worker === 'undefined') {
                        clearTimeout(timer);
                        return resolve(false);
                    }
                    const blob = new Blob(['self.onmessage=function(e){self.postMessage(1)}'], { type: 'text/javascript' });
                    w = new Worker(URL.createObjectURL(blob));
                    w.onmessage = () => { clearTimeout(timer); try { w.terminate(); } catch (_) {} resolve(true); };
                    w.onerror = () => { clearTimeout(timer); try { w.terminate(); } catch (_) {} resolve(false); };
                    w.postMessage([new SharedArrayBuffer(8)]);
                } catch (e) {
                    clearTimeout(timer);
                    if (w) { try { w.terminate(); } catch (_) {} }
                    resolve(false);
                }
            });

            const isMultiThread = !isMobileDevice
                && typeof SharedArrayBuffer !== 'undefined'
                && typeof Atomics !== 'undefined'
                && window.crossOriginIsolated === true
                && await canShareSABWithWorker();

            const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`${label || 'Operation'} timed out after ${Math.round(ms / 1000)}s`)), ms);
                Promise.resolve(promise).then(
                    (v) => { clearTimeout(timer); resolve(v); },
                    (e) => {
                        clearTimeout(timer);
                        reject(e instanceof Error ? e : new Error(errMsg(e)));
                    }
                );
            });

            // Cache-aware WASM fetcher: CacheStorage first, then streaming download with
            // live progress, then saves to cache. No hard download timeout — stall detector
            // resets each chunk, so slow connections keep going while truly stalled ones fail.
            const CACHE_NAME = 'cutefish-ffmpeg-wasm-v1';
            const fetchWasmWithCache = async (url, mimeType, label) => {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    const hit = await cache.match(url);
                    if (hit) {
                        log(`  [Cache] ${label}: Loaded from local cache (instant).`);
                        const buf = await hit.arrayBuffer();
                        return URL.createObjectURL(new Blob([buf], { type: mimeType }));
                    }
                } catch (_) {}
                const resp = await fetch(url, { mode: 'cors' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${label}`);
                const contentLength = parseInt(resp.headers.get('Content-Length') || '0');
                log(`  Downloading ${label}${contentLength > 0 ? ` (${(contentLength / 1048576).toFixed(1)} MB)` : ''}...`);
                if (!resp.body) {
                    const buf = await resp.arrayBuffer();
                    try {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(url, new Response(buf.slice(0), { headers: { 'Content-Type': mimeType, 'Content-Length': String(buf.byteLength) } }));
                        log(`  [Cache] ${label}: Saved to local cache for future use.`);
                    } catch (_) {}
                    return URL.createObjectURL(new Blob([buf], { type: mimeType }));
                }
                const reader = resp.body.getReader();
                const chunks = [];
                let received = 0, lastLogTime = 0, stallTimer = null;
                const STALL_MS = 60000;
                const resetStall = (reject) => {
                    clearTimeout(stallTimer);
                    stallTimer = setTimeout(() => reject(new Error(`${label} download stalled (no data for 60s)`)), STALL_MS);
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
                                    log(`    ${pct}% — ${(received / 1048576).toFixed(1)} MB / ${(contentLength / 1048576).toFixed(1)} MB`);
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
                    await cache.put(url, new Response(merged.buffer, { headers: { 'Content-Type': mimeType, 'Content-Length': String(merged.length) } }));
                    log(`  [Cache] ${label}: Saved to local cache for future use.`);
                } catch (_) {}
                return URL.createObjectURL(new Blob([merged], { type: mimeType }));
            };

            logSection('FFmpeg Core Initialization');
            log(`  Multi-threading: ${isMultiThread ? 'Enabled' : 'Disabled'}`);

            if (window.CutefishFFmpegLoader) {
                loadedInstance = await window.CutefishFFmpegLoader.buildFFmpegInstance({
                    isMultiThread,
                    log,
                    hfBase: (window.HF_RESOURCE_BASE || 'https://huggingface.co/cutefishae/resource-cutefish/resolve/main') + '/ffmpeg'
                });
            } else {
                const hfFfmpegBase = (window.HF_RESOURCE_BASE || 'https://huggingface.co/cutefishae/resource-cutefish/resolve/main') + '/ffmpeg';
            // CDN first: direct CORS *, no 302 redirect chains — Safari-friendly.
            // HuggingFace as fallback (redirect chain triggers Safari CORS strictness).
            const attempts = [];
            if (isMultiThread) {
                attempts.push({ label: 'CDN (MT)', base: cdnBaseMT, core: 'ffmpeg-core', mt: true });
                attempts.push({ label: 'HuggingFace (MT)', base: hfFfmpegBase, core: 'ffmpeg-core', mt: true });
            }
            attempts.push({ label: 'CDN (ST)', base: cdnBaseST, core: 'ffmpeg-core', mt: false });
            attempts.push({ label: 'HuggingFace (ST)', base: hfFfmpegBase, core: 'ffmpeg-core-st', mt: false });

            let loadedInstance = null;
            for (const attempt of attempts) {
                let inst = null;
                try {
                    log(`  Loading FFmpeg Core WASM (${attempt.mt ? 'Multi-Thread' : 'Single-Thread'}, ${attempt.label})...`);
                    const config = {
                        coreURL: await fetchWasmWithCache(`${attempt.base}/${attempt.core}.js`, 'text/javascript', `${attempt.label} core.js`),
                        wasmURL: await fetchWasmWithCache(`${attempt.base}/${attempt.core}.wasm`, 'application/wasm', `${attempt.label} core.wasm`)
                    };
                    if (attempt.mt) {
                        config.workerURL = await fetchWasmWithCache(`${attempt.base}/ffmpeg-core.worker.js`, 'text/javascript', `${attempt.label} worker.js`);
                    }
                    inst = new FFmpeg();
                    // 30s for WASM JIT compilation (download already done above)
                    await withTimeout(inst.load(config), 30000, `${attempt.label} engine init`);
                    log(`  FFmpeg Core WASM loaded from ${attempt.label}.`);
                    loadedInstance = inst;
                    break;
                } catch (err) {
                    if (inst) {
                        try { inst.terminate(); } catch (_) {}
                    }
                    log(`  ${attempt.label} failed: ${errMsg(err)}`);
                }
            }
            }

            if (!loadedInstance) {
                throw new Error('Failed to load FFmpeg WASM from all sources.');
            }
            ffmpeg = loadedInstance;
            logEnd();

            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                if (progressFill) progressFill.style.width = `${percent}%`;
                if (progressPercent) progressPercent.textContent = `${percent}%`;
                const statusMsg = `${t('status_encoding')}...`;
                if (progressStatus) progressStatus.textContent = statusMsg;
                if (window.ToolProgressManager) {
                    window.ToolProgressManager.set('tool-video-compressor', { isProcessing: true, percent, status: statusMsg, file });
                }
            });

            ffmpeg.on('log', ({ message }) => {
                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                }
                log(message);
            });

            logSection('FFmpeg — Writing Input File');
            await ffmpeg.writeFile('input.mp4', await fetchFile(file));
            log('  Write: DONE');
            logEnd();

            const threads = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4).toString() : '2';
            const scaleFilter = `scale='if(gt(iw,ih),min(iw,${MAX_DIMENSION}),-2)':'if(gt(iw,ih),-2,min(ih,${MAX_DIMENSION}))'`;

            let command = [];
            if (selectedPreset === 'slow') {
                command = [
                    '-y', '-i', 'input.mp4',
                    '-threads', threads,
                    '-map', '0:v:0',
                    '-map', '0:a:0?',
                    '-dn',
                    '-map_metadata', '-1',
                    '-map_chapters', '-1',
                    '-vf', "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '22',
                    '-maxrate', '12M',
                    '-bufsize', '20M',
                    '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-movflags', '+faststart',
                    'output.mp4'
                ];
            } else if (selectedPreset === 'fast') {
                command = [
                    '-i', 'input.mp4',
                    '-threads', threads,
                    ...(needsScale ? ['-vf', scaleFilter] : []),
                    '-c:v', 'libx265',
                    '-preset', 'veryfast',
                    '-crf', '20',
                    '-c:a', 'copy',
                    'output.mp4'
                ];
            } else {
                command = [
                    '-i', 'input.mp4',
                    '-threads', threads,
                    ...(needsScale ? ['-vf', scaleFilter] : []),
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '20',
                    '-c:a', 'copy',
                    'output.mp4'
                ];
            }

            logSection('FFmpeg — Execution');
            log(`  Command: ffmpeg ${command.join(' ')}`);
            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                try {
                    const testData = await ffmpeg.readFile('output.mp4');
                    if (!testData || testData.byteLength < 1024) throw execError;
                } catch (rErr) {
                    throw execError;
                }
            }
            logEnd();

            if (oomDetected) throw new Error('Memory limit exceeded during video processing.');

            if (progressStatus) progressStatus.textContent = t('status_finalizing');
            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-video-compressor', { isProcessing: true, percent: 99, status: t('status_finalizing'), file });
            }
            const data = await ffmpeg.readFile('output.mp4');
            if (!data || data.byteLength < 1024) {
                throw new Error('Compression failed: output file is empty or corrupt.');
            }

            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const outName = `compressed_${selectedPreset}_${file.name.replace(/\.[^.]+$/, '')}.mp4`;
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = outName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (progressFill) progressFill.style.width = '100%';
            if (progressPercent) progressPercent.textContent = '100%';
            if (progressStatus) progressStatus.textContent = t('status_completed');
            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-video-compressor', { isProcessing: false, completed: true, percent: 100, status: t('status_completed'), file });
            }

            logSection('Video Compressor — Completed');
            log(`  Output: ${outName}`);
            log(`  Output size: ${(data.byteLength / (1024 * 1024)).toFixed(2)} MB`);
            logEnd();

            const processIcon = document.getElementById('tool-process-icon');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.dataset.state = 'completed';
                if (processLabel) processLabel.textContent = t('status_process_another');
                if (processIcon) processIcon.textContent = 'restart_alt';
            }
            if (typeof window.showToast === 'function') {
                window.showToast(t('status_completed_toast'));
            }
        } catch (err) {
            console.error('Video Compressor Error:', err);
            log(`\n!! Error: ${err.message}`);
            if (progressStatus) progressStatus.textContent = `Error: ${err.message}`;
            if (typeof window.showToast === 'function') {
                window.showToast(`Error: ${err.message}`);
            }
            if (window.ToolProgressManager) {
                window.ToolProgressManager.clear('tool-video-compressor');
            }
        } finally {
            isProcessing = false;
            if (processBtn) processBtn.disabled = false;
        }
    }

    const toolDefinition = {
        id: 'tool-video-compressor',
        _id: 'tool-video-compressor',
        title: 'Video Compressor',
        desc: 'Compress video to custom quality and file sizes',
        icon: 'compress',
        category: 'Tools',
        features: [
            'H.264 & H.265 (HEVC) Codecs',
            'Slow (CRF 22), Medium, & Fast Presets',
            '4K / UltraHD Auto Scaling Protection',
            'Client-side Local WebAssembly Processing'
        ],
        specs: [
            { label: 'ENGINE', value: 'FFmpeg WebAssembly' },
            { label: 'FORMAT', value: 'MP4, MOV, WebM, MKV' },
            { label: 'PROCESSING', value: '100% Client-side (Local)' }
        ],
        initModal: initCompressorUI,
        onProcess: processVideoCompressor,
        onReset: function() {
            selectedFile = null;
            isProcessing = false;
            const logsContainer = document.getElementById('compressor-logs-container');
            if (logsContainer) logsContainer.classList.add('hidden');
            const logs = document.getElementById('compressor-logs');
            if (logs) logs.textContent = '';
        },
        clearCache: function(btn) {
            if (typeof window.clearAllToolCache === 'function') window.clearAllToolCache(btn);
        }
    };

    if (window.AppTools && typeof window.AppTools.register === 'function') {
        window.AppTools.register(toolDefinition);
    } else {
        window._pendingTools = window._pendingTools || [];
        window._pendingTools.push(toolDefinition);
    }

    window.VideoCompressorTool = toolDefinition;
})();
