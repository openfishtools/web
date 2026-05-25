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
const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:admin@cutefish.my.id',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);
const Admin = require('./models/Admin');
const Session = require('./models/Session');

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

const app = express();
app.use(cors());
app.use(express.json());

/** Note: Vercel (Serverless) memory is transient, so sessions are stored in MongoDB. */
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

// Global Mongoose connection management for Serverless
let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const db = await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = db;
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
    icon: String
});
const Social = mongoose.models.Social || mongoose.model('Social', SocialSchema);

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
const Preset = mongoose.models.Preset || mongoose.model('Preset', PresetSchema);

const TikTokCacheSchema = new mongoose.Schema({
    url: { type: String, unique: true },
    play: String,
    cover: String,
    title: String,
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
});
const Resource = mongoose.models.Resource || mongoose.model('Resource', ResourceSchema);


const MessageSchema = new mongoose.Schema({
    chatId: String,
    text: String,
    type: String,
    time: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

const ChatSchema = new mongoose.Schema({
    name: String,
    ip: String,
    lastMsg: String,
    time: String,
    blocked: { type: Boolean, default: false },
    lastUpdate: { type: Date, default: Date.now }
});
const Chat = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);

const LikeSchema = new mongoose.Schema({
    presetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preset' },
    ip: String,
    timestamp: { type: Date, default: Date.now }
});
const Like = mongoose.models.Like || mongoose.model('Like', LikeSchema);

const PushSubscriptionSchema = new mongoose.Schema({
    endpoint: { type: String, unique: true },
    keys: { p256dh: String, auth: String },
    createdAt: { type: Date, default: Date.now }
});
const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);

async function sendPushToAdmins(title, body, tag) {
    const subs = await PushSubscription.find({});
    const payload = JSON.stringify({ title, body, tag, url: '/admin.html#chat' });
    await Promise.allSettled(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
            } catch (err) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await PushSubscription.deleteOne({ endpoint: sub.endpoint });
                }
            }
        })
    );
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
            if (cached && (Date.now() - cached.updatedAt.getTime() < 4 * 60 * 60 * 1000)) {
                return res.json({ play: cached.play, cover: cached.cover, title: cached.title, cached: true });
            }
        }

        const mirrors = [
            `https://www.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`,
            `https://api.tikwm.com/api/?url=${encodeURIComponent(pageUrl)}`
        ];

        for (const upstream of mirrors) {
            try {
                const r = await fetch(upstream, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(8000)
                });
                if (r.ok) {
                    const json = await r.json();
                    if (json.code === 0 && json.data && json.data.play) {
                        const d = json.data;
                        const result = { play: d.play, cover: d.cover || d.origin_cover || '', title: d.title || '' };
                        await TikTokCache.findOneAndUpdate({ url: pageUrl }, { ...result, updatedAt: new Date() }, { upsert: true });
                        return res.json(result);
                    }
                }
            } catch (e) { /* try next */ }
        }
        res.status(404).json({ error: 'Video unavailable' });
    } catch (err) {
        res.status(500).json({ error: 'Resolve failed' });
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
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + ADMIN_SESSION_MS);
        
        await Session.create({ token, expiresAt });
        
        res.json({ token, expiresIn: ADMIN_SESSION_MS });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ ok: true }));

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
    const h = req.headers.authorization;
    if (h && h.startsWith('Bearer ')) {
        const token = h.slice(7);
        await Session.deleteOne({ token });
    }
    res.json({ ok: true });
});

