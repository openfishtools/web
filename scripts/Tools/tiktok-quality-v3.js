/* =========================================================================
 * ADJN MP4 Core v5.0 — 64-Bit Unknown Duration Sentinel Engine
 * Developed by F R Y 60fps (@itsmefachry) & Adekjamannow (@adek.jamannow)
 * Integrated for Editorstuff / Cutefish TikTok Quality Tool
 * ========================================================================= */

const ADJN_VERSION = '5.0';
const ENCODER_TAG = 'ADJN Quality Method by F R Y 60fps (@itsmefachry) & Adekjamannow (@adek.jamannow) (cutefish.my.id)';
const FOURCC_TOO = new Uint8Array([0xa9, 0x74, 0x6f, 0x6f]); // '©too'
const FOURCC_CMT = new Uint8Array([0xa9, 0x63, 0x6d, 0x74]); // '©cmt'
const SENTINEL_FF = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]); // 64-bit Unknown Duration Sentinel
const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);
const MAX_TABLE_ENTRIES = 50000000;
const EMPTY_U8 = new Uint8Array(0);

function _v3_createError(msg) {
    const err = new Error(msg);
    err.name = 'ADJNPatchError';
    return err;
}
function _v3_throwError(msg) {
    throw _v3_createError(msg);
}

function _v3_readU32(b, o) {
    return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function _v3_readU64(b, o) {
    return Number((BigInt(_v3_readU32(b, o)) << 32n) | BigInt(_v3_readU32(b, o + 4)));
}
function _v3_u32ToBytes(v) {
    const b = new Uint8Array(4);
    b[0] = (v >>> 24) & 0xff;
    b[1] = (v >>> 16) & 0xff;
    b[2] = (v >>> 8) & 0xff;
    b[3] = v & 0xff;
    return b;
}
function _v3_u64ToBytes(v) {
    const b = new Uint8Array(8);
    const big = BigInt(v);
    b.set(_v3_u32ToBytes(Number(big >> 32n)), 0);
    b.set(_v3_u32ToBytes(Number(big & 0xffffffffn)), 4);
    return b;
}
function _v3_asciiToBytes(str) {
    const b = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 0xff;
    return b;
}
function _v3_concatBytes(chunks) {
    let total = 0;
    for (const c of chunks) total += (c ? c.length : 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        if (!c) continue;
        out.set(c, offset);
        offset += c.length;
    }
    return out;
}
function _v3_cloneBytes(src) {
    const dst = new Uint8Array(src.length);
    dst.set(src);
    return dst;
}
function _v3_toU8Array(val) {
    if (val instanceof Uint8Array) return new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
    if (val instanceof ArrayBuffer) return new Uint8Array(val);
    if (ArrayBuffer.isView(val)) return new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
    throw _v3_createError('Buffer video tidak valid.');
}

function _v3_exactBytesEqual(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    const step = 65536;
    for (let o = 0; o < a.byteLength; o += step) {
        const len = Math.min(step, a.byteLength - o);
        for (let i = 0; i < len; i++) {
            if (a[o + i] !== b[o + i]) return false;
        }
    }
    return true;
}

function _v3_indexOfSubarray(haystack, needleStr) {
    const needle = _v3_asciiToBytes(needleStr);
    outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) continue outer;
        }
        return i;
    }
    return -1;
}

function Mp4Box(type, payload, children) {
    this.type = type;
    this.payload = payload || EMPTY_U8;
    this.children = children || null;
}
Mp4Box.prototype.find = function (type) {
    if (!this.children) return null;
    for (const c of this.children) if (c.type === type) return c;
    return null;
};
Mp4Box.prototype.findAll = function (type) {
    if (!this.children) return [];
    return this.children.filter(c => c.type === type);
};
Mp4Box.prototype.remove = function (type) {
    if (this.children) this.children = this.children.filter(c => c.type !== type);
};
Mp4Box.prototype.path = function (...types) {
    let cur = this;
    for (let i = 0; i < types.length; i++) {
        cur = cur ? cur.find(types[i]) : null;
        if (!cur) return null;
    }
    return cur;
};
Mp4Box.prototype.clone = function () {
    if (this.children) return new Mp4Box(this.type, null, this.children.map(c => c.clone()));
    return new Mp4Box(this.type, _v3_cloneBytes(this.payload));
};
Mp4Box.prototype.serialize = function () {
    const body = this.children ? _v3_concatBytes(this.children.map(c => c.serialize())) : this.payload;
    if (body.length + 8 > 0xffffffff) {
        return _v3_concatBytes([_v3_u32ToBytes(1), _v3_asciiToBytes(this.type), _v3_u64ToBytes(body.length + 16), body]);
    }
    return _v3_concatBytes([_v3_u32ToBytes(body.length + 8), _v3_asciiToBytes(this.type), body]);
};

function _v3_parseBoxes(bytes, start, end) {
    const list = [];
    let p = start;
    while (p + 8 <= end) {
        let size = _v3_readU32(bytes, p);
        let header = 8;
        if (size === 1) {
            if (p + 16 > end) break;
            size = _v3_readU64(bytes, p + 8);
            header = 16;
        } else if (size === 0) {
            size = end - p;
        }
        if (size < header || p + size > end) break;
        const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
        if (CONTAINER_BOXES.has(type)) {
            list.push(new Mp4Box(type, null, _v3_parseBoxes(bytes, p + header, p + size)));
        } else {
            list.push(new Mp4Box(type, bytes.subarray(p + header, p + size)));
        }
        p += size;
    }
    return list;
}

