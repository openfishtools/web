require('dotenv').config();

// Register Vercel OpenTelemetry for serverless function monitoring
try {
    const { registerOTel } = require('@vercel/otel');
    registerOTel({ serviceName: 'chros-api' });
} catch (e) {
    console.warn('Vercel OTel registration skipped:', e.message);
}

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const Admin = require('./models/Admin');
const Session = require('./models/Session');

const app = express();
app.use(cors());
app.use(express.json());

// Set security headers for cross-origin resources
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

// Priority: serve obfuscated frontend scripts from dist/scripts if built
const distScriptsPath = path.join(__dirname, '..', 'dist', 'scripts');
if (fs.existsSync(distScriptsPath)) {
    app.use('/scripts', express.static(distScriptsPath));
}
app.use(express.static(path.join(__dirname, '..')));

function getDynamicBuildInfo() {
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7) : null;
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ? process.env.VERCEL_DEPLOYMENT_ID.substring(0, 7) : null;

    let buildDateObj = null;
    if (process.env.VERCEL_BUILD_TIME) {
        const t = Number(process.env.VERCEL_BUILD_TIME);
        if (!isNaN(t) && t > 0) buildDateObj = new Date(t);
    }

    if (!buildDateObj) {
        try {
            const indexPath = path.join(__dirname, '..', 'index.html');
            const stat = fs.statSync(indexPath);
            buildDateObj = stat.mtime;
        } catch (e) {
            buildDateObj = new Date();
        }
    }

    const version = commitSha || deploymentId || `dev-${Math.floor(buildDateObj.getTime())}`;

    const optionsId = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        timeZone: 'Asia/Jakarta'
    };

    const optionsEn = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        timeZone: 'Asia/Jakarta'
    };

    let buildDateId = '';
    let buildDateEn = '';

    try {
        buildDateId = buildDateObj.toLocaleString('id-ID', optionsId);
        buildDateEn = buildDateObj.toLocaleString('en-US', optionsEn);
    } catch (e) {
        buildDateId = buildDateObj.toISOString();
        buildDateEn = buildDateObj.toISOString();
    }

    return {
        version,
        timestamp: buildDateObj.getTime(),
        buildDateId,
        buildDateEn,
        buildDateIso: buildDateObj.toISOString()
    };
}

// API version endpoint for client auto-update and cache invalidation
app.get('/api/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(getDynamicBuildInfo());
});

// Proxy /realesrgan requests to target model host directly
app.get('/realesrgan/*', async (req, res) => {
    try {
        const targetUrl = `https://upscale.chino.icu${req.originalUrl}`;
        const proxyRes = await fetch(targetUrl);
        if (!proxyRes.ok) {
            return res.status(proxyRes.status).send(`Proxy error: ${proxyRes.statusText}`);
        }
        const buffer = await proxyRes.arrayBuffer();
        const contentType = proxyRes.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).send(`Proxy failed: ${err.message}`);
    }
});

app.get('/:id([a-fA-F0-9]{24}|\\d+)', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});


const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

async function requireAdmin(req, res, next) {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    try {
        const session = await Session.findOne({ token });
        if (!session || session.expiresAt < new Date()) {
            if (session) await Session.deleteOne({ token });
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await Session.updateOne({ token }, { expiresAt: new Date(Date.now() + ADMIN_SESSION_MS) });
        next();
    } catch (err) {
        res.status(500).json({ error: 'Auth check failed' });
    }
}

let cachedDb = null;
let backfilledPresetIds = false;
async function ensurePresetIds() {
    if (backfilledPresetIds) return;
    try {
        const missing = await Preset.find({ presetId: { $exists: false } }).sort({ _id: 1 });
        if (missing.length > 0) {
            const maxItem = await Preset.findOne({ presetId: { $exists: true } }).sort({ presetId: -1 });
            let currentId = maxItem && typeof maxItem.presetId === 'number' ? maxItem.presetId : 0;
            for (const doc of missing) {
                currentId++;
                await Preset.updateOne({ _id: doc._id }, { $set: { presetId: currentId } });
            }
        }
        backfilledPresetIds = true;
    } catch (e) {}
}
async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const db = await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = db;
    await ensurePresetIds();
    return db;
}

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

const SocialSchema = new mongoose.Schema({
    name: String,
    url: String,
    icon: String,
    order: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false }
});
const Social = mongoose.models.Social || mongoose.model('Social', SocialSchema);

const ContactSchema = new mongoose.Schema({
    name: String,
    url: String,
    icon: String,
    order: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false }
});
const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

const PresetSchema = new mongoose.Schema({
    presetId: { type: Number, unique: true, sparse: true },
    name: String,
    software: [String],
    type: String,
    version: String,
    media: String,
    plugin: String,
    size: String,
    url: String,
    urls: [{ sw: String, url: String }],
    likes: { type: Number, default: 0 },
    amPremiumUrl: String,
    am5MbUrl: String,
    amXmlUrl: String,
    amXmlExtras: [{ label: String, url: String }],
    order: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false }
});
const Preset = mongoose.models.Preset || mongoose.model('Preset', PresetSchema);

const ResourceSchema = new mongoose.Schema({
    title: String,
    category: { type: mongoose.Schema.Types.Mixed, default: [] },
    dev: String,
    instruction: String,
    icon: String,
    info: String,
    os: { type: mongoose.Schema.Types.Mixed, default: [] },
    version: String,
    url: String,
    order: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false }
});
const Resource = mongoose.models.Resource || mongoose.model('Resource', ResourceSchema);

