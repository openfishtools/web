const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

try {
    const { registerOTel } = require('@vercel/otel');
    registerOTel({ serviceName: 'nextgen-api' });
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
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const Session = require('./models/Session');

const app = express();
const fs = require('fs');
app.use(express.json());

// Global CORS & preflight
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Multi-Threading & Isolation headers for WebAssembly SharedArrayBuffer
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    const ua = req.headers['user-agent'] || '';
    const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/Chromium/i.test(ua);
    res.setHeader('Cross-Origin-Embedder-Policy', isSafari ? 'require-corp' : 'credentialless');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.path && req.path.endsWith('.user.js')) {
        res.setHeader('Content-Type', 'application/x-userscript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
});

app.use((req, res, next) => {
    const rawPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.originalUrl;
    if (rawPath && req.url.startsWith('/api/index.js')) {
        req.url = rawPath.split('?')[0];
    }
    next();
});

// API Protection Shield - Block direct external access outside cutefish.my.id
const PROXY_SECRET = process.env.PROXY_SECRET;

app.use((req, res, next) => {
    // Allow localhost during local development
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
        return next();
    }

    // Skip root redirect and CORS preflight
    if (req.method === 'OPTIONS' || req.path === '/') {
        return next();
    }

    // Protect all /api and /realesrgan routes
    if (req.path.startsWith('/api') || req.path.startsWith('/realesrgan')) {
        const clientSecret = req.headers['x-cf-secret'];
        if (!PROXY_SECRET || clientSecret !== PROXY_SECRET) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Please use cutefish.my.id to access this feature instead of using this API directly, AND STOP MAKING ME SWAP VERCEL ACCOUNTS OVER AND OVER AGAIN JUST TO RESET THE VERCEL LIMIT!'
            });
        }
    }
    next();
});

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

function isLoginBlocked(ip) {
    const rec = loginAttempts.get(ip);
    if (!rec) return false;
    if (Date.now() - rec.start > LOGIN_WINDOW_MS) {
        loginAttempts.delete(ip);
        return false;
    }
    return rec.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(ip) {
    const now = Date.now();
    const rec = loginAttempts.get(ip);
    if (!rec || now - rec.start > LOGIN_WINDOW_MS) {
        loginAttempts.set(ip, { start: now, count: 1 });
        return;
    }
    rec.count++;
    if (loginAttempts.size > 500) {
        for (const [k, v] of loginAttempts) {
            if (now - v.start > LOGIN_WINDOW_MS) loginAttempts.delete(k);
        }
    }
}


const distScriptsPath = path.join(__dirname, '..', 'dist', 'scripts');
const staticNoCache = {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (filePath && filePath.endsWith('.user.js')) {
            res.setHeader('Content-Type', 'application/x-userscript; charset=utf-8');
            res.setHeader('Content-Disposition', 'inline; filename="tiktok-cloud-disabler.user.js"');
        }
    }
};
if (fs.existsSync(distScriptsPath)) {
    app.use('/scripts', express.static(distScriptsPath, staticNoCache));
}
app.use(express.static(path.join(__dirname, '..'), staticNoCache));

const SERVER_INIT_TIME = new Date();

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
            buildDateObj = SERVER_INIT_TIME;
        }
    }
    if (!buildDateObj) buildDateObj = SERVER_INIT_TIME;

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

app.get('/api/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(getDynamicBuildInfo());
});

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

const TIKTOK_USERNAME = 'cutefishaep';
const TIKTOK_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIKTOK_POSTS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let tiktokPostsCache = null;

function normalizePost(raw, username) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.video_id || raw.id || '').trim();
    if (!/^\d+$/.test(id)) return null;
    const author = raw.author || {};
    const rawUniqueId = author.unique_id || author.uniqueId || '';
    if (rawUniqueId && String(username) && rawUniqueId.toLowerCase() !== String(username).toLowerCase()) return null;
    const uniqueId = rawUniqueId || username;
    const video = raw.video || {};
    const stats = raw.stats || {};
    const cover = raw.cover || raw.origin_cover || raw.dynamic_cover || video.cover || video.originCover || video.dynamicCover || '';
    return {
        id,
        title: String(raw.title || raw.desc || '').trim() || 'TikTok Video',
        cover,
        url: `https://www.tiktok.com/@${uniqueId}/video/${id}`,
        author: uniqueId,
        author_name: author.nickname || uniqueId,
        play_count: raw.play_count ?? stats.playCount ?? 0,
        digg_count: raw.digg_count ?? stats.diggCount ?? 0,
        comment_count: raw.comment_count ?? stats.commentCount ?? 0,
        share_count: raw.share_count ?? stats.shareCount ?? 0,
        duration: raw.duration || video.duration || 0,
        created_at: Number(raw.create_time || raw.createTime || 0) || Math.floor(Date.now() / 1000)
    };
}

