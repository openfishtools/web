const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'dist-cf');
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MiB Cloudflare Pages limit

const COPY_TARGETS = [
    'index.html',
    'admin.html',
    'favicon.ico',
    'coi-serviceworker.min.js',
    'sw.js',
    't_version.json',
    '_headers',
    '_redirects',
    'assets',
    'scripts',
    'styles',
    'userscript',
    'functions'
];

function rmDirRecursive(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src);
        for (const entry of entries) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        if (stat.size > MAX_FILE_SIZE) {
            const relPath = path.relative(ROOT_DIR, src);
            const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
            console.log(`\x1b[33m[CF Build] Skipping file > 25 MiB:\x1b[0m ${relPath} (${sizeMb} MB) -> Will load from CDN/GitHub`);
            return;
        }
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
    }
}

console.log('\x1b[36m====================================================\x1b[0m');
console.log('\x1b[36m  Preparing Cloudflare Pages Staging Build (dist-cf) \x1b[0m');
console.log('\x1b[36m====================================================\x1b[0m\n');

rmDirRecursive(OUT_DIR);
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const target of COPY_TARGETS) {
    const srcPath = path.join(ROOT_DIR, target);
    const destPath = path.join(OUT_DIR, target);
    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
    }
}

console.log('\n\x1b[32m[CF Build Done]\x1b[0m Staging folder ready at: dist-cf');
console.log('To deploy to Cloudflare Pages without pushing to GitHub, run:');
console.log('\x1b[35m  npx wrangler pages deploy dist-cf --project-name=editorstuff\x1b[0m\n');