const LikeSchema = new mongoose.Schema({
    presetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preset' },
    ip: String,
    timestamp: { type: Date, default: Date.now }
});
const Like = mongoose.models.Like || mongoose.model('Like', LikeSchema);

function parseVideoMetadataFromBuffer(buffer) {
    let moovOffset = -1;
    for (let i = 0; i < buffer.byteLength - 8; i++) {
        if (buffer[i+4] === 0x6D && buffer[i+5] === 0x6F && buffer[i+6] === 0x6F && buffer[i+7] === 0x76) {
            moovOffset = i;
            break;
        }
    }
    
    if (moovOffset === -1) return null;
    
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const moovSize = view.getUint32(moovOffset);
    
    function findBox(start, max, target) {
        let offset = start;
        while (offset < max - 8) {
            const size = view.getUint32(offset);
            if (size <= 0 || offset + size > max) break;
            const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
            if (type === target) return { offset, size };
            if (['trak', 'mdia', 'minf', 'stbl'].includes(type)) {
                const res = findBox(offset + 8, offset + size, target);
                if (res) return res;
            }
            offset += size;
        }
        return null;
    }
    
    function findBoxAny(start, max, target) {
        let offset = start;
        while (offset < max - 8) {
            const size = view.getUint32(offset);
            if (size <= 0 || offset + size > max) break;
            const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
            if (type === target) return { offset, size };
            offset += size;
        }
        return null;
    }
    
    function extractTextFromBox(boxOffset, boxSize) {
        const headerEnd = boxOffset + 8;
        const payloadStart = headerEnd + 4;
        const payloadEnd = boxOffset + boxSize;
        if (payloadStart >= payloadEnd) return '';
        const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset + payloadStart, payloadEnd - payloadStart);
        let str = '';
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] >= 0x20 && bytes[i] < 0x7F) str += String.fromCharCode(bytes[i]);
        }
        return str.trim();
    }
    
    function extractCommentFromILST(ilstOffset, ilstSize) {
        const ilstPriority = ['\u00A9cmt', '\u00A9ART', '\u00A9grp'];
        const ilstExtra = ['\u00A9desc', '\u00A9name', '\u00A9atom'];
        const vals = {};

        function readItemValue(item) {
            const data = findBoxAny(item.offset + 8, item.offset + item.size, 'data');
            if (!data) return '';
            const dEnd = data.offset + data.size;
            const dPayload = data.offset + 16;
            if (dPayload >= dEnd) return '';
            const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset + dPayload, dEnd - dPayload);
            let value = '';
            for (let i = 0; i < bytes.length; i++) {
                if (bytes[i] >= 0x20 && bytes[i] < 0x7F) value += String.fromCharCode(bytes[i]);
            }
            return value.trim();
        }

        for (const k of [...ilstPriority, ...ilstExtra]) {
            const item = findBoxAny(ilstOffset + 8, ilstOffset + ilstSize, k);
            if (item) {
                const value = readItemValue(item);
                if (value) vals[k] = value;
            }
        }

        let offset = ilstOffset + 8;
        while (offset < ilstOffset + ilstSize - 8) {
            const size = view.getUint32(offset);
            if (size <= 0 || offset + size > ilstOffset + ilstSize) break;
            const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
            if (!vals[type]) {
                const value = readItemValue({ offset, size });
                if (value) vals[type] = value;
            }
            offset += size;
        }

        const domainRe = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))/i;
        for (const k of ilstPriority) {
            if (vals[k]) {
                const m = vals[k].match(domainRe);
                if (m) return m[1];
            }
        }
        for (const k of ilstPriority) {
            if (vals[k]) return vals[k];
        }
        for (const k of ilstExtra) {
            if (vals[k]) return vals[k];
        }
        for (const value of Object.values(vals)) {
            if (value && !/^Lavf/i.test(value) && !/^FFmpeg/i.test(value) && !/^HandBrake/i.test(value)) return value;
        }
        return '';
    }
    let width = 0;
    let height = 0;
    let comment = '';
    
    let offset = moovOffset + 8;
    while (offset < moovOffset + moovSize - 8) {
        const size = view.getUint32(offset);
        if (size <= 0 || offset + size > moovOffset + moovSize) break;
        const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
        
        if (type === 'trak') {
            const hdlr = findBox(offset + 8, offset + size, 'hdlr');
            if (hdlr) {
                const hdlrType = String.fromCharCode(view.getUint8(hdlr.offset + 16), view.getUint8(hdlr.offset + 17), view.getUint8(hdlr.offset + 18), view.getUint8(hdlr.offset + 19));
                if (hdlrType === 'vide') {
                    const tkhd = findBox(offset + 8, offset + size, 'tkhd');
                    if (tkhd) {
                        const version = view.getUint8(tkhd.offset + 8);
                        let wOffset = tkhd.offset + 8 + (version === 1 ? 84 : 76);
                        width = view.getUint16(wOffset);
                        height = view.getUint16(wOffset + 4);
                    }
                    
                    const mdhd = findBox(offset + 8, offset + size, 'mdhd');
                    const stsz = findBox(offset + 8, offset + size, 'stsz');
                    
                    if (mdhd && stsz) {
                        const mdhdVersion = view.getUint8(mdhd.offset + 8);
                        let timescale = mdhdVersion === 1 ? view.getUint32(mdhd.offset + 28) : view.getUint32(mdhd.offset + 20);
                        let duration = mdhdVersion === 1 ? Number(view.getBigUint64(mdhd.offset + 32)) : view.getUint32(mdhd.offset + 24);
                        const sampleCount = view.getUint32(stsz.offset + 16);
                        
                        if (duration > 0 && sampleCount > 0 && timescale > 0) {
                            const durationInSeconds = duration / timescale;
                            const rawFps = sampleCount / durationInSeconds;
                            fps = Math.round(rawFps * 1000) / 1000;
                        }
                    }
                }
            }
        }
        
        if (type === 'udta' && !comment) {
            const udtaEnd = offset + size;
            let uOff = offset + 8;
            while (uOff < udtaEnd - 8) {
                const uSize = view.getUint32(uOff);
                if (uSize <= 0 || uOff + uSize > udtaEnd) break;
                const uType = String.fromCharCode(view.getUint8(uOff + 4), view.getUint8(uOff + 5), view.getUint8(uOff + 6), view.getUint8(uOff + 7));
                if (['desc', 'cmt', 'name', 'labl'].includes(uType)) {
                    comment = extractTextFromBox(uOff, uSize);
                    if (comment) break;
                }
                if (uType === 'meta') {
                    const ilst = findBoxAny(uOff + 12, uOff + uSize, 'ilst');
                    if (ilst) {
                        const cmt = extractCommentFromILST(ilst.offset, ilst.size);
                        if (cmt) { comment = cmt; break; }
                    }
                }
                uOff += uSize;
            }
        }
        
        offset += size;
    }
    
    if (!comment) {
        let tOff = 0;
        while (tOff < buffer.byteLength - 8) {
            const tSize = view.getUint32(tOff);
            if (tSize <= 0 || tOff + tSize > buffer.byteLength) break;
            const tType = String.fromCharCode(view.getUint8(tOff + 4), view.getUint8(tOff + 5), view.getUint8(tOff + 6), view.getUint8(tOff + 7));
            if (tType === 'udta') {
                const udtaEnd = tOff + tSize;
                let uOff = tOff + 8;
                while (uOff < udtaEnd - 8) {
                    const uSize = view.getUint32(uOff);
                    if (uSize <= 0 || uOff + uSize > udtaEnd) break;
                    const uType = String.fromCharCode(view.getUint8(uOff + 4), view.getUint8(uOff + 5), view.getUint8(uOff + 6), view.getUint8(uOff + 7));
                    if (['desc', 'cmt', 'name', 'labl'].includes(uType)) {
                        comment = extractTextFromBox(uOff, uSize);
                        if (comment) break;
                    }
                    if (uType === 'meta') {
                        const ilst = findBoxAny(uOff + 12, uOff + uSize, 'ilst');
                        if (ilst) {
                            const cmt = extractCommentFromILST(ilst.offset, ilst.size);
                            if (cmt) { comment = cmt; break; }
                        }
                    }
                    uOff += uSize;
                }
                if (comment) break;
            }
            tOff += tSize;
        }
    }
    
    return { fps, width, height, comment };
}

