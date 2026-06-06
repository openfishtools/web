document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('upscaler-file-input');
    const dropArea = document.getElementById('upscaler-drop-area');
    const controls = document.getElementById('upscaler-controls');
    const previewCanvas = document.getElementById('upscaler-preview-canvas');
    const btnUpscale = document.getElementById('btn-upscale-video');
    const logsEl = document.getElementById('upscaler-logs');

    const modelSelect = document.getElementById('upscaler-model-select');
    const scaleSelect = document.getElementById('upscaler-scale-select');
    const settingsWrapper = document.getElementById('upscaler-settings-wrapper');

    // Slider elements
    const sliderContainer = document.getElementById('preview-slider-container');
    const sliderLine = document.getElementById('preview-slider-line');
    const sliderHandle = document.getElementById('preview-slider-handle');

    let currentUploadedFile = null;
    let originalVideo = null;
    let previewWidth = 0;
    let previewHeight = 0;
    let originalFilename = 'upscaled_video';
    let videoAnimFrameId = null;
    let isProcessing = false;

    // Slider state
    let sliderRatio = 0.5;
    let isDraggingSlider = false;

    // WebGL variables
    let gl = null;
    let passThroughProgram = null;
    let upscaleProgram = null;
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

    // Pass-through Fragment Shader: draws raw original frame
    const passThroughFragmentShaderSrc = `
        precision highp float;
        varying vec2 texCoord;
        uniform sampler2D videoTexture;
        void main() {
            gl_FragColor = texture2D(videoTexture, texCoord);
        }
    `;

    // Fragment Shader: Upscale at target resolution (Lanczos, EDI, Anime4K GLSL)
    const upscaleFragmentShaderSrc = `
        precision highp float;
        varying vec2 texCoord;
        uniform sampler2D inputTexture;
        uniform vec2 textureSize; // size of inputTexture
        uniform int upscaleMode; // 0: Lanczos, 1: EDI, 2: Anime4K, 3: FSRCNN approximation

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

        // Anime4K Approximation Shader
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

        // Edge-Directed Interpolation (EDI)
        vec4 textureEDI(sampler2D tex, vec2 uv, vec2 size) {
            vec2 texel = 1.0 / size;
            vec2 pixel = uv * size;
            vec2 f = fract(pixel);
            vec2 p = (floor(pixel) + 0.5) / size;
            
            vec4 a = texture2D(tex, p + vec2(-texel.x, -texel.y));
            vec4 b = texture2D(tex, p + vec2(0.0, -texel.y));
            vec4 c = texture2D(tex, p + vec2(texel.x, -texel.y));
            vec4 d = texture2D(tex, p + vec2(-texel.x, 0.0));
            vec4 e = texture2D(tex, p); // Center
            vec4 f_col = texture2D(tex, p + vec2(texel.x, 0.0));
            vec4 g = texture2D(tex, p + vec2(-texel.x, texel.y));
            vec4 h = texture2D(tex, p + vec2(0.0, texel.y));
            vec4 i = texture2D(tex, p + vec2(texel.x, texel.y));
            
            float gD1 = length(a.rgb - i.rgb);
            float gD2 = length(c.rgb - g.rgb);
            
            vec4 edgeColor;
            if (gD1 < gD2 * 0.7) {
                edgeColor = mix(mix(a, i, 0.5), e, 0.3);
            } else if (gD2 < gD1 * 0.7) {
                edgeColor = mix(mix(c, g, 0.5), e, 0.3);
            } else {
                vec4 top = mix(e, f_col, f.x);
                vec4 bottom = mix(h, i, f.x);
                edgeColor = mix(top, bottom, f.y);
            }
            return mix(edgeColor, e, 0.15);
        }

        void main() {
            vec4 rawColor;
            if (upscaleMode == 0) {
                rawColor = textureLanczos(inputTexture, texCoord, textureSize);
            } else if (upscaleMode == 1) {
                rawColor = textureEDI(inputTexture, texCoord, textureSize);
            } else if (upscaleMode == 2) {
                rawColor = textureAnime4K(inputTexture, texCoord, textureSize);
            } else {
                vec4 base = textureEDI(inputTexture, texCoord, textureSize);
                vec2 t = 1.0 / textureSize;
                vec4 edge1 = textureEDI(inputTexture, texCoord + vec2(-t.x, -t.y), textureSize);
                vec4 edge2 = textureEDI(inputTexture, texCoord + vec2(t.x, t.y), textureSize);
                rawColor = base + 0.45 * (base - (edge1 + edge2) * 0.5);
            }
            gl_FragColor = vec4(clamp(rawColor.rgb, 0.0, 1.0), rawColor.a);
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
        currentUploadedFile = file;
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
            
            // Set up WebGL Context
            initWebGL();
            setupSliderEvents();
            video.play();
            startVideoLoop();
        };
    }

    // Slider interaction setup
    function setupSliderEvents() {
        if (!sliderHandle || !sliderContainer) return;

        // Mouse/Touch Drag Handlers
        const onDragStart = (e) => {
            isDraggingSlider = true;
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const onDrag = (e) => {
            if (!isDraggingSlider) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = sliderContainer.getBoundingClientRect();
            let ratio = (clientX - rect.left) / rect.width;
            ratio = Math.max(0, Math.min(1, ratio)); // Clamp between 0.0 and 1.0

            sliderRatio = ratio;
            sliderLine.style.left = `${ratio * 100}%`;
        };

        const onDragEnd = () => {
            if (isDraggingSlider) {
                isDraggingSlider = false;
                document.body.style.userSelect = '';
            }
        };

        // Handle events
        sliderHandle.addEventListener('mousedown', onDragStart);
        sliderHandle.addEventListener('touchstart', onDragStart, { passive: false });

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('touchmove', onDrag, { passive: false });

        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);
    }

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

        // 1. Pass-through Program (Pass 1 - Raw original video)
        const vsPassThrough = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
        const fsPassThrough = compileShader(gl, gl.FRAGMENT_SHADER, passThroughFragmentShaderSrc);
        passThroughProgram = gl.createProgram();
        gl.attachShader(passThroughProgram, vsPassThrough);
        gl.attachShader(passThroughProgram, fsPassThrough);
        gl.linkProgram(passThroughProgram);

        // 2. Upscale Program (Pass 2 - Preview upscaling)
        const vsUpscale = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
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
    }

    function startVideoLoop() {
        if (videoAnimFrameId) cancelAnimationFrame(videoAnimFrameId);

        function updateFrame() {
            if (originalVideo && !originalVideo.paused && !originalVideo.ended && gl && passThroughProgram && upscaleProgram) {
                renderSplitFrame(gl, originalVideo, originalVideo.videoWidth, originalVideo.videoHeight, previewWidth, previewHeight);
            }
            videoAnimFrameId = requestAnimationFrame(updateFrame);
        }
        updateFrame();
    }

    function renderSplitFrame(glContext, videoElement, nativeW, nativeH, targetW, targetH) {
        // Upload video texture
        glContext.activeTexture(glContext.TEXTURE0);
        glContext.bindTexture(glContext.TEXTURE_2D, videoTexture);
        if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, videoElement);
        } else {
            glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, 1, 1, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        }

        // Calculate division point in pixels
        const splitX = Math.round(sliderRatio * targetW);

        // 1. Render Left Side (Before: Raw Video)
        glContext.enable(glContext.SCISSOR_TEST);
        glContext.scissor(0, 0, splitX, targetH);
        glContext.viewport(0, 0, targetW, targetH);

        glContext.useProgram(passThroughProgram);
        glContext.uniform1i(glContext.getUniformLocation(passThroughProgram, 'videoTexture'), 0);

        const posLocP = glContext.getAttribLocation(passThroughProgram, 'position');
        glContext.enableVertexAttribArray(posLocP);
        glContext.vertexAttribPointer(posLocP, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.TRIANGLES, 0, 6);

        // 2. Render Right Side (After: Upscaled/Processed)
        glContext.scissor(splitX, 0, targetW - splitX, targetH);

        glContext.useProgram(upscaleProgram);
        glContext.uniform1i(glContext.getUniformLocation(upscaleProgram, 'inputTexture'), 0);
        glContext.uniform2f(glContext.getUniformLocation(upscaleProgram, 'textureSize'), nativeW, nativeH);

        const modelName = modelSelect.value;
        let modeInt = 0; // Lanczos
        if (modelName === 'small' || modelName === 'medium' || modelName === 'large') {
            modeInt = 2; // Anime4K preview approximation
        } else {
            modeInt = 0; // Lanczos
        }
        glContext.uniform1i(glContext.getUniformLocation(upscaleProgram, 'upscaleMode'), modeInt);

        const posLocU = glContext.getAttribLocation(upscaleProgram, 'position');
        glContext.enableVertexAttribArray(posLocU);
        glContext.vertexAttribPointer(posLocU, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.TRIANGLES, 0, 6);

        glContext.disable(glContext.SCISSOR_TEST);
    }

    btnUpscale.addEventListener('click', async () => {
        if (!originalVideo || isProcessing) return;
        
        const selectedModel = modelSelect.value;
        const scaleFactor = parseInt(scaleSelect.value);
        
        isProcessing = true;
        if (settingsWrapper) settingsWrapper.classList.add('hidden');
        btnUpscale.disabled = true;
        
        // Pause main rendering loop
        if (videoAnimFrameId) cancelAnimationFrame(videoAnimFrameId);
        originalVideo.pause();

        const exportW = originalVideo.videoWidth * scaleFactor;
        const exportH = originalVideo.videoHeight * scaleFactor;

        log(`--- Starting Upscaling Process ---`);
        log(`Target resolution set: ${exportW}x${exportH} (${scaleFactor}x Upscale)`);

        if (selectedModel === 'mathematical') {
            // Run standard fast WebGL upscaling (Lanczos-3) on main thread
            btnUpscale.textContent = 'Preparing video...';
            await runWebGLMathematicalExport(scaleFactor, exportW, exportH);
        } else {
            // Run client-side WebSR AI upscaling in Web Worker
            btnUpscale.textContent = 'Initializing AI...';
            await runWebSRAiExport(selectedModel, scaleFactor);
        }
    });

    async function runWebSRAiExport(modelName, scaleFactor) {
        log(`Initializing WebSR AI Engine (Model: ${modelName.toUpperCase()})...`);
        let upscaler = null;
        try {
            upscaler = new window.Upscaler({
                weightsBaseUrl: 'assets/weights',
                workerUrl: 'scripts/artplayer-worker.js',
                networkSize: modelName,
                videoScale: scaleFactor
            });

            upscaler.onProgress((progress) => {
                btnUpscale.textContent = `Processing: ${progress}%`;
                if (progress % 10 === 0 && progress > 0) {
                    log(`AI upscaling: ${progress}% complete...`);
                }
            });

            // Start upscaling process on raw video file
            const finalBlob = await upscaler.upscaleVideo(currentUploadedFile);
            log(`✔ AI upscaling completed. Downloading upscaled MP4 file...`);

            // Download file directly
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${originalFilename}_${modelName.toUpperCase()}_x${scaleFactor}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            log('✔ Video upscale complete. File downloaded.');
        } catch (err) {
            console.error('AI upscale error:', err);
            log(`⚠ Error during AI upscaling: ${err.message}`);
            alert(`AI Upscaling failed: ${err.message}. Please try the Mathematical (Lanczos) mode instead.`);
        } finally {
            if (upscaler) {
                upscaler.dispose();
            }
            resetUpscalerState();
        }
    }

    async function runWebGLMathematicalExport(scaleFactor, exportW, exportH) {
        log('Establishing WebGL exporter pipelines...');

        // Setup temporary canvas for high-resolution upscale render
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportW;
        exportCanvas.height = exportH;

        const expGl = exportCanvas.getContext('webgl', { preserveDrawingBuffer: true });
        if (!expGl) {
            log('WebGL export initialization failed.');
            resetUpscalerState();
            return;
        }

        // Setup shader programs
        const expVsUpscale = compileShader(expGl, expGl.VERTEX_SHADER, vertexShaderSrc);
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

        // Create export video element
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

                // Try converting container to MP4 instantly using FFmpeg WASM
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
                    await ffmpeg.exec(['-i', 'input.tmp', '-c', 'copy', 'output.mp4']);
                    
                    const data = await ffmpeg.readFile('output.mp4');
                    if (data && data.byteLength > 1024) {
                        finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
                        finalExt = 'mp4';
                        log('✔ Successfully converted container to MP4.');
                    }
                    
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
                a.download = `${originalFilename}_MATHEMATICAL_x${scaleFactor}.${finalExt}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                log('✔ Video upscale complete. File downloaded.');
                resetUpscalerState();
            };

            const targetFps = 30;
            const duration = exportVideo.duration;
            const totalFrames = Math.round(duration * targetFps);
            let currentFrame = 0;

            log(`Processing ${totalFrames} frames offline (slow processing to preserve full details)...`);
            recorder.start();

            async function renderNextOfflineFrame() {
                if (!isProcessing) return;
                
                if (currentFrame < totalFrames) {
                    const seekTime = currentFrame / targetFps;
                    exportVideo.currentTime = seekTime;

                    await new Promise(resolve => {
                        exportVideo.onseeked = resolve;
                    });

                    // Draw the frame using standard mathematical Lanczos-3 shader
                    expGl.bindFramebuffer(expGl.FRAMEBUFFER, null);
                    expGl.viewport(0, 0, exportW, exportH);
                    expGl.useProgram(expUpscaleProgram);

                    expGl.activeTexture(expGl.TEXTURE0);
                    expGl.bindTexture(expGl.TEXTURE_2D, expTex);
                    if (exportVideo.readyState >= 2 && exportVideo.videoWidth > 0 && exportVideo.videoHeight > 0) {
                        expGl.texImage2D(expGl.TEXTURE_2D, 0, expGl.RGBA, expGl.RGBA, expGl.UNSIGNED_BYTE, exportVideo);
                    } else {
                        expGl.texImage2D(expGl.TEXTURE_2D, 0, expGl.RGBA, 1, 1, 0, expGl.RGBA, expGl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
                    }
                    
                    expGl.uniform1i(expGl.getUniformLocation(expUpscaleProgram, 'inputTexture'), 0);
                    expGl.uniform2f(expGl.getUniformLocation(expUpscaleProgram, 'textureSize'), exportVideo.videoWidth, exportVideo.videoHeight);
                    expGl.uniform1i(expGl.getUniformLocation(expUpscaleProgram, 'upscaleMode'), 0); // 0 = Lanczos-3

                    const posLocU = expGl.getAttribLocation(expUpscaleProgram, 'position');
                    expGl.enableVertexAttribArray(posLocU);
                    expGl.vertexAttribPointer(posLocU, 2, expGl.FLOAT, false, 0, 0);
                    expGl.drawArrays(expGl.TRIANGLES, 0, 6);

                    expGl.finish();

                    currentFrame++;
                    const pct = Math.round((currentFrame / totalFrames) * 100);
                    btnUpscale.textContent = `Processing: ${pct}%`;

                    if (pct % 10 === 0 && pct > 0) {
                        log(`Lanczos upscaling: ${pct}% complete...`);
                    }

                    setTimeout(renderNextOfflineFrame, 15);
                } else {
                    recorder.stop();
                    exportVideo.src = "";
                    exportVideo.load();
                }
            }

            renderNextOfflineFrame();
        };
    }

    function resetUpscalerState() {
        isProcessing = false;
        btnUpscale.disabled = false;
        btnUpscale.textContent = 'Upscale Video';
        if (settingsWrapper) settingsWrapper.classList.remove('hidden');

        if (originalVideo) {
            originalVideo.play();
            startVideoLoop();
        }
    }
});
