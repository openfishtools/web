document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('interpolation-video-card');
    if (!card) return;

    const dropArea = document.getElementById('interp-drop-area');
    const fileInput = document.getElementById('interp-file-input');
    const workspace = document.getElementById('interp-workspace');
    
    const inputFpsEl = document.getElementById('interp-input-fps');
    const targetFpsEl = document.getElementById('interp-target-fps');
    
    const btnProcess = document.getElementById('interp-btn-process');
    const btnCancel = document.getElementById('interp-btn-cancel');
    const btnReset = document.getElementById('interp-btn-reset');
    
    const progressContainer = document.getElementById('interp-progress-container');
    const progressFill = document.getElementById('interp-progress-fill');
    const progressText = document.getElementById('interp-progress-text');
    const progressPercent = document.getElementById('interp-progress-percent');
    
    const logsContainer = document.getElementById('interp-logs-container');
    const logsEl = document.getElementById('interp-logs');
    
    const completedPanel = document.getElementById('interp-completed-panel');
    const comparisonContainer = document.getElementById('interp-comparison-container');
    const videoOriginal = document.getElementById('interp-video-original');
    const videoOutput = document.getElementById('interp-video-output');
    const videoClip = document.getElementById('interp-video-clip');
    const sliderLine = document.getElementById('interp-slider-line');
    
    const multiplierChips = document.querySelectorAll('#interp-multipliers .preset-switch');

    let selectedFile = null;
    let originalFps = 30;
    let multiplier = 2;
    let isProcessing = false;
    let cancelProcessing = false;
    let ffmpegInstance = null;
    let originalVideoUrl = null;
    let outputVideoUrl = null;

    multiplierChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (isProcessing) return;
            multiplierChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            multiplier = parseInt(chip.getAttribute('data-mult'), 10) || 2;
            updateTargetFps();
        });
    });

    function updateTargetFps() {
        if (originalFps && targetFpsEl) {
            targetFpsEl.textContent = `${(originalFps * multiplier).toFixed(2)} FPS`;
        }
    }

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--md-sys-color-primary)';
        dropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    async function handleFile(file) {
        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file.');
            return;
        }
        selectedFile = file;
        dropArea.classList.add('hidden');
        workspace.classList.add('hidden');
        completedPanel.classList.add('hidden');
        logsContainer.classList.add('hidden');
        btnProcess.classList.add('hidden');
        
        const checkScreen = document.getElementById('interp-checking-screen');
        const gpuDot = document.getElementById('interp-gpu-dot');
        const gpuStatus = document.getElementById('interp-gpu-status');
        
        checkScreen.classList.remove('hidden');
        
        gpuDot.textContent = 'sync';
        gpuDot.style.color = 'var(--md-sys-color-primary)';
        gpuDot.classList.add('upscale-spinner');
        if (gpuStatus) {
            gpuStatus.textContent = typeof window.getTranslation === 'function' ? window.getTranslation('interp_checking_gpu') : 'WebGPU: Memeriksa...';
        }
        
        let hasWebGPU = false;
        if (navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) hasWebGPU = true;
            } catch (e) {
                hasWebGPU = false;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (hasWebGPU) {
            gpuDot.textContent = 'check_circle';
            gpuDot.style.color = '#4CAF50';
            gpuDot.classList.remove('upscale-spinner');
            if (gpuStatus) {
                gpuStatus.textContent = typeof window.getTranslation === 'function' ? window.getTranslation('interp_ready_gpu') : 'WebGPU: Tersedia';
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            checkScreen.classList.add('hidden');
            workspace.classList.remove('hidden');
            logsContainer.classList.remove('hidden');
            btnProcess.classList.remove('hidden');
            
            const url = URL.createObjectURL(file);
            originalVideoUrl = url;
            videoOriginal.src = url;
            videoOriginal.load();

            videoOriginal.onloadedmetadata = async () => {
                originalFps = await detectFps(videoOriginal);
                if (inputFpsEl) inputFpsEl.textContent = `${originalFps.toFixed(2)} FPS`;
                updateTargetFps();
            };
        } else {
            gpuDot.textContent = 'cancel';
            gpuDot.style.color = '#F44336';
            gpuDot.classList.remove('upscale-spinner');
            if (gpuStatus) {
                gpuStatus.textContent = typeof window.getTranslation === 'function' ? window.getTranslation('interp_failed_gpu') : 'WebGPU: Tidak Tersedia';
            }
        }
    }

    async function detectFps(vid) {
        if ('requestVideoFrameCallback' in vid) {
            return new Promise((resolve) => {
                const frames = [];
                const timeout = setTimeout(() => { vid.pause(); resolve(30); }, 1500);
                const cb = (now, meta) => {
                    frames.push(meta.mediaTime);
                    if (frames.length < 10) {
                        vid.requestVideoFrameCallback(cb);
                    } else {
                        clearTimeout(timeout);
                        vid.pause();
                        const diffs = [];
                        for (let k = 1; k < frames.length; k++) {
                            const d = frames[k] - frames[k - 1];
                            if (d > 0.001) diffs.push(d);
                        }
                        if (diffs.length === 0) { resolve(30); return; }
                        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
                        const raw = 1 / avgDiff;
                        const common = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
                        const nearest = common.reduce((prev, cur) =>
                            Math.abs(cur - raw) < Math.abs(prev - raw) ? cur : prev
                        );
                        resolve(nearest);
                    }
                };
                vid.currentTime = 0;
                vid.muted = true;
                vid.playbackRate = 1;
                vid.requestVideoFrameCallback(cb);
                vid.play().catch(() => { clearTimeout(timeout); resolve(30); });
            });
        }
        return 30;
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

    class RIFEInterpolator {
        constructor(width, height) {
            this.origWidth = width;
            this.origHeight = height;
            this.width = Math.ceil(width / 32) * 32;
            this.height = Math.ceil(height / 32) * 32;
            this.session = null;
            this.device = null;
            
            this.canvas0 = document.createElement('canvas');
            this.canvas0.width = this.width;
            this.canvas0.height = this.height;
            this.ctx0 = this.canvas0.getContext('2d', { willReadFrequently: true });
            
            this.canvas1 = document.createElement('canvas');
            this.canvas1.width = this.width;
            this.canvas1.height = this.height;
            this.ctx1 = this.canvas1.getContext('2d', { willReadFrequently: true });
            
            this.interpCanvas = document.createElement('canvas');
            this.interpCanvas.width = this.width;
            this.interpCanvas.height = this.height;
            this.interpCtx = this.interpCanvas.getContext('2d');
            
            this.isReady = false;
        }

        async init(onLog) {
            try {
                if (!navigator.gpu) {
                    throw new Error('WebGPU tidak didukung pada browser ini.');
                }
                
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) throw new Error('Gagal menginisialisasi GPU adapter.');
                this.device = await adapter.requestDevice();
                
                onLog('[RIFE] Menginisialisasi session ONNX Runtime WebGPU...');
                
                const localModelUrl = 'assets/models/rife47_ensemble_True_scale_1_sim.onnx';
                const remoteUrls = [
                    'https://huggingface.co/yuvraj108c/rife-onnx/resolve/main/rife47_ensemble_True_scale_1_sim.onnx',
                    'https://hf-mirror.com/yuvraj108c/rife-onnx/resolve/main/rife47_ensemble_True_scale_1_sim.onnx'
                ];
                
                let modelBuffer = null;
                const cacheName = 'chros-offline-assets-v1';
                let cache = null;
                if ('caches' in window) {
                    try { cache = await caches.open(cacheName); } catch (e) {}
                }

                if (cache) {
                    try {
                        const fullLocalUrl = new URL(localModelUrl, window.location.origin).href;
                        const match = await cache.match(fullLocalUrl) || await cache.match(localModelUrl);
                        if (match) {
                            onLog('[RIFE] Memuat model RIFE dari offline cache...');
                            modelBuffer = await match.arrayBuffer();
                        }
                    } catch (ce) {}
                }

                if (!modelBuffer) {
                    try {
                        onLog('[RIFE] Mengunduh model RIFE dari storage lokal...');
                        const res = await fetch(localModelUrl);
                        if (res.ok) {
                            modelBuffer = await res.arrayBuffer();
                        }
                    } catch (le) {}
                }

                if (!modelBuffer) {
                    for (const rUrl of remoteUrls) {
                        try {
                            onLog('[RIFE] Mengunduh model RIFE dari remote CDN...');
                            const res = await fetch(rUrl);
                            if (res.ok) {
                                modelBuffer = await res.arrayBuffer();
                                if (cache) {
                                    try {
                                        const fullLocalUrl = new URL(localModelUrl, window.location.origin).href;
                                        const cRes = new Response(modelBuffer.slice(0), {
                                            headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(modelBuffer.byteLength) }
                                        });
                                        await cache.put(fullLocalUrl, cRes.clone());
                                        await cache.put(localModelUrl, cRes);
                                    } catch (ce) {}
                                }
                                break;
                            }
                        } catch (re) {}
                    }
                }

                if (!modelBuffer) {
                    throw new Error('Gagal mengunduh model ONNX RIFE.');
                }

                let loadedSession = null;
                try {
                    loadedSession = await ort.InferenceSession.create(modelBuffer.slice(0), {
                        executionProviders: [{ name: 'webgpu', powerPreference: 'high-performance' }, 'wasm'],
                        graphOptimizationLevel: 'all'
                    });
                } catch (gpuErr) {
                    onLog('[RIFE] WebGPU session gagal, mencoba fallback WASM...');
                    loadedSession = await ort.InferenceSession.create(modelBuffer.slice(0), {
                        executionProviders: ['wasm'],
                        graphOptimizationLevel: 'all'
                    });
                }

                this.session = loadedSession;
                this.isReady = true;
                onLog('[RIFE] Model AI RIFE v4.7 siap digunakan.');
            } catch (err) {
                onLog(`[RIFE Error] Gagal memuat model RIFE: ${err.message}`);
                throw err;
            }
        }

        async interpolate(srcCanvas0, srcCanvas1, progressVal, outCanvas) {
            if (!this.isReady) throw new Error('RIFE session is not initialized');
            
            const w = this.width;
            const h = this.height;
            const origW = this.origWidth;
            const origH = this.origHeight;
            
            this.ctx0.clearRect(0, 0, w, h);
            this.ctx0.drawImage(srcCanvas0, 0, 0, origW, origH, 0, 0, w, h);
            const imgData0 = this.ctx0.getImageData(0, 0, w, h).data;
            
            this.ctx1.clearRect(0, 0, w, h);
            this.ctx1.drawImage(srcCanvas1, 0, 0, origW, origH, 0, 0, w, h);
            const imgData1 = this.ctx1.getImageData(0, 0, w, h).data;
            
            const totalPixels = w * h;
            const tensorSize = totalPixels * 3;
            const floatData0 = new Float32Array(tensorSize);
            const floatData1 = new Float32Array(tensorSize);
            
            const rOffset = 0;
            const gOffset = totalPixels;
            const bOffset = totalPixels * 2;
            const inv255 = 1.0 / 255.0;

            for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                floatData0[rOffset + i] = imgData0[p] * inv255;
                floatData0[gOffset + i] = imgData0[p + 1] * inv255;
                floatData0[bOffset + i] = imgData0[p + 2] * inv255;
                
                floatData1[rOffset + i] = imgData1[p] * inv255;
                floatData1[gOffset + i] = imgData1[p + 1] * inv255;
                floatData1[bOffset + i] = imgData1[p + 2] * inv255;
            }
            
            const t0 = new ort.Tensor('float32', floatData0, [1, 3, h, w]);
            const t1 = new ort.Tensor('float32', floatData1, [1, 3, h, w]);
            const timeTensor = new ort.Tensor('float32', new Float32Array([progressVal]), [1]);
            
            const inputs = this.session.inputNames;
            const name0 = inputs.find(n => n.includes('0') || n.includes('img0') || n.includes('src')) || inputs[0];
            const name1 = inputs.find(n => n.includes('1') || n.includes('img1')) || inputs[1];
            const nameTime = inputs.find(n => n.includes('time') || n.includes('timestep')) || (inputs.length > 2 ? inputs[2] : null);
            
            const feeds = {};
            feeds[name0] = t0;
            feeds[name1] = t1;
            if (nameTime) {
                feeds[nameTime] = timeTensor;
            }
            
            const results = await this.session.run(feeds);
            const outKey = this.session.outputNames[0];
            const outputTensor = results[outKey];
            const outData = outputTensor.data;
            
            const targetImgData = this.interpCtx.createImageData(w, h);
            const d = targetImgData.data;
            
            for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
                const r = Math.min(255, Math.max(0, (outData[rOffset + i] * 255.0) | 0));
                const g = Math.min(255, Math.max(0, (outData[gOffset + i] * 255.0) | 0));
                const b = Math.min(255, Math.max(0, (outData[bOffset + i] * 255.0) | 0));
                
                d[p] = r;
                d[p + 1] = g;
                d[p + 2] = b;
                d[p + 3] = 255;
            }
            
            this.interpCtx.putImageData(targetImgData, 0, 0);
            
            const outCtx = outCanvas.getContext('2d');
            outCtx.clearRect(0, 0, origW, origH);
            outCtx.drawImage(this.interpCanvas, 0, 0, w, h, 0, 0, origW, origH);
        }
    }

    async function getFFmpeg() {
        if (ffmpegInstance) return ffmpegInstance;
        const ready = await loadFFmpegLibraries();
        if (!ready || !window.FFmpegWASM || !window.FFmpegUtil) {
            throw new Error('Library FFmpeg WASM gagal dimuat.');
        }

        const { FFmpeg } = window.FFmpegWASM;
        const { toBlobURL } = window.FFmpegUtil;
        let ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            if (message && !message.includes('frame=') && !message.includes('fps=')) {
                console.log('[FFmpeg Interp]', message);
            }
        });
        
        const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const localBaseURL = window.location.origin + '/assets/ffmpeg';
        let loaded = false;

        try {
            const coreURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.wasm`, 'application/wasm');
            await ffmpeg.load({ coreURL, wasmURL });
            loaded = true;
        } catch (err) {
            try {
                const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                loaded = true;
            } catch (localErr) {}
        }

        if (!loaded) {
            throw new Error('Gagal menginisialisasi core FFmpeg WASM.');
        }

        ffmpegInstance = ffmpeg;
        return ffmpegInstance;
    }

    function addLog(msg) {
        if (!logsEl) return;
        const time = new Date().toTimeString().split(' ')[0];
        logsEl.textContent += `[${time}] ${msg}\n`;
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    function setProgress(percent, msg) {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressText) progressText.textContent = msg;
    }

    btnProcess.addEventListener('click', startInterpolation);
    btnCancel.addEventListener('click', () => { cancelProcessing = true; });
    btnReset.addEventListener('click', resetTool);

    async function seekVideoToTime(vid, time) {
        return new Promise((resolve) => {
            if (Math.abs(vid.currentTime - time) < 0.005) {
                resolve();
                return;
            }
            let isDone = false;
            const onSeeked = () => {
                if (!isDone) {
                    isDone = true;
                    vid.removeEventListener('seeked', onSeeked);
                    resolve();
                }
            };
            vid.addEventListener('seeked', onSeeked, { once: true });
            vid.currentTime = time;
            setTimeout(() => {
                if (!isDone) {
                    isDone = true;
                    vid.removeEventListener('seeked', onSeeked);
                    resolve();
                }
            }, 2000);
        });
    }

    async function startInterpolation() {
        if (isProcessing) return;
        isProcessing = true;
        cancelProcessing = false;

        workspace.classList.add('hidden');
        btnProcess.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        btnCancel.classList.remove('hidden');
        logsEl.textContent = '';

        addLog('[System] Memulai pipeline Video Interpolation...');
        setProgress(5, 'Memuat engine FFmpeg...');

        let ffmpeg;
        try {
            ffmpeg = await getFFmpeg();
        } catch (err) {
            addLog(`[Error] FFmpeg load failed: ${err.message}`);
            resetUIAfterError();
            return;
        }

        const width = (videoOriginal.videoWidth || 640) & ~1;
        const height = (videoOriginal.videoHeight || 360) & ~1;
        const duration = videoOriginal.duration || 1;
        const totalInputFrames = Math.max(1, Math.round(duration * originalFps));
        const outputFps = originalFps * multiplier;
        const totalOutputFrames = Math.max(1, Math.round(duration * outputFps));

        addLog(`[System] Parameter Input: ${width}x${height} @ ${originalFps.toFixed(2)} FPS`);
        addLog(`[System] Target Output: ${outputFps.toFixed(2)} FPS (${totalOutputFrames} total frames)`);

        const seekCanvas0 = document.createElement('canvas');
        seekCanvas0.width = width;
        seekCanvas0.height = height;
        const ctx0 = seekCanvas0.getContext('2d', { willReadFrequently: true });

        const seekCanvas1 = document.createElement('canvas');
        seekCanvas1.width = width;
        seekCanvas1.height = height;
        const ctx1 = seekCanvas1.getContext('2d', { willReadFrequently: true });

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;

        const interpolator = new RIFEInterpolator(width, height);
        const { fetchFile } = window.FFmpegUtil;

        try {
            setProgress(10, 'Inisialisasi session model RIFE...');
            await interpolator.init(addLog);

            setProgress(15, 'Menyiapkan video source...');
            await ffmpeg.writeFile('input.mp4', await fetchFile(selectedFile));

            let outFrameIndex = 0;
            addLog('[System] Memulai kalkulasi interpolasi frame RIFE...');

            for (let i = 0; i < totalInputFrames - 1; i++) {
                if (cancelProcessing) throw new Error('Cancelled');

                const t0 = i / originalFps;
                const t1 = (i + 1) / originalFps;

                await seekVideoToTime(videoOriginal, t0);
                ctx0.drawImage(videoOriginal, 0, 0, width, height);

                await seekVideoToTime(videoOriginal, t1);
                ctx1.drawImage(videoOriginal, 0, 0, width, height);

                for (let step = 0; step < multiplier; step++) {
                    const progressVal = step / multiplier;
                    if (progressVal === 0) {
                        const outBlob = await new Promise(res => seekCanvas0.toBlob(res, 'image/jpeg', 0.92));
                        const ab = await outBlob.arrayBuffer();
                        const outFilename = `frame_${(outFrameIndex++).toString().padStart(5, '0')}.jpg`;
                        await ffmpeg.writeFile(outFilename, new Uint8Array(ab));
                    } else {
                        await interpolator.interpolate(seekCanvas0, seekCanvas1, progressVal, outputCanvas);
                        const outBlob = await new Promise(res => outputCanvas.toBlob(res, 'image/jpeg', 0.92));
                        const ab = await outBlob.arrayBuffer();
                        const outFilename = `frame_${(outFrameIndex++).toString().padStart(5, '0')}.jpg`;
                        await ffmpeg.writeFile(outFilename, new Uint8Array(ab));
                    }
                }

                const pct = Math.min(85, Math.round((outFrameIndex / totalOutputFrames) * 85));
                setProgress(pct, `Memproses frame: ${outFrameIndex}/${totalOutputFrames} (${pct}%)`);
                if (i % 5 === 0 || i === totalInputFrames - 2) {
                    addLog(`[RIFE] Frame terinterpolasi hingga urutan ${outFrameIndex}/${totalOutputFrames}`);
                }
            }

            if (!cancelProcessing) {
                await seekVideoToTime(videoOriginal, Math.max(0, duration - 0.05));
                ctx0.drawImage(videoOriginal, 0, 0, width, height);
                const outBlob = await new Promise(res => seekCanvas0.toBlob(res, 'image/jpeg', 0.92));
                const ab = await outBlob.arrayBuffer();
                const outFilename = `frame_${(outFrameIndex++).toString().padStart(5, '0')}.jpg`;
                await ffmpeg.writeFile(outFilename, new Uint8Array(ab));
            }

            setProgress(88, 'Menggabungkan audio & encoding output video...');
            addLog('[System] Encoding frame hasil interpolasi dengan FFmpeg...');

            const encodeArgs = [
                '-r', String(outputFps),
                '-i', 'frame_%05d.jpg',
                '-i', 'input.mp4',
                '-map', '0:v',
                '-map', '1:a?',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                '-shortest',
                'output.mp4'
            ];

            try {
                await ffmpeg.exec(encodeArgs);
            } catch (err) {
                const msg = String(err);
                if (!msg.includes('Aborted') && !msg.includes('exit')) throw err;
            }

            const outputData = await ffmpeg.readFile('output.mp4');
            const outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
            
            outputVideoUrl = URL.createObjectURL(outputBlob);
            videoOutput.src = outputVideoUrl;
            videoOutput.load();

            for (let f = 0; f <= outFrameIndex; f++) {
                try { await ffmpeg.deleteFile(`frame_${f.toString().padStart(5, '0')}.jpg`); } catch(e){}
            }
            try { await ffmpeg.deleteFile('input.mp4'); } catch(e){}
            try { await ffmpeg.deleteFile('output.mp4'); } catch(e){}

            setProgress(100, 'Selesai!');
            addLog('[Success] Video interpolation berhasil diselesaikan!');

            completedPanel.classList.remove('hidden');
            btnCancel.classList.add('hidden');
            btnReset.classList.remove('hidden');
            progressContainer.classList.add('hidden');
            workspace.classList.add('hidden');
            logsContainer.classList.add('hidden');

            setupSynchronizedComparison();

            const a = document.createElement('a');
            a.href = outputVideoUrl;
            a.download = `interpolated_${multiplier}x_${selectedFile.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } catch (err) {
            addLog(`[Fatal Error] ${err.message}`);
            alert(`Gagal memproses interpolasi: ${err.message}`);
            resetUIAfterError();
        } finally {
            isProcessing = false;
        }
    }

    function resetUIAfterError() {
        progressContainer.classList.add('hidden');
        btnCancel.classList.add('hidden');
        btnProcess.classList.remove('hidden');
        workspace.classList.remove('hidden');
    }

    function resetTool() {
        if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
        if (outputVideoUrl) URL.revokeObjectURL(outputVideoUrl);
        originalVideoUrl = null;
        outputVideoUrl = null;

        videoOriginal.removeAttribute('src');
        videoOriginal.load();
        videoOutput.removeAttribute('src');
        videoOutput.load();

        selectedFile = null;
        isProcessing = false;
        cancelProcessing = false;

        dropArea.classList.remove('hidden');
        workspace.classList.add('hidden');
        completedPanel.classList.add('hidden');
        logsContainer.classList.add('hidden');
        progressContainer.classList.add('hidden');
        btnProcess.classList.add('hidden');
        btnCancel.classList.add('hidden');
        btnReset.classList.add('hidden');
        
        fileInput.value = '';
    }

    function setupSynchronizedComparison() {
        videoOriginal.addEventListener('play', () => videoOutput.play());
        videoOriginal.addEventListener('pause', () => videoOutput.pause());
        videoOriginal.addEventListener('seeking', () => {
            videoOutput.currentTime = videoOriginal.currentTime;
        });

        videoOriginal.play().catch(()=>{});

        let isDragging = false;
        
        const updateSlider = (clientX) => {
            const rect = comparisonContainer.getBoundingClientRect();
            const posX = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const percentage = (posX / rect.width) * 100;
            
            sliderLine.style.left = `${percentage}%`;
            videoClip.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
        };

        const initSliderWidth = () => {
            const rect = comparisonContainer.getBoundingClientRect();
            updateSlider(rect.left + rect.width / 2);
        };

        videoOriginal.addEventListener('loadedmetadata', initSliderWidth);
        videoOutput.addEventListener('loadedmetadata', initSliderWidth);
        setTimeout(initSliderWidth, 300);

        comparisonContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSlider(e.clientX);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) updateSlider(e.clientX);
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        comparisonContainer.addEventListener('touchstart', (e) => {
            isDragging = true;
            updateSlider(e.touches[0].clientX);
        });

        window.addEventListener('touchmove', (e) => {
            if (isDragging) updateSlider(e.touches[0].clientX);
        });

        window.addEventListener('touchend', () => {
            isDragging = false;
        });
    }
});
