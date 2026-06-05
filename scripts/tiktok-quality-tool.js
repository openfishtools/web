document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-tiktok-input');
    const dropArea = document.getElementById('tool-tiktok-drop');
    const statusText = document.getElementById('tool-tiktok-status');
    const btnStart = document.getElementById('btn-start-tiktok');
    const progressContainer = document.getElementById('tiktok-progress-container');
    const progressFill = document.getElementById('tiktok-progress-fill');
    const progressPercent = document.getElementById('tiktok-progress-percent');
    const logsContainer = document.getElementById('tiktok-logs-container');
    const logsEl = document.getElementById('tiktok-logs');

    let selectedFile = null;
    let isProcessing = false;

    const MAX_FILE_MB_HARD = 1500;  // Hard-block if file > 1.5 GB

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

    function handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            showStatusError("Please select a valid video file.");
            btnStart.classList.add('hidden');
            return;
        }

        const fileMB = file.size / (1024 * 1024);

        if (fileMB > MAX_FILE_MB_HARD) {
            showStatusError(`File is too large (${fileMB.toFixed(1)} MB). Max limit is ${MAX_FILE_MB_HARD} MB.`);
            btnStart.classList.add('hidden');
            selectedFile = null;
            return;
        }

        selectedFile = file;
        const infoLine = `Selected: ${file.name} (${fileMB.toFixed(2)} MB)`;
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${infoLine}</span>`;
        btnStart.classList.remove('hidden');
        
        // Reset progress/logs on new file selection
        progressContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        await processVideo(selectedFile);
    });

    async function processVideo(file) {
        if (isProcessing) return;
        isProcessing = true;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Initializing FFmpeg...</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        logsEl.textContent = 'Initializing process...\n';

        try {
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            const ffmpeg = new FFmpeg();

            let oomDetected = false;

            let oomLine = '';

            // Setup Progress Listener
            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Processing quality settings...</span>`;
            });

            // Log messages to log element
            ffmpeg.on('log', ({ message }) => {
                logsEl.textContent += message + '\n';
                logsEl.scrollTop = logsEl.scrollHeight;

                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                    oomLine = message;
                    console.warn(`OOM detected in log line: "${message}"`);
                }
            });

            // Load ffmpeg.wasm
            const baseURL = window.location.origin + '/assets/ffmpeg';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
            });

            logsEl.textContent += 'Writing file to virtual filesystem...\n';
            await ffmpeg.writeFile('input.mp4', await fetchFile(file));

            // Limit threads to a maximum of 4 to prevent WASM OOM crashes
            const hardwareThreads = navigator.hardwareConcurrency || 4;
            const threads = Math.min(4, hardwareThreads).toString();
            
            // WMV setting: ffmpeg -i IN.mp4 -c:v wmv2 -qscale:v 1 -r 60 -c:a wmav2 -b:a 320k OUT.wmv
            // Output 720p: scale='if(lt(iw,ih),720,-2)':'if(lt(iw,ih),-2,720)'
            const command = [
                '-i', 'input.mp4',
                '-threads', threads,
                '-vf', "scale='if(lt(iw,ih),720,-2)':'if(lt(iw,ih),-2,720)'",
                '-c:v', 'wmv2',
                '-qscale:v', '1',
                '-r', '60',
                '-c:a', 'wmav2',
                '-b:a', '320k',
                'output.wmv'
            ];

            logsEl.textContent += `Executing command: ffmpeg ${command.join(' ')}\n`;
            
            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                // Check if file was actually generated successfully despite the exit exception
                try {
                    const testData = await ffmpeg.readFile('output.wmv');
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
                throw new Error(`Out of memory during video processing. (Triggered by log: "${oomLine}")`);
            }

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Saving output...</span>`;
            const data = await ffmpeg.readFile('output.wmv');

            if (!data || data.byteLength < 1024) {
                throw new Error('Processing failed (output is empty or too small).');
            }

            const blob = new Blob([data.buffer], { type: 'video/x-ms-wmv' });
            const url = URL.createObjectURL(blob);

            // Trigger Download
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name.replace(/\.[^.]+$/, '')}_720p_hq.wmv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">&#10003; Process finished! Download started.</span>`;
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';

            btnStart.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            showStatusError(`Error: ${error.message}`);
            btnStart.classList.remove('hidden');
        } finally {
            isProcessing = false;
        }
    }
});
