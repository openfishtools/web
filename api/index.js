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
const Admin = require('./models/Admin');
const Session = require('./models/Session');

const app = express();
app.use(cors());
const fs = require('fs');
app.use(express.json());

// Set security headers for WebGPU / SharedArrayBuffer
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    next();
});

// Priority: serve obfuscated frontend scripts from dist/scripts if built
const distScriptsPath = path.join(__dirname, '..', 'dist', 'scripts');
if (fs.existsSync(distScriptsPath)) {
    app.use('/scripts', express.static(distScriptsPath));
}
app.use(express.static(path.join(__dirname, '..')));

/**
 * Returns dynamic version & build date details based on Vercel environment or file stat
 */
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
    category: { type: mongoose.Schema.Types.Mixed, default: [] }, // String[] (multi-select)
    dev: String,
    instruction: String,
    icon: String,
    info: String, // size/info text
    os: { type: mongoose.Schema.Types.Mixed, default: [] }, // [{name: String, versions: [{label, url}]}]
    // Legacy fallback fields
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

function ipLookupVariants(raw) {
    const n = normalizeClientIp(raw);
    if (!n) return [];
    const set = new Set([n, String(raw).trim()]);
    if (n.includes('.') && !n.includes(':')) {
        set.add(`::ffff:${n}`);
    }
    return [...set];
}

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
            if (value) return value;
        }
        return '';
    }
    
    let fps = null;
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
        h === 'tikwm.com' ||
        h === 'ssstik.io' ||
        h === 'www.ssstik.io'
    );
}

function isAllowedTikTokMediaUrl(rawUrl) {
    try {
        const hostname = new URL(rawUrl).hostname.toLowerCase();
        const suffixes = [
            'tiktok.com',
            'tiktokcdn.com',
            'tiktokcdn-us.com',
            'tiktokv.com',
            'tikwm.com',
            'ibytedtos.com',
            'byteoversea.com',
            'muscdn.com',
            'tikcdn.io',
            'ssstik.io'
        ];
        return suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
    } catch {
        return false;
    }
}

async function extractTikTokFromSSSTik(pageUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const pageRes = await fetch('https://ssstik.io/en', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });
        const html = await pageRes.text();
        clearTimeout(timeout);

        const ttMatch = html.match(/s_version\s*=\s*"([^"]+)"/) || html.match(/tt:'([^']+)'/) || html.match(/name="tt"\s+value="([^"]+)"/);
        const tt = ttMatch ? ttMatch[1] : '';

        const postController = new AbortController();
        const postTimeout = setTimeout(() => postController.abort(), 8000);

        const postRes = await fetch('https://ssstik.io/abc?url=dl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'HX-Request': 'true',
                'HX-Trigger': '_gcaptcha_pt',
                'HX-Target': 'target',
                'HX-Current-URL': 'https://ssstik.io/en'
            },
            body: new URLSearchParams({
                id: pageUrl,
                locale: 'en',
                tt: tt
            }).toString(),
            signal: postController.signal
        });
        clearTimeout(postTimeout);

        if (!postRes.ok) return null;
        const resHtml = await postRes.text();

        const downloadLinks = [...resHtml.matchAll(/href="(https:\/\/[^"]+)"/g)]
            .map(m => m[1])
            .filter(l => !l.includes('ssstik.io') && (l.includes('tikcdn.io') || l.includes('tiktok') || l.includes('download') || l.includes('http')));

        if (!downloadLinks.length) return null;

        const urlMatch = pageUrl.match(/\/video\/(\d+)/);
        const videoId = urlMatch ? urlMatch[1] : '';
        const titleMatch = resHtml.match(/<p class="maintext[^>]*>([^<]+)<\/p>/);
        const authorMatch = resHtml.match(/@([a-zA-Z0-9_.-]+)/);
        const imgMatch = resHtml.match(/<img[^>]+src="([^"]+)"[^>]*class="result_author"/);

        return {
            id: videoId || '',
            play: downloadLinks[0] || '',
            hdplay: downloadLinks[1] || downloadLinks[0] || '',
            wmplay: '',
            cover: imgMatch ? imgMatch[1] : '',
            title: titleMatch ? titleMatch[1].trim() : '',
            author_unique_id: authorMatch ? authorMatch[1] : '',
            author_nickname: '',
            size: 0,
            duration: 0,
            w: 0,
            h: 0,
            is_fallback: false,
            method: 'ssstik'
        };
    } catch (e) {
        console.error('[SSSTik Extract] Error:', e.message);
        return null;
    }
}

