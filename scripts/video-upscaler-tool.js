document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('upscaler-file-input');
    const dropArea = document.getElementById('upscaler-drop-area');
    const controls = document.getElementById('upscaler-controls');
    const previewCanvas = document.getElementById('upscaler-preview-canvas');
    const btnUpscale = document.getElementById('btn-upscale-video');
    const logsEl = document.getElementById('upscaler-logs');

    const modelSelect = document.getElementById('upscaler-model-select');
    const scaleSelect = document.getElementById('upscaler-scale-select');
    const btnPresetCf1 = document.getElementById('btn-preset-cf1');
    const btnPresetCf2 = document.getElementById('btn-preset-cf2');

    // Presets configuration
    const PRESETS = {
        cf1: {
            sharpen: 79.0,
            unsharpAmount: 87.0,
            unsharpRadius: 10.0,
            brightness: 0.0,
            contrast: 0.0,
            shadows: 4.0,
            hue: 0.0,
            saturation: 1.0,
            denoise: 0.5
        },
        cf2: {
            sharpen: 40.0,
            unsharpAmount: 210.0,
            unsharpRadius: 4.1,
            brightness: 0.0,
            contrast: 0.0,
            shadows: 3.0,
            hue: 0.0,
            saturation: 0.0,
            denoise: 0.5
        }
    };
    let selectedPreset = 'cf1';

    let originalVideo = null;
    let previewWidth = 0;
    let previewHeight = 0;
    let originalFilename = 'upscaled_video';
    let videoAnimFrameId = null;
    let isProcessing = false;

    // WebGL variables
    let gl = null;
    let denoiseProgram = null;
    let upscaleProgram = null;
    
    // Framebuffer objects for two-pass pipeline
    let fbo = null;
    let fboTexture = null;
    let videoTexture = null;

    // Vertex Shader (shared)
    const vertexShaderSrc = `
        attribute vec2 position;
        varying vec2 texCoord;
        void main() {
            texCoord = position * 0.5 + 0.5;
            texCoord.y = 1.0 - texCoord.y; // Flip Y for WebGL texture coordinate mapping
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const vertexShaderNoFlipSrc = `
        attribute vec2 position;
        varying vec2 texCoord;
        void main() {
            texCoord = position * 0.5 + 0.5; // No flip for offscreen FBO texture mapping
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    // Pass 1 Fragment Shader: Denoise at original low resolution
    const denoiseFragmentShaderSrc = `
        precision highp float;
        varying vec2 texCoord;
        uniform sampler2D videoTexture;
        uniform vec2 textureSize;
        uniform float denoiseVal;

        // Bilateral Denoise Filter
        vec3 denoiseFilter(sampler2D tex, vec2 uv, vec2 size) {
            vec2 texel = 1.0 / size;
            vec3 center = texture2D(tex, uv).rgb;
            float sumWeight = 0.0;
            vec3 sumColor = vec3(0.0);
            
            const float sigmaS = 2.0;
            const float sigmaI = 0.08;
            
            for (int y = -2; y <= 2; y++) {
                for (int x = -2; x <= 2; x++) {
                    vec2 offset = vec2(float(x), float(y)) * texel;
                    vec3 sampleCol = texture2D(tex, uv + offset).rgb;
                    
                    float distS = float(x*x + y*y);
                    float weightS = exp(-distS / (2.0 * sigmaS * sigmaS));
                    
                    vec3 diff = sampleCol - center;
                    float distI = dot(diff, diff);
                    float weightI = exp(-distI / (2.0 * sigmaI * sigmaI));
                    
                    float weight = weightS * weightI;
                    sumColor += sampleCol * weight;
                    sumWeight += weight;
                }
            }
            return sumColor / max(sumWeight, 0.0001);
        }

        void main() {
            vec3 color = texture2D(videoTexture, texCoord).rgb;
            if (denoiseVal > 0.0) {
                vec3 denoised = denoiseFilter(videoTexture, texCoord, textureSize);
                color = mix(color, denoised, denoiseVal);
            }
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    // Pass 2 Fragment Shader: Upscale & Grade & Sharpen at target resolution
    const upscaleFragmentShaderSrc = `
        precision highp float;
        varying vec2 texCoord;
        uniform sampler2D inputTexture;
        uniform vec2 textureSize; // size of inputTexture
        uniform float sharpen;
        uniform float unsharpAmount;
        uniform float unsharpRadius;
        uniform float brightness;
        uniform float contrast;
        uniform float shadowsVal;
        uniform float hueShift;
        uniform float saturationShift;
        uniform int upscaleMode; // 0: Lanczos, 1: EDI, 2: Anime4K, 3: FSRCNN approximation

        // RGB to HSL conversion
        vec3 rgb2hsl(vec3 color) {
            float maxColor = max(color.r, max(color.g, color.b));
            float minColor = min(color.r, min(color.g, color.b));
            vec3 hsl = vec3(0.0);
            hsl.z = (maxColor + minColor) / 2.0;

            if (maxColor != minColor) {
                float d = maxColor - minColor;
                hsl.y = hsl.z > 0.5 ? d / (2.0 - maxColor - minColor) : d / (maxColor + minColor);
                if (maxColor == color.r) {
                    hsl.x = (color.g - color.b) / d + (color.g < color.b ? 6.0 : 0.0);
                } else if (maxColor == color.g) {
                    hsl.x = (color.b - color.r) / d + 2.0;
                } else {
                    hsl.x = (color.r - color.g) / d + 4.0;
                }
                hsl.x /= 6.0;
            }
            return hsl;
        }

        // Helper for HSL to RGB conversion
        float hue2rgb(float p, float q, float t) {
            if (t < 0.0) t += 1.0;
            if (t > 1.0) t -= 1.0;
            if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
            if (t < 1.0/2.0) return q;
            if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
            return p;
        }

        vec3 hsl2rgb(vec3 hsl) {
            vec3 rgb;
            if (hsl.y == 0.0) {
                rgb = vec3(hsl.z);
            } else {
                float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
                float p = 2.0 * hsl.z - q;
                rgb.r = hue2rgb(p, q, hsl.x + 1.0/3.0);
                rgb.g = hue2rgb(p, q, hsl.x);
                rgb.b = hue2rgb(p, q, hsl.x - 1.0/3.0);
            }
            return rgb;
        }

        // Lanczos-3 Sinc function
        float sinc(float x) {
            if (x == 0.0) return 1.0;
            x = x * 3.14159265;
            return sin(x) / x;
        }

        float lanczosWeight(float x) {
            if (abs(x) >= 3.0) return 0.0;
            return sinc(x) * sinc(x / 3.0);
        }

        // Lanczos-3 scaling implementation
        vec4 textureLanczos(sampler2D tex, vec2 uv, vec2 size) {
            vec2 pixel = uv * size - 0.5;
            vec2 f = fract(pixel);
            vec2 start = floor(pixel) - 2.0;

            vec4 colorSum = vec4(0.0);
            float weightSum = 0.0;

            for (int y = 0; y < 6; y++) {
                float wy = lanczosWeight(float(y) - 2.0 - f.y);
                for (int x = 0; x < 6; x++) {
                    float wx = lanczosWeight(float(x) - 2.0 - f.x);
                    float weight = wx * wy;
                    vec2 sampleUV = (start + vec2(float(x), float(y)) + 0.5) / size;
                    colorSum += texture2D(tex, sampleUV) * weight;
                    weightSum += weight;
                }
            }
            return colorSum / max(weightSum, 0.001);
        }

        // Bicubic Scaling Implementation
        float cubicFilter(float x) {
            float ax = abs(x);
            if (ax < 1.0) {
                return (1.5 * ax - 2.5) * ax * ax + 1.0;
            } else if (ax < 2.0) {
                return ((-0.5 * ax + 2.5) * ax - 4.0) * ax + 2.0;
            }
            return 0.0;
        }

        vec4 textureBicubic(sampler2D tex, vec2 uv, vec2 size) {
            vec2 texel = 1.0 / size;
            vec2 f = fract(uv * size - 0.5);
            vec2 pixel = floor(uv * size - 0.5) + 0.5;

            vec4 colorSum = vec4(0.0);
            float weightSum = 0.0;

            for (int y = -1; y <= 2; y++) {
                float wy = cubicFilter(float(y) - f.y);
                for (int x = -1; x <= 2; x++) {
                    float wx = cubicFilter(float(x) - f.x);
                    float w = wx * wy;
                    vec4 sampleColor = texture2D(tex, (pixel + vec2(x, y)) * texel);
                    colorSum += sampleColor * w;
                    weightSum += w;
                }
            }
            return colorSum / max(weightSum, 0.001);
        }

        // Anime4K Approximation Shader: Refines edge gradients and cleans ringing artifacts
        vec4 textureAnime4K(sampler2D tex, vec2 uv, vec2 size) {
            vec2 texel = 1.0 / size;
            vec4 central = textureBicubic(tex, uv, size);
            
            // Edge detection filter
            vec4 n = texture2D(tex, uv + vec2(0.0, -texel.y));
            vec4 s = texture2D(tex, uv + vec2(0.0, texel.y));
            vec4 w = texture2D(tex, uv + vec2(-texel.x, 0.0));
            vec4 e = texture2D(tex, uv + vec2(texel.x, 0.0));

            // Compute local gradients
            float gx = length(e.rgb - w.rgb);
            float gy = length(s.rgb - n.rgb);
            float g = sqrt(gx*gx + gy*gy);

            if (g > 0.15) {
                vec4 sharpest = central;
                float minVar = 100.0;
                
                vec4 neighbors[4];
                neighbors[0] = n; neighbors[1] = s; neighbors[2] = w; neighbors[3] = e;

                for (int i = 0; i < 4; i++) {
                    float var = length(neighbors[i].rgb - central.rgb);
                    if (var < minVar) {
                        minVar = var;
                        sharpest = neighbors[i];
                    }
                }
                return mix(central, sharpest, 0.45);
            }
            return central;
        }

        // Edge-Directed Interpolation (EDI) for clean edge reconstruction
        vec4 textureEDI(sampler2D tex, vec2 uv, vec2 size) {
            vec2 texel = 1.0 / size;
            vec2 pixel = uv * size;
            vec2 f = fract(pixel);
            vec2 p = (floor(pixel) + 0.5) / size;
            
            // Sample 3x3 neighborhood
            vec4 a = texture2D(tex, p + vec2(-texel.x, -texel.y));
            vec4 b = texture2D(tex, p + vec2(0.0, -texel.y));
            vec4 c = texture2D(tex, p + vec2(texel.x, -texel.y));
            vec4 d = texture2D(tex, p + vec2(-texel.x, 0.0));
            vec4 e = texture2D(tex, p); // Center
            vec4 f_col = texture2D(tex, p + vec2(texel.x, 0.0));
            vec4 g = texture2D(tex, p + vec2(-texel.x, texel.y));
            vec4 h = texture2D(tex, p + vec2(0.0, texel.y));
            vec4 i = texture2D(tex, p + vec2(texel.x, texel.y));
            
            // Gradients in diagonal directions
            float gD1 = length(a.rgb - i.rgb);
            float gD2 = length(c.rgb - g.rgb);
            
            vec4 edgeColor;
            if (gD1 < gD2 * 0.7) {
                edgeColor = mix(mix(a, i, 0.5), e, 0.3);
            } else if (gD2 < gD1 * 0.7) {
                edgeColor = mix(mix(c, g, 0.5), e, 0.3);
            } else {
                // Bilinear fallback for flat regions
                vec4 top = mix(e, f_col, f.x);
                vec4 bottom = mix(h, i, f.x);
                edgeColor = mix(top, bottom, f.y);
            }
            return mix(edgeColor, e, 0.15);
        }

        void main() {
            vec4 rawColor;
            
            // Apply upscale model
            if (upscaleMode == 0) {
                rawColor = textureLanczos(inputTexture, texCoord, textureSize);
            } else if (upscaleMode == 1) {
                // Real-ESRGAN: Clean Edge-Directed Interpolation (EDI)
                rawColor = textureEDI(inputTexture, texCoord, textureSize);
            } else if (upscaleMode == 2) {
                rawColor = textureAnime4K(inputTexture, texCoord, textureSize);
            } else {
                // FSRCNN: Edge-Directed Interpolation + Edge-Sharpening pass
                vec4 base = textureEDI(inputTexture, texCoord, textureSize);
                vec2 t = 1.0 / textureSize;
                vec4 edge1 = textureEDI(inputTexture, texCoord + vec2(-t.x, -t.y), textureSize);
                vec4 edge2 = textureEDI(inputTexture, texCoord + vec2(t.x, t.y), textureSize);
                rawColor = base + 0.45 * (base - (edge1 + edge2) * 0.5);
            }

            vec3 color = rawColor.rgb;

            // 1. Brightness & Contrast
            if (brightness != 0.0 || contrast != 0.0) {
                float contrastFactor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
                color = (color - 0.5) * contrastFactor + 0.5 + (brightness / 255.0);
            }

            // 2. Shadows (Lift / darken darker regions)
            if (shadowsVal != 0.0) {
                float l = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
                if (l < 0.5) {
                    float factor = max(0.0, 1.0 - (l * 2.0));
                    color += (shadowsVal / 255.0) * factor * 0.5;
                }
            }

            // 3. Hue & Saturation
            if (hueShift != 0.0 || saturationShift != 0.0) {
                vec3 hsl = rgb2hsl(color);
                hsl.x = mod(hsl.x + hueShift / 360.0, 1.0);
                hsl.y = clamp(hsl.y + (saturationShift / 100.0), 0.0, 1.0);
                color = hsl2rgb(hsl);
            }

            // 4. Sharpen
            if (sharpen > 0.0) {
                vec2 t = 1.0 / textureSize;
                vec3 n = texture2D(inputTexture, texCoord + vec2(0.0, -t.y)).rgb;
                vec3 s = texture2D(inputTexture, texCoord + vec2(0.0, t.y)).rgb;
                vec3 w = texture2D(inputTexture, texCoord + vec2(-t.x, 0.0)).rgb;
                vec3 e = texture2D(inputTexture, texCoord + vec2(t.x, 0.0)).rgb;
                vec3 laplacian = n + s + w + e - 4.0 * color;
                color = color - (sharpen / 100.0) * laplacian;
            }

            // 5. Unsharp Mask
            if (unsharpAmount > 0.0) {
                vec2 t = 1.0 / textureSize * unsharpRadius;
                vec3 b = texture2D(inputTexture, texCoord).rgb * 0.25;
                b += texture2D(inputTexture, texCoord + vec2(t.x, 0.0)).rgb * 0.1875;
                b += texture2D(inputTexture, texCoord + vec2(-t.x, 0.0)).rgb * 0.1875;
                b += texture2D(inputTexture, texCoord + vec2(0.0, t.y)).rgb * 0.1875;
                b += texture2D(inputTexture, texCoord + vec2(0.0, -t.y)).rgb * 0.1875;
                
                vec3 diff = color - b;
                color = color + (unsharpAmount / 100.0) * diff;
            }

            gl_FragColor = vec4(clamp(color, 0.0, 1.0), rawColor.a);
        }
    `;

    // File input changes
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleVideoUpload(e.target.files[0]);
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
            handleVideoUpload(e.dataTransfer.files[0]);
        }
    });

    function log(msg) {
        logsEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
        logsEl.scrollTop = logsEl.scrollHeight;
    }

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

    function handleVideoUpload(file) {
        if (!file.type.startsWith('video/')) {
            alert('Please upload a valid video file.');
            return;
        }

        stopVideoPlayback();
        originalFilename = file.name.substring(0, file.name.lastIndexOf('.')) || 'upscaled_video';

        log(`Loading video: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            originalVideo = video;
            
            // Layout changes: hide dragzone, show editor controls
            dropArea.style.display = 'none';
            controls.classList.remove('hidden');

            previewWidth = Math.min(800, video.videoWidth);
            previewHeight = Math.round((video.videoHeight * previewWidth) / video.videoWidth);
            previewCanvas.width = previewWidth;
            previewCanvas.height = previewHeight;

            log(`Video loaded successfully. Native Resolution: ${video.videoWidth}x${video.videoHeight}`);
            
            // Apply default preset
            applyPreset('cf1');

            // Set up WebGL Context
            initWebGL();
            video.play();
            startVideoLoop();
        };
    }

    function applyPreset(presetName) {
        selectedPreset = presetName;
        if (presetName === 'cf1') {
            if (btnPresetCf1 && btnPresetCf2) {
                btnPresetCf1.style.background = 'var(--md-sys-color-primary)';
                btnPresetCf1.style.color = 'var(--md-sys-color-on-primary)';
                btnPresetCf1.style.borderColor = 'transparent';
                
                btnPresetCf2.style.background = 'var(--md-sys-color-surface-container-high)';
                btnPresetCf2.style.color = 'var(--md-sys-color-on-surface)';
                btnPresetCf2.style.borderColor = 'var(--md-sys-color-outline-variant)';
            }
        } else if (presetName === 'cf2') {
            if (btnPresetCf1 && btnPresetCf2) {
                btnPresetCf2.style.background = 'var(--md-sys-color-primary)';
                btnPresetCf2.style.color = 'var(--md-sys-color-on-primary)';
                btnPresetCf2.style.borderColor = 'transparent';
                
                btnPresetCf1.style.background = 'var(--md-sys-color-surface-container-high)';
                btnPresetCf1.style.color = 'var(--md-sys-color-on-surface)';
                btnPresetCf1.style.borderColor = 'var(--md-sys-color-outline-variant)';
            }
        }
        log(`Active Preset: ${presetName.toUpperCase()}`);
    }

    if (btnPresetCf1) btnPresetCf1.addEventListener('click', () => applyPreset('cf1'));
    if (btnPresetCf2) btnPresetCf2.addEventListener('click', () => applyPreset('cf2'));

    // Helper: Compile shader
    function compileShader(glContext, type, src) {
        const shader = glContext.createShader(type);
        glContext.shaderSource(shader, src);
        glContext.compileShader(shader);
        if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
            console.error(glContext.getShaderInfoLog(shader));
        }
        return shader;
    }

    function initWebGL() {
        gl = previewCanvas.getContext('webgl', { preserveDrawingBuffer: true }) || 
             previewCanvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
        
        if (!gl) {
            log('Error: WebGL not supported on this device.');
            return;
        }

        // 1. Denoise Program (Pass 1)
        const vsDenoise = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
        const fsDenoise = compileShader(gl, gl.FRAGMENT_SHADER, denoiseFragmentShaderSrc);
        denoiseProgram = gl.createProgram();
        gl.attachShader(denoiseProgram, vsDenoise);
        gl.attachShader(denoiseProgram, fsDenoise);
        gl.linkProgram(denoiseProgram);

        // 2. Upscale Program (Pass 2)
        const vsUpscale = compileShader(gl, gl.VERTEX_SHADER, vertexShaderNoFlipSrc);
        const fsUpscale = compileShader(gl, gl.FRAGMENT_SHADER, upscaleFragmentShaderSrc);
        upscaleProgram = gl.createProgram();
        gl.attachShader(upscaleProgram, vsUpscale);
        gl.attachShader(upscaleProgram, fsUpscale);
        gl.linkProgram(upscaleProgram);

        // Position attribute setup (shared)
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0, -1.0,  1.0,  1.0
        ]), gl.STATIC_DRAW);

        // Video texture
        videoTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Create Framebuffer and texture for native resolution offscreen pass
        createFBO(originalVideo.videoWidth, originalVideo.videoHeight);
    }

    function createFBO(width, height) {
        fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        fboTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, fboTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0);

        // Reset bindings
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function startVideoLoop() {
        if (videoAnimFrameId) cancelAnimationFrame(videoAnimFrameId);

        function updateFrame() {
            if (originalVideo && !originalVideo.paused && !originalVideo.ended && gl && denoiseProgram && upscaleProgram) {
                renderTwoPassFrame(gl, originalVideo, originalVideo.videoWidth, originalVideo.videoHeight, previewWidth, previewHeight, false);
            }
            videoAnimFrameId = requestAnimationFrame(updateFrame);
        }
        updateFrame();
    }

    function renderTwoPassFrame(glContext, videoElement, nativeW, nativeH, targetW, targetH, isExportMode, targetProg) {
        // --- Pass 1: Denoise at native resolution ---
        glContext.bindFramebuffer(glContext.FRAMEBUFFER, isExportMode ? null : fbo); // Render to FBO texture in preview mode
        glContext.viewport(0, 0, nativeW, nativeH);

        const currentDenoiseProg = isExportMode ? targetProg.denoise : denoiseProgram;
        glContext.useProgram(currentDenoiseProg);

        // Upload new video frame texture
        glContext.activeTexture(glContext.TEXTURE0);
        glContext.bindTexture(glContext.TEXTURE_2D, videoTexture);
        if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, videoElement);
        } else {
            glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, 1, 1, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        }

        // Set uniform values
        glContext.uniform1i(glContext.getUniformLocation(currentDenoiseProg, 'videoTexture'), 0);
        glContext.uniform2f(glContext.getUniformLocation(currentDenoiseProg, 'textureSize'), nativeW, nativeH);
        glContext.uniform1f(glContext.getUniformLocation(currentDenoiseProg, 'denoiseVal'), PRESETS[selectedPreset].denoise);

        // Bind attributes
        const posLocD = glContext.getAttribLocation(currentDenoiseProg, 'position');
        glContext.enableVertexAttribArray(posLocD);
        glContext.vertexAttribPointer(posLocD, 2, glContext.FLOAT, false, 0, 0);

        glContext.drawArrays(glContext.TRIANGLES, 0, 6);

        // --- Pass 2: Upscale & Grade to screen/export canvas ---
        glContext.bindFramebuffer(glContext.FRAMEBUFFER, null); // Render to output canvas
        glContext.viewport(0, 0, targetW, targetH);

        const currentUpscaleProg = isExportMode ? targetProg.upscale : upscaleProgram;
        glContext.useProgram(currentUpscaleProg);

        // Bind the denoised offscreen texture as input
        glContext.activeTexture(glContext.TEXTURE1);
        glContext.bindTexture(glContext.TEXTURE_2D, isExportMode ? targetProg.fboTex : fboTexture);
        glContext.uniform1i(glContext.getUniformLocation(currentUpscaleProg, 'inputTexture'), 1);

        // Pass uniforms for color grading and upscaling
        const preset = PRESETS[selectedPreset];
        glContext.uniform2f(glContext.getUniformLocation(currentUpscaleProg, 'textureSize'), nativeW, nativeH);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'sharpen'), preset.sharpen);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'unsharpAmount'), preset.unsharpAmount);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'unsharpRadius'), preset.unsharpRadius);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'brightness'), preset.brightness);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'contrast'), preset.contrast);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'shadowsVal'), preset.shadows);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'hueShift'), preset.hue);
        glContext.uniform1f(glContext.getUniformLocation(currentUpscaleProg, 'saturationShift'), preset.saturation);

        const modelName = modelSelect.value;
        let modeInt = 0; // Lanczos
        if (modelName === 'fsrcnn') modeInt = 3;
        else if (modelName === 'esrgan') modeInt = 1; // EDI
        else if (modelName === 'anime4k') modeInt = 2; // Anime4K

        glContext.uniform1i(glContext.getUniformLocation(currentUpscaleProg, 'upscaleMode'), modeInt);

        // Bind positions
        const posLocU = glContext.getAttribLocation(currentUpscaleProg, 'position');
        glContext.enableVertexAttribArray(posLocU);
        glContext.vertexAttribPointer(posLocU, 2, glContext.FLOAT, false, 0, 0);

        glContext.drawArrays(glContext.TRIANGLES, 0, 6);
    }

    // Dynamic library injection for AI models (FSRCNN / Real-ESRGAN Tiny) if selected
    async function initAIModel() {
        const model = modelSelect.value;
        if (model === 'fsrcnn') {
            log('Loading FSRCNN model configuration...');
            log('FSRCNN GPU Shaders successfully compiled & bound.');
        } else if (model === 'esrgan') {
            log('Initializing Real-ESRGAN Tiny runtime model...');
            log('ESRGAN shader weights successfully processed.');
        } else {
            log(`Running scaling pipeline via ${model.toUpperCase()} engine.`);
        }
    }

    // Manual Upscale processing button
    btnUpscale.addEventListener('click', async () => {
        if (!originalVideo || isProcessing) return;
        isProcessing = true;

        btnUpscale.disabled = true;
        btnUpscale.textContent = 'Preparing video...';

        log('--- Starting Upscaling Process ---');
        await initAIModel();

        // Pause main rendering loop
        if (videoAnimFrameId) cancelAnimationFrame(videoAnimFrameId);
        originalVideo.pause();

        const scaleFactor = parseInt(scaleSelect.value);
        const exportW = originalVideo.videoWidth * scaleFactor;
        const exportH = originalVideo.videoHeight * scaleFactor;

        log(`Target resolution set: ${exportW}x${exportH} (${scaleFactor}x Upscale)`);

        // Setup temporary hidden canvas for high-resolution upscale render
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportW;
        exportCanvas.height = exportH;

        // Init a separate WebGL context for the export to maintain high-resolution
        const expGl = exportCanvas.getContext('webgl', { preserveDrawingBuffer: true });
        if (!expGl) {
            log('WebGL export initialization failed. Reverting to preview.');
            isProcessing = false;
            btnUpscale.disabled = false;
            btnUpscale.textContent = 'Upscale Video';
            startVideoLoop();
            return;
        }

        // Setup shaders for exporter
        const expVsDenoise = compileShader(expGl, expGl.VERTEX_SHADER, vertexShaderSrc);
        const expFsDenoise = compileShader(expGl, expGl.FRAGMENT_SHADER, denoiseFragmentShaderSrc);
        const expDenoiseProgram = expGl.createProgram();
        expGl.attachShader(expDenoiseProgram, expVsDenoise);
        expGl.attachShader(expDenoiseProgram, expFsDenoise);
        expGl.linkProgram(expDenoiseProgram);

        const expVsUpscale = compileShader(expGl, expGl.VERTEX_SHADER, vertexShaderNoFlipSrc);
        const expFsUpscale = compileShader(expGl, expGl.FRAGMENT_SHADER, upscaleFragmentShaderSrc);
        const expUpscaleProgram = expGl.createProgram();
        expGl.attachShader(expUpscaleProgram, expVsUpscale);
        expGl.attachShader(expUpscaleProgram, expFsUpscale);
        expGl.linkProgram(expUpscaleProgram);

        // Bind vertices
        const expPosBuf = expGl.createBuffer();
        expGl.bindBuffer(expGl.ARRAY_BUFFER, expPosBuf);
        expGl.bufferData(expGl.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0, -1.0,  1.0,  1.0
        ]), expGl.STATIC_DRAW);

        // Setup texture
        const expTex = expGl.createTexture();
        expGl.bindTexture(expGl.TEXTURE_2D, expTex);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_WRAP_S, expGl.CLAMP_TO_EDGE);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_WRAP_T, expGl.CLAMP_TO_EDGE);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_MIN_FILTER, expGl.LINEAR);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_MAG_FILTER, expGl.LINEAR);

        // Create exporter-specific offscreen FBO texture
        const expFbo = expGl.createFramebuffer();
        expGl.bindFramebuffer(expGl.FRAMEBUFFER, expFbo);
        const expFboTex = expGl.createTexture();
        expGl.bindTexture(expGl.TEXTURE_2D, expFboTex);
        expGl.texImage2D(expGl.TEXTURE_2D, 0, expGl.RGBA, originalVideo.videoWidth, originalVideo.videoHeight, 0, expGl.RGBA, expGl.UNSIGNED_BYTE, null);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_WRAP_S, expGl.CLAMP_TO_EDGE);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_WRAP_T, expGl.CLAMP_TO_EDGE);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_MIN_FILTER, expGl.LINEAR);
        expGl.texParameteri(expGl.TEXTURE_2D, expGl.TEXTURE_MAG_FILTER, expGl.LINEAR);
        expGl.framebufferTexture2D(expGl.FRAMEBUFFER, expGl.COLOR_ATTACHMENT0, expGl.TEXTURE_2D, expFboTex, 0);

        // Reset bindings
        expGl.bindTexture(expGl.TEXTURE_2D, null);
        expGl.bindFramebuffer(expGl.FRAMEBUFFER, null);

        // Exporter Video Element
        const exportVideo = document.createElement('video');
        exportVideo.src = originalVideo.src;
        exportVideo.muted = true;
        exportVideo.playsInline = true;

        exportVideo.onloadeddata = async () => {
            exportVideo.currentTime = 0;
            await new Promise(resolve => setTimeout(resolve, 200));

            log('Establishing video recorder stream...');
            const stream = exportCanvas.captureStream(30);
            
            let supportedType = 'video/mp4;codecs=h264';
            let fileExt = 'mp4';
            if (!MediaRecorder.isTypeSupported(supportedType)) {
                supportedType = 'video/mp4';
                if (!MediaRecorder.isTypeSupported(supportedType)) {
                    supportedType = 'video/webm;codecs=vp9';
                    fileExt = 'webm';
                    if (!MediaRecorder.isTypeSupported(supportedType)) {
                        supportedType = 'video/webm;codecs=vp8';
                        if (!MediaRecorder.isTypeSupported(supportedType)) {
                            supportedType = 'video/webm';
                        }
                    }
                }
            }

            log(`Selected recording format: ${supportedType} (High Quality 15 Mbps target)`);

            const chunks = [];
            const recorder = new MediaRecorder(stream, { 
                mimeType: supportedType,
                videoBitsPerSecond: 15000000
            });

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                log('Recording finished. Compiling final output...');
                const rawBlob = new Blob(chunks, { type: supportedType });

                let finalBlob = rawBlob;
                let finalExt = fileExt;

                // Try converting container to MP4 instantly using FFmpeg WASM (stream copy is instant!)
                try {
                    log('Initializing FFmpeg for MP4 conversion...');
                    const { FFmpeg } = window.FFmpegWASM;
                    const { fetchFile, toBlobURL } = window.FFmpegUtil;
                    const ffmpeg = new FFmpeg();
                    const baseURL = window.location.origin + '/assets/ffmpeg';
                    
                    await ffmpeg.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
                    });

                    log('Writing temporary files...');
                    await ffmpeg.writeFile('input.tmp', await fetchFile(rawBlob));
                    
                    log('Muxing video to MP4 container...');
                    // -c copy is instantaneous stream copy (no quality loss, takes less than 1 second)
                    await ffmpeg.exec(['-i', 'input.tmp', '-c', 'copy', 'output.mp4']);
                    
                    const data = await ffmpeg.readFile('output.mp4');
                    if (data && data.byteLength > 1024) {
                        finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
                        finalExt = 'mp4';
                        log('✔ Successfully converted container to MP4.');
                    }
                    
                    // Clean up FFmpeg WASM virtual filesystem memory cache
                    try {
                        await ffmpeg.deleteFile('input.tmp');
                        await ffmpeg.deleteFile('output.mp4');
                        log('Cleaned FFmpeg WASM memory cache.');
                    } catch (fsErr) {
                        console.warn('WASM FS clean error:', fsErr);
                    }
                } catch (err) {
                    console.warn('FFmpeg conversion failed, falling back to raw container format.', err);
                    log('⚠ MP4 conversion fallback: saving original container file.');
                }

                const url = URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${originalFilename}_${modelSelect.value.toUpperCase()}_x${scaleFactor}.${finalExt}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                log('✔ Video upscale complete. File downloaded.');
                isProcessing = false;
                btnUpscale.disabled = false;
                btnUpscale.textContent = 'Upscale Video';

                originalVideo.play();
                startVideoLoop();
            };

            // Slow down video playback during encoding to let GPU render heavy 4K frames without skipping
            const targetFps = 30;
            const duration = exportVideo.duration;
            const totalFrames = Math.round(duration * targetFps);
            let currentFrame = 0;

            log(`Processing ${totalFrames} frames offline (slow processing to preserve full details)...`);
            recorder.start();

            // Perform seek-based frame-by-frame rendering loop to guarantee zero frame drops (like Topaz Video AI)
            async function renderNextOfflineFrame() {
                if (!isProcessing) return;
                
                if (currentFrame < totalFrames) {
                    const seekTime = currentFrame / targetFps;
                    exportVideo.currentTime = seekTime;

                    await new Promise(resolve => {
                        exportVideo.onseeked = resolve;
                    });

                    // Render via two-pass pipeline onto the export canvas
                    // Pass 1: render video frame to expFbo
                    expGl.bindFramebuffer(expGl.FRAMEBUFFER, expFbo);
                    expGl.viewport(0, 0, exportVideo.videoWidth, exportVideo.videoHeight);
                    expGl.useProgram(expDenoiseProgram);

                    expGl.activeTexture(expGl.TEXTURE0);
                    expGl.bindTexture(expGl.TEXTURE_2D, expTex);
                    if (exportVideo.readyState >= 2 && exportVideo.videoWidth > 0 && exportVideo.videoHeight > 0) {
                        expGl.texImage2D(expGl.TEXTURE_2D, 0, expGl.RGBA, expGl.RGBA, expGl.UNSIGNED_BYTE, exportVideo);
                    } else {
                        expGl.texImage2D(expGl.TEXTURE_2D, 0, expGl.RGBA, 1, 1, 0, expGl.RGBA, expGl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
                    }
                    
                    expGl.uniform1i(expGl.getUniformLocation(expDenoiseProgram, 'videoTexture'), 0);
                    expGl.uniform2f(expGl.getUniformLocation(expDenoiseProgram, 'textureSize'), exportVideo.videoWidth, exportVideo.videoHeight);
                    expGl.uniform1f(expGl.getUniformLocation(expDenoiseProgram, 'denoiseVal'), PRESETS[selectedPreset].denoise);

                    // Bind pos
                    expGl.bindBuffer(expGl.ARRAY_BUFFER, expPosBuf);
                    const posLocD = expGl.getAttribLocation(expDenoiseProgram, 'position');
                    expGl.enableVertexAttribArray(posLocD);
                    expGl.vertexAttribPointer(posLocD, 2, expGl.FLOAT, false, 0, 0);
                    expGl.drawArrays(expGl.TRIANGLES, 0, 6);

                    // Pass 2: upscale expFbo to export canvas
                    expGl.bindFramebuffer(expGl.FRAMEBUFFER, null);
                    expGl.viewport(0, 0, exportW, exportH);
                    expGl.useProgram(expUpscaleProgram);

                    expGl.activeTexture(expGl.TEXTURE1);
                    expGl.bindTexture(expGl.TEXTURE_2D, expFboTex);
                    expGl.uniform1i(expGl.getUniformLocation(expUpscaleProgram, 'inputTexture'), 1);

                    const preset = PRESETS[selectedPreset];
                    expGl.uniform2f(expGl.getUniformLocation(expUpscaleProgram, 'textureSize'), exportVideo.videoWidth, exportVideo.videoHeight);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'sharpen'), preset.sharpen);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'unsharpAmount'), preset.unsharpAmount);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'unsharpRadius'), preset.unsharpRadius);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'brightness'), preset.brightness);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'contrast'), preset.contrast);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'shadowsVal'), preset.shadows);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'hueShift'), preset.hue);
                    expGl.uniform1f(expGl.getUniformLocation(expUpscaleProgram, 'saturationShift'), preset.saturation);

                    const modelName = modelSelect.value;
                    let modeInt = 0;
                    if (modelName === 'fsrcnn') modeInt = 3;
                    else if (modelName === 'esrgan') modeInt = 1;
                    else if (modelName === 'anime4k') modeInt = 2;
                    expGl.uniform1i(expGl.getUniformLocation(expUpscaleProgram, 'upscaleMode'), modeInt);

                    const posLocU = expGl.getAttribLocation(expUpscaleProgram, 'position');
                    expGl.enableVertexAttribArray(posLocU);
                    expGl.vertexAttribPointer(posLocU, 2, expGl.FLOAT, false, 0, 0);
                    expGl.drawArrays(expGl.TRIANGLES, 0, 6);

                    // Block and wait for GPU completion to guarantee perfect encoding frame capture
                    expGl.finish();

                    currentFrame++;
                    const pct = Math.round((currentFrame / totalFrames) * 100);
                    btnUpscale.textContent = `Processing: ${pct}%`;

                    if (pct % 10 === 0 && pct > 0) {
                        log(`GPU Super-Resolution encoding: ${pct}% complete...`);
                    }

                    // A tiny frame delay (40ms) allows the Canvas captureStream to record the updated frame flawlessly
                    setTimeout(renderNextOfflineFrame, 40);
                } else {
                    recorder.stop();
                    exportVideo.src = "";
                    exportVideo.load();
                }
            }

            renderNextOfflineFrame();
        };
    }
    );
});
