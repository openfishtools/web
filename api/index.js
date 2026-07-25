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

// Proxy/redirect /realesrgan requests to target
app.get('/realesrgan/*', (req, res) => {
    res.redirect(`https://upscale.chino.icu${req.originalUrl}`);
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

const TikTokCacheSchema = new mongoose.Schema({
    url: { type: String, unique: true },
    play: String,
    cover: String,
    title: String,
    author_unique_id: String,
    author_nickname: String,
    size: Number,
    duration: Number,
    fps: Number,
    updatedAt: { type: Date, default: Date.now }
});
const TikTokCache = mongoose.models.TikTokCache || mongoose.model('TikTokCache', TikTokCacheSchema);

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
    
    let fps = null;
    let width = 0;
    let height = 0;
    
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
                    break;
                }
            }
        }
        offset += size;
    }
    
    return { fps, width, height };
}

app.get('/api/get-ip', (req, res) => {
    res.json({ ip: getClientIp(req) });
});

app.get('/api/tiktok-fps', async (req, res) => {
    const url = req.query.url;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url' });
    }

    if (!url.includes('tiktokcdn')) {
        return res.json({ fps: null, width: 0, height: 0 });
    }

    try {
        let response = await fetch(url, {
            headers: { 'Range': 'bytes=0-524287', 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok && response.status !== 206) {
            return res.json({ fps: null, width: 0, height: 0 });
        }

        let buffer = Buffer.from(await response.arrayBuffer());
        let meta = parseVideoMetadataFromBuffer(buffer);

        if (!meta) {
            response = await fetch(url, {
                headers: { 'Range': 'bytes=-524288', 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(5000)
            });
            if (response.ok || response.status === 206) {
                buffer = Buffer.from(await response.arrayBuffer());
                meta = parseVideoMetadataFromBuffer(buffer);
            }
        }

        res.json(meta || { fps: null, width: 0, height: 0 });
    } catch (e) {
        res.json({ fps: null, width: 0, height: 0 });
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

async function extractTikTokFromPage(pageUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
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
            cover: videoData.dynamicCover || videoData.originCover || '',
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
        const bypassCache = req.query.nocache === '1';
        if (!bypassCache) {
            const cached = await TikTokCache.findOne({ url: pageUrl });
            // Check fresh cache (4 hours)
            if (cached && (Date.now() - cached.updatedAt.getTime() < 4 * 60 * 60 * 1000)) {
                return res.json({
                    id: cached.id || '',
                    play: cached.play,
                    cover: cached.cover,
                    title: cached.title,
                    author_unique_id: cached.author_unique_id || '',
                    author_nickname: cached.author_nickname || '',
                    size: cached.size || 0,
                    duration: cached.duration || 0,
                    fps: cached.fps || null,
                    cached: true
                });
            }
        }

        // Strategy: Try multiple methods
        let result = null;
        let lastError = null;

        // Method 1: Try TikWM API mirrors
        const mirrors = [
            `https://api.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`,
            `https://www.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`
        ];
        const apiKey = process.env.TIKWM_API_KEY;

        for (let idx = 0; idx < mirrors.length; idx++) {
            const upstream = mirrors[idx];
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4000);
                
                const fetchOptions = {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                };
                if (apiKey) {
                    fetchOptions.headers['x-api-key'] = apiKey;
                }
                
                const r = await fetch(upstream, { ...fetchOptions, signal: controller.signal });
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
                        method: 'tikwm'
                    };
                    break;
                }
                
                lastError = `TikWM Mirror ${idx + 1}: ${r.status}`;
            } catch (e) {
                lastError = `TikWM Mirror ${idx + 1}: ${e.message}`;
            }
        }

        // Method 2: Try direct page extraction
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

        // If we got a result, cache and return it
        if (result) {
            await TikTokCache.findOneAndUpdate(
                { url: pageUrl },
                { ...result, updatedAt: new Date() },
                { upsert: true }
            );
            return res.json(result);
        }

        // Method 3: Try old cache if available (even if expired)
        const oldCache = await TikTokCache.findOne({ url: pageUrl });
        if (oldCache) {
            console.warn(`[TikTok Resolve] Using expired cache for ${pageUrl}`);
            return res.json({
                id: oldCache.id || '',
                play: oldCache.play,
                cover: oldCache.cover,
                title: oldCache.title,
                author_unique_id: oldCache.author_unique_id || '',
                author_nickname: oldCache.author_nickname || '',
                size: oldCache.size || 0,
                duration: oldCache.duration || 0,
                fps: oldCache.fps || null,
                is_fallback: true,
                cached: true,
                warning: 'API temporarily unavailable, using old cached version'
            });
        }

        // All methods failed
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

        const results = presets.map(p => {
            const id = p._id.toString();
            return {
                ...p,
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
            const item = await Preset.findOne({ presetId: Number(pId) });
            if (item) return res.json(item);
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