function _v3_makeBox(type, payload) {
    return _v3_concatBytes([_v3_u32ToBytes(payload.length + 8), _v3_asciiToBytes(type), payload]);
}
function _v3_makeBoxRaw(typeBytes, payload) {
    return _v3_concatBytes([_v3_u32ToBytes(payload.length + 8), typeBytes, payload]);
}

function _v3_scanBoxes(bytes, start, end, label) {
    const out = [];
    let p = start;
    while (p < end) {
        if (p + 8 > end) _v3_throwError('Invalid MP4 — malformed ' + label + ' metadata layout.');
        let size = _v3_readU32(bytes, p);
        let header = 8;
        if (size === 1) {
            if (p + 16 > end) _v3_throwError('Invalid MP4 — truncated 64-bit ' + label + ' metadata header.');
            size = _v3_readU64(bytes, p + 8);
            header = 16;
        } else if (size === 0) {
            size = end - p;
        }
        if (!Number.isSafeInteger(size) || size < header || p + size > end) {
            _v3_throwError('Invalid MP4 — malformed ' + label + ' metadata box size.');
        }
        out.push({
            type: String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]),
            start: p,
            end: p + size,
            header
        });
        p += size;
    }
    return out;
}

function _v3_makeDataAtom(text, fourCC) {
    const dataPayload = _v3_concatBytes([_v3_u32ToBytes(1), _v3_u32ToBytes(0), _v3_asciiToBytes(text)]);
    return _v3_makeBoxRaw(fourCC || FOURCC_TOO, _v3_makeBox('data', dataPayload));
}
function _v3_makeMetaBox(tagText) {
    const hdlrPayload = _v3_concatBytes([_v3_u32ToBytes(0), _v3_u32ToBytes(0), _v3_asciiToBytes('mdir'), new Uint8Array(12), new Uint8Array(1)]);
    return _v3_makeBox('meta', _v3_concatBytes([_v3_u32ToBytes(0), _v3_makeBox('hdlr', hdlrPayload), _v3_makeBox('ilst', _v3_makeDataAtom(tagText))]));
}
function _v3_patchIlst(bytes, tagText) {
    const chunks = [];
    for (const box of _v3_scanBoxes(bytes, 0, bytes.length, 'ilst')) {
        if (box.type !== '©too' && box.type !== '©cmt') chunks.push(_v3_cloneBytes(bytes.subarray(box.start, box.end)));
    }
    if (tagText) {
        chunks.push(_v3_makeDataAtom(tagText, FOURCC_TOO));
        chunks.push(_v3_makeDataAtom(tagText, FOURCC_CMT));
    }
    return _v3_concatBytes(chunks);
}
function _v3_patchMetaBox(bytes, tagText) {
    if (bytes.length < 4) _v3_throwError('Invalid MP4 — malformed meta FullBox.');
    const chunks = [_v3_cloneBytes(bytes.subarray(0, 4))];
    let inserted = false;
    for (const box of _v3_scanBoxes(bytes, 4, bytes.length, 'meta')) {
        if (box.type === 'ilst') {
            const body = bytes.subarray(box.start + box.header, box.end);
            chunks.push(_v3_makeBox('ilst', _v3_patchIlst(body, !inserted ? tagText : null)));
            inserted = inserted || !!tagText;
        } else {
            chunks.push(_v3_cloneBytes(bytes.subarray(box.start, box.end)));
        }
    }
    if (!inserted && tagText) chunks.push(_v3_makeBox('ilst', _v3_makeDataAtom(tagText)));
    return _v3_makeBox('meta', _v3_concatBytes(chunks));
}
function _v3_patchUdtaBox(bytes, tagText) {
    const chunks = [];
    let inserted = false;
    for (const box of _v3_scanBoxes(bytes, 0, bytes.length, 'udta')) {
        if (box.type === 'meta') {
            const body = bytes.subarray(box.start + box.header, box.end);
            chunks.push(_v3_patchMetaBox(body, !inserted ? tagText : null));
            inserted = inserted || !!tagText;
        } else {
            chunks.push(_v3_cloneBytes(bytes.subarray(box.start, box.end)));
        }
    }
    if (!inserted && tagText) chunks.push(_v3_makeMetaBox(tagText));
    return _v3_concatBytes(chunks);
}
function _v3_injectUdta(moov, tagText) {
    const existing = moov.findAll('udta');
    if (existing.length) {
        let inserted = false;
        for (const u of existing) {
            const toAdd = !inserted ? tagText : null;
            inserted = inserted || !!toAdd;
            if (u.children) _v3_throwError('Invalid MP4 — unexpected parsed udta metadata tree.');
            u.payload = _v3_patchUdtaBox(u.payload, toAdd);
        }
    } else {
        moov.children.push(new Mp4Box('udta', _v3_makeMetaBox(tagText)));
    }
}

function _v3_parseTopLevel(bytes) {
    const list = [];
    let p = 0;
    while (p + 8 <= bytes.length) {
        let size = _v3_readU32(bytes, p);
        let header = 8;
        if (size === 1) {
            if (p + 16 > bytes.length) break;
            size = _v3_readU64(bytes, p + 8);
            header = 16;
        } else if (size === 0) {
            size = end - p;
        }
        if (size < header || p + size > bytes.length) break;
        list.push({
            type: String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]),
            start: p,
            end: p + size,
            header
        });
        p += size;
    }
    return list;
}

