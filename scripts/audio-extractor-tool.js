document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-audio-input');
    const dropArea = document.getElementById('tool-audio-drop');
    const statusText = document.getElementById('tool-audio-status');
    const btnStart = document.getElementById('btn-start-audio');
    const progressContainer = document.getElementById('audio-progress-container');
    const progressFill = document.getElementById('audio-progress-fill');
    const progressPercent = document.getElementById('audio-progress-percent');

    let selectedFile = null;
    let isExtracting = false;

    const MAX_FILE_MB = 800;
    const MAX_FILE_MB_HARD = 1500;

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
                    <li>Export from your editor at a lower resolution (e.g. <strong>1080p H.264</strong>) first, then extract here.</li>
                    <li>Use <strong>FFmpeg CLI</strong> on your computer: <code>ffmpeg -i input.mov -vn -c:a libmp3lame -b:a 192k audio.mp3</code></li>
                </ul>
            </div>`;
    }

    function handleFileSelection(file) {
        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|avi|mkv|webm|flv|3gp|wmv)$/i)) {
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
                    This file may cause an <strong>Out of Memory</strong> crash or extremely slow extraction. Compression will still be attempted.
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
        await extractAudio(selectedFile);
    });

    async function extractAudio(file) {
        if (isExtracting) return;
        isExtracting = true;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';

        try {
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            let ffmpeg = new FFmpeg();
            let oomDetected = false;

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Loading FFmpeg...</span>`;
            const baseURL = window.location.origin + '/assets/ffmpeg';
            const isIosDevice = /iPhone|iPad|iPod|VisionPro/i.test(navigator.userAgent) || 
                               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                               (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
            const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice;
            let loaded = false;

            if (isMultiThread) {
                try {
                    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                    const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                    await ffmpeg.load({ coreURL, wasmURL, workerURL });
                    loaded = true;
                } catch (err) {
                    ffmpeg = new FFmpeg();
                }
            }

            if (!loaded) {
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
            }

            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                const statusMsg = window.getTranslation('status_extracting_frames') || 'Extracting...';
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
            const ext = file.name.split('.').pop() || 'mp4';
            const inputName = `input.${ext}`;
            await ffmpeg.writeFile(inputName, await fetchFile(file));

            const threads = navigator.hardwareConcurrency 
                ? Math.min(navigator.hardwareConcurrency, 4).toString() 
                : '2';

            const command = ['-i', inputName, '-threads', threads, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', 'audio.mp3'];

            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                try {
                    const testData = await ffmpeg.readFile('audio.mp3');
                    if (testData && testData.byteLength >= 1024) {
                        console.log('FFmpeg exited but file is valid');
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
            const data = await ffmpeg.readFile('audio.mp3');

            if (!data || data.byteLength < 1024) {
                throw Object.assign(new Error('OOM'), { _oom: true });
            }

            const blob = new Blob([data.buffer], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'audio.mp3';
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
            isExtracting = false;
        }
    }
});
