document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('photo-file-input');
    const dropArea = document.getElementById('photo-drop-area');
    const controls = document.getElementById('photo-editor-controls');
    const previewCanvas = document.getElementById('photo-preview-canvas');
    const btnDownload = document.getElementById('btn-download-photo');

    // Preset Buttons
    const btnPresetCf1 = document.getElementById('btn-preset-cf1');
    const btnPresetCf2 = document.getElementById('btn-preset-cf2');

    // Preset configurations
    const PRESETS = {
        'cf1': {
            sharpen: 36,
            unsharpAmount: 143,
            unsharpRadius: 6.9,
            brightness: 0,
            contrast: -1,
            shadows: 29,
            hue: 0,
            saturation: 12
        },
        'cf2': {
            sharpen: 48,
            unsharpAmount: 164,
            unsharpRadius: 4.3,
            brightness: 0,
            contrast: 0,
            shadows: 17,
            hue: 0,
            saturation: 7
        }
    };

    let selectedPreset = 'cf1';
    let fileType = 'image'; // 'image' or 'video'
    let originalImage = null;
    let originalVideo = null;
    let previewWidth = 0;
    let previewHeight = 0;
    let originalFilename = 'edited_media';
    let videoAnimFrameId = null;
    let isRecording = false;

    // File input changes
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMediaUpload(e.target.files[0]);
        }
    });

    // Drag & drop logic
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--md-sys-color-primary)';
        dropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleMediaUpload(e.dataTransfer.files[0]);
        }
    });

    function stopVideoPlayback() {
        if (videoAnimFrameId) {
            cancelAnimationFrame(videoAnimFrameId);
            videoAnimFrameId = null;
        }
        if (originalVideo) {
            originalVideo.pause();
            originalVideo.src = "";
            originalVideo.load();
            originalVideo = null;
        }
    }

    function handleMediaUpload(file) {
        stopVideoPlayback();
        originalImage = null;

        originalFilename = file.name.substring(0, file.name.lastIndexOf('.')) || 'edited_media';

        if (file.type.startsWith('image/')) {
            fileType = 'image';
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    originalImage = img;
                    setupDimensions(img.width, img.height);
                    selectPreset(selectedPreset);
                    controls.classList.remove('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            fileType = 'video';
            const videoUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = videoUrl;
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;

            video.onloadedmetadata = () => {
                originalVideo = video;
                setupDimensions(video.videoWidth, video.videoHeight);
                selectPreset(selectedPreset);
                controls.classList.remove('hidden');
                video.play();
                startVideoRenderLoop();
            };
        } else {
            alert('Please upload a valid image or video file.');
        }
    }

    function setupDimensions(origW, origH) {
        const maxDim = 800;
        let w = origW;
        let h = origH;
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
            } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
            }
        }
        previewWidth = w;
        previewHeight = h;
        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;
    }

    function selectPreset(presetKey) {
        selectedPreset = presetKey;
        
        // Update button active styles
        if (selectedPreset === 'cf1') {
            btnPresetCf1.style.background = 'var(--md-sys-color-primary)';
            btnPresetCf1.style.color = 'var(--md-sys-color-on-primary)';
            btnPresetCf1.style.border = 'none';

            btnPresetCf2.style.background = 'var(--md-sys-color-surface-container-high)';
            btnPresetCf2.style.color = 'var(--md-sys-color-on-surface)';
            btnPresetCf2.style.border = '2px solid var(--md-sys-color-outline-variant)';
        } else {
            btnPresetCf2.style.background = 'var(--md-sys-color-primary)';
            btnPresetCf2.style.color = 'var(--md-sys-color-on-primary)';
            btnPresetCf2.style.border = 'none';

            btnPresetCf1.style.background = 'var(--md-sys-color-surface-container-high)';
            btnPresetCf1.style.color = 'var(--md-sys-color-on-surface)';
            btnPresetCf1.style.border = '2px solid var(--md-sys-color-outline-variant)';
        }
        
        if (fileType === 'image') {
            applyFilters(previewCanvas, previewWidth, previewHeight);
        }
    }

    btnPresetCf1.addEventListener('click', () => selectPreset('cf1'));
    btnPresetCf2.addEventListener('click', () => selectPreset('cf2'));

    function startVideoRenderLoop() {
        if (videoAnimFrameId) cancelAnimationFrame(videoAnimFrameId);

        function renderFrame() {
            if (originalVideo && !originalVideo.paused && !originalVideo.ended) {
                applyFilters(previewCanvas, previewWidth, previewHeight);
            }
            videoAnimFrameId = requestAnimationFrame(renderFrame);
        }
        renderFrame();
    }

    // Color conversion algorithms
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s * 100, l * 100];
    }

    function hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [r * 255, g * 255, b * 255];
    }

    // Convolution helper for custom matrix operations (Sharpen & Blur)
    function convolve(srcData, width, height, kernel) {
        const side = Math.round(Math.sqrt(kernel.length));
        const halfSide = Math.floor(side / 2);
        const src = srcData.data;
        const output = new Uint8ClampedArray(src.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dstOff = (y * width + x) * 4;
                let r = 0, g = 0, b = 0;

                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = Math.min(height - 1, Math.max(0, y + cy - halfSide));
                        const scx = Math.min(width - 1, Math.max(0, x + cx - halfSide));
                        const srcOff = (scy * width + scx) * 4;
                        const wt = kernel[cy * side + cx];

                        r += src[srcOff] * wt;
                        g += src[srcOff + 1] * wt;
                        b += src[srcOff + 2] * wt;
                    }
                }

                output[dstOff] = r;
                output[dstOff + 1] = g;
                output[dstOff + 2] = b;
                output[dstOff + 3] = src[dstOff + 3]; // Preserve original Alpha
            }
        }
        return output;
    }

    function applyFilters(targetCanvas, width, height) {
        const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
        
        // Render base frame (Image or Video)
        if (fileType === 'image' && originalImage) {
            ctx.drawImage(originalImage, 0, 0, width, height);
        } else if (fileType === 'video' && originalVideo) {
            ctx.drawImage(originalVideo, 0, 0, width, height);
        } else {
            return;
        }

        // Retrieve pixel data
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Fetch settings from the currently selected preset config
        const preset = PRESETS[selectedPreset];
        const sharpenAmt = preset.sharpen / 100;
        const unsharpAmount = preset.unsharpAmount;
        const unsharpRadius = preset.unsharpRadius;
        const brightness = preset.brightness;
        const contrast = preset.contrast;
        const shadowsVal = preset.shadows;
        const hueShift = preset.hue;
        const saturationShift = preset.saturation;

        // 1. Color Adjustments: Brightness, Contrast, Shadows, Hue, Saturation
        const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const hasColorAdjust = brightness !== 0 || contrast !== 0 || shadowsVal !== 0 || hueShift !== 0 || saturationShift !== 0;

        if (hasColorAdjust) {
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];

                // Brightness & Contrast
                if (brightness !== 0 || contrast !== 0) {
                    r = ((r - 128) * contrastFactor) + 128 + brightness;
                    g = ((g - 128) * contrastFactor) + 128 + brightness;
                    b = ((b - 128) * contrastFactor) + 128 + brightness;
                }

                // Shadows (lift or darken darker areas of the image)
                if (shadowsVal !== 0) {
                    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    if (l < 0.5) {
                        const factor = Math.max(0, 1.0 - (l * 2));
                        const shift = shadowsVal * factor * 0.5;
                        r += shift;
                        g += shift;
                        b += shift;
                    }
                }

                // Hue & Saturation
                if (hueShift !== 0 || saturationShift !== 0) {
                    let [h, s, l] = rgbToHsl(r, g, b);
                    h = (h + hueShift + 360) % 360;
                    s = Math.min(100, Math.max(0, s + saturationShift));
                    [r, g, b] = hslToRgb(h, s, l);
                }

                // Clamp values
                data[i] = Math.min(255, Math.max(0, r));
                data[i + 1] = Math.min(255, Math.max(0, g));
                data[i + 2] = Math.min(255, Math.max(0, b));
            }
        }

        // 2. Sharpen Filter
        if (sharpenAmt > 0) {
            const k = -sharpenAmt;
            const center = 1 + (4 * sharpenAmt);
            const kernel = [
                0, k, 0,
                k, center, k,
                0, k, 0
            ];
            const sharpenedPixels = convolve(imgData, width, height, kernel);
            for (let i = 0; i < data.length; i++) {
                data[i] = sharpenedPixels[i];
            }
        }

        // 3. Unsharp Mask Filter
        if (unsharpAmount > 0 && unsharpRadius > 0) {
            // Apply current state to a temp canvas to generate blurred reference
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imgData, 0, 0);

            // Generate blurred copy using hardware-accelerated canvas filter
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = width;
            blurCanvas.height = height;
            const blurCtx = blurCanvas.getContext('2d');
            blurCtx.filter = `blur(${unsharpRadius}px)`;
            blurCtx.drawImage(tempCanvas, 0, 0);

            // Get blurred pixel buffer
            const blurredData = blurCtx.getImageData(0, 0, width, height).data;

            const amtFactor = unsharpAmount / 100;
            const threshold = 2; // Prevent sharpening flat areas

            for (let i = 0; i < data.length; i += 4) {
                for (let c = 0; c < 3; c++) {
                    const idx = i + c;
                    const diff = data[idx] - blurredData[idx];

                    if (Math.abs(diff) > threshold) {
                        const val = data[idx] + amtFactor * diff;
                        data[idx] = Math.min(255, Math.max(0, val));
                    }
                }
            }
        }

        // Draw processed pixels back to canvas
        ctx.putImageData(imgData, 0, 0);
    }

    // Download / Export handler
    btnDownload.addEventListener('click', () => {
        if (fileType === 'image') {
            if (!originalImage) return;

            btnDownload.disabled = true;
            btnDownload.textContent = 'Processing high-res output...';

            setTimeout(() => {
                const outCanvas = document.createElement('canvas');
                const w = originalImage.width;
                const h = originalImage.height;
                outCanvas.width = w;
                outCanvas.height = h;

                applyFilters(outCanvas, w, h);

                outCanvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${originalFilename}_${selectedPreset.toUpperCase()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    btnDownload.disabled = false;
                    btnDownload.textContent = 'Download Edited File';
                }, 'image/png');
            }, 100);
        } else if (fileType === 'video') {
            if (!originalVideo || isRecording) return;
            isRecording = true;

            btnDownload.disabled = true;
            btnDownload.textContent = 'Processing video export (please wait)...';

            // Pause the main loop rendering & main video
            if (videoAnimFrameId) cancelAnimationFrame(videoAnimFrameId);
            originalVideo.pause();

            // Set up export parameters
            const exportVideo = document.createElement('video');
            exportVideo.src = originalVideo.src;
            exportVideo.muted = true;
            exportVideo.playsInline = true;

            const exportCanvas = document.createElement('canvas');
            // Export at 720p or original video size to save memory / prevent recorder crashes
            const exportW = Math.min(1280, originalVideo.videoWidth);
            const exportH = Math.round((originalVideo.videoHeight * exportW) / originalVideo.videoWidth);
            exportCanvas.width = exportW;
            exportCanvas.height = exportH;
            
            const exportCtx = exportCanvas.getContext('2d');

            exportVideo.onloadeddata = async () => {
                exportVideo.currentTime = 0;
                await new Promise(resolve => setTimeout(resolve, 150));

                const stream = exportCanvas.captureStream(30); // Capture at 30 FPS
                
                let supportedType = 'video/webm;codecs=vp9';
                if (!MediaRecorder.isTypeSupported(supportedType)) {
                    supportedType = 'video/webm;codecs=vp8';
                    if (!MediaRecorder.isTypeSupported(supportedType)) {
                        supportedType = 'video/webm';
                    }
                }

                const chunks = [];
                const recorder = new MediaRecorder(stream, { mimeType: supportedType });

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${originalFilename}_${selectedPreset.toUpperCase()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    // Restore state
                    isRecording = false;
                    btnDownload.disabled = false;
                    btnDownload.textContent = 'Download Edited File';

                    originalVideo.play();
                    startVideoRenderLoop();
                };

                recorder.start();
                exportVideo.play();

                function recordFrame() {
                    if (!isRecording) return;
                    if (!exportVideo.paused && !exportVideo.ended) {
                        // Temp swap originalVideo to exportVideo to apply filters on it
                        const oldVideo = originalVideo;
                        originalVideo = exportVideo;
                        applyFilters(exportCanvas, exportW, exportH);
                        originalVideo = oldVideo;

                        // Progress status
                        const progress = Math.round((exportVideo.currentTime / exportVideo.duration) * 100) || 0;
                        btnDownload.textContent = `Processing video: ${progress}%`;
                        
                        requestAnimationFrame(recordFrame);
                    } else {
                        recorder.stop();
                        exportVideo.src = "";
                        exportVideo.load();
                    }
                }
                recordFrame();
            };
        }
    });
});