function _v3_validateBoxNesting(bytes, start, end, label, depth = 0) {
    if (depth > 24) _v3_throwError('Invalid MP4 — box nesting is too deep to patch safely.');
    let p = start;
    while (p < end) {
        if (p + 8 > end) _v3_throwError('Invalid MP4 — malformed ' + label + ' box layout.');
        let size = _v3_readU32(bytes, p);
        let header = 8;
        if (size === 1) {
            if (p + 16 > end) _v3_throwError('Invalid MP4 — truncated 64-bit ' + label + ' box header.');
            size = _v3_readU64(bytes, p + 8);
            header = 16;
        } else if (size === 0) {
            size = end - p;
        }
        if (!Number.isSafeInteger(size) || size < header || p + size > end) {
            _v3_throwError('Invalid MP4 — malformed ' + label + ' box size.');
        }
        const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
        if (CONTAINER_BOXES.has(type)) {
            _v3_validateBoxNesting(bytes, p + header, p + size, type, depth + 1);
        }
        p += size;
    }
}

function _v3_isSentinelDuration(payload) {
    if (!payload || payload.length < 32 || payload[0] !== 1) return false;
    for (let i = 0; i < 8; i++) {
        if (payload[24 + i] !== 0xff) return false;
    }
    return true;
}

function _v3_patchMvhdToV1Sentinel(payload) {
    if (!payload || payload.length < 4) _v3_throwError('Malformed mvhd box (too short for version byte).');
    const ver = payload[0];
    if (ver === 1) {
        if (payload.length < 112) _v3_throwError('Malformed version-1 mvhd box (too short — needs 112 bytes).');
        const out = _v3_cloneBytes(payload);
        out.set(SENTINEL_FF, 24);
        return out;
    }
    if (ver !== 0) _v3_throwError('Unsupported mvhd version: ' + ver + '.');
    if (payload.length < 100) _v3_throwError('Malformed version-0 mvhd box (too short).');
    return _v3_concatBytes([
        new Uint8Array([1, payload[1], payload[2], payload[3]]),
        _v3_u32ToBytes(0),
        _v3_cloneBytes(payload.subarray(4, 8)),
        _v3_u32ToBytes(0),
        _v3_cloneBytes(payload.subarray(8, 12)),
        _v3_cloneBytes(payload.subarray(12, 16)),
        _v3_cloneBytes(SENTINEL_FF),
        _v3_cloneBytes(payload.subarray(20))
    ]);
}

function _v3_validateTableEntries(bytes, headerSize, entrySize, label) {
    if (!bytes || bytes.length < 8) _v3_throwError('The ' + label + ' table is truncated.');
    const count = _v3_readU32(bytes, 4);
    if (count > MAX_TABLE_ENTRIES) _v3_throwError('The ' + label + ' table is unreasonably large (' + count + ' entries).');
    if (headerSize + count * entrySize > bytes.length) _v3_throwError('The ' + label + ' table is truncated.');
    return count;
}

function _v3_parseStcoOrCo64(box) {
    const bytes = box.payload;
    const is64 = box.type === 'co64';
    const count = _v3_validateTableEntries(bytes, 8, is64 ? 8 : 4, box.type);
    const list = new Array(count);
    for (let i = 0; i < count; i++) {
        list[i] = is64 ? _v3_readU64(bytes, 8 + i * 8) : _v3_readU32(bytes, 8 + i * 4);
    }
    return list;
}

function _v3_writeStcoOrCo64(box, offsets) {
    let maxOff = 0;
    for (const off of offsets) if (off > maxOff) maxOff = off;
    if (maxOff > 0xffffffff) {
        box.type = 'co64';
        const b = new Uint8Array(8 + offsets.length * 8);
        b.set(_v3_u32ToBytes(offsets.length), 4);
        for (let i = 0; i < offsets.length; i++) b.set(_v3_u64ToBytes(offsets[i]), 8 + i * 8);
        box.payload = b;
    } else {
        box.type = 'stco';
        const b = new Uint8Array(8 + offsets.length * 4);
        b.set(_v3_u32ToBytes(offsets.length), 4);
        for (let i = 0; i < offsets.length; i++) b.set(_v3_u32ToBytes(offsets[i]), 8 + i * 4);
        box.payload = b;
    }
}

function _v3_getStbl(trak) {
    return trak.path('mdia', 'minf', 'stbl');
}
function _v3_getOffsetBox(trak) {
    const stbl = _v3_getStbl(trak);
    if (!stbl) return null;
    return stbl.find('stco') || stbl.find('co64');
}
function _v3_getTrackHandler(trak) {
    const hdlr = trak.path('mdia', 'hdlr');
    if (!hdlr || hdlr.payload.length < 12) return '';
    const p = hdlr.payload;
    return String.fromCharCode(p[8], p[9], p[10], p[11]);
}
function _v3_getCodecFourCC(trak) {
    const stbl = _v3_getStbl(trak);
    const stsd = stbl ? stbl.find('stsd') : null;
    if (!stsd || stsd.payload.length < 16) return '';
    const p = stsd.payload;
    const count = _v3_readU32(p, 4);
    const entrySize = _v3_readU32(p, 8);
    if (count < 1 || entrySize < 8 || 8 + entrySize > p.length) return '';
    return String.fromCharCode(p[12], p[13], p[14], p[15]);
}