app.get('/api/get-ip', (req, res) => {
    res.json({ ip: getClientIp(req) });
});

app.get('/api/tiktok-fps', async (req, res) => {
    const url = req.query.url;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url' });
    }

    if (!isAllowedTikTokMediaUrl(url)) {
        return res.json({ fps: null, width: 0, height: 0, comment: '' });
    }

    try {
        let response = await fetch(url, {
            headers: { 'Range': 'bytes=0-2097151', 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok && response.status !== 206) {
            return res.json({ fps: null, width: 0, height: 0, comment: '' });
        }

        let buffer = Buffer.from(await response.arrayBuffer());
        let meta = parseVideoMetadataFromBuffer(buffer);

        if (!meta) {
            response = await fetch(url, {
                headers: { 'Range': 'bytes=-2097152', 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(5000)
            });
            if (response.ok || response.status === 206) {
                buffer = Buffer.from(await response.arrayBuffer());
                meta = parseVideoMetadataFromBuffer(buffer);
            }
        }

        res.json(meta || { fps: null, width: 0, height: 0, comment: '' });
    } catch (e) {
        res.json({ fps: null, width: 0, height: 0, comment: '' });
    }
});

function isAllowedTikTokResolveHost(hostname) {
    const h = String(hostname).toLowerCase();
    return (
        h === 'tiktok.com' ||
        h === 'www.tiktok.com' ||
        h === 'm.tiktok.com' ||
        h === 'vm.tiktok.com' ||
        h === 'vt.tiktok.com' ||
        h === 'www.tikwm.com' ||
        h === 'tikwm.com'
    );
}

function isAllowedTikTokMediaUrl(rawUrl) {
    try {
        const hostname = new URL(rawUrl).hostname.toLowerCase();
        const suffixes = ['tiktok.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com', 'tikwm.com', 'tikcdn.io', 'ssstik.io', 'tikwmapi.com', 'ibytedtos.com', 'byteoversea.com', 'muscdn.com'];
        return suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
    } catch {
        return false;
    }
}

async function extractFromSSSTik(pageUrl) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const homeController = new AbortController();
            const homeTimeout = setTimeout(() => homeController.abort(), 5000);
            
            const homeRes = await fetch('https://ssstik.io/en', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                signal: homeController.signal
            });
            clearTimeout(homeTimeout);
            
            const homeHtml = await homeRes.text();
            const ttMatch = homeHtml.match(/s_tt\s*=\s*["']([^"']+)["']/i) || homeHtml.match(/name="tt"\s+value="([^"]+)"/i);
            const tt = ttMatch ? ttMatch[1] : '1';

            let cookieHeader = '';
            if (typeof homeRes.headers.getSetCookie === 'function') {
                cookieHeader = homeRes.headers.getSetCookie().join('; ');
            } else {
                cookieHeader = homeRes.headers.get('set-cookie') || '';
            }

            const dlController = new AbortController();
            const dlTimeout = setTimeout(() => dlController.abort(), 5000);

            const fetchHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://ssstik.io/en',
                'Origin': 'https://ssstik.io'
            };
            if (cookieHeader) fetchHeaders['Cookie'] = cookieHeader;

            const res = await fetch('https://ssstik.io/abc?url=dl', {
                method: 'POST',
                headers: fetchHeaders,
                body: new URLSearchParams({ id: pageUrl, locale: 'en', tt: tt }),
                signal: dlController.signal
            });
            clearTimeout(dlTimeout);

            if (res.ok) {
                const html = await res.text();
                const downloadMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*class="[^\"]*without_watermark/i) || 
                                      html.match(/href="(https:\/\/[^"]+)"[^>]*download/i) ||
                                      html.match(/href="(https:\/\/tikcdn\.io\/[^\"]+)"/i);

                if (downloadMatch) {
                    const playUrl = downloadMatch[1];
                    const hdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*class="[^\"]*direct/i);
                    const coverMatch = html.match(/class="result_author"[^>]*src="([^"]+)"/i);
                    const nicknameMatch = html.match(/<h2>([^<]+)<\/h2>/i);
                    const titleMatch = html.match(/<p class="maintext">([^<]*)<\/p>/i);
                    const videoIdMatch = pageUrl.match(/\/video\/(\d+)/);
                    const authorHandleMatch = pageUrl.match(/@([a-zA-Z0-9._-]+)/);

                    return {
                        id: videoIdMatch ? videoIdMatch[1] : '',
                        play: playUrl,
                        hdplay: hdMatch ? hdMatch[1] : playUrl,
                        wmplay: '',
                        cover: '', // Do NOT use SSSTik avatar picture as video cover!
                        author_avatar: coverMatch ? coverMatch[1] : '',
                        title: titleMatch ? titleMatch[1].trim() : '',
                        author_unique_id: authorHandleMatch ? authorHandleMatch[1] : '',
                        author_nickname: nicknameMatch ? nicknameMatch[1].trim() : '',
                        size: 0,
                        duration: 0,
                        w: 0,
                        h: 0,
                        is_fallback: false,
                        method: 'ssstik'
                    };
                }
            }
        } catch (e) {
            console.error(`[SSSTik Extract Attempt ${attempt}] Error:`, e.message);
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 300));
    }
    return null;
}