async function extractTikTokFromPage(pageUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        
        const pageResponse = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!pageResponse.ok) return null;
        
        const html = await pageResponse.text();
        
        const finalUrl = pageResponse.url || pageUrl;
        const urlMatch = finalUrl.match(/\/video\/(\d+)/);
        const videoId = urlMatch ? urlMatch[1] : '';

        const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/) ||
                          html.match(/<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/) ||
                          html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
        if (!jsonMatch) return null;
        
        let pageData = null;
        try {
            pageData = JSON.parse(jsonMatch[1]);
        } catch {
            return null;
        }

        const videoData = pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.videoData ||
                          pageData?.ItemModule?.[videoId] ||
                          pageData?.props?.pageProps?.itemInfo?.itemStruct?.video;
        
        if (!videoData || (!videoData.downloadAddr && !videoData.playAddr)) {
            return null;
        }

        const authorObj = pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.author ||
                          pageData?.ItemModule?.[videoId]?.author ||
                          pageData?.props?.pageProps?.itemInfo?.itemStruct?.author;
        
        return {
            id: videoId || '',
            play: videoData.downloadAddr || videoData.playAddr || '',
            hdplay: videoData.playAddr || videoData.downloadAddr || '',
            wmplay: '',
            cover: videoData.dynamicCover || videoData.originCover || videoData.cover || '',
            title: pageData?.__DEFAULT_SCOPE__?.[0]?.module?.params?.video?.desc || videoData.desc || '',
            author_unique_id: authorObj?.uniqueId || (typeof authorObj === 'string' ? authorObj : ''),
            author_nickname: authorObj?.nickname || '',
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

app.get('/api/tiktok-resolve', async (req, res) => {
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

    try {
        let result = null;
        let lastError = null;

        const mirrors = [
            `https://www.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`,
            `https://tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`
        ];

        for (let idx = 0; idx < mirrors.length; idx++) {
            const upstream = mirrors[idx];
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                
                const r = await fetch(upstream, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const json = await r.json().catch(() => ({}));
                
                if (r.ok && json.code === 0 && json.data && (json.data.play || json.data.hdplay)) {
                    const d = json.data;
                    const playUrl = d.play || d.hdplay || '';
                    const hdUrl = d.hdplay || '';
                    const wmUrl = d.wmplay || '';
                    const covUrl = d.cover || d.origin_cover || '';

                    result = {
                        id: d.id || '',
                        play: playUrl.startsWith('http') ? playUrl : (playUrl ? `https://www.tikwm.com${playUrl}` : ''),
                        hdplay: hdUrl.startsWith('http') ? hdUrl : (hdUrl ? `https://www.tikwm.com${hdUrl}` : ''),
                        wmplay: wmUrl ? (wmUrl.startsWith('http') ? wmUrl : `https://www.tikwm.com${wmUrl}`) : '',
                        cover: covUrl ? (covUrl.startsWith('http') ? covUrl : `https://www.tikwm.com${covUrl}`) : '',
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
                    break;
                }
                
                lastError = `TikWM Mirror ${idx + 1}: ${json.msg || json.code || r.status}`;
            } catch (e) {
                lastError = `TikWM Mirror ${idx + 1}: ${e.message}`;
            }
        }

        const rapidApiKey = process.env.TIKWM_API_KEY || process.env.RAPIDAPI_KEY || process.env.TIKTOK_API_KEY;
        if (!result && rapidApiKey) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                const r = await fetch(`https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com/index?url=${encodeURIComponent(pageUrl)}`, {
                    headers: {
                        'x-rapidapi-key': rapidApiKey,
                        'x-rapidapi-host': 'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const json = await r.json().catch(() => ({}));
                if (r.ok && (json.play || json.hdplay || (json.data && (json.data.play || json.data.hdplay)))) {
                    const d = json.data || json;
                    result = {
                        id: d.id || '',
                        play: d.play || d.hdplay || '',
                        hdplay: d.hdplay || '',
                        wmplay: d.wmplay || '',
                        cover: d.cover || '',
                        title: d.title || '',
                        author_unique_id: d.author?.unique_id || '',
                        author_nickname: d.author?.nickname || '',
                        size: d.size || 0,
                        duration: d.duration || 0,
                        w: d.w || 0,
                        h: d.h || 0,
                        is_fallback: false,
                        method: 'rapidapi'
                    };
                }
            } catch (e) {
                lastError = `RapidAPI: ${e.message}`;
            }
        }

        if (!result) {
            try {
                result = await extractTikTokFromSSSTik(pageUrl);
            } catch (e) {
                lastError = `SSSTik: ${e.message}`;
            }
        }

        if (!result) {
            try {
                result = await extractTikTokFromPage(pageUrl);
                if (result) {
                    result.is_fallback = false;
                    result.method = 'direct_extract';
                }
            } catch (e) {
                lastError = `Direct Extract: ${e.message}`;
            }
        }

        if (result) {
            return res.json(result);
        }

        console.error(`[TikTok Resolve] All methods failed for ${pageUrl}: ${lastError}`);
        res.status(404).json({ 
            error: 'Video unavailable', 
            details: lastError,
            hint: 'Try alternative URL format or video might be private/deleted'
        });
    } catch (err) {
        console.error(`[TikTok Resolve] Unexpected error: ${err.message}`);
        res.status(500).json({ error: 'Resolve failed', details: err.message });
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
    } catch (e) {}
    return raw;
}

app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'Missing url query parameter' });
    }
    const resolvedUrl = normalizeProxyUrl(targetUrl);
    try {
        const response = await fetch(resolvedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            return res.status(response.status).json({ error: `Proxy: target returned ${response.status}` });
        }
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: 'Proxy request failed', details: err.message });
    }
});



app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Required fields missing' });
    try {
        const admin = await Admin.findOne({ username }).lean();
        if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Single active session enforcement: delete any previous active sessions
        await Session.deleteMany({});

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + ADMIN_SESSION_MS);
        
        await Session.create({ token, expiresAt });
        
        res.json({ token, expiresIn: ADMIN_SESSION_MS });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/admin/heartbeat', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ')) {
        const token = h.slice(7);
        await Session.deleteOne({ token });
    }
    res.json({ ok: true });
});

app.get('/api/socials', async (req, res) => res.json(await Social.find().sort({ order: 1, _id: 1 })));
app.post('/api/socials', requireAdmin, async (req, res) => res.json(await new Social(req.body).save()));
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
app.put('/api/socials/:id', requireAdmin, async (req, res) => res.json(await Social.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/socials/:id', requireAdmin, async (req, res) => {
    await Social.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Contacts CRUD
app.get('/api/contacts', async (req, res) => res.json(await Contact.find().sort({ order: 1, _id: 1 })));
app.post('/api/contacts', requireAdmin, async (req, res) => res.json(await new Contact(req.body).save()));
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
app.put('/api/contacts/:id', requireAdmin, async (req, res) => res.json(await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/contacts/:id', requireAdmin, async (req, res) => {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
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