function _v3_parseMp4Structure(bytes) {
    if (!bytes.length) _v3_throwError('File video kosong.');
    const topBoxes = _v3_parseTopLevel(bytes);
    _v3_validateBoxNesting(bytes, 0, bytes.length, 'top-level', 0);
    if (topBoxes.some(b => b.type === 'moof')) _v3_throwError('Fragmented MP4 files tidak didukung untuk direct sentinel patch.');

    const ftypList = topBoxes.filter(b => b.type === 'ftyp');
    const moovList = topBoxes.filter(b => b.type === 'moov');
    const mdatList = topBoxes.filter(b => b.type === 'mdat');
    if (ftypList.length !== 1 || moovList.length !== 1 || mdatList.length !== 1) {
        _v3_throwError('Invalid MP4 — membutuhkan tepat satu box ftyp, moov, dan mdat.');
    }

    const ftypBox = ftypList[0];
    const moovBox = moovList[0];
    const mdatBox = mdatList[0];
    const moov = new Mp4Box('moov', null, _v3_parseBoxes(bytes, moovBox.start + moovBox.header, moovBox.end));
    const traks = moov.findAll('trak');
    if (!traks.length) _v3_throwError('Invalid MP4 — tidak ditemukan track di file video.');

    const mvhd = moov.find('mvhd');
    if (!mvhd || mvhd.payload.length < 4) _v3_throwError('Invalid MP4 — mvhd hilang.');
    if (mvhd.payload[0] !== 0 && mvhd.payload[0] !== 1) {
        _v3_throwError('Unsupported mvhd version: ' + mvhd.payload[0]);
    }

    return {
        top: topBoxes,
        ftypBox,
        moovBox,
        mdatBox,
        moov,
        mvhd,
        traks
    };
}

function _v3_executePatch(bytes, parsed, _log) {
    const { top, moovBox, mdatBox, moov } = parsed;
    const mvhd = moov.find('mvhd');
    if (!mvhd || mvhd.payload.length < 4) _v3_throwError('Invalid MP4 — mvhd hilang.');

    mvhd.payload = _v3_patchMvhdToV1Sentinel(mvhd.payload);
    _v3_injectUdta(moov, ENCODER_TAG);

    const moovBeforeMdat = moovBox.start < mdatBox.start;
    const oldMoovSize = moovBox.end - moovBox.start;

    if (moovBeforeMdat) {
        const traksWithOffsets = moov.findAll('trak').filter(t => _v3_getOffsetBox(t));
        const origOffsets = traksWithOffsets.map(t => _v3_parseStcoOrCo64(_v3_getOffsetBox(t)));
        for (let iter = 0; iter < 6; iter++) {
            const delta = moov.serialize().length - oldMoovSize;
            let changedType = false;
            traksWithOffsets.forEach((t, i) => {
                const box = _v3_getOffsetBox(t);
                const prevType = box.type;
                _v3_writeStcoOrCo64(box, origOffsets[i].map(o => o + delta));
                if (box.type !== prevType) changedType = true;
            });
            if (!changedType && moov.serialize().length === oldMoovSize + delta) {
                if (_log) _log(`  Offsets recalibrated (iter ${iter + 1}, delta = +${delta} bytes).`);
                break;
            }
        }
    }

    const newMoovBytes = moov.serialize();
    const finalChunks = [];
    for (const b of top) {
        finalChunks.push(b.start === moovBox.start ? newMoovBytes : bytes.subarray(b.start, b.end));
    }
    return _v3_concatBytes(finalChunks);
}

function _v3_validateFinalOutput(bytes, originalBytes) {
    const top = _v3_parseTopLevel(bytes);
    if (!top.length || top[top.length - 1].end !== bytes.length) _v3_throwError('Hasil patch bukan box run lengkap.');
    const moovList = top.filter(b => b.type === 'moov');
    const mdatList = top.filter(b => b.type === 'mdat');
    if (moovList.length !== 1 || mdatList.length !== 1) _v3_throwError('Hasil patch harus memiliki tepat satu moov dan satu mdat.');

    const moovBox = moovList[0];
    const mdatBox = mdatList[0];
    const mdatStart = mdatBox.start + mdatBox.header;
    const mdatEnd = mdatBox.end;
    const moov = new Mp4Box('moov', null, _v3_parseBoxes(bytes, moovBox.start + moovBox.header, moovBox.end));

    const mvhd = moov.find('mvhd');
    if (!mvhd || !_v3_isSentinelDuration(mvhd.payload)) _v3_throwError('Hasil patch mvhd.duration bukan sentinel Unknown Duration.');

    for (const trak of moov.findAll('trak')) {
        const offsBox = _v3_getOffsetBox(trak);
        if (!offsBox) continue;
        for (const off of _v3_parseStcoOrCo64(offsBox)) {
            if (off < mdatStart || off >= mdatEnd) {
                _v3_throwError('Offset chunk ter-patch (' + off + ') berada di luar mdat.');
            }
        }
    }

    if (originalBytes) {
        const origTop = _v3_parseTopLevel(originalBytes);
        const origMdatBox = origTop.find(b => b.type === 'mdat');
        if (origMdatBox) {
            const origMdat = originalBytes.subarray(origMdatBox.start + origMdatBox.header, origMdatBox.end);
            const outMdat = bytes.subarray(mdatStart, mdatEnd);
            if (!_v3_exactBytesEqual(origMdat, outMdat)) {
                _v3_throwError('Media payload (mdat) tidak identik setelah patch.');
            }
        }
    }
}

