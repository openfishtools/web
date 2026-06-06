document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('upscale-video-card');
    if (!card) return;

    const dropArea = document.getElementById('upscale-drop-area');
    const fileInput = document.getElementById('upscale-file-input');
    const workspace = document.getElementById('upscale-workspace');
    const video = document.getElementById('upscale-video');
    const canvas = document.getElementById('upscale-canvas');
    const comparisonContainer = document.getElementById('upscale-comparison-container');
    const canvasClip = document.getElementById('upscale-canvas-clip');
    const sliderLine = document.getElementById('upscale-slider-line');
    const sliderLabelLeft = document.getElementById('upscale-slider-label-left');
    const zoomBadge = document.getElementById('upscale-zoom-badge');
    const timeline = document.getElementById('upscale-timeline');
    const timeCurrent = document.getElementById('upscale-time-current');
    const timeDuration = document.getElementById('upscale-time-duration');
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
    const checkingScreen = document.getElementById('upscale-checking-screen');
    const engineStatus = document.getElementById('upscale-engine-status');
    const engineDot = document.getElementById('upscale-engine-dot');
    const gpuStatus = document.getElementById('upscale-gpu-status');
    const gpuDot = document.getElementById('upscale-gpu-dot');
    const webcodecsStatus = document.getElementById('upscale-webcodecs-status');
    const webcodecsDot = document.getElementById('upscale-webcodecs-dot');
    const presetList = document.getElementById('upscale-preset-list');

    const PRESETS = [
        { id: 'cartoonist', name: 'Cartoonist', sharpen: 14, unsharpAmount: 107, unsharpRadius: 5.1, denoise: 2.9, shadows: 2, saturation: 1 },
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
    let videoSrc = null;
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
    let cancelRender = false;
    let enhanceCanvas = null;
    let gpuEnhancer = null;
    let gpuReady = false;
    let currentVideoFile = null;
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
                        const w = this.video.videoWidth * factor;
                        const h = this.video.videoHeight * factor;
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
            const width = source.videoWidth || source.width || 0;
            const height = source.videoHeight || source.height || 0;
            if (!width || !height) throw new Error('Source dimensions are 0.');

            if (!this.offscreenCanvas) this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
            const ctx = this.offscreenCanvas.getContext('2d');
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
        canvasClip.style.clipPath = `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`;
        sliderLine.style.left = `${sliderPos}%`;
        comparisonContainer.querySelector('.upscale-comparison-wrapper').classList.toggle('zoomed', zoom > 1);
        zoomBadge.classList.toggle('hidden', zoom <= 1);
        zoomBadge.textContent = `Zoom: ${zoom}x`;
        btnZoom.textContent = `Zoom: ${zoom}x`;
    }

    function updateSliderLabel() {
        if (isPreviewed) {
            sliderLabelLeft.textContent = 'Enhanced + 4x AI';
        } else if (enhanceOrder === 'before') {
            sliderLabelLeft.textContent = 'Live Enhanced (1x)';
        } else {
            sliderLabelLeft.textContent = 'Original (1x)';
        }
    }

    function drawGpuPreview() {
        if (!video || !canvas || isPreviewed || appState !== 'ready') return;
        if (!video.videoWidth || video.readyState < 2) return;
        const params = getPresetParams(activePreset);
        if (enhanceOrder === 'before') {
            gpuEnhancer.process(video, params, canvas);
        } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
        }
        updateSliderLabel();
    }

    function showWorkspace() {
        dropArea.classList.add('hidden');
        workspace.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        if (btnReset) btnReset.classList.remove('hidden');
        if (btnEnhance) btnEnhance.classList.remove('hidden');
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
        if (engineStatus) engineStatus.textContent = 'AI Engine: Checking...';

        if (gpuDot) {
            gpuDot.textContent = 'sync';
            gpuDot.style.color = 'var(--md-sys-color-primary)';
            gpuDot.classList.add('upscale-spinner');
        }
        if (gpuStatus) gpuStatus.textContent = 'GPU Canvas: Checking...';

        if (webcodecsDot) {
            webcodecsDot.textContent = 'sync';
            webcodecsDot.style.color = 'var(--md-sys-color-primary)';
            webcodecsDot.classList.add('upscale-spinner');
        }
        if (webcodecsStatus) webcodecsStatus.textContent = 'WebCodecs (VideoEncoder): Checking...';

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
                if (gpuStatus) gpuStatus.textContent = 'GPU Canvas: Ready';
            } else {
                if (gpuDot) {
                    gpuDot.textContent = 'cancel';
                    gpuDot.style.color = '#F44336';
                    gpuDot.classList.remove('upscale-spinner');
                }
                if (gpuStatus) gpuStatus.textContent = 'GPU Canvas: Unavailable';
            }

            // Check FFmpeg WASM
            const ffmpegReady = !!window.FFmpegWASM;
            if (ffmpegReady) {
                if (webcodecsDot) {
                    webcodecsDot.textContent = 'check_circle';
                    webcodecsDot.style.color = '#4CAF50';
                    webcodecsDot.classList.remove('upscale-spinner');
                }
                if (webcodecsStatus) webcodecsStatus.textContent = 'FFmpeg WASM: Ready';
            } else {
                if (webcodecsDot) {
                    webcodecsDot.textContent = 'cancel';
                    webcodecsDot.style.color = '#F44336';
                    webcodecsDot.classList.remove('upscale-spinner');
                }
                if (webcodecsStatus) webcodecsStatus.textContent = 'FFmpeg WASM: Unavailable';
            }

            // Check AI Engine
            const aiReady = engine && engine.isReady;
            if (aiReady) {
                if (engineDot) {
                    engineDot.textContent = 'check_circle';
                    engineDot.style.color = '#4CAF50';
                    engineDot.classList.remove('upscale-spinner');
                }
                if (engineStatus) engineStatus.textContent = 'AI Engine: Ready';
            } else {
                if (attempts > 10) {
                    if (engineDot) {
                        engineDot.textContent = 'cancel';
                        engineDot.style.color = '#F44336';
                        engineDot.classList.remove('upscale-spinner');
                    }
                    if (engineStatus) engineStatus.textContent = 'AI Engine: Timeout/Failed';
                }
            }

            if ((aiReady || attempts > 10) && (gpuReady || attempts > 10)) {
                clearInterval(interval);
                
                setTimeout(() => {
                    checkingScreen.classList.add('hidden');
                    showWorkspace();
                    updateTransform();
                }, 1000);
            }
        }, 500);
    }

    function loadVideoFile(file) {
        if (!file || !file.type.startsWith('video/')) return;
        currentVideoFile = file;
        if (videoSrc) URL.revokeObjectURL(videoSrc);
        videoSrc = URL.createObjectURL(file);
        video.src = videoSrc;
        isPreviewed = false;
        zoom = 1;
        pan = { x: 0, y: 0 };
        appState = 'ready';
        completedPanel.classList.add('hidden');
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

    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadVideoFile(e.target.files[0]);
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
        if (file) loadVideoFile(file);
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

    sliderLine.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isSliding = true;
    });

    comparisonContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.upscale-slider-line')) return;
        if (zoom > 1) {
            isPanning = true;
            dragStart = { x: e.clientX, y: e.clientY };
        }
    });

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

    window.addEventListener('mouseup', () => {
        isSliding = false;
        isPanning = false;
    });

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
            if (video.readyState < 2) {
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
                await engine.renderFrame(video, onFrameProgress);
                if (!enhanceCanvas) enhanceCanvas = document.createElement('canvas');
                gpuEnhancer.process(canvas, params, enhanceCanvas);
                canvas.getContext('2d').drawImage(enhanceCanvas, 0, 0);
            }
            setProgress(100, 'Preview Ready');
            btnPreview.classList.add('active');
            updateSliderLabel();
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            addLog(`[Preview] Frame upscaled successfully in ${elapsed}s.`);
            
            // Keep the progress bar visible at 100% for a brief moment before hiding
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
    btnCancel.addEventListener('click', () => { cancelRender = true; });

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (videoSrc) URL.revokeObjectURL(videoSrc);
            if (renderedVideoSrc) URL.revokeObjectURL(renderedVideoSrc);
            videoSrc = null;
            renderedVideoSrc = null;
            video.removeAttribute('src');
            video.load();
            isPreviewed = false;
            zoom = 1;
            pan = { x: 0, y: 0 };
            appState = 'import';
            currentVideoFile = null;
            if (ffmpegInstance) {
                try {
                    ffmpegInstance.deleteFile('input.mp4').catch(()=>{});
                    ffmpegInstance.deleteFile('output.mp4').catch(()=>{});
                } catch(e){}
            }
            dropArea.classList.remove('hidden');
            workspace.classList.add('hidden');
            completedPanel.classList.add('hidden');
            progressContainer.classList.add('hidden');
            setProgress(0, '');
            logsContainer.classList.add('hidden');
            logsEl.textContent = '';
            btnCancel.classList.add('hidden');
            btnDownload.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.add('hidden');
            fileInput.value = '';
        });
    }

    btnDownload.addEventListener('click', () => {
        if (!renderedVideoSrc) return;
        const a = document.createElement('a');
        a.href = renderedVideoSrc;
        a.download = 'enhanced_video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    async function getFFmpeg() {
        if (ffmpegInstance) return ffmpegInstance;
        const { FFmpeg } = window.FFmpegWASM;
        const { toBlobURL } = window.FFmpegUtil;
        let ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg Log]', message);
        });
        const baseURL = window.location.origin + '/assets/ffmpeg';
        const isMultiThread = typeof SharedArrayBuffer !== 'undefined';
        let loaded = false;

        if (isMultiThread) {
            try {
                console.log('Attempting to load multi-threaded FFmpeg...');
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                await ffmpeg.load({ coreURL, wasmURL, workerURL });
                loaded = true;
                console.log('Multi-threaded FFmpeg loaded successfully.');
            } catch (err) {
                console.warn('Failed to load multi-threaded FFmpeg, falling back to single-threaded:', err);
                ffmpeg = new FFmpeg();
                ffmpeg.on('log', ({ message }) => {
                    console.log('[FFmpeg Log]', message);
                });
            }
        }

        if (!loaded) {
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
        }

        ffmpegInstance = ffmpeg;
        return ffmpeg;
    }

    async function handleRender() {
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
        addLog('[System] Extracting and upscaling frames...');

        const fps = 30;
        const frameInterval = 1 / fps;
        let renderTime = 0;
        let frameCount = 0;
        const totalFrames = Math.ceil(video.duration * fps);
        const originalTime = video.currentTime;
        const params = getPresetParams(activePreset);
        const orderBefore = enhanceOrder === 'before';

        const writtenFrames = [];

        try {
            while (renderTime < video.duration) {
                if (cancelRender) {
                    addLog('[System] Cancelled.');
                    video.currentTime = originalTime;
                    appState = 'ready';
                    progressContainer.classList.add('hidden');
                    setProgress(0, '');
                    btnCancel.classList.add('hidden');
                    if (btnEnhance) btnEnhance.classList.remove('hidden');
                    setCardControlsEnabled(true);
                    
                    // Cleanup files
                    for (const file of writtenFrames) {
                        try { await ffmpeg.deleteFile(file); } catch (e) {}
                    }
                    return;
                }

                video.currentTime = renderTime;
                await new Promise((resolve) => {
                    let timeoutId;
                    const checkReady = () => {
                        if (video.readyState >= 2) {
                            video.removeEventListener('seeked', checkReady);
                            video.removeEventListener('canplay', checkReady);
                            clearTimeout(timeoutId);
                            resolve();
                        } else {
                            setTimeout(checkReady, 5);
                        }
                    };
                    video.addEventListener('seeked', checkReady);
                    video.addEventListener('canplay', checkReady);
                    timeoutId = setTimeout(() => {
                        video.removeEventListener('seeked', checkReady);
                        video.removeEventListener('canplay', checkReady);
                        resolve();
                    }, 300);
                });

                if (video.videoWidth === 0 || video.readyState < 2) {
                    renderTime += frameInterval;
                    continue;
                }

                const onFrameProgress = (frameProgress) => {
                    const overallPct = (totalFrames && totalFrames > 0 && !isNaN(totalFrames)) 
                        ? Math.min(85, Math.round(((frameCount + (frameProgress / 100)) / totalFrames) * 85)) 
                        : 0;
                    setProgress(overallPct, `Frame ${frameCount}/${totalFrames || '?'} (${frameProgress.toFixed(0)}%)`);
                };

                if (orderBefore) {
                    gpuEnhancer.process(video, params, enhanceCanvas);
                    await engine.renderFrame(enhanceCanvas, onFrameProgress);
                } else {
                    await engine.renderFrame(video, onFrameProgress);
                    gpuEnhancer.process(canvas, params, enhanceCanvas);
                    canvas.getContext('2d').drawImage(enhanceCanvas, 0, 0);
                }

                // Convert canvas to Blob and write to FFmpeg virtual FS
                const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
                const arrayBuffer = await blob.arrayBuffer();
                const filename = `frame_${frameCount.toString().padStart(4, '0')}.jpg`;
                await ffmpeg.writeFile(filename, new Uint8Array(arrayBuffer));
                writtenFrames.push(filename);

                const pct = (totalFrames && totalFrames > 0 && !isNaN(totalFrames)) 
                    ? Math.min(85, Math.round((frameCount / totalFrames) * 85)) 
                    : 0;
                setProgress(pct, `Frame ${frameCount}/${totalFrames || '?'}`);
                if (frameCount % 10 === 0) addLog(`[Process] Rendered frame ${frameCount}/${totalFrames} (${pct}%)`);
                renderTime += frameInterval;
                frameCount++;
            }

            addLog('[System] Frame extraction complete. Encoding video using FFmpeg WASM...');
            setProgress(88, 'Encoding video...');

            // Write original video file for audio extraction/merge
            const { fetchFile } = window.FFmpegUtil;
            await ffmpeg.writeFile('input.mp4', await fetchFile(currentVideoFile));

            // Exec FFmpeg to combine images and overlay audio
            await ffmpeg.exec([
                '-r', fps.toString(),
                '-i', 'frame_%04d.jpg',
                '-i', 'input.mp4',
                '-map', '0:v',
                '-map', '1:a?',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                '-shortest',
                'output.mp4'
            ]);

            setProgress(97, 'Reading output...');
            const data = await ffmpeg.readFile('output.mp4');
            const outputBlob = new Blob([data.buffer], { type: 'video/mp4' });

            if (renderedVideoSrc) URL.revokeObjectURL(renderedVideoSrc);
            renderedVideoSrc = URL.createObjectURL(outputBlob);

            // Cleanup FFmpeg virtual files
            for (const file of writtenFrames) {
                try { await ffmpeg.deleteFile(file); } catch (e) {}
            }
            try { await ffmpeg.deleteFile('input.mp4'); } catch (e) {}
            try { await ffmpeg.deleteFile('output.mp4'); } catch (e) {}

            setProgress(100, 'Complete');
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            addLog(`[System] Enhancement complete in ${elapsed}s!`);
            appState = 'completed';
            completedVideo.src = renderedVideoSrc;
            completedPanel.classList.remove('hidden');
            btnDownload.classList.remove('hidden');
            btnCancel.classList.add('hidden');
            workspace.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.add('hidden');
            video.currentTime = originalTime;
        } catch (err) {
            addLog(`[Fatal Error] ${err.message}`);
            appState = 'ready';
            progressContainer.classList.add('hidden');
            setProgress(0, '');
            btnCancel.classList.add('hidden');
            if (btnEnhance) btnEnhance.classList.remove('hidden');
            
            // Cleanup on crash
            for (const file of writtenFrames) {
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
