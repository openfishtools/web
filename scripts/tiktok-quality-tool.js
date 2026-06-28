document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-tiktok-input');
    const dropArea = document.getElementById('tool-tiktok-drop');
    const statusText = document.getElementById('tool-tiktok-status');
    const btnStart = document.getElementById('btn-start-tiktok');
    const progressContainer = document.getElementById('tiktok-progress-container');
    const progressFill = document.getElementById('tiktok-progress-fill');
    const progressPercent = document.getElementById('tiktok-progress-percent');
    const progressText = document.getElementById('tiktok-progress-text');
    const logsContainer = document.getElementById('tiktok-logs-container');
    const logsEl = document.getElementById('tiktok-logs');
    const versionSwitch = document.getElementById('tiktok-version-switch');
    const compressToggleRow = document.getElementById('tiktok-compress-toggle-row');
    const compressSwitch = document.getElementById('tiktok-compress-switch');
    const warningModal = document.getElementById('tiktok-compress-warning-modal');
    const warnFlagsList = document.getElementById('tiktok-warn-flags-list');
    const warnBtnCancel = document.getElementById('tiktok-warn-btn-cancel');
    const warnBtnProceed = document.getElementById('tiktok-warn-btn-proceed');
    const fpsWarningModal = document.getElementById('tiktok-fps-warning-modal');
    const fpsWarnSubtitle = document.getElementById('tiktok-fps-warn-subtitle');
    const fpsBtnCancel = document.getElementById('tiktok-fps-btn-cancel');
    const fpsBtnProceed = document.getElementById('tiktok-fps-btn-proceed');

    let selectedFile = null;
    let isProcessing = false;
    let currentVersion = 'v1';

    const MAX_FILE_MB_HARD = 1500;
    const COMPRESS_WARN_MB = 50;
    const COMPRESS_WARN_MAX_SIDE = 1920;
    const COMPRESS_WARN_FPS = 60;

    if (versionSwitch) {
        versionSwitch.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-version]');
            if (!btn || isProcessing) return;
            versionSwitch.querySelectorAll('.preset-switch').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentVersion = btn.dataset.version;
            if (compressToggleRow) {
                if (currentVersion === 'v2') {
                    compressToggleRow.classList.remove('hidden');
                    compressToggleRow.style.display = 'flex';
                } else {
                    compressToggleRow.classList.add('hidden');
                    compressToggleRow.style.display = 'none';
                }
            }
        });
    }

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--md-sys-color-primary)';
        dropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }

    function handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            showStatusError("Please select a valid video file.");
            btnStart.classList.add('hidden');
            return;
        }

        const fileMB = file.size / (1024 * 1024);

        if (fileMB > MAX_FILE_MB_HARD) {
            showStatusError(`File is too large (${fileMB.toFixed(1)} MB). Max limit is ${MAX_FILE_MB_HARD} MB.`);
            btnStart.classList.add('hidden');
            selectedFile = null;
            return;
        }

        selectedFile = file;
        const infoLine = `Selected: ${file.name} (${fileMB.toFixed(2)} MB)`;
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${infoLine}</span>`;
        btnStart.classList.remove('hidden');

        progressContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        if (currentVersion === 'v1') {
            await processVideoV1(selectedFile);
            return;
        }
        const compressEnabled = compressSwitch ? compressSwitch.checked : true;
        if (!compressEnabled) {
            let fps = null;
            try {
                const arrayBuffer = await selectedFile.arrayBuffer();
                fps = parseFpsFromMp4(arrayBuffer);
            } catch (e) {}

            if (fps !== null && fps < 60) {
                showFpsWarningModal(fps);
                return;
            }

            const flags = await detectCompatibilityFlags(selectedFile);
            if (flags.length > 0) {
                showWarningModal(flags);
                return;
            }
        }
        await processVideoV2(selectedFile, !compressEnabled);
    });

    function showFpsWarningModal(fps) {
        if (fpsWarnSubtitle) {
            fpsWarnSubtitle.textContent = `Detected: ${fps}fps`;
        }
        if (fpsWarningModal) {
            fpsWarningModal.classList.add('visible');
        }
    }

    if (fpsBtnCancel) {
        fpsBtnCancel.addEventListener('click', () => {
            if (fpsWarningModal) {
                fpsWarningModal.classList.remove('visible');
            }
        });
    }

    if (fpsBtnProceed) {
        fpsBtnProceed.addEventListener('click', async () => {
            if (fpsWarningModal) {
                fpsWarningModal.classList.remove('visible');
            }
            if (compressSwitch) {
                compressSwitch.checked = true;
            }
            await processVideoV2(selectedFile, false);
        });
    }

    function showWarningModal(flags) {
        warnFlagsList.innerHTML = flags.map(f =>
            `<li><span class="material-symbols-rounded">warning</span>${f}</li>`
        ).join('');
        warningModal.classList.add('visible');
    }

    function hideWarningModal() {
        warningModal.classList.remove('visible');
    }

    warnBtnCancel.addEventListener('click', () => {
        hideWarningModal();
        if (compressSwitch) compressSwitch.checked = true;
    });

    warnBtnProceed.addEventListener('click', async () => {
        hideWarningModal();
        await processVideoV2(selectedFile, true);
    });

    function parseFpsFromMp4(arrayBuffer) {
        try {
            const data = new Uint8Array(arrayBuffer);
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            const topLevel = parseBoxes(data, view, 0, data.length, '');
            const moov = findTopLevel(topLevel, 'moov');
            if (!moov) return null;
            const videoTrak = moov.children.find(
                c => c.type === 'trak' && handlerTypeForTrak(c) === 'vide'
            );
            if (!videoTrak) return null;
            const mdhd = findDescendant(videoTrak, ['mdia', 'mdhd']);
            const stbl = findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
            const stsz = stbl && findChild(stbl, 'stsz');
            if (!mdhd || !stsz) return null;

            const mdhdPayload = boxPayload(mdhd);
            const version = mdhdPayload[0];
            let timescale, duration;
            if (version === 0) {
                timescale = readU32BE(mdhdPayload, 12);
                duration = readU32BE(mdhdPayload, 16);
            } else if (version === 1) {
                timescale = readU32BE(mdhdPayload, 20);
                const high = readU32BE(mdhdPayload, 24);
                const low = readU32BE(mdhdPayload, 28);
                duration = high * 4294967296 + low;
            } else {
                return null;
            }

            if (!timescale || !duration) return null;
            const durationSec = duration / timescale;
            const frameCount = stsz.view.getUint32(stsz.offset + 16, false);

            if (!frameCount || durationSec <= 0) return null;
            return Math.round(frameCount / durationSec);
        } catch (e) {
            return null;
        }
    }

    function detectCompatibilityFlags(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            const flags = [];
            const fileMB = file.size / (1024 * 1024);

            let resolved = false;
            const cleanup = () => {
                URL.revokeObjectURL(url);
            };

            const safeResolve = (result) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(result);
            };

            const timeoutId = setTimeout(() => {
                if (fileMB > COMPRESS_WARN_MB) {
                    flags.push(`File size is ${fileMB.toFixed(1)} MB (exceeds the 50 MB safe limit)`);
                }
                safeResolve(flags);
            }, 1500);

            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.src = url;

            video.onloadedmetadata = async () => {
                clearTimeout(timeoutId);
                const w = video.videoWidth;
                const h = video.videoHeight;

                if (fileMB > COMPRESS_WARN_MB) {
                    flags.push(`File size is ${fileMB.toFixed(1)} MB (exceeds the 50 MB safe limit)`);
                }

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const fps = parseFpsFromMp4(arrayBuffer);
                    const maxSide = Math.max(w, h);
                    if (maxSide > 1080 && maxSide <= 1920 && fps !== null && fps >= 60) {
                        flags.push(`Video specs: ${w}x${h} at ${fps}fps (exceeds 1080p 60fps compatibility target)`);
                    }
                } catch (e) {}

                safeResolve(flags);
            };

            video.onerror = () => {
                clearTimeout(timeoutId);
                if (fileMB > COMPRESS_WARN_MB) {
                    flags.push(`File size is ${fileMB.toFixed(1)} MB (exceeds the 50 MB safe limit)`);
                }
                safeResolve(flags);
            };

            video.load();
        });
    }

    async function loadFFmpegHelper(ffmpeg, toBlobURL) {
        const baseURL = window.location.origin + '/assets/ffmpeg';
        const isMultiThread = typeof SharedArrayBuffer !== 'undefined';
        let loaded = false;

        if (isMultiThread) {
            try {
                console.log('Attempting to load multi-threaded FFmpeg for TikTok Patcher...');
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                await ffmpeg.load({ coreURL, wasmURL, workerURL });
                loaded = true;
                console.log('Multi-threaded FFmpeg loaded successfully.');
            } catch (err) {
                console.warn('Failed to load multi-threaded FFmpeg, falling back to single-threaded:', err);
            }
        }

        if (!loaded) {
            console.log('Loading single-threaded FFmpeg for TikTok Patcher...');
            const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
            await ffmpeg.load({ coreURL, wasmURL });
            console.log('Single-threaded FFmpeg loaded successfully.');
        }
    }

    async function processVideoV1(file) {
        if (isProcessing) return;
        isProcessing = true;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Initializing FFmpeg...</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = 'Processing...';
        logsEl.textContent = 'Initializing process...\n';

        try {
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            const ffmpeg = new FFmpeg();

            let oomDetected = false;
            let oomLine = '';

            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Processing quality settings...</span>`;
            });

            ffmpeg.on('log', ({ message }) => {
                logsEl.textContent += message + '\n';
                logsEl.scrollTop = logsEl.scrollHeight;

                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                    oomLine = message;
                }
            });

            await loadFFmpegHelper(ffmpeg, toBlobURL);

            logsEl.textContent += 'Writing file to virtual filesystem...\n';
            await ffmpeg.writeFile('input.mp4', await fetchFile(file));

            const hardwareThreads = navigator.hardwareConcurrency || 4;
            const threads = Math.min(4, hardwareThreads).toString();

            const command = [
                '-i', 'input.mp4',
                '-threads', threads,
                '-vf', "scale='if(lt(iw,ih),trunc(min(iw,1080)/2)*2,-2)':'if(lt(iw,ih),-2,trunc(min(ih,1080)/2)*2)'",
                '-c:v', 'wmv2',
                '-qscale:v', '1',
                '-r', '60',
                '-c:a', 'wmav2',
                '-b:a', '320k',
                'output.wmv'
            ];

            logsEl.textContent += `Executing command: ffmpeg ${command.join(' ')}\n`;

            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                try {
                    const testData = await ffmpeg.readFile('output.wmv');
                    if (!testData || testData.byteLength < 1024) {
                        throw execError;
                    }
                } catch (readError) {
                    throw execError;
                }
            }

            if (oomDetected) {
                throw new Error(`Out of memory during video processing. (Triggered by log: "${oomLine}")`);
            }

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Saving output...</span>`;
            const data = await ffmpeg.readFile('output.wmv');

            if (!data || data.byteLength < 1024) {
                throw new Error('Processing failed (output is empty or too small).');
            }

            const blob = new Blob([data.buffer], { type: 'video/x-ms-wmv' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name.replace(/\.[^.]+$/, '')}_hq.wmv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">&#10003; Process finished! Download started.</span>`;
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            btnStart.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            showStatusError(`Error: ${error.message}`);
            btnStart.classList.remove('hidden');
        } finally {
            isProcessing = false;
        }
    }

    // ═══════════════════════════════════════════════
    //  V2: HQ MP4 Patch Method
    //  Step 1: FFmpeg compress (h264, max 1080p, max 60fps, VBR 12-20Mbps, preset slow)
    //  Step 2: Apply fake EOF video samples patch
    // ═══════════════════════════════════════════════

    const FAKE_SAMPLE_COUNT      = 8573;
    const FAKE_SAMPLE_SIZE       = 8;
    const FAKE_SAMPLE_BYTES      = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00]);
    const VIDEO_TIMESCALE        = 90000;
    const VIDEO_DURATION         = 2269500;
    const VIDEO_EDIT_MEDIA_TIME  = 3000;
    const VIDEO_SAMPLE_DELTA     = 1500;

    const CONTAINER_BOXES = new Set([
        'moov', 'trak', 'mdia', 'minf', 'stbl',
        'edts', 'dinf', 'udta', 'meta', 'ilst',
    ]);

    function getBoxType(data, offset) {
        return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }

    function assertUint32(value, label) {
        if (!Number.isFinite(value) || value < 0 || value > 0xffffffff)
            throw new Error(`${label} out of uint32 range: ${value}`);
    }

    function readBox(view, data, offset, end, parentPath) {
        if (offset + 8 > end) throw new Error('Incomplete MP4 box.');
        const smallSize = view.getUint32(offset, false);
        const type = getBoxType(data, offset + 4);
        let size = smallSize;
        let headerSize = 8;

        if (smallSize === 1) {
            if (offset + 16 > end) throw new Error(`Incomplete box: ${type}`);
            const high = view.getUint32(offset + 8, false);
            const low  = view.getUint32(offset + 12, false);
            size = high * 4294967296 + low;
            headerSize = 16;
        } else if (smallSize === 0) {
            size = end - offset;
        }

        if (size < headerSize || offset + size > end)
            throw new Error(`Invalid size in box: ${type}`);

        return {
            type, offset, size, headerSize,
            contentStart: offset + headerSize,
            end: offset + size,
            path: parentPath ? `${parentPath}/${type}` : type,
            data, view,
            children: [],
            prefixStart: offset + headerSize,
            prefixEnd:   offset + headerSize,
        };
    }

    function childStartForBox(box) {
        return box.type === 'meta' ? box.contentStart + 4 : box.contentStart;
    }

    function parseBoxes(data, view, start, end, parentPath) {
        const boxes = [];
        let offset = start;
        while (offset + 8 <= end) {
            const box = readBox(view, data, offset, end, parentPath || '');
            if (CONTAINER_BOXES.has(box.type)) {
                const childStart = childStartForBox(box);
                if (childStart > box.end) throw new Error(`Container ${box.type} too short.`);
                box.prefixStart = box.contentStart;
                box.prefixEnd   = childStart;
                box.children    = parseBoxes(data, view, childStart, box.end, box.path);
            }
            boxes.push(box);
            offset = box.end;
        }
        return boxes;
    }

    function findChild(box, type) {
        return box.children.find(c => c.type === type) || null;
    }

    function findDescendant(box, typePath) {
        let cur = box;
        for (const t of typePath) {
            cur = findChild(cur, t);
            if (!cur) return null;
        }
        return cur;
    }

    function findTopLevel(boxes, type) {
        return boxes.find(b => b.type === type) || null;
    }

    function handlerTypeForTrak(trak) {
        const hdlr = findDescendant(trak, ['mdia', 'hdlr']);
        if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
        return getBoxType(hdlr.data, hdlr.offset + 16);
    }

    function parseStsz(stsz) {
        const sampleSize = stsz.view.getUint32(stsz.offset + 12, false);
        const count      = stsz.view.getUint32(stsz.offset + 16, false);
        if (sampleSize) return new Array(count).fill(sampleSize);
        const tableStart = stsz.offset + 20;
        if (tableStart + count * 4 > stsz.end)
            throw new Error('stsz too small for declared sample count.');
        const sizes = [];
        for (let i = 0; i < count; i++)
            sizes.push(stsz.view.getUint32(tableStart + i * 4, false));
        return sizes;
    }

    function parseStco(stco) {
        const count      = stco.view.getUint32(stco.offset + 12, false);
        const tableStart = stco.offset + 16;
        if (tableStart + count * 4 > stco.end)
            throw new Error('stco too small for declared chunk count.');
        const offsets = [];
        for (let i = 0; i < count; i++)
            offsets.push(stco.view.getUint32(tableStart + i * 4, false));
        return offsets;
    }

    function parseStsc(stsc) {
        const count      = stsc.view.getUint32(stsc.offset + 12, false);
        const tableStart = stsc.offset + 16;
        if (tableStart + count * 12 > stsc.end)
            throw new Error('stsc too small for declared entry count.');
        const rows = [];
        for (let i = 0; i < count; i++) {
            const off = tableStart + i * 12;
            rows.push([
                stsc.view.getUint32(off,     false),
                stsc.view.getUint32(off + 4, false),
                stsc.view.getUint32(off + 8, false),
            ]);
        }
        return rows;
    }

    function makeBox(type, payload) {
        const size = 8 + payload.byteLength;
        assertUint32(size, `${type}.size`);
        const box = new Uint8Array(size);
        const dv  = new DataView(box.buffer);
        dv.setUint32(0, size, false);
        for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
        box.set(new Uint8Array(payload.buffer || payload, payload.byteOffset || 0, payload.byteLength), 8);
        return box;
    }

    function concatBytes(parts) {
        let totalLen = 0;
        for (const p of parts) totalLen += p.byteLength;
        const result = new Uint8Array(totalLen);
        let off = 0;
        for (const p of parts) {
            result.set(new Uint8Array(p.buffer || p, p.byteOffset || 0, p.byteLength), off);
            off += p.byteLength;
        }
        return result;
    }

    function boxBytes(box) {
        return new Uint8Array(box.data.buffer, box.data.byteOffset + box.offset, box.size);
    }

    function boxPayload(box) {
        return new Uint8Array(box.data.buffer, box.data.byteOffset + box.contentStart, box.end - box.contentStart);
    }

    function writeU32BE(arr, offset, value) {
        const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
        dv.setUint32(offset, value, false);
    }

    function readU32BE(arr, offset) {
        const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
        return dv.getUint32(offset, false);
    }

    function buildMdhd(box) {
        const payload = new Uint8Array(boxPayload(box));
        const version = payload[0];
        if (version !== 0) throw new Error(`Unsupported mdhd version: ${version}`);
        writeU32BE(payload, 12, VIDEO_TIMESCALE);
        writeU32BE(payload, 16, VIDEO_DURATION);
        return makeBox('mdhd', payload);
    }

    function buildElst(box) {
        const payload    = new Uint8Array(boxPayload(box));
        const version    = payload[0];
        const entryCount = readU32BE(payload, 4);
        if (version !== 0 || entryCount < 1)
            throw new Error('Need elst version 0 with at least one entry.');
        writeU32BE(payload, 12, VIDEO_EDIT_MEDIA_TIME);
        return makeBox('elst', payload);
    }

    function buildStts(realSampleCount) {
        const payload = new Uint8Array(4 + 4 + 8 + 8);
        writeU32BE(payload, 4, 2);
        writeU32BE(payload, 8, realSampleCount);
        writeU32BE(payload, 12, VIDEO_SAMPLE_DELTA);
        writeU32BE(payload, 16, FAKE_SAMPLE_COUNT);
        writeU32BE(payload, 20, VIDEO_SAMPLE_DELTA);
        return makeBox('stts', payload);
    }

    function buildStsz(originalSizes) {
        const total   = originalSizes.length + FAKE_SAMPLE_COUNT;
        const payload = new Uint8Array(4 + 4 + 4 + total * 4);
        writeU32BE(payload, 8, total);
        let off = 12;
        for (const s of originalSizes) { writeU32BE(payload, off, s); off += 4; }
        for (let i = 0; i < FAKE_SAMPLE_COUNT; i++) {
            writeU32BE(payload, off, FAKE_SAMPLE_SIZE); off += 4;
        }
        return makeBox('stsz', payload);
    }

    function buildStsc(originalRows, originalChunkCount) {
        const rows    = originalRows.map(r => [...r]);
        const lastRow = rows[rows.length - 1];
        if (!lastRow || lastRow[1] !== 1) rows.push([originalChunkCount + 1, 1, 1]);
        const payload = new Uint8Array(4 + 4 + rows.length * 12);
        writeU32BE(payload, 4, rows.length);
        let off = 8;
        for (const [fc, spc, sdi] of rows) {
            writeU32BE(payload, off, fc);
            writeU32BE(payload, off + 4, spc);
            writeU32BE(payload, off + 8, sdi);
            off += 12;
        }
        return makeBox('stsc', payload);
    }

    function buildStco(originalOffsets, delta, fakeOffset) {
        const hasFake = fakeOffset !== null && fakeOffset !== undefined;
        const count   = originalOffsets.length + (hasFake ? FAKE_SAMPLE_COUNT : 0);
        const payload = new Uint8Array(4 + 4 + count * 4);
        writeU32BE(payload, 4, count);
        let off = 8;
        for (const o of originalOffsets) {
            const shifted = o + delta;
            assertUint32(shifted, 'stco.chunk_offset');
            writeU32BE(payload, off, shifted); off += 4;
        }
        if (hasFake) {
            assertUint32(fakeOffset, 'stco.fake_sample_offset');
            for (let i = 0; i < FAKE_SAMPLE_COUNT; i++) {
                writeU32BE(payload, off, fakeOffset); off += 4;
            }
        }
        return makeBox('stco', payload);
    }

    function rebuildBox(box, replacements) {
        if (replacements.has(box)) return replacements.get(box);
        if (!box.children.length) return boxBytes(box);

        const prefix = new Uint8Array(box.data.buffer, box.data.byteOffset + box.prefixStart, box.prefixEnd - box.prefixStart);
        const parts  = [prefix];
        for (const child of box.children) parts.push(rebuildBox(child, replacements));
        return makeBox(box.type, concatBytes(parts));
    }

    function collectTrackStcoBoxes(moov) {
        const stcoBoxes = [];
        for (const trak of moov.children.filter(c => c.type === 'trak')) {
            const stbl = findDescendant(trak, ['mdia', 'minf', 'stbl']);
            if (!stbl) continue;
            if (findChild(stbl, 'co64')) throw new Error('co64 (64-bit offsets) not supported.');
            const stco = findChild(stbl, 'stco');
            if (stco) stcoBoxes.push(stco);
        }
        return stcoBoxes;
    }

    function buildStcoReplacements(stcoBoxes, videoStco, delta, fakeOffset) {
        const map = new Map();
        for (const stco of stcoBoxes) {
            map.set(stco, buildStco(parseStco(stco), delta, stco === videoStco ? fakeOffset : null));
        }
        return map;
    }

    function patchMp4(inputData) {
        const data = new Uint8Array(inputData);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const topLevel = parseBoxes(data, view, 0, data.length, '');

        const ftyp = findTopLevel(topLevel, 'ftyp');
        const moov = findTopLevel(topLevel, 'moov');
        const mdat = findTopLevel(topLevel, 'mdat');

        if (!ftyp) throw new Error('"ftyp" box not found. Not a valid MP4.');
        if (!moov) throw new Error('"moov" box not found. Missing MP4 metadata.');
        if (!mdat) throw new Error('"mdat" box not found. No media data.');

        const videoTrak = moov.children.find(
            c => c.type === 'trak' && handlerTypeForTrak(c) === 'vide'
        );
        if (!videoTrak) throw new Error('Video track not found.');

        const stbl = findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
        const mdhd = findDescendant(videoTrak, ['mdia', 'mdhd']);
        const elst = findDescendant(videoTrak, ['edts', 'elst']);
        const stts = stbl && findChild(stbl, 'stts');
        const stsc = stbl && findChild(stbl, 'stsc');
        const stsz = stbl && findChild(stbl, 'stsz');
        const stco = stbl && findChild(stbl, 'stco');

        if (!stbl || !mdhd || !elst || !stts || !stsc || !stsz || !stco)
            throw new Error('Missing required boxes: mdhd, elst, stts, stsc, stsz, stco.');

        const originalSizes        = parseStsz(stsz);
        const originalStscRows     = parseStsc(stsc);
        const originalChunkOffsets = parseStco(stco);
        const stcoBoxes            = collectTrackStcoBoxes(moov);

        const preservedTopLevel = topLevel
            .filter(b => !['ftyp', 'moov', 'mdat'].includes(b.type))
            .map(boxBytes);

        const fixedReplacements = new Map([
            [mdhd, buildMdhd(mdhd)],
            [elst, buildElst(elst)],
            [stts, buildStts(originalSizes.length)],
            [stsc, buildStsc(originalStscRows, originalChunkOffsets.length)],
            [stsz, buildStsz(originalSizes)],
        ]);

        const placeholderRep = new Map(fixedReplacements);
        buildStcoReplacements(stcoBoxes, stco, 0, 0).forEach((v, k) => placeholderRep.set(k, v));
        const moovPlaceholder   = rebuildBox(moov, placeholderRep);
        const preservedBytes    = concatBytes(preservedTopLevel);
        const oldMdatPayload    = new Uint8Array(data.buffer, data.byteOffset + mdat.contentStart, mdat.end - mdat.contentStart);
        const newMdatStart1     = ftyp.size + moovPlaceholder.byteLength + preservedBytes.byteLength + 8;
        const delta1            = newMdatStart1 - mdat.contentStart;
        const fakeOffset1       = newMdatStart1 + oldMdatPayload.byteLength;

        let finalRep = new Map(fixedReplacements);
        buildStcoReplacements(stcoBoxes, stco, delta1, fakeOffset1).forEach((v, k) => finalRep.set(k, v));
        const moovV2        = rebuildBox(moov, finalRep);
        const newMdatStart2 = ftyp.size + moovV2.byteLength + preservedBytes.byteLength + 8;
        const delta2        = newMdatStart2 - mdat.contentStart;
        const fakeOffset2   = newMdatStart2 + oldMdatPayload.byteLength;

        finalRep = new Map(fixedReplacements);
        buildStcoReplacements(stcoBoxes, stco, delta2, fakeOffset2).forEach((v, k) => finalRep.set(k, v));
        const moovFinal      = rebuildBox(moov, finalRep);
        const mdatPayloadNew = concatBytes([oldMdatPayload, FAKE_SAMPLE_BYTES]);
        const mdatNew        = makeBox('mdat', mdatPayloadNew);
        const ftypBytes      = boxBytes(ftyp);
        const output         = concatBytes([ftypBytes, moovFinal, preservedBytes, mdatNew]);

        return {
            output,
            realSamples:    originalSizes.length,
            fakeSamples:    FAKE_SAMPLE_COUNT,
        };
    }

    async function processVideoV2(file, skipCompress = false) {
        if (isProcessing) return;
        isProcessing = true;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Initializing${skipCompress ? '' : ' FFmpeg'}...</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = skipCompress ? 'Patching...' : 'Compressing...';
        logsEl.textContent = `[v2] HQ Method — Starting (compress: ${skipCompress ? 'off' : 'on'})...\n`;

        try {
            let dataToPath;

            if (skipCompress) {
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Reading file...</span>`;
                progressFill.style.width = '10%';
                progressPercent.textContent = '10%';
                logsEl.textContent += 'Compress step skipped — reading original file...\n';

                const rawBuffer = await file.arrayBuffer();
                dataToPath = new Uint8Array(rawBuffer);

                logsEl.textContent += `Original size: ${(dataToPath.byteLength / (1024 * 1024)).toFixed(2)} MB\n`;

                progressFill.style.width = '40%';
                progressPercent.textContent = '40%';
            } else {
                const { FFmpeg } = window.FFmpegWASM;
                const { fetchFile, toBlobURL } = window.FFmpegUtil;
                const ffmpeg = new FFmpeg();

                let oomDetected = false;
                let oomLine = '';

                ffmpeg.on('progress', ({ progress }) => {
                    const percent = Math.max(0, Math.min(90, Math.round(progress * 90)));
                    progressFill.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;
                    statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Step 1/2: Compressing video...</span>`;
                });

                ffmpeg.on('log', ({ message }) => {
                    logsEl.textContent += message + '\n';
                    logsEl.scrollTop = logsEl.scrollHeight;

                    const lc = message.toLowerCase();
                    if (lc.includes('oom') || lc.includes('out of memory')) {
                        oomDetected = true;
                        oomLine = message;
                    }
                });

                await loadFFmpegHelper(ffmpeg, toBlobURL);

                logsEl.textContent += 'Writing file to virtual filesystem...\n';
                await ffmpeg.writeFile('input.mp4', await fetchFile(file));

                const hardwareThreads = navigator.hardwareConcurrency || 4;
                const threads = Math.min(4, hardwareThreads).toString();

                const command = [
                    '-i', 'input.mp4',
                    '-threads', threads,
                    '-vf', "scale='if(lt(iw,ih),1080,-2)':'if(lt(iw,ih),-2,1080)',fps=60",
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-bf', '0',
                    '-video_track_timescale', '90000',
                    '-b:v', '16M',
                    '-minrate', '12M',
                    '-maxrate', '20M',
                    '-bufsize', '24M',
                    '-c:a', 'aac',
                    '-b:a', '320k',
                    '-movflags', '+faststart',
                    'compressed.mp4'
                ];

                logsEl.textContent += `[Step 1/2] Compressing: ffmpeg ${command.join(' ')}\n`;

                try {
                    await ffmpeg.exec(command);
                } catch (execError) {
                    try {
                        const testData = await ffmpeg.readFile('compressed.mp4');
                        if (!testData || testData.byteLength < 1024) {
                            throw execError;
                        }
                    } catch (readError) {
                        throw execError;
                    }
                }

                if (oomDetected) {
                    throw new Error(`Out of memory during compression. (Triggered by log: "${oomLine}")`);
                }

                const compressedData = await ffmpeg.readFile('compressed.mp4');

                if (!compressedData || compressedData.byteLength < 1024) {
                    throw new Error('Compression failed (output is empty or too small).');
                }

                logsEl.textContent += `Compressed size: ${(compressedData.byteLength / (1024 * 1024)).toFixed(2)} MB\n`;
                dataToPath = compressedData;
            }

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Step ${skipCompress ? '1' : '2'}/2: Applying patch...</span>`;
            progressText.textContent = 'Patching...';
            progressFill.style.width = '92%';
            progressPercent.textContent = '92%';
            logsEl.textContent += `\n[Step ${skipCompress ? '1' : '2'}/2] Applying MP4 patch...\n`;

            const patchResult = patchMp4(dataToPath);

            logsEl.textContent += `Patch complete:\n`;
            logsEl.textContent += `  Real samples: ${patchResult.realSamples}\n`;
            logsEl.textContent += `  Fake samples: ${patchResult.fakeSamples}\n`;
            logsEl.textContent += `  Total declared: ${patchResult.realSamples + patchResult.fakeSamples}\n`;
            logsEl.textContent += `  Output size: ${(patchResult.output.byteLength / (1024 * 1024)).toFixed(2)} MB\n`;
            logsEl.scrollTop = logsEl.scrollHeight;

            progressFill.style.width = '98%';
            progressPercent.textContent = '98%';

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Saving output...</span>`;

            const blob = new Blob([patchResult.output], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name.replace(/\.[^.]+$/, '')}_hq.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">&#10003; Patch applied! Download started.</span>`;
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = 'Complete!';
            btnStart.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            showStatusError(`Error: ${error.message}`);
            btnStart.classList.remove('hidden');
        } finally {
            isProcessing = false;
        }
    }
});
