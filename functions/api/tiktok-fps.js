function jsonResponse(data, status = 200, cacheHeader = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheHeader,
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function readFourCC(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

function iterBoxes(bytes, view, start, end, callback) {
  let pos = start;
  while (pos + 8 <= end) {
    let size = view.getUint32(pos, false);
    const type = readFourCC(bytes, pos + 4);
    let headerSize = 8;

    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(view.getBigUint64(pos + 8, false));
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }

    if (!Number.isFinite(size) || size < headerSize) break;
    const boxEnd = Math.min(end, pos + size);
    const stop = callback(type, pos + headerSize, boxEnd, pos, size);
    if (stop === true) break;
    pos += size;
  }
}

function findBox(bytes, view, start, end, targetType) {
  let found = null;
  iterBoxes(bytes, view, start, end, (type, contentStart, contentEnd, boxStart, boxSize) => {
    if (type === targetType) {
      found = { contentStart, contentEnd, boxStart, boxSize };
      return true;
    }
    return false;
  });
  return found;
}

function parseMethodComment(bytes, view, moovStart, moovEnd) {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let comment = "";

  const scanIlst = (start, end) => {
    iterBoxes(bytes, view, start, end, (type, cStart, cEnd) => {
      const isCmt = bytes[cStart - 4] === 0xa9 && type.slice(1) === "cmt";
      const isToo = bytes[cStart - 4] === 0xa9 && type.slice(1) === "too";
      if (!isCmt && !isToo) return false;

      iterBoxes(bytes, view, cStart, cEnd, (subType, dStart, dEnd) => {
        if (subType === "data" && dStart + 8 <= dEnd) {
          const text = decoder.decode(bytes.subarray(dStart + 8, dEnd)).replace(/\0+$/, "").trim();
          if (text && (!comment || isCmt)) {
            comment = text;
          }
        }
        return false;
      });
      return false;
    });
  };

  const udta = findBox(bytes, view, moovStart, moovEnd, "udta");
  if (udta) {
    const meta = findBox(bytes, view, udta.contentStart, udta.contentEnd, "meta");
    if (meta && meta.contentStart + 4 <= meta.contentEnd) {
      const ilst = findBox(bytes, view, meta.contentStart + 4, meta.contentEnd, "ilst");
      if (ilst) scanIlst(ilst.contentStart, ilst.contentEnd);
    }
  }

  return comment;
}

function parseMoov(bytes, view, moovStart, moovEnd) {
  let width = 0;
  let height = 0;
  let fps = 0;
  let duration = 0;

  const mvhd = findBox(bytes, view, moovStart, moovEnd, "mvhd");
  if (mvhd && mvhd.contentStart + 20 <= mvhd.contentEnd) {
    const ver = bytes[mvhd.contentStart];
    const timescale = ver === 1
      ? view.getUint32(mvhd.contentStart + 20, false)
      : view.getUint32(mvhd.contentStart + 12, false);
    const durVal = ver === 1 && mvhd.contentStart + 32 <= mvhd.contentEnd
      ? Number(view.getBigUint64(mvhd.contentStart + 24, false))
      : view.getUint32(mvhd.contentStart + 16, false);
    if (timescale > 0 && durVal > 0 && durVal < 0xffffffff) {
      const secs = Math.round(durVal / timescale);
      if (secs > 0 && secs < 86400) duration = secs;
    }
  }

  iterBoxes(bytes, view, moovStart, moovEnd, (type, trakStart, trakEnd) => {
    if (type !== "trak") return false;

    const mdia = findBox(bytes, view, trakStart, trakEnd, "mdia");
    if (!mdia) return false;

    const hdlr = findBox(bytes, view, mdia.contentStart, mdia.contentEnd, "hdlr");
    if (!hdlr || hdlr.contentStart + 12 > hdlr.contentEnd) return false;
    const handlerType = readFourCC(bytes, hdlr.contentStart + 8);
    if (handlerType !== "vide") return false;

    // 1. Resolution from tkhd
    const tkhd = findBox(bytes, view, trakStart, trakEnd, "tkhd");
    if (tkhd) {
      const ver = bytes[tkhd.contentStart];
      const wOff = ver === 1 ? tkhd.contentStart + 88 : tkhd.contentStart + 76;
      const hOff = ver === 1 ? tkhd.contentStart + 92 : tkhd.contentStart + 80;
      if (hOff + 4 <= tkhd.contentEnd) {
        const w = Math.round(view.getUint32(wOff, false) / 65536);
        const h = Math.round(view.getUint32(hOff, false) / 65536);
        if (w > 0 && h > 0 && w < 16000 && h < 16000) {
          width = w;
          height = h;
        }
      }
    }

    // 2. FPS from mdhd + stts
    const mdhd = findBox(bytes, view, mdia.contentStart, mdia.contentEnd, "mdhd");
    let timescale = 0;
    if (mdhd && mdhd.contentStart + 16 <= mdhd.contentEnd) {
      const ver = bytes[mdhd.contentStart];
      timescale = ver === 1 && mdhd.contentStart + 24 <= mdhd.contentEnd
        ? view.getUint32(mdhd.contentStart + 20, false)
        : view.getUint32(mdhd.contentStart + 12, false);
    }

    const minf = findBox(bytes, view, mdia.contentStart, mdia.contentEnd, "minf");
    const stbl = minf ? findBox(bytes, view, minf.contentStart, minf.contentEnd, "stbl") : null;

    // Fallback to stsd visual sample entry dimensions if tkhd was 0
    if ((!width || !height) && stbl) {
      const stsd = findBox(bytes, view, stbl.contentStart, stbl.contentEnd, "stsd");
      if (stsd && stsd.contentStart + 16 <= stsd.contentEnd) {
        iterBoxes(bytes, view, stsd.contentStart + 8, stsd.contentEnd, (_entryType, eStart, eEnd) => {
          if (eStart + 32 <= eEnd) {
            const w = view.getUint16(eStart + 24, false);
            const h = view.getUint16(eStart + 26, false);
            if (w > 0 && h > 0 && w < 16000 && h < 16000) {
              width = w;
              height = h;
              return true;
            }
          }
          return false;
        });
      }
    }

    if (stbl && timescale > 0) {
      const stts = findBox(bytes, view, stbl.contentStart, stbl.contentEnd, "stts");
      if (stts && stts.contentStart + 8 <= stts.contentEnd) {
        const entryCount = view.getUint32(stts.contentStart + 4, false);
        let totalSamples = 0;
        let totalDelta = 0;
        let offset = stts.contentStart + 8;
        for (let i = 0; i < entryCount && offset + 8 <= stts.contentEnd; i++) {
          const count = view.getUint32(offset, false);
          const delta = view.getUint32(offset + 4, false);
          if (count > 0 && delta > 0) {
            totalSamples += count;
            totalDelta += count * delta;
          }
          offset += 8;
        }
        if (totalSamples > 0 && totalDelta > 0) {
          const avgFps = (totalSamples * timescale) / totalDelta;
          const rounded = Math.round(avgFps * 100) / 100;
          if (rounded > 0 && rounded < 300) {
            fps = Math.abs(rounded - Math.round(rounded)) < 0.05 ? Math.round(rounded) : rounded;
          }
        }
      }
    }

    return true;
  });

  const comment = parseMethodComment(bytes, view, moovStart, moovEnd);
  return { width, height, fps, duration, comment };
}

function parseTotalSizeFromContentRange(headerVal) {
  if (!headerVal) return 0;
  const match = String(headerVal).match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function readLimitedBytes(res, maxBytes) {
  if (!res.body || typeof res.body.getReader !== "function") {
    return await res.arrayBuffer();
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remain = maxBytes - total;
      const slice = value.byteLength > remain ? value.subarray(0, remain) : value;
      chunks.push(slice);
      total += slice.byteLength;
    }
  } finally {
    try { await reader.cancel(); } catch (_) {}
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}

async function fetchRange(url, start, end) {
  const res = await fetch(url, {
    headers: {
      Range: `bytes=${start}-${end}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`HTTP ${res.status} saat membaca stream video.`);
  }
  const maxBytes = Math.max(65536, (end - start) + 1);
  const totalSize = parseTotalSizeFromContentRange(res.headers.get("content-range"))
    || Number(res.headers.get("content-length") || 0);
  const buf = res.status === 206
    ? await res.arrayBuffer()
    : await readLimitedBytes(res, maxBytes);
  return { buf, totalSize };
}

export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const streamUrl = (reqUrl.searchParams.get("url") || "").trim();

  if (!streamUrl || !/^https?:\/\//i.test(streamUrl)) {
    return jsonResponse({ error: "URL stream video tidak valid." }, 400);
  }

  try {
    const headChunk = await fetchRange(streamUrl, 0, 262143);
    const totalSize = headChunk.totalSize || headChunk.buf.byteLength;
    const headBytes = new Uint8Array(headChunk.buf);
    const headView = new DataView(headChunk.buf);

    let moovBox = null;
    let mdatEnd = 0;

    iterBoxes(headBytes, headView, 0, headBytes.length, (type, cStart, cEnd, boxStart, boxSize) => {
      if (type === "moov") {
        moovBox = { boxStart, boxSize, cStart, cEnd, inHead: boxStart + boxSize <= headBytes.length };
        return true;
      }
      if (type === "mdat") {
        mdatEnd = boxStart + boxSize;
      }
      return false;
    });

    let moovBytes = headBytes;
    let moovView = headView;
    let moovContentStart = 0;
    let moovContentEnd = 0;

    if (moovBox && moovBox.inHead) {
      moovContentStart = moovBox.cStart;
      moovContentEnd = moovBox.cEnd;
    } else if (moovBox && !moovBox.inHead) {
      const exactMoov = await fetchRange(streamUrl, moovBox.boxStart, moovBox.boxStart + moovBox.boxSize - 1);
      moovBytes = new Uint8Array(exactMoov.buf);
      moovView = new DataView(exactMoov.buf);
      const found = findBox(moovBytes, moovView, 0, moovBytes.length, "moov");
      if (found) {
        moovContentStart = found.contentStart;
        moovContentEnd = found.contentEnd;
      }
    } else if (mdatEnd > 0 && mdatEnd < totalSize) {
      const tailStart = mdatEnd;
      const tailEnd = Math.min(totalSize - 1, tailStart + 524287);
      const tailChunk = await fetchRange(streamUrl, tailStart, tailEnd);
      moovBytes = new Uint8Array(tailChunk.buf);
      moovView = new DataView(tailChunk.buf);
      const found = findBox(moovBytes, moovView, 0, moovBytes.length, "moov");
      if (found) {
        moovContentStart = found.contentStart;
        moovContentEnd = found.contentEnd;
      }
    } else if (totalSize > 262144) {
      const tailStart = Math.max(0, totalSize - 524288);
      const tailChunk = await fetchRange(streamUrl, tailStart, totalSize - 1);
      moovBytes = new Uint8Array(tailChunk.buf);
      moovView = new DataView(tailChunk.buf);
      const idx = moovBytes.findIndex((_, i) =>
        i + 4 <= moovBytes.length &&
        moovBytes[i] === 0x6d && moovBytes[i + 1] === 0x6f && moovBytes[i + 2] === 0x6f && moovBytes[i + 3] === 0x76
      );
      if (idx >= 4) {
        moovContentStart = idx + 4;
        moovContentEnd = moovBytes.length;
      }
    }

    if (!moovContentEnd) {
      return jsonResponse({ error: "Atom moov MP4 tidak ditemukan." }, 422);
    }

    const parsed = parseMoov(moovBytes, moovView, moovContentStart, moovContentEnd);
    return jsonResponse(
      {
        fps: parsed.fps,
        width: parsed.width,
        height: parsed.height,
        duration: parsed.duration,
        size: totalSize,
        comment: parsed.comment
      },
      200,
      "public, max-age=300, s-maxage=1800"
    );
  } catch (err) {
    return jsonResponse({ error: (err && err.message) || "Gagal memeriksa stream video." }, 502);
  }
}
