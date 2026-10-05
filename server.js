const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const PORT = process.env.NEXTGEN_PORT || process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

let isDbConnected = false;
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

async function initDatabase() {
    if (!MONGODB_URI) {
        console.warn('\x1b[33m[Warning]\x1b[0m MONGODB_URI is not set. Using static fallback data.');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        isDbConnected = true;
        console.log('\x1b[32m[MongoDB]\x1b[0m Connected to database successfully.');
    } catch (err) {
        console.error('\x1b[31m[MongoDB Error]\x1b[0m Failed to connect to MongoDB:', err.message);
    }
}

initDatabase();

const TIKTOK_USERNAME = 'cutefishaep';
const TIKTOK_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIKTOK_POSTS_TTL_MS = 5 * 60 * 1000;
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

async function refreshPostCoversViaOEmbed(posts, limit = 12) {
    const targets = posts.slice(0, limit).filter(p => p && p.url);
    await Promise.all(targets.map(async (p, i) => {
        try {
            if (i > 0) await new Promise(r => setTimeout(r, i * 50));
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
                const oembed = await fetchTikTokOEmbed(p.url);
                if (oembed) {
                    if (oembed.thumbnail_url) p.cover = oembed.thumbnail_url;
                    if (oembed.title && (!p.title || p.title === 'TikTok Video')) {
                        p.title = oembed.title;
                    }
                    if (oembed.author_name) {
                        p.author_name = oembed.author_name;
                    }
                }
            }
        } catch (e) {}
    }));
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

