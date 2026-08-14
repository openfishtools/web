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
    const statsMethod = document.getElementById('stats-method');

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
        
        let mirrorStep = 1;
        showStatus("Fetching video details (trying mirror 1: TikWM)...");
        const statusTimer = setInterval(() => {
            mirrorStep++;
            if (mirrorStep === 2) {
                showStatus("Trying mirror 2 (Direct extract)...");
            } else if (mirrorStep >= 3) {
                showStatus("Trying mirror 3 (SSSTik)...");
            }
        }, 5100);

        try {
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
            clearInterval(statusTimer);

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

            const rawCover = metadata.cover || '';
            const coverUrl = rawCover ? (rawCover.startsWith('http') ? `${API_URL}/proxy?url=${encodeURIComponent(rawCover)}&type=image` : rawCover) : '';
            if (statsCover) {
                statsCover.src = coverUrl;
                statsCover.setAttribute('referrerpolicy', 'no-referrer');
                statsCover.onerror = () => {
                    if (rawCover && statsCover.src !== rawCover) {
                        statsCover.src = rawCover;
                    }
                };
            }
            statsCreatorName.textContent = metadata.author_nickname || 'Creator';
            statsCreatorHandle.textContent = metadata.author_unique_id ? `@${metadata.author_unique_id}` : '@username';
            statsCaption.textContent = metadata.title || 'No caption';

            showStatus("Analysing Video Metadata (Size, Duration, FPS & Bitrate)...");

            const videoMeta = await analyseVideoMetadataFromUrl(metadata.play);

            let finalDuration = (videoMeta && videoMeta.duration) || metadata.duration || 0;
            let finalSize = (videoMeta && videoMeta.size) || metadata.size || 0;
            let finalWidth = (videoMeta && videoMeta.width) || metadata.w || 0;
            let finalHeight = (videoMeta && videoMeta.height) || metadata.h || 0;

            if (!finalDuration || !finalSize || !finalWidth) {
                try {
                    const tempVideo = document.createElement('video');
                    tempVideo.src = metadata.play;
                    tempVideo.muted = true;
                    await new Promise((resolve) => {
                        const timeout = setTimeout(resolve, 3000);
                        tempVideo.onloadedmetadata = () => {
                            clearTimeout(timeout);
                            if (tempVideo.duration && !isNaN(tempVideo.duration)) finalDuration = tempVideo.duration;
                            if (tempVideo.videoWidth) finalWidth = tempVideo.videoWidth;
                            if (tempVideo.videoHeight) finalHeight = tempVideo.videoHeight;
                            resolve();
                        };
                        tempVideo.onerror = resolve;
                    });

                    tempVideo.src = '';
                    tempVideo.removeAttribute('src');
                    tempVideo.load();

                    if (!finalSize) {
                        const headRes = await fetch(`${API_URL}/proxy?url=${encodeURIComponent(metadata.play)}`, { method: 'HEAD' }).catch(() => null);
                        if (headRes && headRes.ok) {
                            const len = headRes.headers.get('content-length');
                            if (len) finalSize = parseInt(len, 10);
                        }
                    }
                } catch (_) {}
            }

            console.log('%c[TikTok Stats] Metadata Resolved:', 'color: #00ffcc; font-weight: bold;', metadata);
            console.log('%c[TikTok Stats] Video Meta API Result:', 'color: #ff9900; font-weight: bold;', videoMeta);
            console.log('%c[TikTok Stats] Final Calculated Stats:', 'color: #69dc9e; font-weight: bold;', {
                duration: finalDuration ? `${parseFloat(finalDuration).toFixed(2)}s` : '—',
                size: finalSize ? `${(finalSize / (1024 * 1024)).toFixed(2)} MB` : '—',
                resolution: (finalWidth && finalHeight) ? `${finalWidth} x ${finalHeight}` : '1080 x 1920',
                fps: (videoMeta && videoMeta.fps) ? `${videoMeta.fps} fps` : '60 fps',
                bitrate: (finalSize && finalDuration) ? `${((finalSize * 8) / (finalDuration * 1000000)).toFixed(2)} Mbps` : '—'
            });

            statsDuration.textContent = finalDuration ? `${parseFloat(finalDuration).toFixed(2)}s` : '—';
            statsSize.textContent = finalSize ? `${(finalSize / (1024 * 1024)).toFixed(2)} MB` : '—';

            if (videoMeta && videoMeta.fps && !isNaN(videoMeta.fps)) {
                statsFps.textContent = `${videoMeta.fps} fps`;
            } else {
                statsFps.textContent = '60 fps';
            }

            if (finalWidth && finalHeight) {
                statsResolution.textContent = `${finalWidth} x ${finalHeight}`;
            } else {
                statsResolution.textContent = '1080 x 1920';
            }

            if (finalSize && finalDuration) {
                const bitrateMbps = (finalSize * 8) / (finalDuration * 1000 * 1000);
                statsBitrate.textContent = `${parseFloat(bitrateMbps.toFixed(2))} Mbps`;
            } else if (videoMeta && videoMeta.bitrate) {
                statsBitrate.textContent = `${videoMeta.bitrate} Mbps`;
            } else {
                statsBitrate.textContent = '—';
            }

            showStatus("");
            resultsContainer.classList.remove('hidden');

            displayMethod(videoMeta && videoMeta.comment ? videoMeta.comment.trim() : (metadata.method || 'Unknown'));

        } catch (err) {
            console.error(err);
            showStatus(err.message || "Analysis failed.", "var(--md-sys-color-error)");
        } finally {
            clearInterval(statusTimer);
            isRunning = false;
            btnAnalyse.disabled = false;
        }
    }

    function displayMethod(comment) {
        if (!comment) {
            statsMethod.textContent = 'Unknown';
            return;
        }
        let cleanText = comment.trim();
        if (/^Lavf/i.test(cleanText)) {
            statsMethod.textContent = `FFmpeg (${cleanText})`;
            return;
        }
        const isDomain = /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,10}$/.test(cleanText);
        if (isDomain) {
            statsMethod.innerHTML = '';
            const a = document.createElement('a');
            a.href = 'https://' + cleanText;
            a.target = '_blank';
            a.rel = 'noopener';
            a.className = 'stats-method-link';
            a.textContent = cleanText;
            statsMethod.appendChild(a);
        } else {
            statsMethod.textContent = cleanText;
        }
    }

    async function analyseVideoMetadataFromUrl(videoUrl) {
        if (!videoUrl || !videoUrl.startsWith('http')) return null;
        try {
            const response = await fetch(`${API_URL}/tiktok-fps?url=${encodeURIComponent(videoUrl)}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            return null;
        }
    }
});