function sortPostsDesc(posts) {
    return posts.sort((a, b) => b.created_at - a.created_at);
}

async function fetchTikwmUserFeed(username) {
    const mirrors = ['https://www.tikwm.com', 'https://tikwm.com'];
    for (const base of mirrors) {
        for (const method of ['GET', 'POST']) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);
                const options = {
                    method,
                    headers: { 'User-Agent': TIKTOK_UA, 'Accept': 'application/json' },
                    signal: controller.signal
                };
                if (method === 'GET') {
                    options.url = `${base}/api/user/posts?unique_id=${encodeURIComponent(username)}&count=12`;
                } else {
                    options.url = `${base}/api/user/posts`;
                    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    options.body = new URLSearchParams({ unique_id: username, count: '12' }).toString();
                }
                const r = await fetch(options.url, options);
                clearTimeout(timeout);
                if (!r.ok) continue;
                const json = await r.json().catch(() => null);
                const videos = json && json.code === 0 && json.data && Array.isArray(json.data.videos) ? json.data.videos : [];
                const posts = sortPostsDesc(videos.map(v => normalizePost(v, username)).filter(Boolean));
                if (posts.length > 0) return posts;
            } catch (e) {}
        }
    }
    return [];
}

async function fetchTikTokOEmbed(pageUrl) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(pageUrl)}`, {
            headers: { 'User-Agent': TIKTOK_UA },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        return j && typeof j === 'object' ? j : null;
    } catch (e) {
        return null;
    }
}

async function fetchTikTokVideoDetails(videoId, username = TIKTOK_USERNAME) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(`https://www.tiktok.com/embed/v2/${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!r.ok) return null;
        const html = await r.text();
        const match = html.match(/<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
        if (match) {
            const state = JSON.parse(match[1]);
            const dataObj = state.source?.data || {};
            for (const key of Object.keys(dataObj)) {
                const item = dataObj[key]?.videoData?.itemInfos;
                const author = dataObj[key]?.videoData?.authorInfos;
                if (item) {
                    const cover = item.coversOrigin?.[0] || item.covers?.[0] || '';
                    return {
                        id: String(item.id || videoId),
                        title: item.text ? item.text.trim() : 'TikTok Video',
                        cover: cover,
                        url: `https://www.tiktok.com/@${author?.uniqueId || username}/video/${videoId}`,
                        author: author?.uniqueId || username,
                        author_name: author?.nickName || username,
                        play_count: Number(item.playCount) || 0,
                        digg_count: Number(item.diggCount) || 0,
                        comment_count: Number(item.commentCount) || 0,
                        share_count: Number(item.shareCount) || 0,
                        duration: Number(item.video?.duration) || 15,
                        created_at: Number(item.createTime) || Math.floor(Date.now() / 1000)
                    };
                }
            }
        }
    } catch(e) {}
    return null;
}

async function fetchTikTokEmbedUserVideos(username) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const r = await fetch(`https://www.tiktok.com/embed/@${encodeURIComponent(username)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!r.ok) return [];
        const html = await r.text();
        const vidMatches = [...html.matchAll(/\/video\/(\d+)/g)].map(m => m[1]);
        const uniqueIds = [...new Set(vidMatches)];
        if (!uniqueIds.length) return [];
        
        const posts = (await Promise.all(uniqueIds.slice(0, 6).map(async (id, idx) => {
            if (idx > 0) await new Promise(res => setTimeout(res, idx * 30));
            const details = await fetchTikTokVideoDetails(id, username);
            if (details) return details;
            const oembed = await fetchTikTokOEmbed(`https://www.tiktok.com/@${username}/video/${id}`);
            return {
                id,
                title: oembed?.title || 'TikTok Video',
                cover: oembed?.thumbnail_url || '',
                url: `https://www.tiktok.com/@${username}/video/${id}`,
                author: username,
                author_name: oembed?.author_name || username,
                play_count: 0,
                digg_count: 0,
                comment_count: 0,
                share_count: 0,
                duration: 15,
                created_at: Math.floor(Date.now() / 1000)
            };
        }))).filter(Boolean);

        return posts;
    } catch (e) {
        return [];
    }
}