async function extractTikTokFromPage(pageUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        
        const pageResponse = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!pageResponse.ok) return null;
        
        const html = await pageResponse.text();
        
        const finalUrl = pageResponse.url || pageUrl;
        const urlMatch = finalUrl.match(/\/video\/(\d+)/);
        const videoId = urlMatch ? urlMatch[1] : '';

        // Try to extract from __UNIVERSAL_DATA_FOR_REHYDRATION__
        const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/);
        if (!jsonMatch) return null;
        
        const pageData = JSON.parse(jsonMatch[1]);
        const videoData = pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.videoData;
        
        if (!videoData || (!videoData.downloadAddr && !videoData.playAddr)) {
            return null;
        }
        
        return {
            id: videoId || '',
            play: videoData.downloadAddr || videoData.playAddr || '',
            hdplay: videoData.playAddr || videoData.downloadAddr || '',
            wmplay: '',
            cover: videoData.dynamicCover || videoData.originCover || videoData.cover || '',
            title: pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.desc || '',
            author_unique_id: pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.author?.uniqueId || '',
            author_nickname: pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.author?.nickname || '',
            size: 0,
            duration: videoData.duration || 0,
            w: videoData.width || 0,
            h: videoData.height || 0
        };
    } catch (e) {
        console.error('[TikTok Page Extract] Error:', e.message);
        return null;
    }
}

function normalizeClientIp(raw) {
    if (raw == null) return '';
    let ip = String(raw).trim();
    if (!ip) return '';
    const lower = ip.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        ip = ip.slice(7);
    }
    if (lower === '::1' || ip === '::1') {
        ip = '127.0.0.1';
    }
    return ip;
}

function getClientIp(req) {
    if (req.headers['cf-connecting-ip']) return normalizeClientIp(req.headers['cf-connecting-ip']);
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return normalizeClientIp(String(forwarded).split(',')[0]);
    return normalizeClientIp(req.socket.remoteAddress || '');
}

/**
 * Lightweight in-memory IP rate limiter middleware
 * Protects endpoints against spamming and rate limits
 */
const rateLimitMap = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000).unref?.();

