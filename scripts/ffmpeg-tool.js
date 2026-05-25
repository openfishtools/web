document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-tiktok-patcher-input');
    const dropArea = document.getElementById('tool-tiktok-patcher-drop');
    const statusText = document.getElementById('tool-tiktok-patcher-status');
    const btnStart = document.getElementById('btn-start-compression');
    const progressContainer = document.getElementById('ffmpeg-progress-container');
    const progressFill = document.getElementById('ffmpeg-progress-fill');
    const progressPercent = document.getElementById('ffmpeg-progress-percent');
    const presetChips = document.querySelectorAll('#ffmpeg-presets .chip');

    let selectedFile = null;
    let selectedPreset = 'medium';

    // Preset selection logic
    presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            presetChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedPreset = chip.getAttribute('data-preset');
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

    function handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            statusText.textContent = "Please select a valid video file.";
            statusText.style.color = "var(--md-sys-color-error)";
            btnStart.classList.add('hidden');
            return;
        }
        selectedFile = file;
        statusText.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        statusText.style.color = "var(--md-sys-color-primary)";
        btnStart.classList.remove('hidden');
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        await compressVideo(selectedFile, selectedPreset);
    });

    async function compressVideo(file, preset) {
        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        statusText.textContent = "Loading FFmpeg...";
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';

        try {
            const { FFmpeg } = window.FFmpeg;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            const ffmpeg = new FFmpeg();

            // Setup Progress Listener
            ffmpeg.on('progress', ({ progress, time }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                statusText.textContent = `Compressing... (Time: ${time}s)`;
            });

            // Setup Log Listener for debugging
            ffmpeg.on('log', ({ message }) => {
                console.log(message);
            });

            // Load ffmpeg.wasm
            const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
            });

            statusText.textContent = "Reading file...";
            await ffmpeg.writeFile('input.mp4', await fetchFile(file));

            statusText.textContent = "Starting compression...";
            
            // Determine command based on preset
            let command = [];
            if (preset === 'slow') {
                // H.264 High Quality
                command = ['-i', 'input.mp4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'copy', 'output.mp4'];
            } else if (preset === 'fast') {
                // H.265 Fast Encoding
                command = ['-i', 'input.mp4', '-c:v', 'libx265', '-preset', 'fast', '-crf', '24', '-c:a', 'copy', 'output.mp4'];
            } else {
                // Medium H.264
                command = ['-i', 'input.mp4', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'copy', 'output.mp4'];
            }

            await ffmpeg.exec(command);

            statusText.textContent = "Saving output...";
            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            // Trigger Download
            const a = document.createElement('a');
            a.href = url;
            a.download = `compressed_${preset}_${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusText.textContent = "Compression finished! Download started.";
            statusText.style.color = "var(--md-sys-color-primary)";

            // Cleanup
            progressContainer.classList.add('hidden');
            btnStart.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            statusText.textContent = `Error: ${error.message}`;
            statusText.style.color = "var(--md-sys-color-error)";
            progressContainer.classList.add('hidden');
            btnStart.classList.remove('hidden');
        }
    }
});
