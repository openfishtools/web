const fs = require('fs');
const path = require('path');

// When building on Vercel (Backend Only)
if (process.env.VERCEL) {
    console.log('\x1b[32m[Vercel Build]\x1b[0m Detected Vercel backend environment. Skipping frontend build.');
    process.exit(0);
}

// When building on Cloudflare or locally
const cfScript = path.join(__dirname, 'build-cf.js');
if (fs.existsSync(cfScript)) {
    require('./build-cf.js');
} else {
    console.log('[Build] Static build complete.');
}
