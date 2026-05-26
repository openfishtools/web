document.addEventListener('DOMContentLoaded', () => {
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';

    const inputUrl = document.getElementById('tool-tiktok-dl-input');
    const btnDownload = document.getElementById('btn-download-tiktok');
    const statusText = document.getElementById('tool-tiktok-dl-status');
    const resultsContainer = document.getElementById('tiktok-dl-results');

    const dlCover = document.getElementById('dl-video-cover');
    const dlCreatorName = document.getElementById('dl-creator-name');
    const dlCreatorHandle = document.getElementById('dl-creator-handle');
    const dlCaption = document.getElementById('dl-caption');
    const dlResolution = document.getElementById('dl-resolution');
    const dlDuration = document.getElementById('dl-duration');
    const dlSize = document.getElementById('dl-size');

    let currentMeta = null;

    btnDownload.addEventListener('click', async () => {
        let url = inputUrl.value.trim();
        if (!url) {
            showStatus("Please enter a valid TikTok video URL.", "var(--md-sys-color-error)");
            return;
        }

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.includes('tiktok.com')) {
                url = 'https://' + url;
            } else {
                url = 'https://www.tiktok.com/' + url;
            }
        }

        if (currentMeta) {
            downloadVideo();
        } else {
            resolveAndDownload(url);
        }
    });

    inputUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnDownload.click();
        }
    });

    function showStatus(message, color = "var(--md-sys-color-primary)") {
        statusText.textContent = message;
        statusText.style.color = color;
    }

    async function resolveAndDownload(pageUrl) {
        btnDownload.disabled = true;
        btnDownload.textContent = "Resolving...";
        showStatus("Fetching video details...");

        try {
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
            if (!response.ok) {
                throw new Error("Unable to resolve TikTok video URL.");
            }

            currentMeta = await response.json();
            if (!currentMeta || !currentMeta.play && !currentMeta.hdplay) {
                throw new Error("Could not extract video stream.");
            }

            dlCover.src = currentMeta.cover || '';
            dlCreatorName.textContent = currentMeta.author_nickname || 'Creator';
            dlCreatorHandle.textContent = currentMeta.author_unique_id ? `@${currentMeta.author_unique_id}` : '@username';
            dlCaption.textContent = currentMeta.title || 'No caption';

            const duration = currentMeta.duration || 0;
            const size = currentMeta.size || 0;
            const w = currentMeta.w || 0;
            const h = currentMeta.h || 0;

            dlDuration.textContent = duration ? `${duration}s` : '—';
            dlSize.textContent = size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : '—';
            dlResolution.textContent = (w && h) ? `${w} x ${h}` : '—';

            resultsContainer.classList.remove('hidden');
            btnDownload.disabled = false;
            btnDownload.textContent = "Download HD";
            showStatus("");

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Resolution failed.", "var(--md-sys-color-error)");
            btnDownload.disabled = false;
            btnDownload.textContent = "Download HD";
        }
    }

    async function downloadVideo() {
        if (!currentMeta) return;

        btnDownload.disabled = true;
        btnDownload.textContent = "Preparing...";
        showStatus("Preparing download...");

        try {
            const isHD = currentMeta.hdplay && currentMeta.hdplay.includes('tiktokcdn');
            const videoUrl = isHD ? currentMeta.hdplay : currentMeta.play;

            if (!videoUrl) {
                throw new Error("No video URL available.");
            }

            showStatus("Starting download...");

            const response = await fetch(videoUrl, {
                signal: AbortSignal.timeout(120000)
            });

            if (!response.ok) {
                throw new Error("Download failed: " + response.status);
            }

            showStatus("Downloading...");

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `tiktok_${currentMeta.author_unique_id || 'video'}_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            showStatus("Download complete!", "var(--md-sys-color-primary)");

            setTimeout(() => {
                showStatus("");
            }, 3000);

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Download failed.", "var(--md-sys-color-error)");
        } finally {
            btnDownload.disabled = false;
            btnDownload.textContent = "Download HD";
        }
    }
});
