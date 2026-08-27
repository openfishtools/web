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
    let selectedModel = 'selfie_segmenter';
    let selectedDevice = 'gpu';
    let selectedBg = 'transparent';
    let customColor = '#0842a0';
    let isImageMode = true;
    let isGeneratingPreview = false;

    let sliderPos = 50;
    let isDraggingSlider = false;
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let panOrigin = { x: 0, y: 0 };
    let isPinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    let lastResultCanvas = null;
    let lastResultBlob = null;
    let enhancedVideoUrl = null;
    let previewActive = false;
    let cachedOrigImage = null;
    let cachedMaskCanvas = null;
    let lastMaskModel = null;
    let lastMaskDevice = null;
    let isWebGpuSupported = false;

    let sessionCache = {};
    let currentObjectUrl = null;

    const MODELS = [
        { id: 'selfie_segmenter', label: 'MediaPipe (~1MB)' },
        { id: 'rvm_mobilenetv3', label: 'RVM (~15MB)' },
        { id: 'modnet', label: 'MODNet (~25MB)' }
    ];

    const MODEL_META = {
        selfie_segmenter: { file: 'assets/models/selfie_segmenter.onnx', type: 'selfie', w: 256, h: 256 },
        rvm_mobilenetv3: { file: 'assets/models/rvm_mobilenetv3_fp32.onnx', type: 'rvm', w: 512, h: 512 },
        modnet: { file: 'assets/models/modnet.onnx', type: 'modnet', w: 512, h: 512 }
    };

    const BG_OPTIONS = [
        { id: 'transparent', labelKey: 'tool_rembg_bg_transparent', fallback: 'Transparent' },
        { id: 'green', labelKey: 'tool_rembg_bg_green', fallback: 'Green Screen' },
        { id: 'color', labelKey: 'tool_rembg_bg_color', fallback: 'Solid Color' },
        { id: 'blur', labelKey: 'tool_rembg_bg_blur', fallback: 'Blur' }
    ];

    const DEVICE_OPTIONS = [
        { id: 'gpu', labelKey: 'tool_rembg_device_gpu', fallback: 'GPU', sub: 'GPU' },
        { id: 'cpu', labelKey: 'tool_rembg_device_cpu', fallback: 'CPU', sub: 'CPU' }
    ];

    function setButtonState(state, text) {
        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        if (!processBtn) return;

        if (state === 'processing') {
            processBtn.disabled = true;
            processBtn.dataset.state = 'processing';
            if (processLabel) processLabel.textContent = text || t('status_processing') || "Removing Background...";
        } else if (state === 'completed') {
            processBtn.disabled = false;
            processBtn.dataset.state = 'completed';
            if (processLabel) processLabel.textContent = text || t('status_process_another') || "Process Another";
        } else if (state === 'error') {
            processBtn.disabled = false;
            processBtn.dataset.state = 'error';
            if (processLabel) processLabel.textContent = text || t('status_error') || "Processing Failed";
            setTimeout(() => {
                setButtonState('ready');
            }, 3500);
        } else {
            processBtn.disabled = !selectedFile;
            processBtn.dataset.state = selectedFile ? 'ready' : 'idle';
            if (processLabel) processLabel.textContent = text || t('tool_rembg_btn_process') || "Process Media";
        }
    }

    function setProgress(percent, text) {
        const progressSec = document.getElementById('tool-progress-section');
        const progressFill = document.getElementById('tool-progress-fill');
        const progressStatus = document.getElementById('tool-progress-status');
        const progressPercent = document.getElementById('tool-progress-percent');

        if (progressSec) progressSec.classList.remove('hidden');
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressPercent) progressPercent.textContent = percent + '%';
        if (progressStatus && text) progressStatus.textContent = text;

        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-remove-background', {
                isProcessing: percent < 100,
                percent: percent,
                status: text || `${percent}%`,
                file: selectedFile
            });
        }
    }

    function log(msg) {
        const logsEl = document.getElementById('rembg-logs');
        if (logsEl) {
            logsEl.textContent += (logsEl.textContent ? '\n' : '') + msg;
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    }

    function showLogs() {
        const container = document.getElementById('rembg-logs-container');
        if (container) container.classList.remove('hidden');
    }

    async function checkRembgSystemCompatibility() {
        const checkingScreen = document.getElementById('rembg-checking-screen');
        const engineDot = document.getElementById('rembg-engine-dot');
        const engineStatus = document.getElementById('rembg-engine-status');
        const gpuDot = document.getElementById('rembg-gpu-dot');
        const gpuStatus = document.getElementById('rembg-gpu-status');
        const ffmpegDot = document.getElementById('rembg-ffmpeg-dot');
        const ffmpegStatus = document.getElementById('rembg-ffmpeg-status');
        const mainContent = document.getElementById('rembg-main-content');
        const workspaceInner = document.getElementById('rembg-workspace-inner');
        const processBtn = document.getElementById('tool-process-btn');
        if (processBtn) { processBtn.disabled = true; processBtn.dataset.state = 'processing'; }

        if (checkingScreen) checkingScreen.classList.remove('hidden');
        if (mainContent) mainContent.classList.add('hidden');

        if (engineDot) {
            engineDot.textContent = 'sync';
            engineDot.style.color = 'var(--md-sys-color-primary)';
            engineDot.classList.add('upscale-spinner');
        }
        if (engineStatus) engineStatus.textContent = 'AI Model: Checking...';
        if (gpuDot) {
            gpuDot.textContent = 'sync';
            gpuDot.style.color = 'var(--md-sys-color-primary)';
            gpuDot.classList.add('upscale-spinner');
        }
        if (gpuStatus) gpuStatus.textContent = 'Hardware Engine: Checking...';
        if (ffmpegDot) {
            ffmpegDot.textContent = 'sync';
            ffmpegDot.style.color = 'var(--md-sys-color-primary)';
            ffmpegDot.classList.add('upscale-spinner');
        }
        if (ffmpegStatus) ffmpegStatus.textContent = isImageMode ? 'FFmpeg WASM: Ready' : 'FFmpeg WASM: Checking...';

        let hasWebGPU = false;
        if (navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) hasWebGPU = true;
            } catch (e) {}
        }
        isWebGpuSupported = hasWebGPU;

        if (engineDot) {
            engineDot.textContent = 'check_circle';
            engineDot.style.color = '#4CAF50';
            engineDot.classList.remove('upscale-spinner');
        }
        if (engineStatus) engineStatus.textContent = 'AI Model: Ready';

        if (gpuDot) {
            gpuDot.classList.remove('upscale-spinner');
            if (hasWebGPU) {
                gpuDot.textContent = 'check_circle';
                gpuDot.style.color = '#4CAF50';
                if (gpuStatus) gpuStatus.textContent = 'WebGPU: Available';
            } else {
                gpuDot.textContent = 'info';
                gpuDot.style.color = '#FF9800';
                if (gpuStatus) gpuStatus.textContent = 'WebGPU: Not Available';
            }
            const gpuBtn = document.querySelector('#rembg-device-list [data-device="gpu"]');
            if (gpuBtn) {
                if (!hasWebGPU) {
                    gpuBtn.setAttribute('disabled', 'true');
                    gpuBtn.style.opacity = '0.5';
                    gpuBtn.style.pointerEvents = 'none';
                    gpuBtn.title = 'WebGPU not supported in this browser';
                    if (selectedDevice === 'gpu') {
                        selectedDevice = 'cpu';
                        document.querySelectorAll('#rembg-device-list .upscale-preset-btn').forEach(b => b.classList.remove('active'));
                        const cpuBtn = document.querySelector('#rembg-device-list [data-device="cpu"]');
                        if (cpuBtn) cpuBtn.classList.add('active');
                    }
                } else {
                    gpuBtn.removeAttribute('disabled');
                    gpuBtn.style.opacity = '';
                    gpuBtn.style.pointerEvents = '';
                    gpuBtn.removeAttribute('title');
                }
            }
        }

        if (ffmpegDot) {
            ffmpegDot.classList.remove('upscale-spinner');
            if (isImageMode) {
                ffmpegDot.textContent = 'check_circle';
                ffmpegDot.style.color = '#4CAF50';
                if (ffmpegStatus) ffmpegStatus.textContent = 'FFmpeg WASM: Ready';
            } else {
                try {
                    if (window.FFmpegWASM && window.FFmpegUtil) {
                        ffmpegDot.textContent = 'check_circle';
                        ffmpegDot.style.color = '#4CAF50';
                        if (ffmpegStatus) ffmpegStatus.textContent = 'FFmpeg WASM: Ready';
                    } else {
                        ffmpegDot.textContent = 'hourglass_empty';
                        ffmpegDot.style.color = 'var(--md-sys-color-primary)';
                        if (ffmpegStatus) ffmpegStatus.textContent = 'FFmpeg WASM: Will Load on Process';
                        await new Promise(r => setTimeout(r, 300));
                        ffmpegDot.textContent = 'check_circle';
                        ffmpegDot.style.color = '#4CAF50';
                        if (ffmpegStatus) ffmpegStatus.textContent = 'FFmpeg WASM: Ready';
                    }
                } catch (e) {
                    ffmpegDot.textContent = 'error';
                    ffmpegDot.style.color = '#F44336';
                    if (ffmpegStatus) ffmpegStatus.textContent = 'FFmpeg WASM: Unavailable';
                }
            }
        }

        await new Promise(r => setTimeout(r, 600));
        if (checkingScreen) checkingScreen.classList.add('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
        if (workspaceInner) {
            const compContainer = document.getElementById('rembg-comparison-container');
            if (compContainer) updateSliderVisuals();
        }
        const processBtn2 = document.getElementById('tool-process-btn');
        if (processBtn2) { processBtn2.disabled = false; processBtn2.dataset.state = 'ready'; if (document.getElementById('tool-process-label')) document.getElementById('tool-process-label').textContent = t('tool_rembg_btn_process') || 'Process Media'; }
        if (typeof window.updateOpenModalsLayout === 'function') window.updateOpenModalsLayout(true);
    }

    function triggerDownload(blob, filename) {
        const outUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = outUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(outUrl), 3000);
    }

    function updateSliderVisuals() {
        const origClip = document.getElementById('rembg-original-clip');
        const clip = document.getElementById('rembg-canvas-clip');
        const line = document.getElementById('rembg-slider-line');
        if (origClip) {
            if (previewActive) {
                origClip.style.clipPath = `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`;
            } else {
                origClip.style.clipPath = 'none';
            }
        }
        if (clip) {
            clip.style.clipPath = `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`;
        }
        if (line) {
            line.style.left = `${sliderPos}%`;
        }
    }

    function drawOriginalPreview() {
        const canvas = document.getElementById('rembg-preview-canvas');
        const video = document.getElementById('rembg-preview-video');
        const image = document.getElementById('rembg-preview-image');
        if (!canvas) return;
        const source = isImageMode ? image : video;
        if (!source) return;
        const w = source.naturalWidth || source.videoWidth || source.width || 0;
        const h = source.naturalHeight || source.videoHeight || source.height || 0;
        if (!w || !h) return;
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(source, 0, 0);
    }

    function resetResultDisplay() {
        previewActive = false;
        const unprocOverlay = document.getElementById('rembg-unprocessed-overlay');
        if (unprocOverlay) unprocOverlay.classList.add('show');
        const enhVid = document.getElementById('rembg-enhanced-video');
        if (enhVid) {
            enhVid.pause();
            enhVid.classList.add('hidden');
        }
        const prevCanvas = document.getElementById('rembg-preview-canvas');
        if (prevCanvas) prevCanvas.classList.remove('hidden');
        if (enhancedVideoUrl) {
            URL.revokeObjectURL(enhancedVideoUrl);
            enhancedVideoUrl = null;
        }
        lastResultBlob = null;
        lastResultCanvas = null;
        cachedMaskCanvas = null;
        const labelRight = document.getElementById('rembg-slider-label-right');
        if (labelRight) {
            labelRight.textContent = t('upscale_label_original') || 'Original';
            labelRight.setAttribute('data-i18n', 'upscale_label_original');
        }
        updateSliderVisuals();
    }

    function setCompletedLayout(done) {
        const controlsCard = document.getElementById('rembg-controls-card');
        if (controlsCard) controlsCard.classList.toggle('hidden', !!done);
        const logsContainer = document.getElementById('rembg-logs-container');
        if (logsContainer && done) logsContainer.classList.add('hidden');
    }

    function applyTransform() {
        const layers = document.querySelectorAll('#rembg-comparison-container .upscale-transform-layer');
        const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        layers.forEach(el => { el.style.transform = transform; });
    }

    function clampPan() {
        const container = document.getElementById('rembg-comparison-container');
        if (!container) return;
        const maxX = container.offsetWidth * (zoom - 1) / 2;
        const maxY = container.offsetHeight * (zoom - 1) / 2;
        pan.x = Math.max(-maxX, Math.min(maxX, pan.x));
        pan.y = Math.max(-maxY, Math.min(maxY, pan.y));
    }

    function updateZoomBadge() {
        const badge = document.getElementById('rembg-zoom-badge');
        if (badge) {
            if (zoom > 1) {
                badge.textContent = `${zoom.toFixed(1)}x`;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    function setupSliderEvents(container) {
        if (!container) return;

        const updateCursor = () => {
            container.style.cursor = zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'col-resize';
        };

        const onSliderMove = (clientX) => {
            const rect = container.getBoundingClientRect();
            if (rect.width <= 0) return;
            sliderPos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            updateSliderVisuals();
        };

        const isNearSlider = (clientX) => {
            const rect = container.getBoundingClientRect();
            if (rect.width <= 0) return false;
            const sliderX = rect.left + (sliderPos / 100) * rect.width;
            return Math.abs(clientX - sliderX) < 30;
        };

        container.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            if (zoom === 1 || isNearSlider(e.clientX)) {
                isDraggingSlider = true;
                onSliderMove(e.clientX);
                const onMove = (ev) => {
                    if (!isDraggingSlider) return;
                    onSliderMove(ev.clientX);
                };
                const onUp = () => {
                    isDraggingSlider = false;
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
            } else {
                isPanning = true;
                panStart = { x: e.clientX, y: e.clientY };
                panOrigin = { ...pan };
                updateCursor();
                const onMove = (ev) => {
                    if (!isPanning) return;
                    pan.x = panOrigin.x + (ev.clientX - panStart.x);
                    pan.y = panOrigin.y + (ev.clientY - panStart.y);
                    clampPan();
                    applyTransform();
                };
                const onUp = () => {
                    isPanning = false;
                    updateCursor();
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
            }
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            zoom = Math.max(1, Math.min(5, zoom * delta));
            if (zoom <= 1) { zoom = 1; pan = { x: 0, y: 0 }; }
            clampPan();
            applyTransform();
            updateCursor();
            updateZoomBadge();
        }, { passive: false });

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                isPinching = true;
                isDraggingSlider = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDist = Math.hypot(dx, dy);
                pinchStartZoom = zoom;
            } else if (e.touches.length === 1) {
                const tx = e.touches[0].clientX;
                if (zoom === 1 || isNearSlider(tx)) {
                    isDraggingSlider = true;
                    onSliderMove(tx);
                } else {
                    isPanning = true;
                    panStart = { x: tx, y: e.touches[0].clientY };
                    panOrigin = { ...pan };
                }
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isPinching) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                zoom = Math.max(1, Math.min(5, pinchStartZoom * (dist / pinchStartDist)));
                if (zoom <= 1) { zoom = 1; pan = { x: 0, y: 0 }; }
                clampPan();
                applyTransform();
                updateZoomBadge();
            } else if (e.touches.length === 1) {
                if (isPanning) {
                    e.preventDefault();
                    pan.x = panOrigin.x + (e.touches[0].clientX - panStart.x);
                    pan.y = panOrigin.y + (e.touches[0].clientY - panStart.y);
                    clampPan();
                    applyTransform();
                } else if (isDraggingSlider) {
                    e.preventDefault();
                    onSliderMove(e.touches[0].clientX);
                }
            }
        }, { passive: false });

        container.addEventListener('touchend', () => {
            isPinching = false;
            isPanning = false;
            isDraggingSlider = false;
            updateCursor();
        });
    }

    function bindSyncVideos(a, b) {
        if (!a || !b || a._syncBoundWith === b) return;
        a._syncBoundWith = b;
        b._syncBoundWith = a;
        const sync = (from, to) => {
            if (from._syncLock || Math.abs(from.currentTime - to.currentTime) <= 0.18) return;
            from._syncLock = true;
            try { to.currentTime = from.currentTime; } catch (e) {}
            setTimeout(() => { from._syncLock = false; }, 120);
            if (!from.paused && to.paused) to.play().catch(() => {});
        };
        a.addEventListener('timeupdate', () => sync(a, b));
        b.addEventListener('timeupdate', () => sync(b, a));
    }

    function showStaticResult(resultCanvas) {
        const previewCanvas = document.getElementById('rembg-preview-canvas');
        const overlayEl = document.getElementById('rembg-unprocessed-overlay');
        const labelRight = document.getElementById('rembg-slider-label-right');
        if (!previewCanvas || !resultCanvas || !resultCanvas.width) return false;
        previewCanvas.width = resultCanvas.width;
        previewCanvas.height = resultCanvas.height;
        previewCanvas.getContext('2d').drawImage(resultCanvas, 0, 0);
        lastResultCanvas = resultCanvas;
        previewActive = true;
        if (overlayEl) overlayEl.classList.remove('show');
        if (labelRight) {
            labelRight.textContent = t('tool_rembg_label_result') || 'No BG';
            labelRight.setAttribute('data-i18n', 'tool_rembg_label_result');
        }
        updateSliderVisuals();
        return true;
    }

    function showEnhancedVideoInPreview(blob) {
        return new Promise((resolve) => {
            const ev = document.getElementById('rembg-enhanced-video');
            const canvas = document.getElementById('rembg-preview-canvas');
            const overlayEl = document.getElementById('rembg-unprocessed-overlay');
            const labelRight = document.getElementById('rembg-slider-label-right');
            const origVid = document.getElementById('rembg-preview-video');
            if (!ev || !blob) { resolve(false); return; }

            if (enhancedVideoUrl) URL.revokeObjectURL(enhancedVideoUrl);
            enhancedVideoUrl = URL.createObjectURL(blob);
            lastResultBlob = blob;
            ev.src = enhancedVideoUrl;
            ev.classList.remove('hidden');
            if (canvas) canvas.classList.add('hidden');

            if (overlayEl) overlayEl.classList.remove('show');
            if (labelRight) {
                labelRight.textContent = t('tool_rembg_label_result') || 'No BG';
                labelRight.setAttribute('data-i18n', 'tool_rembg_label_result');
            }

            if (origVid) {
                bindSyncVideos(origVid, ev);
                const startSynced = () => {
                    try { ev.currentTime = origVid.currentTime || 0; } catch (e) {}
                    ev.play().catch(() => {});
                };
                if (ev.readyState >= 1) startSynced();
                else ev.addEventListener('loadedmetadata', startSynced, { once: true });
            }
            previewActive = true;
            updateSliderVisuals();
            resolve(true);
        });
    }

    let recurrentStates = null;

    async function getSession(modelId) {
        const cacheKey = `${modelId}__${selectedDevice}`;
        if (sessionCache[cacheKey] && sessionCache[cacheKey].modelId === modelId && sessionCache[cacheKey].device === selectedDevice) return sessionCache[cacheKey].session;
        if (typeof ort === 'undefined' || !ort.InferenceSession) {
            if (typeof window.ensureOnnxRuntime !== 'function') throw new Error('ONNX Runtime failed to load.');
            await window.ensureOnnxRuntime();
        }
        const meta = MODEL_META[modelId];
        log(`[AI] Loading model ${meta.file} [${selectedDevice.toUpperCase()}]...`);
        if (ort.env) try{ ort.env.logLevel = 'error'; }catch(e){}
        if (ort.env && ort.env.wasm) {
            ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4);
            ort.env.wasm.simd = true;
        }

        let session = null;
        let activeEP = 'wasm';
        const resp = await fetch(meta.file);
        if (!resp.ok) throw new Error(`Model file not found: ${meta.file}`);
        const buffer = await resp.arrayBuffer();

        let epList;
        if (selectedDevice === 'cpu') {
            epList = ['wasm'];
        } else {
            epList = meta.type === 'rvm'
                ? ['wasm']
                : [{ name: 'webgpu', powerPreference: 'high-performance' }, 'webgl', 'wasm'];
        }

        for (const ep of epList) {
            try {
                session = await ort.InferenceSession.create(buffer.slice(0), {
                    executionProviders: [ep],
                    graphOptimizationLevel: 'all'
                });
                activeEP = typeof ep === 'string' ? ep : ep.name;
                break;
            } catch (err) {}
        }
        if (!session) {
            session = await ort.InferenceSession.create(buffer.slice(0), { executionProviders: ['wasm'] });
            activeEP = 'wasm';
        }

        recurrentStates = null;
        sessionCache[cacheKey] = { session, modelId, device: selectedDevice };
        log(`[AI] Session ready (${activeEP.toUpperCase()} / ${selectedDevice.toUpperCase()}).`);
        return session;
    }

    function smoothstepAlpha(raw) {
        if (raw <= 0.15) return 0.0;
        if (raw >= 0.70) return 1.0;
        const t = (raw - 0.15) / 0.55;
        return t * t * (3.0 - 2.0 * t);
    }

    async function segmentSource(srcLike) {
        if (!window.ort || !ort.InferenceSession) {
            if (typeof window.ensureOnnxRuntime === 'function') await window.ensureOnnxRuntime();
            if (!window.ort || !ort.InferenceSession) throw new Error('ONNX Runtime failed to load.');
        }
        const session = await getSession(selectedModel);
        const cfg = MODEL_META[selectedModel];

        const srcW = srcLike.videoWidth || srcLike.naturalWidth || srcLike.width;
        const srcH = srcLike.videoHeight || srcLike.naturalHeight || srcLike.height;
        if (!srcW || !srcH) throw new Error('Invalid source dimensions.');

        let inferW = cfg.w;
        let inferH = cfg.h;
        if (cfg.type === 'rvm') {
            inferW = Math.max(256, Math.round(srcW / 64) * 64);
            inferH = Math.max(256, Math.round(srcH / 64) * 64);
        } else if (cfg.type === 'selfie') {
            inferW = 256;
            inferH = 256;
        } else if (cfg.type === 'modnet') {
            inferW = 512;
            inferH = 512;
        }

        const inputCanvas = document.createElement('canvas');
        inputCanvas.width = inferW;
        inputCanvas.height = inferH;
        const ictx = inputCanvas.getContext('2d', { willReadFrequently: true });
        ictx.imageSmoothingEnabled = true;
        ictx.imageSmoothingQuality = 'high';
        ictx.drawImage(srcLike, 0, 0, inferW, inferH);
        const data = ictx.getImageData(0, 0, inferW, inferH).data;

        const totalPixels = inferW * inferH;
        const floatData = new Float32Array(3 * totalPixels);

        if (cfg.type === 'modnet') {
            const inv127 = 1.0 / 127.5;
            for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                floatData[i] = data[p] * inv127 - 1.0;
                floatData[totalPixels + i] = data[p + 1] * inv127 - 1.0;
                floatData[2 * totalPixels + i] = data[p + 2] * inv127 - 1.0;
            }
        } else {
            const inv255 = 1.0 / 255.0;
            for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                floatData[i] = data[p] * inv255;
                floatData[totalPixels + i] = data[p + 1] * inv255;
                floatData[2 * totalPixels + i] = data[p + 2] * inv255;
            }
        }

        const inputTensor = new ort.Tensor('float32', floatData, [1, 3, inferH, inferW]);
        const feeds = {};

        if (cfg.type === 'rvm') {
            feeds['src'] = inputTensor;
            if (!recurrentStates) {
                recurrentStates = {
                    r1: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
                    r2: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
                    r3: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
                    r4: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1])
                };
            }
            feeds['r1i'] = recurrentStates.r1;
            feeds['r2i'] = recurrentStates.r2;
            feeds['r3i'] = recurrentStates.r3;
            feeds['r4i'] = recurrentStates.r4;
            feeds['downsample_ratio'] = new ort.Tensor('float32', new Float32Array([0.25]), [1]);
        } else {
            feeds[session.inputNames[0]] = inputTensor;
        }

        const results = await session.run(feeds);
        let alphaData = null;
        let maskW = inferW;
        let maskH = inferH;

        if (cfg.type === 'rvm') {
            const phaKey = Object.keys(results).find(k => k.toLowerCase().includes('pha')) || 'pha';
            const phaTensor = results[phaKey];
            const rawPha = phaTensor.data;
            maskW = phaTensor.dims[3] || inferW;
            maskH = phaTensor.dims[2] || inferH;
            alphaData = rawPha.subarray(0, maskW * maskH);
            if (results['r1o']) {
                recurrentStates = {
                    r1: results['r1o'],
                    r2: results['r2o'],
                    r3: results['r3o'],
                    r4: results['r4o']
                };
            }
        } else if (cfg.type === 'modnet') {
            const outKey = session.outputNames[0];
            const rawData = results[outKey].data;
            maskW = inferW;
            maskH = inferH;
            alphaData = new Float32Array(maskW * maskH);
            for (let i = 0; i < alphaData.length; i++) {
                alphaData[i] = smoothstepAlpha(rawData[i]);
            }
        } else {
            const outKey = session.outputNames[0];
            const outTensor = results[outKey];
            const rawData = outTensor.data;
            maskW = outTensor.dims[outTensor.dims.length - 1] || inferW;
            maskH = outTensor.dims[outTensor.dims.length - 2] || inferH;
            const area = maskW * maskH;
            alphaData = new Float32Array(area);
            if (outTensor.dims[1] === 2) {
                for (let i = 0; i < area; i++) {
                    alphaData[i] = smoothstepAlpha(1.0 / (1.0 + Math.exp(rawData[i] - rawData[area + i])));
                }
            } else {
                for (let i = 0; i < area; i++) {
                    alphaData[i] = smoothstepAlpha(rawData[i]);
                }
            }
        }

        const c = document.createElement('canvas');
        c.width = maskW;
        c.height = maskH;
        const ctx = c.getContext('2d');
        const imgData = ctx.createImageData(maskW, maskH);
        for (let i = 0; i < maskW * maskH; i++) {
            const v = Math.max(0, Math.min(255, Math.round(alphaData[i] * 255)));
            imgData.data[i * 4] = 255;
            imgData.data[i * 4 + 1] = 255;
            imgData.data[i * 4 + 2] = 255;
            imgData.data[i * 4 + 3] = v;
        }
        ctx.putImageData(imgData, 0, 0);
        return c;
    }

    function compositeWithMask(srcLike, maskCanvas, W, H) {
        const maskFull = document.createElement('canvas');
        maskFull.width = W;
        maskFull.height = H;
        const mx = maskFull.getContext('2d');
        mx.imageSmoothingEnabled = true;
        mx.imageSmoothingQuality = 'high';
        mx.drawImage(maskCanvas, 0, 0, W, H);

        const fg = document.createElement('canvas');
        fg.width = W;
        fg.height = H;
        const fx = fg.getContext('2d');
        fx.drawImage(srcLike, 0, 0, W, H);
        fx.globalCompositeOperation = 'destination-in';
        fx.drawImage(maskFull, 0, 0);

        const out = document.createElement('canvas');
        out.width = W;
        out.height = H;
        const ox = out.getContext('2d');
        if (selectedBg === 'green') {
            ox.fillStyle = '#00FF00';
            ox.fillRect(0, 0, W, H);
        } else if (selectedBg === 'color') {
            ox.fillStyle = customColor || '#0842a0';
            ox.fillRect(0, 0, W, H);
        } else if (selectedBg === 'blur') {
            ox.filter = 'blur(16px)';
            ox.drawImage(srcLike, 0, 0, W, H);
            ox.filter = 'none';
        }
        ox.drawImage(fg, 0, 0);
        return out;
    }

    async function loadImageEl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to decode image.'));
            img.src = url;
        });
    }

    function ensureVideoSeek(vid, target) {
        return new Promise((resolve) => {
            if (Math.abs((vid.currentTime || 0) - target) <= 0.03) { resolve(); return; }
            const done = () => resolve();
            vid.addEventListener('seeked', done, { once: true });
            try { vid.currentTime = target; } catch (e) { done(); }
            setTimeout(done, 2000);
        });
    }

    async function previewRemoveBackground() {
        if (isGeneratingPreview || isProcessing || !selectedFile) return;
        isGeneratingPreview = true;

        const controls = document.querySelectorAll('#rembg-workspace-inner button, #rembg-workspace-inner input');
        controls.forEach(el => { el.disabled = true; });
        setButtonState('processing', t('upscale_preview_generating') || 'Generating Preview...');
        showLogs();

        try {
            let srcLike;
            let W = 0;
            let H = 0;

            if (isImageMode) {
                const imgEl = document.getElementById('rembg-preview-image');
                if (cachedOrigImage) {
                    srcLike = cachedOrigImage;
                } else {
                    const url = URL.createObjectURL(selectedFile);
                    srcLike = await loadImageEl(url);
                    URL.revokeObjectURL(url);
                    cachedOrigImage = srcLike;
                }
                W = srcLike.naturalWidth;
                H = srcLike.naturalHeight;
            } else {
                const vid = document.getElementById('rembg-preview-video');
                vid.pause();
                if (vid.readyState < 2) {
                    await new Promise(resolve => {
                        const check = () => {
                            if (vid.readyState >= 2) resolve();
                            else setTimeout(check, 50);
                        };
                        check();
                    });
                }
                const durSlider = document.getElementById('rembg-duration-slider');
                const wantT = durSlider && !durSlider.disabled ? (parseFloat(durSlider.value) || 0) : (vid.currentTime || 0);
                await ensureVideoSeek(vid, wantT);
                srcLike = vid;
                W = vid.videoWidth;
                H = vid.videoHeight;
                log(`[RemBG] Frame captured @ ${vid.currentTime.toFixed(2)}s`);
            }

            setProgress(35, t('status_processing') || 'Running segmentation...');
            log(`[RemBG Preview] Segmenting ${W}x${H} frame (${selectedModel} / ${selectedDevice.toUpperCase()})...`);
            const mask = cachedMaskCanvas && lastMaskModel === selectedModel && lastMaskDevice === selectedDevice
                ? cachedMaskCanvas
                : await segmentSource(srcLike);
            cachedMaskCanvas = mask;
            lastMaskModel = selectedModel;
            lastMaskDevice = selectedDevice;
            cachedOrigImage = isImageMode ? srcLike : cachedOrigImage;
            log(`[RemBG] Mask generated: ${mask.width}x${mask.height}`);

            setProgress(80, t('status_processing') || 'Compositing background...');
            const outCanvas = compositeWithMask(srcLike, mask, W, H);

            showStaticResult(outCanvas);
            setProgress(100, t('status_completed') || 'Done!');
            setTimeout(() => {
                const progressSec = document.getElementById('tool-progress-section');
                if (progressSec) progressSec.classList.add('hidden');
            }, 600);

            if (!isImageMode) setButtonState('ready', t('tool_rembg_btn_process') || 'Process Media');

            if (typeof window.showToast === 'function') {
                window.showToast(t('upscale_preview_done') || 'Preview ready!');
            }

        } catch (err) {
            console.error('[Remove Background] Preview error:', err);
            log(`[RemBG Error] ${err.message || err}`);
            resetResultDisplay();
            drawOriginalPreview();
            setButtonState('error', err.message || 'Preview failed');
        } finally {
            isGeneratingPreview = false;
            controls.forEach(el => { el.disabled = false; });
            const progressSec = document.getElementById('tool-progress-section');
            if (progressSec && !isProcessing) progressSec.classList.add('hidden');
        }
    }

    function renderWorkspace(file) {
        const optContainer = document.getElementById('tool-dynamic-options');
        if (!optContainer) return;

        isImageMode = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
        if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = URL.createObjectURL(file);
        const mediaUrl = currentObjectUrl;
        zoom = 1;
        pan = { x: 0, y: 0 };

        optContainer.innerHTML = `
            <div class="rembg-workspace" id="rembg-workspace-inner">
                <div id="rembg-checking-screen" class="system-checking-card">
                    <h3 class="system-checking-title" data-i18n="system_checking_title">${t('system_checking_title') || 'Checking System Compatibility...'}</h3>
                    <div class="system-checking-list">
                        <div class="system-checking-item">
                            <span id="rembg-engine-dot" class="material-symbols-rounded" style="font-size:20px;">hourglass_empty</span>
                            <span id="rembg-engine-status">AI Model: Checking...</span>
                        </div>
                        <div class="system-checking-item">
                            <span id="rembg-gpu-dot" class="material-symbols-rounded" style="font-size:20px;">hourglass_empty</span>
                            <span id="rembg-gpu-status">Hardware Engine: Checking...</span>
                        </div>
                        <div class="system-checking-item">
                            <span id="rembg-ffmpeg-dot" class="material-symbols-rounded" style="font-size:20px;">hourglass_empty</span>
                            <span id="rembg-ffmpeg-status">FFmpeg WASM: Checking...</span>
                        </div>
                    </div>
                </div>
                <div id="rembg-main-content" class="hidden">
                <div class="upscale-comparison-container checkerboard" id="rembg-comparison-container">
                    <div class="upscale-comparison-wrapper">
                        <div class="upscale-original-clip" id="rembg-original-clip">
                            <div class="upscale-transform-layer">
                                <video id="rembg-preview-video" class="${isImageMode ? 'hidden' : ''}" src="${mediaUrl}" playsinline muted loop preload="auto" draggable="false"></video>
                                <img id="rembg-preview-image" class="${isImageMode ? '' : 'hidden'}" src="${mediaUrl}" alt="Original" draggable="false" ondragstart="return false;">
                            </div>
                        </div>
                        <div class="upscale-canvas-clip" id="rembg-canvas-clip">
                            <div class="upscale-transform-layer">
                                <video id="rembg-enhanced-video" class="hidden" muted loop playsinline></video>
                                <canvas id="rembg-preview-canvas"></canvas>
                            </div>
                            <div class="upscale-unprocessed-overlay show" id="rembg-unprocessed-overlay">
                                <div class="unprocessed-title" data-i18n="upscale_unprocessed_title">${t('upscale_unprocessed_title') || 'Unprocessed'}</div>
                                <div class="unprocessed-subtitle" data-i18n="upscale_unprocessed_desc">${t('upscale_unprocessed_desc') || 'Press preview to view the processed file'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="upscale-slider-line" id="rembg-slider-line">
                        <div class="upscale-slider-handle">&#9664; &#9654;</div>
                    </div>
                    <div class="upscale-slider-label left" data-i18n="upscale_label_original">${t('upscale_label_original') || 'Original'}</div>
                    <div class="upscale-slider-label right" id="rembg-slider-label-right" data-i18n="tool_rembg_label_result">${t('tool_rembg_label_result') || 'No BG'}</div>
                    <div class="upscale-zoom-badge hidden" id="rembg-zoom-badge">1.0x</div>
                </div>

                <div class="upscale-action-row" id="rembg-action-row">
                    <button type="button" class="upscale-action-btn" id="rembg-preview-toggle">
                        <span class="material-symbols-rounded">visibility</span>
                        <span data-i18n="btn_preview">${t('btn_preview') || 'Preview'}</span>
                    </button>
                </div>

                <div class="upscale-duration-row ${isImageMode ? 'hidden' : ''}" id="rembg-duration-row">
                    <span class="material-symbols-rounded">schedule</span>
                    <input type="range" id="rembg-duration-slider" min="0" max="0" step="0.05" value="0" disabled>
                    <span class="upscale-duration-label" id="rembg-duration-label">00:00.0</span>
                </div>

                <div class="upscale-controls-card" id="rembg-controls-card">
                    <p class="upscale-controls-title" data-i18n="tool_rembg_model_title">${t('tool_rembg_model_title') || 'AI Model'}</p>
                    <div class="upscale-preset-list" id="rembg-model-list">
                        ${MODELS.map(m => `
                            <button type="button" class="upscale-preset-btn ${m.id === selectedModel ? 'active' : ''}" data-model="${m.id}">
                                ${m.label}
                            </button>
                        `).join('')}
                    </div>

                    <p class="upscale-controls-title mt-4" data-i18n="tool_rembg_device_title">${t('tool_rembg_device_title') || 'Device'}</p>
                    <div class="upscale-preset-list" id="rembg-device-list">
                        ${DEVICE_OPTIONS.map(opt => `
                            <button type="button" class="upscale-preset-btn ${opt.id === selectedDevice ? 'active' : ''}" data-device="${opt.id}" data-i18n="${opt.labelKey}">
                                ${t(opt.labelKey) || opt.fallback}
                            </button>
                        `).join('')}
                    </div>

                    <p class="upscale-controls-title mt-4" data-i18n="tool_rembg_bg_title">${t('tool_rembg_bg_title') || 'Background'}</p>
                    <div class="upscale-preset-list" id="rembg-bg-list">
                        ${BG_OPTIONS.map(opt => `
                            <button type="button" class="upscale-preset-btn ${opt.id === selectedBg ? 'active' : ''}" data-bg="${opt.id}" data-i18n="${opt.labelKey}">
                                ${t(opt.labelKey) || opt.fallback}
                            </button>
                        `).join('')}
                    </div>

                    <div id="rembg-color-picker-row" class="rembg-color-picker-row ${selectedBg === 'color' ? '' : 'hidden'} mt-4">
                        <div class="flex align-center gap-10 w-full">
                            <input type="color" id="rembg-color-input" value="${customColor}" class="rembg-color-box">
                            <input type="text" id="rembg-color-text" value="${customColor}" class="rembg-color-text font-mono">
                        </div>
                    </div>
                </div>
                </div>
                <div class="process-logs-wrap" id="rembg-logs-container">
                    <div class="process-logs-header">
                        <span class="process-logs-title">${t('upscale_logs_title') || 'Process Logs'}</span>
                        <button type="button" class="btn-copy-logs" id="btn-copy-rembg-logs">
                            <span class="material-symbols-rounded">content_copy</span>
                            <span>${t('res_modal_copy') || 'Copy'}</span>
                        </button>
                    </div>
                    <pre class="process-logs-pre" id="rembg-logs"></pre>
                </div>
            </div>
        `;

        const compContainer = document.getElementById('rembg-comparison-container');
        setupSliderEvents(compContainer);
        updateSliderVisuals();
        checkRembgSystemCompatibility();

        const previewImg = document.getElementById('rembg-preview-image');
        const previewVid = document.getElementById('rembg-preview-video');

        if (isImageMode && previewImg) {
            previewImg.onload = () => drawOriginalPreview();
            if (previewImg.complete) drawOriginalPreview();
        } else if (previewVid) {
            const durSlider = document.getElementById('rembg-duration-slider');
            const durLabel = document.getElementById('rembg-duration-label');
            const fmtTime = (s) => {
                const m = Math.floor(s / 60);
                return String(m).padStart(2, '0') + ':' + (s - m * 60).toFixed(1).padStart(4, '0');
            };
            previewVid.onloadedmetadata = () => {
                if (durSlider && isFinite(previewVid.duration)) {
                    durSlider.max = previewVid.duration || 0;
                    durSlider.disabled = false;
                    durSlider.value = 0;
                    if (durLabel) durLabel.textContent = fmtTime(0);
                }
            };
            previewVid.onloadeddata = () => { if (!previewActive) drawOriginalPreview(); };
            previewVid.ontimeupdate = () => {
                if (!previewActive && !isGeneratingPreview && durLabel) {
                    durLabel.textContent = fmtTime(previewVid.currentTime || 0);
                }
            };
            if (durSlider) {
                durSlider.addEventListener('input', () => {
                    const v = parseFloat(durSlider.value) || 0;
                    try { previewVid.currentTime = v; } catch (e) {}
                    if (durLabel) durLabel.textContent = fmtTime(v);
                    if (previewActive || lastResultBlob || lastResultCanvas) {
                        resetResultDisplay();
                        drawOriginalPreview();
                        log(`[RemBG] Frame position -> ${fmtTime(v)}. Result cleared.`);
                    }
                });
            }
        }

        const previewToggle = document.getElementById('rembg-preview-toggle');
        if (previewToggle) {
            previewToggle.addEventListener('click', () => previewRemoveBackground());
        }

        const copyLogsBtn = document.getElementById('btn-copy-rembg-logs');
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => {
                const logsEl = document.getElementById('rembg-logs');
                if (logsEl && logsEl.textContent) {
                    navigator.clipboard.writeText(logsEl.textContent);
                    if (typeof window.showToast === 'function') {
                        window.showToast(t('btn_copied') || 'Copied!');
                    }
                }
            });
        }

        const modelList = document.getElementById('rembg-model-list');
        if (modelList) {
            modelList.querySelectorAll('.upscale-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    modelList.querySelectorAll('.upscale-preset-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const newModel = btn.getAttribute('data-model') || 'selfie_segmenter';
                    if (newModel !== selectedModel) {
                        selectedModel = newModel;
                        cachedMaskCanvas = null;
                        if (previewActive || lastResultBlob) {
                            resetResultDisplay();
                            drawOriginalPreview();
                        }
                    }
                });
            });
        }

        const deviceList = document.getElementById('rembg-device-list');
        if (deviceList) {
            deviceList.querySelectorAll('.upscale-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    deviceList.querySelectorAll('.upscale-preset-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const newDevice = btn.getAttribute('data-device') || 'gpu';
                    if (newDevice !== selectedDevice) {
                        selectedDevice = newDevice;
                        cachedMaskCanvas = null;
                        if (previewActive || lastResultBlob) {
                            resetResultDisplay();
                            drawOriginalPreview();
                            log(`[RemBG] Device switched to ${selectedDevice.toUpperCase()}. Preview cleared.`);
                        } else {
                            log(`[RemBG] Device set to ${selectedDevice.toUpperCase()}.`);
                        }
                    }
                });
            });
        }

        const bgList = document.getElementById('rembg-bg-list');
        const colorPickerRow = document.getElementById('rembg-color-picker-row');
        const colorInput = document.getElementById('rembg-color-input');
        const colorText = document.getElementById('rembg-color-text');

        if (bgList) {
            bgList.querySelectorAll('.upscale-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    bgList.querySelectorAll('.upscale-preset-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedBg = btn.getAttribute('data-bg') || 'transparent';

                    if (colorPickerRow) {
                        if (selectedBg === 'color') colorPickerRow.classList.remove('hidden');
                        else colorPickerRow.classList.add('hidden');
                    }
                    recomposeIfPossible();
                    if (typeof window.updateOpenModalsLayout === 'function') window.updateOpenModalsLayout(true);
                });
            });
        }

        if (colorInput && colorText) {
            colorInput.addEventListener('input', () => {
                customColor = colorInput.value;
                colorText.value = customColor;
                if (selectedBg === 'color') recomposeIfPossible();
            });
            colorText.addEventListener('input', () => {
                customColor = colorText.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
                    colorInput.value = customColor;
                    if (selectedBg === 'color') recomposeIfPossible();
                }
            });
        }

        if (typeof window.translateUI === 'function') {
            window.translateUI();
        }
        if (typeof window.updateOpenModalsLayout === 'function') {
            window.updateOpenModalsLayout(true);
        }
    }

    function recomposeIfPossible() {
        if (!cachedOrigImage || !cachedMaskCanvas || !previewActive) return;
        if (lastResultBlob) return;
        const out = compositeWithMask(cachedOrigImage, cachedMaskCanvas, cachedOrigImage.naturalWidth, cachedOrigImage.naturalHeight);
        showStaticResult(out);
    }

    async function removeBackgroundImage(file) {
        showLogs();
        log(`[RemBG] Source: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        log(`[RemBG] Model: ${selectedModel} | Device: ${selectedDevice.toUpperCase()} | Background: ${selectedBg}`);

        setProgress(15, t('status_loading_engine') || 'Loading AI model...');
        const imgUrl = URL.createObjectURL(file);
        const img = await loadImageEl(imgUrl);
        URL.revokeObjectURL(imgUrl);
        log(`[RemBG] Image loaded: ${img.naturalWidth}x${img.naturalHeight}`);
        cachedOrigImage = img;

        setProgress(40, t('status_processing') || 'Running segmentation...');
        const mask = await segmentSource(img);
        cachedMaskCanvas = mask;
        lastMaskModel = selectedModel;
        lastMaskDevice = selectedDevice;
        log(`[RemBG] Mask generated: ${mask.width}x${mask.height}`);

        setProgress(80, t('status_processing') || 'Compositing background...');
        const outCanvas = compositeWithMask(img, mask, img.naturalWidth, img.naturalHeight);

        setProgress(92, t('status_finalizing') || 'Generating PNG...');
        const blob = await new Promise(r => outCanvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('Failed to encode output image.');

        showStaticResult(outCanvas);
        setCompletedLayout(true);

        triggerDownload(blob, file.name.replace(/\.[^/.]+$/, '') + `_nobg.png`);
        log(`[RemBG] Saved: ${file.name.replace(/\.[^/.]+$/, '')}_nobg.png (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);

        setProgress(100, t('status_completed') || 'Done!');
        setButtonState('completed', t('status_process_another') || 'Process Another');
    }

    async function removeBackgroundVideo(file) {
        showLogs();
        log(`[RemBG] Video source: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) | Chroma-key matting`);

        setButtonState('processing', t('status_processing') || 'Processing video...');
        setProgress(20, t('status_loading_engine') || 'Loading FFmpeg core (~31 MB, first time only)...');
        log('[RemBG] Loading FFmpeg libraries...');
        const loadScript = (src) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
        try {
            if (!window.FFmpegUtil) {
                try { await loadScript('assets/ffmpeg/index.js'); } catch (e) {
                    await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
                }
            }
            if (!window.FFmpegWASM) {
                try { await loadScript('assets/ffmpeg/ffmpeg.js'); } catch (e) {
                    await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
                }
            }
        } catch (err) {
            throw new Error('FFmpeg library failed to load.');
        }
        if (!window.FFmpegWASM || !window.FFmpegUtil) {
            throw new Error('FFmpeg library failed to load.');
        }

        const { FFmpeg } = window.FFmpegWASM;
        const { fetchFile, toBlobURL } = window.FFmpegUtil;
        const errMsg = (e) => {
            if (!e) return 'unknown error';
            if (e instanceof Error && e.message) return e.message;
            if (typeof e === 'string') return e;
            try { return JSON.stringify(e); } catch (_) { return String(e); }
        };

        let localBaseURL = window.location.origin + '/assets/ffmpeg';
        try {
            localBaseURL = new URL('assets/ffmpeg', window.location.href).href.replace(/\/$/, '');
        } catch (_) {}
        const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
        const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) || 
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        const isMultiThread = !isMobileDevice && typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated === true;

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

        const attempts = [];
        if (isMultiThread) {
            attempts.push({ label: 'local assets (MT)', base: localBaseURL, core: 'ffmpeg-core', mt: true, timeout: 15000 });
            attempts.push({ label: 'CDN (MT)', base: cdnBaseMT, core: 'ffmpeg-core', mt: true, timeout: 30000 });
        }
        attempts.push({ label: 'local assets (ST)', base: localBaseURL, core: 'ffmpeg-core-st', mt: false, timeout: 20000 });
        attempts.push({ label: 'CDN (ST)', base: cdnBaseST, core: 'ffmpeg-core', mt: false, timeout: 35000 });

        let ffmpeg = null;
        for (const attempt of attempts) {
            let inst = null;
            try {
                const config = {
                    coreURL: await withTimeout(toBlobURL(`${attempt.base}/${attempt.core}.js`, 'text/javascript'), attempt.timeout, `${attempt.label} core download`),
                    wasmURL: await withTimeout(toBlobURL(`${attempt.base}/${attempt.core}.wasm`, 'application/wasm'), attempt.timeout, `${attempt.label} wasm download`)
                };
                if (attempt.mt) {
                    config.workerURL = await withTimeout(toBlobURL(`${attempt.base}/ffmpeg-core.worker.js`, 'text/javascript'), attempt.timeout, `${attempt.label} worker download`);
                }
                inst = new FFmpeg();
                await withTimeout(inst.load(config), attempt.timeout, `${attempt.label} engine init`);
                ffmpeg = inst;
                break;
            } catch (err) {
                if (inst) {
                    try { inst.terminate(); } catch (_) {}
                }
                console.warn(`[RemBG] ${attempt.label} failed:`, errMsg(err));
            }
        }

        if (!ffmpeg) {
            throw new Error('Failed to load FFmpeg WASM engine.');
        }

        let oomDetected = false;
        ffmpeg.on('progress', ({ progress }) => {
            const p = Math.max(0, Math.min(100, Math.round(progress * 100)));
            const mappedPercent = 30 + Math.round(progress * 65);
            setProgress(mappedPercent, `${t('status_encoding') || 'Rendering video output...'} (${p}%)`);
        });

        let lastLoggedSec = 0;
        ffmpeg.on('log', ({ message }) => {
            const lc = message.toLowerCase();
            if (lc.includes('oom') || lc.includes('out of memory')) {
                oomDetected = true;
            }
            if (message.includes('frame=') || message.includes('fps=')) {
                const now = Date.now();
                if (now - lastLoggedSec > 1500) {
                    lastLoggedSec = now;
                    log(`[RemBG FFmpeg] ${message.trim()}`);
                }
            } else if (message.includes('Error') || message.includes('error:') || message.includes('warning:')) {
                log(`[RemBG FFmpeg] ${message.trim()}`);
            }
        });

        const ext = file.name.split('.').pop() || 'mp4';
        const inName = `input.${ext}`;
        log(`[RemBG] Loading video into memory...`);
        await ffmpeg.writeFile(inName, await fetchFile(file));

        let col = '0x00FF00';
        if (selectedBg === 'color' && customColor) {
            col = '0x' + customColor.replace('#', '');
        }

        setProgress(30, t('status_encoding') || 'Rendering video output...');
        log(`[RemBG] Key color: ${col}`);

        const fileMB = file.size / (1024 * 1024);
        const hardwareThreads = navigator.hardwareConcurrency || 4;
        const threads = (fileMB > 50) ? '2' : Math.min(4, hardwareThreads).toString();

        log(`[RemBG] Processing with ${threads} thread(s) and ultrafast preset...`);

        await ffmpeg.exec([
            '-i', inName,
            '-threads', threads,
            '-vf', `chromakey=${col}:0.12:0.08,colorkey=0x00FF00:0.1:0.05`,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'copy',
            'matting.mp4'
        ]);

        if (oomDetected) {
            throw new Error('Out of memory detected during video processing. Try a smaller video or lower resolution.');
        }

        setProgress(95, t('status_finalizing') || 'Finalizing video...');
        const data = await ffmpeg.readFile('matting.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });

        try {
            await ffmpeg.deleteFile(inName);
            await ffmpeg.deleteFile('matting.mp4');
        } catch (_) {}

        triggerDownload(blob, file.name.replace(/\.[^/.]+$/, '') + `_matting.mp4`);
        log(`[RemBG] Saved: ${file.name.replace(/\.[^/.]+$/, '')}_matting.mp4 (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);

        try {
            await showEnhancedVideoInPreview(blob);
            log('[RemBG] Synced original/result preview active.');
        } catch (pvErr) {
            console.warn('[Remove Background] Preview playback skipped:', pvErr);
        }

        setCompletedLayout(true);
        setProgress(100, t('status_completed') || 'Done!');
        setButtonState('completed', t('status_process_another') || 'Process Another');
    }

    async function removeBackground(file) {
        if (isProcessing || !file) return;
        isProcessing = true;

        setButtonState('processing', t('status_processing') || 'Initializing AI Matting...');
        setProgress(10, t('status_initializing') || 'Initializing...');

        try {
            const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
            if (isImg) {
                await removeBackgroundImage(file);
            } else {
                await removeBackgroundVideo(file);
            }

            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-remove-background', {
                    isProcessing: false,
                    completed: true,
                    percent: 100,
                    status: 'Complete',
                    file
                });
            }

            if (typeof window.showToast === 'function') {
                window.showToast(t('status_completed_toast') || 'Background removed successfully!');
            }

        } catch (err) {
            console.error('[Remove Background] Error:', err);
            log(`[RemBG Error] ${err.message || err}`);
            setButtonState('error', err.message || 'Processing failed');
            if (window.ToolProgressManager) {
                window.ToolProgressManager.clear('tool-remove-background');
            }
        } finally {
            isProcessing = false;
        }
    }

    const toolDefinition = {
        id: 'tool-remove-background',
        _id: 'tool-remove-background',
        title: 'Remove Background',
        titleKey: 'tool_rembg_title',
        desc: 'AI Matting',
        descKey: 'tool_rembg_desc',
        dropKey: 'tool_rembg_drop',
        icon: 'person_remove',
        category: 'Tools',
        hideDropOnUpload: true,
        features: [
            'AI Neural Segmentation (RVM & Selfie Matting)',
            'Transparent, Green Screen & Custom Color Replacement',
            'CPU / GPU Device Selection (WASM / WebGPU)',
            'Supports Image (PNG/JPG) & Video (MP4/WebM)',
            '100% Client-side Browser Execution'
        ],
        specs: [
            { label: 'MODELS', value: 'RVM, MODNet & Selfie Segmenter' },
            { label: 'ENGINE', value: 'ONNX WebGPU & WASM' },
            { label: 'DEVICE', value: 'CPU / GPU Selectable' },
            { label: 'PROCESSING', value: '100% Local Inference' }
        ],
        initModal: function(ctx) {
            const { optContainer } = ctx;
            if (optContainer) optContainer.innerHTML = '';
            selectedFile = null;
            lastResultCanvas = null;
            lastResultBlob = null;
            previewActive = false;
            cachedOrigImage = null;
            cachedMaskCanvas = null;
            if (enhancedVideoUrl) {
                URL.revokeObjectURL(enhancedVideoUrl);
                enhancedVideoUrl = null;
            }
        },
        onFileSelect: function(file) {
            selectedFile = file;
            renderWorkspace(file);
            setButtonState('processing', t('system_checking_title') || 'Checking System Compatibility...');
        },
        onProcess: function(file) {
            removeBackground(file || selectedFile);
        },
        onReset: function() {
            selectedFile = null;
            isProcessing = false;
            selectedBg = 'transparent';
            lastResultCanvas = null;
            lastResultBlob = null;
            previewActive = false;
            cachedOrigImage = null;
            cachedMaskCanvas = null;
            if (enhancedVideoUrl) {
                URL.revokeObjectURL(enhancedVideoUrl);
                enhancedVideoUrl = null;
            }
            const optContainer = document.getElementById('tool-dynamic-options');
            if (optContainer) optContainer.innerHTML = '';
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

    window.RemoveBackgroundTool = toolDefinition;
})();
