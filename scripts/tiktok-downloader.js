document.addEventListener('DOMContentLoaded', () => {
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';

    const inputUrl = document.getElementById('tool-tiktok-dl-input');
    const btnDownload = document.getElementById('btn-download-tiktok');
    const statusText = document.getElementById('tool-tiktok-dl-status');
    const progressContainer = document.getElementById('tiktok-dl-progress-container');
    const progressFill = document.getElementById('tiktok-dl-progress-fill');
    const progressText = document.getElementById('tiktok-dl-progress-text');
    const progressPercent = document.getElementById('tiktok-dl-progress-percent');

    let currentMeta = null;
    let statusTimer = null;

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

    function setProgress(percent, text) {
        progressFill.style.width = percent + '%';
        progressPercent.textContent = percent + '%';
        if (text) progressText.textContent = text;
    }

    function startCooldown(seconds = 3) {
        btnDownload.disabled = true;
        let left = seconds;
        btnDownload.textContent = `Wait (${left}s)...`;
        const timer = setInterval(() => {
            left--;
            if (left <= 0) {
                clearInterval(timer);
                btnDownload.disabled = false;
                btnDownload.textContent = "Download HD";
            } else {
                btnDownload.textContent = `Wait (${left}s)...`;
            }
        }, 1000);
    }

    async function resolveAndDownload(pageUrl) {
        btnDownload.disabled = true;
        btnDownload.textContent = "Loading...";

        let mirrorStep = 1;
        showStatus("Fetching video details (trying mirror 1: TikWM)...");
        if (statusTimer) clearInterval(statusTimer);
        statusTimer = setInterval(() => {
            mirrorStep++;
            if (mirrorStep === 2) {
                showStatus("Trying mirror 2 (Direct extract)...");
            } else if (mirrorStep >= 3) {
                showStatus("Trying mirror 3 (SSSTik)...");
            }
        }, 5100);

        progressContainer.classList.add('hidden');
        setProgress(0);

        try {
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
            if (statusTimer) clearInterval(statusTimer);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.details
                    ? `Unable to resolve video: ${errorData.details}`
                    : (errorData.error || `Unable to resolve TikTok video URL (${response.status}).`);
                throw new Error(errorMsg);
            }

            const metadata = await response.json();
            if (!metadata || !metadata.play) {
                throw new Error("Could not extract stream URL for this video.");
            }

            currentMeta = metadata;
            await downloadVideo();

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Download failed.", "var(--md-sys-color-error)", "var(--md-sys-color-error)");
            progressContainer.classList.add('hidden');
            startCooldown(3);
        } finally {
            if (statusTimer) clearInterval(statusTimer);
        }
    }

    async function downloadVideo() {
        if (!currentMeta) return;

        btnDownload.disabled = true;
        btnDownload.textContent = "Downloading...";
        showStatus("");
        progressContainer.classList.remove('hidden');
        setProgress(0, "Preparing...");

        try {
            const isHD = currentMeta.hdplay && currentMeta.hdplay.includes('tiktokcdn');
            const videoUrl = isHD ? currentMeta.hdplay : currentMeta.play;

            if (!videoUrl) {
                throw new Error("No video URL available.");
            }

            const proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(videoUrl)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                throw new Error("Download failed: " + response.status);
            }

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                if (total > 0) {
                    const percent = Math.round((loaded / total) * 100);
                    setProgress(percent);
                }
            }

            setProgress(100, "Finalizing...");
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `tiktok_${currentMeta.author_unique_id || 'video'}_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setProgress(100, "Done!");
            showStatus("Download complete!", "var(--md-sys-color-primary)");
            currentMeta = null;
            inputUrl.value = '';

            setTimeout(() => {
                progressContainer.classList.add('hidden');
                showStatus("");
            }, 3000);

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Download failed.", "var(--md-sys-color-error)");
            progressContainer.classList.add('hidden');
        } finally {
            startCooldown(3);
        }
    }
});
