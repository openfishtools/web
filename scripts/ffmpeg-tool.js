document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-ffmpeg-input');
    const dropArea = document.getElementById('tool-ffmpeg-drop');
    const statusText = document.getElementById('tool-ffmpeg-status');
    const btnStart = document.getElementById('btn-start-compression');
    const progressContainer = document.getElementById('ffmpeg-progress-container');
    const progressFill = document.getElementById('ffmpeg-progress-fill');
    const progressPercent = document.getElementById('ffmpeg-progress-percent');
    const presetChips = document.querySelectorAll('#ffmpeg-presets .preset-switch');
    const presetDesc = document.getElementById('ffmpeg-preset-desc');

    let selectedFile = null;
    let selectedPreset = 'medium';
    let isCompressing = false;

    const MAX_FILE_MB = 800;
    const MAX_FILE_MB_HARD = 1500;
    const MAX_DIMENSION = 3840;
    const MOBILE_OOM_THRESHOLD_MB = 70;
    const PC_OOM_THRESHOLD_MB = 100;

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function showCompressOomWarning(fileMB) {
        return new Promise((resolve) => {
            const modal = document.getElementById('compress-oom-warning-modal');
            const btnCancel = document.getElementById('btn-compress-oom-cancel');
            const btnProceed = document.getElementById('btn-compress-oom-proceed');
            if (!modal) { resolve(false); return; }

            if (typeof window.applyTranslations === 'function') window.applyTranslations();
            modal.classList.remove('hidden');
            modal.classList.add('visible');

            const close = (result) => {
                modal.classList.remove('visible');
                modal.classList.add('hidden');
                resolve(result);
            };

            btnCancel.onclick = () => close(false);
            btnProceed.onclick = () => close(true);
        });
    }

    if (presetDesc) {
        presetDesc.innerHTML = window.getTranslation('ffmpeg_preset_' + selectedPreset + '_desc');
    }

    presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (isCompressing) return;
            presetChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedPreset = chip.getAttribute('data-preset');
            presetDesc.innerHTML = window.getTranslation('ffmpeg_preset_' + selectedPreset + '_desc');
        });
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--md-sys-color-primary)';
        dropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }

    function showOomWarning(fileMB, isHard) {
        const sizeStr = fileMB ? `${fileMB.toFixed(0)} MB` : 'too large';
        statusText.innerHTML = `
            <div style="background: hsl(0,60%,12%); border: 1px solid hsl(0,70%,40%); color: hsl(0,80%,80%); border-radius: 12px; padding: 14px 16px; font-size: 13px; line-height: 1.7; text-align: left; margin-top: 12px;">
                <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;margin-bottom:8px;">
                    <span class="material-symbols-rounded" style="font-size:20px;">memory_alt</span>
                    ${isHard ? 'File too large — cannot process' : 'Out of Memory (OOM)'}
                </div>
                <strong>Why this happened:</strong> FFmpeg runs inside WebAssembly which is capped at about <strong>1.8 GB</strong> of RAM. Your file (<strong>${sizeStr}</strong>) uses a high-bitrate codec like <strong>ProRes HQ</strong> or RAW — loading it into WASM exhausts all available memory before encoding can even begin.
                <br><br>
                <strong>How to fix it:</strong>
                <ul style="margin: 6px 0 0 0; padding-left: 18px; list-style: disc;">
                    <li>Export from your editor at a lower resolution (e.g. <strong>1080p H.264</strong>) first, then compress here.</li>
                    <li>Use <strong>HandBrake</strong> (free desktop app) to batch-compress ProRes files.</li>
                    <li>Use <strong>FFmpeg CLI</strong> on your computer: <code>ffmpeg -i input.mov -c:v libx264 -crf 20 output.mp4</code></li>
                </ul>
            </div>`;
    }

    function handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            showStatusError(window.getTranslation('status_error') + "Video File");
            btnStart.classList.add('hidden');
            return;
        }

        const fileMB = file.size / (1024 * 1024);

        if (fileMB > MAX_FILE_MB_HARD) {
            showOomWarning(fileMB, true);
            btnStart.classList.add('hidden');
            selectedFile = null;
            return;
        }

        selectedFile = file;
        const infoLine = window.getTranslation('status_selected') + `${file.name} (${fileMB.toFixed(2)} MB)`;

        if (fileMB > MAX_FILE_MB) {
            statusText.innerHTML = `
                <div style="background: hsl(40,80%,10%); border: 1px solid hsl(40,70%,35%); color: hsl(40,80%,75%); border-radius: 12px; padding: 12px 14px; font-size: 13px; line-height: 1.6; text-align: left; margin-bottom: 8px;">
                    <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;margin-bottom:6px;">
                        <span class="material-symbols-rounded" style="font-size:20px;">warning</span>
                        Large file warning &mdash; ${fileMB.toFixed(0)} MB
                    </div>
                    This file may cause an <strong>Out of Memory</strong> crash or extremely slow encoding. High-bitrate sources like ProRes 4K frequently exceed FFmpeg WASM's memory limit. Compression will still be attempted &mdash; downscaling to 4K and ultrafast preset will be applied automatically.
                </div>
                <span style="color: var(--md-sys-color-on-surface-variant); font-size: 13px;">${infoLine}</span>`;
            btnStart.classList.remove('hidden');
            return;
        }

        const isMobile = isMobileDevice();
        const threshold = isMobile ? MOBILE_OOM_THRESHOLD_MB : PC_OOM_THRESHOLD_MB;

        if (fileMB > threshold) {
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${infoLine}</span>`;
            showCompressOomWarning(fileMB).then((proceed) => {
                if (proceed) {
                    btnStart.classList.remove('hidden');
                } else {
                    btnStart.classList.add('hidden');
                    selectedFile = null;
                    statusText.innerHTML = `<span style="color: var(--md-sys-color-on-surface-variant);">${window.getTranslation('status_idle')}</span>`;
                }
            });
            return;
        }

        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${infoLine}</span>`;
        btnStart.classList.remove('hidden');
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        await compressVideo(selectedFile, selectedPreset);
    });

    function getVideoDimensions(file) {
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
            console.log('🚀 Loading FFmpeg libraries from CDN (with Blob worker security bypass)...');
            if (!window.FFmpegUtil) {
                await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
            }
            if (!window.FFmpegWASM) {
                const [ffmpegRes, workerRes] = await Promise.all([
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'),
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js')
                ]);

                if (!ffmpegRes.ok || !workerRes.ok) throw new Error('CDN HTTP response error');

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
            if (window.FFmpegWASM && window.FFmpegUtil) {
                console.log('✅ Loaded FFmpeg libraries SUCCESSFULLY from CDN');
                return true;
            }
        } catch (cdnErr) {
            console.warn('⚠️ CDN load failed, falling back to LOCAL assets/ffmpeg/...', cdnErr);
        }

        try {
            console.log('📦 Loading FFmpeg libraries from LOCAL fallback...');
            if (!window.FFmpegWASM) await loadScript('assets/ffmpeg/ffmpeg.js');
            if (!window.FFmpegUtil) await loadScript('assets/ffmpeg/index.js');
            if (window.FFmpegWASM && window.FFmpegUtil) {
                console.log('✅ Loaded FFmpeg libraries SUCCESSFULLY from LOCAL fallback');
                return true;
            }
        } catch (localErr) {
            console.error('❌ Failed to load FFmpeg libraries from LOCAL fallback:', localErr);
        }

        return !!(window.FFmpegWASM && window.FFmpegUtil);
    }

    window.loadFFmpegLibraries = loadFFmpegLibraries;

    async function compressVideo(file, preset) {
        if (isCompressing) return;
        isCompressing = true;

        let oomDetected = false;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';

        try {
            const { width, height } = await getVideoDimensions(file);
            const needsScale = width > MAX_DIMENSION || height > MAX_DIMENSION;
            if (needsScale) {
                console.log(`Video is ${width}x${height} — will auto-scale to max ${MAX_DIMENSION}px.`);
            }

            const isReady = await loadFFmpegLibraries();
            if (!isReady) {
                throw new Error("FFmpeg library failed to load. Please check your network connection and reload the page.");
            }
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            let ffmpeg = new FFmpeg();

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
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
                    console.log('🚀 [FFmpeg WASM] Downloading multi-threaded engine from CDN:', cdnBaseMT);
                    const coreURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.wasm`, 'application/wasm');
                    const workerURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.worker.js`, 'text/javascript');
                    await ffmpeg.load({ coreURL, wasmURL, workerURL });
                    loaded = true;
                    console.log('✅ [FFmpeg WASM] Loaded multi-threaded engine SUCCESSFULLY from CDN (jsDelivr)');
                } catch (err) {
                    console.warn('⚠️ [FFmpeg WASM] CDN load failed, falling back to local asset:', localBaseURL, err);
                    try {
                        console.log('📦 [FFmpeg WASM] Downloading multi-threaded engine from LOCAL fallback:', localBaseURL);
                        const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.js`, 'text/javascript');
                        const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.wasm`, 'application/wasm');
                        const workerURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                        await ffmpeg.load({ coreURL, wasmURL, workerURL });
                        loaded = true;
                        console.log('✅ [FFmpeg WASM] Loaded multi-threaded engine SUCCESSFULLY from LOCAL fallback');
                    } catch (localErr) {
                        console.warn('⚠️ [FFmpeg WASM] Local multi-threaded load failed, trying single-threaded:', localErr);
                        ffmpeg = new FFmpeg();
                    }
                }
            }

            if (!loaded) {
                try {
                    console.log('🚀 [FFmpeg WASM] Downloading single-threaded engine from CDN:', cdnBaseST);
                    const coreURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.wasm`, 'application/wasm');
                    await ffmpeg.load({ coreURL, wasmURL });
                    console.log('✅ [FFmpeg WASM] Loaded single-threaded engine SUCCESSFULLY from CDN (jsDelivr)');
                } catch (err) {
                    console.warn('⚠️ [FFmpeg WASM] CDN single-thread load failed, using LOCAL fallback:', localBaseURL, err);
                    const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                    await ffmpeg.load({ coreURL, wasmURL });
                    console.log('✅ [FFmpeg WASM] Loaded single-threaded engine SUCCESSFULLY from LOCAL fallback');
                }
            }

            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                const statusMsg = window.getTranslation('status_encoding');
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${statusMsg}...</span>`;
            });

            ffmpeg.on('log', ({ message }) => {
                console.log(message);
                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                }
            });

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
            await ffmpeg.writeFile('input.mp4', await fetchFile(file));

            const startMsg = window.getTranslation('status_encoding');
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${startMsg}</span>`;

            const threads = navigator.hardwareConcurrency 
                ? Math.min(navigator.hardwareConcurrency, 4).toString() 
                : '2';
            console.log(`Using ${threads} threads for compression.`);

            const scaleFilter = `scale='if(gt(iw,ih),min(iw,${MAX_DIMENSION}),-2)':'if(gt(iw,ih),-2,min(ih,${MAX_DIMENSION}))'`;

            let command = [];
            if (preset === 'slow') {
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
            } else if (preset === 'fast') {
                command = ['-i', 'input.mp4', '-threads', threads,
                    ...(needsScale ? ['-vf', scaleFilter] : []),
                    '-c:v', 'libx265', '-preset', 'veryfast', '-crf', '20', '-c:a', 'copy', 'output.mp4'];
            } else {
                command = ['-i', 'input.mp4', '-threads', threads,
                    ...(needsScale ? ['-vf', scaleFilter] : []),
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'copy', 'output.mp4'];
            }

            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                try {
                    const testData = await ffmpeg.readFile('output.mp4');
                    if (testData && testData.byteLength >= 1024) {
                        console.log('FFmpeg exited with abort signal but output file is valid.');
                    } else {
                        throw execError;
                    }
                } catch (readError) {
                    throw execError;
                }
            }

            if (oomDetected) {
                throw Object.assign(new Error('OOM'), { _oom: true });
            }

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
            const data = await ffmpeg.readFile('output.mp4');

            if (!data || data.byteLength < 1024) {
                throw Object.assign(new Error('OOM'), { _oom: true });
            }

            const rawOutput = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            let finalResultBytes = rawOutput;
            if (typeof window.patchMp4HDMethod === 'function') {
                try {
                    finalResultBytes = window.patchMp4HDMethod(rawOutput, true);
                } catch (patchErr) {
                    console.warn('V3 patcher fallback in video compressor:', patchErr);
                }
            }

            const blob = new Blob([finalResultBytes], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `compressed_${preset}_${file.name.replace(/\.[^.]+$/, '')}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;

            progressContainer.classList.add('hidden');
            btnStart.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            const msg = (error.message || '').toLowerCase();
            const isOom = error._oom
                || oomDetected
                || msg.includes('oom')
                || msg.includes('aborted')
                || msg.includes('out of memory')
                || msg.includes('abort');
            if (isOom) {
                showOomWarning(file.size / (1024 * 1024), false);
            } else {
                showStatusError(`Error: ${error.message}`);
            }
            progressContainer.classList.add('hidden');
            btnStart.classList.remove('hidden');
        } finally {
            isCompressing = false;
        }
    }
});
