const fs = require('fs');
const path = require('path');

function patchMp4V3Dynamic(inputBuffer) {
    const data = new Uint8Array(inputBuffer);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let offset = 0;
    let ftypBox = null;
    let moovBox = null;
    let mdatBox = null;

    while (offset < data.byteLength - 8) {
        let size = view.getUint32(offset);
        const type = String.fromCharCode(data[offset+4], data[offset+5], data[offset+6], data[offset+7]);
        let headerSize = 8;
        if (size === 1) {
            if (offset + 16 > data.byteLength) break;
            const high = view.getUint32(offset + 8);
            const low = view.getUint32(offset + 12);
            size = high * 4294967296 + low;
            headerSize = 16;
        } else if (size === 0) {
            size = data.byteLength - offset;
        }

        if (size < headerSize || offset + size > data.byteLength) break;

        if (type === 'ftyp') ftypBox = data.subarray(offset, offset + size);
        else if (type === 'moov') moovBox = data.subarray(offset, offset + size);
        else if (type === 'mdat') mdatBox = data.subarray(offset, offset + size);

        offset += size;
    }

    if (!ftypBox || !moovBox || !mdatBox) {
        throw new Error("Invalid or unsupported MP4 atom layout.");
    }

    // Strip 4 leading zero padding bytes if present at start of mdat payload
    let mdatPayload = mdatBox.subarray(8);
    if (mdatPayload.length >= 4 && mdatPayload[0] === 0 && mdatPayload[1] === 0 && mdatPayload[2] === 0 && mdatPayload[3] === 0) {
        mdatPayload = mdatPayload.subarray(4);
    }
    const newMdatSize = 8 + mdatPayload.length;
    const newMdatBox = new Uint8Array(newMdatSize);
    const mdatView = new DataView(newMdatBox.buffer);
    mdatView.setUint32(0, newMdatSize);
    newMdatBox[4] = 109; // 'm'
    newMdatBox[5] = 100; // 'd'
    newMdatBox[6] = 97;  // 'a'
    newMdatBox[7] = 116; // 't'
    newMdatBox.set(mdatPayload, 8);

    let moovArr = Array.from(moovBox);

    // 1. Remove Track 3 (tmcd/timecode track) if present
    const trakIndices = [];
    for (let i = 0; i <= moovArr.length - 8; i++) {
        if (moovArr[i+4] === 116 && moovArr[i+5] === 114 && moovArr[i+6] === 97 && moovArr[i+7] === 107) {
            const sz = (moovArr[i]<<24) | (moovArr[i+1]<<16) | (moovArr[i+2]<<8) | moovArr[i+3];
            trakIndices.push({ start: i, size: sz });
        }
    }
    if (trakIndices.length >= 3) {
        const t3 = trakIndices[2];
        moovArr.splice(t3.start, t3.size);
    }

    // 2. Inject 9,909 dummy entries into Track 2 (Audio) stsz box
    const stszIndices = [];
    for (let i = 0; i <= moovArr.length - 8; i++) {
        if (moovArr[i+4] === 115 && moovArr[i+5] === 116 && moovArr[i+6] === 115 && moovArr[i+7] === 122) {
            stszIndices.push(i);
        }
    }

    if (stszIndices.length >= 2) {
        const audioStszStart = stszIndices[1];
        const origStszSize = (moovArr[audioStszStart]<<24) | (moovArr[audioStszStart+1]<<16) | (moovArr[audioStszStart+2]<<8) | moovArr[audioStszStart+3];
        const origSampleCnt = (moovArr[audioStszStart+16]<<24) | (moovArr[audioStszStart+17]<<16) | (moovArr[audioStszStart+18]<<8) | moovArr[audioStszStart+19];

        const dummyEntriesCnt = 9909;
        const newSampleCnt = origSampleCnt + dummyEntriesCnt;

        moovArr[audioStszStart+16] = (newSampleCnt >> 24) & 0xff;
        moovArr[audioStszStart+17] = (newSampleCnt >> 16) & 0xff;
        moovArr[audioStszStart+18] = (newSampleCnt >> 8) & 0xff;
        moovArr[audioStszStart+19] = newSampleCnt & 0xff;

        const dummyBytes = [];
        for (let d = 0; d < dummyEntriesCnt; d++) {
            dummyBytes.push(0x00, 0x00, 0x00, 0x08);
        }

        const stszPayloadEnd = audioStszStart + origStszSize;
        moovArr.splice(stszPayloadEnd, 0, ...dummyBytes);
        const addedLen = dummyBytes.length;

        const findParentBoxBefore = (typeStr, startIdx) => {
            const charCodes = Array.from(typeStr).map(c => c.charCodeAt(0));
            for (let i = startIdx; i >= 8; i--) {
                if (moovArr[i+4] === charCodes[0] && moovArr[i+5] === charCodes[1] && moovArr[i+6] === charCodes[2] && moovArr[i+7] === charCodes[3]) {
                    return i;
                }
            }
            return -1;
        };

        const stblStart = findParentBoxBefore('stbl', audioStszStart);
        const minfStart = findParentBoxBefore('minf', stblStart > 0 ? stblStart : audioStszStart);
        const mdiaStart = findParentBoxBefore('mdia', minfStart > 0 ? minfStart : audioStszStart);
        
        let trak2Start = -1;
        const allTraks = [];
        for (let i = 0; i <= moovArr.length - 8; i++) {
            if (moovArr[i+4] === 116 && moovArr[i+5] === 114 && moovArr[i+6] === 97 && moovArr[i+7] === 107) {
                allTraks.push(i);
            }
        }
        if (allTraks.length >= 2) {
            trak2Start = allTraks[1];
        }

        const parentPositions = [audioStszStart, stblStart, minfStart, mdiaStart, trak2Start].filter(p => p >= 0);
        for (const pos of parentPositions) {
            const oldSz = (moovArr[pos]<<24) | (moovArr[pos+1]<<16) | (moovArr[pos+2]<<8) | moovArr[pos+3];
            const newSz = oldSz + addedLen;
            moovArr[pos]   = (newSz >> 24) & 0xff;
            moovArr[pos+1] = (newSz >> 16) & 0xff;
            moovArr[pos+2] = (newSz >> 8) & 0xff;
            moovArr[pos+3] = newSz & 0xff;
        }
    }

    // 3. Update moov total size header
    const newMoovSize = moovArr.length;
    moovArr[0] = (newMoovSize >> 24) & 0xff;
    moovArr[1] = (newMoovSize >> 16) & 0xff;
    moovArr[2] = (newMoovSize >> 8) & 0xff;
    moovArr[3] = newMoovSize & 0xff;

    // 4. FastStart shift stco
    const shiftAmount = newMoovSize;
    for (let i = 0; i <= moovArr.length - 8; i++) {
        if (moovArr[i+4] === 115 && moovArr[i+5] === 116 && moovArr[i+6] === 99 && moovArr[i+7] === 111) {
            const cnt = (moovArr[i+12]<<24) | (moovArr[i+13]<<16) | (moovArr[i+14]<<8) | moovArr[i+15];
            for (let e = 0; e < cnt; e++) {
                const idx = i + 16 + (e * 4);
                if (idx + 4 <= moovArr.length) {
                    const oldVal = (moovArr[idx]<<24) | (moovArr[idx+1]<<16) | (moovArr[idx+2]<<8) | moovArr[idx+3];
                    const newVal = oldVal + shiftAmount;
                    moovArr[idx]   = (newVal >> 24) & 0xff;
                    moovArr[idx+1] = (newVal >> 16) & 0xff;
                    moovArr[idx+2] = (newVal >> 8) & 0xff;
                    moovArr[idx+3] = newVal & 0xff;
                }
            }
        }
    }

    // 5. Append 79,272 bytes tail alignment padding
    const paddingTotal = 79272;
    const paddingBuf = new Uint8Array(paddingTotal);
    const unit = [0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00];
    for (let p = 0; p < paddingTotal; p += 8) {
        paddingBuf.set(unit, p);
    }

    const finalResult = new Uint8Array(ftypBox.length + moovArr.length + newMdatBox.length + paddingBuf.length);
    finalResult.set(ftypBox, 0);
    finalResult.set(new Uint8Array(moovArr), ftypBox.length);
    finalResult.set(newMdatBox, ftypBox.length + moovArr.length);
    finalResult.set(paddingBuf, ftypBox.length + moovArr.length + newMdatBox.length);

    return finalResult;
}

// Test on Compress ON file
const compressOnInput = 'C:\\Users\\WAHYU\\Downloads\\PANTAI PANTAI_hd (3).mp4';
const compressOnOutput = 'C:\\Users\\WAHYU\\Downloads\\PANTAI_PANTAI_COMPRESS_ON_PERFECT_BYPASS.mp4';

console.log('Testing Dynamic Patcher on Compress ON file:', compressOnInput);
const inputBuf = fs.readFileSync(compressOnInput);
const patchedBuf = patchMp4V3Dynamic(inputBuf);
fs.writeFileSync(compressOnOutput, patchedBuf);

console.log('✓ Successfully generated:', compressOnOutput);
console.log('Patched File Size:', patchedBuf.length, 'bytes');
