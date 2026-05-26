document.addEventListener('DOMContentLoaded', () => {
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';
    
    const inputUrl = document.getElementById('tool-tiktok-stats-input');
    const btnAnalyse = document.getElementById('btn-analyse-tiktok');
    const statusText = document.getElementById('tool-tiktok-stats-status');
    const resultsContainer = document.getElementById('tiktok-stats-results');
    
    // Preview fields
    const statsCover = document.getElementById('stats-video-cover');
    const statsCreatorName = document.getElementById('stats-creator-name');
    const statsCreatorHandle = document.getElementById('stats-creator-handle');
    const statsCaption = document.getElementById('stats-caption');
    
    // Details fields
    const statsResolution = document.getElementById('stats-resolution');
    const statsFps = document.getElementById('stats-fps');
    const statsBitrate = document.getElementById('stats-bitrate');
    const statsDuration = document.getElementById('stats-duration');
    const statsSize = document.getElementById('stats-size');
    
    let isRunning = false;

    // Trigger analysis on button click
    btnAnalyse.addEventListener('click', () => {
        let url = inputUrl.value.trim();
        if (url) {
            // Helper to clean and prepend protocol if it's a partial URL
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

    // Trigger analysis on Enter key press in the input field
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
        
        // Reset UI state
        btnAnalyse.disabled = true;
        resultsContainer.classList.add('hidden');
        showStatus("Fetching video details...");

        try {
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
            if (!response.ok) {
                throw new Error("Unable to resolve TikTok video URL. Please check the URL.");
            }
            
            const metadata = await response.json();
            if (!metadata || !metadata.play) {
                throw new Error("Could not extract stream URL for this video.");
            }

            // Fill basic stats immediately
            statsCover.src = metadata.cover || '';
            statsCreatorName.textContent = metadata.author_nickname || 'Creator';
            statsCreatorHandle.textContent = metadata.author_unique_id ? `@${metadata.author_unique_id}` : '@username';
            statsCaption.textContent = metadata.title || 'No caption';
            
            const duration = metadata.duration || 0;
            const size = metadata.size || 0;
            
            statsDuration.textContent = duration ? `${duration}s` : '—';
            statsSize.textContent = size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : '—';

            // Set FPS (resolved by backend proxy)
            if (metadata.fps && !isNaN(metadata.fps)) {
                statsFps.textContent = `${metadata.fps} fps`;
            } else {
                statsFps.textContent = '—';
            }

            // Calculate average Bitrate
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

            showStatus("Analysing resolution...");

            let resolution = '—';
            if (metadata.play) {
                try {
                    resolution = await extractResolution(metadata.play);
                } catch (e) {
                    resolution = '—';
                }
            }
            statsResolution.textContent = resolution;

            // Success: show the results container
            showStatus("");
            resultsContainer.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            showStatus(err.message || "An error occurred during analysis.", "var(--md-sys-color-error)");
        } finally {
            isRunning = false;
            btnAnalyse.disabled = false;
        }
    }

    // Load resolution using HTML5 video metadata loading
    function extractResolution(videoUrl) {
        return new Promise((resolve) => {
            if (!videoUrl || !videoUrl.startsWith('http')) {
                resolve('—');
                return;
            }

            const video = document.createElement('video');
            video.preload = 'metadata';
            video.crossOrigin = 'anonymous';
            video.src = videoUrl;

            video.onloadedmetadata = () => {
                const width = video.videoWidth;
                const height = video.videoHeight;
                if (width && height) {
                    resolve(`${width} x ${height}`);
                } else {
                    resolve('—');
                }
                video.src = '';
            };

            video.onerror = () => {
                resolve('—');
            };

            setTimeout(() => {
                if (video.src === videoUrl) {
                    video.src = '';
                }
                resolve('—');
            }, 6000);
        });
    }
});