async function fetchProfilePagePosts(username) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
        const r = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
            headers: {
                'User-Agent': mobileUA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!r.ok) return [];
        const html = await r.text();
        const startTag = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
        const startIdx = html.indexOf(startTag);
        if (startIdx === -1) return [];
        const jsonStart = startIdx + startTag.length;
        const jsonEnd = html.indexOf('</script>', jsonStart);
        if (jsonEnd === -1) return [];
        const data = JSON.parse(html.slice(jsonStart, jsonEnd));
        const defaultScope = data['__DEFAULT_SCOPE__'] || {};
        const userDetail = defaultScope['webapp.user-detail'] || {};
        const userInfo = userDetail.userInfo || {};
        const rawItems = userDetail.itemList || userInfo.itemList || [];
        const posts = sortPostsDesc(rawItems.map(v => normalizePost(v, username)).filter(Boolean)).slice(0, 12);
        return posts;
    } catch (e) {
        return [];
    }
}

const TIKTOK_PINNED_VIDEOS = [
    { url: 'https://www.tiktok.com/@cutefishaep/video/7675697464044686613', fallbackTitle: 'Rasio nya salah jir', plays: 4264, likes: 361, duration: 12 },
    { url: 'https://www.tiktok.com/@cutefishaep/video/7674561349594270993', fallbackTitle: 'FishTools 1.3.0 3D MODEL GENERATOR UPDATE!', plays: 13056, likes: 901, duration: 24 },
    { url: 'https://www.tiktok.com/@cutefishaep/video/7675050655521721608', fallbackTitle: 'JJ RANDOM', plays: 2961, likes: 146, duration: 15 },
    { url: 'https://www.tiktok.com/@cutefishaep/video/7670369520401354004', fallbackTitle: 'JJ HAPPY HAPPY AJALAH', plays: 6559, likes: 312, duration: 16 }
];

async function resolvePinnedPosts() {
    const posts = await Promise.all(TIKTOK_PINNED_VIDEOS.map(async (item) => {
        const id = item.url.split('/').pop();
        const oembed = await fetchTikTokOEmbed(item.url);
        return {
            id,
            title: (oembed?.title && oembed.title.trim()) ? oembed.title.trim() : item.fallbackTitle,
            cover: oembed?.thumbnail_url || '',
            url: item.url,
            author: TIKTOK_USERNAME,
            author_name: oembed?.author_name || 'ً',
            play_count: item.plays || 0,
            digg_count: item.likes || 0,
            comment_count: 0,
            share_count: 0,
            duration: item.duration || 15,
            created_at: Math.floor(Date.now() / 1000)
        };
    }));
    return sortPostsDesc(posts);
}

app.get('/api/tiktok-posts', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const username = TIKTOK_USERNAME;

    if (tiktokPostsCache && Date.now() - tiktokPostsCache.at < TIKTOK_POSTS_TTL_MS) {
        return res.json(tiktokPostsCache.posts);
    }

    let posts = await fetchTikTokEmbedUserVideos(username);
    if (!posts.length) posts = await fetchProfilePagePosts(username);
    if (!posts.length) posts = await fetchTikwmUserFeed(username);
    if (!posts.length) posts = await resolvePinnedPosts();

    if (posts.length > 0) {
        await refreshPostCoversViaOEmbed(posts);
    }

    // Ensure all covers are official TikTok CDN URLs and not TikWM
    posts = posts.map(p => {
        if (p.cover && p.cover.includes('tikwm.com')) {
            p.cover = '';
        }
        return p;
    });

    if (posts.length > 0) {
        tiktokPostsCache = { at: Date.now(), posts };
    }

    res.json(posts);
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
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is missing');
    }
    const db = await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = db;
    await ensurePresetIds();
    return db;
}