function isThumbnailOrImageUrl(req) {
    const targetUrl = req.query.url;
    if (req.query.type === 'image' || req.query.thumb === '1') return true;
    if (!targetUrl || typeof targetUrl !== 'string') return false;
    if (/\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)(\?|#|$)/i.test(targetUrl)) return true;
    const lower = targetUrl.toLowerCase();
    if (lower.includes('byteoversea') || lower.includes('ibyteimg') || lower.includes('googleusercontent') || lower.includes('wsrv.nl') || lower.includes('imgur') || lower.includes('/obj/') || lower.includes('thumb') || lower.includes('/tos-')) return true;
    return false;
}

function createRateLimiter(options = {}) {
    const windowMs = options.windowMs || 30 * 1000;
    const maxRequests = options.maxRequests || 5;
    const message = options.message || 'Too many requests. Please wait a moment before trying again.';
    const skip = options.skip;

    return (req, res, next) => {
        if (skip && typeof skip === 'function' && skip(req)) {
            return next();
        }

        const ip = getClientIp(req) || 'unknown';
        const routeKey = `${req.path}:${ip}`;
        const now = Date.now();

        let record = rateLimitMap.get(routeKey);
        if (!record || now > record.resetTime) {
            record = { count: 1, resetTime: now + windowMs };
            rateLimitMap.set(routeKey, record);
            return next();
        }

        record.count++;
        if (record.count > maxRequests) {
            const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                error: message,
                details: `Rate limit reached (${maxRequests} reqs / ${Math.round(windowMs / 1000)}s). Please wait ${retryAfterSec} seconds.`,
                retryAfter: retryAfterSec
            });
        }

        next();
    };
}

const tiktokResolveLimiter = createRateLimiter({ windowMs: 30 * 1000, maxRequests: 100, message: 'Rate limit reached: Max 100 video resolve requests per 30 seconds.' });
const proxyLimiter = createRateLimiter({
    windowMs: 30 * 1000,
    maxRequests: 50,
    message: 'Rate limit reached: Max 50 proxy requests per 30 seconds.',
    skip: isThumbnailOrImageUrl
});

const resolvedVideoCache = new Map();
function getCachedResolve(urlKey) {
    const entry = resolvedVideoCache.get(urlKey);
    if (entry && Date.now() < entry.expireAt) {
        return entry.data;
    }
    if (entry) resolvedVideoCache.delete(urlKey);
    return null;
}
function setCachedResolve(urlKey, data) {
    if (data && data.play) {
        resolvedVideoCache.set(urlKey, { data, expireAt: Date.now() + 2 * 3600 * 1000 });
    }
}

app.get('/api/tiktok-resolve', tiktokResolveLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') return res.status(400).json({ error: 'Missing url' });
    let pageUrl = raw.trim();
    let parsed;
    try {
        parsed = new URL(pageUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid url' });
    }
    if (!isAllowedTikTokResolveHost(parsed.hostname)) return res.status(400).json({ error: 'URL host not allowed' });

    const bypassCache = req.query.nocache === '1';
    if (!bypassCache) {
        const cached = getCachedResolve(pageUrl);
        if (cached) {
            console.log(`[TikTok Resolve API] Serving cached SSSTik video stream for: ${pageUrl}`);
            return res.json(cached);
        }
    }

    try {
        let result = null;
        let lastError = null;

        // Method 1: Paid TikWM API (if TIKWM_API_KEY is configured)
        const apiKey = process.env.TIKWM_API_KEY;
        if (apiKey) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                const r = await fetch(`https://tikwmapi.com/api/?key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(pageUrl)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const json = await r.json().catch(() => ({}));
                if (r.ok && json.code === 0 && json.data && (json.data.play || json.data.hdplay)) {
                    const d = json.data;
                    result = {
                        id: d.id || '',
                        play: d.play || d.hdplay || '',
                        hdplay: d.hdplay || '',
                        wmplay: d.wmplay || '',
                        cover: d.cover || d.origin_cover || '',
                        title: d.title || '',
                        author_unique_id: d.author?.unique_id || '',
                        author_nickname: d.author?.nickname || '',
                        size: d.size || 0,
                        duration: d.duration || 0,
                        w: d.w || 0,
                        h: d.h || 0,
                        is_fallback: false,
                        method: 'tikwmapi_key'
                    };
                }
            } catch (e) {
                lastError = `Paid Key: ${e.message}`;
            }
        }

        const isVideoMode = req.query.mode === 'video' || req.query.nocache === '1';

        if (!result) {
            if (isVideoMode) {
                // Video mode: 100% Direct MP4 stream resolution (SSSTik, TikWM, Direct Extract). ZERO oEmbed involved.
                const ssstikTask = extractFromSSSTik(pageUrl).catch(e => { lastError = `SSSTik: ${e.message}`; return null; });
                const pageTask = extractTikTokFromPage(pageUrl).catch(e => { lastError = `PageExtract: ${e.message}`; return null; });
                const tikwmTask = (async () => {
                    const mirrors = [
                        { url: `https://www.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`, method: 'GET' },
                        { url: `https://tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`, method: 'GET' }
                    ];
                    for (const mirror of mirrors) {
                        try {
                            const controller = new AbortController();
                            const timeout = setTimeout(() => controller.abort(), 5000);
                            const r = await fetch(mirror.url, {
                                method: mirror.method,
                                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                                signal: controller.signal
                            });
                            clearTimeout(timeout);
                            const json = await r.json().catch(() => ({}));
                            if (r.ok && json.code === 0 && json.data && (json.data.play || json.data.hdplay)) {
                                const d = json.data;
                                return {
                                    id: d.id || '',
                                    play: d.play || d.hdplay || '',
                                    hdplay: d.hdplay || '',
                                    wmplay: d.wmplay || '',
                                    cover: d.cover || d.origin_cover || '',
                                    title: d.title || '',
                                    author_unique_id: d.author?.unique_id || '',
                                    author_nickname: d.author?.nickname || '',
                                    size: d.size || 0,
                                    duration: d.duration || 0,
                                    w: d.w || 0,
                                    h: d.h || 0,
                                    is_fallback: false,
                                    method: 'tikwm'
                                };
                            }
                        } catch (e) {
                            lastError = `TikWM: ${e.message}`;
                        }
                    }
                    return null;
                })();

                const [ssstikRes, pageRes, tikwmRes] = await Promise.all([ssstikTask, pageTask, tikwmTask]);

                if (ssstikRes && ssstikRes.play) {
                    result = { ...ssstikRes, is_fallback: false, method: 'ssstik' };
                } else if (tikwmRes && tikwmRes.play) {
                    result = { ...tikwmRes, is_fallback: false, method: 'tikwm' };
                } else if (pageRes && pageRes.play) {
                    result = { ...pageRes, is_fallback: false, method: 'direct_extract' };
                }
            } else {
                // Thumbnail image mode: Official oEmbed (Fast 80ms cover image)
                try {
                    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(pageUrl)}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        signal: AbortSignal.timeout(3000)
                    });
                    if (r.ok) {
                        const j = await r.json();
                        if (j && (j.thumbnail_url || j.title)) {
                            result = {
                                id: j.embed_product_id || '',
                                cover: j.thumbnail_url || '',
                                title: j.title || '',
                                author_unique_id: j.author_unique_id || '',
                                author_nickname: j.author_name || '',
                                w: j.thumbnail_width || 0,
                                h: j.thumbnail_height || 0,
                                play: '',
                                hdplay: '',
                                is_fallback: true,
                                method: 'oembed'
                            };
                        }
                    }
                } catch (e) {}
            }
        }

        // If we got a result, return it
        if (result) {
            console.log(`[TikTok Resolve API] Resolved ${pageUrl} -> Method: "${result.method || 'unknown'}" | Stream MP4: ${result.play ? 'AVAILABLE' : 'NONE'}`);
            if (result.play) {
                setCachedResolve(pageUrl, result);
            }
            return res.json(result);
        }

        // All live methods failed
        console.error(`[TikTok Resolve] All methods failed for ${pageUrl}: ${lastError}`);
        return res.status(404).json({ 
            error: 'Video unavailable', 
            details: lastError || 'All mirrors failed or timed out',
            hint: 'Try alternative URL format or video might be private/deleted'
        });
    } catch (err) {
        console.error(`[TikTok Resolve] Unexpected error: ${err.message}`);
        return res.status(500).json({ error: 'Resolve failed', details: err.message });
    }
});

