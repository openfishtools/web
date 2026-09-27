(function () {
'use strict';

/**
 * Shared FFmpeg video compression engine for TikTok patch methods.
 * Optimized for low file size (MB) while retaining sharp details in high-motion scenes.
 *
 * @param {File} file - Original user-selected video file
 * @param {'720p'|'1080p'} mode - Target compression resolution
 * @param {ArrayBuffer|Uint8Array} [inputBuffer] - Video bytes (defaults to window._tktk.currentFileBuffer)
 * @returns {Promise<Uint8Array>} Raw compressed MP4 bytes ready for metadata patching
 */
async function compressVideo(file, mode, inputBuffer) {
    if (!mode || mode === 'off') {
        throw new Error('Compression mode must be 720p or 1080p.');
    }
    const s = window._tktk;
    if (!s) throw new Error('TikTok tool state (_tktk) is not initialized.');

    const isReady = await s.loadFFmpegLibraries();
    if (!isReady) throw new Error('Processing engine failed to load.');

    const { toBlobURL } = window.FFmpegUtil;
    let ffmpeg = await s.loadFFmpegHelper(null, toBlobURL);
    let oomDetected = false;
    let lastLogTime = 0;

    ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.max(0, Math.min(90, Math.round(progress * 90)));
        if (s.progressFill) s.progressFill.style.width = `${percent}%`;
        if (s.progressPercent) s.progressPercent.textContent = `${percent}%`;
        const stMsg = `${window.getTranslation('status_encoding')}...`;
        if (s.statusText) s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${stMsg}</span>`;
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent, status: stMsg, file });
        }
    });

    ffmpeg.on('log', ({ message }) => {
        const lc = message.toLowerCase();
        if (lc.includes('oom') || lc.includes('out of memory')) oomDetected = true;
        // Output live encoding status so user sees real-time progress
        if (message.includes('frame=') && (message.includes('fps=') || message.includes('size='))) {
            const now = Date.now();
            if (now - lastLogTime > 2500) {
                lastLogTime = now;
                const cleanMsg = message.trim().replace(/\s+/g, ' ');
                s.log(`    ${cleanMsg}`);
            }
        }
    });

    s.log(`  [1/3] Loading video data for compression...`);
    const buffer = inputBuffer || s.currentFileBuffer;
    if (!buffer) throw new Error('Video buffer is empty.');

    const preParseBuffer = buffer ? buffer.slice(0) : null;
    await ffmpeg.writeFile('input.mp4', new Uint8Array(buffer));

    const fileMB = file.size / (1024 * 1024);
    const hardwareThreads = navigator.hardwareConcurrency || 4;
    const safeThreads = (fileMB > 50) ? '2' : Math.min(4, hardwareThreads).toString();

    s.log(`  [2/3] Optimizing video quality (${mode.toUpperCase()})...`);
    const threads = fileMB > 50 ? '2' : safeThreads;

    let vInfoFps = null, vInfoW = 0, vInfoH = 0;
    if (preParseBuffer) {
        try {
            vInfoFps = s.parseFpsFromMp4(preParseBuffer);
            const r = s.parseResolutionFromMp4(preParseBuffer);
            if (r) { vInfoW = r.width; vInfoH = r.height; }
        } catch (e) {}
    }
    const procOpts = s.computeVideoProcessingOptions(vInfoW, vInfoH, vInfoFps, fileMB, mode);
    s.log(`  FFmpeg filters: ${procOpts.vfString}`);

    // Both 1080p and 720p use preset ultrafast for maximum encoding speed in WebAssembly (WASM)
    const x264Preset = 'ultrafast';

    // Flexible Dynamic VBR H.264 Settings (20 Mbps Motion Burst Ceiling + Deep Static Compression):
    // - preset ultrafast: fastest execution in WebAssembly
    // - maxrate 20000k (20 Mbps) for both 1080p and 720p: shoots up to 20 Mbps during fast motion so 60 FPS is crystal clear HD
    // - crf 19: dynamic ratecontrol target; drops bitrate drastically down to 1-3 Mbps when scenes are static/minimal motion
    // - bframes=3:b-adapt=1: enables adaptive bidirectional B-frames that use skip-macroblocks on static frames (huge space savings)
    // - scenecut=40: automatically inserts keyframes at scene transitions to prevent wasting motion vectors across cuts
    // - qcomp=0.75: quantizer curve flexibility allowing bitrate to swing dynamically between static and fast motion
    // - 8x8dct=1 & cabac=1: High Profile 8x8 DCT transform + arithmetic coding (eliminates 4x4 block mosaic)
    // - deblock=0,0: standard in-loop deblocking filter (smooths macroblock boundaries)
    // - aq-mode=2: Auto-variance AQ balances bits across flat areas and rapid motion
    const crfValue     = '19';
    const maxRate      = '20000k';
    const bufSize      = '25M';
    const audioBitrate = (mode === '720p') ? '128k' : '160k';
    const gopSize      = Math.max(48, Math.min(240, (vInfoFps || 30) * 2)).toString();

    const command = [
        '-y', '-i', 'input.mp4',
        '-threads', threads,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-dn',
        '-map_metadata', '-1',
        '-map_chapters', '-1',
        '-vf', procOpts.vfString,
        '-vsync', 'cfr',
        '-c:v', 'libx264',
        '-preset', x264Preset,
        '-crf', crfValue,
        '-maxrate', maxRate,
        '-bufsize', bufSize,
        '-x264-params', '8x8dct=1:cabac=1:bframes=3:b-adapt=1:scenecut=40:qcomp=0.75:aq-mode=2:aq-strength=1.0:deblock=0,0',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-g', gopSize,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', audioBitrate,
        '-movflags', '+faststart',
        'output.mp4'
    ];
    s.log(`  Encoder: libx264 (WASM Dynamic VBR) ${x264Preset} crf=${crfValue} maxrate=${maxRate}`);

    try {
        await ffmpeg.exec(command);
    } catch (execError) {
        s.log(`  [Notice] Encoding retry with standard libx264...`);
        const fallbackCommand = [
            '-y', '-i', 'input.mp4',
            '-threads', threads,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-dn',
            '-map_metadata', '-1',
            '-map_chapters', '-1',
            '-vf', procOpts.vfString,
            '-vsync', 'cfr',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', crfValue,
            '-maxrate', maxRate,
            '-bufsize', bufSize,
            '-colorspace', 'bt709',
            '-color_primaries', 'bt709',
            '-color_trc', 'bt709',
            '-g', gopSize,
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', audioBitrate,
            '-movflags', '+faststart',
            'output.mp4'
        ];
        try {
            await ffmpeg.exec(fallbackCommand);
        } catch (h264Err) {
            try {
                const testData = await ffmpeg.readFile('output.mp4');
                if (!testData || testData.byteLength < 1024) throw execError;
            } catch (rErr) {
                throw execError;
            }
        }
    }

    if (oomDetected) throw new Error('Memory limit reached during video processing.');

    if (s.statusText) s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
    if (s.progressText) s.progressText.textContent = 'Finalizing package...';
    if (s.progressFill) s.progressFill.style.width = '95%';
    if (s.progressPercent) s.progressPercent.textContent = '95%';
    if (window.ToolProgressManager) {
        window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent: 95, status: window.getTranslation('status_finalizing'), file });
    }

    s.log(`  [3/3] Reading compressed video stream...`);
    const compressedData = await ffmpeg.readFile('output.mp4');
    try {
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('output.mp4');
    } catch (cleanErr) {}

    const rawOutput = new Uint8Array(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);
    return rawOutput;
}

/**
 * Fast stream-copy remux to standardize track order (Video Track 1, Audio Track 2),
 * interleave chunks, remove junk metadata/boxes, and ensure faststart (moov at start).
 * Runs in ~50-100ms with zero re-encoding.
 *
 * @param {File} file - Original user-selected video file
 * @param {ArrayBuffer|Uint8Array} [inputBuffer] - Video bytes
 * @returns {Promise<Uint8Array>} Normalized faststart MP4 bytes
 */
async function remuxFaststart(file, inputBuffer) {
    const s = window._tktk;
    if (!s) throw new Error('TikTok tool state (_tktk) is not initialized.');

    const isReady = await s.loadFFmpegLibraries();
    if (!isReady) throw new Error('Processing engine failed to load.');

    const { toBlobURL } = window.FFmpegUtil;
    let ffmpeg = await s.loadFFmpegHelper(null, toBlobURL);

    const buffer = inputBuffer || s.currentFileBuffer;
    if (!buffer) throw new Error('Video buffer is empty.');

    await ffmpeg.writeFile('input_remux.mp4', new Uint8Array(buffer));

    const command = [
        '-y', '-i', 'input_remux.mp4',
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-c', 'copy',
        '-movflags', '+faststart',
        'output_remux.mp4'
    ];

    try {
        await ffmpeg.exec(command);
        const remuxedData = await ffmpeg.readFile('output_remux.mp4');
        try {
            await ffmpeg.deleteFile('input_remux.mp4');
            await ffmpeg.deleteFile('output_remux.mp4');
        } catch (cleanErr) {}

        return new Uint8Array(remuxedData.buffer, remuxedData.byteOffset, remuxedData.byteLength);
    } catch (err) {
        try {
            await ffmpeg.deleteFile('input_remux.mp4');
            await ffmpeg.deleteFile('output_remux.mp4');
        } catch (cleanErr) {}
        throw err;
    }
}

/**
 * Shared helper to finalize, download, and update UI after patching.
 *
 * @param {File} file - Original file
 * @param {Uint8Array} finalBytes - Patched output bytes
 * @param {string} suffix - Filename suffix ('hd', 'fps', etc.)
 */
function finalizePatcherDownload(file, finalBytes, suffix) {
    const s = window._tktk;
    const blob = new Blob([finalBytes], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const filename = `${file.name.replace(/\.[^.]+$/, '')}_${suffix || 'hd'}.mp4`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const dlBtn = document.getElementById('tool-download-btn');
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

    if (s && s.log) s.log(`  Process Completed Successfully!`);
    if (s && s.statusText) {
        s.statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
    }
    if (s && s.progressFill) s.progressFill.style.width = '100%';
    if (s && s.progressPercent) s.progressPercent.textContent = '100%';
    if (s && s.progressText) s.progressText.textContent = window.getTranslation('status_completed');

    if (window.ToolProgressManager) {
        window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: false, completed: true, percent: 100, status: window.getTranslation('status_completed'), file });
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

    if (s) s.isProcessing = false;

    if (typeof window.showToast === 'function') {
        window.showToast((window.getTranslation && window.getTranslation('status_completed_toast')) || 'Processing completed successfully!');
    }
    if (s && typeof s.showTikTokStudioUploadPrompt === 'function') {
        s.showTikTokStudioUploadPrompt();
    }
}

window.compressVideo = compressVideo;
window.remuxFaststart = remuxFaststart;
window.finalizePatcherDownload = finalizePatcherDownload;

if (window._tktk) {
    window._tktk.compressVideo = compressVideo;
    window._tktk.remuxFaststart = remuxFaststart;
    window._tktk.finalizePatcherDownload = finalizePatcherDownload;
}

})();
