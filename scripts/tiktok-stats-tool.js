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
        const url = inputUrl.value.trim();
        if (url) {
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
            const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}`);
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

            showStatus("Analysing video stream...");

            // Run stream analysis (Resolution and FPS) in parallel
            const [resolution, fps] = await Promise.all([
                extractResolution(metadata.play),
                extractFps(metadata.play)
            ]);

            statsResolution.textContent = resolution;
            statsFps.textContent = fps;

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
                // Cleanup
                video.src = '';
                video.load();
            };

            video.onerror = () => {
                resolve('—');
            };

            // Safety timeout
            setTimeout(() => {
                resolve('—');
            }, 6000);
        });
    }

    // Extract FPS using range request and custom MP4 binary box demuxing
    async function extractFps(videoUrl) {
        try {
            let arrayBuffer = null;
            
            // Attempt a range request to only fetch first 512KB (very fast)
            try {
                const res = await fetch(videoUrl, { headers: { 'Range': 'bytes=0-524287' } });
                if (res.ok || res.status === 206) {
                    arrayBuffer = await res.arrayBuffer();
                }
            } catch (rangeErr) {
                console.warn("Range request failed, falling back to full stream fetch...", rangeErr);
            }

            // Fallback: fetch without range headers (will likely hit browser cache or load standard stream)
            if (!arrayBuffer) {
                const res = await fetch(videoUrl);
                if (res.ok) {
                    arrayBuffer = await res.arrayBuffer();
                }
            }

            if (!arrayBuffer) return '—';

            // Parse FPS from binary MP4 metadata
            const fps = parseFpsFromBuffer(arrayBuffer);
            if (fps && !isNaN(fps)) {
                // Round to clean values e.g. 23.976, 24, 25, 29.97, 30, 50, 60
                const roundedFps = Math.round(fps * 1000) / 1000;
                return `${roundedFps} fps`;
            }
            return '—';

        } catch (err) {
            console.error("FPS extraction error:", err);
            return '—';
        }
    }

    // Binary box search within MP4 structure
    function findBox(arrayBuffer, targetType, startOffset = 0, endOffset = null) {
        const view = new DataView(arrayBuffer);
        let offset = startOffset;
        const maxOffset = endOffset !== null ? endOffset : arrayBuffer.byteLength;
        
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
                const result = findBox(arrayBuffer, targetType, offset + 8, offset + size);
                if (result) return result;
            }
            
            offset += size;
        }
        return null;
    }

    // Parse FPS from array buffer
    function parseFpsFromBuffer(arrayBuffer) {
        const mdhd = findBox(arrayBuffer, 'mdhd');
        const stts = findBox(arrayBuffer, 'stts');
        
        if (!mdhd || !stts) {
            return null;
        }
        
        const view = new DataView(arrayBuffer);
        
        // Parse mdhd (Media Header Box)
        const mdhdVersion = view.getUint8(mdhd.offset + 8);
        let timescale = 0;
        if (mdhdVersion === 1) {
            timescale = view.getUint32(mdhd.offset + 8 + 1 + 3 + 8 + 8);
        } else {
            timescale = view.getUint32(mdhd.offset + 8 + 1 + 3 + 4 + 4);
        }
        
        // Parse stts (Time-to-Sample Box)
        const entryCount = view.getUint32(stts.offset + 12);
        if (entryCount === 0) return null;
        
        // Extract delta of first sample block (represents frame duration)
        const sampleDelta = view.getUint32(stts.offset + 16 + 4);
        if (sampleDelta === 0) return null;
        
        return timescale / sampleDelta;
    }
});