app.get('/api/tiktok-fps', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || typeof videoUrl !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const streamUrl = normalizeProxyUrl(videoUrl);
        const requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://ssstik.io/en'
        };
        
        let contentLength = 0;
        try {
            const headRes = await fetch(streamUrl, {
                method: 'HEAD',
                headers: requestHeaders,
                signal: AbortSignal.timeout(4000)
            });
            contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
        } catch (_) {}

        let durationSec = 0;
        let width = 0;
        let height = 0;
        let fps = 0;

        try {
            const rangeRes = await fetch(streamUrl, {
                headers: {
                    ...requestHeaders,
                    'Range': 'bytes=0-524288'
                },
                signal: AbortSignal.timeout(6000)
            });
            
            if (!contentLength && rangeRes.headers.get('content-range')) {
                const match = rangeRes.headers.get('content-range').match(/\/(\d+)$/);
                if (match) contentLength = parseInt(match[1], 10);
            }

            if (rangeRes.ok) {
                const buffer = Buffer.from(await rangeRes.arrayBuffer());
                
                const mvhdIdx = buffer.indexOf('mvhd');
                let timescale = 0;
                let durationUnits = 0;
                if (mvhdIdx !== -1) {
                    const version = buffer[mvhdIdx + 4];
                    if (version === 0 && mvhdIdx + 24 <= buffer.length) {
                        timescale = buffer.readUInt32BE(mvhdIdx + 16);
                        durationUnits = buffer.readUInt32BE(mvhdIdx + 20);
                    } else if (version === 1 && mvhdIdx + 32 <= buffer.length) {
                        timescale = buffer.readUInt32BE(mvhdIdx + 24);
                        durationUnits = Number(buffer.readBigUInt64BE(mvhdIdx + 28));
                    }
                    if (timescale > 0 && durationUnits > 0) {
                        durationSec = durationUnits / timescale;
                    }
                }

                const tkhdIdx = buffer.indexOf('tkhd');
                if (tkhdIdx !== -1) {
                    const version = buffer[tkhdIdx + 4];
                    const wOffset = version === 0 ? tkhdIdx + 76 : tkhdIdx + 88;
                    if (wOffset + 8 <= buffer.length) {
                        const wRaw = buffer.readUInt32BE(wOffset);
                        const hRaw = buffer.readUInt32BE(wOffset + 4);
                        const parsedW = Math.round(wRaw / 65536);
                        const parsedH = Math.round(hRaw / 65536);
                        if (parsedH >= 360 && parsedH <= 4320) {
                            height = parsedH;
                            width = (parsedW >= 240 && parsedW <= 4320) ? parsedW : Math.round((parsedH * 9) / 16);
                        }
                    }
                }

                let comment = '';
                
                // 1. Search for vid: video ID tag
                const vidIdx = buffer.indexOf('vid:v');
                if (vidIdx !== -1) {
                    let endIdx = vidIdx;
                    while (endIdx < buffer.length && buffer[endIdx] >= 32 && buffer[endIdx] <= 126) endIdx++;
                    comment = buffer.toString('utf8', vidIdx, endIdx);
                }

                // 2. Search for Lavf / FFmpeg encoder tag
                if (!comment) {
                    const lavfIdx = buffer.indexOf('Lavf');
                    if (lavfIdx !== -1) {
                        let endIdx = lavfIdx;
                        while (endIdx < buffer.length && buffer[endIdx] >= 32 && buffer[endIdx] <= 126) endIdx++;
                        comment = buffer.toString('utf8', lavfIdx, endIdx);
                    }
                }

                // 3. Helper to parse MP4 iTunes-style 4-byte atom tags
                const extractAtomTag = (tagStr) => {
                    const idx = buffer.indexOf(tagStr);
                    if (idx !== -1 && idx + 12 < buffer.length) {
                        const dataLen = buffer.readUInt32BE(idx + 4);
                        if (dataLen > 8 && idx + dataLen <= buffer.length) {
                            return buffer.toString('utf8', idx + 12, idx + dataLen).replace(/[\x00-\x1F\x7F-\xFF]/g, '').trim();
                        }
                    }
                    return '';
                };

                // 4. Search ©ART (Artist), ©too (Tool), ©cmt (Comment), ©nam (Title)
                if (!comment) comment = extractAtomTag('\xa9ART');
                if (!comment) comment = extractAtomTag('\xa9too');
                if (!comment) comment = extractAtomTag('\xa9cmt');
                if (!comment) comment = extractAtomTag('\xa9nam');

                req.extractedMp4Comment = comment;
            }
        } catch (_) {}

        if (!fps) fps = 60;

        let bitrateMbps = 0;
        if (contentLength > 0 && durationSec > 0) {
            bitrateMbps = (contentLength * 8) / (durationSec * 1000 * 1000);
        }

        return res.json({
            fps: fps || 60,
            width: width || 1080,
            height: height || 1920,
            duration: durationSec ? parseFloat(durationSec.toFixed(2)) : 0,
            size: contentLength || 0,
            bitrate: bitrateMbps ? parseFloat(bitrateMbps.toFixed(2)) : 0,
            comment: req.extractedMp4Comment || ''
        });
    } catch (e) {
        return res.status(500).json({ error: 'FPS calculation failed', details: e.message });
    }
});

