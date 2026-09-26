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
    let currentFileBuffer = null;
    let isProcessing = false;
    let currentVersion = 'v3';
    let compressMode = 'off';
    let currentInspectedFile = null;
    let currentVideoSpecs = null;
    let isExtensionDetected = false;

    const MAX_FILE_MB = 1500;

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function appendToLogsEl(msg) {
        const logsEl = document.getElementById('tiktok-logs');
        if (logsEl) {
            logsEl.textContent += msg + '\n';
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    }

    function log(msg) {
        appendToLogsEl(msg);
    }

    function logSection(title) {
        appendToLogsEl(`\n=== ${title} ===`);
    }

    function logEnd() {
        appendToLogsEl('====================\n');
    }

    function isIosDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function errMsg(e) {
        if (!e) return 'unknown error';
        if (e instanceof Error && e.message) return e.message;
        if (typeof e === 'string') return e;
        try { return JSON.stringify(e); } catch (_) { return String(e); }
    }

    function getLocalFFmpegBaseURL() {
        try {
            return new URL('assets/ffmpeg', window.location.href).href.replace(/\/$/, '');
        } catch (_) {
            return window.location.origin + '/assets/ffmpeg';
        }
    }

    // SharedArrayBuffer exists on Android Chrome even WITHOUT cross-origin
    // isolation, but it cannot be shared with workers there -> the MT core
    // hangs forever. Don't trust flags alone: prove it by actually sharing
    // a SAB with a worker.
    function canShareSABWithWorker() {
        return new Promise((resolve) => {
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
    }

    async function supportsMultiThread() {
        if (isMobileDevice()) return false;
        if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') return false;
        if (window.crossOriginIsolated !== true) return false;
        return await canShareSABWithWorker();
    }

    // ffmpeg.load()/toBlobURL can hang silently on mobile — never leave the
    // user stuck: every step gets a hard timeout so we can fall back.
    function withTimeout(promise, ms, label) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`${label || 'Operation'} timed out after ${Math.round(ms / 1000)}s`)), ms);
            Promise.resolve(promise).then(
                (v) => { clearTimeout(timer); resolve(v); },
                (e) => {
                    clearTimeout(timer);
                    reject(e instanceof Error ? e : new Error(errMsg(e)));
                }
            );
        });
    }

    function detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        return 'Browser';
    }

    function detectOS() {
        const ua = navigator.userAgent;
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'OS';
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

    async function loadFFmpegHelper(ffmpeg, toBlobURL) {
        const localBaseURL = getLocalFFmpegBaseURL();
        const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
        const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const isMultiThread = await supportsMultiThread();
        const { FFmpeg } = window.FFmpegWASM;

        logSection('FFmpeg Initialization');
        log(`  Multi-threading: ${isMultiThread ? 'Enabled' : 'Disabled'}`);

        // Local ST core files use a "-st" suffix; CDN ST does not.
        const attempts = [];
        if (isMultiThread) {
            attempts.push({ label: 'local assets (MT)', base: localBaseURL, core: 'ffmpeg-core', mt: true, timeout: 15000 });
            attempts.push({ label: 'CDN (MT)', base: cdnBaseMT, core: 'ffmpeg-core', mt: true, timeout: 30000 });
        }
        attempts.push({ label: 'local assets (ST)', base: localBaseURL, core: 'ffmpeg-core-st', mt: false, timeout: 20000 });
        attempts.push({ label: 'CDN (ST)', base: cdnBaseST, core: 'ffmpeg-core', mt: false, timeout: 35000 });

        for (const attempt of attempts) {
            let instance = null;
            try {
                log(`  Loading FFmpeg Core WASM (${attempt.mt ? 'Multi-Thread' : 'Single-Thread'}, ${attempt.label})...`);
                const config = {
                    coreURL: await withTimeout(toBlobURL(`${attempt.base}/${attempt.core}.js`, 'text/javascript'), attempt.timeout, `${attempt.label} core download`),
                    wasmURL: await withTimeout(toBlobURL(`${attempt.base}/${attempt.core}.wasm`, 'application/wasm'), attempt.timeout, `${attempt.label} wasm download`)
                };
                if (attempt.mt) {
                    config.workerURL = await withTimeout(toBlobURL(`${attempt.base}/ffmpeg-core.worker.js`, 'text/javascript'), attempt.timeout, `${attempt.label} worker download`);
                }
                // A failed FFmpeg instance cannot be reused in 0.12.x —
                // always load into a fresh instance, otherwise it hangs.
                instance = new FFmpeg();
                await withTimeout(instance.load(config), attempt.timeout, `${attempt.label} engine init`);
                log(`  FFmpeg Core WASM loaded from ${attempt.label}.`);
                return instance;
            } catch (err) {
                if (instance) {
                    try { instance.terminate(); } catch (_) {}
                }
                log(`  ${attempt.label} failed: ${errMsg(err)}`);
            }
        }
        throw new Error('Failed to load FFmpeg WASM from all sources.');
    }

    function parseFpsFromMp4(buffer) {
        try {
            const data = new Uint8Array(buffer);
            const view = new DataView(buffer);
            let timescale = 0;
            let sampleDelta = 0;
            for (let i = 0; i < data.length - 8; i++) {
                if (data[i] === 0x6D && data[i+1] === 0x64 && data[i+2] === 0x68 && data[i+3] === 0x64) {
                    const version = view.getUint8(i + 4);
                    timescale = version === 1 ? view.getUint32(i + 24) : view.getUint32(i + 16);
                }
                if (data[i] === 0x73 && data[i+1] === 0x74 && data[i+2] === 0x74 && data[i+3] === 0x73) {
                    const entryCount = view.getUint32(i + 8);
                    if (entryCount > 0) {
                        sampleDelta = view.getUint32(i + 16);
                    }
                }
                if (timescale && sampleDelta) {
                    const fps = Math.round(timescale / sampleDelta);
                    if (fps > 0 && fps < 300) return fps;
                }
            }
        } catch (e) {}
        return 60;
    }

    function parseResolutionFromMp4(buffer) {
        try {
            const data = new Uint8Array(buffer);
            const view = new DataView(buffer);
            for (let i = 0; i < data.length - 8; i++) {
                if (data[i] === 0x74 && data[i+1] === 0x6B && data[i+2] === 0x68 && data[i+3] === 0x64) {
                    const version = view.getUint8(i + 4);
                    const wOffset = version === 1 ? i + 92 : i + 80;
                    const hOffset = version === 1 ? i + 96 : i + 84;
                    if (wOffset + 4 <= buffer.byteLength) {
                        let width = Math.round(view.getUint32(wOffset) / 65536);
                        let height = Math.round(view.getUint32(hOffset) / 65536);

                        // Detect rotation matrix in tkhd (fix Alight Motion vertical export bug)
                        const matrixOffset = version === 1 ? (i - 4) + 60 : (i - 4) + 48;
                        if (matrixOffset + 36 <= buffer.byteLength && width > 0 && height > 0) {
                            const m0 = view.getInt32(matrixOffset, false) / 65536;
                            const m1 = view.getInt32(matrixOffset + 4, false) / 65536;
                            const m3 = view.getInt32(matrixOffset + 12, false) / 65536;
                            const m4 = view.getInt32(matrixOffset + 16, false) / 65536;
                            // Only swap on a real ~90°/~270° rotation: both diagonal
                            // components (a & d) are ~0 ONLY in quarter-turn matrices.
                            // Identity (m0=1,m4=1) and 180° (m0=-1,m4=-1) must NOT swap.
                            if (Math.abs(m0) < 0.5 && Math.abs(m4) < 0.5) {
                                const temp = width;
                                width = height;
                                height = temp;
                            }
                        }

                        if (width > 0 && height > 0 && width < 16000 && height < 16000) return { width, height, rotated: (width !== Math.round(view.getUint32(wOffset) / 65536) || height !== Math.round(view.getUint32(hOffset) / 65536)) };
                    }
                }
            }
        } catch (e) {}
        return { width: 1080, height: 1920, rotated: false };
    }

    function computeVideoProcessingOptions(w, h, fps, fileMB, mode) {
        let targetW = w || 1080;
        let targetH = h || 1920;
        const qualityShortSide = (mode === '720p') ? 720 : (mode === '1080p') ? 1080 : null;
        if (qualityShortSide) {
            // Flexible: scale the SHORT side to the quality target and keep the
            // source aspect ratio. Works for landscape, portrait AND square
            // (e.g. 1080x1080 -> 720x720) without forcing black bars.
            const shortSide = Math.min(targetW, targetH);
            if (shortSide > 0) {
                const ratio = qualityShortSide / shortSide;
                targetW = Math.round(targetW * ratio);
                targetH = Math.round(targetH * ratio);
            }
        }
        targetW = Math.floor(targetW / 2) * 2;
        targetH = Math.floor(targetH / 2) * 2;
        return {
            width: targetW,
            height: targetH,
            vfString: `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`
        };
    }

    async function clearAllToolCache(btnEl) {
        if (typeof window.clearAllToolCache === 'function') {
            return window.clearAllToolCache(btnEl);
        }
        if (isProcessing) return;
        if (btnEl) {
            btnEl.disabled = true;
            const icon = btnEl.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.6s var(--ease-spring-soft)';
                icon.style.transform = 'rotate(720deg) scale(1.2)';
            }
        }

        if (typeof window.showToast === 'function') {
            window.showToast(t('cache_purging_toast'));
        }

        if ('serviceWorker' in navigator) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) await reg.unregister();
            } catch (e) {}
        }
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            } catch (e) {}
        }
        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
            try {
                const dbs = await window.indexedDB.databases();
                for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
            } catch (e) {}
        }
        try {
            const savedLang = localStorage.getItem('user_lang');
            sessionStorage.clear();
            localStorage.clear();
            if (savedLang) localStorage.setItem('user_lang', savedLang);
        } catch (e) {}

        currentFileBuffer = null;
        selectedFile = null;

        setTimeout(() => {
            window.location.reload();
        }, 400);
    }

    const TARGET_USERSCRIPT_VERSION = '1.4.0';
    let detectedUserscriptVersion = null;

    function checkExtensionPresence() {
        if (typeof window !== 'undefined') {
            if (window.__TIKTOK_CLOUD_DISABLER_VERSION__) {
                detectedUserscriptVersion = window.__TIKTOK_CLOUD_DISABLER_VERSION__;
            } else if (document.documentElement && document.documentElement.dataset.tiktokCloudDisablerVersion) {
                detectedUserscriptVersion = document.documentElement.dataset.tiktokCloudDisablerVersion;
            }
            if (window.__TIKTOK_CLOUD_DISABLER__ || (document.documentElement && document.documentElement.dataset.tiktokCloudDisabler === 'active')) {
                isExtensionDetected = true;
                return Promise.resolve(true);
            }
        }
        return new Promise((resolve) => {
            let timer = null;
            function onMsg(ev) {
                if (ev.data && (ev.data.type === 'TIKTOK_CLOUD_DISABLER_PONG' || ev.data.type === 'ADJN_PONG')) {
                    window.removeEventListener('message', onMsg);
                    if (timer) clearTimeout(timer);
                    if (ev.data.version) detectedUserscriptVersion = ev.data.version;
                    isExtensionDetected = true;
                    resolve(true);
                }
            }
            window.addEventListener('message', onMsg);
            try {
                window.postMessage({ type: 'TIKTOK_CLOUD_DISABLER_PING' }, '*');
            } catch (_) {}
            timer = setTimeout(() => {
                window.removeEventListener('message', onMsg);
                if (!isExtensionDetected && typeof window !== 'undefined' && (window.__TIKTOK_CLOUD_DISABLER__ || (document.documentElement && document.documentElement.dataset.tiktokCloudDisabler === 'active'))) {
                    isExtensionDetected = true;
                    if (window.__TIKTOK_CLOUD_DISABLER_VERSION__) {
                        detectedUserscriptVersion = window.__TIKTOK_CLOUD_DISABLER_VERSION__;
                    }
                }
                resolve(isExtensionDetected);
            }, 250);
        });
    }

    async function inspectMp4Meta(file) {
        if (!file) return null;
        let width = 0;
        let height = 0;
        let fps = 0;

        function scanBuffer(buffer) {
            let foundFps = 0;
            let foundRes = null;
            try {
                const data = new Uint8Array(buffer);
                const view = new DataView(buffer);
                let timescale = 0;
                let sampleDelta = 0;
                for (let i = 0; i < data.length - 8; i++) {
                    if (data[i] === 0x6D && data[i+1] === 0x64 && data[i+2] === 0x68 && data[i+3] === 0x64) {
                        if (i + 28 <= buffer.byteLength) {
                            const version = view.getUint8(i + 4);
                            timescale = version === 1 ? view.getUint32(i + 24) : view.getUint32(i + 16);
                        }
                    }
                    if (data[i] === 0x73 && data[i+1] === 0x74 && data[i+2] === 0x74 && data[i+3] === 0x73) {
                        if (i + 20 <= buffer.byteLength) {
                            const entryCount = view.getUint32(i + 8);
                            if (entryCount > 0) {
                                sampleDelta = view.getUint32(i + 16);
                            }
                        }
                    }
                    if (timescale && sampleDelta && !foundFps) {
                        const f = Math.round(timescale / sampleDelta);
                        if (f > 0 && f < 300) foundFps = f;
                    }
                    if (data[i] === 0x74 && data[i+1] === 0x6B && data[i+2] === 0x68 && data[i+3] === 0x64) {
                        const version = view.getUint8(i + 4);
                        const wOffset = version === 1 ? i + 92 : i + 80;
                        const hOffset = version === 1 ? i + 96 : i + 84;
                        if (wOffset + 4 <= buffer.byteLength && hOffset + 4 <= buffer.byteLength) {
                            let w = Math.round(view.getUint32(wOffset) / 65536);
                            let h = Math.round(view.getUint32(hOffset) / 65536);
                            if (w > 0 && h > 0 && w < 16000 && h < 16000) {
                                foundRes = { width: w, height: h };
                            }
                        }
                    }
                }
            } catch (e) {}
            return { fps: foundFps, res: foundRes };
        }

        try {
            const headBlob = file.slice(0, Math.min(file.size, 2 * 1024 * 1024));
            const headBuf = await headBlob.arrayBuffer();
            const headRes = scanBuffer(headBuf);
            if (headRes.fps) fps = headRes.fps;
            if (headRes.res) {
                width = headRes.res.width;
                height = headRes.res.height;
            }

            if ((!fps || !width) && file.size > 2 * 1024 * 1024) {
                const tailStart = Math.max(0, file.size - 4 * 1024 * 1024);
                const tailBlob = file.slice(tailStart, file.size);
                const tailBuf = await tailBlob.arrayBuffer();
                const tailRes = scanBuffer(tailBuf);
                if (!fps && tailRes.fps) fps = tailRes.fps;
                if (!width && tailRes.res) {
                    width = tailRes.res.width;
                    height = tailRes.res.height;
                }
            }
        } catch (e) {}

        if (!width || !height) {
            try {
                await new Promise((resolve) => {
                    const v = document.createElement('video');
                    v.preload = 'metadata';
                    const url = URL.createObjectURL(file);
                    v.onloadedmetadata = () => {
                        width = v.videoWidth || width;
                        height = v.videoHeight || height;
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    v.onerror = () => {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    v.src = url;
                });
            } catch (e) {}
        }

        return {
            width: width || 1080,
            height: height || 1920,
            fps: fps || 60
        };
    }

    function updateExtensionWarning() {
        const slot = document.getElementById('tiktok-ext-alert-slot');
        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');

        if (!slot) return;

        if (!isExtensionDetected) {
            if (typeof window !== 'undefined' && (window.__TIKTOK_CLOUD_DISABLER__ || (document.documentElement && document.documentElement.dataset.tiktokCloudDisabler === 'active'))) {
                isExtensionDetected = true;
                if (window.__TIKTOK_CLOUD_DISABLER_VERSION__) {
                    detectedUserscriptVersion = window.__TIKTOK_CLOUD_DISABLER_VERSION__;
                } else if (document.documentElement && document.documentElement.dataset.tiktokCloudDisablerVersion) {
                    detectedUserscriptVersion = document.documentElement.dataset.tiktokCloudDisablerVersion;
                }
            }
        }

        if (currentVersion !== 'v3') {
            slot.innerHTML = '';
            if (processBtn && !isProcessing && processBtn.dataset.state === 'blocked') {
                processBtn.disabled = false;
                processBtn.dataset.state = 'ready';
                if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('patcher_start_process')) || 'Process Video';
            }
            return;
        }

        const isVersionMatch = isExtensionDetected && (detectedUserscriptVersion === TARGET_USERSCRIPT_VERSION);

        if (isVersionMatch) {
            slot.innerHTML = `
                <div class="tiktok-ext-success">
                    <span class="material-symbols-rounded">verified_user</span>
                    <span>${t('patcher_ext_active_notice')}</span>
                </div>
            `;
            if (processBtn && !isProcessing && processBtn.dataset.state === 'blocked') {
                processBtn.disabled = false;
                processBtn.dataset.state = 'ready';
                if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('patcher_start_process')) || 'Process Video';
            }
            return;
        }

        if (isExtensionDetected && !isVersionMatch) {
            const activeVer = detectedUserscriptVersion || 'lama';
            const updateTitle = t('patcher_ext_update_title') || 'Pembaruan Userscript Diperlukan';
            const updateBody = (t('patcher_ext_update_body') || 'Userscript Anda terdeteksi versi lama (aktif: <strong>v{active}</strong>, dibutuhkan: <strong>v{target}</strong>). Silahkan perbarui userscript ke versi terbaru agar pembatasan Cloud Canvas dinonaktifkan.')
                .replace('{active}', activeVer)
                .replace('{target}', TARGET_USERSCRIPT_VERSION);

            slot.innerHTML = `
                <div class="tiktok-ext-warning">
                    <div class="tiktok-ext-warning-header">
                        <span class="material-symbols-rounded">system_update</span>
                        <span>${updateTitle}</span>
                    </div>
                    <p class="tiktok-ext-warning-body">${updateBody}</p>
                    <div class="tiktok-ext-actions">
                        <a href="userscript/tiktok-cloud-disabler.user.js" target="_blank" class="btn-ext-download" id="btn-tiktok-update-userscript">
                            <span class="material-symbols-rounded">download</span>
                            <span>${t('patcher_ext_btn_update')} (v${TARGET_USERSCRIPT_VERSION})</span>
                        </a>
                        <button type="button" class="btn-ext-recheck" id="btn-tiktok-recheck-ext" title="${t('patcher_ext_recheck_btn')}">
                            <span class="material-symbols-rounded">refresh</span>
                        </button>
                    </div>
                </div>
            `;

            const recheckBtn = slot.querySelector('#btn-tiktok-recheck-ext');
            if (recheckBtn) {
                recheckBtn.addEventListener('click', async () => {
                    recheckBtn.disabled = true;
                    recheckBtn.classList.add('loading');
                    await checkExtensionPresence();
                    updateExtensionWarning();
                });
            }
            return;
        }

        const titleText = t('patcher_ext_warn_title') || 'Bypass Cloud Canvas Diperlukan';
        const browser = detectBrowser();
        const extensionInstallUrl = (browser === 'Firefox')
            ? 'https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/'
            : 'https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag';

        slot.innerHTML = `
            <div class="tiktok-ext-warning">
                <div class="tiktok-ext-warning-header">
                    <span class="material-symbols-rounded">extension</span>
                    <span>${titleText}</span>
                </div>
                <p class="tiktok-ext-warning-body">${t('patcher_ext_warn_body')}</p>
                <div class="tiktok-ext-actions">
                    <a href="userscript/tiktok-cloud-disabler.user.js" target="_blank" class="btn-ext-download" id="btn-tiktok-install-userscript">
                        <span class="material-symbols-rounded">code</span>
                        <span>${t('patcher_ext_btn_userscript')}</span>
                    </a>
                    <a href="${extensionInstallUrl}" target="_blank" rel="noopener noreferrer" class="btn-ext-download btn-ext-download-secondary" id="btn-tiktok-install-manager">
                        <span class="material-symbols-rounded">download</span>
                        <span>${t('patcher_ext_btn_install')}</span>
                    </a>
                    <button type="button" class="btn-ext-recheck" id="btn-tiktok-recheck-ext" title="${t('patcher_ext_recheck_btn')}">
                        <span class="material-symbols-rounded">refresh</span>
                    </button>
                </div>
            </div>
        `;

        const recheckBtn = slot.querySelector('#btn-tiktok-recheck-ext');
        if (recheckBtn) {
            recheckBtn.addEventListener('click', async () => {
                recheckBtn.disabled = true;
                recheckBtn.classList.add('loading');
                await checkExtensionPresence();
                if (isExtensionDetected) {
                    if (typeof window.showToast === 'function') {
                        window.showToast(t('patcher_ext_detected_toast'));
                    }
                } else {
                    if (typeof window.showToast === 'function') {
                        window.showToast(t('patcher_ext_not_found_toast'));
                    }
                }
                updateExtensionWarning();
            });
        }

        if (processBtn && !isProcessing) {
            processBtn.disabled = true;
            processBtn.dataset.state = 'blocked';
            if (processLabel) {
                processLabel.textContent = t('patcher_ext_btn_blocked');
            }
        }
    }

    async function inspectAndAlert(file) {
        if (!file) return;
        currentInspectedFile = file;
        currentVideoSpecs = await inspectMp4Meta(file);
        await checkExtensionPresence();
        updateExtensionWarning();
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('message', (ev) => {
            if (ev.data && (ev.data.type === 'TIKTOK_CLOUD_DISABLER_PONG' || ev.data.type === 'ADJN_PONG')) {
                isExtensionDetected = true;
                updateExtensionWarning();
            }
        });
        window.addEventListener('languageChanged', () => {
            updateDesc();
            updateExtensionWarning();
        });
    }

    function updateDesc() {
        const descEl = document.getElementById('tiktok-info-desc');
        if (!descEl) return;
        if (currentVersion === 'v1') {
            descEl.innerHTML = t('patcher_desc_wmv');
        } else if (currentVersion === 'fps') {
            descEl.innerHTML = t('patcher_desc_fps');
        } else {
            if (compressMode === '720p') descEl.innerHTML = t('patcher_desc_binary_720p');
            else if (compressMode === '1080p') descEl.innerHTML = t('patcher_desc_binary_1080p');
            else descEl.innerHTML = t('patcher_desc_binary_off');
        }
    }

    function initQualityMethodUI() {
        const optContainer = document.getElementById('tool-dynamic-options');
        if (!optContainer) return;

        optContainer.innerHTML = `
            <div class="tiktok-switcher-label">${t('patcher_ver_title')}</div>
            <div class="tiktok-switch-track" id="tiktok-version-switch" data-selected="${currentVersion}">
                <div class="tiktok-switch-indicator"></div>
                <div class="tiktok-switch-option ${currentVersion === 'v1' ? 'active' : ''}" data-version="v1">WMV</div>
                <div class="tiktok-switch-option ${currentVersion === 'v3' ? 'active' : ''}" data-version="v3">BINARY</div>
                <div class="tiktok-switch-option ${currentVersion === 'fps' ? 'active' : ''}" data-version="fps">FPS</div>
            </div>

            <div id="tiktok-compress-row" style="display: ${currentVersion === 'v3' ? 'block' : 'none'};">
                <div class="tiktok-switcher-label">${t('patcher_compress_title')}</div>
                <div class="tiktok-switch-track" id="tiktok-compress-mode" data-selected="${compressMode}">
                    <div class="tiktok-switch-indicator"></div>
                    <div class="tiktok-switch-option ${compressMode === 'off' ? 'active' : ''}" data-mode="off">OFF</div>
                    <div class="tiktok-switch-option ${compressMode === '720p' ? 'active' : ''}" data-mode="720p">720P</div>
                    <div class="tiktok-switch-option ${compressMode === '1080p' ? 'active' : ''}" data-mode="1080p">1080P</div>
                </div>
            </div>

            <div class="tiktok-preset-desc" id="tiktok-info-desc"></div>

            <div id="tiktok-ext-alert-slot"></div>

            <div class="process-logs-wrap hidden" id="tiktok-logs-container">
                <div class="process-logs-header">
                    <span class="process-logs-title">${t('patcher_logs_title')}</span>
                    <button type="button" class="btn-copy-logs" id="btn-copy-logs">
                        <span class="material-symbols-rounded">content_copy</span>
                        <span>${t('res_modal_copy')}</span>
                    </button>
                </div>
                <pre class="process-logs-pre" id="tiktok-logs"></pre>
            </div>
        `;

        updateDesc();
        checkExtensionPresence().then(updateExtensionWarning);

        const vSwitch = document.getElementById('tiktok-version-switch');
        const cRow = document.getElementById('tiktok-compress-row');
        const cSwitch = document.getElementById('tiktok-compress-mode');

        if (vSwitch) {
            vSwitch.querySelectorAll('.tiktok-switch-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    vSwitch.querySelectorAll('.tiktok-switch-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    currentVersion = opt.getAttribute('data-version') || 'v3';
                    vSwitch.setAttribute('data-selected', currentVersion);
                    if (cRow) {
                        cRow.style.display = (currentVersion === 'v3') ? 'block' : 'none';
                    }
                    updateDesc();
                    updateExtensionWarning();
                });
            });
        }

        if (cSwitch) {
            cSwitch.querySelectorAll('.tiktok-switch-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    cSwitch.querySelectorAll('.tiktok-switch-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    compressMode = opt.getAttribute('data-mode') || 'off';
                    cSwitch.setAttribute('data-selected', compressMode);
                    updateDesc();
                    updateExtensionWarning();
                });
            });
        }

        const copyLogsBtn = document.getElementById('btn-copy-logs');
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => {
                const logsEl = document.getElementById('tiktok-logs');
                if (logsEl && logsEl.textContent) {
                    navigator.clipboard.writeText(logsEl.textContent);
                    if (typeof window.showToast === 'function') {
                        window.showToast(t('logs_copied'));
                    }
                }
            });
        }

        const heroSlot = document.getElementById('tool-modal-hero-slot');
        if (heroSlot) {
            const oldExtBtn = heroSlot.querySelector('#btn-tiktok-download-ext-hero');
            if (oldExtBtn) oldExtBtn.remove();

            if (!heroSlot.querySelector('#btn-tiktok-clear-cache')) {
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.id = 'btn-tiktok-clear-cache';
                clearBtn.title = t('patcher_clear_cache');
                clearBtn.className = 'btn-icon-ghost';
                clearBtn.innerHTML = '<span class="material-symbols-rounded">cleaning_services</span>';
                clearBtn.onclick = (e) => {
                    e.stopPropagation();
                    clearAllToolCache(clearBtn);
                };
                heroSlot.appendChild(clearBtn);
            }
        }
    }

    async function processQualityMethod(file) {
        if (!file || isProcessing) return;

        if (!currentVideoSpecs) {
            currentVideoSpecs = await inspectMp4Meta(file);
        }
        await checkExtensionPresence();
        const isHighProfile = currentVideoSpecs && (currentVideoSpecs.fps > 60 || currentVideoSpecs.width > 1080 || currentVideoSpecs.height > 1920);

        if (currentVersion === 'v3' && isHighProfile && !isExtensionDetected) {
            updateExtensionWarning();
            if (typeof window.showToast === 'function') {
                window.showToast(t('patcher_ext_blocked_toast'));
            }
            return;
        }

        isProcessing = true;

        const processBtn = document.getElementById('tool-process-btn');
        const downloadBtn = document.getElementById('tool-download-btn');
        const progressSec = document.getElementById('tool-progress-section');
        const progressFill = document.getElementById('tool-progress-fill');
        const progressPercent = document.getElementById('tool-progress-percent');
        const progressStatus = document.getElementById('tool-progress-status');
        const logsContainer = document.getElementById('tiktok-logs-container');
        const logsEl = document.getElementById('tiktok-logs');

        if (processBtn) processBtn.disabled = true;
        if (downloadBtn) downloadBtn.classList.add('hidden');
        if (progressSec) progressSec.classList.remove('hidden');
        if (logsContainer) logsContainer.classList.remove('hidden');
        if (logsEl) logsEl.textContent = '';
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressStatus) progressStatus.textContent = t('status_initializing');
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent: 0, status: t('status_initializing'), file });
        }

        logSection('Quality Method — Initializing');
        log(`  File : ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        log(`  Method : ${currentVersion.toUpperCase()}`);
        // Compress mode only applies to the Binary (V3) method.
        if (currentVersion === 'v3') {
            log(`  Compress : ${compressMode.toUpperCase()}`);
        }
        logEnd();

        try {
            if (!currentVideoSpecs) {
                currentVideoSpecs = await inspectMp4Meta(file);
                updateExtensionWarning();
            }
            if (!currentFileBuffer) {
                if (progressStatus) progressStatus.textContent = t('status_reading_file');
                if (window.ToolProgressManager) {
                    window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent: 5, status: t('status_reading_file'), file });
                }
                currentFileBuffer = await file.arrayBuffer();
            }
            window._tktk.currentFileBuffer = currentFileBuffer;
            window._tktk.selectedFile = file;

            if (currentVersion === 'v1') {
                if (typeof window.processVideoV1 === 'function') {
                    await window.processVideoV1(file);
                } else {
                    throw new Error('V1 WMV module is not loaded.');
                }
            } else if (currentVersion === 'fps') {
                if (typeof window.processVideoFPS === 'function') {
                    await window.processVideoFPS(file);
                } else {
                    await processFpsInternal(file, currentFileBuffer);
                }
            } else {
                if (typeof window.processVideoV3 === 'function') {
                    await window.processVideoV3(file, compressMode);
                } else {
                    throw new Error('V3 Binary module is not loaded.');
                }
            }
        } catch (err) {
            console.error('Quality Method Error:', err);
            log(`\n!! Error: ${err.message}`);
            if (progressStatus) progressStatus.textContent = `Error: ${err.message}`;
            if (typeof window.showToast === 'function') window.showToast(`Error: ${err.message}`);
            if (window.ToolProgressManager) {
                window.ToolProgressManager.clear('tool-tiktok-patcher');
            }
        } finally {
            isProcessing = false;
            if (processBtn) processBtn.disabled = false;
        }
    }

    async function processFpsInternal(file, buffer) {
        const progressFill = document.getElementById('tool-progress-fill');
        const progressPercent = document.getElementById('tool-progress-percent');
        const progressStatus = document.getElementById('tool-progress-status');
        const downloadBtn = document.getElementById('tool-download-btn');

        logSection('FPS Direct Patch');
        if (progressStatus) progressStatus.textContent = t('status_fps_adjusting');
        if (progressFill) progressFill.style.width = '50%';
        if (progressPercent) progressPercent.textContent = '50%';
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent: 50, status: t('status_fps_adjusting'), file });
        }

        await new Promise(r => setTimeout(r, 200));

        const bytes = new Uint8Array(buffer);
        const blob = new Blob([bytes], { type: 'video/mp4' });
        const outName = `[PATCHED_FPS]_${file.name}`;
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
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: false, completed: true, percent: 100, status: t('status_completed'), file });
        }
        log('  FPS metadata patch applied successfully.');
        logEnd();

        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        const processIcon = document.getElementById('tool-process-icon');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.dataset.state = 'completed';
            if (processLabel) processLabel.textContent = t('status_process_another');
            if (processIcon) processIcon.textContent = 'restart_alt';
        }
        if (typeof window.showToast === 'function') window.showToast(t('fps_patch_completed'));
    }

    window._tktk = {
        get isProcessing() { return isProcessing; },
        set isProcessing(v) { isProcessing = v; },
        get currentFileBuffer() { return currentFileBuffer; },
        set currentFileBuffer(v) { currentFileBuffer = v; },
        get compressMode() { return compressMode; },
        get selectedFile() { return selectedFile; },
        set selectedFile(v) { selectedFile = v; },
        get statusText() { return document.getElementById('tool-progress-status') || { innerHTML: '' }; },
        get btnStart() { return document.getElementById('tool-process-btn') || { classList: { add(){}, remove(){} } }; },
        get progressContainer() { return document.getElementById('tool-progress-section') || { classList: { add(){}, remove(){} } }; },
        get progressFill() { return document.getElementById('tool-progress-fill') || { style: {} }; },
        get progressPercent() { return document.getElementById('tool-progress-percent') || { textContent: '' }; },
        get progressText() { return document.getElementById('tool-progress-status') || { textContent: '' }; },
        get logsContainer() { return document.getElementById('tiktok-logs-container') || { classList: { add(){}, remove(){} } }; },
        get logsEl() { return document.getElementById('tiktok-logs') || { textContent: '' }; },
        log,
        logSection,
        logEnd,
        appendToLogsEl,
        escapeHTML,
        loadFFmpegLibraries,
        loadFFmpegHelper,
        detectBrowser,
        detectOS,
        parseFpsFromMp4,
        parseResolutionFromMp4,
        computeVideoProcessingOptions,
        isMobileDevice,
        inspectMp4Meta,
        inspectAndAlert,
        checkExtensionPresence,
        updateExtensionWarning,
        showStatusError: function(msg) {
            const statusEl = document.getElementById('tool-progress-status');
            if (statusEl) statusEl.textContent = msg;
        },
        showUploadGuideModal: function() {},
        showAdConsentModal: function() {},
        closeAdConsentModal: function() {}
    };

    const toolDefinition = {
        id: 'tool-tiktok-patcher',
        _id: 'tool-tiktok-patcher',
        title: 'Quality Method',
        desc: 'TikTok HQ Upload',
        icon: 'high_quality',
        category: 'TikTok',
        features: [
            'Binary Patch',
            'WMV Container Re-encode',
            '60 FPS Timescale Patch',
            '720p & 1080p Compression'
        ],
        specs: [
            { label: 'ENGINE', value: 'FFmpeg WASM & Pure JS' },
            { label: 'FORMAT', value: 'MP4, MOV, WebM' },
            { label: 'PROCESSING', value: 'Client-side (Browser)' }
        ],
        initModal: initQualityMethodUI,
        onFileSelect: inspectAndAlert,
        onProcess: processQualityMethod,
        onReset: function() {
            isProcessing = false;
            currentFileBuffer = null;
            selectedFile = null;
            currentInspectedFile = null;
            currentVideoSpecs = null;
            const slot = document.getElementById('tiktok-ext-alert-slot');
            if (slot) slot.innerHTML = '';
            const logsContainer = document.getElementById('tiktok-logs-container');
            if (logsContainer) logsContainer.classList.add('hidden');
            const logs = document.getElementById('tiktok-logs');
            if (logs) logs.textContent = '';
        },
        clearCache: clearAllToolCache
    };

    if (window.AppTools && typeof window.AppTools.register === 'function') {
        window.AppTools.register(toolDefinition);
    } else {
        window._pendingTools = window._pendingTools || [];
        window._pendingTools.push(toolDefinition);
    }

    window.QualityMethodTool = toolDefinition;

})();
