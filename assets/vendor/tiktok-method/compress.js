(function () {
'use strict';

async function loadSharedCompressConfig() {
    const defaults = {
        maxShortSide: 1080,
        videoCodec: 'libx264',
        preset: 'slow',
        crf: '23',
        maxrate: '8M',
        bufsize: '16M',
        pixFmt: 'yuv420p',
        profile: 'high',
        x264Params: 'aq-mode=2',
        audioCodec: 'aac',
        audioBitrate: '128k'
    };
    const urls = ['../../assets/vendor/tiktok-method/methods.json', '/assets/vendor/tiktok-method/methods.json'];
    for (const url of urls) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                if (json && json.compress && typeof json.compress === 'object') {
                    return Object.assign({}, defaults, json.compress);
                }
            }
        } catch (_) {}
    }
    return defaults;
}

async function compressVideo(file, mode, inputBuffer) {
    if (!mode || mode === 'off') {
        throw new Error('Compression mode must be 720p or 1080p.');
    }
    const s = window._tktk;
    if (!s) throw new Error('TikTok tool state (_tktk) is not initialized.');

    const cfg = await loadSharedCompressConfig();

    const isReady = await s.loadFFmpegLibraries();
    if (!isReady) throw new Error('Processing engine failed to load.');

    const toBlobURL = (window.FFmpegUtil && window.FFmpegUtil.toBlobURL) || s.toBlobURL || null;
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

    const is720p = (mode === '720p');
    const isHighFps = (!vInfoFps || vInfoFps >= 45);

    let crfValueMT = '18.5';
    let maxRateMT = '17M';
    let bufSizeMT = '28M';

    let crfValueST = '18.5';
    let maxRateST = '20M';
    let bufSizeST = '34M';

    if (is720p) {
        if (isHighFps) {
            crfValueMT = '19';
            maxRateMT = '11M';
            bufSizeMT = '18M';

            crfValueST = '19';
            maxRateST = '13M';
            bufSizeST = '22M';
        } else {
            crfValueMT = '20';
            maxRateMT = '8M';
            bufSizeMT = '14M';

            crfValueST = '20';
            maxRateST = '10M';
            bufSizeST = '16M';
        }
    } else {
        if (!isHighFps) {
            crfValueMT = '19';
            maxRateMT = '14M';
            bufSizeMT = '24M';

            crfValueST = '19';
            maxRateST = '16M';
            bufSizeST = '26M';
        }
    }

    const audioBitrate = '192k';
    const x265Params = 'pools=2:frame-threads=1:wpp=1:no-sao=1:rc-lookahead=15:qpmax=32:qcomp=0.75:deblock=-1,-1';

    const activeCrf = String(cfg.crf || '23');
    const activeMaxrate = String(cfg.maxrate || maxRateST || '8M');
    const activeBufsize = String(cfg.bufsize || bufSizeST || '16M');
    const activePreset = String(cfg.preset || 'slow');
    const activeVCodec = String(cfg.videoCodec || 'libx264');
    const activePixFmt = String(cfg.pixFmt || 'yuv420p');
    const activeProfile = String(cfg.profile || 'high');
    const activeX264Params = String(cfg.x264Params || 'aq-mode=2');
    const activeACodec = String(cfg.audioCodec || 'aac');
    const activeABitrate = String(cfg.audioBitrate || audioBitrate || '128k');

    const runCompressionPass = async (useMT) => {
        let ffmpeg = null;
        let oomDetected = false;
        let lastLogTime = 0;

        ffmpeg = await s.loadFFmpegHelper(null, toBlobURL, !useMT);

        ffmpeg.on('progress', ({ progress }) => {
            const percent = 10 + Math.max(0, Math.min(62, Math.round(progress * 62)));
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

        s.log(`  [1/3] Loading video data for compression (${useMT ? 'Multi-Thread (HEVC)' : 'Single-Thread (H.264)'})...`);
        s.log(`  [Config] Target: ${mode.toUpperCase()} | FPS: ${vInfoFps ? vInfoFps + ' FPS' : '60 FPS (Motion-Safety)'} | Preset: ${activePreset} | CRF: ${activeCrf} | Maxrate: ${activeMaxrate}`);
        await ffmpeg.writeFile('input.mp4', new Uint8Array(buffer));

        let command = [];
        if (useMT) {
            s.log(`  [2/3] Optimizing video quality (${mode.toUpperCase()}) — libx265 HEVC (crf=${activeCrf}, maxrate=${activeMaxrate}, bufsize=${activeBufsize})...`);
            command = [
                '-y', '-i', 'input.mp4',
                '-threads', '2',
                '-map', '0:v:0',
                '-map', '0:a:0?',
                '-dn',
                '-map_metadata', '-1',
                '-map_chapters', '-1',
                '-vf', procOpts.vfString,
                '-c:v', 'libx265',
                '-tag:v', 'hvc1',
                '-preset', 'ultrafast',
                '-crf', activeCrf,
                '-maxrate', activeMaxrate,
                '-bufsize', activeBufsize,
                '-pix_fmt', activePixFmt,
                '-x265-params', x265Params,
                '-c:a', activeACodec,
                '-b:a', activeABitrate,
                '-movflags', '+faststart',
                'output.mp4'
            ];
        } else {
            s.log(`  [2/3] Optimizing video quality (${mode.toUpperCase()}) — ${activeVCodec} (${activePreset}, crf=${activeCrf}, maxrate=${activeMaxrate}, bufsize=${activeBufsize})...`);
            command = [
                '-y', '-i', 'input.mp4',
                '-threads', '0',
                '-map', '0:v:0',
                '-map', '0:a:0?',
                '-dn',
                '-map_metadata', '-1',
                '-map_chapters', '-1',
                '-vf', procOpts.vfString,
                '-c:v', activeVCodec,
                '-preset', activePreset,
                '-crf', activeCrf,
                '-maxrate', activeMaxrate,
                '-bufsize', activeBufsize,
                '-pix_fmt', activePixFmt,
                '-profile:v', activeProfile,
                ...(activeX264Params && activeVCodec === 'libx264' ? ['-x264-params', activeX264Params] : []),
                '-c:a', activeACodec,
                '-b:a', activeABitrate,
                '-movflags', '+faststart',
                'output.mp4'
            ];
        }

        try {
            await ffmpeg.exec(command);
        } catch (execError) {
            if (oomDetected) {
                try { await ffmpeg.terminate(); } catch (_) {}
                throw new Error('Memory limit exceeded during video processing (OOM).');
            }
            s.log(`  [Notice] Encoding retry with libx264 Ultrafast (crf=${crfValueST}, maxrate=${maxRateST})...`);
            const fallbackCommand = [
                '-y', '-i', 'input.mp4',
                '-threads', useMT ? '2' : '0',
                '-map', '0:v:0',
                '-map', '0:a:0?',
                '-dn',
                '-map_metadata', '-1',
                '-map_chapters', '-1',
                '-vf', procOpts.vfString,
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', crfValueST,
                '-maxrate', maxRateST,
                '-bufsize', bufSizeST,
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
        if (s.progressText) s.progressText.textContent = 'Menyiapkan stream hasil kompresi...';
        if (s.progressFill) s.progressFill.style.width = '74%';
        if (s.progressPercent) s.progressPercent.textContent = '74%';
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent: 74, status: window.getTranslation('status_finalizing'), file });
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

window.compressVideo = compressVideo;

if (window._tktk) {
    window._tktk.compressVideo = compressVideo;
}

})();
