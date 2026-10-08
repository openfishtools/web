function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getEnvTrollHtml(clientIp = '127.0.0.1', userAgent = 'Unknown Device', targetPath = '/.env') {
    const safeIp = escapeHtml(clientIp);
    const safeUa = escapeHtml(userAgent);
    const safePath = escapeHtml(targetPath);
    const nowStr = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'full',
        timeStyle: 'medium'
    }) + ' WIB';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safePath} - Environment Variables</title>
    <link rel="icon" href="/favicon.ico">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
            min-height: 100vh;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            padding: 20px;
        }

        /* Fake .env plaintext look */
        #fake-env {
            white-space: pre-wrap;
            word-break: break-all;
            line-height: 1.6;
            font-size: 13.5px;
            color: #79c0ff;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .env-comment { color: #8b949e; }
        .env-key { color: #7ee787; }
        .env-val { color: #a5d6ff; }
        .env-secret { color: #ff7b72; }

        /* Troll Container (Hidden initially) */
        #troll-container {
            display: none;
            width: 100%;
            max-width: 620px;
            margin: auto;
            text-align: center;
            opacity: 0;
            transform: scale(0.92);
            transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #troll-container.active {
            display: block;
            opacity: 1;
            transform: scale(1);
        }

        /* Glitch Shake Animation */
        body.glitching {
            animation: glitchShake 0.4s ease forwards;
        }

        @keyframes glitchShake {
            0% { transform: translate(0, 0); filter: invert(0); }
            20% { transform: translate(-8px, 6px); filter: invert(0.8) hue-rotate(90deg); }
            40% { transform: translate(8px, -6px); filter: invert(0.4) hue-rotate(180deg); }
            60% { transform: translate(-5px, 3px); filter: invert(0.9) hue-rotate(270deg); }
            80% { transform: translate(4px, -3px); filter: invert(0.2); }
            100% { transform: translate(0, 0); filter: invert(0); }
        }

        /* Troll Card Styling */
        .troll-card {
            background: rgba(22, 27, 34, 0.85);
            border: 1px solid rgba(56, 189, 248, 0.3);
            box-shadow: 0 0 50px rgba(56, 189, 248, 0.15), 0 20px 40px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-radius: 20px;
            padding: 36px 28px;
            margin: 20px 0;
            position: relative;
            overflow: hidden;
        }

        .troll-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc, #38bdf8);
            background-size: 200% 100%;
            animation: moveGradient 3s linear infinite;
        }

        @keyframes moveGradient {
            0% { background-position: 0% 0%; }
            100% { background-position: 200% 0%; }
        }

        .mascot-icon {
            font-size: 54px;
            line-height: 1;
            margin-bottom: 12px;
            display: inline-block;
            animation: bounce 1.8s ease infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }

        .troll-title {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #ffffff;
            margin-bottom: 6px;
            text-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .troll-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.4);
            color: #f87171;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 16px;
        }

        .troll-quote {
            font-size: 15px;
            color: #94a3b8;
            line-height: 1.5;
            margin-bottom: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .troll-quote strong {
            color: #38bdf8;
        }

        /* Dossier Table */
        .dossier-box {
            background: rgba(13, 17, 23, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            margin-bottom: 24px;
            font-size: 12.5px;
        }

        .dossier-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 7px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .dossier-row:last-child {
            border-bottom: none;
        }

        .dossier-label {
            color: #64748b;
            font-weight: 500;
        }

        .dossier-val {
            font-weight: 600;
            word-break: break-all;
            text-align: right;
            max-width: 65%;
        }

        .dossier-ip {
            color: #38bdf8;
            font-size: 14px;
            font-weight: 700;
            text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
        }

        .dossier-hooked {
            color: #4ade80;
        }

        /* Buttons */
        .btn-group {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .troll-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 11px 20px;
            border-radius: 10px;
            font-size: 13.5px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            cursor: pointer;
        }

        .btn-primary {
            background: #38bdf8;
            color: #041019;
            box-shadow: 0 4px 15px rgba(56, 189, 248, 0.35);
        }

        .btn-primary:hover {
            background: #7dd3fc;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(56, 189, 248, 0.45);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.12);
            transform: translateY(-2px);
        }

        .footer-note {
            font-size: 11px;
            color: #475569;
            margin-top: 18px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
    </style>
</head>
<body>
    <div id="fake-env"><span class="env-comment"># ========================================================
# CUTEFISH PRODUCTION SECRETS - SENSITIVE CONFIGURATION
# DO NOT EXPOSE OR SHARE WITH THIRD PARTIES
# ========================================================</span>

<span class="env-key">NODE_ENV</span>=<span class="env-val">production</span>
<span class="env-key">PORT</span>=<span class="env-val">3000</span>
<span class="env-key">MONGODB_URI</span>=<span class="env-secret">"mongodb+srv://admin_cutefish:p4ssw0rd9981@cluster0.db.mongodb.net/production?retryWrites=true&w=majority"</span>
<span class="env-key">PROXY_SECRET</span>=<span class="env-secret">"fe4aecf5e702eb1aa2145ae9e9e837482759bd0d7d7b25d0"</span>
<span class="env-key">JWT_SECRET</span>=<span class="env-secret">"cf_jwt_auth_super_secret_token_prod_99"</span>
<span class="env-key">TIKTOK_API_KEY</span>=<span class="env-secret">"tt_session_prod_live_890123"</span>
<span class="env-key">AWS_ACCESS_KEY_ID</span>=<span class="env-val">"AKIAIOSFODNN7EXAMPLE"</span>
<span class="env-key">AWS_SECRET_ACCESS_KEY</span>=<span class="env-secret">"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"</span></div>

    <div id="troll-container">
        <div class="troll-card">
            <div class="mascot-icon">🐟📸</div>
            <div class="troll-badge">🚨 Caught in 4K by Cutefish Shield</div>
            <h1 class="troll-title">TERCIDUK DI 4K!</h1>
            <p class="troll-quote">
                Cieee mau nyolong file <strong>${safePath}</strong> ya? Ketahuan lu! 😏<br>
                Di sini gak ada password database masbro, yang ada cuma ikan lucu.
            </p>

            <div class="dossier-box">
                <div class="dossier-row">
                    <span class="dossier-label">🌐 IP Kamu</span>
                    <span class="dossier-val dossier-ip">${safeIp}</span>
                </div>
                <div class="dossier-row">
                    <span class="dossier-label">📁 Target Probe</span>
                    <span class="dossier-val" style="color:#fcd34d;">${safePath}</span>
                </div>
                <div class="dossier-row">
                    <span class="dossier-label">⏰ Waktu Terciduk</span>
                    <span class="dossier-val" style="color:#e2e8f0;">${nowStr}</span>
                </div>
                <div class="dossier-row">
                    <span class="dossier-label">💻 Device / Browser</span>
                    <span class="dossier-val" style="color:#94a3b8; font-size:11px;">${safeUa}</span>
                </div>
                <div class="dossier-row">
                    <span class="dossier-label">🎣 Status Insiden</span>
                    <span class="dossier-val dossier-hooked">Terpancing Umpan Ikan (FishHooked)</span>
                </div>
            </div>

            <div class="btn-group">
                <a href="/" class="troll-btn btn-primary">Kembali ke Jalan yang Benar</a>
                <a href="https://www.tiktok.com/@cutefishaep" target="_blank" rel="noopener noreferrer" class="troll-btn btn-secondary">Minta Maaf ke Cutefish</a>
            </div>

            <p class="footer-note">
                cutefish.my.id • Next-Gen Creator Hub & Patcher Security
            </p>
        </div>
    </div>

    <script>
        setTimeout(function() {
            var fakeEl = document.getElementById('fake-env');
            var trollEl = document.getElementById('troll-container');

            document.body.classList.add('glitching');

            setTimeout(function() {
                document.body.classList.remove('glitching');
                if (fakeEl) fakeEl.style.display = 'none';
                if (trollEl) trollEl.classList.add('active');
            }, 400);
        }, 2000);
    </script>
</body>
</html>`;
}
