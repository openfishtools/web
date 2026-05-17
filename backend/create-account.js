/**
 * Create or update an admin user in MongoDB (password stored as bcrypt hash).
 *
 * Usage:
 *   node create-account.js <username> "<password>"
 *
 * Example:
 *   node create-account.js cutefishae 'your-secure-password'
 *
 * Only MONGODB_URI is read from .env — not ADMIN_USERNAME / ADMIN_PASSWORD.
 */
require('dotenv').config();
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

const BCRYPT_ROUNDS = 12;

async function main() {
    const username = process.argv[2];
    const password = process.argv[3];

    if (!username || !password) {
        console.error('Usage: node create-account.js <username> <password>');
        console.error('Tip: quote the password if it contains spaces or shell metacharacters.');
        process.exit(1);
    }

    if (!process.env.MONGODB_URI) {
        console.error('Missing MONGODB_URI in .env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const doc = await Admin.findOneAndUpdate(
        { username },
        { username, passwordHash },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('Admin user saved:', doc.username);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
