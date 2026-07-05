document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-ios-input');
    const dropArea = document.getElementById('tool-ios-drop');
    const statusText = document.getElementById('tool-ios-status');
    const btnStart = document.getElementById('btn-start-ios');
    const progressContainer = document.getElementById('ios-progress-container');
    const progressFill = document.getElementById('ios-progress-fill');
    const progressPercent = document.getElementById('ios-progress-percent');
    const progressText = document.getElementById('ios-progress-text');
    const logsContainer = document.getElementById('ios-logs-container');
    const logsEl = document.getElementById('ios-logs');

    let selectedFile = null;
    let currentFileBuffer = null;
    let isProcessing = false;

    const MAX_FILE_MB_HARD = 1500;

    // --- Centralized logger ---
    function log(msg) {
        const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
        const line = `[${ts}] ${msg}`;
        console.log(line);
        if (logsEl) {
            logsEl.textContent += line + '\n';
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    }
    function logSection(title) {
        log(`== ${title} ==`);
    }
    function logEnd() {
        log('');
    }

    // --- Browser detection ---
    function detectBrowser() {
        const ua = navigator.userAgent;
        if (/CriOS/i.test(ua))  return 'Chrome (iOS)';
        if (/FxiOS/i.test(ua))  return 'Firefox (iOS)';
        if (/EdgiOS/i.test(ua)) return 'Edge (iOS)';
        if (/OPiOS/i.test(ua))  return 'Opera (iOS)';
        if (/EdgA/i.test(ua))   return 'Edge (Android)';
        if (/SamsungBrowser/i.test(ua)) return 'Samsung Browser';
        if (/OPR|Opera/i.test(ua))      return 'Opera';
        if (/Edg\//i.test(ua))          return 'Edge';
        if (/YaBrowser/i.test(ua))      return 'Yandex';
        if (/Firefox/i.test(ua))        return 'Firefox';
        if (/Chrome/i.test(ua))         return 'Chrome';
        if (/Safari/i.test(ua))         return 'Safari';
        return 'Unknown Browser';
    }
    function detectOS() {
        const ua = navigator.userAgent;
        if (/iPhone/i.test(ua))  return `iOS iPhone (${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g,'.') || '?'})`;
        if (/iPad/i.test(ua))    return `iOS iPad (${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g,'.') || '?'})`;
        if (/Android/i.test(ua)) return `Android ${(ua.match(/Android ([\d.]+)/) || [])[1] || '?'}`;
        if (/Windows NT/i.test(ua)) {
            const v = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
            const map = {'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'};
            return `Windows ${map[v] || v || '?'}`;
        }
        if (/Mac OS X/i.test(ua)) return `macOS ${(ua.match(/Mac OS X ([\d_]+)/) || [])[1]?.replace(/_/g,'.') || '?'}`;
        if (/Linux/i.test(ua))    return 'Linux';
        return 'Unknown OS';
    }

    // --- Global error handlers ---
    window.addEventListener('error', (e) => {
        if (!logsEl || logsEl.textContent === '') return;
        logSection('UNCAUGHT ERROR');
        log(`  Message : ${e.message}`);
        log(`  Source  : ${e.filename || 'unknown'}`);
        log(`  Line    : ${e.lineno}:${e.colno}`);
        if (e.error && e.error.stack) {
            e.error.stack.split('\n').slice(0, 5).forEach(l => log(`  Stack   : ${l.trim()}`));
        }
        logEnd();
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (!logsEl || logsEl.textContent === '') return;
        logSection('UNHANDLED PROMISE REJECTION');
        const reason = e.reason;
        if (reason instanceof Error) {
            log(`  Message : ${reason.message}`);
            if (reason.stack) reason.stack.split('\n').slice(0, 5).forEach(l => log(`  Stack   : ${l.trim()}`));
        } else {
            log(`  Reason  : ${String(reason)}`);
        }
        logEnd();
    });

    // --- Copy logs button ---
    const btnCopyLogs = document.getElementById('btn-ios-copy-logs');
    const btnCopyLogsLabel = document.getElementById('btn-ios-copy-logs-label');
    if (btnCopyLogs) {
        btnCopyLogs.addEventListener('mouseenter', () => {
            btnCopyLogs.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnCopyLogs.addEventListener('mouseleave', () => {
            btnCopyLogs.style.background = 'none';
        });
        btnCopyLogs.addEventListener('click', async () => {
            const text = logsEl ? logsEl.textContent : '';
            if (!text.trim()) return;
            const icon = btnCopyLogs.querySelector('.material-symbols-rounded');
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                if (icon) icon.textContent = 'check';
                if (btnCopyLogsLabel) btnCopyLogsLabel.textContent = 'Copied!';
                btnCopyLogs.style.color = 'var(--md-sys-color-primary)';
            } catch (err) {
                if (icon) icon.textContent = 'error';
                if (btnCopyLogsLabel) btnCopyLogsLabel.textContent = 'Failed';
                btnCopyLogs.style.color = 'var(--md-sys-color-error)';
            }
            setTimeout(() => {
                if (icon) icon.textContent = 'content_copy';
                if (btnCopyLogsLabel) btnCopyLogsLabel.textContent = 'Copy';
                btnCopyLogs.style.color = '';
            }, 2000);
        });
    }

    // --- Drag and Drop File Handlers ---
    if (dropArea) {
        dropArea.addEventListener('click', () => {
            if (isProcessing) return;
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (isProcessing) return;
            dropArea.style.borderColor = 'var(--md-sys-color-primary)';
            dropArea.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        dropArea.addEventListener('dragleave', () => {
            dropArea.style.borderColor = '';
            dropArea.style.background = '';
        });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '';
            dropArea.style.background = '';
            if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
        });
    }

    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }

    function resetToolState() {
        selectedFile = null;
        currentFileBuffer = null;
        fileInput.value = '';
        statusText.innerHTML = '';
        btnStart.classList.add('hidden');
        progressContainer.classList.add('hidden');
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = 'Processing...';
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    }

    const btnClearCache = document.getElementById('btn-ios-clear-cache');
    const btnHardRefresh = document.getElementById('btn-ios-hard-refresh');

    if (btnClearCache) {
        btnClearCache.addEventListener('click', () => {
            if (isProcessing) return;
            resetToolState();
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Cache cleared.</span>`;
            const icon = btnClearCache.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.4s ease';
                icon.style.transform = 'rotate(20deg) scale(1.15)';
                setTimeout(() => { icon.style.transform = ''; }, 400);
            }
        });
        btnClearCache.addEventListener('mouseenter', () => {
            btnClearCache.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnClearCache.addEventListener('mouseleave', () => {
            btnClearCache.style.background = 'none';
        });
    }

    if (btnHardRefresh) {
        btnHardRefresh.addEventListener('click', async () => {
            if (isProcessing) return;
            const icon = btnHardRefresh.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.5s ease';
                icon.style.transform = 'rotate(360deg)';
            }
            try {
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(r => r.unregister()));
                }
            } catch (e) { /* ignore */ }
            location.reload(true);
        });
        btnHardRefresh.addEventListener('mouseenter', () => {
            btnHardRefresh.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnHardRefresh.addEventListener('mouseleave', () => {
            btnHardRefresh.style.background = 'none';
        });
    }

    function handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            showStatusError('Please select a valid video file.');
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
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Selected: ${file.name} (${fileMB.toFixed(2)} MB)</span>`;
        btnStart.classList.remove('hidden');
        progressContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read video file.'));
            reader.readAsArrayBuffer(file);
        });
    }

    // =========================================================================
    //  MP4 Parsing and Patch Helpers for iOS Experimental (No speed/dur mods)
    // =========================================================================

    const FAKE_SAMPLE_COUNT = 0;
    const FAKE_SAMPLE_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65]); // 'free' box header of size 8

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

    // Rebuild stco payload with shifted offsets
    function buildStco(originalOffsets, delta) {
        const count   = originalOffsets.length;
        const payload = new Uint8Array(4 + 4 + count * 4);
        writeU32BE(payload, 4, count);
        let off = 8;
        for (const o of originalOffsets) {
            const shifted = o + delta;
            assertUint32(shifted, 'stco.chunk_offset');
            writeU32BE(payload, off, shifted); off += 4;
        }
        return makeBox('stco', payload);
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

    function buildStcoReplacements(stcoBoxes, delta) {
        const map = new Map();
        for (const stco of stcoBoxes) {
            map.set(stco, buildStco(parseStco(stco), delta));
        }
        return map;
    }

    // --- 3-Pass MP4 Offset Shifter with trailing 8-byte dummy box ---
    function patchMp4Ios(inputData, _logFn) {
        const _log = _logFn || (() => {});
        
        // Force byteOffset to 0
        const srcArr = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
        const fresh = new Uint8Array(srcArr.byteLength);
        fresh.set(srcArr);
        const data = fresh;
        const view = new DataView(data.buffer);

        _log(`  Input buffer : ${data.byteLength} bytes (${(data.byteLength/(1024*1024)).toFixed(3)} MB)`);
        _log(`  byteOffset   : ${fresh.byteOffset}`);

        const topLevel = parseBoxes(data, view, 0, data.length, '');
        _log(`  Top-level boxes: ${topLevel.map(b => `${b.type}(${b.size})`).join(', ')}`);

        const ftyp = findTopLevel(topLevel, 'ftyp');
        const moov = findTopLevel(topLevel, 'moov');
        const mdat = findTopLevel(topLevel, 'mdat');

        if (!ftyp) throw new Error('"ftyp" box not found. Not a valid MP4.');
        if (!moov) throw new Error('"moov" box not found. Missing MP4 metadata.');
        if (!mdat) throw new Error('"mdat" box not found. No media data.');

        _log(`  ftyp @ offset ${ftyp.offset}, size ${ftyp.size}`);
        _log(`  moov @ offset ${moov.offset}, size ${moov.size}`);
        _log(`  mdat @ offset ${mdat.offset}, size ${mdat.size}, content @ ${mdat.contentStart}`);

        const stcoBoxes = collectTrackStcoBoxes(moov);
        _log(`  Track stco boxes total: ${stcoBoxes.length}`);

        const preservedTopLevel = topLevel
            .filter(b => !['ftyp', 'moov', 'mdat'].includes(b.type))
            .map(boxBytes);

        // Pass 1: Measure placeholder moov size (using delta = 0)
        const placeholderRep = buildStcoReplacements(stcoBoxes, 0);
        const moovPlaceholder = rebuildBox(moov, placeholderRep);
        const preservedBytes  = concatBytes(preservedTopLevel);
        const oldMdatPayload  = new Uint8Array(data.buffer, data.byteOffset + mdat.contentStart, mdat.end - mdat.contentStart);
        
        // Calculate shifted mdat location
        const newMdatStart1   = ftyp.size + moovPlaceholder.byteLength + preservedBytes.byteLength + 8;
        const delta1          = newMdatStart1 - mdat.contentStart;
        _log(`  Pass 1 — placeholder size: ${moovPlaceholder.byteLength}B, delta: ${delta1}`);

        // Pass 2: Rebuild with first delta
        const finalRep1       = buildStcoReplacements(stcoBoxes, delta1);
        const moovV2          = rebuildBox(moov, finalRep1);
        const newMdatStart2   = ftyp.size + moovV2.byteLength + preservedBytes.byteLength + 8;
        const delta2          = newMdatStart2 - mdat.contentStart;
        _log(`  Pass 2 — moovV2 size: ${moovV2.byteLength}B, delta: ${delta2}`);

        // Pass 3: Rebuild final moov
        const finalRep2       = buildStcoReplacements(stcoBoxes, delta2);
        const moovFinal       = rebuildBox(moov, finalRep2);
        _log(`  Pass 3 — moovFinal size: ${moovFinal.byteLength}B`);

        // Append 8-byte dummy box to end of mdat payload
        const mdatPayloadNew  = concatBytes([oldMdatPayload, FAKE_SAMPLE_BYTES]);
        const mdatNew         = makeBox('mdat', mdatPayloadNew);
        const ftypBytes       = boxBytes(ftyp);
        
        const output          = concatBytes([ftypBytes, moovFinal, preservedBytes, mdatNew]);
        _log(`  Output layout: ftyp(${ftypBytes.byteLength}) + moov(${moovFinal.byteLength}) + preserved(${preservedBytes.byteLength}) + mdat(${mdatNew.byteLength})`);
        _log(`  Total output: ${output.byteLength} bytes (${(output.byteLength/(1024*1024)).toFixed(3)} MB)`);

        return {
            output,
            chunkCount: stcoBoxes.length
        };
    }

    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        if (isProcessing) return;
        isProcessing = true;

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        logsEl.textContent = '';
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Reading file...</span>`;
        progressFill.style.width = '10%';
        progressPercent.textContent = '10%';
        progressText.textContent = 'Reading...';

        logSection('FILE READ');
        log(`  Name        : ${selectedFile.name}`);
        log(`  Size        : ${(selectedFile.size / (1024*1024)).toFixed(3)} MB (${selectedFile.size} bytes)`);
        log(`  MIME type   : ${selectedFile.type}`);
        log(`  Last modif  : ${new Date(selectedFile.lastModified).toISOString()}`);
        log(`  Browser     : ${detectBrowser()}`);
        log(`  OS          : ${detectOS()}`);
        log(`  Platform    : ${navigator.platform || 'unknown'}`);
        log(`  User-Agent  : ${navigator.userAgent}`);
        logEnd();

        try {
            currentFileBuffer = await readFileAsArrayBuffer(selectedFile);
            log(`  ArrayBuffer byteLength : ${currentFileBuffer.byteLength} bytes`);
            log(`  FileReader read        : SUCCESS`);
            logEnd();
        } catch (error) {
            log(`  FileReader ERROR: ${error.name} — ${error.message}`);
            logEnd();
            console.error(error);
            showStatusError(`Error reading file: ${error.message}`);
            btnStart.classList.remove('hidden');
            isProcessing = false;
            return;
        }

        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Applying patch...</span>`;
        progressText.textContent = 'Patching...';
        progressFill.style.width = '60%';
        progressPercent.textContent = '60%';

        logSection('iOS DIRECT PATCH');
        log(`  Original size : ${currentFileBuffer.byteLength} bytes`);
        
        let patchResult;
        try {
            patchResult = patchMp4Ios(currentFileBuffer, log);
            log(`  Patch status  : SUCCESS`);
            logEnd();
        } catch (error) {
            log(`  Patch ERROR: ${error.message}`);
            logEnd();
            console.error(error);
            showStatusError(`Error applying patch: ${error.message}`);
            btnStart.classList.remove('hidden');
            isProcessing = false;
            return;
        }

        progressFill.style.width = '90%';
        progressPercent.textContent = '90%';
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Saving output...</span>`;

        logSection('DOWNLOAD');
        const blob = new Blob([patchResult.output], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        log(`  Blob size  : ${blob.size} bytes`);
        log(`  Blob type  : ${blob.type}`);
        log(`  Filename   : ${selectedFile.name.replace(/\.[^.]+$/, '')}_ios_hq.mp4`);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedFile.name.replace(/\.[^.]+$/, '')}_ios_hq.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log(`  Download triggered ✓`);
        logEnd();

        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">&#10003; Process complete! Download started.</span>`;
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressText.textContent = 'Complete!';
        btnStart.classList.remove('hidden');
        isProcessing = false;
    });
});