async function requireDb(req, res, next) {
    if (!process.env.MONGODB_URI) {
        if (req.method === 'GET' && !req.path.startsWith('/api/admin')) {
            return res.json([]);
        }
        return res.status(503).json({ error: 'Database is not configured (MONGODB_URI missing)' });
    }
    try {
        await connectToDatabase();
        next();
    } catch (err) {
        if (req.method === 'GET' && !req.path.startsWith('/api/admin')) {
            return res.json([]);
        }
        res.status(500).json({ error: 'Database connection failed' });
    }
}

app.use(['/api/socials', '/api/contacts', '/api/presets', '/api/resources', '/api/admin'], requireDb);

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
    newsRank: { type: Number, default: 0 },
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

function parseWebMMetadataFromBuffer(buffer) {
    let width = 0;
    let height = 0;
    let fps = null;
    let comment = '';

    function readVInt(offset) {
        if (offset >= buffer.length) return null;
        const b = buffer[offset];
        let mask = 0x80;
        let length = 1;
        while (mask > 0 && !(b & mask)) {
            mask >>= 1;
            length++;
        }
        if (length > 8 || offset + length > buffer.length) return null;
        let value = b & (mask - 1);
        for (let i = 1; i < length; i++) {
            value = (value * 256) + buffer[offset + i];
        }
        return { value, length };
    }

    let pos = 0;
    let clusterTimecode = 0;
    let videoTimecodes = [];

    while (pos < buffer.length - 4) {
        const idRes = readVInt(pos);
        if (!idRes) break;
        const idHex = buffer.slice(pos, pos + idRes.length).toString('hex');
        pos += idRes.length;

        const sizeRes = readVInt(pos);
        if (!sizeRes) break;
        pos += sizeRes.length;
        const dataSize = sizeRes.value;

        if (['1a45dfa3', '18538067', '1549a966', '1654ae6b', 'ae', 'e0', '1f43b675', 'a0'].includes(idHex)) {
            continue;
        }

        if (idHex === 'b0') {
            if (dataSize > 0 && dataSize <= 8 && pos + dataSize <= buffer.length) {
                width = buffer.readUIntBE(pos, dataSize);
            }
        } else if (idHex === 'ba') {
            if (dataSize > 0 && dataSize <= 8 && pos + dataSize <= buffer.length) {
                height = buffer.readUIntBE(pos, dataSize);
            }
        } else if (idHex === '54b0') {
            if (!width && dataSize > 0 && dataSize <= 8 && pos + dataSize <= buffer.length) {
                width = buffer.readUIntBE(pos, dataSize);
            }
        } else if (idHex === '54ba') {
            if (!height && dataSize > 0 && dataSize <= 8 && pos + dataSize <= buffer.length) {
                height = buffer.readUIntBE(pos, dataSize);
            }
        } else if (idHex === '2383e3') {
            if (dataSize === 4 && pos + 4 <= buffer.length) {
                fps = Math.round(buffer.readFloatBE(pos));
            } else if (dataSize === 8 && pos + 8 <= buffer.length) {
                fps = Math.round(buffer.readDoubleBE(pos));
            }
        } else if (idHex === '23e383') {
            if (dataSize > 0 && dataSize <= 8 && pos + dataSize <= buffer.length) {
                const dur = buffer.readUIntBE(pos, dataSize);
                if (dur > 0) fps = Math.round(1e9 / dur);
            }
        } else if (idHex === 'e7') {
            if (dataSize > 0 && dataSize <= 8 && pos + dataSize <= buffer.length) {
                clusterTimecode = buffer.readUIntBE(pos, dataSize);
            }
        } else if (idHex === 'a3' || idHex === '91' || idHex === '83') {
            if (dataSize >= 3) {
                const trackRes = readVInt(pos);
                if (trackRes && trackRes.value === 1) {
                    const relTc = buffer.readInt16BE(pos + trackRes.length);
                    videoTimecodes.push(clusterTimecode + relTc);
                }
            }
        }

        pos += dataSize;
    }

    if ((!fps || isNaN(fps) || fps <= 0) && videoTimecodes.length >= 2) {
        const firstTc = videoTimecodes[0];
        const lastTc = videoTimecodes[videoTimecodes.length - 1];
        const deltaMs = lastTc - firstTc;
        if (deltaMs > 0) {
            const rawFps = ((videoTimecodes.length - 1) * 1000) / deltaMs;
            fps = Math.round(rawFps);
        }
    }

    return { fps: (fps && !isNaN(fps) && fps > 0 && fps < 300) ? fps : null, width, height, comment };
}

