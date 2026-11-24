(function () {
  'use strict';

  function parseFpsFromMp4(buffer) {
    try {
      const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      if (window.OriginalMp4Core && typeof window.OriginalMp4Core.inspectMediaInfo === 'function') {
        try {
          const info = window.OriginalMp4Core.inspectMediaInfo(data);
          if (info && info.averageFps > 0 && info.averageFps < 300) {
            return Math.round(info.averageFps);
          }
        } catch (_) {}
      }
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i < data.length - 8; i++) {
        if (data[i] === 0x76 && data[i + 1] === 0x69 && data[i + 2] === 0x64 && data[i + 3] === 0x65) {
          const sStart = Math.max(0, i - 300);
          const sEnd = Math.min(data.length, i + 65536);
          let ts = 0;
          let totalSamples = 0;
          let totalDelta = 0;
          for (let j = sStart; j < sEnd - 8; j++) {
            if (data[j] === 0x6d && data[j + 1] === 0x64 && data[j + 2] === 0x68 && data[j + 3] === 0x64) {
              const ver = view.getUint8(j + 4);
              ts = ver === 1 ? view.getUint32(j + 24) : view.getUint32(j + 16);
            }
            if (data[j] === 0x73 && data[j + 1] === 0x74 && data[j + 2] === 0x74 && data[j + 3] === 0x73) {
              const ec = view.getUint32(j + 8);
              if (ec > 0 && ec <= 4096) {
                totalSamples = 0;
                totalDelta = 0;
                for (let k = 0; k < ec; k++) {
                  const off = j + 12 + k * 8;
                  if (off + 8 > sEnd) break;
                  const cnt = view.getUint32(off);
                  const dlt = view.getUint32(off + 4);
                  totalSamples += cnt;
                  totalDelta += cnt * dlt;
                }
              }
            }
            if (ts > 0 && totalSamples > 0 && totalDelta > 0) {
              const f = Math.round((totalSamples * ts) / totalDelta);
              if (f > 0 && f < 300) return f;
            }
          }
        }
      }
    } catch (_) {}
    return 60;
  }

  function parseResolutionFromMp4(buffer) {
    try {
      const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i < data.length - 8; i++) {
        if (data[i] === 0x74 && data[i + 1] === 0x6b && data[i + 2] === 0x68 && data[i + 3] === 0x64) {
          const ver = view.getUint8(i + 4);
          const wOff = ver === 1 ? i + 92 : i + 80;
          const hOff = ver === 1 ? i + 96 : i + 84;
          if (hOff + 4 <= data.byteLength) {
            let w = Math.round(view.getUint32(wOff) / 65536);
            let h = Math.round(view.getUint32(hOff) / 65536);
            const matOff = ver === 1 ? (i - 4) + 60 : (i - 4) + 48;
            if (matOff + 36 <= data.byteLength && w > 0 && h > 0) {
              const m0 = view.getInt32(matOff, false) / 65536;
              const m4 = view.getInt32(matOff + 16, false) / 65536;
              if (Math.abs(m0) < 0.5 && Math.abs(m4) < 0.5) {
                const tmp = w;
                w = h;
                h = tmp;
              }
            }
            if (w > 0 && h > 0 && w < 16000 && h < 16000) return { width: w, height: h };
          }
        }
      }
    } catch (_) {}
    return { width: 1080, height: 1920 };
  }

  function computeVideoProcessingOptions(w, h, fps, fileMB, mode) {
    let targetW = w || 1080;
    let targetH = h || 1920;
    const qualityShortSide = mode === '720p' ? 720 : (mode === '1080p' ? 1080 : null);
    if (qualityShortSide) {
      const shortSide = Math.min(targetW, targetH);
      if (shortSide > 0) {
        const ratio = qualityShortSide / shortSide;
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }
    }
    targetW = Math.floor(targetW / 2) * 2;
    targetH = Math.floor(targetH / 2) * 2;
    return {
      width: targetW,
      height: targetH,
      vfString: 'scale=' + targetW + ':' + targetH + ':force_original_aspect_ratio=decrease:flags=lanczos,pad=' + targetW + ':' + targetH + ':(ow-iw)/2:(oh-ih)/2,format=yuv420p'
    };
  }

  function checkVideoLimits(specs, compressCfg) {
    const cfg = compressCfg || {};
    const maxShortSide = Number(cfg.maxShortSide) || 1080;
    const maxFps = Number(cfg.maxFps) || 60;
    const maxBitrateMbps = Number(cfg.maxBitrateMbps) || 50;

    const w = Number(specs?.width) || 0;
    const h = Number(specs?.height) || 0;
    const fps = Number(specs?.fps) || 0;
    const size = Number(specs?.size) || 0;
    const duration = Number(specs?.duration) || 0;

    const shortSide = (w > 0 && h > 0) ? Math.min(w, h) : 0;
    const bitrateMbps = (duration > 0 && size > 0) ? (size * 8) / (duration * 1000000) : 0;

    const reasons = [];
    if (shortSide > maxShortSide) reasons.push(`${w}x${h} (>${maxShortSide}p)`);
    if (fps > maxFps) reasons.push(`${fps} FPS (>${maxFps} FPS)`);
    if (bitrateMbps > maxBitrateMbps) reasons.push(`${bitrateMbps.toFixed(1)} Mbps (>${maxBitrateMbps} Mbps)`);

    return {
      width: w,
      height: h,
      fps,
      bitrateMbps,
      maxShortSide,
      maxFps,
      maxBitrateMbps,
      exceedsLimit: reasons.length > 0,
      reasons,
      limitText: reasons.length > 0
        ? `Video melebihi batas (maks ${maxShortSide}p, ${maxFps} FPS, ${maxBitrateMbps} Mbps): ${reasons.join(', ')}. Compression diaktifkan otomatis.`
        : ''
    };
  }

  async function runPipeline(opts) {
    const {
      file,
      buffer,
      methodId = 'fish',
      compressMode = 'off',
      doBypass = true,
      compressCfg = null,
      _tktk = window._tktk,
      onProgress = () => {},
      log = () => {}
    } = opts || {};

    const items = (window.TikTokMethods && Array.isArray(window.TikTokMethods._items))
      ? window.TikTokMethods._items
      : [];
    const targetId = String(methodId || 'fish').toLowerCase();
    const activeMethod = items.find((m) =>
      m.id === targetId || (Array.isArray(m.aliases) && m.aliases.includes(targetId))
    ) || null;

    if (doBypass && (!activeMethod || typeof activeMethod.patch !== 'function')) {
      throw new Error(`Engine method "${targetId}" is not loaded.`);
    }

    const inputU8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const origSize = inputU8.byteLength;
    const res = parseResolutionFromMp4(inputU8);
    const fps = parseFpsFromMp4(inputU8);
    const limits = checkVideoLimits({
      width: res.width,
      height: res.height,
      fps,
      size: file?.size || origSize,
      duration: Number(opts?.duration) || 0
    }, compressCfg);

    const supportsCompress = !doBypass || !activeMethod || activeMethod.supportsCompress !== false;
    let effectiveCompress = compressMode || 'off';
    if (!supportsCompress) {
      effectiveCompress = 'off';
    } else if (limits.exceedsLimit && effectiveCompress === 'off') {
      effectiveCompress = (compressCfg && compressCfg.defaultCompressMode) || '1080p';
    }

    let workingBuffer = inputU8.buffer.slice(inputU8.byteOffset, inputU8.byteOffset + inputU8.byteLength);
    let skippedLarger = false;

    if (effectiveCompress !== 'off' && typeof window.compressVideo === 'function') {
      onProgress(10, `Compressing (${effectiveCompress.toUpperCase()})...`);
      const compRes = await window.compressVideo(file, effectiveCompress, workingBuffer);
      const compU8 = compRes instanceof Uint8Array ? compRes : new Uint8Array(compRes);
      if (compU8.byteLength >= origSize && !limits.exceedsLimit) {
        skippedLarger = true;
      } else {
        workingBuffer = compU8.buffer.slice(compU8.byteOffset, compU8.byteOffset + compU8.byteLength);
      }
    }

    if (doBypass && activeMethod) {
      if (typeof window.normalizeClip === 'function') {
        onProgress(78, 'Normalizing MP4 stream...');
        workingBuffer = await window.normalizeClip(file, workingBuffer, {
          isCompressed: effectiveCompress !== 'off',
          remuxFaststart: Boolean(activeMethod.remuxFaststart),
          handlesOwn60FpsSlowmo: Boolean(activeMethod.handlesOwn60FpsSlowmo),
          log
        });
      }

      onProgress(90, `Applying ${activeMethod.name || targetId}...`);
      let patchResult;
      try {
        patchResult = await activeMethod.patch(workingBuffer, {
          file,
          mode: effectiveCompress,
          watermark: opts?.watermark || '',
          log,
          _tktk
        });
      } catch (patchErr) {
        if (typeof window.remuxFaststart === 'function') {
          workingBuffer = await window.remuxFaststart(file, workingBuffer);
          patchResult = await activeMethod.patch(workingBuffer, {
            file,
            mode: effectiveCompress,
            watermark: opts?.watermark || '',
            log,
            _tktk
          });
        } else {
          throw patchErr;
        }
      }

      if (patchResult && !(patchResult instanceof Uint8Array) && !(patchResult instanceof ArrayBuffer) && patchResult.bytes) {
        workingBuffer = patchResult.bytes;
      } else if (patchResult) {
        workingBuffer = patchResult;
      }
    }

    const finalU8 = workingBuffer instanceof Uint8Array ? workingBuffer : new Uint8Array(workingBuffer);
    onProgress(100, 'Done');
    return {
      bytes: finalU8,
      origSize,
      outSize: finalU8.byteLength,
      effectiveCompress,
      skippedLarger,
      limits,
      methodName: activeMethod?.name || targetId.toUpperCase(),
      outputOptions: activeMethod?.outputOptions || 'hd'
    };
  }

  window.CutefishMethodEngine = {
    parseFpsFromMp4,
    parseResolutionFromMp4,
    computeVideoProcessingOptions,
    checkVideoLimits,
    runPipeline
  };
})();