function _v3_patchMp4ADJN(inputData, _logFn) {
    const _log = _logFn || (() => {});
    const src = _v3_toU8Array(inputData);
    _log(`  Input size : ${(src.byteLength / (1024 * 1024)).toFixed(2)} MB (${src.byteLength} bytes)`);

    const parsed = _v3_parseMp4Structure(src);
    _log(`  Boxes validated: ftyp, moov, mdat found.`);
    const vTrak = parsed.traks.find(t => _v3_getTrackHandler(t) === 'vide');
    const aTrak = parsed.traks.find(t => _v3_getTrackHandler(t) === 'soun');
    if (vTrak) _log(`  Video Track: ${_v3_getCodecFourCC(vTrak) || 'AVC/HEVC'}`);
    if (aTrak) _log(`  Audio Track: ${_v3_getCodecFourCC(aTrak) || 'AAC'}`);

    _log(`  Applying metadata patch...`);
    const patched = _v3_executePatch(src, parsed, _log);

    _log(`  Verifying output integrity...`);
    _v3_validateFinalOutput(patched, src);

    _log(`  Patch complete! Size: ${(patched.byteLength / (1024 * 1024)).toFixed(2)} MB`);
    return {
        output: patched,
        durationUnknown: true,
        mdatByteIdentical: true
    };
}

function _v3_patchMp4HDMethod(inputBuffer) {
    const res = _v3_patchMp4ADJN(inputBuffer, null);
    return res.output;
}
window.patchMp4HDMethod = _v3_patchMp4HDMethod;

