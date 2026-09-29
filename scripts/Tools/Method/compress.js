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
    const buffer = inputBuffer || s.currentFileBuffer;
    if (!buffer) throw new Error('Video buffer is empty.');

    const fileMB = file.size / (1024 * 1024);
    const preParseBuffer = buffer ? buffer.slice(0) : null;
    let vInfoFps = null, vInfoW = 0, vInfoH = 0;
    if (preParseBuffer) {
        try {
            vInfoFps = s.parseFpsFromMp4(preParseBuffer);
            const r = s.parseResolutionFromMp4(preParseBuffer);
            if (r) { vInfoW = r.width; vInfoH = r.height; }
        } catch (e) {}
    }
    const procOpts = s.computeVideoProcessingOptions(vInfoW, vInfoH, vInfoFps, fileMB, mode);

    // H.264 Fast Compression Settings (Unified for 1080P & 720P):
    // veryfast, CRF 20, maxrate 12.5M, bufsize 18M
    // Natural color pass-through (no forced color parameters)
    const x264Preset = 'veryfast';
    const crfValue = '20';
    const maxRate = '12.5M';
    const bufSize = '18M';
    const audioBitrate = '128k';
    const gopSize = Math.max(48, Math.min(240, (vInfoFps || 30) * 2)).toString();

    const runCompressionPass = async (useMT) => {
        let ffmpeg = null;
        let oomDetected = false;
        let lastLogTime = 0;

        ffmpeg = await s.loadFFmpegHelper(null, toBlobURL, !useMT);

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
            if (lc.includes('oom') || lc.includes('out of memory') || lc.includes('cannot allocate memory') || lc.includes('abort(')) {
                oomDetected = true;
            }
            if (message.includes('frame=') && (message.includes('fps=') || message.includes('size='))) {
                const now = Date.now();
                if (now - lastLogTime > 2500) {
                    lastLogTime = now;
                    const cleanMsg = message.trim().replace(/\s+/g, ' ');
                    s.log(`    ${cleanMsg}`);
                }
            }
        });

        s.log(`  [1/3] Loading video data for compression (${useMT ? 'Multi-Thread' : 'Single-Thread'})...`);
        await ffmpeg.writeFile('input.mp4', new Uint8Array(buffer));

        const hardwareThreads = navigator.hardwareConcurrency || 4;
        const safeThreads = (fileMB > 50) ? '2' : Math.min(4, hardwareThreads).toString();
        const threads = useMT ? safeThreads : '1';

        s.log(`  [2/3] Optimizing video quality (${mode.toUpperCase()}) — Threads: ${threads}...`);
        s.log(`  FFmpeg filters: ${procOpts.vfString}`);

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
            '-x264-params', '8x8dct=1:cabac=1:bframes=3:b-adapt=1:scenecut=40:qcomp=0.7:deblock=0,0',
            '-g', gopSize,
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', audioBitrate,
            '-movflags', '+faststart',
            'output.mp4'
        ];
        s.log(`  Encoder: libx264 (H.264 ${x264Preset}) crf=${crfValue} maxrate=${maxRate}`);

        try {
            await ffmpeg.exec(command);
        } catch (execError) {
            if (oomDetected) {
                try { await ffmpeg.terminate(); } catch (_) {}
                throw new Error('Memory limit exceeded during video processing (OOM).');
            }
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
                    try { await ffmpeg.terminate(); } catch (_) {}
                    throw execError;
                }
            }
        }

        if (oomDetected) {
            try { await ffmpeg.terminate(); } catch (_) {}
            throw new Error('Memory limit exceeded during video processing (OOM).');
        }

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
            await ffmpeg.terminate();
        } catch (cleanErr) {}

        return new Uint8Array(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);
    };

    const isMobile = (typeof s.isMobileDevice === 'function') ? s.isMobileDevice() : /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const canAttemptMT = !isMobile
        && typeof SharedArrayBuffer !== 'undefined'
        && typeof Atomics !== 'undefined'
        && window.crossOriginIsolated === true;

    let rawOutput = null;
    if (canAttemptMT) {
        try {
            rawOutput = await runCompressionPass(true);
        } catch (mtErr) {
            s.log(`\n⚠️ [AUTO-FALLBACK] Multi-Thread gagal / Out of Memory (${mtErr.message || mtErr}).`);
            s.log(`🔄 Mengulang otomatis menggunakan Single-Thread (Safe Mode)...\n`);
            if (s.statusText) s.statusText.innerHTML = `<span style="color: #ff9800;">OOM / Error. Fallback ke Single-Thread...</span>`;
            if (s.progressFill) s.progressFill.style.width = '10%';
            if (s.progressPercent) s.progressPercent.textContent = '10%';
            rawOutput = await runCompressionPass(false);
        }
    } else {
        s.log(`  [Notice] Multi-thread tidak tersedia atau tidak didukung di lingkungan ini. Menggunakan Single-Thread.`);
        rawOutput = await runCompressionPass(false);
    }

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

window.compressVideo = compressVideo;
window.remuxFaststart = remuxFaststart;

if (window._tktk) {
    window._tktk.compressVideo = compressVideo;
    window._tktk.remuxFaststart = remuxFaststart;
}

})();
