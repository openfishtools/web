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

    // --- Multipier Switching ---
    multiplierChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (isProcessing) return;
            multiplierChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            multiplier = parseInt(chip.getAttribute('data-mult'));
            updateTargetFps();
        });
    });

    function updateTargetFps() {
        if (originalFps) {
            targetFpsEl.textContent = `${(originalFps * multiplier).toFixed(2)} FPS`;
        }
    }

    // --- Drag and Drop / File Input Handler ---
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
        gpuStatus.textContent = window.getTranslation('interp_checking_gpu');
        
        // Small delay for checking effect
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const hasWebGPU = navigator.gpu ? true : false;
        if (hasWebGPU) {
            gpuDot.textContent = 'check_circle';
            gpuDot.style.color = '#4CAF50';
            gpuDot.classList.remove('upscale-spinner');
            gpuStatus.textContent = window.getTranslation('interp_ready_gpu');
            
            await new Promise(resolve => setTimeout(resolve, 800));
            checkScreen.classList.add('hidden');
            workspace.classList.remove('hidden');
            logsContainer.classList.remove('hidden');
            btnProcess.classList.remove('hidden');
            
            // Initialize original video preview element for properties extraction
            const url = URL.createObjectURL(file);
            originalVideoUrl = url;
            videoOriginal.src = url;
            videoOriginal.load();

            videoOriginal.onloadedmetadata = async () => {
                // Get original FPS (mock probe or estimate)
                originalFps = await detectFps(videoOriginal);
                inputFpsEl.textContent = `${originalFps.toFixed(2)} FPS`;
                updateTargetFps();
            };
        } else {
            gpuDot.textContent = 'cancel';
            gpuDot.style.color = '#F44336';
            gpuDot.classList.remove('upscale-spinner');
            gpuStatus.textContent = window.getTranslation('interp_failed_gpu');
            // Keep workspace and process button hidden to block further action
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

    // --- WebGPU ONNX RIFE Frame Interpolator ---
    class RIFEInterpolator {
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.session = null;
            this.device = null;
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx = this.canvas.getContext('2d');
            this.isReady = false;
        }

        async init(onLog) {
            try {
                if (!navigator.gpu) {
                    throw new Error('WebGPU is not supported on this browser.');
                }
                
                const adapter = await navigator.gpu.requestAdapter();
                this.device = await adapter.requestDevice();
                
                onLog('[RIFE] Initializing ONNX Runtime Web session with WebGPU...');
                
                // Locally hosted RIFE model weights path
                const modelUrl = 'assets/models/rife47_ensemble_True_scale_1_sim.onnx';
                
                this.session = await ort.InferenceSession.create(modelUrl, {
                    executionProviders: ['webgpu'],
                    preferredOutputFormat: 'RGB'
                });
                
                this.isReady = true;
                onLog('[RIFE] ONNX WebGPU Model loaded successfully.');
            } catch (err) {
                onLog(`[RIFE Error] Failed to load RIFE ONNX: ${err.message}`);
                throw err;
            }
        }

        // Run RIFE inference on two canvas frame inputs using WebGPU
        async interpolate(canvas0, canvas1, progressVal, outCanvas) {
            if (!this.isReady) throw new Error('RIFE session is not initialized');
            
            const w = this.width;
            const h = this.height;
            
            // Extract frame data as raw Float32 array tensors
            const imgData0 = canvas0.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
            const imgData1 = canvas1.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
            
            const tensorSize = w * h * 3;
            const floatData0 = new Float32Array(tensorSize);
            const floatData1 = new Float32Array(tensorSize);
            
            // Convert RGBA -> RGB Normalized [0.0, 1.0] NCHW format required by RIFE
            let idx = 0;
            for (let i = 0; i < imgData0.length; i += 4) {
                floatData0[idx] = imgData0[i] / 255.0;     // R
                floatData0[idx + w*h] = imgData0[i+1] / 255.0; // G
                floatData0[idx + w*h*2] = imgData0[i+2] / 255.0; // B
                
                floatData1[idx] = imgData1[i] / 255.0;
                floatData1[idx + w*h] = imgData1[i+1] / 255.0;
                floatData1[idx + w*h*2] = imgData1[i+2] / 255.0;
                idx++;
            }
            
            // Wrap inputs into ONNX Tensors
            const t0 = new ort.Tensor('float32', floatData0, [1, 3, h, w]);
            const t1 = new ort.Tensor('float32', floatData1, [1, 3, h, w]);
            const timeTensor = new ort.Tensor('float32', new Float32Array([progressVal]), [1]);
            
            // Dynamically match input names (e.g. 'img0' & 'img1' vs 'input_0' & 'input_1')
            const inputs = this.session.inputNames;
            const name0 = inputs.includes('img0') ? 'img0' : (inputs.includes('input_0') ? 'input_0' : inputs[0]);
            const name1 = inputs.includes('img1') ? 'img1' : (inputs.includes('input_1') ? 'input_1' : inputs[1]);
            const nameTime = inputs.includes('timestep') ? 'timestep' : (inputs.includes('time') ? 'time' : inputs[2]);
            
            const feeds = {};
            feeds[name0] = t0;
            feeds[name1] = t1;
            if (nameTime) {
                feeds[nameTime] = timeTensor;
            }
            
            const results = await this.session.run(feeds);
            const outputTensor = results[this.session.outputNames[0]];
            const outData = outputTensor.data;
            
            // Decode RGB NCHW Tensor back to RGBA Canvas ImageData
            const outCtx = outCanvas.getContext('2d');
            const targetImgData = outCtx.createImageData(w, h);
            const d = targetImgData.data;
            
            let pixIdx = 0;
            for (let i = 0; i < w * h; i++) {
                const r = Math.min(255, Math.max(0, Math.round(outData[i] * 255.0)));
                const g = Math.min(255, Math.max(0, Math.round(outData[i + w*h] * 255.0)));
                const b = Math.min(255, Math.max(0, Math.round(outData[i + w*h*2] * 255.0)));
                
                d[pixIdx] = r;
                d[pixIdx + 1] = g;
                d[pixIdx + 2] = b;
                d[pixIdx + 3] = 255; // Alpha
                pixIdx += 4;
            }
            
            outCtx.putImageData(targetImgData, 0, 0);
        }
    }

    async function getFFmpeg() {
        if (ffmpegInstance) return ffmpegInstance;
        const { FFmpeg } = window.FFmpegWASM;
        const { toBlobURL } = window.FFmpegUtil;
        let ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg Interp Log]', message);
        });
        const baseURL = window.location.origin + '/assets/ffmpeg';
        try {
            const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
            await ffmpeg.load({ coreURL, wasmURL });
        } catch (err) {
            console.error('Failed to load single-threaded FFmpeg:', err);
            throw err;
        }
        ffmpegInstance = ffmpeg;
        return ffmpeg;
    }

    function addLog(msg) {
        logsEl.textContent += msg + '\n';
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    function setProgress(percent, msg) {
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressText.textContent = msg;
    }

    btnProcess.addEventListener('click', startInterpolation);
    btnCancel.addEventListener('click', () => { cancelProcessing = true; });
    btnReset.addEventListener('click', resetTool);

    async function seekVideoToTime(vid, time) {
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

        addLog('[System] Initializing Video Interpolation pipeline...');
        setProgress(5, 'Loading FFmpeg...');

        let ffmpeg;
        try {
            ffmpeg = await getFFmpeg();
        } catch (err) {
            addLog(`[Error] FFmpeg load failed: ${err.message}`);
            resetUIAfterError();
            return;
        }

        const width = videoOriginal.videoWidth;
        const height = videoOriginal.videoHeight;
        const duration = videoOriginal.duration;
        const totalInputFrames = Math.round(duration * originalFps);
        const outputFps = originalFps * multiplier;
        const totalOutputFrames = Math.round(duration * outputFps);

        addLog(`[System] Input parameters: ${width}x${height} at ${originalFps.toFixed(2)} FPS`);
        addLog(`[System] Output target: ${outputFps.toFixed(2)} FPS (${totalOutputFrames} frames total)`);

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
            setProgress(10, 'Initializing RIFE model session...');
            await interpolator.init(addLog);

            setProgress(15, 'Writing source to virtual storage...');
            await ffmpeg.writeFile('input.mp4', await fetchFile(selectedFile));

            let outFrameIndex = 0;
            addLog('[System] Beginning RIFE frame synthesis loop...');

            for (let i = 0; i < totalInputFrames - 1; i++) {
                if (cancelProcessing) throw new Error('Cancelled');

                const t0 = i / originalFps;
                const t1 = (i + 1) / originalFps;

                // Load frame 0 & frame 1
                await seekVideoToTime(videoOriginal, t0);
                ctx0.drawImage(videoOriginal, 0, 0);

                await seekVideoToTime(videoOriginal, t1);
                ctx1.drawImage(videoOriginal, 0, 0);

                // Interpolate sub-frames (e.g. for multiplier=2, step=0 and step=1)
                for (let step = 0; step < multiplier; step++) {
                    const progressVal = step / multiplier;
                    await interpolator.interpolate(seekCanvas0, seekCanvas1, progressVal, outputCanvas);

                    const outBlob = await new Promise(res => outputCanvas.toBlob(res, 'image/jpeg', 0.92));
                    const ab = await outBlob.arrayBuffer();
                    const outFilename = `frame_${(outFrameIndex++).toString().padStart(5, '0')}.jpg`;
                    await ffmpeg.writeFile(outFilename, new Uint8Array(ab));
                }

                const pct = Math.min(85, Math.round((outFrameIndex / totalOutputFrames) * 85));
                setProgress(pct, `Processed ${outFrameIndex}/${totalOutputFrames} frames`);
                if (i % 5 === 0) {
                    addLog(`[Interpolating] Synthesized frame series up to sequence ${outFrameIndex}`);
                }
                
                // Yield thread control back to browser to allow UI repaint and avoid freezes
                await new Promise(resolve => setTimeout(resolve, 30));
            }

            // Write final tail frames
            if (!cancelProcessing) {
                await seekVideoToTime(videoOriginal, duration - 0.05);
                ctx0.drawImage(videoOriginal, 0, 0);
                const outBlob = await new Promise(res => seekCanvas0.toBlob(res, 'image/jpeg', 0.92));
                const ab = await outBlob.arrayBuffer();
                const outFilename = `frame_${(outFrameIndex++).toString().padStart(5, '0')}.jpg`;
                await ffmpeg.writeFile(outFilename, new Uint8Array(ab));
            }

            setProgress(88, 'Muxing audio & encoding final frames...');
            addLog('[System] Encoding processed frames with FFmpeg...');

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

            // Clear virtual storage files
            for (let f = 0; f <= outFrameIndex; f++) {
                try { await ffmpeg.deleteFile(`frame_${f.toString().padStart(5, '0')}.jpg`); } catch(e){}
            }
            try { await ffmpeg.deleteFile('input.mp4'); } catch(e){}
            try { await ffmpeg.deleteFile('output.mp4'); } catch(e){}

            setProgress(100, 'Finished!');
            addLog('[Success] Video interpolation completed successfully!');

            // Update UI to complete screen
            completedPanel.classList.remove('hidden');
            btnCancel.classList.add('hidden');
            btnReset.classList.remove('hidden');
            progressContainer.classList.add('hidden');
            workspace.classList.add('hidden');
            logsContainer.classList.add('hidden');

            // Set up original and output synchronized playback
            setupSynchronizedComparison();

            // Trigger direct download
            const a = document.createElement('a');
            a.href = outputVideoUrl;
            a.download = `interpolated_${multiplier}x_${selectedFile.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } catch (err) {
            addLog(`[Fatal Error] ${err.message}`);
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

    // --- Interactive Synchronized Side-by-Side Slider ---
    function setupSynchronizedComparison() {
        // Synchronize playback play/pause & seek
        videoOriginal.addEventListener('play', () => videoOutput.play());
        videoOriginal.addEventListener('pause', () => videoOutput.pause());
        videoOriginal.addEventListener('seeking', () => {
            videoOutput.currentTime = videoOriginal.currentTime;
        });

        // Loop controls
        videoOriginal.play().catch(()=>{});

        // Comparison slider logic
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
        // Fallback immediate initialization in case metadata is already loaded
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
