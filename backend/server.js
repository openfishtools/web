require('dotenv').config();
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
const multer = require('multer');
const Admin = require('./models/Admin');
const Session = require('./models/Session');

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit


const app = express();
app.use(cors());
app.use(express.json());

/** Note: Sessions are stored in MongoDB to persist across restarts. */
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
let lastAdminHeartbeat = 0;

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
        next();
    } catch (err) {
        res.status(500).json({ error: 'Auth check failed' });
    }
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

const SocialSchema = new mongoose.Schema({
    name: String,
    url: String,
    icon: String
});
const Social = mongoose.model('Social', SocialSchema);

const PresetSchema = new mongoose.Schema({
    name: String,
    software: [String],
    type: String,
    version: String,
    media: String,
    plugin: String,
    size: String,
    url: String,
    urls: [{ sw: String, url: String }],
    likes: { type: Number, default: 0 }
});
const Preset = mongoose.model('Preset', PresetSchema);

const TikTokCacheSchema = new mongoose.Schema({
    url: { type: String, unique: true },
    play: String,
    cover: String,
    title: String,
    updatedAt: { type: Date, default: Date.now }
});
const TikTokCache = mongoose.model('TikTokCache', TikTokCacheSchema);

const ResourceSchema = new mongoose.Schema({
    title: String,
    category: String,
    dev: String,
    version: String,
    os: String,
    info: String,
    url: String,
    icon: String
});
const Resource = mongoose.model('Resource', ResourceSchema);

