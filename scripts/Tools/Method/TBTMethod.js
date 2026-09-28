/* =========================================================================
 * Cutefish Smart Ingest Optimization Method (TBT / TEMP Method)
 * 
 * Instead of corrupting container headers (mvhd sentinel values) which are
 * now actively flagged/discarded by modern TikTok / ByteDance ingest engines,
 * this method pre-optimizes video streams to sit right in the TikTok "Ingest Sweetspot":
 * - Constrained VBR: CRF 18 with Maxrate 9.5 Mbps & 14 MB VBV buffer (avoids triggering TikTok's aggressive 2-pass crushing)
 * - Strict CFR (Constant Frame Rate, 60fps / 30fps)
 * - High Profile Level 4.2, YUV420p, BT.709 Web Rec Colorimetry
 * - Clean 1-2s GOP Cadence (-g 60, -keyint_min 30, -sc_threshold 0) for seamless HLS slicing
 * - Web-optimized faststart MP4 container
 * ========================================================================= */

(function () {
'use strict';

window.processVideoTBT = async function processVideoTBT(file, mode) {
    if (mode === undefined) mode = 'off';
    const s = window._tktk;
    if (!s) {
        throw new Error('TikTok tool state (_tktk) is not initialized.');
    }
    s.isProcessing = true;

    const isOff    = mode === 'off';
    const safeName = s.escapeHTML(file.name);

    if (s.btnStart) s.btnStart.disabled = true;
    if (s.progressContainer) s.progressContainer.classList.remove('hidden');
    if (s.logsContainer) s.logsContainer.classList.remove('hidden');
    const dlBtn = document.getElementById('tool-download-btn');
    if (dlBtn) dlBtn.classList.add('hidden');

    s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;
    s.progressFill.style.width = '0%';
    s.progressPercent.textContent = '0%';
    s.progressText.textContent = 'Preparing Smart Ingest Engine...';

    const modeLabel = isOff
        ? 'Smart Ingest Optimization (Source Aspect, Target 9.5M Capped)'
        : (mode === '720p' ? 'HD 720p Smart Re-encode' : 'Full HD 1080p Smart Re-encode');

    s.logSection('SMART INGEST METHOD (TEMP)');
    s.log(`  File   : ${safeName}`);
    s.log(`  Mode   : ${modeLabel}`);
    s.log(`  Engine : ByteDance Ingest Sweetspot Profiler (FFmpeg WASM)`);
    s.logEnd();

    try {
        let inputBuffer = s.currentFileBuffer;
        if (!inputBuffer) {
            throw new Error('Video buffer is empty.');
        }

        // 1. Emergency FPS check (>60fps conversion if needed)
        if (typeof window.isEmergencyFpsNeeded === 'function' && window.isEmergencyFpsNeeded(inputBuffer)) {
            s.log(`  [Emergency FPS] Video > 60fps detected. Converting timestamps to 60fps...`);
            try {
                inputBuffer = window.patchEmergencyFpsMethod(inputBuffer, s.log);
            } catch (emErr) {
                s.log(`  [Notice] Emergency FPS patch error: ${emErr.message}`);
            }
        }

        // 2. Load FFmpeg WASM
        const isReady = await s.loadFFmpegLibraries();
        if (!isReady) {
            throw new Error('FFmpeg processing engine failed to load. Please check network connection.');
        }

        const { toBlobURL } = window.FFmpegUtil;
        const ffmpeg = await s.loadFFmpegHelper(null, toBlobURL);
        let oomDetected = false;
        let lastLogTime = 0;

        ffmpeg.on('progress', ({ progress }) => {
            const percent = Math.max(0, Math.min(95, Math.round(progress * 100)));
            s.progressFill.style.width = `${percent}%`;
            s.progressPercent.textContent = `${percent}%`;
            const stMsg = `${window.getTranslation('status_encoding')} (${percent}%)...`;
            if (s.statusText) {
                s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${stMsg}</span>`;
            }
            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent, status: stMsg, file });
            }
        });

        ffmpeg.on('log', ({ message }) => {
            const lc = message.toLowerCase();
            if (lc.includes('oom') || lc.includes('out of memory')) oomDetected = true;
            if (message.includes('frame=') && (message.includes('fps=') || message.includes('size='))) {
                const now = Date.now();
                if (now - lastLogTime > 2000) {
                    lastLogTime = now;
                    s.log(`    ${message.trim().replace(/\s+/g, ' ')}`);
                }
            }
        });

        // 3. Write input file into virtual FS
        s.logSection('Writing Input');
        s.log(`  Input size: ${(inputBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);
        await ffmpeg.writeFile('input.mp4', new Uint8Array(inputBuffer));
        s.logEnd();

        // 4. Inspect video geometry & FPS
        let srcW = 1080;
        let srcH = 1920;
        let srcFps = 30;

        try {
            const res = s.parseResolutionFromMp4(inputBuffer);
            if (res && res.width && res.height) {
                srcW = res.width;
                srcH = res.height;
            }
            const fps = s.parseFpsFromMp4(inputBuffer);
            if (fps && fps > 0 && fps <= 120) {
                srcFps = fps;
            }
        } catch (_) {}

        s.logSection('Profile Calibration');
        s.log(`  Detected input: ${srcW}x${srcH} @ ${srcFps} FPS`);

        // Compute scaling filter
        let filterParts = [];
        let targetW = srcW;
        let targetH = srcH;

        if (mode === '720p') {
            const shortSide = Math.min(srcW, srcH);
            const ratio = 720 / shortSide;
            targetW = Math.round(srcW * ratio);
            targetH = Math.round(srcH * ratio);
        } else if (mode === '1080p') {
            const shortSide = Math.min(srcW, srcH);
            const ratio = 1080 / shortSide;
            targetW = Math.round(srcW * ratio);
            targetH = Math.round(srcH * ratio);
        } else {
            // Mode 'off': keep source size, but cap short side at 1080 to prevent TikTok 4K downscale penalty
            const shortSide = Math.min(srcW, srcH);
            if (shortSide > 1080) {
                const ratio = 1080 / shortSide;
                targetW = Math.round(srcW * ratio);
                targetH = Math.round(srcH * ratio);
                s.log(`  Capping resolution to 1080p boundary (${targetW}x${targetH}) to avoid TikTok 4K downscale`);
            }
        }

        // Ensure even dimensions
        targetW = Math.floor(targetW / 2) * 2;
        targetH = Math.floor(targetH / 2) * 2;

        if (targetW !== srcW || targetH !== srcH) {
            filterParts.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease`);
            filterParts.push(`pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2`);
        } else {
            filterParts.push(`scale=trunc(iw/2)*2:trunc(ih/2)*2`);
        }

        // Apply slight detail enhancement to preserve crispness across ingest
        filterParts.push(`unsharp=3:3:0.35:3:3:0.0`);
        filterParts.push(`format=yuv420p`);

        const vfString = filterParts.join(',');
        s.log(`  Target scale : ${targetW}x${targetH}`);
        s.log(`  Video Filter : ${vfString}`);

        // Tuning parameters according to TikTok Ingest rules:
        // - maxrate: 9500k for 1080p (sits just under the 10-12 Mbps trigger)
        // - bufsize: 14M (VBV constrained rate control)
        // - crf: 18 (near lossless quality)
        // - GOP: 60 frames (exactly 1-2 sec chunks for HLS)
        const is720 = (mode === '720p');
        const crf = is720 ? '20' : '18';
        const maxrate = is720 ? '6000k' : '9500k';
        const bufsize = is720 ? '9M' : '14M';
        const audioBitrate = is720 ? '128k' : '192k';
        const gop = Math.min(120, Math.max(30, Math.round(srcFps * 2))).toString();

        s.log(`  Bitrate Cap  : Max ${maxrate}, VBV Buf ${bufsize}, CRF ${crf}`);
        s.log(`  GOP Cadence  : ${gop} frames (CFR Strict)`);
        s.logEnd();

        const hardwareThreads = navigator.hardwareConcurrency || 4;
        const fileMB = file.size / (1024 * 1024);
        const safeThreads = (fileMB > 50) ? '2' : Math.min(4, hardwareThreads).toString();

        const command = [
            '-y',
            '-i', 'input.mp4',
            '-threads', safeThreads,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-dn',
            '-map_metadata', '-1',
            '-map_chapters', '-1',
            '-vf', vfString,
            '-vsync', 'cfr',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', crf,
            '-maxrate', maxrate,
            '-bufsize', bufsize,
            '-profile:v', 'high',
            '-level', '4.2',
            '-x264-params', '8x8dct=1:cabac=1:bframes=2:b-adapt=1:scenecut=0:aq-mode=2:aq-strength=1.0:deblock=0,0',
            '-colorspace', 'bt709',
            '-color_primaries', 'bt709',
            '-color_trc', 'bt709',
            '-g', gop,
            '-keyint_min', Math.round(srcFps).toString(),
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', audioBitrate,
            '-ar', '48000',
            '-ac', '2',
            '-movflags', '+faststart',
            'output.mp4'
        ];

        s.logSection('Executing FFmpeg Encoding');
        s.log(`  Command: ffmpeg ${command.join(' ')}`);
        await ffmpeg.exec(command);
        s.logEnd();

        if (oomDetected) {
            throw new Error('Out of memory encountered during encoding. Try compressing video first or use a shorter clip.');
        }

        // 5. Read output from virtual FS
        s.logSection('Finalizing Output');
        s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
        const outputData = await ffmpeg.readFile('output.mp4');
        if (!outputData || outputData.byteLength < 1024) {
            throw new Error('Generated output is empty or corrupted.');
        }

        const outBytes = new Uint8Array(outputData.buffer || outputData);
        s.log(`  Output size: ${(outBytes.byteLength / (1024 * 1024)).toFixed(2)} MB`);
        s.logEnd();

        // 6. Trigger download
        const blob = new Blob([outBytes], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const filename = `${file.name.replace(/\.[^.]+$/, '')}_smart_hq.mp4`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (dlBtn) {
            dlBtn.classList.remove('hidden');
            dlBtn.onclick = () => {
                const da = document.createElement('a');
                da.href = url;
                da.download = filename;
                document.body.appendChild(da);
                da.click();
                document.body.removeChild(da);
            };
        }

        // 7. Complete UI state
        s.statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
        s.progressFill.style.width = '100%';
        s.progressPercent.textContent = '100%';

        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', {
                isProcessing: false,
                completed: true,
                percent: 100,
                status: window.getTranslation('status_completed'),
                file
            });
        }

        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        const processIcon = document.getElementById('tool-process-icon');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.dataset.state = 'completed';
            if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('status_process_another')) || 'Process Another';
            if (processIcon) processIcon.textContent = 'restart_alt';
        }

        if (typeof window.showToast === 'function') {
            window.showToast((window.getTranslation && window.getTranslation('status_completed_toast')) || 'Smart Ingest Video Ready!');
        }

        if (typeof s.showTikTokStudioUploadPrompt === 'function') {
            s.showTikTokStudioUploadPrompt();
        }

    } catch (error) {
        s.log(`  !! Process Error: ${s.escapeHTML(error.message)}`);
        console.error(error);
        s.showStatusError(`Error: ${s.escapeHTML(error.message)}`);
        if (s.btnStart) s.btnStart.disabled = false;
    } finally {
        s.isProcessing = false;
        if (s.btnStart) s.btnStart.disabled = false;
    }
};

window.processVideoTEMP = window.processVideoTBT;

})();
