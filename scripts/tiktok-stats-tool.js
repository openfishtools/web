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

            showStatus("Analysing FPS with FFmpeg...");

            const fps = await analyseFpsWithFFmpeg(metadata.play);
            if (fps && !isNaN(fps)) {
                statsFps.textContent = `${fps} fps`;
            } else {
                statsFps.textContent = '—';
            }

            showStatus("");
            resultsContainer.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Analysis failed.", "var(--md-sys-color-error)");
        } finally {
            isRunning = false;
            btnAnalyse.disabled = false;
        }
    }

    /**
     * Uses ffmpeg WASM (already loaded globally as window.FFmpegWASM / window.FFmpegUtil)
     * to probe the first 2MB chunk of the TikTok video and extract the FPS.
     *
     * Flow:
     *   1. Fetch 2MB chunk via /api/tiktok-chunk proxy (bypasses CORS)
     *   2. Write chunk to ffmpeg WASM virtual filesystem as "probe.mp4"
     *   3. Run: ffmpeg -i probe.mp4 (no output → exits with error but logs stream info)
     *   4. Parse the log for patterns like "30 fps", "30.00 fps", "29.97 tbr"
     */
    async function analyseFpsWithFFmpeg(playUrl) {
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
            if (!chunkBuffer || chunkBuffer.byteLength < 1024) {
                console.warn('tiktok-chunk: received too little data');
                return null;
            }

            // --- Step 2: Load ffmpeg WASM ---
            showStatus("Loading FFmpeg WASM...");
            const { FFmpeg } = window.FFmpegWASM;
            const { toBlobURL } = window.FFmpegUtil;
            const ffmpeg = new FFmpeg();

            // Collect all log lines for parsing
            const logLines = [];
            ffmpeg.on('log', ({ message }) => {
                logLines.push(message);
            });

            const baseURL = window.location.origin + '/assets/ffmpeg';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
            });

            // --- Step 3: Write chunk to WASM FS and probe ---
            showStatus("Probing stream with FFmpeg...");
            await ffmpeg.writeFile('probe.mp4', new Uint8Array(chunkBuffer));

            // Run ffmpeg -i probe.mp4 — it will fail (no output specified) but
            // it logs stream info including fps before exiting.
            try {
                await ffmpeg.exec(['-i', 'probe.mp4', '-hide_banner', '-f', 'null', '-']);
            } catch (_) {
                // Expected: ffmpeg exits non-zero when no valid output given.
                // The log is still populated with stream info.
            }

            // Cleanup WASM FS
            try { await ffmpeg.deleteFile('probe.mp4'); } catch (_) {}

            // --- Step 4: Parse fps from log ---
            return parseFpsFromLogs(logLines);

        } catch (e) {
            console.error('analyseFpsWithFFmpeg error:', e);
            return null;
        }
    }

    /**
     * Parses fps/tbr value from ffmpeg log lines.
     * Looks for patterns like:
     *   "Video: h264, ..., 1080x1920, 8374 kb/s, 30 fps, 30 tbr, ..."
     *   "Stream #0:0: Video: ..., 29.97 fps"
     */
    function parseFpsFromLogs(lines) {
        for (const line of lines) {
            // Primary: match explicit " fps" token in stream info line
            const fpsMatch = line.match(/(\d+(?:\.\d+)?)\s+fps/i);
            if (fpsMatch) {
                const fps = parseFloat(fpsMatch[1]);
                if (!isNaN(fps) && fps > 0 && fps <= 240) {
                    return Math.round(fps * 100) / 100;
                }
            }
            // Fallback: tbr (time base rate) — often equals fps
            const tbrMatch = line.match(/(\d+(?:\.\d+)?)\s+tbr/i);
            if (tbrMatch) {
                const fps = parseFloat(tbrMatch[1]);
                if (!isNaN(fps) && fps > 0 && fps <= 240) {
                    return Math.round(fps * 100) / 100;
                }
            }
        }
        return null;
    }
});