app.get('/api/socials', async (req, res) => res.json(await Social.find()));
app.post('/api/socials', requireAdmin, async (req, res) => res.json(await new Social(req.body).save()));
app.put('/api/socials/:id', requireAdmin, async (req, res) => res.json(await Social.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/socials/:id', requireAdmin, async (req, res) => {
    const s = await Social.findById(req.params.id);
    if (s && s.icon) await deleteFileFromSupabase(s.icon);
    await Social.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.post('/api/admin/heartbeat', requireAdmin, (req, res) => {
    const { forceStatus } = req.body || {};
    lastAdminHeartbeat = forceStatus === 'offline' ? 0 : Date.now();
    res.json({ success: true });
});

app.get('/api/admin/status', (req, res) => res.json({ online: (Date.now() - lastAdminHeartbeat) < 15000 }));

app.get('/api/presets', async (req, res) => {
    try {
        const ip = getClientIp(req);
        const presets = await Preset.find().lean();
        
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
app.post('/api/presets', requireAdmin, async (req, res) => res.json(await new Preset(req.body).save()));
app.put('/api/presets/:id', requireAdmin, async (req, res) => res.json(await Preset.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/presets/:id', requireAdmin, async (req, res) => {
    const p = await Preset.findById(req.params.id);
    if (p) {
        // Delete legacy single url
        if (p.url) await deleteFileFromSupabase(p.url);
        // Delete all urls in the urls array
        if (Array.isArray(p.urls)) {
            await Promise.all(p.urls.map(entry => deleteFileFromSupabase(entry.url)));
        }
    }
    await Preset.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.get('/api/presets/:id', async (req, res) => res.json(await Preset.findById(req.params.id)));

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

app.get('/api/resources', async (req, res) => res.json(await Resource.find()));
app.post('/api/resources', requireAdmin, async (req, res) => res.json(await new Resource(req.body).save()));
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
            if (r.url) await deleteFileFromSupabase(r.url);
            if (r.icon) await deleteFileFromSupabase(r.icon);
            await r.deleteOne();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/chats', requireAdmin, async (req, res) => {
    const chats = await Chat.find().sort({ lastUpdate: -1 }).lean();
    const now = new Date();
    res.json(chats.map(c => ({ ...c, online: (now - new Date(c.lastUpdate)) < 15000 })));
});

app.get('/api/chats/check', async (req, res) => {
    const variants = ipLookupVariants(req.query.ip);
    res.json(await Chat.findOne({ ip: { $in: variants } }));
});

app.post('/api/chats', async (req, res) => {
    const ip = normalizeClientIp(req.body.ip || '');
    const variants = ipLookupVariants(req.body.ip || '');
    let chat = await Chat.findOne({ ip: { $in: variants } });
    if (chat) {
        if (chat.blocked) return res.status(403).json({ error: 'Blocked' });
        if (req.body.name && !req.body.name.includes('Returning User')) chat.name = req.body.name;
        chat.lastUpdate = Date.now();
        await chat.save();
        res.json(chat);
    } else {
        chat = await new Chat({ ...req.body, ip, lastUpdate: Date.now() }).save();
        res.json(chat);
    }
});

app.delete('/api/chats/:id', requireAdmin, async (req, res) => {
    const chatId = req.params.id;
    const messages = await Message.find({ chatId });
    const bucket = process.env.SUPABASE_BUCKET;
    const filesToDelete = [];
    messages.forEach(msg => {
        const match = msg.text.match(/\[.*?\]\((https:\/\/.*?supabase\.co\/storage\/v1\/object\/public\/.*?)\)/);
        if (match) {
            const fullUrl = match[1];
            const searchStr = `/public/${bucket}/`;
            const index = fullUrl.indexOf(searchStr);
            if (index !== -1) filesToDelete.push(fullUrl.substring(index + searchStr.length));
        }
    });
    if (filesToDelete.length > 0) {
        await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${process.env.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: filesToDelete })
        });
    }
    await Message.deleteMany({ chatId });
    await Chat.findByIdAndDelete(chatId);
    res.json({ success: true });
});

app.get('/api/chats/:id', requireAdmin, async (req, res) => {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat deleted' });
    res.json(chat);
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
    res.json(await Message.find({ chatId: req.params.chatId }).sort({ timestamp: 1 }));
});

app.post('/api/messages', async (req, res) => {
    const chat = await Chat.findById(req.body.chatId);
    if (!chat || chat.blocked) return res.status(403).json({ error: 'Blocked or unavailable' });
    const msg = await new Message({ ...req.body, timestamp: Date.now() }).save();
    await Chat.findByIdAndUpdate(req.body.chatId, { lastMsg: req.body.text, time: req.body.time, lastUpdate: Date.now() });
    if (req.body.type !== 'received') {
        sendPushToAdmins(
            `Message from ${chat.name}`,
            req.body.text && req.body.text.startsWith('📁') ? 'Shared a file' : req.body.text,
            chat._id.toString()
        ).catch(() => {});
    }
    res.json(msg);
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname}`;
        const filePath = `uploads/${fileName}`;
        const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_BUCKET}/${filePath}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.SUPABASE_KEY}`, 'Content-Type': file.mimetype, 'x-upsert': 'true' },
            body: file.buffer
        });
        if (!response.ok) return res.status(500).json({ error: 'Supabase error' });
        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${filePath}`;
        res.json({ url: publicUrl, name: file.originalname, size: (file.size / (1024 * 1024)).toFixed(2) + ' MB' });
    } catch (err) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

async function deleteFileFromSupabase(url) {
    if (!url || !url.includes('supabase.co/storage/v1/object/public')) return;
    try {
        const bucket = process.env.SUPABASE_BUCKET;
        const searchStr = `/public/${bucket}/`;
        const index = url.indexOf(searchStr);
        if (index === -1) return;
        const filePath = url.substring(index + searchStr.length);
        await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
        });
    } catch (e) { /* ignore */ }
}

app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', requireAdmin, async (req, res) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });
    await PushSubscription.findOneAndUpdate(
        { endpoint },
        { endpoint, keys },
        { upsert: true, new: true }
    );
    res.json({ success: true });
});

app.delete('/api/push/subscribe', requireAdmin, async (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
});

app.delete('/api/upload', requireAdmin, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    await deleteFileFromSupabase(url);
    res.json({ success: true });
});

app.get('/api/compress-auth', (req, res) => {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    
    if (!privateKey || !publicKey || !urlEndpoint) {
        console.error('Missing ImageKit environment variables');
        return res.status(500).json({ error: 'Video Compressor environment variables are missing (require IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_URL_ENDPOINT)' });
    }
    
    try {
        const token = crypto.randomBytes(16).toString('hex');
        const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
        
        const signature = crypto
          .createHmac("sha1", privateKey)
          .update(token + expire)
          .digest("hex");
          
        res.json({
            token,
            expire,
            signature,
            publicKey,
            urlEndpoint
        });
    } catch (err) {
        console.error('Error generating auth signature:', err);
        res.status(500).json({ error: 'Failed to generate auth signature' });
    }
});

app.get('/api/check-ready', async (req, res) => {
    const url = req.query.url;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url query parameter' });
    }
    
    try {
        const response = await fetch(url, { method: 'GET', redirect: 'manual' });
        if (response.status === 200) {
            return res.json({ ready: true });
        } else {
            return res.json({ ready: false, status: response.status });
        }
    } catch (err) {
        console.error('Error in check-ready:', err);
        return res.status(500).json({ error: 'Failed to verify URL status' });
    }
});

module.exports = app;