function _v3_patchMp4FPS(inputData, _logFn) {
    const _log  = _logFn || (() => {});
    const srcArr = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
    const data   = new Uint8Array(srcArr.byteLength);
    data.set(srcArr);
    const view = new DataView(data.buffer);
    _log(`Input buffer size: ${data.byteLength} bytes`);

    const topLevel  = _v3_parseBoxes(data, view, 0, data.length, '');
    const ftyp      = _v3_findTopLevel(topLevel, 'ftyp');
    const moov      = _v3_findTopLevel(topLevel, 'moov');
    const mdat      = _v3_findTopLevel(topLevel, 'mdat');
    if (!ftyp || !moov || !mdat) throw new Error('Missing required MP4 boxes.');

    const ftypPayload = new Uint8Array([
        0x69, 0x73, 0x6f, 0x6d,
        0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6f, 0x6d,
        0x69, 0x73, 0x6f, 0x32,
        0x61, 0x76, 0x63, 0x31,
        0x6d, 0x70, 0x34, 0x31
    ]);
    const ftypBytes = _v3_makeBox('ftyp', ftypPayload);

    const origMdatPayload = data.subarray(mdat.contentStart, mdat.end);
    const origMdatContentStart = mdat.contentStart;

    const traks     = moov.children.filter(c => c.type === 'trak');
    const videoTrak = traks.find(c => _v3_handlerTypeForTrak(c) === 'vide');
    const audioTrak = traks.find(c => _v3_handlerTypeForTrak(c) === 'soun');
    if (!videoTrak) throw new Error('Video track not found.');

    const vStbl    = _v3_findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
    const vStcoBox = _v3_findChild(vStbl, 'stco') || _v3_findChild(vStbl, 'co64');
    const vSttsBox = _v3_findChild(vStbl, 'stts');
    const vStszBox = _v3_findChild(vStbl, 'stsz');

    const vOrigOffsets = _v3_parseStco(vStcoBox);
    const vRelOffsets  = vOrigOffsets.map(off => off - origMdatContentStart);
    const vStsz        = _v3_parseStsz(vStszBox);
    const vStts        = _v3_parseStts(vSttsBox);

    const vTimescale   = _v3_getTimescale(videoTrak);
    const vSampleCount = vStsz.length;
    const vBaseDelta   = vStts[0] ? vStts[0][1] : 1500;
    const newVStts = [
        [vSampleCount - 1, vBaseDelta * 2],
        [1, vBaseDelta]
    ];
    const vMdhdDur = (vSampleCount - 1) * (vBaseDelta * 2) + vBaseDelta;
    const vMvhdDur = Math.floor(vMdhdDur * 1000 / vTimescale);

    let aRelOffsets = [];
    let aStcoBox = null;
    let newAStts = [];
    let aMdhdDur = 0;
    let aMvhdDur = 0;

    if (audioTrak) {
        const aTimescale = _v3_getTimescale(audioTrak);
        const aStbl      = _v3_findDescendant(audioTrak, ['mdia', 'minf', 'stbl']);
        aStcoBox = _v3_findChild(aStbl, 'stco') || _v3_findChild(aStbl, 'co64');
        const aStszBox = _v3_findChild(aStbl, 'stsz');
        const aSttsBox = _v3_findChild(aStbl, 'stts');

        const aOrigSizes = _v3_parseStsz(aStszBox);
        const aOrigOffsets = _v3_parseStco(aStcoBox);
        aRelOffsets = aOrigOffsets.map(off => off - origMdatContentStart);
        const aOrigStts = _v3_parseStts(aSttsBox);
        const aBaseDelta = aOrigStts[0] ? aOrigStts[0][1] : 1024;
        const aSampleCount = aOrigSizes.length;
        const lastDelta = aOrigStts.length > 1 ? aOrigStts[aOrigStts.length - 1][1] : 992;
        newAStts = [
            [aSampleCount - 1, aBaseDelta * 2],
            [1, lastDelta]
        ];
        aMdhdDur = (aSampleCount - 1) * (aBaseDelta * 2) + lastDelta;
        aMvhdDur = Math.floor(aMdhdDur * 1000 / aTimescale);
    }

    let moovHeaderLen = moov.size;
    let finalOutput   = null;
    let patchResultStats = null;

    for (let pass = 0; pass < 3; pass++) {
        const newMdatContentStart = ftypBytes.byteLength + moovHeaderLen + 8;
        const replacements = new Map();

        const newVOffsets = vRelOffsets.map(off => off + newMdatContentStart);
        replacements.set(vStcoBox, _v3_buildStco(newVOffsets));
        replacements.set(vSttsBox, _v3_buildStts(newVStts));

        const vMdhd = _v3_findDescendant(videoTrak, ['mdia', 'mdhd']);
        if (vMdhd) {
            const vMdhdData = _v3_boxBytes(vMdhd);
            const isV1 = vMdhdData[8] === 1;
            const durOff = isV1 ? 32 : 24;
            _v3_writeU32BE(vMdhdData, durOff, vMdhdDur);
            replacements.set(vMdhd, vMdhdData);
        }

        const vTkhd = _v3_findChild(videoTrak, 'tkhd');
        if (vTkhd) {
            const vTkhdData = _v3_boxBytes(vTkhd);
            const isV1 = vTkhdData[8] === 1;
            const durOff = isV1 ? 32 : 28;
            _v3_writeU32BE(vTkhdData, durOff, vMvhdDur);
            replacements.set(vTkhd, vTkhdData);
        }

        const vElst = _v3_findDescendant(videoTrak, ['edts', 'elst']);
        if (vElst) {
            const vElstData = _v3_boxBytes(vElst);
            const isV1 = vElstData[8] === 1;
            const durOff = isV1 ? 20 : 16;
            _v3_writeU32BE(vElstData, durOff, vMvhdDur);
            replacements.set(vElst, vElstData);
        }

        if (audioTrak) {
            const newAOffsets = aRelOffsets.map(off => off + newMdatContentStart);
            replacements.set(aStcoBox, _v3_buildStco(newAOffsets));
            const aSttsBox = _v3_findDescendant(audioTrak, ['mdia', 'minf', 'stbl', 'stts']);
            replacements.set(aSttsBox, _v3_buildStts(newAStts));

            const aMdhd = _v3_findDescendant(audioTrak, ['mdia', 'mdhd']);
            if (aMdhd) {
                const aMdhdData = _v3_boxBytes(aMdhd);
                const isV1 = aMdhdData[8] === 1;
                const durOff = isV1 ? 32 : 24;
                _v3_writeU32BE(aMdhdData, durOff, aMdhdDur);
                replacements.set(aMdhd, aMdhdData);
            }

            const aTkhd = _v3_findChild(audioTrak, 'tkhd');
            if (aTkhd) {
                const aTkhdData = _v3_boxBytes(aTkhd);
                const isV1 = aTkhdData[8] === 1;
                const durOff = isV1 ? 32 : 28;
                _v3_writeU32BE(aTkhdData, durOff, aMvhdDur);
                replacements.set(aTkhd, aTkhdData);
            }

            const aElst = _v3_findDescendant(audioTrak, ['edts', 'elst']);
            if (aElst) {
                const aElstData = _v3_boxBytes(aElst);
                const isV1 = aElstData[8] === 1;
                const durOff = isV1 ? 20 : 16;
                _v3_writeU32BE(aElstData, durOff, aMvhdDur);
                replacements.set(aElst, aElstData);
            }
        }

        const mvhd = _v3_findChild(moov, 'mvhd');
        if (mvhd) {
            const mvhdData = _v3_boxBytes(mvhd);
            const isV1 = mvhdData[8] === 1;
            const durOff = isV1 ? 32 : 24;
            const maxMvhdDur = Math.max(vMvhdDur, aMvhdDur);
            _v3_writeU32BE(mvhdData, durOff, maxMvhdDur);
            replacements.set(mvhd, mvhdData);
        }

        _v3_addCommentMetadata(moov, replacements);
        const moovFinal = _v3_rebuildBox(moov, replacements);
        moovHeaderLen   = moovFinal.byteLength;

        if (pass === 2) {
            const newMdatBox = _v3_makeBox('mdat', origMdatPayload);
            finalOutput      = _v3_concatBytes([ftypBytes, moovFinal, newMdatBox]);
            const inputFps   = Math.round(vTimescale / vBaseDelta);
            const patchedFps = Math.round(vTimescale / (vBaseDelta * 2));
            patchResultStats = {
                output: finalOutput,
                realSamples:  vStsz.length,
                fakeSamples:  0,
                timescale:    vTimescale,
                sampleDelta:  vBaseDelta * 2,
                duration:     vMdhdDur,
                chunkCount:   vRelOffsets.length,
                inputFps,
                patchedFps
            };
        }
    }

    _log(`FPS MP4 patch completed successfully. Total output: ${finalOutput.byteLength} bytes.`);
    return patchResultStats;
}

function _v3_patchMp4FPSMethod(inputBuffer) {
    const result = _v3_patchMp4FPS(inputBuffer);
    return result.output;
}
window.patchMp4FPSMethod = _v3_patchMp4FPSMethod;

