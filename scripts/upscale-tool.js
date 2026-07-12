document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('upscale-video-card');
    if (!card) return;

    const dropArea = document.getElementById('upscale-drop-area');
    const fileInput = document.getElementById('upscale-file-input');
    const workspace = document.getElementById('upscale-workspace');
    const video = document.getElementById('upscale-video');
    const imageEl = document.getElementById('upscale-image');
    const canvas = document.getElementById('upscale-canvas');
    const comparisonContainer = document.getElementById('upscale-comparison-container');
    const canvasClip = document.getElementById('upscale-canvas-clip');
    const sliderLine = document.getElementById('upscale-slider-line');
    const sliderLabelRight = document.getElementById('upscale-slider-label-right');
    const zoomBadge = document.getElementById('upscale-zoom-badge');
    const timeline = document.getElementById('upscale-timeline');
    const timeCurrent = document.getElementById('upscale-time-current');
    const timeDuration = document.getElementById('upscale-time-duration');
    const durationContainer = document.getElementById('upscale-duration-container');
    const btnPreview = document.getElementById('upscale-btn-preview');
    const btnEnhance = document.getElementById('upscale-btn-enhance');
    const btnZoom = document.getElementById('upscale-btn-zoom');
    const btnReset = document.getElementById('upscale-btn-reset');
    const btnCancel = document.getElementById('upscale-btn-cancel');
    const btnDownload = document.getElementById('upscale-btn-download');
    const progressContainer = document.getElementById('upscale-progress-container');
    const progressFill = document.getElementById('upscale-progress-fill');
    const progressText = document.getElementById('upscale-progress-text');
    const progressPercent = document.getElementById('upscale-progress-percent');
    const logsContainer = document.getElementById('upscale-logs-container');
    const logsEl = document.getElementById('upscale-logs');
    const completedPanel = document.getElementById('upscale-completed-panel');
    const completedVideo = document.getElementById('upscale-completed-video');
    const completedImage = document.getElementById('upscale-completed-image');
    const checkingScreen = document.getElementById('upscale-checking-screen');
    const engineStatus = document.getElementById('upscale-engine-status');
    const engineDot = document.getElementById('upscale-engine-dot');
    const gpuStatus = document.getElementById('upscale-gpu-status');
    const gpuDot = document.getElementById('upscale-gpu-dot');
    const webcodecsStatus = document.getElementById('upscale-webcodecs-status');
    const webcodecsDot = document.getElementById('upscale-webcodecs-dot');
    const presetList = document.getElementById('upscale-preset-list');
    const unprocessedOverlay = document.getElementById('upscale-unprocessed-overlay');
    const normaliseToggle = document.getElementById('upscale-normalise-toggle');

    const PRESETS = [
        { id: 'cartoonist', name: 'Cartoonist', sharpen: 14, unsharpAmount: 107, unsharpRadius: 5.1, denoise: 2.9, shadows: 2, saturation: 1 },
        { id: 'cartoonist2', name: 'Cartoonist 2', sharpen: 20, unsharpAmount: 120, unsharpRadius: 10, denoise: 2, shadows: 4, saturation: 1.3 },
        { id: 'humanDetail', name: 'Human Detail', sharpen: 100, denoise: 1.2 },
        { id: 'smoothFace', name: 'Smooth Face', sharpen: 26, unsharpRadius: 4.5 },
        { id: 'idgaf', name: 'IDGAF', sharpen: 100 },
        { id: 'none', name: 'No Filter' }
    ];

    const DEFAULT_PARAMS = {
        sharpen: 0, unsharpAmount: 0, unsharpRadius: 1.0,
        brightness: 0, contrast: 0, shadows: 0, hue: 0, saturation: 0, denoise: 0
    };

    const TFJS_PARAMS = { model: 'anime_fast', factor: 4, tile_size: 128, min_lap: 0, backend: 'webgl' };

    let appState = 'import';
    let isImageMode = false;
    let videoSrc = null;
    let imageSrc = null;
    let renderedVideoSrc = null;
    let activePreset = 'none';
    let enhanceOrder = 'before';
    let isPreviewed = false;
    let sliderPos = 50;
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    let isSliding = false;
    let isPanning = false;
    let dragStart = { x: 0, y: 0 };
    let isPinching = false;
    let initialPinchDist = 0;
    let initialZoom = 1;
    let cancelRender = false;
    let normaliseSize = false;
    let enhanceCanvas = null;
    let gpuEnhancer = null;
    let gpuReady = false;
    let currentVideoFile = null;
    let currentImageFile = null;
    let ffmpegInstance = null;

    class UpscaleEngine {
        constructor(videoEl, canvasEl) {
            this.video = videoEl;
            this.canvas = canvasEl;
            this.isReady = false;
            this.workerInfo = '';
            this.worker = null;
            this.offscreenCanvas = null;
            this.activeRequest = null;
            this.tfjsParams = TFJS_PARAMS;
            this.lastSrcWidth = 0;
            this.lastSrcHeight = 0;
            this.init();
        }

        init() {
            try {
                this.worker = new Worker('assets/upscale/upscaleWorker.js?v=2');
                this.worker.addEventListener('error', (e) => {
                    const msg = e.message || 'Worker error.';
                    this.workerInfo = `Worker Error: ${msg}`;
                    if (engineStatus) engineStatus.textContent = this.workerInfo;
                    if (this.activeRequest) {
                        this.activeRequest.reject(new Error(this.workerInfo));
                        this.activeRequest = null;
                    }
                });
                this.worker.addEventListener('message', (e) => {
                    const { progress, done, output, alertmsg, info } = e.data;
                    if (info) {
                        this.workerInfo = info;
                        if (engineStatus) engineStatus.textContent = `AI Engine: ${info}`;
                    }
                    if (progress !== undefined && this.activeRequest && this.activeRequest.onProgress) {
                        this.activeRequest.onProgress(progress, info);
                    }
                    if (alertmsg && this.activeRequest) {
                        this.activeRequest.reject(new Error(alertmsg));
                        this.activeRequest = null;
                    }
                    if (done && output && this.activeRequest) {
                        const factor = this.tfjsParams.factor;
                        const w = this.lastSrcWidth * factor;
                        const h = this.lastSrcHeight * factor;
                        this.canvas.width = w;
                        this.canvas.height = h;
                        const ctx = this.canvas.getContext('2d');
                        const imgData = ctx.createImageData(w, h);
                        imgData.data.set(new Uint8ClampedArray(output));
                        ctx.putImageData(imgData, 0, 0);
                        this.activeRequest.resolve();
                        this.activeRequest = null;
                    }
                });
                this.isReady = true;
                if (engineStatus) engineStatus.textContent = 'AI Engine: Initializing...';
            } catch (err) {
                if (engineStatus) engineStatus.textContent = `AI Engine: ${err.message}`;
            }
        }

        async renderFrame(source, onProgress) {
            if (!this.worker) throw new Error('Worker not initialized.');
            const width = source.naturalWidth || source.videoWidth || source.width || 0;
            const height = source.naturalHeight || source.videoHeight || source.height || 0;
            if (!width || !height) throw new Error('Source dimensions are 0.');
            this.lastSrcWidth = width;
            this.lastSrcHeight = height;

            if (!this.offscreenCanvas) this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
            const ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0);
            const imgData = ctx.getImageData(0, 0, width, height);

            if (this.activeRequest) {
                this.activeRequest.reject(new Error('Cancelled by subsequent frame request.'));
                this.activeRequest = null;
            }

            return new Promise((resolve, reject) => {
                this.activeRequest = { resolve, reject, onProgress };
                this.worker.postMessage({
                    input: imgData.data.buffer,
                    width, height,
                    factor: this.tfjsParams.factor,
                    tile_size: this.tfjsParams.tile_size,
                    min_lap: this.tfjsParams.min_lap,
                    model_type: 'realesrgan',
                    model: this.tfjsParams.model,
                    backend: this.tfjsParams.backend,
                    hasAlpha: false
                }, [imgData.data.buffer]);
            });
        }

        destroy() {
            if (this.worker) {
                this.worker.terminate();
                this.worker = null;
            }
            this.isReady = false;
        }
    }

    let engine = null;

    function getPresetParams(id) {
        const preset = PRESETS.find(p => p.id === id) || PRESETS[PRESETS.length - 1];
        const params = { ...DEFAULT_PARAMS };
        Object.keys(preset).forEach(k => {
            if (k !== 'id' && k !== 'name') params[k] = preset[k];
        });
        return params;
    }

    function formatTime(t) {
        if (isNaN(t)) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * Center-crops srcCanvas to 1080x1920 using cover-fit logic.
     * - Horizontal images: crops left/right, keeps center vertical strip.
     * - Tall images: crops top/bottom, keeps center horizontal strip.
     * Returns a new canvas of size 1080x1920.
     */
    function applyCropTo1080x1920(srcCanvas) {
        const targetW = 1080;
        const targetH = 1920;
        const srcW = srcCanvas.width;
        const srcH = srcCanvas.height;

        // Cover-fit: scale so that the image fully covers the target rect
        const scaleX = targetW / srcW;
        const scaleY = targetH / srcH;
        const scale = Math.max(scaleX, scaleY);

        const drawW = Math.round(srcW * scale);
        const drawH = Math.round(srcH * scale);
        const offsetX = Math.round((drawW - targetW) / 2);
        const offsetY = Math.round((drawH - targetH) / 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = targetW;
        cropCanvas.height = targetH;
        const ctx = cropCanvas.getContext('2d');
        ctx.drawImage(srcCanvas, -offsetX, -offsetY, drawW, drawH);
        return cropCanvas;
    }

    function addLog(msg) {
        logsEl.textContent += (logsEl.textContent ? '\n' : '') + msg;
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    function setProgress(pct, text) {
        const cleanPct = (typeof pct === 'number' && !isNaN(pct)) ? Math.max(0, Math.min(100, pct)) : 0;
        progressFill.style.width = `${cleanPct}%`;
        progressPercent.textContent = `${Math.round(cleanPct)}%`;
        if (text) progressText.textContent = text;
    }

    function updateTransform() {
        const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        card.querySelectorAll('.upscale-transform-layer').forEach(el => {
            el.style.transform = transform;
        });
        canvasClip.style.clipPath = `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`;
        sliderLine.style.left = `${sliderPos}%`;
        comparisonContainer.querySelector('.upscale-comparison-wrapper').classList.toggle('zoomed', zoom > 1);
        zoomBadge.classList.toggle('hidden', zoom <= 1);
        zoomBadge.textContent = `Zoom: ${zoom}x`;
        btnZoom.textContent = `Zoom: ${zoom}x`;
    }

    function updateSliderLabel() {
        if (isPreviewed) {
            sliderLabelRight.textContent = window.getTranslation('upscale_label_enhanced_ai');
            if (unprocessedOverlay) unprocessedOverlay.classList.remove('show');
        } else {
            if (enhanceOrder === 'before') {
                sliderLabelRight.textContent = window.getTranslation('upscale_label_live_enhanced');
            } else {
                sliderLabelRight.textContent = window.getTranslation('upscale_label_original');
            }
            if (unprocessedOverlay) unprocessedOverlay.classList.add('show');
        }
    }

    function getActiveMediaSource() {
        return isImageMode ? imageEl : video;
    }

    function getMediaDimensions() {
        if (isImageMode) {
            return { w: imageEl.naturalWidth, h: imageEl.naturalHeight };
        }
        return { w: video.videoWidth, h: video.videoHeight };
    }

    function drawGpuPreview() {
        if (!canvas || isPreviewed || appState !== 'ready') return;
        const source = getActiveMediaSource();
        const dims = getMediaDimensions();
        if (!dims.w || !dims.h) return;
        if (!isImageMode && video.readyState < 2) return;
        const params = getPresetParams(activePreset);
        if (enhanceOrder === 'before') {
            gpuEnhancer.process(source, params, canvas);
        } else {
            canvas.width = dims.w;
            canvas.height = dims.h;
            canvas.getContext('2d').drawImage(source, 0, 0);
        }
        updateSliderLabel();
    }

    function showWorkspace() {
        dropArea.classList.add('hidden');
        workspace.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        if (btnReset) btnReset.classList.remove('hidden');
        if (btnEnhance) btnEnhance.classList.remove('hidden');
        // Show/hide duration controls based on media type
        if (durationContainer) {
            durationContainer.classList.toggle('hidden', isImageMode);
        }
        // Show correct media element
        if (isImageMode) {
            video.classList.add('hidden');
            imageEl.classList.remove('hidden');
        } else {
            video.classList.remove('hidden');
            imageEl.classList.add('hidden');
        }
        updateSliderLabel();
    }

    function setCardControlsEnabled(enabled) {
        card.querySelectorAll('button, input, select').forEach(el => {
            if (el.id === 'upscale-btn-cancel') return;
            if (enabled) {
                el.removeAttribute('disabled');
                el.classList.remove('disabled');
            } else {
                el.setAttribute('disabled', 'true');
                el.classList.add('disabled');
            }
        });
        
        const pointerEvents = enabled ? 'auto' : 'none';
        const opacity = enabled ? '1' : '0.5';
        
        if (presetList) {
            presetList.style.pointerEvents = pointerEvents;
            presetList.style.opacity = opacity;
        }
        
        const orderToggle = card.querySelector('.upscale-order-toggle');
        if (orderToggle) {
            orderToggle.style.pointerEvents = pointerEvents;
            orderToggle.style.opacity = opacity;
        }
        
        const timelineContainer = card.querySelector('.upscale-timeline');
        if (timelineContainer) {
            timelineContainer.style.pointerEvents = pointerEvents;
            timelineContainer.style.opacity = opacity;
        }
        
        if (dropArea) {
            dropArea.style.pointerEvents = pointerEvents;
            dropArea.style.opacity = opacity;
        }
    }

    function checkSystemAndContinue() {
        if (engineDot) {
            engineDot.textContent = 'sync';
            engineDot.style.color = 'var(--md-sys-color-primary)';
            engineDot.classList.add('upscale-spinner');
        }
        if (engineStatus) engineStatus.textContent = window.getTranslation('upscale_checking_ai');

        if (gpuDot) {
            gpuDot.textContent = 'sync';
            gpuDot.style.color = 'var(--md-sys-color-primary)';
            gpuDot.classList.add('upscale-spinner');
        }
        if (gpuStatus) gpuStatus.textContent = window.getTranslation('upscale_checking_gpu');

        if (webcodecsDot) {
            webcodecsDot.textContent = 'sync';
            webcodecsDot.style.color = 'var(--md-sys-color-primary)';
            webcodecsDot.classList.add('upscale-spinner');
        }
        if (webcodecsStatus) webcodecsStatus.textContent = window.getTranslation('upscale_checking_ffmpeg');

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            
            // Check GPU
            if (gpuReady) {
                if (gpuDot) {
                    gpuDot.textContent = 'check_circle';
                    gpuDot.style.color = '#4CAF50';
                    gpuDot.classList.remove('upscale-spinner');
                }
                if (gpuStatus) gpuStatus.textContent = window.getTranslation('upscale_ready_gpu');
            } else {
                if (gpuDot) {
                    gpuDot.textContent = 'cancel';
                    gpuDot.style.color = '#F44336';
                    gpuDot.classList.remove('upscale-spinner');
                }
                if (gpuStatus) gpuStatus.textContent = window.getTranslation('upscale_failed_gpu');
            }

            // Check FFmpeg WASM
            const ffmpegReady = !!window.FFmpegWASM;
            if (ffmpegReady) {
                if (webcodecsDot) {
                    webcodecsDot.textContent = 'check_circle';
                    webcodecsDot.style.color = '#4CAF50';
                    webcodecsDot.classList.remove('upscale-spinner');
                }
                if (webcodecsStatus) webcodecsStatus.textContent = window.getTranslation('upscale_ready_ffmpeg');
            } else {
                if (webcodecsDot) {
                    webcodecsDot.textContent = 'cancel';
                    webcodecsDot.style.color = '#F44336';
                    webcodecsDot.classList.remove('upscale-spinner');
                }
                if (webcodecsStatus) webcodecsStatus.textContent = window.getTranslation('upscale_failed_ffmpeg');
            }

            // Check AI Engine
            const aiReady = engine && engine.isReady;
            if (aiReady) {
                if (engineDot) {
                    engineDot.textContent = 'check_circle';
                    engineDot.style.color = '#4CAF50';
                    engineDot.classList.remove('upscale-spinner');
                }
                if (engineStatus) engineStatus.textContent = window.getTranslation('upscale_ready_ai');
            } else {
                if (attempts > 10) {
                    if (engineDot) {
                        engineDot.textContent = 'cancel';
                        engineDot.style.color = '#F44336';
                        engineDot.classList.remove('upscale-spinner');
                    }
                    if (engineStatus) engineStatus.textContent = window.getTranslation('upscale_failed_ai');
                }
            }

            const allReady = aiReady && gpuReady && ffmpegReady;
            if (allReady) {
                clearInterval(interval);
                
                setTimeout(() => {
                    checkingScreen.classList.add('hidden');
                    showWorkspace();
                    updateTransform();
                }, 1000);
            } else if (attempts > 10) {
                clearInterval(interval);
            }
        }, 500);
    }

    function loadVideoFile(file) {
        if (!file || !file.type.startsWith('video/')) return;
        isImageMode = false;
        currentVideoFile = file;
        currentImageFile = null;
        if (videoSrc) URL.revokeObjectURL(videoSrc);
        if (imageSrc) { URL.revokeObjectURL(imageSrc); imageSrc = null; }
        videoSrc = URL.createObjectURL(file);
        video.src = videoSrc;
        imageEl.src = '';
        imageEl.classList.add('hidden');
        video.classList.remove('hidden');
        isPreviewed = false;
        zoom = 1;
        pan = { x: 0, y: 0 };
        appState = 'ready';
        completedPanel.classList.add('hidden');
        completedVideo.classList.add('hidden');
        completedImage.classList.add('hidden');
        progressContainer.classList.add('hidden');
        btnCancel.classList.add('hidden');
        btnDownload.classList.add('hidden');
        if (btnEnhance) {
            btnEnhance.disabled = false;
            btnEnhance.removeAttribute('title');
        }
        logsEl.textContent = `[System] Video loaded: ${file.name}`;
        dropArea.classList.add('hidden');
        checkingScreen.classList.remove('hidden');
        checkSystemAndContinue();
    }

    function loadImageFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        isImageMode = true;
        currentImageFile = file;
        currentVideoFile = null;
        if (imageSrc) URL.revokeObjectURL(imageSrc);
        if (videoSrc) { URL.revokeObjectURL(videoSrc); videoSrc = null; }
        imageSrc = URL.createObjectURL(file);
        imageEl.src = imageSrc;
        video.src = '';
        video.classList.add('hidden');
        imageEl.classList.remove('hidden');
        isPreviewed = false;
        zoom = 1;
        pan = { x: 0, y: 0 };
        appState = 'ready';
        completedPanel.classList.add('hidden');
        completedVideo.classList.add('hidden');
        completedImage.classList.add('hidden');
        progressContainer.classList.add('hidden');
        btnCancel.classList.add('hidden');
        btnDownload.classList.add('hidden');
        if (btnEnhance) {
            btnEnhance.disabled = false;
            btnEnhance.removeAttribute('title');
        }
        logsEl.textContent = `[System] Image loaded: ${file.name}`;
        imageEl.onload = () => {
            logsEl.textContent += `\n[System] Dimensions: ${imageEl.naturalWidth}x${imageEl.naturalHeight}`;
            drawGpuPreview();
        };
        dropArea.classList.add('hidden');
        checkingScreen.classList.remove('hidden');
        checkSystemAndContinueImage();
    }

    function checkSystemAndContinueImage() {
        if (engineDot) {
            engineDot.textContent = 'sync';
            engineDot.style.color = 'var(--md-sys-color-primary)';
            engineDot.classList.add('upscale-spinner');
        }
        if (engineStatus) engineStatus.textContent = 'AI Engine: Checking...';
        if (gpuDot) {
            gpuDot.textContent = 'sync';
            gpuDot.style.color = 'var(--md-sys-color-primary)';
            gpuDot.classList.add('upscale-spinner');
        }
        if (gpuStatus) gpuStatus.textContent = 'GPU Canvas: Checking...';
        if (webcodecsDot) {
            webcodecsDot.textContent = 'check_circle';
            webcodecsDot.style.color = '#4CAF50';
            webcodecsDot.classList.remove('upscale-spinner');
        }
        if (webcodecsStatus) webcodecsStatus.textContent = 'FFmpeg WASM: Not needed for images';

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (gpuReady) {
                if (gpuDot) { gpuDot.textContent = 'check_circle'; gpuDot.style.color = '#4CAF50'; gpuDot.classList.remove('upscale-spinner'); }
                if (gpuStatus) gpuStatus.textContent = 'GPU Canvas: Ready';
            } else {
                if (gpuDot) { gpuDot.textContent = 'cancel'; gpuDot.style.color = '#F44336'; gpuDot.classList.remove('upscale-spinner'); }
                if (gpuStatus) gpuStatus.textContent = 'GPU Canvas: Unavailable';
            }
            const aiReady = engine && engine.isReady;
            if (aiReady) {
                if (engineDot) { engineDot.textContent = 'check_circle'; engineDot.style.color = '#4CAF50'; engineDot.classList.remove('upscale-spinner'); }
                if (engineStatus) engineStatus.textContent = 'AI Engine: Ready';
            } else if (attempts > 10) {
                if (engineDot) { engineDot.textContent = 'cancel'; engineDot.style.color = '#F44336'; engineDot.classList.remove('upscale-spinner'); }
                if (engineStatus) engineStatus.textContent = 'AI Engine: Timeout/Failed';
            }
            if ((aiReady && gpuReady) || attempts > 10) {
                clearInterval(interval);
                setTimeout(() => {
                    checkingScreen.classList.add('hidden');
                    showWorkspace();
                    updateTransform();
                }, 800);
            }
        }, 500);
    }

    PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `upscale-preset-btn${p.id === activePreset ? ' active' : ''}`;
        btn.textContent = p.name;
        btn.dataset.preset = p.id;
        btn.addEventListener('click', () => {
            if (appState === 'rendering') return;
            activePreset = p.id;
            isPreviewed = false;
            btnPreview.classList.remove('active');
            presetList.querySelectorAll('.upscale-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawGpuPreview();
        });
        presetList.appendChild(btn);
    });

    card.querySelectorAll('.upscale-order-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (appState === 'rendering') return;
            enhanceOrder = btn.dataset.order;
            isPreviewed = false;
            btnPreview.classList.remove('active');
            card.querySelectorAll('.upscale-order-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            drawGpuPreview();
        });
    });

    function handleFileInput(file) {
        if (!file) return;
        if (file.type.startsWith('image/')) {
            loadImageFile(file);
        } else if (file.type.startsWith('video/')) {
            loadVideoFile(file);
        }
    }

    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileInput(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropArea.addEventListener(evt, (e) => {
            e.preventDefault();
            dropArea.classList.add('active');
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, (e) => {
            e.preventDefault();
            dropArea.classList.remove('active');
        });
    });
    dropArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handleFileInput(file);
    });

    video.addEventListener('loadedmetadata', async () => {
        timeline.max = video.duration || 100;
        timeline.value = 0;
        timeDuration.textContent = formatTime(video.duration);
        timeCurrent.textContent = '0:00';
        isPreviewed = false;
        video.currentTime = 0;
        await new Promise((resolve) => {
            const check = () => {
                if (video.readyState >= 2) resolve();
                else setTimeout(check, 50);
            };
            check();
        });
        drawGpuPreview();
    });

    video.addEventListener('timeupdate', () => {
        if (appState === 'ready') {
            timeCurrent.textContent = formatTime(video.currentTime);
            timeline.value = video.currentTime;
        }
    });

    video.addEventListener('seeked', () => {
        if (appState === 'ready' && !isPreviewed) {
            drawGpuPreview();
            updateSliderLabel();
        }
    });

    timeline.addEventListener('input', () => {
        const t = parseFloat(timeline.value);
        video.currentTime = t;
        isPreviewed = false;
        btnPreview.classList.remove('active');
        updateSliderLabel();
        
        // Clear canvas to immediately reveal the original video underneath
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Slider & zoom/pan controls (Mouse & Touch support)
    sliderLine.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isSliding = true;
    });

    sliderLine.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isSliding = true;
    }, { passive: false });

    comparisonContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.upscale-slider-line')) return;
        if (zoom > 1) {
            isPanning = true;
            dragStart = { x: e.clientX, y: e.clientY };
        }
    });

    comparisonContainer.addEventListener('touchstart', (e) => {
        if (e.target.closest('.upscale-slider-line')) return;
        if (e.touches.length === 1 && zoom > 1) {
            isPanning = true;
            dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            isPinching = true;
            isPanning = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.hypot(dx, dy);
            initialZoom = zoom;
        }
    }, { passive: true });

    window.addEventListener('mousemove', (e) => {
        if (isSliding) {
            const rect = comparisonContainer.getBoundingClientRect();
            sliderPos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            updateTransform();
        } else if (isPanning && zoom > 1) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            pan = { x: pan.x + dx, y: pan.y + dy };
            dragStart = { x: e.clientX, y: e.clientY };
            updateTransform();
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (isSliding) {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const rect = comparisonContainer.getBoundingClientRect();
            sliderPos = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
            updateTransform();
        } else if (isPinching && e.touches.length === 2) {
            if (e.cancelable) e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (initialPinchDist > 0) {
                const factor = dist / initialPinchDist;
                const next = Math.max(1, Math.min(8, initialZoom * factor));
                if (next === 1) pan = { x: 0, y: 0 };
                zoom = Math.round(next * 100) / 100;
                updateTransform();
            }
        } else if (isPanning && e.touches.length === 1 && zoom > 1) {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - dragStart.x;
            const dy = touch.clientY - dragStart.y;
            pan = { x: pan.x + dx, y: pan.y + dy };
            dragStart = { x: touch.clientX, y: touch.clientY };
            updateTransform();
        }
    }, { passive: false });

    const handleRelease = () => {
        isSliding = false;
        isPanning = false;
        isPinching = false;
        initialPinchDist = 0;
    };

    window.addEventListener('mouseup', handleRelease);
    window.addEventListener('touchend', handleRelease);
    window.addEventListener('touchcancel', handleRelease);

    comparisonContainer.addEventListener('wheel', (e) => {
        if (appState !== 'ready' && appState !== 'completed') return;
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        const next = Math.max(1, Math.min(8, zoom + dir * 0.15));
        if (next === 1) pan = { x: 0, y: 0 };
        zoom = Math.round(next * 100) / 100;
        updateTransform();
    }, { passive: false });

    btnZoom.addEventListener('click', () => {
        if (zoom === 1) zoom = 2;
        else if (zoom === 2) zoom = 4;
        else { zoom = 1; pan = { x: 0, y: 0 }; }
        updateTransform();
    });

    btnPreview.addEventListener('click', async () => {
        if (!engine || !engine.isReady) return;
        btnPreview.disabled = true;
        setCardControlsEnabled(false);
        const startTime = performance.now();
        try {
            isPreviewed = true;
            const source = getActiveMediaSource();
            if (!isImageMode && video.readyState < 2) {
                await new Promise((resolve) => {
                    const check = () => {
                        if (video.readyState >= 2) resolve();
                        else setTimeout(check, 50);
                    };
                    check();
                });
            }
            if (progressContainer) {
                setProgress(0, 'Generating Preview...');
                progressContainer.classList.remove('hidden');
            }
            const params = getPresetParams(activePreset);
            const onFrameProgress = (progress, info) => {
                setProgress(progress, 'Processing...');
            };
            if (enhanceOrder === 'before') {
                drawGpuPreview();
                await engine.renderFrame(canvas, onFrameProgress);
            } else {
                await engine.renderFrame(source, onFrameProgress);
                if (!enhanceCanvas) enhanceCanvas = document.createElement('canvas');
                gpuEnhancer.process(canvas, params, enhanceCanvas);
                canvas.getContext('2d').drawImage(enhanceCanvas, 0, 0);
            }
            setProgress(100, 'Preview Ready');
            btnPreview.classList.add('active');
            updateSliderLabel();
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            addLog(`[Preview] ${isImageMode ? 'Image' : 'Frame'} upscaled successfully in ${elapsed}s.`);
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            isPreviewed = false;
            btnPreview.classList.remove('active');
            addLog(`[Preview Error] ${err.message}`);
        } finally {
            if (progressContainer) progressContainer.classList.add('hidden');
            btnPreview.disabled = false;
            setCardControlsEnabled(true);
        }
    });

    btnEnhance.addEventListener('click', handleRender);

    if (normaliseToggle) {
        normaliseToggle.addEventListener('change', () => {
            normaliseSize = normaliseToggle.checked;
        });
    }
    btnCancel.addEventListener('click', () => { cancelRender = true; });

    function resetTool() {
        if (videoSrc) URL.revokeObjectURL(videoSrc);
        if (imageSrc) URL.revokeObjectURL(imageSrc);
        if (renderedVideoSrc) URL.revokeObjectURL(renderedVideoSrc);
        videoSrc = null;
        imageSrc = null;
        renderedVideoSrc = null;
        video.removeAttribute('src');
        video.load();
        imageEl.src = '';
        imageEl.classList.add('hidden');
        video.classList.remove('hidden');
        isPreviewed = false;
        zoom = 1;
        pan = { x: 0, y: 0 };
        appState = 'import';
        isImageMode = false;
        currentVideoFile = null;
        currentImageFile = null;
        if (ffmpegInstance) {
            try {
                ffmpegInstance.deleteFile('input.mp4').catch(()=>{});
                ffmpegInstance.deleteFile('output.mp4').catch(()=>{});
            } catch(e){}
        }
        dropArea.classList.remove('hidden');
        workspace.classList.add('hidden');
        completedPanel.classList.add('hidden');
        completedVideo.classList.add('hidden');
        completedImage.classList.add('hidden');
        progressContainer.classList.add('hidden');
        setProgress(0, '');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
        btnCancel.classList.add('hidden');
        btnDownload.classList.add('hidden');
        if (btnEnhance) btnEnhance.classList.add('hidden');
        if (durationContainer) durationContainer.classList.remove('hidden');
        fileInput.value = '';
    }

    if (btnReset) {
        btnReset.addEventListener('click', resetTool);
    }

    btnDownload.addEventListener('click', resetTool);

    async function getFFmpeg() {
        if (ffmpegInstance) return ffmpegInstance;
        const { FFmpeg } = window.FFmpegWASM;
        const { toBlobURL } = window.FFmpegUtil;
        let ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg Log]', message);
        });
        const baseURL = window.location.origin + '/assets/ffmpeg';
        // Force single-threaded FFmpeg — multi-threaded (SharedArrayBuffer + pthreads)
        // causes hangs on Chrome/Windows after frame extraction completes.
        try {
            console.log('Loading single-threaded FFmpeg...');
            const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
            await ffmpeg.load({ coreURL, wasmURL });
            console.log('Single-threaded FFmpeg loaded successfully.');
        } catch (err) {
            console.error('getFFmpeg single-thread load error details:', err);
            throw err;
        }

        ffmpegInstance = ffmpeg;
        return ffmpeg;
    }

    async function handleImageRender() {
        if (!imageEl || !engine || !engine.isReady || !currentImageFile) return;
        const startTime = performance.now();
        appState = 'rendering';
        cancelRender = false;
        setProgress(0, 'Preparing...');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        btnCancel.classList.remove('hidden');
        if (btnEnhance) btnEnhance.classList.add('hidden');
        setCardControlsEnabled(false);

        const dims = getMediaDimensions();
        addLog(`[System] Image: ${dims.w}x${dims.h}`);
        addLog(`[System] Target: ${dims.w * 4}x${dims.h * 4}`);

        const params = getPresetParams(activePreset);

        try {
            setProgress(5, 'Applying GPU enhancement...');
            const source = getActiveMediaSource();
            const onFrameProgress = (progress) => {
                const pct = Math.min(95, 5 + Math.round(progress * 0.9));
                setProgress(pct, `Processing... (${progress.toFixed(0)}%)`);
            };

            if (enhanceOrder === 'before') {
                if (!enhanceCanvas) enhanceCanvas = document.createElement('canvas');
                gpuEnhancer.process(source, params, enhanceCanvas);
                await engine.renderFrame(enhanceCanvas, onFrameProgress);
            } else {
                await engine.renderFrame(source, onFrameProgress);
                if (!enhanceCanvas) enhanceCanvas = document.createElement('canvas');
                gpuEnhancer.process(canvas, params, enhanceCanvas);
                canvas.getContext('2d').drawImage(enhanceCanvas, 0, 0);
            }

            setProgress(97, 'Generating output...');
            // Apply normalise crop if enabled
            let outCanvas = canvas;
            if (normaliseSize) {
                addLog('[Normalise] Cropping to 1080×1920 (center crop)...');
                outCanvas = applyCropTo1080x1920(canvas);
            }
            const outBlob = await new Promise(res => outCanvas.toBlob(res, 'image/jpeg', 0.92));
            const outUrl = URL.createObjectURL(outBlob);

            setProgress(100, 'Complete');
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            addLog(`[System] Enhancement complete in ${elapsed}s!`);

            appState = 'completed';
            completedImage.src = outUrl;
            completedImage.classList.remove('hidden');
            completedVideo.classList.add('hidden');
            completedPanel.classList.remove('hidden');
            btnDownload.classList.remove('hidden');
            btnCancel.classList.add('hidden');
            workspace.classList.add('hidden');
            logsContainer.classList.add('hidden');
            progressContainer.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.add('hidden');

            // Auto download
            const baseName = currentImageFile.name.replace(/\.[^.]+$/, '');
            const a = document.createElement('a');
            a.href = outUrl;
            a.download = `enhanced_${baseName}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            if (err.message === 'Cancelled') {
                addLog('[System] Cancelled.');
            } else {
                addLog(`[Fatal Error] ${err.message}`);
            }
            appState = 'ready';
            progressContainer.classList.add('hidden');
            setProgress(0, '');
            btnCancel.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.remove('hidden');
        } finally {
            setCardControlsEnabled(true);
        }
    }

    // Detects the exact FPS by running a lightweight FFmpeg probe on a file
    // already written to the WASM FS, parsing the fps value from the log.
    // Falls back to requestVideoFrameCallback, then 30fps.
    async function detectVideoFps(vid, ffmpeg) {
        // Strategy 1: parse FPS from an FFmpeg -i probe (most accurate)
        if (ffmpeg) {
            let detectedFps = null;
            const logHandler = ({ message }) => {
                // Match patterns like "29.97 fps", "60 fps", "59.94 tbr"
                const m = message.match(/(\d+(?:\.\d+)?)\s+(?:fps|tbr)/);
                if (m && !detectedFps) detectedFps = parseFloat(m[1]);
            };
            ffmpeg.on('log', logHandler);
            try {
                await ffmpeg.exec(['-i', 'input.mp4']);
            } catch (e) { /* -i with no output always exits with error, that's fine */ }
            ffmpeg.off('log', logHandler);
            if (detectedFps && detectedFps > 0) {
                console.log(`[FPS] Detected ${detectedFps} fps from FFmpeg probe`);
                return detectedFps;
            }
        }

        // Strategy 2: requestVideoFrameCallback playback probe (Chrome)
        const commonFpsMap = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];
        if ('requestVideoFrameCallback' in vid) {
            const probed = await new Promise((resolve) => {
                const frames = [];
                const timeout = setTimeout(() => { vid.pause(); resolve(null); }, 2500);
                const cb = (now, meta) => {
                    frames.push(meta.mediaTime);
                    if (frames.length < 5) {
                        vid.requestVideoFrameCallback(cb);
                    } else {
                        clearTimeout(timeout);
                        vid.pause();
                        const diffs = [];
                        for (let k = 1; k < frames.length; k++) {
                            const d = frames[k] - frames[k - 1];
                            if (d > 0.001) diffs.push(d);
                        }
                        if (diffs.length === 0) { resolve(null); return; }
                        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
                        const raw = 1 / avgDiff;
                        const nearest = commonFpsMap.reduce((prev, cur) =>
                            Math.abs(cur - raw) < Math.abs(prev - raw) ? cur : prev
                        );
                        resolve(nearest);
                    }
                };
                vid.currentTime = 0;
                vid.muted = true;
                vid.playbackRate = 1;
                vid.requestVideoFrameCallback(cb);
                vid.play().catch(() => { clearTimeout(timeout); resolve(null); });
            });
            if (probed) {
                console.log(`[FPS] Detected ${probed} fps from requestVideoFrameCallback`);
                return probed;
            }
        }

        // Strategy 3: fallback
        console.warn('[FPS] Could not detect fps, falling back to 30');
        return 30;
    }

    // Seeks video to a specific time and waits for seeked event.
    function seekVideoToTime(vid, time) {
        return new Promise((resolve) => {
            if (Math.abs(vid.currentTime - time) < 0.001) {
                resolve();
                return;
            }
            const onSeeked = () => {
                vid.removeEventListener('seeked', onSeeked);
                resolve();
            };
            vid.addEventListener('seeked', onSeeked);
            vid.currentTime = time;
        });
    }

    async function handleRender() {
        if (isImageMode) { handleImageRender(); return; }
        if (!video || !engine || !engine.isReady || !currentVideoFile) return;

        const scale = 4;
        const upscaledWidth = video.videoWidth * scale;
        const upscaledHeight = video.videoHeight * scale;
        if (!enhanceCanvas) enhanceCanvas = document.createElement('canvas');

        const startTime = performance.now();
        appState = 'rendering';
        cancelRender = false;
        setProgress(0, 'Initializing FFmpeg...');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        btnCancel.classList.remove('hidden');
        if (btnEnhance) btnEnhance.classList.add('hidden');
        setCardControlsEnabled(false);

        const logs = [
            '[System] GPU Canvas + Real-ESRGAN 4x FFmpeg pipeline...',
            `[System] Input: ${video.videoWidth}x${video.videoHeight}`,
            `[System] Target: ${upscaledWidth}x${upscaledHeight}`,
            `[System] Duration: ${video.duration.toFixed(2)}s`
        ];
        logsEl.textContent = logs.join('\n');

        let ffmpeg;
        try {
            ffmpeg = await getFFmpeg();
        } catch (err) {
            addLog(`[Error] Failed to initialize FFmpeg WASM: ${err.message || err}`);
            appState = 'ready';
            progressContainer.classList.add('hidden');
            setProgress(0, '');
            btnCancel.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.remove('hidden');
            setCardControlsEnabled(true);
            return;
        }

        const finalWidth = upscaledWidth % 2 === 0 ? upscaledWidth : upscaledWidth + 1;
        const finalHeight = upscaledHeight % 2 === 0 ? upscaledHeight : upscaledHeight + 1;
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        addLog('[System] FFmpeg ready.');
        addLog('[System] Seeking frames via video element (no FFmpeg extraction)...');

        const originalTime = video.currentTime;
        const params = getPresetParams(activePreset);
        const orderBefore = enhanceOrder === 'before';

        const extractedFrames = [];
        const enhancedFrames = [];
        const enhancedFrameBlobs = []; // kept in memory for abort-recovery re-encode
        // Seek-based temp canvas for capturing frames without FFmpeg extraction
        const seekCanvas = document.createElement('canvas');
        seekCanvas.width = video.videoWidth;
        seekCanvas.height = video.videoHeight;
        const seekCtx = seekCanvas.getContext('2d');

        try {
            // Write original video file (needed only for audio muxing at the end)
            const { fetchFile } = window.FFmpegUtil;
            addLog('[System] Writing video to FFmpeg FS for audio...');
            await ffmpeg.writeFile('input.mp4', await fetchFile(currentVideoFile));

            if (cancelRender) throw new Error('Cancelled');

            // Determine frame count and FPS — probe from the already-written input.mp4.
            // NOTE: the probe exec() causes Aborted() in ST WASM, which kills the instance.
            // We reset and reload ffmpeg after the probe so frame writes go to a live instance.
            const videoFps = await detectVideoFps(video, ffmpeg);
            ffmpegInstance = null;  // probe killed the instance; get a fresh one
            ffmpeg = await getFFmpeg();
            // Re-write input.mp4 to the fresh instance (needed for audio mux)
            await ffmpeg.writeFile('input.mp4', await fetchFile(currentVideoFile));
            const totalFrames = Math.round(video.duration * videoFps);
            const outputFps = videoFps.toFixed(2);

            addLog(`[System] Detected ${videoFps} FPS → ${totalFrames} frames total. Processing...`);
            await new Promise(r => setTimeout(r, 0));

            for (let i = 0; i < totalFrames; i++) {
                if (cancelRender) throw new Error('Cancelled');

                const frameNum = i + 1;
                const timestamp = i / videoFps;

                // Seek video to the target frame timestamp
                await seekVideoToTime(video, timestamp);

                // Draw the current video frame to the seek canvas
                seekCtx.drawImage(video, 0, 0, seekCanvas.width, seekCanvas.height);

                // Adjust output canvas size
                const finalW = (seekCanvas.width * scale) % 2 === 0 ? (seekCanvas.width * scale) : (seekCanvas.width * scale) + 1;
                const finalH = (seekCanvas.height * scale) % 2 === 0 ? (seekCanvas.height * scale) : (seekCanvas.height * scale) + 1;
                if (canvas.width !== finalW || canvas.height !== finalH) {
                    canvas.width = finalW;
                    canvas.height = finalH;
                }

                const onFrameProgress = (frameProgress) => {
                    const overallPct = Math.min(85, Math.round(((i + (frameProgress / 100)) / totalFrames) * 85));
                    setProgress(overallPct, `Frame ${frameNum}/${totalFrames} (${frameProgress.toFixed(0)}%)`);
                };

                if (orderBefore) {
                    gpuEnhancer.process(seekCanvas, params, enhanceCanvas);
                    await engine.renderFrame(enhanceCanvas, onFrameProgress);
                } else {
                    await engine.renderFrame(seekCanvas, onFrameProgress);
                    gpuEnhancer.process(canvas, params, enhanceCanvas);
                    canvas.getContext('2d').drawImage(enhanceCanvas, 0, 0);
                }

                // Apply normalise crop per-frame if enabled
                let frameCanvas = canvas;
                if (normaliseSize) {
                    frameCanvas = applyCropTo1080x1920(canvas);
                }
                const outBlob = await new Promise(res => frameCanvas.toBlob(res, 'image/jpeg', 0.92));
                const outArrayBuffer = await outBlob.arrayBuffer();
                const outFilename = `enhanced_${frameNum.toString().padStart(4, '0')}.jpg`;
                await ffmpeg.writeFile(outFilename, new Uint8Array(outArrayBuffer));
                enhancedFrames.push(outFilename);
                enhancedFrameBlobs.push(outBlob); // save for abort recovery

                const pct = Math.min(85, Math.round((frameNum / totalFrames) * 85));
                setProgress(pct, `Frame ${frameNum}/${totalFrames}`);
                if (frameNum % 10 === 0 || frameNum === totalFrames) {
                    addLog(`[Process] Rendered frame ${frameNum}/${totalFrames} (${pct}%)`);
                }

                // Yield to the event loop every 5 frames to keep Chrome/Windows responsive
                if (frameNum % 5 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            addLog('[System] Frame upscaling complete. Encoding video using FFmpeg WASM...');
            setProgress(88, 'Encoding video...');

            if (cancelRender) throw new Error('Cancelled');

            // Exec FFmpeg to encode frames + mux audio.
            // ST WASM always calls exit(0) → Emscripten throws Aborted().
            // The output file IS written to the JS-side FS before the throw,
            // so we try to readFile immediately on the same instance.
            const encodeArgs = [
                '-r', String(outputFps),
                '-i', 'enhanced_%04d.jpg',
                '-i', 'input.mp4',
                '-map', '0:v',
                '-map', '1:a?',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                '-shortest',
                'output.mp4'
            ];

            const runEncode = async (ff) => {
                try {
                    await ff.exec(encodeArgs);
                } catch (execErr) {
                    const msg = String(execErr);
                    const isAbort = msg.includes('Aborted') || msg.includes('exit') || msg.includes('unreachable');
                    if (!isAbort) throw execErr;
                    addLog('[System] FFmpeg encode exited (ST WASM normal). Reading output...');
                }
                // Try to read output from the same instance (FS is JS-side, may survive abort)
                return await ff.readFile('output.mp4');
            };

            let outputData;
            try {
                outputData = await runEncode(ffmpeg);
            } catch (firstErr) {
                // FS wasn't readable — spawn fresh instance and re-encode from saved blobs
                addLog('[System] Re-encoding on fresh FFmpeg instance...');
                ffmpegInstance = null;
                const freshFfmpeg = await getFFmpeg();
                const { fetchFile: fetchFile2 } = window.FFmpegUtil;
                await freshFfmpeg.writeFile('input.mp4', await fetchFile2(currentVideoFile));
                for (let fi = 0; fi < enhancedFrameBlobs.length; fi++) {
                    const fn = `enhanced_${(fi + 1).toString().padStart(4, '0')}.jpg`;
                    const ab = await enhancedFrameBlobs[fi].arrayBuffer();
                    await freshFfmpeg.writeFile(fn, new Uint8Array(ab));
                }
                ffmpeg = freshFfmpeg;
                outputData = await runEncode(freshFfmpeg);
            }

            setProgress(97, 'Reading output...');
            const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

            if (renderedVideoSrc) URL.revokeObjectURL(renderedVideoSrc);
            renderedVideoSrc = URL.createObjectURL(outputBlob);

            // Cleanup FFmpeg virtual files
            for (const file of extractedFrames) {
                try { await ffmpeg.deleteFile(file); } catch (e) {}
            }
            for (const file of enhancedFrames) {
                try { await ffmpeg.deleteFile(file); } catch (e) {}
            }
            try { await ffmpeg.deleteFile('input.mp4'); } catch (e) {}
            try { await ffmpeg.deleteFile('output.mp4'); } catch (e) {}

            setProgress(100, 'Complete');
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            addLog(`[System] Enhancement complete in ${elapsed}s!`);
            appState = 'completed';
            completedVideo.src = renderedVideoSrc;
            completedVideo.classList.remove('hidden');
            completedImage.classList.add('hidden');
            completedPanel.classList.remove('hidden');
            btnDownload.classList.remove('hidden');
            btnCancel.classList.add('hidden');
            workspace.classList.add('hidden');
            logsContainer.classList.add('hidden');
            progressContainer.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.add('hidden');
            video.currentTime = originalTime;

            // Automatically download video when finished
            const a = document.createElement('a');
            a.href = renderedVideoSrc;
            a.download = 'enhanced_video.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            if (err.message === 'Cancelled') {
                addLog('[System] Cancelled.');
            } else {
                addLog(`[Fatal Error] ${err.message}`);
            }
            appState = 'ready';
            progressContainer.classList.add('hidden');
            setProgress(0, '');
            btnCancel.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.remove('hidden');
            
            // Cleanup on crash/cancel
            for (const file of extractedFrames) {
                try { await ffmpeg.deleteFile(file); } catch (e) {}
            }
            for (const file of enhancedFrames) {
                try { await ffmpeg.deleteFile(file); } catch (e) {}
            }
            try { await ffmpeg.deleteFile('input.mp4'); } catch (e) {}
            try { await ffmpeg.deleteFile('output.mp4'); } catch (e) {}
        } finally {
            setCardControlsEnabled(true);
        }
    }

    gpuEnhancer = new UpscaleGpuEnhancer();
    gpuReady = gpuEnhancer.init();
    gpuStatus.textContent = `GPU Canvas: ${gpuReady ? 'Ready' : 'Unavailable'}`;
    gpuDot.classList.toggle('ready', gpuReady);

    engine = new UpscaleEngine(video, canvas);
    const engineCheck = setInterval(() => {
        if (engine.isReady) {
            engineStatus.textContent = `AI Engine: ${engine.workerInfo || 'Ready'}`;
            engineDot.classList.add('ready');
            btnPreview.disabled = false;
            btnEnhance.disabled = false;
            clearInterval(engineCheck);
        }
    }, 500);

    btnPreview.disabled = true;
    btnEnhance.disabled = true;
    updateTransform();
});