function normalizeProxyUrl(raw) {
    try {
        const u = new URL(raw);
        if (u.hostname === 'github.com') {
            const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
            if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
        }
        if (u.hostname === 'pastebin.com' && !u.pathname.startsWith('/raw/')) {
            const m = u.pathname.match(/^\/([^/]+)$/);
            if (m) return `https://pastebin.com/raw${u.pathname}`;
        }
        if (u.hostname.includes('drive.google.com')) {
            const fileIdMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || u.searchParams.get('id');
            const fileId = fileIdMatch ? (Array.isArray(fileIdMatch) ? fileIdMatch[1] : fileIdMatch) : null;
            if (fileId) {
                return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
            }
        }
        if (u.hostname.includes('dropbox.com')) {
            return raw.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');
        }
    } catch (e) {}
    return raw;
}

app.get('/api/proxy', proxyLimiter, async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'Missing url query parameter' });
    }
    const resolvedUrl = normalizeProxyUrl(targetUrl);
    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': 'https://ssstik.io/en'
        };

        if (req.headers['range']) {
            fetchHeaders['Range'] = req.headers['range'];
        }

        const response = await fetch(resolvedUrl, {
            headers: fetchHeaders,
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok && response.status !== 206) {
            return res.status(response.status).json({ error: `Proxy: target returned ${response.status}` });
        }

        let contentType = response.headers.get('content-type') || 'text/plain';
        if (req.query.type === 'image') {
            contentType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
        } else if (req.query.type === 'video') {
            contentType = 'video/mp4';
        } else if (req.query.type === 'xml') {
            contentType = 'text/xml';
        } else {
            if (contentType === 'application/octet-stream' || contentType.includes('binary')) {
                if (targetUrl.includes('ssstik') || targetUrl.includes('tikcdn.io') || targetUrl.includes('.mp4')) {
                    contentType = 'video/mp4';
                } else if (targetUrl.includes('.xml')) {
                    contentType = 'text/xml';
                }
            }
        }

        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');

        res.status(response.status);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');

        if (contentLength) res.setHeader('Content-Length', contentLength);
        if (contentRange) res.setHeader('Content-Range', contentRange);

        if (response.body) {
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.on('error', (_) => {
                if (!res.headersSent) res.status(500).end();
            });
            res.on('close', () => {
                try { nodeStream.destroy(); } catch (_) {}
            });
            nodeStream.pipe(res);
        } else {
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ error: 'Proxy request failed', details: err.message });
        }
    }
});

