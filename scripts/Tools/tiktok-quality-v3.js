const FAKE_SAMPLE_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00]);
const FAKE_SAMPLE_SIZE = 8;
const CONTAINER_BOXES = new Set([
    'moov', 'trak', 'mdia', 'minf', 'stbl',
    'edts', 'dinf', 'udta', 'meta', 'ilst',
]);

function _v3_getBoxType(data, offset) {
    return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}
function _v3_assertUint32(value, label) {
    if (!Number.isFinite(value) || value < 0 || value > 0xffffffff)
        throw new Error(`${label} out of uint32 range: ${value}`);
}
function _v3_readBox(view, data, offset, end, parentPath) {
    if (offset + 8 > end) return null;
    const smallSize = view.getUint32(offset, false);
    const type = _v3_getBoxType(data, offset + 4);
    let size = smallSize;
    let headerSize = 8;
    if (smallSize === 1) {
        if (offset + 16 > end) return null;
        const high = view.getUint32(offset + 8, false);
        const low  = view.getUint32(offset + 12, false);
        size = high * 4294967296 + low;
        headerSize = 16;
    } else if (smallSize === 0) {
        size = end - offset;
    }
    if (size < headerSize || offset + size > end) return null;
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
function _v3_childStartForBox(box) {
    return box.type === 'meta' ? box.contentStart + 4 : box.contentStart;
}
function _v3_boxPayload(box) {
    return box.data.subarray(box.contentStart, box.end);
}
function _v3_readU32BE(arr, offset) {
    return ((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0;
}
function _v3_parseBoxes(data, view, start, end, parentPath) {
    const boxes = [];
    let offset = start;
    while (offset + 8 <= end) {
        const box = _v3_readBox(view, data, offset, end, parentPath || '');
        if (!box) break;
        if (CONTAINER_BOXES.has(box.type)) {
            const childStart = _v3_childStartForBox(box);
            if (childStart <= box.end) {
                box.prefixStart = box.contentStart;
                box.prefixEnd   = childStart;
                box.children    = _v3_parseBoxes(data, view, childStart, box.end, box.path);
            }
        }
        boxes.push(box);
        offset = box.end;
    }
    return boxes;
}
function _v3_findChild(box, type) {
    return box ? box.children.find(c => c.type === type) || null : null;
}
function _v3_findDescendant(box, typePath) {
    let cur = box;
    for (const t of typePath) {
        cur = _v3_findChild(cur, t);
        if (!cur) return null;
    }
    return cur;
}
function _v3_findTopLevel(boxes, type) {
    return boxes.find(b => b.type === type) || null;
}
function _v3_handlerTypeForTrak(trak) {
    const hdlr = _v3_findDescendant(trak, ['mdia', 'hdlr']);
    if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
    return _v3_getBoxType(hdlr.data, hdlr.offset + 16);
}
function _v3_getTimescale(trak) {
    const mdhd = _v3_findDescendant(trak, ['mdia', 'mdhd']);
    if (!mdhd) return 90000;
    const ver = mdhd.data[mdhd.offset + 8];
    return ver === 0
        ? mdhd.view.getUint32(mdhd.offset + 20, false)
        : mdhd.view.getUint32(mdhd.offset + 28, false);
}
function _v3_parseStsz(stsz) {
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
function _v3_parseStco(stcoBox) {
    const isCo64 = stcoBox.type === 'co64';
    const count = stcoBox.view.getUint32(stcoBox.offset + 12, false);
    const tableStart = stcoBox.offset + 16;
    const itemSize = isCo64 ? 8 : 4;
    if (tableStart + count * itemSize > stcoBox.end)
        throw new Error(`${stcoBox.type} too small for declared chunk count.`);
    const offsets = [];
    for (let i = 0; i < count; i++) {
        if (isCo64) {
            const high = stcoBox.view.getUint32(tableStart + i * 8, false);
            const low  = stcoBox.view.getUint32(tableStart + i * 8 + 4, false);
            offsets.push(high * 4294967296 + low);
        } else {
            offsets.push(stcoBox.view.getUint32(tableStart + i * 4, false));
        }
    }
    return offsets;
}
function _v3_parseStsc(stsc) {
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
function _v3_parseStts(stts) {
    const count = stts.view.getUint32(stts.offset + 12, false);
    const tableStart = stts.offset + 16;
    const entries = [];
    for (let i = 0; i < count; i++) {
        const off = tableStart + i * 8;
        entries.push([
            stts.view.getUint32(off, false),
            stts.view.getUint32(off + 4, false)
        ]);
    }
    return entries;
}
function _v3_makeBox(type, payload) {
    const size = 8 + payload.byteLength;
    _v3_assertUint32(size, `${type}.size`);
    const box = new Uint8Array(size);
    const dv  = new DataView(box.buffer);
    dv.setUint32(0, size, false);
    for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
    box.set(new Uint8Array(payload.buffer || payload, payload.byteOffset || 0, payload.byteLength), 8);
    return box;
}
function _v3_concatBytes(parts) {
    let totalLen = 0;
    for (const p of parts) totalLen += (p ? p.byteLength : 0);
    const result = new Uint8Array(totalLen);
    let off = 0;
    for (const p of parts) {
        if (!p) continue;
        result.set(new Uint8Array(p.buffer || p, p.byteOffset || 0, p.byteLength), off);
        off += p.byteLength;
    }
    return result;
}
function _v3_boxBytes(box) {
    return new Uint8Array(box.data.buffer, box.data.byteOffset + box.offset, box.size);
}
function _v3_writeU32BE(arr, offset, value) {
    const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    dv.setUint32(offset, value, false);
}
function _v3_buildStco(newOffsets) {
    const payload = new Uint8Array(8 + newOffsets.length * 4);
    _v3_writeU32BE(payload, 4, newOffsets.length);
    let off = 8;
    for (const o of newOffsets) {
        _v3_assertUint32(o, 'stco.chunk_offset');
        _v3_writeU32BE(payload, off, o);
        off += 4;
    }
    return _v3_makeBox('stco', payload);
}
function _v3_buildStsc(rows) {
    const payload = new Uint8Array(8 + rows.length * 12);
    _v3_writeU32BE(payload, 4, rows.length);
    let off = 8;
    for (const [fc, spc, sdi] of rows) {
        _v3_writeU32BE(payload, off, fc);
        _v3_writeU32BE(payload, off + 4, spc);
        _v3_writeU32BE(payload, off + 8, sdi);
        off += 12;
    }
    return _v3_makeBox('stsc', payload);
}
function _v3_buildStsz(sizes) {
    const payload = new Uint8Array(12 + sizes.length * 4);
    _v3_writeU32BE(payload, 8, sizes.length);
    let off = 12;
    for (const sz of sizes) { _v3_writeU32BE(payload, off, sz); off += 4; }
    return _v3_makeBox('stsz', payload);
}
function _v3_buildStts(entries) {
    const payload = new Uint8Array(8 + entries.length * 8);
    _v3_writeU32BE(payload, 4, entries.length);
    let off = 8;
    for (const [count, delta] of entries) {
        _v3_writeU32BE(payload, off, count);
        _v3_writeU32BE(payload, off + 4, delta);
        off += 8;
    }
    return _v3_makeBox('stts', payload);
}
function _v3_buildCommentItem(comment) {
    const text = new TextEncoder().encode(comment);
    const dataPayload = new Uint8Array(8 + text.byteLength);
    dataPayload.set(text, 8);
    return _v3_makeBox('\u00A9cmt', _v3_makeBox('data', dataPayload));
}
function _v3_buildCommentMetadata() {
    const item = _v3_buildCommentItem('Patch by cutefish.my.id');
    const ilst = _v3_makeBox('ilst', item);
    return _v3_makeBox('meta', _v3_concatBytes([new Uint8Array(4), ilst]));
}
function _v3_addCommentMetadata(moov, replacements) {
    const udta = _v3_findChild(moov, 'udta');
    if (!udta) {
        const moovBytes   = _v3_rebuildBox(moov, replacements);
        const rebuiltMoov = _v3_makeBox('moov', _v3_concatBytes([
            moovBytes.subarray(8),
            _v3_makeBox('udta', _v3_buildCommentMetadata())
        ]));
        replacements.set(moov, rebuiltMoov);
        return;
    }
    const meta = _v3_findChild(udta, 'meta');
    if (!meta) {
        const udtaPrefix   = new Uint8Array(udta.data.buffer, udta.data.byteOffset + udta.offset + 8, udta.prefixEnd - udta.contentStart);
        const udtaChildren = udta.children.map(_v3_boxBytes);
        replacements.set(udta, _v3_makeBox('udta', _v3_concatBytes([udtaPrefix, ...udtaChildren, _v3_buildCommentMetadata()])));
        return;
    }
    const ilst = _v3_findChild(meta, 'ilst');
    if (ilst) {
        const items = ilst.children.filter(item => item.type !== '\u00A9cmt').map(_v3_boxBytes);
        replacements.set(ilst, _v3_makeBox('ilst', _v3_concatBytes([...items, _v3_buildCommentItem('Patch by cutefish.my.id')])));
        return;
    }
    const metaPrefix   = new Uint8Array(meta.data.buffer, meta.data.byteOffset + meta.offset + 8, meta.prefixEnd - meta.contentStart);
    const metaChildren = meta.children.map(_v3_boxBytes);
    replacements.set(meta, _v3_makeBox('meta', _v3_concatBytes([metaPrefix, ...metaChildren, _v3_makeBox('ilst', _v3_buildCommentItem('Patch by cutefish.my.id'))])));
}
function _v3_rebuildBox(box, replacements) {
    if (replacements.has(box)) return replacements.get(box);
    if (!box.children.length) return _v3_boxBytes(box);
    const prefix = new Uint8Array(box.data.buffer, box.data.byteOffset + box.prefixStart, box.prefixEnd - box.prefixStart);
    const parts  = [prefix];
    for (const child of box.children) {
        const r = _v3_rebuildBox(child, replacements);
        if (r) parts.push(r);
    }
    return _v3_makeBox(box.type, _v3_concatBytes(parts));
}

function _v3_patchMp4(inputData, _logFn) {
    const _log  = _logFn || (() => {});
    const srcArr = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
    const data   = new Uint8Array(srcArr.byteLength);
    data.set(srcArr);
    const view = new DataView(data.buffer);
    _log(`Input buffer size: ${data.byteLength} bytes (${(data.byteLength / (1024 * 1024)).toFixed(3)} MB)`);

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

    let fakeCount = 0;
    let aRelOffsets = [];
    let aOrigSizes = [];
    let aOrigStsc = [];
    let aOrigStts = [];
    let aStbl = null, aStszBox = null, aStcoBox = null, aStscBox = null, aSttsBox = null;

    if (audioTrak) {
        aStbl    = _v3_findDescendant(audioTrak, ['mdia', 'minf', 'stbl']);
        aStszBox = _v3_findChild(aStbl, 'stsz');
        aStcoBox = _v3_findChild(aStbl, 'stco') || _v3_findChild(aStbl, 'co64');
        aStscBox = _v3_findChild(aStbl, 'stsc');
        aSttsBox = _v3_findChild(aStbl, 'stts');

        aOrigSizes = _v3_parseStsz(aStszBox);
        fakeCount  = aOrigSizes.length * 9;

        const aOrigOffsets = _v3_parseStco(aStcoBox);
        aRelOffsets = aOrigOffsets.map(off => off - origMdatContentStart);
        aOrigStsc   = _v3_parseStsc(aStscBox);
        aOrigStts   = _v3_parseStts(aSttsBox);
    } else {
        fakeCount = vStsz.length * 9;
    }

    const fakePayload = new Uint8Array(fakeCount * FAKE_SAMPLE_SIZE);
    for (let i = 0; i < fakeCount; i++) {
        fakePayload.set(FAKE_SAMPLE_BYTES, i * FAKE_SAMPLE_SIZE);
    }

    let moovHeaderLen = moov.size;
    let finalOutput   = null;
    let patchResultStats = null;

    for (let pass = 0; pass < 3; pass++) {
        const newMdatContentStart = ftypBytes.byteLength + moovHeaderLen + 8;
        const replacements = new Map();

        const vEdts = _v3_findChild(videoTrak, 'edts');
        if (vEdts) replacements.set(vEdts, null);

        const newVOffsets = vRelOffsets.map(off => off + newMdatContentStart);
        replacements.set(vStcoBox, _v3_buildStco(newVOffsets));

        if (audioTrak) {
            const aEdts = _v3_findChild(audioTrak, 'edts');
            if (aEdts) replacements.set(aEdts, null);

            const aUdta = _v3_findChild(audioTrak, 'udta');
            if (aUdta) replacements.set(aUdta, null);

            const fakeChunkOffset = newMdatContentStart + origMdatPayload.byteLength;
            const newAOffsets = [...aRelOffsets.map(off => off + newMdatContentStart), fakeChunkOffset];
            replacements.set(aStcoBox, _v3_buildStco(newAOffsets));

            const newASizes = [...aOrigSizes, ...new Array(fakeCount).fill(FAKE_SAMPLE_SIZE)];
            replacements.set(aStszBox, _v3_buildStsz(newASizes));

            const newAStsc = [...aOrigStsc, [aRelOffsets.length + 1, fakeCount, 1]];
            replacements.set(aStscBox, _v3_buildStsc(newAStsc));

            const newAStts = [...aOrigStts, [fakeCount, 1]];
            replacements.set(aSttsBox, _v3_buildStts(newAStts));
        }

        _v3_addCommentMetadata(moov, replacements);
        const moovFinal = _v3_rebuildBox(moov, replacements);
        moovHeaderLen   = moovFinal.byteLength;

        if (pass === 2) {
            const newMdatBox = _v3_makeBox('mdat', origMdatPayload);
            finalOutput      = _v3_concatBytes([ftypBytes, moovFinal, newMdatBox, fakePayload]);
            const vTimescale = _v3_getTimescale(videoTrak);
            const inputFps   = Math.round(vTimescale / (vStts[0] ? vStts[0][1] : 1000));
            patchResultStats = {
                output: finalOutput,
                realSamples:  vStsz.length,
                fakeSamples:  fakeCount,
                timescale:    vTimescale,
                sampleDelta:  vStts[0] ? vStts[0][1] : 1000,
                duration:     (vStsz.length) * (vStts[0] ? vStts[0][1] : 1000),
                chunkCount:   vRelOffsets.length,
                inputFps,
                patchedFps:   inputFps
            };
        }
    }

    _log(`V3 MP4 patch completed successfully. Total output: ${finalOutput.byteLength} bytes.`);
    return patchResultStats;
}

function _v3_patchMp4HDMethod(inputBuffer) {
    const result = _v3_patchMp4(inputBuffer);
    return result.output;
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

    const modeLabel = isOff ? 'Direct Pass-Through (OFF)' : (mode === '720p' ? 'HD 720p Compress + Patch' : 'Full HD 1080p Compress + Patch');
    s.logSection('BINARY PROCESSING');
    s.log(`  File   : ${safeName}`);
    s.log(`  Mode   : ${modeLabel}`);
    s.logEnd();

    if (isOff) {
        s.log(`  [1/2] Executing Pure JS Patch...`);
        try {
            const patchedBytes = _v3_patchMp4HDMethod(s.currentFileBuffer);
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

        const { FFmpeg }  = window.FFmpegWASM;
        const { toBlobURL } = window.FFmpegUtil;
        const ffmpeg = new FFmpeg();
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

        await s.loadFFmpegHelper(ffmpeg, toBlobURL);

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

        const crfValue = (mode === '720p') ? '20' : '19';
        const maxRate  = (mode === '720p') ? '10M' : '18M';
        const bufSize  = (mode === '720p') ? '16M' : '28M';

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
            '-preset', 'ultrafast',
            '-crf', crfValue,
            '-maxrate', maxRate,
            '-bufsize', bufSize,
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            'output.mp4'
        ];

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
            finalResultBytes = _v3_patchMp4HDMethod(rawOutput);
        } catch (pErr) {
            s.log(`  [Notice] MP4 patch failed, using compressed output as-is: ${pErr.message}`);
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
