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

            showStatus("Analysing FPS...");

            const fps = await analyseFpsFromUrl(metadata.play);
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

    function findBox(buffer, targetType, startOffset = 0, endOffset = null) {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        let offset = startOffset;
        const maxOffset = endOffset !== null ? endOffset : buffer.byteLength;

        while (offset < maxOffset - 8) {
            const size = view.getUint32(offset);
            if (size <= 0 || offset + size > maxOffset) break;

            const type = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7)
            );

            if (type === targetType) {
                return { offset, size };
            }

            if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
                const result = findBox(buffer, targetType, offset + 8, offset + size);
                if (result) return result;
            }

            offset += size;
        }
        return null;
    }

    function parseFpsFromBuffer(buffer) {
        try {
            const mdhd = findBox(buffer, 'mdhd');
            const stts = findBox(buffer, 'stts');

            if (!mdhd || !stts) return null;

            const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

            const mdhdVersion = view.getUint8(mdhd.offset + 8);
            let timescale = 0;
            if (mdhdVersion === 1) {
                timescale = view.getUint32(mdhd.offset + 8 + 1 + 3 + 8 + 8);
            } else {
                timescale = view.getUint32(mdhd.offset + 8 + 1 + 3 + 4 + 4);
            }

            const entryCount = view.getUint32(stts.offset + 12);
            if (entryCount === 0) return null;

            const sampleDelta = view.getUint32(stts.offset + 16);
            if (sampleDelta === 0) return null;

            const fps = timescale / sampleDelta;
            return isNaN(fps) ? null : Math.round(fps * 1000) / 1000;
        } catch (e) {
            return null;
        }
    }

    async function analyseFpsFromUrl(videoUrl) {
        if (!videoUrl || !videoUrl.startsWith('http')) return null;

        try {
            const response = await fetch(videoUrl, {
                headers: { 'Range': 'bytes=0-524287', 'User-Agent': 'Mozilla/5.0' }
            });

            if (!response.ok && response.status !== 206) return null;

            const buffer = await response.arrayBuffer();
            return parseFpsFromBuffer(buffer);
        } catch (e) {
            console.error("FPS analysis failed:", e);
            return null;
        }
    }
});