// Socials CRUD Endpoints
app.get('/api/socials', async (req, res) => {
    try {
        const items = await Social.find().sort({ order: 1, _id: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch socials' });
    }
});
app.post('/api/socials', requireAdmin, async (req, res) => {
    try {
        const item = await new Social(req.body).save();
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/socials/reorder', requireAdmin, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
        const ops = items.map(item => ({
            updateOne: { filter: { _id: item.id }, update: { $set: { order: item.order } } }
        }));
        await Social.bulkWrite(ops);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/socials/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await Social.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/socials/:id', requireAdmin, async (req, res) => {
    try {
        await Social.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contacts CRUD Endpoints
app.get('/api/contacts', async (req, res) => {
    try {
        const items = await Contact.find().sort({ order: 1, _id: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});
app.post('/api/contacts', requireAdmin, async (req, res) => {
    try {
        const item = await new Contact(req.body).save();
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/contacts/reorder', requireAdmin, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
        const ops = items.map(item => ({
            updateOne: { filter: { _id: item.id }, update: { $set: { order: item.order } } }
        }));
        await Contact.bulkWrite(ops);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/contacts/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await Contact.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/contacts/:id', requireAdmin, async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/presets', async (req, res) => {
    try {
        const ip = getClientIp(req);
        const presets = await Preset.find().sort({ order: 1, _id: -1 }).lean();
        
        // Fetch all likes to calculate counts and user status dynamically
        const allLikes = await Like.find().lean();
        const userLikedSet = new Set(
            allLikes.filter(l => l.ip === ip).map(l => l.presetId.toString())
        );

        // Count occurrences per presetId
        const counts = allLikes.reduce((acc, curr) => {
            const pid = curr.presetId.toString();
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
        }, {});

        const results = presets.map((p, idx) => {
            const id = p._id.toString();
            return {
                ...p,
                presetId: typeof p.presetId === 'number' ? p.presetId : (idx + 1),
                likes: counts[id] || 0,
                liked: userLikedSet.has(id)
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch presets' });
    }
});
app.post('/api/presets', requireAdmin, async (req, res) => {
    try {
        const minPreset = await Preset.findOne().sort({ order: 1 }).lean();
        const minOrder = minPreset ? (typeof minPreset.order === 'number' ? minPreset.order : 0) : 0;
        const maxPreset = await Preset.findOne({ presetId: { $exists: true } }).sort({ presetId: -1 }).lean();
        const nextPresetId = maxPreset && typeof maxPreset.presetId === 'number' ? maxPreset.presetId + 1 : 1;
        const newPreset = new Preset({ ...req.body, order: minOrder - 1, presetId: nextPresetId });
        const saved = await newPreset.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/presets/reorder', requireAdmin, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
        const ops = items.map(item => ({
            updateOne: { filter: { _id: item.id }, update: { $set: { order: item.order } } }
        }));
        await Preset.bulkWrite(ops);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/presets/:id', requireAdmin, async (req, res) => res.json(await Preset.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/presets/:id', requireAdmin, async (req, res) => {
    await Preset.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.get('/api/presets/:id', async (req, res) => {
    try {
        const pId = req.params.id;
        if (/^\d+$/.test(pId)) {
            const num = Number(pId);
            const item = await Preset.findOne({ presetId: num });
            if (item) return res.json(item);

            const allPresets = await Preset.find().sort({ order: 1, _id: -1 }).lean();
            const fallbackItem = allPresets.find((p, idx) => (p.presetId === num) || ((idx + 1) === num));
            if (fallbackItem) return res.json(fallbackItem);
        }
        res.json(await Preset.findById(pId));
    } catch (err) {
        res.status(500).json({ error: 'Preset not found' });
    }
});

app.post('/api/presets/:id/like', async (req, res) => {
    const ip = getClientIp(req);
    const presetId = req.params.id;
    try {
        const existingLike = await Like.findOne({ presetId, ip });
        
        if (existingLike) {
            await Like.deleteOne({ _id: existingLike._id });
        } else {
            await new Like({ presetId, ip }).save();
        }

        // Get actual count from the Like collection (Source of Truth)
        const totalLikes = await Like.countDocuments({ presetId });
        
        // Sync the Preset model's counter
        await Preset.findByIdAndUpdate(presetId, { likes: totalLikes });

        res.json({ success: true, likes: totalLikes, liked: !existingLike });
    } catch (err) {
        res.status(500).json({ error: 'Like operation failed' });
    }
});

app.get('/api/resources', async (req, res) => res.json(await Resource.find().sort({ order: 1, _id: 1 })));
app.post('/api/resources', requireAdmin, async (req, res) => res.json(await new Resource(req.body).save()));
app.put('/api/resources/reorder', requireAdmin, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
        const ops = items.map(item => ({
            updateOne: { filter: { _id: item.id }, update: { $set: { order: item.order } } }
        }));
        await Resource.bulkWrite(ops);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/resources/:id', requireAdmin, async (req, res) => {
    try {
        // Try ObjectId match first (admin-created), fallback to string _id (manually inserted)
        let result = await Resource.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        if (!result) result = await Resource.findOneAndUpdate({ _id: req.params.id }, { $set: req.body }, { new: true });
        if (!result) return res.status(404).json({ error: 'Resource not found' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/resources/:id', requireAdmin, async (req, res) => {
    try {
        // Try ObjectId match first, fallback to string _id
        let r = await Resource.findById(req.params.id).catch(() => null);
        if (!r) r = await Resource.findOne({ _id: req.params.id });
        if (r) {
            await r.deleteOne();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// End of API endpoints

module.exports = app;

if (require.main === module) {
    const port = process.env.PORT || 5000;
    app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Server running locally at http://localhost:${port}`);
    });
}