window.processVideoFPS = async function processVideoFPS(file) {
    const s = window._tktk;
    // NOTE: do not early-return on s.isProcessing here — the caller
    // (processQualityMethod) already set it before dispatching to this
    // method, so a guard would abort every run ("stuck at Reading file").
    s.isProcessing = true;

    const safeName = s.escapeHTML(file.name);
    s.btnStart.classList.add('hidden');
    s.progressContainer.classList.remove('hidden');
    s.logsContainer.classList.remove('hidden');
    s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;
    s.progressFill.style.width = '0%';
    s.progressPercent.textContent = '0%';
    s.progressText.textContent = 'Processing FPS Method...';

    s.logSection('FPS METHOD PROCESSING');
    s.log(`  File   : ${safeName}`);
    s.log(`  Mode   : Timescale / FPS Presentation Patch`);
    s.logEnd();

    try {
        s.log(`  [1/2] Executing FPS Metadata Patch...`);
        const patchedBytes = _v3_patchMp4FPSMethod(s.currentFileBuffer);
        s.log(`  [2/2] Finalizing output package...`);
        const blob     = new Blob([patchedBytes], { type: 'video/mp4' });
        const url      = URL.createObjectURL(blob);
        const filename = `${file.name.replace(/\.[^.]+$/, '')}_fps.mp4`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        s.log(`  Process Completed Successfully!`);
        s.statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
        s.progressFill.style.width = '100%';
        s.progressPercent.textContent = '100%';
        s.progressText.textContent = window.getTranslation('status_completed');
        s.btnStart.classList.remove('hidden');
        s.isProcessing = false;
        s.showUploadGuideModal(filename);
    } catch (jsErr) {
        s.log(`  [Error] FPS patch failed: ${s.escapeHTML(jsErr.message)}`);
        console.error(jsErr);
        s.showStatusError(`Error: ${s.escapeHTML(jsErr.message)}`);
        s.btnStart.classList.remove('hidden');
    } finally {
        s.isProcessing = false;
    }
};

