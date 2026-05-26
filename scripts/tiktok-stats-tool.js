document.addEventListener('DOMContentLoaded', () => {
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';

    const inputUrl = document.getElementById('tool-tiktok-stats-input');
    const btnAnalyse = document.getElementById('btn-analyse-tiktok');
    const statusText = document.getElementById('tool-tiktok-stats-status');
    const resultsContainer = document.getElementById('tiktok-stats-results');

    const statsCover = document.getElementById('stats-video-cover');
    const statsCreatorName = document.getElementById('stats-creator-name');
    const statsCreatorHandle = document.getElementById('stats-creator-handle');
    const statsCaption = document.getElementById('stats-caption');
    const statsResolution = document.getElementById('stats-resolution');
    const statsFps = document.getElementById('stats-fps');
    const statsBitrate = document.getElementById('stats-bitrate');
    const statsDuration = document.getElementById('stats-duration');
    const statsSize = document.getElementById('stats-size');

    let isRunning = false;
    // Reuse a single ffmpeg instance across analyses to avoid reloading WASM each time
    let ffmpegInstance = null;
    let ffmpegLoaded = false;

    btnAnalyse.addEventListener('click', () => {
        let url = inputUrl.value.trim();
        if (url) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                if (url.includes('tiktok.com')) {
                    url = 'https://' + url;
                } else if (url.startsWith('efishaep/') || url.includes('/video/')) {
                    url = 'https://www.tiktok.com/@' + url;
                } else {
                    url = 'https://www.tiktok.com/' + url;
                }
            }
            analyseTikTokVideo(url);
        } else {
            showStatus("Please enter a valid TikTok video URL.", "var(--md-sys-color-error)");
        }
    });

    inputUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAnalyse.click();
        }
    });

    function showStatus(message, color = "var(--md-sys-color-primary)") {
        statusText.textContent = message;
        statusText.style.color = color;
    }

    async function analyseTikTokVideo(pageUrl) {
        if (isRunning) return;
        isRunning = true;

        btnAnalyse.disabled = true;
        resultsContainer.classList.add('hidden');
        showStatus("Fetching video details...");

        try {
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
            if (!response.ok) {
                throw new Error("Unable to resolve TikTok video URL.");
            }

            const metadata = await response.json();
            if (!metadata || !metadata.play) {
                throw new Error("Could not extract stream URL for this video.");
            }

            statsCover.src = metadata.cover || '';
            statsCreatorName.textContent = metadata.author_nickname || 'Creator';
            statsCreatorHandle.textContent = metadata.author_unique_id ? `@${metadata.author_unique_id}` : '@username';
            statsCaption.textContent = metadata.title || 'No caption';

            const duration = metadata.duration || 0;
            const size = metadata.size || 0;

            statsDuration.textContent = duration ? `${duration}s` : '—';
            statsSize.textContent = size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : '—';

            // Show API resolution first as placeholder, will be overwritten by ffmpeg result
            if (metadata.w && metadata.h) {
                statsResolution.textContent = `${metadata.w} x ${metadata.h}`;
            } else {
                statsResolution.textContent = '—';
            }

            if (size && duration) {
                const bitrateKbps = (size * 8) / (duration * 1000);
                if (bitrateKbps >= 1000) {
                    statsBitrate.textContent = `${(bitrateKbps / 1000).toFixed(2)} Mbps`;
                } else {
                    statsBitrate.textContent = `${Math.round(bitrateKbps)} kbps`;
                }
            } else {
                statsBitrate.textContent = '—';
            }

            // Show results early so user sees partial data while ffmpeg runs
            resultsContainer.classList.remove('hidden');
            statsFps.textContent = '—';

            showStatus("Analysing stream with FFmpeg...");

            // Run ffmpeg WASM probe — extracts both FPS and resolution from the stream
            const probeResult = await probeWithFFmpeg(metadata.play);

            if (probeResult) {
                if (probeResult.fps) {
                    statsFps.textContent = `${probeResult.fps} fps`;
                }
                if (probeResult.width && probeResult.height) {
                    statsResolution.textContent = `${probeResult.width} x ${probeResult.height}`;
                }
            }

            showStatus("");

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Analysis failed.", "var(--md-sys-color-error)");
        } finally {
            isRunning = false;
            btnAnalyse.disabled = false;
        }
    }

    /**
     * Probes the video stream using ffmpeg WASM.
     * Returns { fps, width, height } parsed from the ffmpeg log output.
     *
     * Reuses the same ffmpeg instance across calls to avoid reloading the 32MB WASM core.
     */
    async function probeWithFFmpeg(playUrl) {
        if (!playUrl || !playUrl.startsWith('http')) return null;

        try {
            // --- Step 1: Fetch raw video chunk via backend proxy ---
            showStatus("Downloading video chunk...");
            const chunkRes = await fetch(`${API_URL}/tiktok-chunk?url=${encodeURIComponent(playUrl)}`);
            if (!chunkRes.ok) {
                console.warn('tiktok-chunk fetch failed:', chunkRes.status);
                return null;
            }
            const chunkBuffer = await chunkRes.arrayBuffer();
            if (!chunkBuffer || chunkBuffer.byteLength < 4096) {
                console.warn('tiktok-chunk: received too little data:', chunkBuffer?.byteLength);
                return null;
            }
            console.log(`Chunk received: ${(chunkBuffer.byteLength / 1024).toFixed(0)} KB`);

            // --- Step 2: Load ffmpeg WASM (reuse instance if already loaded) ---
            const { FFmpeg } = window.FFmpegWASM;
            const { toBlobURL } = window.FFmpegUtil;

            if (!ffmpegInstance || !ffmpegLoaded) {
                showStatus("Loading FFmpeg WASM...");
                ffmpegInstance = new FFmpeg();
                const baseURL = window.location.origin + '/assets/ffmpeg';
                try {
                    await ffmpegInstance.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
                    });
                    ffmpegLoaded = true;
                } catch (loadErr) {
                    console.error('FFmpeg WASM load failed:', loadErr);
                    ffmpegInstance = null;
                    ffmpegLoaded = false;
                    return null;
                }
            }

            // --- Step 3: Write chunk and probe ---
            showStatus("Probing stream with FFmpeg...");
            const logLines = [];

            // Register listener BEFORE exec
            const logHandler = ({ message }) => {
                logLines.push(message);
                console.log('[ffmpeg]', message);
            };
            ffmpegInstance.on('log', logHandler);

            await ffmpegInstance.writeFile('probe.mp4', new Uint8Array(chunkBuffer));

            try {
                // -f null -  means no output file — ffmpeg still reads & logs input stream info
                await ffmpegInstance.exec(['-hide_banner', '-i', 'probe.mp4', '-f', 'null', '-']);
            } catch (_) {
                // Non-zero exit is expected when probing without encoding output
            }

            // Cleanup
            ffmpegInstance.off('log', logHandler);
            try { await ffmpegInstance.deleteFile('probe.mp4'); } catch (_) {}

            // --- Step 4: Parse fps + resolution from logs ---
            return parseStreamInfoFromLogs(logLines);

        } catch (e) {
            console.error('probeWithFFmpeg error:', e);
            // Reset the instance so next call tries fresh
            ffmpegInstance = null;
            ffmpegLoaded = false;
            return null;
        }
    }

    /**
     * Parses FPS and resolution from ffmpeg log lines.
     *
     * ffmpeg log format (Stream line):
     *   Stream #0:0(und): Video: h264 (High), yuv420p(tv, bt709), 1080x1920, 8374 kb/s, 30 fps, 30 tbr, 90k tbn (default)
     *
     * We extract:
     *   - Resolution: "1080x1920" → { width: 1080, height: 1920 }
     *   - FPS:        "30 fps"    → 30
     *   - Fallback:   "30 tbr"    → 30 (if fps not found)
     */
    function parseStreamInfoFromLogs(lines) {
        let fps = null;
        let width = null;
        let height = null;

        for (const line of lines) {
            // Only look at Video stream lines
            if (!line.includes('Video:')) continue;

            // Resolution: e.g. "1080x1920" or "720x1280"
            const resMatch = line.match(/(\d{3,5})x(\d{3,5})/);
            if (resMatch) {
                const w = parseInt(resMatch[1], 10);
                const h = parseInt(resMatch[2], 10);
                // Sanity check: must be plausible video dimensions
                if (w >= 100 && w <= 7680 && h >= 100 && h <= 7680) {
                    width = w;
                    height = h;
                }
            }

            // FPS: "30 fps" or "29.97 fps"
            const fpsMatch = line.match(/(\d+(?:\.\d+)?)\s+fps/i);
            if (fpsMatch) {
                const f = parseFloat(fpsMatch[1]);
                if (!isNaN(f) && f > 0 && f <= 240) fps = Math.round(f * 100) / 100;
            }

            // Fallback: tbr (used when fps token absent)
            if (!fps) {
                const tbrMatch = line.match(/(\d+(?:\.\d+)?)\s+tbr/i);
                if (tbrMatch) {
                    const f = parseFloat(tbrMatch[1]);
                    if (!isNaN(f) && f > 0 && f <= 240) fps = Math.round(f * 100) / 100;
                }
            }

            // Found what we need, stop scanning
            if (fps !== null && width !== null) break;
        }

        if (fps === null && width === null) return null;
        return { fps, width, height };
    }
});