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
            let ffmpeg = new FFmpeg();
            let oomDetected = false;

            // Some failures from ffmpeg.load()/toBlobURL are not Error objects,
            // so always extract a readable string (never log "undefined").
            const errMsg = (e) => {
                if (!e) return 'unknown error';
                if (e instanceof Error && e.message) return e.message;
                if (typeof e === 'string') return e;
                try { return JSON.stringify(e); } catch (_) { return String(e); }
            };

            const localBaseURL = window.location.origin + '/assets/ffmpeg';
            const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
            const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice;

            logSection('FFmpeg Core Initialization');
            let loaded = false;

            if (isMultiThread) {
                try {
                    log('  Loading FFmpeg Core WASM (Multi-Thread)...');
                    await ffmpeg.load({
                        coreURL: await toBlobURL(`${localBaseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${localBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                        workerURL: await toBlobURL(`${localBaseURL}/ffmpeg-core.worker.js`, 'text/javascript')
                    });
                    loaded = true;
                    log('  FFmpeg Core WASM (MT) loaded from local assets.');
                } catch (err) {
                    log(`  Local MT load failed, fallback to CDN: ${errMsg(err)}`);
                    // A failed FFmpeg instance cannot be reused in 0.12.x —
                    // recreate it before retrying, otherwise load() hangs.
                    ffmpeg = new FFmpeg();
                    try {
                        await ffmpeg.load({
                            coreURL: await toBlobURL(`${cdnBaseMT}/ffmpeg-core.js`, 'text/javascript'),
                            wasmURL: await toBlobURL(`${cdnBaseMT}/ffmpeg-core.wasm`, 'application/wasm'),
                            workerURL: await toBlobURL(`${cdnBaseMT}/ffmpeg-core.worker.js`, 'text/javascript')
                        });
                        loaded = true;
                        log('  FFmpeg Core WASM (MT) loaded from CDN.');
                    } catch (cdnErr) {
                        log(`  CDN MT load failed: ${errMsg(cdnErr)}`);
                    }
                }
            }

            if (!loaded) {
                // No SharedArrayBuffer (no cross-origin isolation / iOS):
                // must use the Single-Thread core WITHOUT workerURL.
                log('  Loading FFmpeg Core WASM (Single-Thread)...');
                ffmpeg = new FFmpeg();
                try {
                    await ffmpeg.load({
                        coreURL: await toBlobURL(`${localBaseURL}/ffmpeg-core-st.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${localBaseURL}/ffmpeg-core-st.wasm`, 'application/wasm')
                    });
                    log('  FFmpeg Core WASM (ST) loaded from local assets.');
                } catch (err) {
                    log(`  Local ST load failed, fallback to CDN: ${errMsg(err)}`);
                    ffmpeg = new FFmpeg();
                    try {
                        await ffmpeg.load({
                            coreURL: await toBlobURL(`${cdnBaseST}/ffmpeg-core.js`, 'text/javascript'),
                            wasmURL: await toBlobURL(`${cdnBaseST}/ffmpeg-core.wasm`, 'application/wasm')
                        });
                        log('  FFmpeg Core WASM (ST) loaded from CDN.');
                    } catch (cdnErr) {
                        throw new Error(`Failed to load FFmpeg WASM: ${errMsg(cdnErr)}`);
                    }
                }
            }
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