window.processVideoV3 = async function processVideoV3(file, mode) {
    if (mode === undefined) mode = 'off';
    const s = window._tktk;
    s.isProcessing = true;

    const isOff    = mode === 'off';
    const safeName = s.escapeHTML(file.name);

    if (s.btnStart) s.btnStart.disabled = true;
    if (s.progressContainer) s.progressContainer.classList.remove('hidden');
    if (s.logsContainer) s.logsContainer.classList.remove('hidden');
    const dlBtn = document.getElementById('tool-download-btn');
    if (dlBtn) dlBtn.classList.add('hidden');
    s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;
    s.progressFill.style.width = '0%';
    s.progressPercent.textContent = '0%';
    s.progressText.textContent = 'Processing Binary...';

    const modeLabel = isOff ? 'Pass-Through (No Compression)' : (mode === '720p' ? '720p Compression + Patch' : '1080p Compression + Patch');
    s.logSection('BINARY PROCESSING');
    s.log(`  File : ${safeName}`);
    s.log(`  Mode : ${modeLabel}`);
    s.logEnd();

    if (isOff) {
        s.log(`  [1/2] Applying binary metadata patch...`);
        try {
            const patchRes = _v3_patchMp4ADJN(s.currentFileBuffer, s.log);
            const patchedBytes = patchRes.output;
            s.log(`  [2/2] Finalizing output package...`);
            const blob     = new Blob([patchedBytes], { type: 'video/mp4' });
            const url      = URL.createObjectURL(blob);
            const filename = `${file.name.replace(/\.[^.]+$/, '')}_hd.mp4`;
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            s.log(`  Process Completed Successfully!`);
            s.statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
            s.progressFill.style.width = '100%';
            s.progressPercent.textContent = '100%';
            s.progressText.textContent = window.getTranslation('status_completed');
            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: false, completed: true, percent: 100, status: window.getTranslation('status_completed'), file });
            }
            const processBtn = document.getElementById('tool-process-btn');
            const processLabel = document.getElementById('tool-process-label');
            const processIcon = document.getElementById('tool-process-icon');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.dataset.state = 'completed';
                if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('status_process_another')) || 'Process Another';
                if (processIcon) processIcon.textContent = 'restart_alt';
            }
            s.isProcessing = false;
            if (typeof window.showToast === 'function') window.showToast((window.getTranslation && window.getTranslation('status_completed_toast')) || 'Patch completed successfully!');
            return;
        } catch (jsErr) {
            s.log(`  [Error] Pure JS patch failed: ${jsErr.message}`);
            throw jsErr;
        }
    }

    try {
        const isReady = await s.loadFFmpegLibraries();
        if (!isReady) throw new Error('Processing engine failed to load.');

        const { toBlobURL } = window.FFmpegUtil;
        let ffmpeg = await s.loadFFmpegHelper(null, toBlobURL);
        let oomDetected = false;

        ffmpeg.on('progress', ({ progress }) => {
            const percent = Math.max(0, Math.min(90, Math.round(progress * 90)));
            s.progressFill.style.width = `${percent}%`;
            s.progressPercent.textContent = `${percent}%`;
            const stMsg = `${window.getTranslation('status_encoding')}...`;
            s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${stMsg}</span>`;
            if (window.ToolProgressManager) {
                window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent, status: stMsg, file });
            }
        });
        ffmpeg.on('log', ({ message }) => {
            const lc = message.toLowerCase();
            if (lc.includes('oom') || lc.includes('out of memory')) oomDetected = true;
        });

        s.log(`  [1/3] Loading video data...`);
        const preParseBuffer = s.currentFileBuffer ? s.currentFileBuffer.slice(0) : null;
        await ffmpeg.writeFile('input.mp4', new Uint8Array(s.currentFileBuffer));

        const fileMB         = file.size / (1024 * 1024);
        const hardwareThreads = navigator.hardwareConcurrency || 4;
        const safeThreads    = (fileMB > 50) ? '2' : Math.min(4, hardwareThreads).toString();

        s.log(`  [2/3] Optimizing video quality...`);
        const threads = fileMB > 50 ? '2' : safeThreads;

        let vInfoFps = null, vInfoW = 0, vInfoH = 0;
        if (preParseBuffer) {
            try {
                vInfoFps = s.parseFpsFromMp4(preParseBuffer);
                const r  = s.parseResolutionFromMp4(preParseBuffer);
                if (r) { vInfoW = r.width; vInfoH = r.height; }
            } catch (e) {}
        }
        const procOpts = s.computeVideoProcessingOptions(vInfoW, vInfoH, vInfoFps, fileMB, mode);
        s.log(`  FFmpeg filters: ${procOpts.vfString}`);

        // High-motion sources (esp. 60fps) looked muddy because "ultrafast"
        // skips nearly all x264 refinement. A slower preset produces sharper
        // motion at the SAME CRF (often smaller), while higher maxrate only
        // lifts the ceiling during movement spikes — average size stays put.
        const isMobileDev = (typeof s.isMobileDevice === 'function') ? s.isMobileDevice() : true;
        const x264Preset  = (isMobileDev || fileMB > 50) ? 'superfast' : 'veryfast';

        const crfValue = (mode === '720p') ? '20' : '19';
        const maxRate  = (mode === '720p') ? '14M' : '24M';
        const bufSize  = (mode === '720p') ? '21M' : '38M';
        const gopSize  = Math.max(48, Math.min(240, (vInfoFps || 30) * 2)).toString();

        const command = [
            '-y', '-i', 'input.mp4',
            '-threads', threads,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-dn',
            '-map_metadata', '-1',
            '-map_chapters', '-1',
            '-vf', procOpts.vfString,
            '-vsync', 'cfr',
            '-c:v', 'libx264',
            '-preset', x264Preset,
            '-crf', crfValue,
            '-maxrate', maxRate,
            '-bufsize', bufSize,
            '-g', gopSize,
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            'output.mp4'
        ];
        s.log(`  Encoder: libx264 ${x264Preset} crf=${crfValue} maxrate=${maxRate} gop=${gopSize}`);

        try {
            await ffmpeg.exec(command);
        } catch (execError) {
            try {
                const testData = await ffmpeg.readFile('output.mp4');
                if (!testData || testData.byteLength < 1024) throw execError;
            } catch (rErr) {
                throw execError;
            }
        }

        if (oomDetected) throw new Error('Memory limit reached during video processing.');

        s.statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
        s.progressText.textContent = 'Finalizing package...';
        s.progressFill.style.width = '95%';
        s.progressPercent.textContent = '95%';
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: true, percent: 95, status: window.getTranslation('status_finalizing'), file });
        }

        s.log(`  [3/3] Finalizing output package...`);
        const compressedData = await ffmpeg.readFile('output.mp4');
        try {
            await ffmpeg.deleteFile('input.mp4');
            await ffmpeg.deleteFile('output.mp4');
        } catch (cleanErr) {}

        const rawOutput = new Uint8Array(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);
        let finalResultBytes;
        try {
            const patchRes = _v3_patchMp4ADJN(rawOutput, s.log);
            finalResultBytes = patchRes.output;
        } catch (pErr) {
            s.log(`  [Notice] Metadata patch failed, using compressed output as-is: ${pErr.message}`);
            finalResultBytes = rawOutput;
        }
        s.logEnd();

        const blob     = new Blob([finalResultBytes], { type: 'video/mp4' });
        const url      = URL.createObjectURL(blob);
        const filename = `${file.name.replace(/\.[^.]+$/, '')}_hd.mp4`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        const dlBtn = document.getElementById('tool-download-btn');
        if (dlBtn) {
            dlBtn.classList.remove('hidden');
            dlBtn.onclick = () => {
                const da = document.createElement('a');
                da.href = url;
                da.download = filename;
                document.body.appendChild(da);
                da.click();
                document.body.removeChild(da);
            };
        }

        s.log(`  Process Completed Successfully!`);
        s.statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
        s.progressFill.style.width = '100%';
        s.progressPercent.textContent = '100%';
        s.progressText.textContent = window.getTranslation('status_completed');
        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', { isProcessing: false, completed: true, percent: 100, status: window.getTranslation('status_completed'), file });
        }
        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        const processIcon = document.getElementById('tool-process-icon');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.dataset.state = 'completed';
            if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('status_process_another')) || 'Process Another';
            if (processIcon) processIcon.textContent = 'restart_alt';
        }
        if (typeof window.showToast === 'function') {
            window.showToast((window.getTranslation && window.getTranslation('status_completed_toast')) || 'Processing completed successfully!');
        }

    } catch (error) {
        s.log(`  !! Process Error: ${s.escapeHTML(error.message)}`);
        console.error(error);
        s.showStatusError(`Error: ${s.escapeHTML(error.message)}`);
        if (s.btnStart) s.btnStart.disabled = false;
    } finally {
        s.isProcessing = false;
        if (s.btnStart) s.btnStart.disabled = false;
    }
};