const MessageSchema = new mongoose.Schema({
    chatId: String,
    text: String,
    type: String,
    time: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const ChatSchema = new mongoose.Schema({
    name: String,
    ip: String,
    lastMsg: String,
    time: String,
    blocked: { type: Boolean, default: false },
    lastUpdate: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', ChatSchema);

const LikeSchema = new mongoose.Schema({
    presetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preset' },
    ip: String,
    timestamp: { type: Date, default: Date.now }
});
const Like = mongoose.model('Like', LikeSchema);

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

/** Reliable client IP extraction, supporting Cloudflare and other proxies. */
function getClientIp(req) {
    // Cloudflare specific header
    if (req.headers['cf-connecting-ip']) {
        return normalizeClientIp(req.headers['cf-connecting-ip']);
    }
    
    // Standard forwarded-for
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return normalizeClientIp(String(forwarded).split(',')[0]);
    }
    
    return normalizeClientIp(req.socket.remoteAddress || '');
}

/** Values to match legacy chat rows (with or without IPv4-mapped prefix). */
function ipLookupVariants(raw) {
    const n = normalizeClientIp(raw);
    if (!n) return [];
    const set = new Set([n, String(raw).trim()]);
    if (n.includes('.') && !n.includes(':')) {
        set.add(`::ffff:${n}`);
    }
    return [...set];
}

app.get('/api/get-ip', (req, res) => {
    res.json({ ip: getClientIp(req) });
});

/** Resolve TikTok page URLs to a direct MP4 via tikwm (for <video> playback; not an iframe embed). */
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

app.get('/api/tiktok-resolve', async (req, res) => {
    const raw = req.query.url;
    if (!raw || typeof raw !== 'string') {
        return res.status(400).json({ error: 'Missing url' });
    }
    let pageUrl;
    try {
        pageUrl = raw.trim();
    } catch {
        pageUrl = raw;
    }
    let parsed;
    try {
        parsed = new URL(pageUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid url' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: 'Invalid url scheme' });
    }
    if (!isAllowedTikTokResolveHost(parsed.hostname)) {
        return res.status(400).json({ error: 'URL host not allowed' });
    }

    try {
        const pageUrl = raw.trim();
        const bypassCache = req.query.nocache === '1';

        if (!bypassCache) {
            const cached = await TikTokCache.findOne({ url: pageUrl });
            if (cached && (Date.now() - cached.updatedAt.getTime() < 4 * 60 * 60 * 1000)) {
                return res.json({
                    play: cached.play,
                    cover: cached.cover,
                    title: cached.title,
                    cached: true
                });
            }
        }

        const mirrors = [
            `https://www.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`,
            `https://api.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`
        ];

        let lastError = null;
        for (const upstream of mirrors) {
            try {
                const r = await fetch(upstream, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(8000)
                });

                if (r.ok) {
                    const json = await r.json();
                    if (json.code === 0 && json.data && json.data.play) {
                        const d = json.data;
                        const result = {
                            play: d.play,
                            cover: d.cover || d.origin_cover || '',
                            title: d.title || ''
                        };

                        // Update cache
                        await TikTokCache.findOneAndUpdate(
                            { url: pageUrl },
                            { ...result, updatedAt: new Date() },
                            { upsert: true }
                        ).catch(e => console.error('Cache update failed:', e));

                        return res.json(result);
                    }
                    lastError = json;
                }
            } catch (e) {
                lastError = e.message;
            }
        }
        // Fallback to oEmbed for basic metadata (thumbnail/title)
        try {
            const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(pageUrl)}`;
            const or = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(5000) });
            if (or.ok) {
                const oj = await or.json();
                return res.json({
                    play: '',
                    cover: oj.thumbnail_url || '',
                    title: oj.title || '',
                    is_fallback: true
                });
            }
        } catch (e) {
            console.error('oEmbed fallback failed:', e);
        }

        console.error(`Resolution failed for ${pageUrl}:`, lastError);
        res.status(404).json({ error: 'Video unavailable' });
    } catch (err) {
        console.error('Resolver internal error:', err);
        res.status(500).json({ error: 'Resolve failed' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body || {};
    const u = username == null ? '' : String(username).trim();
    const p = password == null ? '' : String(password);

    if (!u || !p) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const admin = await Admin.findOne({ username: u }).lean();
        if (!admin || !admin.passwordHash) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const match = await bcrypt.compare(p, admin.passwordHash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + ADMIN_SESSION_MS);
        
        await Session.create({ token, expiresAt });
        
        res.json({ token, expiresIn: ADMIN_SESSION_MS });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/admin/session', requireAdmin, (req, res) => {
    res.json({ ok: true });
});

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ')) {
        const token = h.slice(7);
        await Session.deleteOne({ token });
    }
    res.json({ ok: true });
});

app.get('/api/socials', async (req, res) => {
    const socials = await Social.find();
    res.json(socials);
});
app.post('/api/socials', requireAdmin, async (req, res) => {
    const social = new Social(req.body);
    await social.save();
    res.json(social);
});
app.put('/api/socials/:id', requireAdmin, async (req, res) => {
    const social = await Social.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(social);
});
app.delete('/api/socials/:id', requireAdmin, async (req, res) => {
    try {
        const social = await Social.findById(req.params.id);
        if (social && social.icon) {
            await deleteFileFromSupabase(social.icon);
        }
        await Social.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete social' });
    }
});

app.post('/api/admin/heartbeat', requireAdmin, (req, res) => {
    const { forceStatus } = req.body || {};
    if (forceStatus === 'offline') {
        lastAdminHeartbeat = 0; // Force offline
    } else {
        lastAdminHeartbeat = Date.now();
    }
    console.log(`Admin status updated: ${forceStatus || 'heartbeat'} at ${new Date().toLocaleTimeString()}`);
    res.json({ success: true });
});

app.get('/api/admin/status', (req, res) => {
    const isOnline = (Date.now() - lastAdminHeartbeat) < 15000; // Online if heartbeat in last 15s
    res.json({ online: isOnline });
});


app.get('/api/presets', async (req, res) => {
    const presets = await Preset.find();
    res.json(presets);
});
app.post('/api/presets', requireAdmin, async (req, res) => {
    const preset = new Preset(req.body);
    await preset.save();
    res.json(preset);
});
app.put('/api/presets/:id', requireAdmin, async (req, res) => {
    const preset = await Preset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(preset);
});
app.delete('/api/presets/:id', requireAdmin, async (req, res) => {
    try {
        const preset = await Preset.findById(req.params.id);
        if (preset && preset.url) {
            await deleteFileFromSupabase(preset.url);
        }
        await Preset.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});

app.get('/api/presets/:id', async (req, res) => {
    try {
        const preset = await Preset.findById(req.params.id);
        if (!preset) return res.status(404).json({ error: 'Preset not found' });
        res.json(preset);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch preset' });
    }
});

app.post('/api/presets/:id/like', async (req, res) => {
    const presetId = req.params.id;
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0] : null)?.trim() || req.socket.remoteAddress;
    const ip = normalizeClientIp(rawIp);

    try {
        const existingLike = await Like.findOne({ presetId, ip });
        if (existingLike) {
            return res.status(400).json({ error: 'Already liked from this IP' });
        }

        const preset = await Preset.findById(presetId);
        if (!preset) return res.status(404).json({ error: 'Preset not found' });

        preset.likes = (preset.likes || 0) + 1;
        await preset.save();

        const like = new Like({ presetId, ip });
        await like.save();

        res.json({ success: true, likes: preset.likes });
    } catch (err) {
        console.error('Like error:', err);
        res.status(500).json({ error: 'Failed to like preset' });
    }
});

app.get('/api/resources', async (req, res) => {
    const resources = await Resource.find();
    res.json(resources);
});
app.post('/api/resources', requireAdmin, async (req, res) => {
    const resource = new Resource(req.body);
    await resource.save();
    res.json(resource);
});
app.put('/api/resources/:id', requireAdmin, async (req, res) => {
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(resource);
});
app.delete('/api/resources/:id', requireAdmin, async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (resource) {
            if (resource.url) {
                await deleteFileFromSupabase(resource.url);
            }
            if (resource.icon) {
                await deleteFileFromSupabase(resource.icon);
            }
        }
        await Resource.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete resource' });
    }
});

app.get('/api/chats', requireAdmin, async (req, res) => {
    const chats = await Chat.find().sort({ lastUpdate: -1 }).lean();
    const now = new Date();
    const formattedChats = chats.map(c => ({
        ...c,
        online: (now - new Date(c.lastUpdate)) < 15000 // Online if active in last 15s
    }));
    res.json(formattedChats);
});

app.get('/api/chats/check', async (req, res) => {
    let raw = req.query.ip;
    if (raw == null || String(raw).trim() === '') {
        return res.status(400).json({ error: 'Missing ip' });
    }
    raw = String(raw).trim();
    try {
        raw = decodeURIComponent(raw);
    } catch {
        /* use raw */
    }
    const variants = ipLookupVariants(raw);
    const chat = await Chat.findOne({ ip: { $in: variants } });
    if (chat) res.json(chat);
    else res.json(null);
});

app.post('/api/chats', async (req, res) => {
    const normalizedIp = normalizeClientIp(req.body.ip || '');
    const variants = ipLookupVariants(req.body.ip || '');
    let chat = await Chat.findOne({ ip: { $in: variants } });
    if (chat) {
        if (chat.blocked) return res.status(403).json({ error: 'You are blocked' });

        if (req.body.name && !req.body.name.includes('Returning User')) {
            chat.name = req.body.name;
        }
        if (normalizedIp && chat.ip !== normalizedIp) {
            chat.ip = normalizedIp;
        }
        chat.lastUpdate = Date.now();
        await chat.save();
        res.json(chat);
    } else {
        chat = new Chat({
            ...req.body,
            ip: normalizedIp || req.body.ip,
            lastUpdate: Date.now()
        });
        await chat.save();
        res.json(chat);
    }
});

app.get('/api/chats/:id', requireAdmin, async (req, res) => {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat deleted' });
    res.json(chat);
});

app.delete('/api/chats/:id', requireAdmin, async (req, res) => {
    try {
        const chatId = req.params.id;
        console.log(`Starting cleanup for chat: ${chatId}`);

        const messages = await Message.find({ chatId });
        const supabaseUrl = process.env.SUPABASE_URL;
        const bucket = process.env.SUPABASE_BUCKET;
        const supabaseKey = process.env.SUPABASE_KEY;

        const filesToDelete = [];
        messages.forEach(msg => {
            // Updated regex to be more robust
            const match = msg.text.match(/\[.*?\]\((https:\/\/.*?supabase\.co\/storage\/v1\/object\/public\/.*?)\)/);
            if (match) {
                const fullUrl = match[1];
                const searchStr = `/public/${bucket}/`;
                const index = fullUrl.indexOf(searchStr);
                if (index !== -1) {
                    const filePath = fullUrl.substring(index + searchStr.length);
                    filesToDelete.push(filePath);
                }
            }
        });

        console.log(`Found ${filesToDelete.length} files to delete:`, filesToDelete);

        if (filesToDelete.length > 0) {
            const deleteUrl = `${supabaseUrl}/storage/v1/object/${bucket}`;
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prefixes: filesToDelete })
            });

            const result = await response.json().catch(() => ({}));
            console.log('Supabase delete response:', result);
        }

        await Message.deleteMany({ chatId });
        await Chat.findByIdAndDelete(chatId);

        res.json({ success: true });
    } catch (err) {
        console.error('Chat deletion error:', err);
        res.status(500).json({ error: 'Failed to delete chat' });
    }
});

app.post('/api/chats/:id/heartbeat', async (req, res) => {
    await Chat.findByIdAndUpdate(req.params.id, { lastUpdate: Date.now() });
    res.json({ success: true });
});

app.patch('/api/chats/:id/block', requireAdmin, async (req, res) => {
    const chat = await Chat.findById(req.params.id);
    if (chat) {
        chat.blocked = !chat.blocked;
        await chat.save();
        res.json(chat);
    } else {
        res.status(404).json({ error: 'Chat not found' });
    }
});

app.get('/api/messages/:chatId', async (req, res) => {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat deleted' });
    const messages = await Message.find({ chatId: req.params.chatId }).sort({ timestamp: 1 });
    res.json(messages);
});

app.post('/api/messages', async (req, res) => {
    try {
        const chat = await Chat.findById(req.body.chatId);
        if (!chat || chat.blocked) return res.status(403).json({ error: 'Chat unavailable or blocked' });

        // Double protection: Ensure text is always a string
        if (req.body && typeof req.body.text !== 'string') {
            req.body.text = '';
        }

        const msg = new Message(req.body);
        await msg.save();

        await Chat.findByIdAndUpdate(req.body.chatId, {
            lastMsg: req.body.text,
            time: req.body.time,
            lastUpdate: Date.now()
        });
        res.json(msg);
    } catch (err) {
        console.error('Message save error:', err);
        res.status(400).json({ error: 'Invalid message data' });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        // Upload to Supabase Storage via REST API
        const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': file.mimetype,
                'x-upsert': 'true'
            },
            body: file.buffer
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Supabase upload error:', errData);
            return res.status(500).json({ error: 'Failed to upload to Supabase' });
        }

        // Return the public URL and size
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        res.json({ url: publicUrl, name: file.originalname, size: sizeInMb });
    } catch (err) {
        console.error('Upload catch error:', err);
        res.status(500).json({ error: 'Server upload error' });
    }
});

async function deleteFileFromSupabase(url) {
    if (!url || !url.includes('supabase.co/storage/v1/object/public')) return;
    
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const bucket = process.env.SUPABASE_BUCKET;
        const supabaseKey = process.env.SUPABASE_KEY;

        const searchStr = `/public/${bucket}/`;
        const index = url.indexOf(searchStr);
        if (index === -1) return;

        const filePath = url.substring(index + searchStr.length);
        const deleteUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

        await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
    } catch (err) {
        console.error('Supabase auto-delete error:', err);
    }
}

app.delete('/api/upload', requireAdmin, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    await deleteFileFromSupabase(url);
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
