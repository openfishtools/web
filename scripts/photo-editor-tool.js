document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('photo-file-input');
    const dropArea = document.getElementById('photo-drop-area');
    const controls = document.getElementById('photo-editor-controls');
    const previewCanvas = document.getElementById('photo-preview-canvas');
    const btnDownload = document.getElementById('btn-download-photo');

    // Sliders
    const slideSharpen = document.getElementById('slide-sharpen');
    const slideUnsharpAmount = document.getElementById('slide-unsharp-amount');
    const slideUnsharpRadius = document.getElementById('slide-unsharp-radius');
    const slideBrightness = document.getElementById('slide-brightness');
    const slideContrast = document.getElementById('slide-contrast');
    const slideShadows = document.getElementById('slide-shadows');
    const slideHue = document.getElementById('slide-hue');
    const slideSaturation = document.getElementById('slide-saturation');

    // Slider value labels
    const valSharpen = document.getElementById('val-sharpen');
    const valUnsharpAmount = document.getElementById('val-unsharp-amount');
    const valUnsharpRadius = document.getElementById('val-unsharp-radius');
    const valBrightness = document.getElementById('val-brightness');
    const valContrast = document.getElementById('val-contrast');
    const valShadows = document.getElementById('val-shadows');
    const valHue = document.getElementById('val-hue');
    const valSaturation = document.getElementById('val-saturation');

    let originalImage = null;
    let previewWidth = 0;
    let previewHeight = 0;
    let originalFilename = 'edited_image';

    // Throttling flag for real-time rendering
    let renderPending = false;

    // File input changes
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadImage(e.target.files[0]);
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
            loadImage(e.dataTransfer.files[0]);
        }
    });

    function loadImage(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image.');
            return;
        }

        originalFilename = file.name.substring(0, file.name.lastIndexOf('.')) || 'edited_image';

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;

                // Determine downscaled size for real-time preview to avoid lag
                const maxDim = 800;
                let w = img.width;
                let h = img.height;
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

                // Reset sliders to default
                slideSharpen.value = 0;
                slideUnsharpAmount.value = 0;
                slideUnsharpRadius.value = 1.0;
                slideBrightness.value = 0;
                slideContrast.value = 0;
                slideShadows.value = 0;
                slideHue.value = 0;
                slideSaturation.value = 0;

                updateSliderLabels();

                // Show controls, hide drop area or keep both
                controls.classList.remove('hidden');
                
                requestRender();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function updateSliderLabels() {
        valSharpen.textContent = `${slideSharpen.value}%`;
        valUnsharpAmount.textContent = `${slideUnsharpAmount.value}%`;
        valUnsharpRadius.textContent = `${parseFloat(slideUnsharpRadius.value).toFixed(1)}px`;
        valBrightness.textContent = (slideBrightness.value > 0 ? '+' : '') + slideBrightness.value;
        valContrast.textContent = (slideContrast.value > 0 ? '+' : '') + slideContrast.value;
        valShadows.textContent = (slideShadows.value > 0 ? '+' : '') + slideShadows.value;
        valHue.textContent = `${slideHue.value}°`;
        valSaturation.textContent = (slideSaturation.value > 0 ? '+' : '') + slideSaturation.value + '%';
    }

    // Attach listeners to sliders for real-time update
    const sliders = [slideSharpen, slideUnsharpAmount, slideUnsharpRadius, slideBrightness, slideContrast, slideShadows, slideHue, slideSaturation];
    sliders.forEach(slider => {
        slider.addEventListener('input', () => {
            updateSliderLabels();
            requestRender();
        });
    });

    function requestRender() {
        if (renderPending) return;
        renderPending = true;
        requestAnimationFrame(() => {
            renderPending = false;
            applyFilters(previewCanvas, previewWidth, previewHeight);
        });
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
        if (!originalImage) return;

        const ctx = targetCanvas.getContext('2d');
        // Render base image
        ctx.drawImage(originalImage, 0, 0, width, height);

        // Retrieve pixel data
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Get filter settings
        const sharpenAmt = parseInt(slideSharpen.value) / 100;
        const unsharpAmount = parseInt(slideUnsharpAmount.value);
        const unsharpRadius = parseFloat(slideUnsharpRadius.value);
        const brightness = parseInt(slideBrightness.value);
        const contrast = parseInt(slideContrast.value);
        const shadowsVal = parseInt(slideShadows.value);
        const hueShift = parseInt(slideHue.value);
        const saturationShift = parseInt(slideSaturation.value);

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

    // Download High-Resolution Edited Image
    btnDownload.addEventListener('click', () => {
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
                a.download = `${originalFilename}_edited.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                btnDownload.disabled = false;
                btnDownload.textContent = 'Download Edited Photo';
            }, 'image/png');
        }, 100);
    });
});