async function fetchLatestTikTokPosts(username) {
    const fromEmbed = await fetchTikTokEmbedUserVideos(username);
    if (fromEmbed.length > 0) return fromEmbed;
    const fromScrape = await fetchProfilePagePosts(username);
    if (fromScrape.length > 0) return fromScrape;
    const fromFeed = await fetchTikwmUserFeed(username);
    if (fromFeed.length > 0) return fromFeed;
    return [];
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURI(parsedUrl.pathname);

    if (pathname === '/api/tiktok-posts') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (tiktokPostsCache && Date.now() - tiktokPostsCache.at < TIKTOK_POSTS_TTL_MS) {
            res.writeHead(200);
            res.end(JSON.stringify(tiktokPostsCache.posts));
            return;
        }

        let livePosts = await fetchLatestTikTokPosts(TIKTOK_USERNAME);
        if (livePosts.length === 0) {
            const defaultUserVideos = [
                { url: 'https://www.tiktok.com/@cutefishaep/video/7675697464044686613', fallbackTitle: 'Rasio nya salah jir', plays: 4264, likes: 361, duration: 12 },
                { url: 'https://www.tiktok.com/@cutefishaep/video/7674561349594270993', fallbackTitle: 'FishTools 1.3.0 3D MODEL GENERATOR UPDATE!', plays: 13056, likes: 901, duration: 24 },
                { url: 'https://www.tiktok.com/@cutefishaep/video/7675050655521721608', fallbackTitle: 'JJ RANDOM', plays: 2961, likes: 146, duration: 15 },
                { url: 'https://www.tiktok.com/@cutefishaep/video/7670369520401354004', fallbackTitle: 'JJ HAPPY HAPPY AJALAH', plays: 6559, likes: 312, duration: 16 }
            ];

            livePosts = await Promise.all(defaultUserVideos.map(async (item) => {
                const id = item.url.split('/').pop();
                const oembed = await fetchTikTokOEmbed(item.url);
                return {
                    id,
                    title: (oembed?.title && oembed.title.trim()) ? oembed.title.trim() : item.fallbackTitle,
                    cover: oembed?.thumbnail_url || '',
                    url: item.url,
                    author: TIKTOK_USERNAME,
                    author_name: oembed?.author_name || 'ً',
                    play_count: item.plays,
                    digg_count: item.likes,
                    comment_count: 0,
                    share_count: 0,
                    duration: item.duration,
                    created_at: Math.floor(Date.now() / 1000)
                };
            }));
        }

        if (livePosts.length > 0) {
            await refreshPostCoversViaOEmbed(livePosts);
            livePosts = livePosts.map(p => {
                if (p.cover && p.cover.includes('tikwm.com')) {
                    p.cover = '';
                }
                return p;
            });
            tiktokPostsCache = { at: Date.now(), posts: livePosts };
        }

        res.writeHead(200);
        res.end(JSON.stringify(livePosts));
        return;
    }

    if (pathname === '/api/resources') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
            if (!isDbConnected && MONGODB_URI) {
                await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
                isDbConnected = true;
            }
            if (isDbConnected) {
                const queryAll = parsedUrl.searchParams.get('all') === 'true';
                let dbResources = queryAll
                    ? await Resource.find().sort({ order: 1, _id: -1 }).lean()
                    : await Resource.find({ hidden: { $ne: true } }).sort({ order: 1, _id: -1 }).lean();

                if (!dbResources || dbResources.length === 0) {
                    dbResources = await Resource.find().sort({ order: 1, _id: -1 }).lean();
                }

                if (dbResources && dbResources.length > 0) {
                    res.writeHead(200);
                    res.end(JSON.stringify(dbResources));
                    return;
                }
            }
        } catch (dbErr) {
            console.error('[API /api/resources Error]:', dbErr.message);
        }

        const fallbackResources = [
            {
                _id: 'res-1',
                title: 'FishTools 1.3.0',
                dev: 'cutefishaep Team',
                category: ['Made By Cutefish', 'Tools'],
                icon: 'assets/icon/Ae.png',
                info: '42 MB',
                instruction: 'Extract to C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\extensions and enable unsigned extensions in registry/terminal.',
                os: [
                    {
                        name: 'WIN',
                        versions: [
                            { label: 'v1.3.0 (AE 2022-2024)', url: 'https://github.com/cutefishaep' },
                            { label: 'v1.2.0 (Legacy)', url: 'https://github.com/cutefishaep' }
                        ]
                    }
                ]
            },
            {
                _id: 'res-2',
                title: 'Sapphire Plugins 2024',
                dev: 'Boris FX',
                category: ['Plugin'],
                icon: 'assets/icon/Ae.png',
                info: '1.2 GB',
                instruction: 'Run installer as administrator, select After Effects directory, apply patch fix.',
                os: [
                    {
                        name: 'WIN',
                        versions: [
                            { label: '2024.1 (AE 2024)', url: 'https://borisfx.com' },
                            { label: '2023.5 (AE 2023)', url: 'https://borisfx.com' }
                        ]
                    },
                    {
                        name: 'MAC',
                        versions: [
                            { label: '2024.1 (Apple Silicon)', url: 'https://borisfx.com' }
                        ]
                    }
                ]
            },
            {
                _id: 'res-3',
                title: 'Twixtor Pro & RSMB',
                dev: 'RE:Vision Effects',
                category: ['Plugin'],
                icon: 'assets/icon/Ae.png',
                info: '85 MB',
                instruction: 'Install into Adobe After Effects Plug-ins folder. Enter license key or use offline activation.',
                os: [
                    {
                        name: 'WIN',
                        versions: [
                            { label: 'v7.4.0 (Windows)', url: 'https://revisionfx.com' }
                        ]
                    },
                    {
                        name: 'MAC',
                        versions: [
                            { label: 'v7.4.0 (macOS)', url: 'https://revisionfx.com' }
                        ]
                    }
                ]
            },
            {
                _id: 'res-4',
                title: 'Alight Motion Pro 5.0',
                dev: 'Alight Creative',
                category: ['Software'],
                icon: 'assets/icon/Am.png',
                info: '148 MB',
                instruction: 'Allow installation from unknown sources in Android settings and install APK.',
                os: [
                    {
                        name: 'ANDROID',
                        versions: [
                            { label: 'v5.0.260 (Latest)', url: 'https://alightcreative.com' },
                            { label: 'v4.5.180 (Stable)', url: 'https://alightcreative.com' }
                        ]
                    }
                ]
            },
            {
                _id: 'res-5',
                title: 'Real-ESRGAN AI Video Enhancer',
                dev: 'xinntao',
                category: ['Made By Cutefish', 'Tools'],
                icon: 'assets/icon/Node.png',
                info: '64 MB',
                instruction: 'Extract zip and run with command: realesrgan-ncnn-vulkan.exe -i input.mp4 -o output.mp4 -n realesr-animevideov3.',
                os: [
                    {
                        name: 'WIN',
                        versions: [
                            { label: 'v0.2.5 Vulkan GPU', url: 'https://github.com/xinntao/Real-ESRGAN' }
                        ]
                    }
                ]
            },
            {
                _id: 'res-6',
                title: 'Adobe After Effects 2024',
                dev: 'Adobe',
                category: ['Software'],
                icon: 'assets/icon/Ae.png',
                info: '3.4 GB',
                instruction: 'Run Setup.exe, follow on-screen installer instructions, and launch After Effects.',
                os: [
                    {
                        name: 'WIN',
                        versions: [
                            { label: 'v24.2.1 Multi', url: 'https://adobe.com' }
                        ]
                    },
                    {
                        name: 'MAC',
                        versions: [
                            { label: 'v24.2.1 Universal', url: 'https://adobe.com' }
                        ]
                    }
                ]
            }
        ];

        res.writeHead(200);
        res.end(JSON.stringify(fallbackResources));
        return;
    }

    if (pathname === '/api/socials') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        try {
            if (isDbConnected) {
                const socials = await Social.find().sort({ order: 1, _id: 1 }).lean();
                res.writeHead(200);
                res.end(JSON.stringify(socials));
                return;
            }
        } catch (dbErr) {
            console.error('[API /api/socials Error]:', dbErr.message);
        }

        const fallbackSocials = [
            { name: 'DONATE', url: 'https://saweria.co/cutefishaep', icon: 'https://tr.rbxcdn.com/180DAY-3f4674f55d57c83900f5b9a60536119d/420/420/Image/Webp/noFilter', order: 0 },
            { name: 'TikTok Roblox', url: 'https://www.tiktok.com/@cutefishrbx', icon: 'bi-tiktok', order: 1 },
            { name: 'TikTok Editing', url: 'https://www.tiktok.com/@cutefishaep', icon: 'bi-tiktok', order: 2 },
            { name: 'Instagram', url: 'https://www.instagram.com/cutefishaep/', icon: 'bi-instagram', order: 3 },
            { name: 'YouTube Editing', url: 'https://www.youtube.com/@cutefishYT', icon: 'bi-youtube', order: 4 },
            { name: 'YouTube Roblox', url: 'https://www.youtube.com/@cutefishrbx', icon: 'bi-youtube', order: 5 },
            { name: 'Github Profile', url: 'https://github.com/cutefishaep', icon: 'bi-github', order: 6 },
            { name: 'Channel WhatsApp', url: 'https://whatsapp.com/channel/0029VbDWmbe2kNFxcRD5Lj2z', icon: 'bi-whatsapp', order: 7 }
        ];
        res.writeHead(200);
        res.end(JSON.stringify(fallbackSocials));
        return;
    }

    if (pathname === '/api/contacts') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        try {
            if (isDbConnected) {
                const contacts = await Contact.find({ hidden: { $ne: true } }).sort({ order: 1, _id: 1 }).lean();
                res.writeHead(200);
                res.end(JSON.stringify(contacts));
                return;
            }
        } catch (dbErr) {
            console.error('[API /api/contacts Error]:', dbErr.message);
        }

        const fallbackContacts = [
            { name: 'WhatsApp', url: 'https://wa.me/6285150763332', icon: 'bi-whatsapp', order: 0 },
            { name: 'Telegram', url: 'https://t.me/cutefishaep', icon: 'bi-telegram', order: 1 }
        ];
        res.writeHead(200);
        res.end(JSON.stringify(fallbackContacts));
        return;
    }

    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const fallbackPath = path.join(__dirname, '..', pathname);
        if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
            filePath = fallbackPath;
        } else if (!path.extname(pathname)) {
            filePath = path.join(__dirname, 'index.html');
        } else {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
    });

    fs.createReadStream(filePath).pipe(res);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\x1b[31m[Error]\x1b[0m Port ${PORT} is already in use by another application.`);
        console.error(`\x1b[33m[Hint]\x1b[0m Please close the other process or change NEXTGEN_PORT in your environment.`);
    } else {
        console.error(`\x1b[31m[Server Error]\x1b[0m`, err);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[32m[Next Gen]\x1b[0m Server running at: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[32m[Next Gen]\x1b[0m Local IP access: \x1b[36mhttp://127.0.0.1:${PORT}\x1b[0m`);
    console.log(`\x1b[90mPress Ctrl+C to stop the server\x1b[0m\n`);
});