function parseMp4MetadataFromBuffer(buffer) {
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

    function isCleanMetadataComment(val) {
        if (!val || typeof val !== 'string') return false;
        const s = val.trim();
        if (!s || s === '-' || s === '—') return false;
        if (/^\d+$/.test(s)) return false; // purely numeric like "1" or "26400000"
        if (s.startsWith('{') && s.endsWith('}')) return false; // json payloads
        if (/^lavf\d*(\.\d+)*$/i.test(s)) return false; // default FFmpeg muxer tags
        if (/^lavc\d*(\.\d+)*$/i.test(s)) return false; // default FFmpeg codec tags
        if (/^vid:[a-zA-Z0-9_-]+/i.test(s)) return false; // internal vid tags
        if (/^v\d{4,}[a-zA-Z0-9_-]{8,}/i.test(s)) return false;
        if (/^(item_id|video_id|tos_id|aweme_id|music_id|author_id):/i.test(s)) return false;
        if (/^(isom|mp42|dash|iso2|qt)$/i.test(s)) return false;
        return true;
    }

    function extractCommentFromILST(ilstOffset, ilstSize) {
        const ilstPriority = ['\u00A9cmt', '\u00A9desc', '\u00A9too', '\u00A9ART', '\u00A9grp', '\u00A9name'];
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

        for (const k of ilstPriority) {
            const item = findBoxAny(ilstOffset + 8, ilstOffset + ilstSize, k);
            if (item) {
                const value = readItemValue(item);
                if (value && isCleanMetadataComment(value)) {
                    vals[k] = value;
                }
            }
        }

        const domainRe = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))/i;
        for (const k of ilstPriority) {
            if (vals[k]) {
                const m = vals[k].match(domainRe);
                if (m && vals[k].length < 60) return m[1];
                return vals[k];
            }
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

            if (!comment) {
                const trakUdta = findBox(offset + 8, offset + size, 'udta');
                if (trakUdta) {
                    const udtaEnd = trakUdta.offset + trakUdta.size;
                    let uOff = trakUdta.offset + 8;
                    while (uOff < udtaEnd - 8) {
                        const uSize = view.getUint32(uOff);
                        if (uSize <= 0 || uOff + uSize > udtaEnd) break;
                        const uType = String.fromCharCode(view.getUint8(uOff + 4), view.getUint8(uOff + 5), view.getUint8(uOff + 6), view.getUint8(uOff + 7));
                        if (['desc', 'cmt'].includes(uType)) {
                            const val = extractTextFromBox(uOff, uSize);
                            if (val && isCleanMetadataComment(val)) {
                                comment = val;
                                break;
                            }
                        }
                        if (uType === 'meta') {
                            const ilst = findBoxAny(uOff + 12, uOff + uSize, 'ilst');
                            if (ilst) {
                                const cmt = extractCommentFromILST(ilst.offset, ilst.size);
                                if (cmt && isCleanMetadataComment(cmt)) {
                                    comment = cmt;
                                    break;
                                }
                            }
                        }
                        uOff += uSize;
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
                if (['desc', 'cmt'].includes(uType)) {
                    const val = extractTextFromBox(uOff, uSize);
                    if (val && isCleanMetadataComment(val)) {
                        comment = val;
                        break;
                    }
                }
                if (uType === 'meta') {
                    const ilst = findBoxAny(uOff + 12, uOff + uSize, 'ilst');
                    if (ilst) {
                        const cmt = extractCommentFromILST(ilst.offset, ilst.size);
                        if (cmt && isCleanMetadataComment(cmt)) {
                            comment = cmt;
                            break;
                        }
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
                    if (['desc', 'cmt'].includes(uType)) {
                        const val = extractTextFromBox(uOff, uSize);
                        if (val && isCleanMetadataComment(val)) {
                            comment = val;
                            break;
                        }
                    }
                    if (uType === 'meta') {
                        const ilst = findBoxAny(uOff + 12, uOff + uSize, 'ilst');
                        if (ilst) {
                            const cmt = extractCommentFromILST(ilst.offset, ilst.size);
                            if (cmt && isCleanMetadataComment(cmt)) {
                                comment = cmt;
                                break;
                            }
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

function parseVideoMetadataFromBuffer(buffer) {
    if (!buffer || buffer.byteLength < 16) return null;
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
        return parseWebMMetadataFromBuffer(buffer);
    }
    return parseMp4MetadataFromBuffer(buffer);
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
        return res.json({ fps: null, width: 0, height: 0, size: 0, comment: '' });
    }

    const defaultHeaders = {
        'Range': 'bytes=0-2097151',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': '*/*'
    };

    function extractSizeFromResponse(response) {
        const cr = response.headers.get('content-range');
        if (cr && cr.includes('/')) {
            const total = parseInt(cr.split('/')[1], 10);
            if (!isNaN(total) && total > 0) return total;
        }
        const cl = response.headers.get('content-length');
        if (cl) {
            const len = parseInt(cl, 10);
            if (!isNaN(len) && len > 0 && response.status !== 206) return len;
        }
        return 0;
    }

    try {
        let response = await fetch(url, {
            headers: defaultHeaders,
            signal: AbortSignal.timeout(8000)
        });

        let totalSize = extractSizeFromResponse(response);

        if (response.ok || response.status === 206) {
            let buffer = Buffer.from(await response.arrayBuffer());
            let meta = parseVideoMetadataFromBuffer(buffer);
            if (meta && (meta.fps || meta.width)) {
                return res.json({ ...meta, size: totalSize });
            }
        }

        // If moov box is at the end of the file, fetch last 1MB
        try {
            response = await fetch(url, {
                headers: { ...defaultHeaders, 'Range': 'bytes=-1048576' },
                signal: AbortSignal.timeout(6000)
            });
            if (response.ok || response.status === 206) {
                let buffer = Buffer.from(await response.arrayBuffer());
                let meta = parseVideoMetadataFromBuffer(buffer);
                if (meta && (meta.fps || meta.width)) {
                    return res.json({ ...meta, size: totalSize || extractSizeFromResponse(response) });
                }
            }
        } catch (_) {}

        res.json({ fps: null, width: 0, height: 0, size: totalSize, comment: '' });
    } catch (e) {
        res.json({ fps: null, width: 0, height: 0, size: 0, comment: '' });
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

const tiktokResolveCache = new Map();
let tiktokThumbLastAt = 0;
let tiktokResolveLastAt = 0;
const TIKTOK_RESOLVE_TTL = 30 * 60 * 1000;
const TIKTOK_RESOLVE_FAIL_TTL = 60 * 1000;
const TIKTOK_RESOLVE_FAIL_SHORT_TTL = 15 * 1000;
const TIKTOK_RESOLVE_CACHE_MAX = 300;

function getCachedTikTokResolve(url) {
    const entry = tiktokResolveCache.get(url);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
        tiktokResolveCache.delete(url);
        return undefined;
    }
    return entry.result;
}

function setCachedTikTokResolve(url, result, failTtl) {
    if (tiktokResolveCache.size >= TIKTOK_RESOLVE_CACHE_MAX) {
        tiktokResolveCache.delete(tiktokResolveCache.keys().next().value);
    }
    const ttl = result ? TIKTOK_RESOLVE_TTL : (failTtl || TIKTOK_RESOLVE_FAIL_TTL);
    tiktokResolveCache.set(url, { result, expires: Date.now() + ttl });
}

async function expandTikTokShortLink(pageUrl) {
    try {
        const u = new URL(pageUrl);
        if (!/^(vt|vm)\./i.test(u.hostname)) return pageUrl;
        const r = await fetch(pageUrl, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(6000)
        });
        if (r.url && /\/video\/\d+/.test(r.url)) return r.url;
    } catch (e) {}
    return pageUrl;
}

async function fetchTikTokOEmbedThumb(pageUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
        const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(pageUrl)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: controller.signal
        });
        if (!r.ok) return null;
        const j = await r.json().catch(() => null);
        const thumb = j && typeof j.thumbnail_url === 'string' && /^https?:\/\//i.test(j.thumbnail_url) ? j.thumbnail_url : '';
        return thumb || null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshPostCoversViaOEmbed(posts, limit = 12) {
    const targets = posts.slice(0, limit).filter(p => p && p.url);
    await Promise.all(targets.map(async (p, i) => {
        try {
            if (i > 0) await sleep(i * 50);
            const videoId = p.id || p.url.split('/').pop();
            const details = await fetchTikTokVideoDetails(videoId, p.author || TIKTOK_USERNAME);
            if (details) {
                if (details.cover) p.cover = details.cover;
                if (details.title && details.title !== 'TikTok Video') p.title = details.title;
                if (details.author_name) p.author_name = details.author_name;
                if (details.play_count !== undefined) p.play_count = details.play_count;
                if (details.digg_count !== undefined) p.digg_count = details.digg_count;
                if (details.comment_count !== undefined) p.comment_count = details.comment_count;
                if (details.share_count !== undefined) p.share_count = details.share_count;
                if (details.duration) p.duration = details.duration;
                if (details.created_at) p.created_at = details.created_at;
            } else {
                const thumb = await fetchTikTokOEmbedThumb(p.url);
                if (thumb) p.cover = thumb;
                const oembed = await fetchTikTokOEmbed(p.url);
                if (oembed && oembed.title && (!p.title || p.title === 'TikTok Video')) {
                    p.title = oembed.title;
                }
                if (oembed && oembed.author_name) {
                    p.author_name = oembed.author_name;
                }
            }
        } catch (e) {}
    }));
}

async function fetchTikTokEmbedThumb(videoId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
        const r = await fetch(`https://www.tiktok.com/embed/v2/${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: controller.signal
        });
        if (!r.ok) return '';
        const html = await r.text();
        const imgs = [...html.matchAll(/<img[^>]+src="(https:[^"]+)"/g)].map(m => m[1]);
        const pick = imgs.find(src => /tiktokcdn|img\.tiktok|p16|-sign\./i.test(src)) || imgs[0] || '';
        return pick || '';
    } catch (e) {
        return '';
    } finally {
        clearTimeout(timer);
    }
}

app.get('/api/tiktok-thumb', async (req, res) => {
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') return res.status(400).json({ error: 'Missing url' });
    let pageUrl = raw.trim();
    try {
        const parsed = new URL(pageUrl);
        if (!isAllowedTikTokResolveHost(parsed.hostname)) return res.status(400).json({ error: 'URL host not allowed' });
    } catch (e) {
        return res.status(400).json({ error: 'Invalid url' });
    }

    const cacheKey = `thumb:${pageUrl}`;
    if (req.query.nocache !== '1') {
        const cached = getCachedTikTokResolve(cacheKey);
        if (cached !== undefined) {
            if (cached === null) return res.status(404).json({ error: 'Thumbnail unavailable', source: 'cache' });
            return res.json({ cover: cached.cover, source: cached.source });
        }
    }

    let canonical = pageUrl;
    if (!/\/video\/\d+/.test(canonical)) {
        canonical = await expandTikTokShortLink(canonical);
    }

    const videoIdMatch = canonical.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';

    const nowMs = Date.now();
    const paceWait = Math.max(0, tiktokThumbLastAt + 130 - nowMs);
    tiktokThumbLastAt = nowMs + paceWait;
    if (paceWait > 0) await new Promise(resolve => setTimeout(resolve, paceWait));

    let cover = '';
    let source = '';
    for (let attempt = 0; attempt < 2 && !cover; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 350));
        cover = await fetchTikTokOEmbedThumb(canonical);
        if (cover) source = 'oembed';
    }

    if (!cover && videoId) {
        cover = await fetchTikTokEmbedThumb(videoId);
        if (cover) source = 'embed';
    }

    if (!cover) {
        setCachedTikTokResolve(cacheKey, null, TIKTOK_RESOLVE_FAIL_SHORT_TTL);
        return res.status(404).json({ error: 'Thumbnail unavailable', fallback: 'resolve' });
    }

    const payload = { cover, source };
    setCachedTikTokResolve(cacheKey, payload);
    res.json(payload);
});

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
        if (req.query.nocache !== '1') {
            const cached = getCachedTikTokResolve(pageUrl);
            if (cached !== undefined) {
                if (cached === null) {
                    return res.status(404).json({ error: 'Video unavailable', details: 'cached-failure', hint: 'Pass nocache=1 to retry upstream' });
                }
                return res.json(cached);
            }
        }

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
                        author_avatar: d.author?.avatar || '',
                        region: d.region || '',
                        create_time: d.create_time || 0,
                        is_nff_or_nr: !!d.is_nff_or_nr,
                        play_count: d.play_count || 0,
                        digg_count: d.digg_count || 0,
                        comment_count: d.comment_count || 0,
                        share_count: d.share_count || 0,
                        collect_count: d.collect_count || 0,
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
                        author_avatar: d.author?.avatar || '',
                        region: d.region || '',
                        create_time: d.create_time || 0,
                        is_nff_or_nr: !!d.is_nff_or_nr,
                        play_count: d.play_count || 0,
                        digg_count: d.digg_count || 0,
                        comment_count: d.comment_count || 0,
                        share_count: d.share_count || 0,
                        collect_count: d.collect_count || 0,
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
            setCachedTikTokResolve(pageUrl, result);
            return res.json(result);
        }

        setCachedTikTokResolve(pageUrl, null);
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

app.post('/api/admin/login', (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (isLoginBlocked(ip)) {
        return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Required fields missing' });
    recordLoginFailure(ip);
    handleAdminLogin(req, res, username, password);
});

async function handleAdminLogin(req, res, username, password) {
    try {
        const admin = await Admin.findOne({ username }).lean();
        if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        loginAttempts.delete(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown');

        await Session.deleteMany({});

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + ADMIN_SESSION_MS);

        await Session.create({ token, expiresAt });

        res.json({ token, expiresIn: ADMIN_SESSION_MS });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
}

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

        const allLikes = await Like.find().lean();
        const userLikedSet = new Set(
            allLikes.filter(l => l.ip === ip).map(l => l.presetId.toString())
        );

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
    try {
        const pId = req.params.id;
        let deleted = await Preset.findByIdAndDelete(pId).catch(() => null);
        if (!deleted && /^\d+$/.test(pId)) {
            deleted = await Preset.findOneAndDelete({ presetId: Number(pId) }).catch(() => null);
        }
        if (deleted) {
            await Like.deleteMany({ presetId: deleted._id.toString() }).catch(() => null);
        }
        res.json({ success: true, deleted: !!deleted });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete preset' });
    }
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

        const totalLikes = await Like.countDocuments({ presetId });

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
        const ops = items.map(item => {
            const filterId = mongoose.Types.ObjectId.isValid(item.id) ? new mongoose.Types.ObjectId(item.id) : item.id;
            return { updateOne: { filter: { _id: filterId }, update: { $set: { order: item.order } } } };
        });
        await Resource.collection.bulkWrite(ops);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put('/api/resources/:id', requireAdmin, async (req, res) => {
    try {

        let result;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            let updateRes = await Resource.collection.findOneAndUpdate(
                { _id: req.params.id }, 
                { $set: req.body }, 
                { returnDocument: 'after' }
            );
            result = updateRes ? updateRes.value || updateRes : null;
        } else {
            result = await Resource.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).catch(() => null);
        }
        if (!result) return res.status(404).json({ error: 'Resource not found' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/resources/:id', requireAdmin, async (req, res) => {
    try {

        let r;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            r = await Resource.collection.findOne({ _id: req.params.id });
            if (r) await Resource.collection.deleteOne({ _id: req.params.id });
        } else {
            r = await Resource.findById(req.params.id).catch(() => null);
            if (r) await r.deleteOne();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;

if (require.main === module) {
    const port = process.env.NEXTGEN_PORT || process.env.PORT || 5000;
    app.listen(port, '0.0.0.0', () => {
        console.log(`\x1b[32m[Next Gen API]\x1b[0m Running at \x1b[36mhttp://localhost:${port}\x1b[0m`);
    });
}

