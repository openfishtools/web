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

    function isTikTokUrl(raw) {
        if (!raw || typeof raw !== 'string') return false;
        let u = raw.trim();
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
            u = 'https://' + u;
        }
        try {
            const parsed = new URL(u);
            const host = parsed.hostname.toLowerCase();
            const validHosts = ['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'tikwm.com'];
            return validHosts.some(h => host === h || host.endsWith('.' + h));
        } catch {
            return false;
        }
    }

    btnDownload.addEventListener('click', async () => {
        let rawInput = inputUrl.value.trim();
        if (!rawInput) {
            showStatus("Please enter a valid TikTok video URL.", "var(--md-sys-color-error)");
            return;
        }

        if (!isTikTokUrl(rawInput)) {
            showStatus("URL is not a valid TikTok link.", "var(--md-sys-color-error)");
            return;
        }

        let url = rawInput;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
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

    async function resolveAndDownload(pageUrl) {
        btnDownload.disabled = true;
        btnDownload.textContent = "Loading...";
        showStatus("");
        progressContainer.classList.add('hidden');
        setProgress(0);

        try {
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Unable to resolve TikTok video URL (${response.status}).`);
            }

            currentMeta = await response.json();
            if (!currentMeta || (!currentMeta.play && !currentMeta.hdplay)) {
                throw new Error("Could not extract video stream.");
            }

            btnDownload.disabled = false;
            btnDownload.textContent = "Download HD";
            
            if (currentMeta.is_fallback || currentMeta.warning) {
                showStatus(
                    currentMeta.warning || "Using cached version - API may be temporarily unavailable",
                    "var(--md-sys-color-tertiary)"
                );
            }
            
            downloadVideo();

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
        btnDownload.textContent = "Downloading...";
        showStatus("");
        progressContainer.classList.remove('hidden');
        setProgress(0, "Preparing...");

        try {
            const videoUrl = (currentMeta.hdplay && currentMeta.hdplay.startsWith('http')) ? currentMeta.hdplay : (currentMeta.play || currentMeta.hdplay);

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
            btnDownload.disabled = false;
            btnDownload.textContent = "Download HD";
        }
    }
});
