document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-seq-input');
    const dropArea = document.getElementById('tool-seq-drop');
    const zipInner = document.getElementById('tool-seq-inner');

    const audioFileInput = document.getElementById('tool-seq-audio-input');
    const audioDropArea = document.getElementById('tool-seq-audio-drop');
    const audioInner = document.getElementById('tool-seq-audio-inner');

    const statusText = document.getElementById('tool-seq-status');
    const btnStart = document.getElementById('btn-start-seq');
    const progressContainer = document.getElementById('seq-progress-container');
    const progressFill = document.getElementById('seq-progress-fill');
    const progressPercent = document.getElementById('seq-progress-percent');
    const progressText = document.getElementById('seq-progress-text');
    const fpsInput = document.getElementById('tool-seq-fps');
    const bitrateInput = document.getElementById('tool-seq-bitrate');

    let selectedFile = null;
    let selectedAudioFile = null;
    let isProcessing = false;

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag & Drop events for ZIP
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

    // Drag & Drop events for Audio
    audioDropArea.addEventListener('click', () => audioFileInput.click());
    audioDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioDropArea.style.borderColor = 'var(--md-sys-color-primary)';
        audioDropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    audioDropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        audioDropArea.style.borderColor = '';
        audioDropArea.style.background = '';
    });
    audioDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        audioDropArea.style.borderColor = '';
        audioDropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleAudioSelection(e.dataTransfer.files[0]);
        }
    });

    // Audio File Selection
    audioFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAudioSelection(e.target.files[0]);
        }
    });

    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }

    function handleFileSelection(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            showStatusError(window.getTranslation('status_error') + "ZIP");
            resetZipUI();
            return;
        }

        selectedFile = file;
        const fileMB = file.size / (1024 * 1024);
        statusText.innerHTML = ''; // clear any errors
        updateZipUI(file.name, fileMB);
    }

    function handleAudioSelection(file) {
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
        
        if (!isAudio && !isVideo) {
            showStatusError(window.getTranslation('status_error') + "Audio/Video");
            resetAudioUI();
            return;
        }

        selectedAudioFile = file;
        const fileMB = file.size / (1024 * 1024);
        statusText.innerHTML = ''; // clear any errors
        updateAudioUI(file.name, fileMB, isVideo);
    }

    function resetZipUI() {
        selectedFile = null;
        fileInput.value = '';
        zipInner.innerHTML = `
            <span class="material-symbols-rounded">folder_zip</span>
            <span>${window.getTranslation('tool_seq_drop')}</span>
        `;
        btnStart.classList.add('hidden');
        statusText.innerHTML = '';
    }

    function updateZipUI(filename, sizeMB) {
        zipInner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; min-width: 0; pointer-events: auto;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex-grow: 1;">
                    <span class="material-symbols-rounded" style="color: var(--md-sys-color-primary); font-size: 24px;">folder_zip</span>
                    <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;" title="${filename}">${window.getTranslation('status_selected')}${filename} (${sizeMB.toFixed(2)} MB)</span>
                </div>
                <button type="button" id="btn-seq-cancel-zip" style="background: var(--md-sys-color-surface-container-highest); border: none; color: var(--md-sys-color-error); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; width: 28px; height: 28px; transition: background 0.2s; flex-shrink: 0;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
                </button>
            </div>
        `;
        
        document.getElementById('btn-seq-cancel-zip').addEventListener('click', (e) => {
            e.stopPropagation();
            resetZipUI();
        });

        btnStart.classList.remove('hidden');
    }

    function resetAudioUI() {
        selectedAudioFile = null;
        audioFileInput.value = '';
        audioInner.innerHTML = `
            <span class="material-symbols-rounded">audio_file</span>
            <span id="tool-seq-audio-label">${window.getTranslation('tool_seq_audio_drop')}</span>
        `;
    }

    function updateAudioUI(filename, sizeMB, isVideo = false) {
        const iconName = isVideo ? 'video_file' : 'audio_file';
        const labelKey = isVideo ? 'Video Audio Source' : 'Audio Source';
        const labelPrefix = window.getTranslation('status_selected') + labelKey;

        audioInner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; min-width: 0; pointer-events: auto;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex-grow: 1;">
                    <span class="material-symbols-rounded" style="color: var(--md-sys-color-primary); font-size: 24px;">${iconName}</span>
                    <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;" title="${filename}">${labelPrefix}: ${filename} (${sizeMB.toFixed(2)} MB)</span>
                </div>
                <button type="button" id="btn-seq-cancel-audio" style="background: var(--md-sys-color-surface-container-highest); border: none; color: var(--md-sys-color-error); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; width: 28px; height: 28px; transition: background 0.2s; flex-shrink: 0;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
                </button>
            </div>
        `;

        document.getElementById('btn-seq-cancel-audio').addEventListener('click', (e) => {
            e.stopPropagation();
            resetAudioUI();
        });
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile || isProcessing) return;
        await processSequence(selectedFile);
    });

    // Main conversion function
    async function processSequence(file) {
        isProcessing = true;
        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = window.getTranslation('status_processing');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_extracting_frames')}</span>`;

        let writtenFiles = [];
        let firstExt = 'jpg';
        let ffmpeg = null;

        try {
            // 1. Unzip using JSZip (Actual file reading triggers here)
            const zip = await JSZip.loadAsync(file);
            const imageEntries = [];

            zip.forEach((relativePath, zipEntry) => {
                if (zipEntry.dir) return;
                
                const lowercasePath = relativePath.toLowerCase();
                // Filter out macOS metadata and system files
                if (lowercasePath.includes('__macosx') || lowercasePath.split('/').some(part => part.startsWith('.'))) {
                    return;
                }

                // Check for image extensions
                if (/\.(jpe?g|png|webp|bmp)$/.test(lowercasePath)) {
                    const filename = relativePath.split('/').pop();
                    const numMatch = filename.match(/^(\d+)/);
                    const frameIndex = numMatch ? parseInt(numMatch[1], 10) : -1;
                    
                    imageEntries.push({
                        path: relativePath,
                        entry: zipEntry,
                        filename: filename,
                        frameIndex: frameIndex
                    });
                }
            });

            if (imageEntries.length === 0) {
                throw new Error(window.getTranslation('status_empty_zip'));
            }

            // Sort files numerically by their frame prefix
            if (imageEntries.some(e => e.frameIndex !== -1)) {
                imageEntries.sort((a, b) => a.frameIndex - b.frameIndex);
            } else {
                imageEntries.sort((a, b) => a.path.localeCompare(b.path));
            }

            console.log(`Found and sorted ${imageEntries.length} frames.`);
            
            // Get frame extension
            const sampleName = imageEntries[0].filename.toLowerCase();
            if (sampleName.endsWith('.png')) {
                firstExt = 'png';
            } else if (sampleName.endsWith('.webp')) {
                firstExt = 'webp';
            } else if (sampleName.endsWith('.bmp')) {
                firstExt = 'bmp';
            } else {
                firstExt = 'jpg';
            }

            // 2. Load FFmpeg WASM
            progressFill.style.width = '15%';
            progressPercent.textContent = '15%';
            progressText.textContent = window.getTranslation('status_loading_engine');
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;

            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            ffmpeg = new FFmpeg();

            const baseURL = window.location.origin + '/assets/ffmpeg';
            const isIosDevice = /iPhone|iPad|iPod|VisionPro/i.test(navigator.userAgent) || 
                               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                               (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
            const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice;
            let loaded = false;

            if (isMultiThread) {
                try {
                    console.log('[SeqToVideo] Loading multi-threaded FFmpeg...');
                    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                    const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                    await ffmpeg.load({ coreURL, wasmURL, workerURL });
                    loaded = true;
                } catch (err) {
                    console.warn('[SeqToVideo] Failed multi-thread, using single-thread:', err);
                    ffmpeg = new FFmpeg();
                }
            }

            if (!loaded) {
                console.log('[SeqToVideo] Loading single-threaded FFmpeg...');
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
            }

            let oomDetected = false;
            ffmpeg.on('log', ({ message }) => {
                console.log(`[SeqToVideo FFmpeg] ${message}`);
                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                }
            });

            // 3. Write image files to FFmpeg Virtual Filesystem
            progressFill.style.width = '30%';
            progressPercent.textContent = '30%';
            progressText.textContent = window.getTranslation('status_writing_frames');
            
            const totalFrames = imageEntries.length;
            for (let i = 0; i < totalFrames; i++) {
                const percent = 30 + Math.round((i / totalFrames) * 20); // 30% to 50%
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                
                const entry = imageEntries[i];
                const frameData = await entry.entry.async('uint8array');
                const virtualName = `frame_${String(i).padStart(5, '0')}.${firstExt}`;
                
                await ffmpeg.writeFile(virtualName, frameData);
                writtenFiles.push(virtualName);
            }

            // Write audio file if selected
            let virtualAudioName = '';
            if (selectedAudioFile) {
                const audioExt = selectedAudioFile.name.split('.').pop().toLowerCase() || 'mp3';
                virtualAudioName = `input_audio.${audioExt}`;
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_writing_audio')}</span>`;
                await ffmpeg.writeFile(virtualAudioName, await fetchFile(selectedAudioFile));
                writtenFiles.push(virtualAudioName);
            }

            // 4. Run FFmpeg command to compile the video
            progressFill.style.width = '55%';
            progressPercent.textContent = '55%';
            progressText.textContent = window.getTranslation('status_encoding');
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_encoding')}</span>`;

            const fps = parseInt(fpsInput.value, 10) || 30;
            const bitrate = parseInt(bitrateInput.value, 10) || 30;
            const threads = navigator.hardwareConcurrency 
                ? Math.min(navigator.hardwareConcurrency, 4).toString() 
                : '2';

            // FFmpeg progress handler
            ffmpeg.on('progress', ({ progress }) => {
                const percent = 55 + Math.round(progress * 40); // 55% to 95%
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
            });

            console.log(`[SeqToVideo] Compiling ${totalFrames} frames at ${fps} FPS, ${bitrate} Mbps.`);
            const command = [
                '-framerate', fps.toString(),
                '-i', `frame_%05d.${firstExt}`
            ];

            if (selectedAudioFile) {
                command.push('-i', virtualAudioName);
            }

            command.push(
                '-threads', threads,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-b:v', `${bitrate}M`
            );

            if (selectedAudioFile) {
                // Explicitly map first input video stream and second input audio stream, ignoring input video track
                command.push(
                    '-map', '0:v',
                    '-map', '1:a',
                    '-c:a', 'aac',
                    '-shortest'
                );
            }

            command.push('output.mp4');

            await ffmpeg.exec(command);

            if (oomDetected) {
                throw new Error("FFmpeg ran out of memory. Try using fewer frames or lower resolution images.");
            }

            // 5. Read output and trigger download
            progressFill.style.width = '96%';
            progressPercent.textContent = '96%';
            progressText.textContent = window.getTranslation('status_finalizing');

            const outputData = await ffmpeg.readFile('output.mp4');
            if (!outputData || outputData.length === 0) {
                throw new Error("FFmpeg execution finished but generated an empty output file.");
            }

            const videoBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
            const videoUrl = URL.createObjectURL(videoBlob);
            
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = `${file.name.replace(/\.[^/.]+$/, "")}_video_${fps}fps.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = window.getTranslation('status_completed');
            statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">${window.getTranslation('status_download_success')}</span>`;

            // Release URL object after download
            setTimeout(() => URL.revokeObjectURL(videoUrl), 10000);

        } catch (err) {
            console.error('[SeqToVideo] Error:', err);
            showStatusError(window.getTranslation('status_error') + (err.message || ""));
            progressContainer.classList.add('hidden');
        } finally {
            // 6. Purge cache by deleting files in the virtual filesystem
            if (ffmpeg) {
                statusText.innerHTML += `<br><span style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); opacity: 0.85;">${window.getTranslation('status_cleanup')}</span>`;
                console.log(`[SeqToVideo] Cleaning up ${writtenFiles.length} cache files from virtual memory.`);
                
                // Delete output file
                try {
                    await ffmpeg.deleteFile('output.mp4');
                } catch(e) {}
                
                // Delete frame files in chunks to avoid blocking
                for (const virtualFile of writtenFiles) {
                    try {
                        await ffmpeg.deleteFile(virtualFile);
                    } catch(e) {
                        console.warn(`[SeqToVideo] Failed to delete cache file ${virtualFile}:`, e);
                    }
                }
                
                console.log(`[SeqToVideo] Cleanup complete.`);
                statusText.innerHTML = statusText.innerHTML.replace(`<br><span style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); opacity: 0.85;">${window.getTranslation('status_cleanup')}</span>`, '');
            }

            isProcessing = false;
            btnStart.classList.remove('hidden');
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 5000);
        }
    }
});
