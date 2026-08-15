document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('rembg-card');
    if (!card) return;

    const dropArea = document.getElementById('rembg-drop-area');
    const fileInput = document.getElementById('rembg-file-input');
    const workspace = document.getElementById('rembg-workspace');

    const comparisonContainer = document.getElementById('rembg-comparison-container');
    const comparisonWrapper = document.getElementById('rembg-comparison-wrapper');
    const originalClip = document.getElementById('rembg-original-clip');
    const canvasClip = document.getElementById('rembg-canvas-clip');
    const sliderLine = document.getElementById('rembg-slider-line');
    const unprocessedOverlay = document.getElementById('rembg-unprocessed-overlay');
    const zoomBadge = document.getElementById('rembg-zoom-badge');
    const sliderLabelRight = document.getElementById('rembg-slider-label-right');

    const videoEl = document.getElementById('rembg-video');
    const imageEl = document.getElementById('rembg-image');
    const canvasEl = document.getElementById('rembg-canvas');

    const modelBtns = document.querySelectorAll('#rembg-model-list .upscale-preset-btn');
    const hwBtns = document.querySelectorAll('#rembg-hw-switches .upscale-order-btn');
    const hwGpuBtn = document.getElementById('rembg-hw-gpu-btn');
    const bgBtns = document.querySelectorAll('#rembg-bg-list .upscale-preset-btn');

    const colorPickerRow = document.getElementById('rembg-color-picker-row');
    const colorInput = document.getElementById('rembg-color-input');
    const colorText = document.getElementById('rembg-color-text');
    const blurRow = document.getElementById('rembg-blur-row');
    const blurRange = document.getElementById('rembg-blur-range');
    const blurVal = document.getElementById('rembg-blur-val');
    const imageRow = document.getElementById('rembg-image-row');
    const bgImgDrop = document.getElementById('rembg-bg-img-drop');
    const bgImgInput = document.getElementById('rembg-bg-img-input');
    const bgImgLabel = document.getElementById('rembg-bg-img-label');

    const rvmControls = document.getElementById('rembg-rvm-controls');
    const rvmScaleSlider = document.getElementById('rembg-rvm-scale');
    const rvmScaleVal = document.getElementById('rembg-rvm-scale-val');
    const rvmDownsampleSlider = document.getElementById('rembg-rvm-downsample');
    const rvmDownsampleVal = document.getElementById('rembg-rvm-downsample-val');

    const modnetControls = document.getElementById('rembg-modnet-controls');
    const modnetBoostSlider = document.getElementById('rembg-modnet-boost');
    const modnetBoostVal = document.getElementById('rembg-modnet-boost-val');
    const modnetCutoffSlider = document.getElementById('rembg-modnet-cutoff');
    const modnetCutoffVal = document.getElementById('rembg-modnet-cutoff-val');

    const durationContainer = document.getElementById('rembg-duration-container');
    const timeCurrent = document.getElementById('rembg-time-current');
    const timeDuration = document.getElementById('rembg-time-duration');
    const timeline = document.getElementById('rembg-timeline');

    const btnZoom = document.getElementById('rembg-btn-zoom');
    const btnPreview = document.getElementById('rembg-btn-preview');

    const checkingScreen = document.getElementById('rembg-checking-screen');
    const engineDot = document.getElementById('rembg-engine-dot');
    const engineStatus = document.getElementById('rembg-engine-status');
    const gpuDot = document.getElementById('rembg-gpu-dot');
    const gpuStatus = document.getElementById('rembg-gpu-status');
    const ffmpegDot = document.getElementById('rembg-ffmpeg-dot');
    const ffmpegStatus = document.getElementById('rembg-ffmpeg-status');

    const logsContainer = document.getElementById('rembg-logs-container');
    const logsEl = document.getElementById('rembg-logs');
    const btnCopyLogs = document.getElementById('btn-rembg-copy-logs');

    const progressContainer = document.getElementById('rembg-progress-container');
    const progressFill = document.getElementById('rembg-progress-fill');
    const progressText = document.getElementById('rembg-progress-text');
    const progressPercent = document.getElementById('rembg-progress-percent');

    const btnProcess = document.getElementById('rembg-btn-process');
    const btnCancel = document.getElementById('rembg-btn-cancel');
    const btnReset = document.getElementById('rembg-btn-reset');

    const MODEL_CONFIGS = {
        'selfie_segmenter': {
            id: 'selfie_segmenter',
            name: 'MediaPipe Selfie Segmenter (~1 MB)',
            localPath: 'assets/models/selfie_segmenter.onnx',
            remoteUrls: [
                'https://huggingface.co/onnx-community/mediapipe_selfie_segmentation/resolve/main/onnx/model.onnx',
                'https://hf-mirror.com/onnx-community/mediapipe_selfie_segmentation/resolve/main/onnx/model.onnx'
            ],
            type: 'selfie',
            inputWidth: 256,
            inputHeight: 256,
            dynamicSize: false,
            normalization: 'standard'
        },
        'rvm_mobilenetv3': {
            id: 'rvm_mobilenetv3',
            name: 'Robust Video Matting (~15 MB)',
            localPath: 'assets/models/rvm_mobilenetv3_fp32.onnx',
            remoteUrls: [
                'https://huggingface.co/LPDoctor/video_matting/resolve/main/rvm_mobilenetv3_fp32.onnx',
                'https://huggingface.co/eafish/web-onnx/resolve/main/rvm_mobilenetv3_fp32.onnx',
                'https://hf-mirror.com/LPDoctor/video_matting/resolve/main/rvm_mobilenetv3_fp32.onnx'
            ],
            type: 'rvm',
            inputWidth: 512,
            inputHeight: 512,
            dynamicSize: true,
            normalization: 'standard'
        },
        'modnet': {
            id: 'modnet',
            name: 'MODNet Photographic Matting (~25 MB)',
            localPath: 'assets/models/modnet.onnx',
            remoteUrls: [
                'https://huggingface.co/gradio/Modnet/resolve/main/modnet.onnx',
                'https://huggingface.co/TheEeeeLin/HivisionIDPhotos_matting/resolve/main/modnet_photographic_portrait_matting.onnx',
                'https://hf-mirror.com/gradio/Modnet/resolve/main/modnet.onnx'
            ],
            type: 'modnet',
            inputWidth: 512,
            inputHeight: 512,
            dynamicSize: false,
            normalization: 'modnet'
        }
    };

    let selectedFile = null;
    let fileType = 'video';
    let selectedModelId = 'selfie_segmenter';
    let selectedHw = 'cpu';
    let isWebGpuSupported = false;
    let bgMode = 'transparent';
    let solidColor = '#0842a0';
    let blurAmount = 20;
    let customBgImage = null;

    let isProcessing = false;
    let cancelProcessing = false;
    let isPreviewed = false;
    let lastMatteResult = null;
    let currentSession = null;
    let currentSessionModelId = null;
    let currentSessionProvider = null;
    let ffmpegInstance = null;

    let zoom = 1;
    let pan = { x: 0, y: 0 };
    let isPanning = false;
    let isSliding = false;
    let isPinching = false;
    let sliderPos = 50;
    let dragStart = { x: 0, y: 0 };
    let initialPinchDist = 0;
    let initialZoom = 1;

    let recurrentStates = null;
    let prevAlpha = null;
    let floatBuffer = null;
    let alphaOutBuffer = null;
    let cachedBufferCap = 0;

    const inputCanvas = document.createElement('canvas');
    const inputCtx = inputCanvas.getContext('2d', { willReadFrequently: true, alpha: false });
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    const fgCanvas = document.createElement('canvas');
    const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true });

    let maskImgData = null;
    let maskUint32 = null;

    const alphaLUT = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        alphaLUT[i] = (i << 24) | 0x00FFFFFF;
    }

    function appendLog(msg) {
        if (!logsEl) return;
        const time = new Date().toTimeString().split(' ')[0];
        const line = document.createElement('div');
        line.textContent = `[${time}] ${msg}`;
        logsEl.appendChild(line);
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    if (btnCopyLogs) {
        btnCopyLogs.addEventListener('click', () => {
            if (!logsEl) return;
            const textToCopy = logsEl.innerText || logsEl.textContent || '';
            const setSuccessLabel = () => {
                const label = document.getElementById('btn-rembg-copy-logs-label');
                if (label) {
                    const original = label.textContent;
                    label.textContent = 'Copied!';
                    setTimeout(() => { label.textContent = original; }, 1500);
                }
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy)
                    .then(setSuccessLabel)
                    .catch(() => {
                        const textarea = document.createElement('textarea');
                        textarea.value = textToCopy;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        setSuccessLabel();
                    });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                setSuccessLabel();
            }
        });
    }

    async function loadFFmpegLibraries() {
        if (window.FFmpegWASM && window.FFmpegUtil) return true;
        if (typeof window.loadFFmpegLibraries === 'function') {
            const ok = await window.loadFFmpegLibraries();
            if (ok) return true;
        }

        const loadScript = (src) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });

        try {
            if (!window.FFmpegUtil) {
                await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
            }
            if (!window.FFmpegWASM) {
                const [ffmpegRes, workerRes] = await Promise.all([
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'),
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js')
                ]);
                if (ffmpegRes.ok && workerRes.ok) {
                    const ffmpegCode = await ffmpegRes.text();
                    const workerCode = await workerRes.text();
                    const stripSourceMap = code => code.replace(/\/\/# sourceMappingURL=\S+/g, '');
                    const workerBlobUrl = URL.createObjectURL(new Blob([stripSourceMap(workerCode)], { type: 'text/javascript' }));
                    const patchedCode = stripSourceMap(ffmpegCode)
                        .replace(/new Worker\(new URL\(e\.p\+e\.u\(814\),e\.b\),\{type:void 0\}\)/g, `new Worker("${workerBlobUrl}")`)
                        .replace(/u:e=>e+"\.\x66\x66\x6d\x70\x65\x67\.\x6a\x73"/g, `u:()=>"${workerBlobUrl}"`)
                        .replace(/u:e=>e+"\x2effmpeg\x2ejs"/g, `u:()=>"${workerBlobUrl}"`);
                    const ffmpegBlobUrl = URL.createObjectURL(new Blob([patchedCode], { type: 'text/javascript' }));
                    await loadScript(ffmpegBlobUrl);
                }
            }
            if (window.FFmpegWASM && window.FFmpegUtil) return true;
        } catch (cdnErr) {}

        try {
            if (!window.FFmpegWASM) await loadScript('assets/ffmpeg/ffmpeg.js');
            if (!window.FFmpegUtil) await loadScript('assets/ffmpeg/index.js');
            if (window.FFmpegWASM && window.FFmpegUtil) return true;
        } catch (localErr) {}

        return !!(window.FFmpegWASM && window.FFmpegUtil);
    }

    function setCardControlsEnabled(enabled) {
        card.querySelectorAll('button, input, select').forEach(el => {
            if (el.id === 'rembg-btn-cancel' || el.id === 'rembg-file-input') return;
            if (enabled) {
                if (el.id === 'rembg-hw-gpu-btn' && !isWebGpuSupported) {
                    el.setAttribute('disabled', 'true');
                    el.classList.add('disabled');
                    return;
                }
                el.removeAttribute('disabled');
                el.classList.remove('disabled');
            } else {
                el.setAttribute('disabled', 'true');
                el.classList.add('disabled');
            }
        });

        const pointerEvents = enabled ? 'auto' : 'none';
        const opacity = enabled ? '1' : '0.55';

        const controls = card.querySelector('.upscale-controls');
        if (controls) {
            controls.style.pointerEvents = pointerEvents;
            controls.style.opacity = opacity;
        }

        if (comparisonContainer) {
            comparisonContainer.style.pointerEvents = enabled ? 'auto' : 'none';
        }
    }

    function updateTransform() {
        const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        card.querySelectorAll('.upscale-transform-layer').forEach(el => {
            el.style.transform = transform;
        });
        if (originalClip) {
            originalClip.style.clipPath = isPreviewed
                ? `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                : 'none';
        }
        if (canvasClip) {
            canvasClip.style.clipPath = `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`;
        }
        if (sliderLine) sliderLine.style.left = `${sliderPos}%`;
        if (comparisonWrapper) comparisonWrapper.classList.toggle('zoomed', zoom > 1);
        if (zoomBadge) {
            zoomBadge.classList.toggle('hidden', zoom <= 1);
            zoomBadge.textContent = `Zoom: ${zoom}x`;
        }
        if (btnZoom) btnZoom.textContent = `Zoom: ${zoom}x`;
    }

    function markUnprocessed() {
        isPreviewed = false;
        lastMatteResult = null;
        if (btnPreview) btnPreview.classList.remove('active');
        if (unprocessedOverlay) unprocessedOverlay.classList.add('show');
        if (sliderLabelRight) sliderLabelRight.textContent = 'Unprocessed';
        if (comparisonContainer) {
            comparisonContainer.classList.remove('checkerboard');
        }
        if (canvasEl) {
            const ctx = canvasEl.getContext('2d');
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        }
        updateTransform();
    }

    function reapplyBackgroundIfPreviewed() {
        if (isPreviewed && lastMatteResult) {
            if (comparisonContainer) {
                comparisonContainer.classList.toggle('checkerboard', bgMode === 'transparent');
            }
            const sourceEl = fileType === 'video' ? videoEl : imageEl;
            renderMatteToCanvas(canvasEl, sourceEl, lastMatteResult);
        }
    }

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
            const touch = e.touches[0];
            const dx = touch.clientX - dragStart.x;
            const dy = touch.clientY - dragStart.y;
            pan = { x: pan.x + dx, y: pan.y + dy };
            dragStart = { x: touch.clientX, y: touch.clientY };
            updateTransform();
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
        if (!selectedFile) return;
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        const next = Math.max(1, Math.min(8, zoom + dir * 0.15));
        if (next === 1) pan = { x: 0, y: 0 };
        zoom = Math.round(next * 100) / 100;
        updateTransform();
    }, { passive: false });

    if (btnZoom) {
        btnZoom.addEventListener('click', () => {
            if (zoom === 1) zoom = 2;
            else if (zoom === 2) zoom = 4;
            else { zoom = 1; pan = { x: 0, y: 0 }; }
            updateTransform();
        });
    }

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    if (videoEl) {
        videoEl.addEventListener('loadedmetadata', () => {
            if (timeDuration) timeDuration.textContent = formatTime(videoEl.duration);
            if (timeline) {
                timeline.max = videoEl.duration || 100;
                timeline.value = 0;
            }
            if (timeCurrent) timeCurrent.textContent = '0:00';
            videoEl.currentTime = 0;
            sliderPos = 50;
            updateTransform();
        });

        videoEl.addEventListener('timeupdate', () => {
            if (timeline && videoEl.duration) {
                timeline.value = videoEl.currentTime;
                if (timeCurrent) timeCurrent.textContent = formatTime(videoEl.currentTime);
            }
        });
    }

    if (timeline) {
        timeline.addEventListener('input', () => {
            if (videoEl && videoEl.duration) {
                videoEl.currentTime = parseFloat(timeline.value);
                if (timeCurrent) timeCurrent.textContent = formatTime(videoEl.currentTime);
                markUnprocessed();
            }
        });
    }

    modelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isProcessing) return;
            modelBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedModelId = btn.getAttribute('data-model');
            rvmControls.classList.toggle('hidden', selectedModelId !== 'rvm_mobilenetv3');
            modnetControls.classList.toggle('hidden', selectedModelId !== 'modnet');
            appendLog(`Model AI: ${MODEL_CONFIGS[selectedModelId].name}`);
            markUnprocessed();
        });
    });

    hwBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isProcessing) return;
            const hw = btn.getAttribute('data-hw');
            if (hw === 'gpu' && !isWebGpuSupported) return;
            hwBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedHw = hw;
            currentSession = null;
            appendLog(`Akselerasi: ${selectedHw.toUpperCase()}`);
            markUnprocessed();
        });
    });

    bgBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            bgBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            bgMode = btn.getAttribute('data-bg');

            colorPickerRow.classList.toggle('hidden', bgMode !== 'color');
            blurRow.classList.toggle('hidden', bgMode !== 'blur');
            imageRow.classList.toggle('hidden', bgMode !== 'image');

            reapplyBackgroundIfPreviewed();
        });
    });

    colorInput.addEventListener('input', (e) => {
        solidColor = e.target.value;
        colorText.value = e.target.value;
        reapplyBackgroundIfPreviewed();
    });

    colorText.addEventListener('input', (e) => {
        solidColor = e.target.value;
        colorInput.value = e.target.value;
        reapplyBackgroundIfPreviewed();
    });

    blurRange.addEventListener('input', (e) => {
        blurAmount = parseInt(e.target.value, 10);
        blurVal.textContent = `${blurAmount}px`;
        reapplyBackgroundIfPreviewed();
    });

    bgImgDrop.addEventListener('click', () => bgImgInput.click());
    bgImgInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                customBgImage = img;
                bgImgLabel.textContent = file.name;
                reapplyBackgroundIfPreviewed();
            };
        }
    });

    rvmScaleSlider.addEventListener('input', (e) => {
        rvmScaleVal.textContent = `${Math.round(e.target.value * 100)}% (HD)`;
        markUnprocessed();
    });

    rvmDownsampleSlider.addEventListener('input', (e) => {
        rvmDownsampleVal.textContent = e.target.value;
        markUnprocessed();
    });

    modnetBoostSlider.addEventListener('input', (e) => {
        modnetBoostVal.textContent = `${e.target.value}%`;
        markUnprocessed();
    });

    modnetCutoffSlider.addEventListener('input', (e) => {
        modnetCutoffVal.textContent = `${e.target.value}%`;
        markUnprocessed();
    });

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('dragover');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    });

    async function checkSystemCompatibility() {
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
        if (gpuStatus) gpuStatus.textContent = 'Hardware: Checking WebGPU...';

        if (ffmpegDot) {
            ffmpegDot.textContent = 'sync';
            ffmpegDot.style.color = 'var(--md-sys-color-primary)';
            ffmpegDot.classList.add('upscale-spinner');
        }
        if (ffmpegStatus) ffmpegStatus.textContent = fileType === 'video' ? 'FFmpeg: Initializing...' : 'FFmpeg: Ready';

        let hasWebGPU = false;
        if (navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) hasWebGPU = true;
            } catch (e) {
                hasWebGPU = false;
            }
        }
        isWebGpuSupported = hasWebGPU;

        if (engineDot) {
            engineDot.textContent = 'check_circle';
            engineDot.style.color = '#4CAF50';
            engineDot.classList.remove('upscale-spinner');
        }
        if (engineStatus) engineStatus.textContent = 'AI Engine: Ready';

        if (gpuDot) {
            gpuDot.classList.remove('upscale-spinner');
            if (hasWebGPU) {
                gpuDot.textContent = 'check_circle';
                gpuDot.style.color = '#4CAF50';
                gpuStatus.textContent = 'WebGPU: Tersedia';
                if (hwGpuBtn) {
                    hwGpuBtn.removeAttribute('disabled');
                    hwGpuBtn.classList.remove('disabled');
                    hwGpuBtn.removeAttribute('title');
                }
            } else {
                gpuDot.textContent = 'info';
                gpuDot.style.color = '#FF9800';
                gpuStatus.textContent = 'WebGPU: Tidak Tersedia';
                if (hwGpuBtn) {
                    hwGpuBtn.setAttribute('disabled', 'true');
                    hwGpuBtn.classList.add('disabled');
                    hwGpuBtn.setAttribute('title', 'WebGPU tidak didukung pada browser ini');
                }
            }
        }

        if (ffmpegDot) {
            ffmpegDot.classList.remove('upscale-spinner');
            if (fileType === 'image') {
                ffmpegDot.textContent = 'check_circle';
                ffmpegDot.style.color = '#4CAF50';
                ffmpegStatus.textContent = 'FFmpeg: Ready';
            } else {
                const ffmpegReady = await loadFFmpegLibraries();
                ffmpegDot.textContent = 'check_circle';
                ffmpegDot.style.color = '#4CAF50';
                ffmpegStatus.textContent = 'FFmpeg: Ready';
            }
        }

        await new Promise(r => setTimeout(r, 600));
        checkingScreen.classList.add('hidden');
        workspace.classList.remove('hidden');
        markUnprocessed();
        updateTransform();
    }

    async function handleFile(file) {
        if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
            alert('Silakan pilih file video atau gambar.');
            return;
        }

        selectedFile = file;
        fileType = file.type.startsWith('video/') ? 'video' : 'image';

        dropArea.classList.add('hidden');
        workspace.classList.add('hidden');
        checkingScreen.classList.remove('hidden');
        btnProcess.classList.remove('hidden');
        btnCancel.classList.add('hidden');
        btnReset.classList.add('hidden');
        progressContainer.classList.add('hidden');
        markUnprocessed();

        if (logsEl) logsEl.innerHTML = '';
        logsContainer.classList.remove('hidden');

        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        appendLog(`File dipilih: ${file.name} (${sizeMb} MB)`);

        zoom = 1;
        pan = { x: 0, y: 0 };
        sliderPos = 50;

        if (fileType === 'video') {
            const url = URL.createObjectURL(file);
            videoEl.src = url;
            videoEl.classList.remove('hidden');
            imageEl.classList.add('hidden');
            durationContainer.classList.remove('hidden');
        } else {
            const url = URL.createObjectURL(file);
            imageEl.src = url;
            imageEl.classList.remove('hidden');
            videoEl.classList.add('hidden');
            durationContainer.classList.add('hidden');
            imageEl.onload = () => {
                canvasEl.width = imageEl.naturalWidth || 640;
                canvasEl.height = imageEl.naturalHeight || 480;
                updateTransform();
            };
        }

        await checkSystemCompatibility();
    }

    async function fetchModelBuffer(modelConfig, onProgress) {
        const cacheName = 'chros-offline-assets-v1';
        let cache = null;
        if ('caches' in window) {
            try {
                cache = await caches.open(cacheName);
            } catch (e) {}
        }

        if (cache) {
            try {
                const fullLocalUrl = new URL(modelConfig.localPath, window.location.origin).href;
                const matched = await cache.match(fullLocalUrl) || await cache.match(modelConfig.localPath);
                if (matched) {
                    appendLog(`Memuat ${modelConfig.name} dari offline cache...`);
                    const buf = await matched.arrayBuffer();
                    if (onProgress) onProgress(100, buf.byteLength, buf.byteLength);
                    return buf;
                }
            } catch (e) {}
        }

        const tryFetch = async (url, sourceName) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} from ${sourceName}`);

            const contentLength = response.headers.get('content-length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

            if (!response.body) {
                const buffer = await response.arrayBuffer();
                if (onProgress) onProgress(100, buffer.byteLength, buffer.byteLength);
                return buffer;
            }

            const reader = response.body.getReader();
            let receivedBytes = 0;
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedBytes += value.length;
                if (onProgress) {
                    const pct = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
                    onProgress(pct, receivedBytes, totalBytes);
                }
            }

            const fullBuffer = new Uint8Array(receivedBytes);
            let pos = 0;
            for (const c of chunks) {
                fullBuffer.set(c, pos);
                pos += c.length;
            }

            if (cache) {
                try {
                    const fullLocalUrl = new URL(modelConfig.localPath, window.location.origin).href;
                    const cacheRes = new Response(fullBuffer.buffer, {
                        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(receivedBytes) }
                    });
                    await cache.put(fullLocalUrl, cacheRes.clone());
                    await cache.put(modelConfig.localPath, cacheRes);
                } catch (ce) {}
            }

            return fullBuffer.buffer;
        };

        try {
            return await tryFetch(modelConfig.localPath, 'Local Storage');
        } catch (localErr) {
            appendLog(`Model lokal belum ada, mengunduh dari remote CDN...`);
            let lastErr = null;
            for (const url of (modelConfig.remoteUrls || [])) {
                try {
                    return await tryFetch(url, 'Remote CDN');
                } catch (cdnErr) {
                    lastErr = cdnErr;
                }
            }
            throw lastErr || new Error('Semua remote CDN gagal dihubungi.');
        }
    }

    async function ensureModelSession() {
        const preferred = (selectedHw === 'gpu' && isWebGpuSupported) ? 'auto' : 'wasm';
        if (currentSession && currentSessionModelId === selectedModelId && currentSessionProvider === preferred) {
            return currentSession;
        }

        const modelConfig = MODEL_CONFIGS[selectedModelId];
        appendLog(`Memuat model ONNX [${modelConfig.name}] (${preferred.toUpperCase()})...`);

        if (typeof ort !== 'undefined') {
            ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4);
            ort.env.wasm.simd = true;
            ort.env.wasm.proxy = false;
        }

        const buffer = await fetchModelBuffer(modelConfig, (pct, rec, tot) => {
            const p = Math.round(pct);
            const mb = (rec / (1024 * 1024)).toFixed(1);
            if (progressText) progressText.textContent = `Downloading ${modelConfig.name}: ${p}% (${mb} MB)`;
        });

        let epList = [];
        if (modelConfig.type === 'rvm') {
            epList = ['wasm'];
        } else if (preferred === 'gpu' || preferred === 'auto') {
            epList = [{ name: 'webgpu', powerPreference: 'high-performance' }, 'webgl', 'wasm'];
        } else {
            epList = ['wasm'];
        }

        let session = null;
        let activeEP = 'wasm';

        for (const ep of epList) {
            const epName = typeof ep === 'string' ? ep : ep.name;
            try {
                session = await ort.InferenceSession.create(buffer.slice(0), {
                    executionProviders: [ep],
                    graphOptimizationLevel: 'all'
                });
                activeEP = epName;
                break;
            } catch (err) {}
        }

        if (!session) {
            session = await ort.InferenceSession.create(buffer.slice(0), {
                executionProviders: ['wasm']
            });
            activeEP = 'wasm';
        }

        currentSession = session;
        currentSessionModelId = selectedModelId;
        currentSessionProvider = preferred;
        recurrentStates = {
            r1: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
            r2: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
            r3: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
            r4: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1])
        };
        prevAlpha = null;

        appendLog(`Model AI siap pada backend [${activeEP.toUpperCase()}].`);
        return currentSession;
    }

    async function processMatte(sourceElement, settings = {}) {
        if (!currentSession) return null;
        const modelConfig = MODEL_CONFIGS[selectedModelId];
        const tStart = performance.now();

        const srcW = sourceElement.videoWidth || sourceElement.naturalWidth || sourceElement.width;
        const srcH = sourceElement.videoHeight || sourceElement.naturalHeight || sourceElement.height;
        if (!srcW || !srcH) return null;

        let inferW = modelConfig.inputWidth;
        let inferH = modelConfig.inputHeight;

        if (modelConfig.type === 'selfie') {
            inferW = 256;
            inferH = 256;
        } else if (modelConfig.type === 'modnet') {
            inferW = 512;
            inferH = 512;
        } else if (modelConfig.type === 'rvm') {
            const scale = settings.qualityScale || 1.0;
            inferW = Math.max(256, Math.round((srcW * scale) / 64) * 64);
            inferH = Math.max(256, Math.round((srcH * scale) / 64) * 64);
        }

        if (inputCanvas.width !== inferW || inputCanvas.height !== inferH) {
            inputCanvas.width = inferW;
            inputCanvas.height = inferH;
        }

        inputCtx.imageSmoothingEnabled = true;
        inputCtx.imageSmoothingQuality = 'high';
        inputCtx.drawImage(sourceElement, 0, 0, inferW, inferH);
        const imgData = inputCtx.getImageData(0, 0, inferW, inferH);
        const data = imgData.data;

        const totalPixels = inferW * inferH;
        const tensorSize = 3 * totalPixels;

        if (!floatBuffer || cachedBufferCap < tensorSize) {
            floatBuffer = new Float32Array(tensorSize);
            cachedBufferCap = tensorSize;
        }

        const floatData = floatBuffer;
        const rOffset = 0;
        const gOffset = totalPixels;
        const bOffset = 2 * totalPixels;

        if (modelConfig.type === 'modnet') {
            const inv127 = 1.0 / 127.5;
            for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                floatData[rOffset + i] = data[p] * inv127 - 1.0;
                floatData[gOffset + i] = data[p + 1] * inv127 - 1.0;
                floatData[bOffset + i] = data[p + 2] * inv127 - 1.0;
            }
        } else {
            const inv255 = 1.0 / 255.0;
            for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                floatData[rOffset + i] = data[p] * inv255;
                floatData[gOffset + i] = data[p + 1] * inv255;
                floatData[bOffset + i] = data[p + 2] * inv255;
            }
        }

        const inputTensor = new ort.Tensor('float32', floatData.subarray(0, tensorSize), [1, 3, inferH, inferW]);
        const feeds = {};

        if (modelConfig.type === 'rvm') {
            feeds['src'] = inputTensor;
            feeds['r1i'] = recurrentStates.r1;
            feeds['r2i'] = recurrentStates.r2;
            feeds['r3i'] = recurrentStates.r3;
            feeds['r4i'] = recurrentStates.r4;
            feeds['downsample_ratio'] = new ort.Tensor('float32', new Float32Array([settings.downsampleRatio || 0.25]), [1]);
        } else {
            const inKey = currentSession.inputNames[0];
            feeds[inKey] = inputTensor;
        }

        const results = await currentSession.run(feeds);
        let alphaData = null;
        let maskW = inferW;
        let maskH = inferH;

        if (modelConfig.type === 'rvm') {
            const phaTensor = results['pha'] || results[Object.keys(results).find(k => k.toLowerCase().includes('pha'))];
            const rawPha = phaTensor.data;
            maskW = phaTensor.dims[3] || inferW;
            maskH = phaTensor.dims[2] || inferH;
            const area = maskW * maskH;

            if (!alphaOutBuffer || alphaOutBuffer.length < area) {
                alphaOutBuffer = new Float32Array(area);
            }
            const out = alphaOutBuffer;

            for (let i = 0; i < area; i++) {
                const a = rawPha[i];
                if (a <= 0.02) {
                    out[i] = 0.0;
                } else if (a >= 0.98) {
                    out[i] = 1.0;
                } else {
                    out[i] = a;
                }
            }
            alphaData = out.subarray(0, area);

            if (results['r1o'] && results['r2o'] && results['r3o'] && results['r4o']) {
                recurrentStates = {
                    r1: results['r1o'],
                    r2: results['r2o'],
                    r3: results['r3o'],
                    r4: results['r4o']
                };
            }
        } else if (modelConfig.type === 'modnet') {
            const outKey = currentSession.outputNames[0];
            const outTensor = results[outKey];
            const rawData = outTensor.data;
            maskH = outTensor.dims[outTensor.dims.length - 2] || inferH;
            maskW = outTensor.dims[outTensor.dims.length - 1] || inferW;
            const area = maskW * maskH;

            if (!alphaOutBuffer || alphaOutBuffer.length < area) {
                alphaOutBuffer = new Float32Array(area);
            }
            const out = alphaOutBuffer;

            const boost = typeof settings.modnetBoost === 'number' ? settings.modnetBoost : (parseFloat(modnetBoostSlider ? modnetBoostSlider.value : 80) / 100);
            const cutoff = typeof settings.modnetCutoff === 'number' ? settings.modnetCutoff : (parseFloat(modnetCutoffSlider ? modnetCutoffSlider.value : 10) / 100);
            const solidLevel = Math.max(cutoff + 0.05, 0.95 - boost * 0.40);

            for (let i = 0; i < area; i++) {
                const a = rawData[i];
                if (a <= cutoff) {
                    out[i] = 0.0;
                } else if (a >= solidLevel) {
                    out[i] = 1.0;
                } else {
                    const t = (a - cutoff) / (solidLevel - cutoff);
                    out[i] = t * t * (3.0 - 2.0 * t);
                }
            }
            alphaData = out.subarray(0, area);
        } else if (modelConfig.type === 'selfie') {
            const outKey = currentSession.outputNames[0];
            const outTensor = results[outKey];
            const rawData = outTensor.data;
            const area = inferW * inferH;

            if (!alphaOutBuffer || alphaOutBuffer.length < area) {
                alphaOutBuffer = new Float32Array(area);
            }
            const out = alphaOutBuffer;

            if (outTensor.dims[1] === 2) {
                for (let i = 0; i < area; i++) {
                    const diff = rawData[i] - rawData[area + i];
                    const rawSigmoid = 1.0 / (1.0 + Math.exp(diff));
                    if (rawSigmoid <= 0.15) {
                        out[i] = 0.0;
                    } else if (rawSigmoid >= 0.70) {
                        out[i] = 1.0;
                    } else {
                        const t = (rawSigmoid - 0.15) / 0.55;
                        out[i] = t * t * (3.0 - 2.0 * t);
                    }
                }
            } else {
                for (let i = 0; i < area; i++) {
                    const rawVal = rawData[i];
                    if (rawVal <= 0.15) {
                        out[i] = 0.0;
                    } else if (rawVal >= 0.70) {
                        out[i] = 1.0;
                    } else {
                        const t = (rawVal - 0.15) / 0.55;
                        out[i] = t * t * (3.0 - 2.0 * t);
                    }
                }
            }
            alphaData = out.subarray(0, area);
        }

        if (alphaData && modelConfig.type !== 'rvm') {
            const area = maskW * maskH;
            if (prevAlpha && prevAlpha.length === area) {
                for (let i = 0; i < area; i++) {
                    alphaData[i] = alphaData[i] * 0.85 + prevAlpha[i] * 0.15;
                }
            } else {
                prevAlpha = new Float32Array(area);
            }
            prevAlpha.set(alphaData);
        }

        const inferenceTimeMs = performance.now() - tStart;
        return {
            alphaData,
            maskW,
            maskH,
            srcW,
            srcH,
            inferenceTimeMs
        };
    }

    function renderMatteToCanvas(targetCanvas, sourceElement, matteResult) {
        if (!matteResult || !matteResult.alphaData) return;

        const { alphaData, maskW, maskH, srcW, srcH } = matteResult;
        const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });

        if (targetCanvas.width !== srcW || targetCanvas.height !== srcH) {
            targetCanvas.width = srcW;
            targetCanvas.height = srcH;
        }

        if (maskCanvas.width !== maskW || maskCanvas.height !== maskH) {
            maskCanvas.width = maskW;
            maskCanvas.height = maskH;
            maskImgData = maskCtx.createImageData(maskW, maskH);
            maskUint32 = new Uint32Array(maskImgData.data.buffer);
        }

        const u32 = maskUint32;
        const lut = alphaLUT;
        const total = maskW * maskH;

        for (let i = 0; i < total; i++) {
            const a = alphaData[i];
            const aInt = a >= 1.0 ? 255 : (a <= 0.0 ? 0 : (a * 255) | 0);
            u32[i] = lut[aInt];
        }
        maskCtx.putImageData(maskImgData, 0, 0);

        ctx.clearRect(0, 0, srcW, srcH);
        ctx.save();

        if (bgMode === 'color') {
            ctx.fillStyle = solidColor || '#0842a0';
            ctx.fillRect(0, 0, srcW, srcH);
        } else if (bgMode === 'green') {
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(0, 0, srcW, srcH);
        } else if (bgMode === 'blur') {
            ctx.filter = `blur(${blurAmount}px)`;
            ctx.drawImage(sourceElement, -20, -20, srcW + 40, srcH + 40);
            ctx.filter = 'none';
        } else if (bgMode === 'image' && customBgImage) {
            ctx.drawImage(customBgImage, 0, 0, srcW, srcH);
        }

        if (fgCanvas.width !== srcW || fgCanvas.height !== srcH) {
            fgCanvas.width = srcW;
            fgCanvas.height = srcH;
        }

        fgCtx.clearRect(0, 0, srcW, srcH);
        fgCtx.imageSmoothingEnabled = true;
        fgCtx.imageSmoothingQuality = 'high';
        fgCtx.globalCompositeOperation = 'source-over';
        fgCtx.drawImage(sourceElement, 0, 0, srcW, srcH);

        fgCtx.globalCompositeOperation = 'destination-in';
        fgCtx.drawImage(maskCanvas, 0, 0, srcW, srcH);

        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(fgCanvas, 0, 0, srcW, srcH);
        ctx.restore();
    }

    async function runPreview(showButtonSpinner = true) {
        if (!selectedFile || isProcessing) return;
        const sourceEl = fileType === 'video' ? videoEl : imageEl;
        try {
            if (showButtonSpinner && btnPreview) {
                btnPreview.disabled = true;
                btnPreview.innerHTML = '<span class="upscale-spinner">⏳</span> <span>Processing...</span>';
            }

            prevAlpha = null;
            recurrentStates = {
                r1: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
                r2: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
                r3: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
                r4: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1])
            };

            await ensureModelSession();
            const res = await processMatte(sourceEl, {
                qualityScale: parseFloat(rvmScaleSlider.value),
                downsampleRatio: parseFloat(rvmDownsampleSlider.value),
                modnetBoost: parseFloat(modnetBoostSlider.value) / 100,
                modnetCutoff: parseFloat(modnetCutoffSlider.value) / 100
            });

            if (res) {
                lastMatteResult = res;
                renderMatteToCanvas(canvasEl, sourceEl, res);
                isPreviewed = true;
                if (btnPreview) btnPreview.classList.add('active');
                if (unprocessedOverlay) unprocessedOverlay.classList.remove('show');
                if (sliderLabelRight) sliderLabelRight.textContent = 'Removed BG';
                if (comparisonContainer) {
                    comparisonContainer.classList.toggle('checkerboard', bgMode === 'transparent');
                }
                updateTransform();
            }
        } catch (e) {
            appendLog(`Preview error: ${e.message}`);
        } finally {
            if (showButtonSpinner && btnPreview) {
                btnPreview.disabled = false;
                btnPreview.innerHTML = '<span class="material-symbols-rounded font-16">visibility</span><span>Preview</span>';
            }
        }
    }

    btnPreview.addEventListener('click', () => {
        runPreview(true);
    });

    async function getFFmpeg() {
        if (ffmpegInstance) return ffmpegInstance;
        appendLog('Memuat library FFmpeg WASM...');
        const ready = await loadFFmpegLibraries();
        if (!ready || !window.FFmpegWASM || !window.FFmpegUtil) {
            throw new Error('Library FFmpeg WASM gagal dimuat.');
        }

        const { FFmpeg } = window.FFmpegWASM;
        const { toBlobURL } = window.FFmpegUtil;

        appendLog('Inisialisasi core FFmpeg WASM...');
        let ffmpeg = new FFmpeg();

        ffmpeg.on('log', ({ message }) => {
            if (message && !message.includes('frame=') && !message.includes('fps=')) {
                console.log('[FFmpeg]', message);
            }
        });

        const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
        const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const localBaseURL = window.location.origin + '/assets/ffmpeg';
        const isIosDevice = /iPhone|iPad|iPod|VisionPro/i.test(navigator.userAgent) || 
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                           (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
        const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice;
        let loaded = false;

        if (isMultiThread) {
            try {
                const coreURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.wasm`, 'application/wasm');
                const workerURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.worker.js`, 'text/javascript');
                await ffmpeg.load({ coreURL, wasmURL, workerURL });
                loaded = true;
                appendLog('FFmpeg WASM Core Multi-Thread CDN siap.');
            } catch (err) {
                try {
                    const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.wasm`, 'application/wasm');
                    const workerURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                    await ffmpeg.load({ coreURL, wasmURL, workerURL });
                    loaded = true;
                    appendLog('FFmpeg WASM Core Multi-Thread lokal siap.');
                } catch (localErr) {
                    ffmpeg = new FFmpeg();
                }
            }
        }

        if (!loaded) {
            try {
                const coreURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                loaded = true;
                appendLog('FFmpeg WASM Core Single-Thread CDN siap.');
            } catch (err) {
                const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                loaded = true;
                appendLog('FFmpeg WASM Core Single-Thread lokal siap.');
            }
        }

        ffmpegInstance = ffmpeg;
        return ffmpegInstance;
    }

    btnProcess.addEventListener('click', async () => {
        if (!selectedFile || isProcessing) return;
        isProcessing = true;
        cancelProcessing = false;

        btnProcess.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        btnReset.classList.add('hidden');
        setCardControlsEnabled(false);

        progressContainer.classList.remove('hidden');
        progressPercent.textContent = '0%';
        progressFill.style.width = '0%';

        lastMatteResult = null;
        prevAlpha = null;
        recurrentStates = {
            r1: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
            r2: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
            r3: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]),
            r4: new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1])
        };

        if (logsEl) logsEl.innerHTML = '';
        logsContainer.classList.remove('hidden');
        appendLog(`Memulai proses background removal untuk [${selectedFile.name}]...`);

        isPreviewed = true;
        if (unprocessedOverlay) unprocessedOverlay.classList.remove('show');
        if (sliderLabelRight) sliderLabelRight.textContent = 'Processing...';
        if (comparisonContainer) {
            comparisonContainer.classList.toggle('checkerboard', bgMode === 'transparent');
        }
        updateTransform();

        try {
            progressText.textContent = 'Memuat model AI...';
            await ensureModelSession();

            if (fileType === 'image') {
                progressText.textContent = 'Memproses foto...';
                progressFill.style.width = '50%';
                progressPercent.textContent = '50%';

                const res = await processMatte(imageEl, {
                    qualityScale: parseFloat(rvmScaleSlider.value),
                    downsampleRatio: parseFloat(rvmDownsampleSlider.value),
                    modnetBoost: parseFloat(modnetBoostSlider.value) / 100,
                    modnetCutoff: parseFloat(modnetCutoffSlider.value) / 100
                });

                if (res) {
                    lastMatteResult = res;
                    renderMatteToCanvas(canvasEl, imageEl, res);
                    if (sliderLabelRight) sliderLabelRight.textContent = 'Removed BG';
                    updateTransform();
                }

                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                progressText.textContent = 'Selesai!';

                const isTrans = bgMode === 'transparent';
                const mime = isTrans ? 'image/png' : 'image/jpeg';
                const ext = isTrans ? 'png' : 'jpg';

                canvasEl.toBlob((blob) => {
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `rembg_${Date.now()}.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    appendLog(`Foto berhasil diunduh: ${a.download}`);
                }, mime, 0.95);

            } else {
                progressText.textContent = 'Inisialisasi FFmpeg WASM...';
                const ffmpeg = await getFFmpeg();
                const { fetchFile } = window.FFmpegUtil;

                let detectedFps = 24;
                const logHandler = ({ message }) => {
                    const fpsMatch = message.match(/(\d+(?:\.\d+)?)\s*fps/i) || message.match(/(\d+(?:\.\d+)?)\s*tbr/i);
                    if (fpsMatch) {
                        const parsed = parseFloat(fpsMatch[1]);
                        if (parsed >= 1 && parsed <= 120) {
                            detectedFps = parsed;
                        }
                    }
                };

                ffmpeg.on('log', logHandler);
                await ffmpeg.writeFile('probe.mp4', await fetchFile(selectedFile));
                try {
                    await ffmpeg.exec(['-i', 'probe.mp4']);
                } catch (e) {}
                try { await ffmpeg.deleteFile('probe.mp4'); } catch (e) {}

                const fps = detectedFps;
                const dur = videoEl.duration || 1;
                const srcW = (videoEl.videoWidth || 640) & ~1;
                const srcH = (videoEl.videoHeight || 360) & ~1;
                const isTrans = bgMode === 'transparent';
                const totalFrames = Math.max(1, Math.round(dur * fps));
                const frameStep = 1 / fps;

                appendLog(`Video FPS: ${fps}, Total Frames: ${totalFrames}`);

                canvasEl.width = srcW;
                canvasEl.height = srcH;

                const snapCanvas = document.createElement('canvas');
                snapCanvas.width = srcW;
                snapCanvas.height = srcH;
                const snapCtx = snapCanvas.getContext('2d', { willReadFrequently: true });

                const frameExt = isTrans ? 'png' : 'jpg';
                const frameMime = isTrans ? 'image/png' : 'image/jpeg';
                const frameQuality = isTrans ? undefined : 0.92;

                const settings = {
                    qualityScale: parseFloat(rvmScaleSlider.value),
                    downsampleRatio: parseFloat(rvmDownsampleSlider.value),
                    modnetBoost: parseFloat(modnetBoostSlider.value) / 100,
                    modnetCutoff: parseFloat(modnetCutoffSlider.value) / 100
                };

                videoEl.pause();

                for (let i = 0; i < totalFrames; i++) {
                    if (cancelProcessing) break;

                    const targetTime = i * frameStep;
                    if (Math.abs(videoEl.currentTime - targetTime) > 0.005) {
                        videoEl.currentTime = targetTime;
                        await new Promise((resolve) => {
                            let isDone = false;
                            const onSeeked = () => {
                                if (!isDone) {
                                    isDone = true;
                                    videoEl.removeEventListener('seeked', onSeeked);
                                    resolve();
                                }
                            };
                            videoEl.addEventListener('seeked', onSeeked, { once: true });
                            setTimeout(() => {
                                if (!isDone) {
                                    isDone = true;
                                    videoEl.removeEventListener('seeked', onSeeked);
                                    resolve();
                                }
                            }, 2000);
                        });
                    }

                    snapCtx.clearRect(0, 0, srcW, srcH);
                    snapCtx.drawImage(videoEl, 0, 0, srcW, srcH);

                    const res = await processMatte(snapCanvas, settings);
                    if (res) {
                        lastMatteResult = res;
                        renderMatteToCanvas(canvasEl, snapCanvas, res);
                        updateTransform();
                    }

                    const frameBlob = await new Promise(r => canvasEl.toBlob(r, frameMime, frameQuality));
                    const frameBuf = new Uint8Array(await frameBlob.arrayBuffer());
                    const frameName = `f_${String(i).padStart(5, '0')}.${frameExt}`;
                    await ffmpeg.writeFile(frameName, frameBuf);

                    const p = Math.round(((i + 1) / totalFrames) * 100);
                    progressPercent.textContent = `${p}%`;
                    progressFill.style.width = `${p}%`;
                    progressText.textContent = `Menghapus Background: ${p}% (${i+1}/${totalFrames})...`;

                    if ((i + 1) % 20 === 0 || i === totalFrames - 1) {
                        appendLog(`Memproses Frame ${i+1}/${totalFrames} (${p}%)`);
                    }
                }

                if (cancelProcessing) {
                    appendLog('Proses dibatalkan.');
                    if (sliderLabelRight) sliderLabelRight.textContent = 'Removed BG';
                    return;
                }

                progressText.textContent = 'Mengenkode video output...';
                let outName = isTrans ? 'output.mov' : 'output.mp4';
                let finalExt = isTrans ? 'mov' : 'mp4';

                if (isTrans) {
                    await ffmpeg.exec([
                        '-framerate', String(fps),
                        '-i', `f_%05d.${frameExt}`,
                        '-c:v', 'png',
                        '-pix_fmt', 'rgba',
                        outName
                    ]);
                } else {
                    await ffmpeg.exec([
                        '-framerate', String(fps),
                        '-i', `f_%05d.${frameExt}`,
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-preset', 'ultrafast',
                        outName
                    ]);
                }

                const outData = await ffmpeg.readFile(outName);
                const outMime = isTrans ? 'video/quicktime' : 'video/mp4';
                const outBlob = new Blob([outData.buffer], { type: outMime });
                const downloadUrl = URL.createObjectURL(outBlob);

                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `rembg_${selectedModelId}_${Date.now()}.${finalExt}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                for (let i = 0; i < totalFrames; i++) {
                    const frameName = `f_${String(i).padStart(5, '0')}.${frameExt}`;
                    try { await ffmpeg.deleteFile(frameName); } catch (e) {}
                }
                try { await ffmpeg.deleteFile(outName); } catch (e) {}

                progressPercent.textContent = '100%';
                progressFill.style.width = '100%';
                progressText.textContent = 'Proses Selesai!';
                if (sliderLabelRight) sliderLabelRight.textContent = 'Removed BG';
                appendLog(`Video berhasil diunduh: ${a.download}`);
            }

        } catch (err) {
            appendLog(`Error: ${err.message}`);
            alert(`Gagal memproses media: ${err.message}`);
        } finally {
            isProcessing = false;
            btnCancel.classList.add('hidden');
            btnReset.classList.remove('hidden');
            setCardControlsEnabled(true);
        }
    });

    btnCancel.addEventListener('click', () => {
        cancelProcessing = true;
        appendLog('Membatalkan proses...');
    });

    btnReset.addEventListener('click', () => {
        selectedFile = null;
        dropArea.classList.remove('hidden');
        workspace.classList.add('hidden');
        btnProcess.classList.add('hidden');
        btnReset.classList.add('hidden');
        btnCancel.classList.add('hidden');
        progressContainer.classList.add('hidden');
        if (logsEl) logsEl.innerHTML = '';
        if (logsContainer) logsContainer.classList.add('hidden');
        setCardControlsEnabled(true);
        markUnprocessed();
        fileInput.value = '';
        if (videoEl.src) {
            videoEl.pause();
            videoEl.src = '';
        }
    });
});
