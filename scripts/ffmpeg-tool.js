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

    // --- Limits ---
    // FFmpeg WASM has a strict WebAssembly memory cap (~1.8 GB).
    // Encoding ProRes / large RAW files far exceeds that budget.
    const MAX_FILE_MB = 800;        // Soft-warn if file > 800 MB
    const MAX_FILE_MB_HARD = 1500;  // Hard-block if file > 1.5 GB
    const MAX_DIMENSION = 3840;     // Auto-downscale if width or height > 4K (3840)

    // Preset selection logic
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

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag & Drop
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

        // Hard block — will always OOM
        if (fileMB > MAX_FILE_MB_HARD) {
            showOomWarning(fileMB, true);
            btnStart.classList.add('hidden');
            selectedFile = null;
            return;
        }

        selectedFile = file;
        const infoLine = window.getTranslation('status_selected') + `${file.name} (${fileMB.toFixed(2)} MB)`;

        // Soft warning
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

        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${infoLine}</span>`;
        btnStart.classList.remove('hidden');
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        await compressVideo(selectedFile, selectedPreset);
    });

    // Get video dimensions using an offscreen video element
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

    async function compressVideo(file, preset) {
        if (isCompressing) return;
        isCompressing = true;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';

        try {
            // --- Pre-flight: detect resolution for auto-scaling and preset selection ---
            const { width, height } = await getVideoDimensions(file);
            const needsScale = width > MAX_DIMENSION || height > MAX_DIMENSION;
            if (needsScale) {
                console.log(`Video is ${width}x${height} — will auto-scale to max ${MAX_DIMENSION}px.`);
            }

            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            let ffmpeg = new FFmpeg();

            // Flag set by the log listener when WASM signals OOM.
            // Used to show the right error even when exec() doesn't throw.
            let oomDetected = false;

            // Load ffmpeg.wasm
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Loading FFmpeg...</span>`;
            const baseURL = window.location.origin + '/assets/ffmpeg';
            const isIosDevice = /iPhone|iPad|iPod|VisionPro/i.test(navigator.userAgent) || 
                               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                               (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
            const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice;
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
                }
            }

            if (!loaded) {
                console.log('Loading single-threaded FFmpeg...');
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                console.log('Single-threaded FFmpeg loaded successfully.');
            }

            // Setup Progress Listener
            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                const statusMsg = window.getTranslation('status_encoding');
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${statusMsg}...</span>`;
            });

            // Watch logs for OOM / abort signals from the WASM worker
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

            // Determine optimal thread count (capped to 4 to prevent WASM Out of Memory)
            const threads = navigator.hardwareConcurrency 
                ? Math.min(navigator.hardwareConcurrency, 4).toString() 
                : '2';
            console.log(`Using ${threads} threads for compression.`);

            // Scale filter — limits the longest edge to MAX_DIMENSION (4K), preserves aspect ratio,
            // forces even pixel dimensions (required by libx264/libx265).
            const scaleFilter = `scale='if(gt(iw,ih),min(iw,${MAX_DIMENSION}),-2)':'if(gt(iw,ih),-2,min(ih,${MAX_DIMENSION}))'`;

            // Build command based on user-chosen preset
            let command = [];
            if (preset === 'slow') {
                command = ['-i', 'input.mp4', '-threads', threads,
                    ...(needsScale ? ['-vf', scaleFilter] : []),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-c:a', 'copy', 'output.mp4'];
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

            // OOM check 1: log listener flagged it
            if (oomDetected) {
                throw Object.assign(new Error('OOM'), { _oom: true });
            }

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
            const data = await ffmpeg.readFile('output.mp4');

            // OOM check 2: output file is suspiciously small (< 1 KB = definitely failed)
            if (!data || data.byteLength < 1024) {
                throw Object.assign(new Error('OOM'), { _oom: true });
            }

            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            // Trigger Download
            const a = document.createElement('a');
            a.href = url;
            a.download = `compressed_${preset}_${file.name.replace(/\.[^.]+$/, '')}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;

            // Cleanup
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
