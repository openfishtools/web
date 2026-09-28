/* =========================================================================
 * Cutefish MP4 TBT Patcher (Hybrid F R Y & Binary)
 * Experimental TikTok Bypass: Max Signed 64-bit Duration + Modded Fake Samples
 * Stream Normalization + Fake Sample Injection + Metadata Preservation
 * Integrated for Editorstuff / Cutefish TikTok Quality Tool
 * ========================================================================= */

(function () {
'use strict';

const FAKE_SAMPLE_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x0C, 0x66, 0x61, 0x6B, 0x65, 0x00, 0x00, 0x00, 0x00]);
const FAKE_SAMPLE_SIZE = 12;
const CONTAINER_BOXES = new Set([
    'moov', 'trak', 'mdia', 'minf', 'stbl',
    'edts', 'dinf', 'udta', 'meta', 'ilst',
]);

function _tbt_getBoxType(data, offset) {
    return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

function _tbt_assertUint32(value, label) {
    if (!Number.isFinite(value) || value < 0 || value > 0xffffffff)
        throw new Error(`${label} out of uint32 range: ${value}`);
}

function _tbt_readBox(view, data, offset, end, parentPath) {
    if (offset + 8 > end) return null;
    const smallSize = view.getUint32(offset, false);
    const type = _tbt_getBoxType(data, offset + 4);
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

function _tbt_childStartForBox(box) {
    return box.type === 'meta' ? box.contentStart + 4 : box.contentStart;
}

function _tbt_readU32BE(arr, offset) {
    return ((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0;
}

function _tbt_writeU32BE(arr, offset, value) {
    const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    dv.setUint32(offset, value, false);
}

function _tbt_parseBoxes(data, view, start, end, parentPath) {
    const boxes = [];
    let offset = start;
    while (offset + 8 <= end) {
        const box = _tbt_readBox(view, data, offset, end, parentPath || '');
        if (!box) break;
        if (CONTAINER_BOXES.has(box.type)) {
            const childStart = _tbt_childStartForBox(box);
            if (childStart <= box.end) {
                box.prefixStart = box.contentStart;
                box.prefixEnd   = childStart;
                box.children    = _tbt_parseBoxes(data, view, childStart, box.end, box.path);
            }
        }
        boxes.push(box);
        offset = box.end;
    }
    return boxes;
}

function _tbt_findChild(box, type) {
    return box ? box.children.find(c => c.type === type) || null : null;
}

function _tbt_findDescendant(box, typePath) {
    let cur = box;
    for (const t of typePath) {
        cur = _tbt_findChild(cur, t);
        if (!cur) return null;
    }
    return cur;
}

function _tbt_findTopLevel(boxes, type) {
    return boxes.find(b => b.type === type) || null;
}

function _tbt_handlerTypeForTrak(trak) {
    const hdlr = _tbt_findDescendant(trak, ['mdia', 'hdlr']);
    if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
    return _tbt_getBoxType(hdlr.data, hdlr.offset + 16);
}

function _tbt_getTimescale(trak) {
    const mdhd = _tbt_findDescendant(trak, ['mdia', 'mdhd']);
    if (!mdhd) return 90000;
    const ver = mdhd.data[mdhd.offset + 8];
    return ver === 0
        ? mdhd.view.getUint32(mdhd.offset + 20, false)
        : mdhd.view.getUint32(mdhd.offset + 28, false);
}

function _tbt_getTrackDuration(trak) {
    const mdhd = _tbt_findDescendant(trak, ['mdia', 'mdhd']);
    if (!mdhd) return 0;
    const ver = mdhd.data[mdhd.offset + 8];
    return ver === 0
        ? mdhd.view.getUint32(mdhd.offset + 24, false)
        : Number(mdhd.view.getBigUint64(mdhd.offset + 32, false));
}

function _tbt_parseStsz(stsz) {
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

function _tbt_parseStco(stcoBox) {
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

function _tbt_parseStsc(stsc) {
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

function _tbt_parseStts(stts) {
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

function _tbt_makeBox(type, payload) {
    const size = 8 + payload.byteLength;
    _tbt_assertUint32(size, `${type}.size`);
    const box = new Uint8Array(size);
    const dv  = new DataView(box.buffer);
    dv.setUint32(0, size, false);
    for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
    box.set(new Uint8Array(payload.buffer || payload, payload.byteOffset || 0, payload.byteLength), 8);
    return box;
}

function _tbt_concatBytes(parts) {
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

function _tbt_boxBytes(box) {
    return new Uint8Array(box.data.buffer, box.data.byteOffset + box.offset, box.size);
}

function _tbt_buildStco(newOffsets) {
    const payload = new Uint8Array(8 + newOffsets.length * 4);
    _tbt_writeU32BE(payload, 4, newOffsets.length);
    let off = 8;
    for (const o of newOffsets) {
        _tbt_assertUint32(o, 'stco.chunk_offset');
        _tbt_writeU32BE(payload, off, o);
        off += 4;
    }
    return _tbt_makeBox('stco', payload);
}

function _tbt_buildStsc(rows) {
    const payload = new Uint8Array(8 + rows.length * 12);
    _tbt_writeU32BE(payload, 4, rows.length);
    let off = 8;
    for (const [fc, spc, sdi] of rows) {
        _tbt_writeU32BE(payload, off, fc);
        _tbt_writeU32BE(payload, off + 4, spc);
        _tbt_writeU32BE(payload, off + 8, sdi);
        off += 12;
    }
    return _tbt_makeBox('stsc', payload);
}

function _tbt_buildStsz(sizes) {
    const payload = new Uint8Array(12 + sizes.length * 4);
    _tbt_writeU32BE(payload, 8, sizes.length);
    let off = 12;
    for (const sz of sizes) { _tbt_writeU32BE(payload, off, sz); off += 4; }
    return _tbt_makeBox('stsz', payload);
}

function _tbt_buildStts(entries) {
    const payload = new Uint8Array(8 + entries.length * 8);
    _tbt_writeU32BE(payload, 4, entries.length);
    let off = 8;
    for (const [count, delta] of entries) {
        _tbt_writeU32BE(payload, off, count);
        _tbt_writeU32BE(payload, off + 4, delta);
        off += 8;
    }
    return _tbt_makeBox('stts', payload);
}

function _tbt_rebuildBox(box, replacements) {
    if (replacements.has(box)) return replacements.get(box);
    if (!box.children || !box.children.length) return _tbt_boxBytes(box);
    const prefix = new Uint8Array(box.data.buffer, box.data.byteOffset + box.prefixStart, box.prefixEnd - box.prefixStart);
    const parts  = [prefix];
    for (const child of box.children) {
        const r = _tbt_rebuildBox(child, replacements);
        if (r) parts.push(r);
    }
    return _tbt_makeBox(box.type, _tbt_concatBytes(parts));
}

/**
 * Builds mvhd Version 1 (64-bit) with timescale 1000 and duration 0xFFFFFFFFFFFFFFFF.
 * TikTok calculates bitrate as (File Size / Duration).
 * With infinite duration, calculated bitrate is ~0, bypassing downscale restrictions.
 */
function _tbt_buildMvhdV1(nextTrackId) {
    const box = new Uint8Array(120);
    const dv = new DataView(box.buffer);
    dv.setUint32(0, 120, false);
    box.set([0x6d, 0x76, 0x68, 0x64], 4); // 'mvhd'
    box[8] = 1; // version 1 (64-bit)
    dv.setUint32(28, 1000, false); // timescale = 1000
    dv.setUint32(32, 0x7fffffff, false); // duration high 32-bit (TBT Bypass: use max signed 64-bit instead of FFFF)
    dv.setUint32(36, 0xffffffff, false); // duration low 32-bit
    dv.setUint32(40, 0x00010000, false); // rate = 1.0
    dv.setUint16(44, 0x0100, false);     // volume = 1.0
    // Matrix identity
    dv.setUint32(56, 0x00010000, false);
    dv.setUint32(72, 0x00010000, false);
    dv.setUint32(88, 0x40000000, false);
    dv.setUint32(116, nextTrackId || 4, false); // next_track_id
    return box;
}

/**
 * Updates tkhd with assigned trackId and movie duration (in timescale 1000).
 */
function _tbt_updateTkhd(tkhd, trackId, durationInMovieTimescale) {
    const d = new Uint8Array(_tbt_boxBytes(tkhd));
    const isV1 = d[8] === 1;
    const idOff = 8 + (isV1 ? 20 : 12);
    const durOff = 8 + (isV1 ? 28 : 20);
    _tbt_writeU32BE(d, idOff, trackId);
    if (isV1) {
        const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
        dv.setBigUint64(durOff, BigInt(durationInMovieTimescale), false);
    } else {
        _tbt_writeU32BE(d, durOff, durationInMovieTimescale);
    }
    return d;
}

/**
 * Builds udta container metadata placed inside moov and Track 1.
 */
function _tbt_buildUdta(toolName, comment) {
    const buildItem = (tag, str) => {
        const textBytes = new TextEncoder().encode(str);
        const dataPayload = new Uint8Array(8 + textBytes.length);
        const dv = new DataView(dataPayload.buffer);
        dv.setUint32(0, 1, false); // type 1 = utf-8
        dv.setUint32(4, 0, false); // flags = 0
        dataPayload.set(textBytes, 8);
        return _tbt_makeBox(tag, _tbt_makeBox('data', dataPayload));
    };

    const itemToo = buildItem('\u00A9too', toolName || 'Cutefish TBT Quality Method (cutefish.my.id)');
    const itemCmt = buildItem('\u00A9cmt', comment  || 'cutefish.my.id');
    const ilst = _tbt_makeBox('ilst', _tbt_concatBytes([itemToo, itemCmt]));

    const hdlrPayload = new Uint8Array(25);
    hdlrPayload.set([0x6d, 0x64, 0x69, 0x72], 4); // "mdir"
    const hdlr = _tbt_makeBox('hdlr', hdlrPayload);

    const metaPayload = _tbt_concatBytes([new Uint8Array(4), hdlr, ilst]);
    const meta = _tbt_makeBox('meta', metaPayload);

    return _tbt_makeBox('udta', meta);
}

/**
 * Builds Track 3: The cloned audio track that holds the fake-sample payload.
 * Original Track 2 audio remains completely clean and valid.
 */
function _tbt_buildCloneAudioTrack(audioTrak, ctx) {
    const cloneReplacements = new Map();

    const aEdts = _tbt_findChild(audioTrak, 'edts');
    if (aEdts) cloneReplacements.set(aEdts, null);

    const aUdta = _tbt_findChild(audioTrak, 'udta');
    if (aUdta) cloneReplacements.set(aUdta, null);

    const tkhd = _tbt_findChild(audioTrak, 'tkhd');
    if (tkhd) {
        cloneReplacements.set(tkhd, _tbt_updateTkhd(tkhd, ctx.cloneTrackId, ctx.movieDurationMs));
    }

    const fakeChunkOffset = ctx.newMdatContentStart + ctx.origMdatPayload.byteLength;
    const newAOffsets = [...ctx.aRelOffsets.map(off => off + ctx.newMdatContentStart), fakeChunkOffset];
    cloneReplacements.set(ctx.aStcoBox, _tbt_buildStco(newAOffsets));

    const newASizes = [...ctx.aOrigSizes, ...new Array(ctx.fakeCount).fill(FAKE_SAMPLE_SIZE)];
    cloneReplacements.set(ctx.aStszBox, _tbt_buildStsz(newASizes));

    const newAStsc = [...ctx.aOrigStsc, [ctx.aRelOffsets.length + 1, ctx.fakeCount, 1]];
    cloneReplacements.set(ctx.aStscBox, _tbt_buildStsc(newAStsc));

    const newAStts = [...ctx.aOrigStts, [ctx.fakeCount, 1]];
    cloneReplacements.set(ctx.aSttsBox, _tbt_buildStts(newAStts));

    return _tbt_rebuildBox(audioTrak, cloneReplacements);
}

/**
 * Pure JS Cutefish MP4 TBT Patcher.
 * Enforces:
 * 1. Video = Track 1, Audio = Track 2, Fake Clone = Track 3
 * 2. Original edts edit lists preserved on Track 1 & 2
 * 3. mvhd Version 1 (64-bit) infinite duration
 * 4. Fake sample formula: fakeCount = audioSampleCount * 9
 * 5. Trailing fake samples + 8-byte free box after mdat
 */
function _tbt_patchMp4(inputData, _logFn) {
    const _log = _logFn || (() => {});
    const srcArr = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
    const data   = new Uint8Array(srcArr.byteLength);
    data.set(srcArr);
    const view = new DataView(data.buffer);
    _log(`Input buffer size: ${data.byteLength} bytes (${(data.byteLength / (1024 * 1024)).toFixed(3)} MB)`);

    const topLevel = _tbt_parseBoxes(data, view, 0, data.length, '');
    const ftyp = _tbt_findTopLevel(topLevel, 'ftyp');
    const moov = _tbt_findTopLevel(topLevel, 'moov');
    const mdat = _tbt_findTopLevel(topLevel, 'mdat');
    if (!ftyp || !moov || !mdat) throw new Error('Missing required MP4 boxes (ftyp, moov, mdat).');

    // Standard faststart MP4 ftyp
    const ftypPayload = new Uint8Array([
        0x69, 0x73, 0x6f, 0x6d, // 'isom'
        0x00, 0x00, 0x02, 0x00, // minor_version = 512
        0x69, 0x73, 0x6f, 0x6d, // 'isom'
        0x69, 0x73, 0x6f, 0x32, // 'iso2'
        0x61, 0x76, 0x63, 0x31, // 'avc1'
        0x6d, 0x70, 0x34, 0x31  // 'mp41'
    ]);
    const ftypBytes = _tbt_makeBox('ftyp', ftypPayload);

    const origMdatPayload = data.subarray(mdat.contentStart, mdat.end);
    const origMdatContentStart = mdat.contentStart;

    const traks = moov.children.filter(c => c.type === 'trak');
    const videoTrak = traks.find(c => _tbt_handlerTypeForTrak(c) === 'vide');
    const audioTrak = traks.find(c => _tbt_handlerTypeForTrak(c) === 'soun');
    if (!videoTrak) throw new Error('Video track not found.');

    const vTimescale = _tbt_getTimescale(videoTrak);
    const vDuration = _tbt_getTrackDuration(videoTrak);
    const movieDurationMs = Math.round((vDuration / vTimescale) * 1000);

    const vStbl = _tbt_findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
    const vStcoBox = _tbt_findChild(vStbl, 'stco') || _tbt_findChild(vStbl, 'co64');
    const vSttsBox = _tbt_findChild(vStbl, 'stts');
    const vStszBox = _tbt_findChild(vStbl, 'stsz');

    const vOrigOffsets = _tbt_parseStco(vStcoBox);
    const vRelOffsets  = vOrigOffsets.map(off => off - origMdatContentStart);
    const vStsz        = _tbt_parseStsz(vStszBox);
    const vStts        = _tbt_parseStts(vSttsBox);

    let fakeCount = 0;
    let aRelOffsets = [];
    let aOrigSizes = [];
    let aOrigStsc = [];
    let aOrigStts = [];
    let aStbl = null, aStszBox = null, aStcoBox = null, aStscBox = null, aSttsBox = null;

    if (audioTrak) {
        aStbl    = _tbt_findDescendant(audioTrak, ['mdia', 'minf', 'stbl']);
        aStszBox = _tbt_findChild(aStbl, 'stsz');
        aStcoBox = _tbt_findChild(aStbl, 'stco') || _tbt_findChild(aStbl, 'co64');
        aStscBox = _tbt_findChild(aStbl, 'stsc');
        aSttsBox = _tbt_findChild(aStbl, 'stts');

        aOrigSizes = _tbt_parseStsz(aStszBox);
        fakeCount  = aOrigSizes.length * 15;

        const aOrigOffsets = _tbt_parseStco(aStcoBox);
        aRelOffsets = aOrigOffsets.map(off => off - origMdatContentStart);
        aOrigStsc   = _tbt_parseStsc(aStscBox);
        aOrigStts   = _tbt_parseStts(aSttsBox);
    } else {
        fakeCount = vStsz.length * 15;
    }

    _log(`Fake samples injection count: ${fakeCount}`);

    // Fake samples payload: 8 bytes per fake sample + 8 bytes free box
    const fakePayload = new Uint8Array(fakeCount * FAKE_SAMPLE_SIZE + 8);
    for (let i = 0; i < fakeCount; i++) {
        fakePayload.set(FAKE_SAMPLE_BYTES, i * FAKE_SAMPLE_SIZE);
    }
    // Trailing free box: 00 00 00 08 66 72 65 65
    fakePayload.set([0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65], fakeCount * FAKE_SAMPLE_SIZE);

    // Track layout:
    // Video is Track 1
    // Audio is Track 2 (clean)
    // Audio Clone is Track 3 (padded)
    // udta under moov for universal metadata analyzer detection (cutefish.my.id)
    const cloneTrackStub = audioTrak ? { type: 'trak' } : null;
    const moovUdtaStub   = { type: 'udta' };
    const mvhdBox = _tbt_findChild(moov, 'mvhd');
    const otherMoovChildren = moov.children.filter(c => c !== mvhdBox && c !== videoTrak && c !== audioTrak && c.type !== 'udta');

    const moovChildrenList = [mvhdBox, videoTrak];
    if (audioTrak) moovChildrenList.push(audioTrak);
    if (cloneTrackStub) moovChildrenList.push(cloneTrackStub);
    moovChildrenList.push(moovUdtaStub);
    for (const c of otherMoovChildren) moovChildrenList.push(c);
    moov.children = moovChildrenList;

    let moovHeaderLen = moov.size + 12000;
    let finalOutput   = null;
    let patchResultStats = null;

    for (let pass = 0; pass < 3; pass++) {
        const newMdatContentStart = ftypBytes.byteLength + moovHeaderLen + 8;
        const replacements = new Map();

        // 1. mvhd: Version 1 (64-bit) with timescale 1000, duration 0xFFFFFFFFFFFFFFFF, nextTrackId 4
        replacements.set(mvhdBox, _tbt_buildMvhdV1(audioTrak ? 4 : 2));

        // 2. Video track: Track ID 1, preserve edts, attach udta metadata
        const vTkhd = _tbt_findChild(videoTrak, 'tkhd');
        if (vTkhd) {
            replacements.set(vTkhd, _tbt_updateTkhd(vTkhd, 1, movieDurationMs));
        }
        const newVOffsets = vRelOffsets.map(off => off + newMdatContentStart);
        replacements.set(vStcoBox, _tbt_buildStco(newVOffsets));

        const existingVUdta = _tbt_findChild(videoTrak, 'udta');
        const trackUdtaBox = _tbt_buildUdta();
        if (existingVUdta) {
            replacements.set(existingVUdta, trackUdtaBox);
        } else {
            const nonUdta = videoTrak.children.filter(c => c.type !== 'udta');
            videoTrak.children = [...nonUdta, { type: 'udta', _customBytes: trackUdtaBox }];
            const stub = videoTrak.children.find(c => c._customBytes);
            if (stub) replacements.set(stub, stub._customBytes);
        }

        // 3. Moov-level udta metadata (cutefish.my.id)
        replacements.set(moovUdtaStub, _tbt_buildUdta());

        // 3. Audio track (Track 2): Track ID 2, preserve edts, strip udta
        if (audioTrak) {
            const aTkhd = _tbt_findChild(audioTrak, 'tkhd');
            if (aTkhd) {
                replacements.set(aTkhd, _tbt_updateTkhd(aTkhd, 2, movieDurationMs));
            }
            const aUdta = _tbt_findChild(audioTrak, 'udta');
            if (aUdta) replacements.set(aUdta, null);

            replacements.set(aStcoBox, _tbt_buildStco(aRelOffsets.map(off => off + newMdatContentStart)));
        }

        // 4. Cloned Audio Track (Track 3): holds the fake samples
        if (cloneTrackStub) {
            replacements.set(cloneTrackStub, _tbt_buildCloneAudioTrack(audioTrak, {
                cloneTrackId: 3,
                movieDurationMs,
                newMdatContentStart,
                origMdatPayload,
                aRelOffsets, aOrigSizes, aOrigStsc, aOrigStts,
                aStcoBox, aStszBox, aStscBox, aSttsBox,
                fakeCount
            }));
        }

        const moovFinal = _tbt_rebuildBox(moov, replacements);
        moovHeaderLen   = moovFinal.byteLength;

        if (pass === 2) {
            const newMdatBox = _tbt_makeBox('mdat', origMdatPayload);
            finalOutput      = _tbt_concatBytes([ftypBytes, moovFinal, newMdatBox, fakePayload]);
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
                patchedFps:   inputFps,
                audioFix:     true
            };
        }
    }

    _log(`TBT MP4 patch completed successfully. Total output: ${finalOutput.byteLength} bytes.`);
    return patchResultStats;
}

function _tbt_patchMp4TBTMethod(inputBuffer) {
    const result = _tbt_patchMp4(inputBuffer, null);
    return result.output;
}
window.patchMp4TBTMethod = _tbt_patchMp4TBTMethod;

window.processVideoTBT = async function processVideoTBT(file, mode) {
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
    s.progressText.textContent = 'Processing TBT...';

    const modeLabel = isOff ? 'Direct Pass-Through (OFF)' : (mode === '720p' ? 'HD 720p Compress + Patch' : 'Full HD 1080p Compress + Patch');
    s.logSection('BINARY PROCESSING');
    s.log(`  File   : ${safeName}`);
    s.log(`  Mode   : ${modeLabel}`);
    s.log(`  Engine : Cutefish TBT Hybrid (Dual Audio + Max Signed 64-bit Duration + Modded Fake Samples)`);
    s.logEnd();

    if (isOff) {
        let baseBuffer = s.currentFileBuffer;
        s.log(`  [1/2] Standardizing MP4 streams (Faststart Remux)...`);

        const remuxFn = window.remuxFaststart || (s && s.remuxFaststart);
        if (typeof remuxFn === 'function') {
            try {
                baseBuffer = await remuxFn(file, s.currentFileBuffer);
                s.log(`  Stream normalization complete.`);
            } catch (remuxErr) {
                s.log(`  [Notice] Stream remux skipped, using original buffer: ${remuxErr.message}`);
                baseBuffer = s.currentFileBuffer;
            }
        }

        if (typeof window.isEmergencyFpsNeeded === 'function' && window.isEmergencyFpsNeeded(baseBuffer)) {
            s.log(`  [Emergency FPS] Video > 60fps terdeteksi. Menerapkan patch 60fps slowmo...`);
            try {
                baseBuffer = window.patchEmergencyFpsMethod(baseBuffer, s.log);
            } catch (emErr) {
                s.log(`  [Notice] Emergency FPS patch error: ${emErr.message}`);
            }
        }

        s.log(`  [2/2] Applying TBT patch...`);
        try {
            const patchedBytes = _tbt_patchMp4TBTMethod(baseBuffer);
            const finalizeFn = window.finalizePatcherDownload || (s && s.finalizePatcherDownload);
            if (typeof finalizeFn === 'function') {
                finalizeFn(file, patchedBytes, 'hd');
            } else {
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
            }
            return;
        } catch (jsErr) {
            s.log(`  [Error] TBT patch failed: ${jsErr.message}`);
            throw jsErr;
        }
    }

    try {
        const compressFn = window.compressVideo || (s && s.compressVideo);
        if (typeof compressFn !== 'function') {
            throw new Error('Compression module (compress.js) is not loaded.');
        }

        const rawOutput = await compressFn(file, mode, s.currentFileBuffer);

        s.log(`  Executing TBT MP4 patch on compressed video...`);
        let finalResultBytes;
        try {
            let bufferToPatch = rawOutput;
            if (typeof window.isEmergencyFpsNeeded === 'function' && window.isEmergencyFpsNeeded(bufferToPatch)) {
                s.log(`  [Emergency FPS] Video kompresi > 60fps terdeteksi. Menerapkan patch 60fps slowmo...`);
                try {
                    bufferToPatch = window.patchEmergencyFpsMethod(bufferToPatch, s.log);
                } catch (emErr2) {
                    s.log(`  [Notice] Emergency FPS patch error: ${emErr2.message}`);
                }
            }
            finalResultBytes = _tbt_patchMp4TBTMethod(bufferToPatch);
        } catch (pErr) {
            s.log(`  [Notice] TBT patch fallback, using compressed stream: ${pErr.message}`);
            finalResultBytes = rawOutput;
        }
        s.logEnd();

        const finalizeFn = window.finalizePatcherDownload || (s && s.finalizePatcherDownload);
        if (typeof finalizeFn === 'function') {
            finalizeFn(file, finalResultBytes, 'hd');
        } else {
            const blob     = new Blob([finalResultBytes], { type: 'video/mp4' });
            const url      = URL.createObjectURL(blob);
            const filename = `${file.name.replace(/\.[^.]+$/, '')}_hd.mp4`;
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
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

})();
