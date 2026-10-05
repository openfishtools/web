document.addEventListener('DOMContentLoaded', () => {
    const greetingPhrases = [
        "Hello, I'm",
        "Halo, aku",
        "Sugeng rawuh, kulo",
        "ꦱꦸꦒꦼꦁ ꦫꦮꦸꦃ꧈ ꦏꦸꦭ",
        "Sampurasun, abdi",
        "Horas, au",
        "Om Swastyastu, tiang",
        "Halo, ambo",
        "Tabe', nakke",
        "Halo, ulun",
        "Bonjour, je suis",
        "こんにちは、",
        "¡Hola! Soy",
        "안녕하세요, 저는",
        "Guten Tag, ich bin",
        "你好，我是",
        "Ciao, sono",
        "مرحباً، أنا",
        "Kumusta, ako si",
        "Привет, я",
        "Olá, eu sou"
    ];

    const nameAliases = [
        "CUTEFISH",
        "CHELSEA",
        "WAHYU"
    ];

    const nonEnglishIndices = greetingPhrases.map((_, i) => i).filter(i => greetingPhrases[i] !== "Hello, I'm");
    let currentGreetingIdx = nonEnglishIndices[Math.floor(Math.random() * nonEnglishIndices.length)];
    let currentNameIdx = Math.floor(Math.random() * nameAliases.length);

    const greetingCurrent = document.getElementById('greeting-current');
    const greetingNext = document.getElementById('greeting-next');
    const nameCurrent = document.getElementById('name-current');
    const nameNext = document.getElementById('name-next');

    const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

    function buildCharElements(text, charClassPrefix) {
        const fragment = document.createDocumentFragment();
        const isArabic = /[\u0600-\u06FF]/.test(text);

        if (isArabic) {
            const words = text.split(' ');
            words.forEach((word, i) => {
                if (i > 0) {
                    const space = document.createElement('span');
                    space.className = 'flip-space';
                    fragment.appendChild(space);
                }
                const span = document.createElement('span');
                const delayClass = `cd-${Math.min(i * 3, 20)}`;
                span.className = `flip-char ${charClassPrefix} ${delayClass}`;
                span.textContent = word;
                span.setAttribute('dir', 'rtl');
                fragment.appendChild(span);
            });
        } else {
            const chars = graphemeSegmenter ? Array.from(graphemeSegmenter.segment(text), s => s.segment) : Array.from(text);
            chars.forEach((char, i) => {
                if (char === ' ') {
                    const space = document.createElement('span');
                    space.className = 'flip-space';
                    fragment.appendChild(space);
                } else {
                    const span = document.createElement('span');
                    const delayClass = `cd-${Math.min(i, 20)}`;
                    span.className = `flip-char ${charClassPrefix} ${delayClass}`;
                    span.textContent = char;
                    fragment.appendChild(span);
                }
            });
        }
        return fragment;
    }

    function initLayers() {
        if (greetingCurrent) {
            greetingCurrent.innerHTML = '';
            greetingCurrent.appendChild(buildCharElements(greetingPhrases[currentGreetingIdx], 'char-idle'));
        }
        if (nameCurrent) {
            nameCurrent.innerHTML = '';
            nameCurrent.appendChild(buildCharElements(nameAliases[currentNameIdx], 'char-idle'));
        }
    }

    function executeFlip(currentEl, nextEl, newText) {
        if (!currentEl || !nextEl) return;

        nextEl.innerHTML = '';
        nextEl.appendChild(buildCharElements(newText, 'char-flip-in'));

        const currentChars = currentEl.querySelectorAll('.flip-char');
        currentChars.forEach((span, i) => {
            const delayClass = `cd-${Math.min(i, 20)}`;
            span.className = `flip-char char-flip-out ${delayClass}`;
        });

        const charCount = Math.max(currentChars.length, Array.from(newText).length);
        const maxDelay = Math.min(charCount, 20) * 24;
        const totalDuration = maxDelay + 400;

        setTimeout(() => {
            currentEl.innerHTML = '';
            currentEl.appendChild(buildCharElements(newText, 'char-idle'));
            nextEl.innerHTML = '';
        }, totalDuration);
    }

    if (greetingCurrent && nameCurrent) {
        initLayers();
        function cycleAnalogTitle() {
            if (document.hidden) return;
            const homeView = document.getElementById('view-home');
            if (!homeView || !homeView.classList.contains('active-face')) return;
            currentGreetingIdx = (currentGreetingIdx + 1) % greetingPhrases.length;
            currentNameIdx = (currentNameIdx + 1) % nameAliases.length;

            executeFlip(greetingCurrent, greetingNext, greetingPhrases[currentGreetingIdx]);
            setTimeout(() => {
                executeFlip(nameCurrent, nameNext, nameAliases[currentNameIdx]);
            }, 140);
        }
        setInterval(cycleAnalogTitle, 3200);
    }

    const btnExploreJourney = document.getElementById('btn-explore-journey');
    if (btnExploreJourney) {
        btnExploreJourney.addEventListener('click', (e) => {
            e.preventDefault();
            const journeyEl = document.getElementById('journey');
            if (journeyEl) {
                journeyEl.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }


    const canvas = document.getElementById('batik-canvas');
    let ctx = canvas ? canvas.getContext('2d') : null;

    let patternCanvas = null;
    let patternCtx = null;
    let cachedThemeColor = '';
    let gridPattern = null;
    const BATIK_SCALE = 1.5;

    function buildAuthenticKawungPattern(themeColor) {
        if (!patternCanvas) {
            patternCanvas = document.createElement('canvas');
            patternCanvas.width = Math.round(80 * BATIK_SCALE);
            patternCanvas.height = Math.round(80 * BATIK_SCALE);
            patternCtx = patternCanvas.getContext('2d');
        }

        // Gambar tile dalam ruang ter-skala → raster native pada ukuran besar (tidak buram)
        patternCtx.setTransform(BATIK_SCALE, 0, 0, BATIK_SCALE, 0, 0);
        patternCtx.clearRect(0, 0, 80, 80);
        patternCtx.strokeStyle = themeColor;
        patternCtx.fillStyle = themeColor;
        patternCtx.lineWidth = 1.8;
        patternCtx.lineJoin = 'round';


        const pTop = new Path2D('M 40,40 Q 27,26 40,12 Q 53,26 40,40 Z');
        patternCtx.stroke(pTop);
        const pTopInner = new Path2D('M 40,34 Q 32,26 40,18 Q 48,26 40,34 Z');
        patternCtx.stroke(pTopInner);
        patternCtx.beginPath();
        patternCtx.arc(40, 26, 1.8, 0, Math.PI * 2);
        patternCtx.fill();


        const pBottom = new Path2D('M 40,40 Q 27,54 40,68 Q 53,54 40,40 Z');
        patternCtx.stroke(pBottom);
        const pBottomInner = new Path2D('M 40,46 Q 32,54 40,62 Q 48,54 40,46 Z');
        patternCtx.stroke(pBottomInner);
        patternCtx.beginPath();
        patternCtx.arc(40, 54, 1.8, 0, Math.PI * 2);
        patternCtx.fill();


        const pLeft = new Path2D('M 40,40 Q 26,27 12,40 Q 26,53 40,40 Z');
        patternCtx.stroke(pLeft);
        const pLeftInner = new Path2D('M 34,40 Q 26,32 18,40 Q 26,48 34,40 Z');
        patternCtx.stroke(pLeftInner);
        patternCtx.beginPath();
        patternCtx.arc(26, 40, 1.8, 0, Math.PI * 2);
        patternCtx.fill();


        const pRight = new Path2D('M 40,40 Q 54,27 68,40 Q 54,53 40,40 Z');
        patternCtx.stroke(pRight);
        const pRightInner = new Path2D('M 46,40 Q 54,32 62,40 Q 54,48 46,40 Z');
        patternCtx.stroke(pRightInner);
        patternCtx.beginPath();
        patternCtx.arc(54, 40, 1.8, 0, Math.PI * 2);
        patternCtx.fill();


        const pCorners = [
            new Path2D('M 0,0 Q 13,14 0,28 Q -13,14 0,0 Z'),
            new Path2D('M 0,0 Q 14,13 28,0 Q 14,-13 0,0 Z'),
            new Path2D('M 80,0 Q 67,14 80,28 Q 93,14 80,0 Z'),
            new Path2D('M 80,0 Q 66,13 52,0 Q 66,-13 80,0 Z'),
            new Path2D('M 0,80 Q 13,66 0,52 Q -13,66 0,80 Z'),
            new Path2D('M 0,80 Q 14,67 28,80 Q 14,93 0,80 Z'),
            new Path2D('M 80,80 Q 67,66 80,52 Q 93,66 80,80 Z'),
            new Path2D('M 80,80 Q 66,67 52,80 Q 66,93 80,80 Z')
        ];
        pCorners.forEach(p => patternCtx.stroke(p));


        const corners = [[0, 0], [80, 0], [0, 80], [80, 80]];
        corners.forEach(([cx, cy]) => {
            patternCtx.beginPath();
            patternCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            patternCtx.fill();
        });


        patternCtx.beginPath();
        patternCtx.arc(40, 40, 2.6, 0, Math.PI * 2);
        patternCtx.fill();


        const diamonds = [
            [[40, 2], [43, 6], [40, 10], [37, 6]],
            [[40, 70], [43, 74], [40, 78], [37, 74]],
            [[2, 40], [6, 43], [10, 40], [6, 37]],
            [[70, 40], [74, 43], [78, 40], [74, 37]]
        ];
        diamonds.forEach(poly => {
            patternCtx.beginPath();
            patternCtx.moveTo(poly[0][0], poly[0][1]);
            poly.slice(1).forEach(([x, y]) => patternCtx.lineTo(x, y));
            patternCtx.closePath();
            patternCtx.fill();
        });

        cachedThemeColor = themeColor;
    }

    let cachedThemeColorString = '';

    function getThemeColorString(isDark) {
        if (cachedThemeColorString) return cachedThemeColorString;
        const primaryH = getComputedStyle(document.documentElement).getPropertyValue('--primary-h').trim() || '84';
        const primaryS = getComputedStyle(document.documentElement).getPropertyValue('--primary-s').trim() || '50%';
        const primaryL = isDark ? (getComputedStyle(document.documentElement).getPropertyValue('--primary-l').trim() || '50%') : '32%';
        cachedThemeColorString = `hsl(${primaryH}, ${primaryS}, ${primaryL})`;
        return cachedThemeColorString;
    }

    // Batik statis: motif berulang mengisi layar, tiles ke-crop otomatis di tepi canvas
    function renderBatik() {
        if (!ctx || !canvas) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        const isDark = document.documentElement.classList.contains('dark-theme');
        const colorString = getThemeColorString(isDark);
        if (colorString !== cachedThemeColor || !gridPattern) {
            buildAuthenticKawungPattern(colorString);
            gridPattern = ctx.createPattern(patternCanvas, 'repeat');
            cachedThemeColor = colorString;
        }
        ctx.globalAlpha = isDark ? 0.30 : 0.20;
        ctx.fillStyle = gridPattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }

    function triggerRender() {
        renderBatik();
    }

    function startParallaxTransition() {
        renderBatik();
    }

    function resizeBatikCanvas() {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        cachedThemeColor = '';
        renderBatik();
    }

    if (canvas) {
        resizeBatikCanvas();
        let batikResizeTimer = null;
        window.addEventListener('resize', () => {
            if (batikResizeTimer) clearTimeout(batikResizeTimer);
            batikResizeTimer = setTimeout(resizeBatikCanvas, 150);
        });
    }

    const contentScroller = document.getElementById('content-scroller');
    if (contentScroller) {
        contentScroller.addEventListener('scroll', () => {
            if (isModalAnimating && !document.body.classList.contains('legal-modal-open')) {
                cleanupLegalModal();
            }
        }, { passive: true });
    }

    const root = document.documentElement;
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeDots = document.querySelectorAll('.mini-palette-btn');

    const savedThemeColor = localStorage.getItem('cf_theme_color') || 'greentea';
    const savedThemeMode = localStorage.getItem('cf_theme_mode') || 'dark';

    setThemeColor(savedThemeColor);
    setThemeMode(savedThemeMode);

    function setThemeMode(mode) {
        if (mode === 'light') {
            root.classList.remove('dark-theme');
            root.classList.add('light-theme');
            updateThemeIcons('dark_mode');
        } else {
            root.classList.remove('light-theme');
            root.classList.add('dark-theme');
            updateThemeIcons('light_mode');
        }
        localStorage.setItem('cf_theme_mode', mode);
        cachedThemeColor = '';
        cachedThemeColorString = '';
        triggerRender();
    }

    function toggleThemeMode() {
        const isDark = root.classList.contains('dark-theme');
        setThemeMode(isDark ? 'light' : 'dark');
    }

    function updateThemeIcons(iconName) {
        if (themeToggleBtn) {
            const icon = themeToggleBtn.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.textContent = iconName;
            }
        }
    }

    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleThemeMode);

    function setThemeColor(color) {
        root.setAttribute('data-theme', color);
        localStorage.setItem('cf_theme_color', color);
        themeDots.forEach(dot => {
            if (dot.getAttribute('data-color') === color) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        cachedThemeColor = '';
        cachedThemeColorString = '';
        triggerRender();
    }

    themeDots.forEach(dot => {
        dot.addEventListener('click', () => {
            const color = dot.getAttribute('data-color');
            if (color) {
                setThemeColor(color);
            }
        });
    });

    let toastTimer = null;
    let toastExitTimer = null;

    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        let toast = container.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `<span class="material-symbols-rounded">info</span><span class="toast-msg"></span>`;
            container.appendChild(toast);
        }

        const wasHidden = !toast.classList.contains('is-visible') || toast.classList.contains('toast-exit');

        toast.querySelector('.toast-msg').textContent = message;
        toast.classList.remove('toast-exit', 'toast-swap');

        void toast.offsetWidth;

        if (wasHidden) {
            toast.classList.add('is-visible');
        } else {
            toast.classList.add('toast-swap');
        }

        if (toastTimer) clearTimeout(toastTimer);
        if (toastExitTimer) clearTimeout(toastExitTimer);

        toastTimer = setTimeout(() => {
            toast.classList.add('toast-exit');
            toastExitTimer = setTimeout(() => {
                toast.classList.remove('is-visible', 'toast-exit', 'toast-swap');
            }, 280);
        }, 2300);
    }
    window.showToast = showToast;

    function copyToClipboard(text, successMsg) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMsg);
        }).catch(() => {
            const failMsg = (window.getTranslation && window.getTranslation('copy_failed')) || 'Failed to copy to clipboard';
            showToast(failMsg);
        });
    }

    const ensureProtocol = (url) => {
        if (!url || url === '#') return '#';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) return url;
        return `https://${url}`;
    };

    const buildIconHtml = (icon) => {
        if (!icon) return '<span class="material-symbols-rounded">public</span>';
        let cleanIcon = String(icon).trim();
        if (cleanIcon.startsWith('assets/')) {
            cleanIcon = '/' + cleanIcon;
        }
        if (cleanIcon.startsWith('http://') || cleanIcon.startsWith('https://') || cleanIcon.startsWith('/')) {
            return `<img src="${cleanIcon}" class="social-btn-img" alt="icon" loading="lazy">`;
        }
        if (cleanIcon.startsWith('bi-')) {
            return `<i class="bi ${cleanIcon}"></i>`;
        }
        if (cleanIcon.startsWith('ms-')) {
            return `<span class="material-symbols-rounded">${cleanIcon.substring(3)}</span>`;
        }
        return `<span class="material-symbols-rounded">${cleanIcon}</span>`;
    };

    let socialsLoaded = false;
    let socialsLoading = false;
    const renderSocialButtons = async () => {
        const container = document.getElementById('social-buttons-container');
        if (!container || socialsLoaded || socialsLoading) return;
        socialsLoading = true;

        let socials = [];
        try {
            const res = await fetch('/api/socials');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    socials = data.filter(s => !s.hidden);
                }
            }
        } catch (e) {
            console.warn('[Socials] Failed to fetch /api/socials, using fallback:', e);
        }

        if (!socials || socials.length === 0) {
            socials = [
                { name: 'DONATE', url: 'https://saweria.co/cutefishaep', icon: 'https://tr.rbxcdn.com/180DAY-3f4674f55d57c83900f5b9a60536119d/420/420/Image/Webp/noFilter' },
                { name: 'TikTok Roblox', url: 'https://www.tiktok.com/@cutefishrbx', icon: 'bi-tiktok' },
                { name: 'TikTok Editing', url: 'https://www.tiktok.com/@cutefishaep', icon: 'bi-tiktok' },
                { name: 'Instagram', url: 'https://www.instagram.com/cutefishaep/', icon: 'bi-instagram' },
                { name: 'YouTube Editing', url: 'https://www.youtube.com/@cutefishYT', icon: 'bi-youtube' },
                { name: 'YouTube Roblox', url: 'https://www.youtube.com/@cutefishrbx', icon: 'bi-youtube' },
                { name: 'Github Profile', url: 'https://github.com/cutefishaep', icon: 'bi-github' },
                { name: 'Channel WhatsApp', url: 'https://whatsapp.com/channel/0029VbDWmbe2kNFxcRD5Lj2z', icon: 'bi-whatsapp' }
            ];
        }

        container.innerHTML = socials.map(s => `
            <a href="${ensureProtocol(s.url)}" target="_blank" rel="noopener noreferrer" class="social-btn" title="${s.name}">
                <div class="social-btn-inner">
                    <div class="social-btn-icon-wrapper">
                        ${buildIconHtml(s.icon)}
                    </div>
                    <span class="social-btn-label">${s.name}</span>
                </div>
                <span class="material-symbols-rounded social-btn-arrow">arrow_outward</span>
            </a>
        `).join('');
        socialsLoaded = true;
        socialsLoading = false;
    };

    const socialContainer = document.getElementById('social-buttons-container');
    if (socialContainer) {
        socialContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.social-btn');
            if (btn) {
                e.preventDefault();
                openSocialPortal(btn);
            }
        });
    }

    let contactsLoaded = false;
    let contactsLoading = false;
    const renderContactButtons = async () => {
        const container = document.getElementById('contact-buttons-container');
        if (!container || contactsLoaded || contactsLoading) return;
        contactsLoading = true;

        let contacts = [];
        try {
            const res = await fetch('/api/contacts');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    contacts = data.filter(c => !c.hidden);
                }
            }
        } catch (e) {
            console.warn('[Contacts] Failed to fetch /api/contacts, using fallback:', e);
        }

        if (!contacts || contacts.length === 0) {
            contacts = [
                { name: 'WhatsApp', url: 'https://wa.me/6285150763332', icon: 'bi-whatsapp' },
                { name: 'Telegram', url: 'https://t.me/cutefishaep', icon: 'bi-telegram' }
            ];
        }

        container.innerHTML = contacts.map(c => `
            <a href="${ensureProtocol(c.url)}" target="_blank" rel="noopener noreferrer" class="social-btn" title="${c.name}">
                <div class="social-btn-inner">
                    <div class="social-btn-icon-wrapper">
                        ${buildIconHtml(c.icon)}
                    </div>
                    <span class="social-btn-label">${c.name}</span>
                </div>
                <span class="material-symbols-rounded social-btn-arrow">arrow_outward</span>
            </a>
        `).join('');
        contactsLoaded = true;
        contactsLoading = false;
    };

    const contactContainer = document.getElementById('contact-buttons-container');
    if (contactContainer) {
        contactContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.social-btn');
            if (btn) {
                e.preventDefault();
                openSocialPortal(btn);
            }
        });
    }


    let activeSocialBtn = null;
    let activeSocialCoords = null;
    let isSocialPortalOpen = false;
    let isSocialPortalAnimating = false;

    function openSocialPortal(btn) {
        if (isSocialPortalAnimating || isSocialPortalOpen) return;

        isSocialPortalAnimating = true;
        isSocialPortalOpen = true;
        activeSocialBtn = btn;

        const targetUrl = btn.href;
        const rawRect = btn.getBoundingClientRect();
        const initialRadius = Math.round((btn.offsetHeight || rawRect.height) / 2);

        const style = window.getComputedStyle(btn);
        let ty = 0;
        if (style.transform && style.transform !== 'none') {
            try {
                const matrix = new DOMMatrixReadOnly(style.transform);
                ty = matrix.m42 || 0;
            } catch (e) {}
        }

        const sRect = {
            left: rawRect.left,
            top: rawRect.top - ty,
            width: rawRect.width,
            height: rawRect.height,
            radius: initialRadius
        };

        const card = document.getElementById('social-portal-card');
        const iconWrapper = document.getElementById('social-portal-icon-wrapper');
        const labelWrapper = document.getElementById('social-portal-label-wrapper');
        const labelEl = document.getElementById('social-portal-label');
        const arrowEl = document.getElementById('social-portal-arrow');
        if (!card || !iconWrapper || !labelWrapper || !labelEl) return;

        const srcIcon = btn.querySelector('.social-btn-icon-wrapper');
        const srcLabel = btn.querySelector('.social-btn-label');
        const srcArrow = btn.querySelector('.social-btn-arrow');

        const iRect = srcIcon ? srcIcon.getBoundingClientRect() : { left: rawRect.left + 20, top: rawRect.top + 14, width: 36, height: 36 };
        const lRect = srcLabel ? srcLabel.getBoundingClientRect() : { left: rawRect.left + 70, top: rawRect.top + 20, width: 120, height: 20 };
        const aRect = srcArrow ? srcArrow.getBoundingClientRect() : { left: rawRect.right - 36, top: rawRect.top + 20, width: 20, height: 20 };

        const iconStartX = iRect.left - rawRect.left;
        const iconStartY = iRect.top - rawRect.top;
        const iconStartW = iRect.width || 36;

        const labelStartX = lRect.left - rawRect.left;
        const labelStartY = lRect.top - rawRect.top;
        const labelStartW = lRect.width || 120;
        const labelStartH = lRect.height || 20;

        const arrowStartX = aRect.left - rawRect.left;
        const arrowStartY = aRect.top - rawRect.top;

        const curScroll = contentScroller ? contentScroller.scrollTop : 0;

        activeSocialCoords = {
            sRect: sRect,
            scrollTop: curScroll,
            icon: { x: iconStartX, y: iconStartY, size: iconStartW },
            label: { x: labelStartX, y: labelStartY, width: labelStartW, height: labelStartH },
            arrow: { x: arrowStartX, y: arrowStartY }
        };

        iconWrapper.innerHTML = srcIcon ? srcIcon.innerHTML : '<span class="material-symbols-rounded">public</span>';
        labelEl.textContent = srcLabel ? srcLabel.textContent : 'Social Link';

        btn.style.visibility = 'hidden';

        card.style.transition = 'none';
        card.style.left = `${rawRect.left}px`;
        card.style.top = `${rawRect.top}px`;
        card.style.width = `${rawRect.width}px`;
        card.style.height = `${rawRect.height}px`;
        card.style.borderRadius = `${initialRadius}px`;
        card.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
        card.style.visibility = 'visible';
        card.style.opacity = '1';

        iconWrapper.style.transition = 'none';
        iconWrapper.style.width = `${iconStartW}px`;
        iconWrapper.style.height = `${iconStartW}px`;
        iconWrapper.style.transform = `translate3d(${iconStartX}px, ${iconStartY}px, 0px) scale(1)`;

        labelWrapper.style.transition = 'none';
        labelWrapper.style.width = `${labelStartW}px`;
        labelWrapper.style.height = `${labelStartH}px`;
        labelWrapper.style.transform = `translate3d(${labelStartX}px, ${labelStartY}px, 0px) scale(1)`;

        if (arrowEl) {
            arrowEl.style.transition = 'none';
            arrowEl.style.transform = `translate3d(${arrowStartX}px, ${arrowStartY}px, 0px)`;
            arrowEl.style.opacity = '1';
        }

        void card.offsetHeight;

        const W = window.innerWidth;
        const H = window.innerHeight;

        const iconTargetSize = 92;
        const iconScale = iconTargetSize / iconStartW;
        const iconTargetX = (W - iconTargetSize) / 2;
        const iconTargetY = (H / 2) - iconTargetSize + 10;

        const labelScale = 1.35;
        const labelTargetW = labelStartW * labelScale;
        const labelTargetX = (W - labelTargetW) / 2;
        const labelTargetY = (H / 2) + 26;

        const ease = 'var(--ease-spring-soft)';

        requestAnimationFrame(() => {
            document.body.classList.add('social-modal-open');
            card.classList.add('active');

            card.style.transition = `left 0.44s ${ease}, top 0.44s ${ease}, width 0.44s ${ease}, height 0.44s ${ease}, border-radius 0.44s ${ease}, background-color 0.44s ${ease}`;
            card.style.left = '0px';
            card.style.top = '0px';
            card.style.width = '100vw';
            card.style.height = '100vh';
            card.style.borderRadius = '0px';
            card.style.backgroundColor = 'var(--md-sys-color-surface-container)';

            iconWrapper.style.transition = `transform 0.44s ${ease}`;
            iconWrapper.style.transform = `translate3d(${iconTargetX}px, ${iconTargetY}px, 0px) scale(${iconScale})`;

            labelWrapper.style.transition = `transform 0.44s ${ease}`;
            labelWrapper.style.transform = `translate3d(${labelTargetX}px, ${labelTargetY}px, 0px) scale(${labelScale})`;

            if (arrowEl) {
                arrowEl.style.transition = 'opacity 0.22s ease';
                arrowEl.style.opacity = '0';
            }

            setTimeout(() => {
                window.open(targetUrl, '_blank');
                isSocialPortalAnimating = false;
            }, 220);
        });
    }

    function closeSocialPortal() {
        if (!isSocialPortalOpen || isSocialPortalAnimating) return;

        const card = document.getElementById('social-portal-card');
        const iconWrapper = document.getElementById('social-portal-icon-wrapper');
        const labelWrapper = document.getElementById('social-portal-label-wrapper');
        const arrowEl = document.getElementById('social-portal-arrow');
        if (!card || !iconWrapper || !labelWrapper) return;

        isSocialPortalAnimating = true;

        card.style.transition = 'none';
        card.style.left = '0px';
        card.style.top = '0px';
        card.style.width = '100vw';
        card.style.height = '100vh';
        card.style.borderRadius = '0px';
        void card.offsetHeight;

        const curScroll = contentScroller ? contentScroller.scrollTop : 0;
        const scrollDelta = curScroll - (activeSocialCoords ? (activeSocialCoords.scrollTop || 0) : 0);

        const targetLeft = activeSocialCoords ? activeSocialCoords.sRect.left : 0;
        const targetTop = activeSocialCoords ? (activeSocialCoords.sRect.top - scrollDelta) : 0;
        const targetW = activeSocialCoords ? activeSocialCoords.sRect.width : 280;
        const targetH = activeSocialCoords ? activeSocialCoords.sRect.height : 56;
        const targetRadius = activeSocialCoords ? activeSocialCoords.sRect.radius : 28;

        const iconReturnX = activeSocialCoords ? activeSocialCoords.icon.x : 20;
        const iconReturnY = activeSocialCoords ? activeSocialCoords.icon.y : 14;

        const labelReturnX = activeSocialCoords ? activeSocialCoords.label.x : 70;
        const labelReturnY = activeSocialCoords ? activeSocialCoords.label.y : 20;

        const arrowReturnX = activeSocialCoords ? activeSocialCoords.arrow.x : 240;
        const arrowReturnY = activeSocialCoords ? activeSocialCoords.arrow.y : 20;

        const ease = 'var(--ease-spring-soft)';

        requestAnimationFrame(() => {
            document.body.classList.remove('social-modal-open');

            card.style.transition = `left 0.40s ${ease}, top 0.40s ${ease}, width 0.40s ${ease}, height 0.40s ${ease}, border-radius 0.40s ${ease}, background-color 0.40s ${ease}`;
            card.style.left = `${targetLeft}px`;
            card.style.top = `${targetTop}px`;
            card.style.width = `${targetW}px`;
            card.style.height = `${targetH}px`;
            card.style.borderRadius = `${targetRadius}px`;
            card.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';

            iconWrapper.style.transition = `transform 0.40s ${ease}`;
            iconWrapper.style.transform = `translate3d(${iconReturnX}px, ${iconReturnY}px, 0px) scale(1)`;

            labelWrapper.style.transition = `transform 0.40s ${ease}`;
            labelWrapper.style.transform = `translate3d(${labelReturnX}px, ${labelReturnY}px, 0px) scale(1)`;

            if (arrowEl) {
                arrowEl.style.transition = `opacity 0.28s ease 0.1s`;
                arrowEl.style.transform = `translate3d(${arrowReturnX}px, ${arrowReturnY}px, 0px)`;
                arrowEl.style.opacity = '1';
            }

            setTimeout(() => {
                card.classList.remove('active');
                card.style.cssText = '';
                card.style.visibility = 'hidden';

                if (activeSocialBtn) {
                    activeSocialBtn.style.visibility = 'visible';
                    activeSocialBtn.classList.add('forced-hover');
                    setTimeout(() => {
                        if (activeSocialBtn) activeSocialBtn.classList.remove('forced-hover');
                    }, 60);
                }

                isSocialPortalOpen = false;
                isSocialPortalAnimating = false;
                activeSocialBtn = null;
                activeSocialCoords = null;
            }, 420);
        });
    }

    window.addEventListener('focus', () => {
        if (isSocialPortalOpen && !isSocialPortalAnimating) {
            setTimeout(closeSocialPortal, 80);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isSocialPortalOpen && !isSocialPortalAnimating) {
            setTimeout(closeSocialPortal, 80);
        }
    });

    window.addEventListener('pageshow', () => {
        if (isSocialPortalOpen && !isSocialPortalAnimating) {
            setTimeout(closeSocialPortal, 80);
        }
    });

    const socialCardEl = document.getElementById('social-portal-card');
    if (socialCardEl) {
        socialCardEl.addEventListener('click', closeSocialPortal);
    }

    function formatCount(num) {
        if (!num || isNaN(num)) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    }

    function formatDuration(sec) {
        if (!sec || isNaN(sec)) return '';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const initTikTokLatestPosts = () => {
        const section = document.getElementById('tiktok-latest');
        const grid = document.getElementById('tiktok-posts-grid');
        if (!section || !grid) return;

        let hasLoaded = false;
        let attempts = 0;

        const POSTER_FALLBACK = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

        const renderSingleCard = (p, index) => {
            const skeletonSlot = grid.querySelector(`.tiktok-card-skeleton[data-index="${index}"]`);
            const card = document.createElement('a');
            card.href = p.url || 'https://www.tiktok.com/@cutefishaep';
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = 'tiktok-card';
            card.title = p.title || 'Watch on TikTok';
            card.innerHTML = `
                <div class="tiktok-card-thumb">
                    <img src="${p.cover || POSTER_FALLBACK}" alt="${p.title || 'TikTok cover'}" loading="lazy" referrerpolicy="no-referrer">
                    <div class="tiktok-card-play">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </div>
                    ${p.duration ? `<div class="tiktok-card-duration">${formatDuration(p.duration)}</div>` : ''}
                </div>
                <div class="tiktok-card-body">
                    <span class="tiktok-card-author"><i class="bi bi-tiktok"></i> @${p.author || 'cutefishaep'}</span>
                    <h3 class="tiktok-card-title">${p.title || 'TikTok Video'}</h3>
                    <div class="tiktok-card-stats">
                        <span><i class="bi bi-play-fill"></i> ${formatCount(p.play_count)}</span>
                        <span><i class="bi bi-heart-fill"></i> ${formatCount(p.digg_count)}</span>
                    </div>
                </div>
            `;

            const thumbImg = card.querySelector('.tiktok-card-thumb img');
            if (thumbImg) {
                thumbImg.addEventListener('error', () => {
                    if (thumbImg.src !== POSTER_FALLBACK) thumbImg.src = POSTER_FALLBACK;
                }, { once: true });
            }

            if (skeletonSlot) {
                skeletonSlot.replaceWith(card);
            } else {
                grid.appendChild(card);
            }
        };

        const clearSkeletons = () => {
            grid.querySelectorAll('.tiktok-card-skeleton').forEach(slot => slot.remove());
        };

        const attemptLoad = async () => {
            attempts++;
            try {
                const res = await fetch('/api/tiktok-posts?username=cutefishaep', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const list = data.filter(p => p && p.url).slice(0, 4);
                        if (list.length > 0) {
                            list.forEach((p, index) => {
                                setTimeout(() => {
                                    renderSingleCard(p, index);
                                }, index * 120);
                            });
                            setTimeout(clearSkeletons, list.length * 120 + 50);
                            return true;
                        }
                    }
                }
            } catch (err) {
                console.warn('[TikTok] Failed to fetch latest posts:', err);
            }
            return false;
        };

        const loadPosts = async () => {
            if (hasLoaded) return;
            hasLoaded = true;

            const ok = await attemptLoad();
            if (ok) return;

            if (attempts < 2) {
                setTimeout(async () => {
                    const retried = await attemptLoad();
                    if (!retried) section.classList.add('hidden');
                }, 1500);
                return;
            }
            section.classList.add('hidden');
        };

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadPosts();
                        observer.disconnect();
                    }
                });
            }, {
                rootMargin: '200px 0px',
                threshold: 0.01
            });
            observer.observe(section);
        } else {
            loadPosts();
        }
    };

    initTikTokLatestPosts();

    const initNavSignpost = () => {
        const signpost = document.getElementById('nav-signpost');
        if (!signpost) return;
        const inner = signpost.querySelector('.signpost-inner');
        const overlay = document.getElementById('signpost-overlay');
        if (!inner || !overlay) return;

        let wobbleTimer = null;

        signpost.querySelectorAll('.sign-arrow').forEach(arrow => {
            arrow.addEventListener('click', () => {
                inner.classList.remove('is-wobbling');
                void inner.offsetWidth;
                inner.classList.add('is-wobbling');
                if (wobbleTimer) clearTimeout(wobbleTimer);
                wobbleTimer = setTimeout(() => inner.classList.remove('is-wobbling'), 1000);

                const targetHash = arrow.dataset.target;
                if (!targetHash) return;

                setTimeout(() => {
                    if (window.location.hash === targetHash) return;
                    window.location.hash = targetHash;
                }, 120);
            });
        });

        // Box 3D: front (::before z=0) + back (::after z=-T) + dinding sisi per edge poligon
        // Rumus per edge: len = hypot(dx,dy), ang = atan2(dy,dx),
        // dinding = strip T x len di titik awal edge, rotateZ(ang) rotateX(-90deg) → melipat ke -z
        // Overlap 2px di tiap ujung edge biar sambungan sudut gak bolong
        function buildArrowBox(arrow) {
            arrow.querySelectorAll('.arrow-side').forEach(el => el.remove());
            const W = arrow.offsetWidth;
            const H = arrow.offsetHeight;
            if (W < 10 || H < 10) return;
            const tip = 24;
            const T = parseFloat(getComputedStyle(arrow).getPropertyValue('--box-thick')) || 8;
            const isRight = arrow.classList.contains('arrow-right');
            const pts = isRight
                ? [[0, 0], [W - tip, 0], [W, H / 2], [W - tip, H], [0, H]]
                : [[tip, 0], [W, 0], [W, H], [tip, H], [0, H / 2]];
            const bg = getComputedStyle(arrow).getPropertyValue('--arrow-bg').trim() || 'rgb(120,120,120)';
            for (let i = 0; i < pts.length; i++) {
                const [x1, y1] = pts[i];
                const [x2, y2] = pts[(i + 1) % pts.length];
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);
                if (len < 1) continue;
                const ang = Math.atan2(dy, dx) * 180 / Math.PI;
                const ox = (dx / len) * 2;
                const oy = (dy / len) * 2;
                const el = document.createElement('div');
                el.className = 'arrow-side';
                el.style.left = (x1 - ox) + 'px';
                el.style.top = (y1 - oy) + 'px';
                el.style.width = (len + 4) + 'px';
                el.style.height = T + 'px';
                el.style.background = 'color-mix(in srgb, ' + bg + ' 84%, black)';
                el.style.transformOrigin = '0 0';
                el.style.transform = 'rotateZ(' + ang + 'deg) rotateX(-90deg)';
                arrow.appendChild(el);
            }
        }

        function buildAllArrowBoxes() {
            signpost.querySelectorAll('.sign-arrow').forEach(buildArrowBox);
        }
        // Rebuild saat ukuran berubah — termasuk setelah icon font ter-render
        requestAnimationFrame(buildAllArrowBoxes);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => requestAnimationFrame(buildAllArrowBoxes));
        }
        window.addEventListener('load', () => requestAnimationFrame(buildAllArrowBoxes));
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(() => buildAllArrowBoxes());
            signpost.querySelectorAll('.sign-arrow').forEach(a => ro.observe(a));
        }
        let boxResizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(boxResizeTimer);
            boxResizeTimer = setTimeout(buildAllArrowBoxes, 120);
        });
    };

    initNavSignpost();

    const navItems = document.querySelectorAll('.floating-nav-item');


    const legalModalBackdrop = document.getElementById('legal-modal-backdrop');
    const legalModalCloseBtn = document.getElementById('legal-modal-close-btn');
    const legalModalTitleSlot = document.getElementById('legal-modal-title-slot');
    const legalModalIcon = document.getElementById('legal-modal-icon');
    const legalModalIconBadge = document.getElementById('legal-modal-icon-badge');
    const legalModalSubtitle = document.getElementById('legal-modal-subtitle');
    const legalModalBody = document.getElementById('legal-modal-body');
    const modalDocPanes = document.querySelectorAll('.legal-modal-body .legal-doc-pane');
    const footerLegalBtns = document.querySelectorAll('.footer-legal-btn');

    let lastClickedLegalBtn = null;
    let isModalAnimating = false;
    let cachedSourceRect = null;

    const legalDocConfig = {
        privacy: { title: 'Privacy Policy', icon: 'security', paneId: 'modal-doc-privacy' },
        tos: { title: 'Terms of Service', icon: 'gavel', paneId: 'modal-doc-tos' },
        disclaimer: { title: 'Disclaimer & DMCA', icon: 'verified_user', paneId: 'modal-doc-disclaimer' }
    };

    function switchModalDoc(docKey) {
        const conf = legalDocConfig[docKey] || legalDocConfig.tos;
        if (legalModalIcon) legalModalIcon.textContent = conf.icon;

        modalDocPanes.forEach(pane => {
            if (pane.id === conf.paneId) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    }

    function openLegalModal(docKey, sourceEl) {
        if (isModalAnimating || !legalModalBackdrop || !sourceEl) return;
        lastClickedLegalBtn = sourceEl;
        switchModalDoc(docKey);

        isModalAnimating = true;

        const sRect = sourceEl.getBoundingClientRect();
        cachedSourceRect = {
            left: sRect.left,
            top: sRect.top,
            width: sRect.width,
            height: sRect.height
        };

        const winW = window.innerWidth;
        const winH = window.innerHeight;


        sourceEl.style.visibility = 'hidden';


        const btnRadius = sRect.height / 2;


        legalModalBackdrop.style.transition = 'none';
        legalModalBackdrop.style.left = '0px';
        legalModalBackdrop.style.top = '0px';
        legalModalBackdrop.style.width = '100vw';
        legalModalBackdrop.style.height = '100vh';
        legalModalBackdrop.style.opacity = '0';
        legalModalBackdrop.style.visibility = 'hidden';

        const tRect = legalModalTitleSlot ? legalModalTitleSlot.getBoundingClientRect() : null;

        let heroEl = document.getElementById('legal-portal-hero-btn');
        if (!heroEl) {
            heroEl = document.createElement('div');
            heroEl.id = 'legal-portal-hero-btn';
            heroEl.className = 'legal-portal-hero-btn';
            document.body.appendChild(heroEl);
        }
        heroEl.textContent = sourceEl.textContent.trim();
        heroEl.classList.remove('resting');
        heroEl.style.visibility = 'visible';
        heroEl.style.opacity = '1';
        heroEl.style.left = `${sRect.left}px`;
        heroEl.style.top = `${sRect.top}px`;
        heroEl.style.width = `${sRect.width}px`;
        heroEl.style.height = `${sRect.height}px`;
        heroEl.style.borderRadius = `${btnRadius}px`;
        heroEl.style.transform = 'none';
        heroEl.style.transition = 'none';


        legalModalBackdrop.style.visibility = 'visible';
        legalModalBackdrop.style.opacity = '1';
        legalModalBackdrop.style.transition = 'none';
        legalModalBackdrop.style.transform = 'none';
        legalModalBackdrop.style.left = `${sRect.left}px`;
        legalModalBackdrop.style.top = `${sRect.top}px`;
        legalModalBackdrop.style.width = `${sRect.width}px`;
        legalModalBackdrop.style.height = `${sRect.height}px`;
        legalModalBackdrop.style.borderRadius = `${btnRadius}px`;

        if (legalModalIconBadge) legalModalIconBadge.style.opacity = '0';
        if (legalModalSubtitle) legalModalSubtitle.style.opacity = '0';
        if (legalModalCloseBtn) legalModalCloseBtn.style.opacity = '0';
        if (legalModalBody) legalModalBody.style.opacity = '0';


        void heroEl.offsetHeight;
        void legalModalBackdrop.offsetHeight;


        const moveX = tRect ? (tRect.left - sRect.left) : 0;
        const moveY = tRect ? (tRect.top - sRect.top) : 0;

        requestAnimationFrame(() => {
            document.body.classList.add('legal-modal-open');


            heroEl.style.transition = 'transform 0.44s var(--ease-spring-soft), background-color 0.44s var(--ease-spring-soft), color 0.44s var(--ease-spring-soft)';
            heroEl.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;


            legalModalBackdrop.classList.add('active');
            legalModalBackdrop.style.transition = 'left 0.44s var(--ease-spring-soft), top 0.44s var(--ease-spring-soft), width 0.44s var(--ease-spring-soft), height 0.44s var(--ease-spring-soft), border-radius 0.44s var(--ease-spring-soft)';
            legalModalBackdrop.style.left = '0px';
            legalModalBackdrop.style.top = '0px';
            legalModalBackdrop.style.width = '100vw';
            legalModalBackdrop.style.height = '100vh';
            legalModalBackdrop.style.borderRadius = '0px';

            if (legalModalIconBadge) {
                legalModalIconBadge.style.transition = 'opacity 0.32s ease 0.1s';
                legalModalIconBadge.style.opacity = '1';
            }
            if (legalModalSubtitle) {
                legalModalSubtitle.style.transition = 'opacity 0.32s ease 0.1s';
                legalModalSubtitle.style.opacity = '1';
            }
            if (legalModalCloseBtn) {
                legalModalCloseBtn.style.transition = 'opacity 0.32s ease 0.1s';
                legalModalCloseBtn.style.opacity = '1';
            }
            if (legalModalBody) {
                legalModalBody.style.transition = 'opacity 0.32s ease 0.12s';
                legalModalBody.style.opacity = '1';
            }

            setTimeout(() => {
                isModalAnimating = false;
            }, 460);
        });
    }

    let legalModalCloseTimer = null;

    function cleanupLegalModal() {
        if (legalModalCloseTimer) {
            clearTimeout(legalModalCloseTimer);
            legalModalCloseTimer = null;
        }

        if (legalModalBackdrop) {
            legalModalBackdrop.classList.remove('active');
            legalModalBackdrop.style.visibility = '';
            legalModalBackdrop.style.opacity = '';
            legalModalBackdrop.style.transition = '';
            legalModalBackdrop.style.transform = '';
            legalModalBackdrop.style.borderRadius = '';
            legalModalBackdrop.style.left = '';
            legalModalBackdrop.style.top = '';
            legalModalBackdrop.style.width = '';
            legalModalBackdrop.style.height = '';
        }

        if (legalModalIconBadge) legalModalIconBadge.style.opacity = '';
        if (legalModalSubtitle) legalModalSubtitle.style.opacity = '';
        if (legalModalCloseBtn) legalModalCloseBtn.style.opacity = '';
        if (legalModalBody) legalModalBody.style.opacity = '';

        const heroEl = document.getElementById('legal-portal-hero-btn');
        if (heroEl) {
            heroEl.style.visibility = 'hidden';
            heroEl.style.transform = '';
            heroEl.style.transition = '';
        }

        if (lastClickedLegalBtn) {
            lastClickedLegalBtn.classList.add('forced-hover');
            lastClickedLegalBtn.style.visibility = 'visible';
            setTimeout(() => {
                if (lastClickedLegalBtn) lastClickedLegalBtn.classList.remove('forced-hover');
            }, 60);
        }

        isModalAnimating = false;
    }

    function closeLegalModal() {
        if (isModalAnimating || !legalModalBackdrop) return;

        isModalAnimating = true;
        document.body.classList.remove('legal-modal-open');

        let sRect = cachedSourceRect;
        const heroEl = document.getElementById('legal-portal-hero-btn');

        if (sRect && heroEl) {
            const btnRadius = sRect.height / 2;

            if (legalModalIconBadge) {
                legalModalIconBadge.style.transition = 'opacity 0.18s ease';
                legalModalIconBadge.style.opacity = '0';
            }
            if (legalModalSubtitle) {
                legalModalSubtitle.style.transition = 'opacity 0.18s ease';
                legalModalSubtitle.style.opacity = '0';
            }
            if (legalModalCloseBtn) {
                legalModalCloseBtn.style.transition = 'opacity 0.18s ease';
                legalModalCloseBtn.style.opacity = '0';
            }
            if (legalModalBody) {
                legalModalBody.style.transition = 'opacity 0.18s ease';
                legalModalBody.style.opacity = '0';
            }


            const origLeft = cachedSourceRect ? cachedSourceRect.left : sRect.left;
            const origTop = cachedSourceRect ? cachedSourceRect.top : sRect.top;
            const returnDeltaX = sRect.left - origLeft;
            const returnDeltaY = sRect.top - origTop;

            heroEl.style.transition = 'transform 0.38s var(--ease-spring-soft)';
            heroEl.style.transform = `translate3d(${returnDeltaX}px, ${returnDeltaY}px, 0)`;


            legalModalBackdrop.style.transition = 'left 0.38s var(--ease-spring-soft), top 0.38s var(--ease-spring-soft), width 0.38s var(--ease-spring-soft), height 0.38s var(--ease-spring-soft), border-radius 0.38s var(--ease-spring-soft)';
            legalModalBackdrop.style.left = `${sRect.left}px`;
            legalModalBackdrop.style.top = `${sRect.top}px`;
            legalModalBackdrop.style.width = `${sRect.width}px`;
            legalModalBackdrop.style.height = `${sRect.height}px`;
            legalModalBackdrop.style.borderRadius = `${btnRadius}px`;

            if (legalModalCloseTimer) clearTimeout(legalModalCloseTimer);
            legalModalCloseTimer = setTimeout(() => {
                cleanupLegalModal();
            }, 400);
        } else {
            cleanupLegalModal();
        }
    }

    footerLegalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const doc = btn.getAttribute('data-doc') || 'tos';
            openLegalModal(doc, btn);
        });
    });

    if (legalModalCloseBtn) {
        legalModalCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeLegalModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && legalModalBackdrop && legalModalBackdrop.classList.contains('active')) {
            closeLegalModal();
        }
    });

    const OS_SVG = { WIN: 'assets/svg/windows.svg', MAC: 'assets/svg/apple.svg', ANDROID: 'assets/svg/android.svg', WEB: 'assets/svg/web.svg' };
    const OS_LABEL = { WIN: 'Windows', MAC: 'macOS', ANDROID: 'Android', WEB: 'Web App' };

    const resolveOsKey = (name) => {
        const n = String(name || '').toLowerCase().trim();
        if (!n) return null;
        if (n.includes('win')) return 'WIN';
        if (n.includes('mac') || n.includes('apple') || n.includes('ios') || n.includes('osx')) return 'MAC';
        if (n.includes('android')) return 'ANDROID';
        if (n.includes('web') || n.includes('browser') || n.includes('online')) return 'WEB';
        return Object.keys(OS_SVG).find(k => k.toLowerCase() === n) || null;
    };
    const RESOURCE_PASSWORD = 'EDITINGSTUFF';

    let allResources = [];
    let activeResourceCategory = 'All';
    let cachedSourceCard = null;
    let cachedResSourceRect = null;
    let isResModalAnimating = false;

    let resourceDeepLinkToken = 0;

    function focusResourceDeepLink(item) {
        const myToken = ++resourceDeepLinkToken;
        const alive = () => myToken === resourceDeepLinkToken;

        const tryFocus = (attempt = 0) => {
            if (!alive()) return;
            const card = document.querySelector(`.resource-card[data-id="${item._id}"]`);
            if (!card || card.getClientRects().length === 0) {
                if (attempt < 24) return setTimeout(() => tryFocus(attempt + 1), 250);
                return;
            }

            setTimeout(() => {
                if (!alive()) return;
                const scroller = document.getElementById('content-scroller');
                const rect = card.getBoundingClientRect();
                const vh = window.innerHeight || document.documentElement.clientHeight;
                const fullyVisible = rect.top >= 0 && rect.bottom <= vh;
                if (scroller && !fullyVisible) {
                    const targetTop = Math.max(0, scroller.scrollTop + rect.top - vh * 0.35);
                    scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
                }
                setTimeout(() => {
                    if (!alive()) return;
                    const freshCard = document.querySelector(`.resource-card[data-id="${item._id}"]`);
                    if (!freshCard || freshCard.getClientRects().length === 0) return;
                    freshCard.classList.remove('deep-link-flash');
                    void freshCard.offsetWidth;
                    freshCard.classList.add('deep-link-flash');
                    setTimeout(() => {
                        if (!alive()) return;
                        openResourceModal(item, freshCard);
                    }, 650);
                }, 450);
            }, 350);
        };
        tryFocus();
    }

    const renderResourceCategories = (resources) => {
        const categoryContainer = document.getElementById('resource-categories');
        if (!categoryContainer) return;

        const catSet = new Set();
        resources.forEach(r => {
            const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
            cats.forEach(c => catSet.add(c));
        });

        const sorted = [...catSet].sort((a, b) => {
            if (a === 'Made By Cutefish') return -1;
            if (b === 'Made By Cutefish') return 1;
            return a.localeCompare(b);
        });
        const categories = ['All', ...sorted];

        categoryContainer.innerHTML = categories.map(cat => {
            const label = cat === 'All' ? ((window.getTranslation && window.getTranslation('category_all')) || 'All') : cat;
            return `<div class="chip ${activeResourceCategory === cat ? 'active' : ''}" data-category="${cat}">${label}</div>`;
        }).join('');

        categoryContainer.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                categoryContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeResourceCategory = chip.dataset.category || 'All';
                const searchInput = document.getElementById('resource-search');
                renderResources(searchInput ? searchInput.value : '', activeResourceCategory);
            });
        });
    };

    let resourcesLoaded = false;
    let resourcesLoading = false;
    const renderResources = async (query = '', filterCategory = 'All') => {
        const container = document.getElementById('resource-grid');
        if (!container) return;

        if (!resourcesLoaded && !resourcesLoading && allResources.length === 0) {
            resourcesLoading = true;
            let fetchSucceeded = false;
            try {
                const res = await fetch('/api/resources');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        allResources = data.filter(r => !r.hidden);
                        fetchSucceeded = true;
                    }
                }
            } catch (e) {
                console.warn('[Resources] Failed to fetch /api/resources:', e);
            }

            if (!fetchSucceeded) {
                allResources = [
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
                                { label: '2024.1 (AE 2024)', url: 'https://borisfx.com' }
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
            }
            resourcesLoaded = true;
            resourcesLoading = false;
            
            const renderHomeNews = () => {
                const newsSection = document.getElementById('home-news-section');
                const newsGrid = document.getElementById('home-news-grid');
                if (!newsSection || !newsGrid) return;
                
                const newsItems = allResources.filter(r => r.newsRank && r.newsRank > 0)
                                              .sort((a, b) => a.newsRank - b.newsRank);
                if (newsItems.length === 0) {
                    newsSection.style.display = 'none';
                    return;
                }
                newsSection.style.display = 'block';
                
                newsGrid.innerHTML = newsItems.map(r => {
                    const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                    const osArr = Array.isArray(r.os) ? r.os : [];
                    const osIconsHtml = osArr.map(o => {
                        const rawName = typeof o === 'string' ? o : (o.name || '');
                        const key = resolveOsKey(rawName) || String(rawName).toUpperCase();
                        return OS_SVG[key] ? `<img src="${OS_SVG[key]}" class="os-icon-sm" alt="${key}" title="${OS_LABEL[key] || key}">` : '';
                    }).join('');
    
                    const isCutefish = cats.includes('Made By Cutefish');
                    
                    return `<div class="resource-card ${isCutefish ? 'resource-card-cutefish' : ''}" data-id="${r._id}" tabindex="0" role="button" aria-label="Open ${r.title}">
                        <div class="resource-icon-wrapper">
                            <img src="${r.icon || 'assets/icon/Ae.png'}" alt="${r.title}" class="resource-icon" loading="lazy">
                            ${isCutefish ? `<div class="cutefish-badge" title="Made by Cutefish"></div>` : ''}
                        </div>
                        <div class="resource-info">
                            <h3 class="resource-title-compact">${r.title}</h3>
                            <p class="resource-dev-compact">${r.dev || 'cutefishaep Team'}</p>
                            <div class="resource-meta-compact">
                                ${osIconsHtml ? `<span class="os-chip">${osIconsHtml}</span>` : ''}
                                <span class="resource-info-text">${r.info || ''}</span>
                            </div>
                            <div class="resource-cats-row">
                                ${cats.map(c => `<span class="resource-cat-chip">${c}</span>`).join('')}
                            </div>
                        </div>
                        <div class="resource-card-arrow">
                            <span class="material-symbols-rounded">chevron_right</span>
                        </div>
                    </div>`;
                }).join('');
                
                newsGrid.querySelectorAll('.resource-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const id = card.dataset.id;
                        const item = allResources.find(r => r._id === id);
                        if (item) openResourceModal(item, card);
                    });
                });
            };
            renderHomeNews();
        }

        renderResourceCategories(allResources);

        let filtered = allResources;

        if (filterCategory !== 'All') {
            filtered = filtered.filter(r => {
                const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                return cats.includes(filterCategory);
            });
        }

        if (query) {
            const q = query.toLowerCase().trim();
            filtered = filtered.filter(r =>
                r.title.toLowerCase().includes(q) ||
                (Array.isArray(r.category) ? r.category.join(' ') : (r.category || '')).toLowerCase().includes(q) ||
                (r.dev && r.dev.toLowerCase().includes(q))
            );
        }

        filtered.sort((a, b) => {
            const aIsCute = (Array.isArray(a.category) ? a.category : [a.category]).includes('Made By Cutefish');
            const bIsCute = (Array.isArray(b.category) ? b.category : [b.category]).includes('Made By Cutefish');
            if (aIsCute && !bIsCute) return -1;
            if (!aIsCute && bIsCute) return 1;
            return 0;
        });

        if (filtered.length > 0) {
            container.innerHTML = filtered.map(r => {
                const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                const osArr = Array.isArray(r.os) ? r.os : [];
                const osIconsHtml = osArr.map(o => {
                    const rawName = typeof o === 'string' ? o : (o.name || '');
                    const key = resolveOsKey(rawName);
                    const svg = key ? OS_SVG[key] : null;
                    return svg ? `<img src="${svg}" class="os-icon-svg" alt="${key}">` : '';
                }).join('');

                const isCutefish = cats.includes('Made By Cutefish');
                let rIcon = r.icon ? String(r.icon).trim() : '';
                if (rIcon.startsWith('assets/')) rIcon = '/' + rIcon;
                const iconHtml = (rIcon && (rIcon.startsWith('http') || rIcon.includes('/')))
                    ? `<img src="${rIcon}" class="resource-icon-img" alt="${r.title}" loading="lazy">`
                    : `<span class="material-symbols-rounded resource-icon">${r.icon || 'folder_open'}</span>`;

                return `
                <div class="resource-card ${isCutefish ? 'resource-card-cutefish' : ''}" data-id="${r._id}">
                    <div class="resource-icon-wrapper">
                        ${iconHtml}
                    </div>
                    <div class="resource-info-compact">
                        <h4 class="resource-title-compact">${r.title}</h4>
                        <p class="resource-dev-compact">${r.dev || 'cutefishaep Team'}</p>
                        <div class="resource-meta-compact">
                            ${osIconsHtml ? `<span class="os-chip">${osIconsHtml}</span>` : ''}
                            <span class="resource-info-text">${r.info || ''}</span>
                        </div>
                        <div class="resource-cats-row">
                            ${cats.map(c => `<span class="resource-cat-chip">${c}</span>`).join('')}
                        </div>
                    </div>
                    <div class="resource-card-arrow">
                        <span class="material-symbols-rounded">chevron_right</span>
                    </div>
                </div>`;
            }).join('');

            container.querySelectorAll('.resource-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const item = allResources.find(r => r._id === id);
                    if (item) openResourceModal(item, card);
                });
            });

            if (window.pendingResourceTitle) {
                const wanted = String(window.pendingResourceTitle).toLowerCase();
                window.pendingResourceTitle = null;
                const match = allResources.find(r => (r.title || '').toLowerCase().includes(wanted));
                if (match) focusResourceDeepLink(match);
            }
        } else {
            const noResMsg = (window.getTranslation && window.getTranslation('no_results')) || 'No resources found';
            container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded empty-state-icon">search_off</span><p class="empty-state-text">${noResMsg}</p></div>`;
        }
    };



    async function clearAllToolCache(btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            const icon = btnEl.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.6s var(--ease-spring-soft)';
                icon.style.transform = 'rotate(720deg) scale(1.2)';
            }
        }

        const toastMsg = (window.getTranslation && window.getTranslation('cache_purging_toast')) || 'Purging all cache & hard refreshing...';
        if (typeof window.showToast === 'function') {
            window.showToast(toastMsg);
        }


        if ('serviceWorker' in navigator) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) await reg.unregister();
            } catch (e) {}
        }


        if ('caches' in window) {
            try {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            } catch (e) {}
        }


        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
            try {
                const dbs = await window.indexedDB.databases();
                for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
            } catch (e) {}
        }


        try {
            const savedLang = localStorage.getItem('user_lang');
            sessionStorage.clear();
            localStorage.clear();
            if (savedLang) localStorage.setItem('user_lang', savedLang);
        } catch (e) {}

        const statusEl = document.getElementById('tool-progress-status');
        const clearMsg = (window.getTranslation && window.getTranslation('cache_cleared')) || '✓ Cache cleared & memory reset';
        if (statusEl) statusEl.textContent = clearMsg;

        setTimeout(() => {
            window.location.reload();
        }, 850);
    }
    window.clearAllToolCache = clearAllToolCache;

    const cleanToolsCacheBtn = document.getElementById('btn-tools-clean-cache');
    if (cleanToolsCacheBtn) {
        cleanToolsCacheBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearAllToolCache(cleanToolsCacheBtn);
        });
    }

    let allTools = [];
    let activeToolCategory = 'All';
    let cachedToolSourceCard = null;
    let cachedToolSourceRect = null;
    let isToolModalAnimating = false;

    window.ToolProgressManager = {
        _states: new Map(),
        set(toolId, data) {
            const prev = this._states.get(toolId) || {};
            const updated = { ...prev, ...data };
            this._states.set(toolId, updated);
            this.updateCardUI(toolId, updated);
            this.updateModalIfOpen(toolId, updated);
        },
        get(toolId) {
            return this._states.get(toolId);
        },
        clear(toolId) {
            this._states.delete(toolId);
            this.updateCardUI(toolId, { isProcessing: false, percent: 0 });
        },
        updateCardUI(toolId, state) {
            const cards = document.querySelectorAll(`.tool-card[data-id="${toolId}"]`);
            cards.forEach(card => {
                const arrowEl = card.querySelector('.tool-card-arrow');
                if (!arrowEl) return;

                if (state.isProcessing) {
                    card.classList.add('tool-card-processing');
                    const percentText = `${Math.max(0, Math.min(100, Math.round(state.percent || 0)))}%`;
                    arrowEl.innerHTML = `<span class="tool-card-progress-text">${percentText}</span>`;
                    arrowEl.classList.add('is-processing');
                    arrowEl.classList.remove('is-completed');
                } else if (state.completed) {
                    card.classList.remove('tool-card-processing');
                    arrowEl.classList.remove('is-processing');
                    arrowEl.classList.add('is-completed');
                    arrowEl.innerHTML = `<span class="material-symbols-rounded">check</span>`;
                } else {
                    card.classList.remove('tool-card-processing');
                    arrowEl.classList.remove('is-processing', 'is-completed');
                    arrowEl.innerHTML = `<span class="material-symbols-rounded">chevron_right</span>`;
                }
            });
        },
        updateModalIfOpen(toolId, state) {
            if (!currentToolItem || currentToolItem._id !== toolId) return;
            if (!document.body.classList.contains('tool-modal-open')) return;

            const progressSec = document.getElementById('tool-progress-section');
            const progressFill = document.getElementById('tool-progress-fill');
            const progressPercent = document.getElementById('tool-progress-percent');
            const progressStatus = document.getElementById('tool-progress-status');
            const processBtn = document.getElementById('tool-process-btn');
            const processLabel = document.getElementById('tool-process-label');
            const processIcon = document.getElementById('tool-process-icon');
            const closeBtn = document.getElementById('tool-modal-close-btn');
            const closeProgress = document.getElementById('tool-close-progress-text');

            if (state.isProcessing) {
                if (closeBtn) closeBtn.classList.add('is-processing');
                if (closeProgress) closeProgress.textContent = `${Math.max(0, Math.min(100, Math.round(state.percent || 0)))}%`;
                if (progressSec) progressSec.classList.remove('hidden');
                const p = Math.max(0, Math.min(100, Math.round(state.percent || 0)));
                if (progressFill) progressFill.style.width = `${p}%`;
                if (progressPercent) progressPercent.textContent = `${p}%`;
                if (progressStatus && state.status) progressStatus.textContent = state.status;
                if (processBtn) {
                    processBtn.disabled = true;
                    processBtn.dataset.state = 'processing';
                }
            } else if (state.completed) {
                if (closeBtn) closeBtn.classList.remove('is-processing');
                if (closeProgress) closeProgress.textContent = '';
                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus && state.status) progressStatus.textContent = state.status;
                if (processBtn) {
                    processBtn.disabled = false;
                    processBtn.dataset.state = 'completed';
                    if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('status_process_another')) || 'Process Another';
                    if (processIcon) processIcon.textContent = 'restart_alt';
                }
            }
        }
    };

    // Sumber tunggal versi tool: /t_version.json
    window.T_VERSIONS = {};

    fetch('./t_version.json', { cache: 'no-cache' })
        .then(res => res.ok ? res.json() : {})
        .then(map => {
            if (!map || typeof map !== 'object') return;
            window.T_VERSIONS = map;
            let changed = false;
            if (window.AppTools && window.AppTools._registry) {
                window.AppTools._registry.forEach((def, id) => {
                    const v = map[id];
                    if (v && def.version !== v) {
                        def.version = v;
                        changed = true;
                    }
                });
            }
            if (changed && typeof renderTools === 'function') {
                const searchInput = document.getElementById('tools-search');
                renderTools(searchInput ? searchInput.value : '', activeToolCategory);
            }
        })
        .catch(() => {});

    window.AppTools = {
        _registry: new Map(),
        register(toolDef) {
            if (!toolDef) return;
            const id = toolDef.id || toolDef._id;
            if (!id) return;
            toolDef.id = id;
            toolDef._id = id;
            const extV = window.T_VERSIONS[id];
            if (extV) toolDef.version = extV;
            this._registry.set(id, toolDef);
            allTools = Array.from(this._registry.values());
            if (typeof renderTools === 'function') {
                const searchInput = document.getElementById('tools-search');
                renderTools(searchInput ? searchInput.value : '', activeToolCategory);
            }
        },
        get(id) {
            return this._registry.get(id);
        },
        getAll() {
            return Array.from(this._registry.values());
        }
    };

    if (window._pendingTools && Array.isArray(window._pendingTools)) {
        window._pendingTools.forEach(t => window.AppTools.register(t));
        window._pendingTools = [];
    }

    function renderToolCategories(tools) {
        const categoryContainer = document.getElementById('tools-categories');
        if (!categoryContainer) return;

        const categories = new Set(['All']);
        tools.forEach(t => {
            if (Array.isArray(t.category)) {
                t.category.forEach(c => categories.add(c));
            } else if (t.category) {
                categories.add(t.category);
            }
        });

        categoryContainer.innerHTML = Array.from(categories).map(cat => {
            const label = cat === 'All' ? ((window.getTranslation && window.getTranslation('category_all')) || 'All') : cat;
            return `<div class="chip ${activeToolCategory === cat ? 'active' : ''}" data-category="${cat}">${label}</div>`;
        }).join('');

        categoryContainer.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                categoryContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                activeToolCategory = chip.dataset.category || 'All';
                const searchInput = document.getElementById('tools-search');
                renderTools(searchInput ? searchInput.value : '', activeToolCategory);
            });
        });
    };

    // Pre-decode hero images BEFORE the morph starts, so the browser does not
    // stall mid-animation decoding freshly cloned <img> elements.
    const predecodeHeroImages = (container) => {
        const imgs = container ? container.querySelectorAll('img') : [];
        if (!imgs.length) return Promise.resolve();
        const jobs = Array.from(imgs).map(img => {
            if (img.complete) return Promise.resolve();
            if (typeof img.decode === 'function') return img.decode().catch(() => {});
            return Promise.resolve();
        });
        return Promise.race([
            Promise.all(jobs),
            new Promise(r => setTimeout(r, 90))
        ]);
    };

    function getModalTargetGeometry(cardEl, maxHeightRatio = 0.86) {
        const isMobile = window.innerWidth <= 600;
        const targetW = isMobile ? window.innerWidth : Math.min(window.innerWidth * 0.92, 540);
        const targetLeft = isMobile ? 0 : Math.max(16, (window.innerWidth - targetW) / 2);
        const borderRadius = isMobile ? '28px 28px 0 0' : '28px';

        const prevWidth = cardEl.style.width;
        const prevHeight = cardEl.style.height;
        const prevTransition = cardEl.style.transition;
        cardEl.style.transition = 'none';
        cardEl.style.width = `${targetW}px`;
        cardEl.style.height = 'auto';
        void cardEl.offsetHeight;

        let naturalH = cardEl.scrollHeight || cardEl.offsetHeight || 320;

        cardEl.style.transition = prevTransition;
        if (prevWidth) {
            cardEl.style.width = prevWidth;
        } else {
            cardEl.style.width = '';
        }
        if (prevHeight) {
            cardEl.style.height = prevHeight;
        } else {
            cardEl.style.height = '';
        }
        void cardEl.offsetHeight;

        const targetH = Math.min(naturalH, window.innerHeight * maxHeightRatio);
        const targetTop = isMobile ? (window.innerHeight - targetH) : Math.max(16, (window.innerHeight - targetH) / 2);

        return { targetW, targetLeft, targetH, targetTop, borderRadius, isMobile };
    }

    function applyModalGeometry(cardEl, geom, animate) {
        const cur = cardEl.getBoundingClientRect();
        const stable =
            Math.abs(cur.left - geom.targetLeft) < 1 &&
            Math.abs(cur.top - geom.targetTop) < 1 &&
            Math.abs(cur.width - geom.targetW) < 1 &&
            Math.abs(cur.height - geom.targetH) < 1;
        if (stable) return;

        if (animate) {
            cardEl.style.transition = 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease';
        } else {
            cardEl.style.transition = 'none';
        }
        cardEl.style.left = `${geom.targetLeft}px`;
        cardEl.style.top = `${geom.targetTop}px`;
        cardEl.style.width = `${geom.targetW}px`;
        cardEl.style.height = `${geom.targetH}px`;
        cardEl.style.borderRadius = geom.borderRadius;
    }

    function updateOpenModalsLayout(animate = false) {
        if (document.body.classList.contains('res-modal-open') && !isResModalAnimating) {
            const cardEl = document.getElementById('res-modal-card');
            if (cardEl) {
                const geom = getModalTargetGeometry(cardEl, 0.86);
                applyModalGeometry(cardEl, geom, animate);
            }
        }
        if (document.body.classList.contains('tool-modal-open') && !isToolModalAnimating) {
            const cardEl = document.getElementById('tool-modal-card');
            if (cardEl) {
                const geom = getModalTargetGeometry(cardEl, 0.86);
                applyModalGeometry(cardEl, geom, animate);
            }
        }
    }

    window.updateOpenModalsLayout = updateOpenModalsLayout;

    if (typeof ResizeObserver !== 'undefined') {
        const toolModalBody = document.querySelector('.tool-modal-body');
        if (toolModalBody) {
            let resizeTimeout = null;
            const scheduleRelayout = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function checkAndLayout() {
                    if (isToolModalAnimating || isResModalAnimating) {
                        resizeTimeout = setTimeout(checkAndLayout, 60);
                        return;
                    }
                    updateOpenModalsLayout(false);
                }, 80);
            };
            const ro = new ResizeObserver(() => {
                if (document.body.classList.contains('tool-modal-open') || document.body.classList.contains('res-modal-open')) {
                    scheduleRelayout();
                }
            });
            ro.observe(toolModalBody);
        }
    }

    let currentToolFile = null;
    let currentToolItem = null;

    function populateToolDetails(tool) {
        currentToolItem = tool;
        currentToolFile = null;

        function getProcessKey(t) {
            const map = {
                'tool-tiktok-patcher': 'patcher_btn_process',
                'tool-video-compressor': 'tool_compressor_btn',
                'tool-audio-extractor': 'tool_audio_btn',
                'tool-image-sequence': 'tool_seq_btn',
                'tool-5mb-generator': 'tool_fivemb_btn_export',
                'tool-ae-am-beatmark': 'tool_ae_am_btn',
                'tool-upscale-enhancer': 'tool_upscale_btn',
                'tool-video-interpolation': 'tool_interp_btn',
                'tool-remove-background': 'tool_rembg_btn_process',
                'tool-tiktok-stats': 'tool_stats_btn',
                'tool-tiktok-downloader': 'tool_downloader_btn'
            };
            if (map[t._id]) return map[t._id];
            if (t.inputType === 'url') return t._id === 'tool-tiktok-stats' ? 'tool_stats_btn' : 'tool_downloader_btn';
            return 'patcher_btn_process';
        }
        function getProcessFallback(t) {
            const map = {
                'tool-tiktok-patcher': 'Process Video',
                'tool-video-compressor': 'Start Compression',
                'tool-audio-extractor': 'Extract Audio',
                'tool-image-sequence': 'Convert to Video',
                'tool-5mb-generator': 'Process',
                'tool-ae-am-beatmark': 'Convert & Download XML',
                'tool-upscale-enhancer': 'Start Processing',
                'tool-video-interpolation': 'Interpolate Video',
                'tool-remove-background': 'Process Media',
                'tool-tiktok-stats': 'Get Statistics',
                'tool-tiktok-downloader': 'Download Video'
            };
            return map[t._id] || 'Process Video';
        }

        const dropZone = document.getElementById('tool-drop-zone');
        const fileInput = document.getElementById('tool-file-input');
        const dropIcon = document.getElementById('tool-drop-icon');
        const dropContent = dropZone ? dropZone.querySelector('.tool-drop-content') : null;
        const fileBadge = document.getElementById('tool-file-badge');
        const fileNameEl = document.getElementById('tool-file-name');
        const fileSizeEl = document.getElementById('tool-file-size');
        const optContainer = document.getElementById('tool-dynamic-options');
        const progressSec = document.getElementById('tool-progress-section');
        const progressFill = document.getElementById('tool-progress-fill');
        const progressStatus = document.getElementById('tool-progress-status');
        const progressPercent = document.getElementById('tool-progress-percent');
        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        const downloadBtn = document.getElementById('tool-download-btn');

        const dropTitle = document.getElementById('tool-drop-title');
        const dropSubtitle = document.getElementById('tool-drop-subtitle');

        if (tool.inputType === 'url' || tool.hideDropZone) {
            if (dropZone) dropZone.classList.add('hidden');
        } else {
            if (dropZone) dropZone.classList.remove('hidden');
            if (fileInput) fileInput.multiple = !!tool.multiFile;
            if (tool._id === 'tool-image-sequence') {
                if (fileInput) fileInput.accept = '.zip,application/zip,application/x-zip-compressed';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_seq_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_seq_drop')) || 'Drop ZIP sequence here or click to browse';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_zip');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_zip')) || 'Supports ZIP containing PNG, JPG, WebP';
                }
            } else if (tool._id === 'tool-5mb-generator') {
                if (fileInput) fileInput.accept = '.xml,text/xml,application/xml';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_fivemb_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_fivemb_drop')) || 'Drop Alight Motion XML here or browse';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_xml');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_xml')) || 'Supports Alight Motion project (.xml)';
                }
            } else if (tool._id === 'tool-ae-am-beatmark') {
                if (fileInput) fileInput.accept = '.xml,text/xml,application/xml';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_ae_am_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_ae_am_drop')) || 'Drop After Effects Project XML here';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_ae');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_ae')) || 'Supports After Effects (.xml)';
                }
            } else if (tool._id === 'tool-upscale-enhancer') {
                if (fileInput) fileInput.accept = 'video/*,image/*,video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_upscale_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_upscale_drop')) || 'Drop photos / videos here or click to select';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_media');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_media')) || 'Supports MP4, MOV, WebM, PNG, JPG, WebP';
                }
            } else if (tool._id === 'tool-video-interpolation') {
                if (fileInput) fileInput.accept = 'video/mp4,video/quicktime,video/webm,video/*';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_interp_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_interp_drop')) || 'Drop video here or click to select';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_video');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_video')) || 'Supports MP4, MOV, WebM';
                }
            } else if (tool._id === 'tool-remove-background') {
                if (fileInput) fileInput.accept = 'video/*,image/*,video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_rembg_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_rembg_drop')) || 'Drop video or image here or click to select';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_media');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_media')) || 'Supports MP4, MOV, WebM, PNG, JPG, WebP';
                }
            } else if (tool._id === 'tool-audio-extractor') {
                if (fileInput) fileInput.accept = 'video/mp4,video/quicktime,video/webm,video/*';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_audio_extractor_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_audio_extractor_drop')) || 'Drop video here or click to select';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_video');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_video')) || 'Supports MP4, MOV, WebM';
                }
            } else if (tool._id === 'tool-video-compressor') {
                if (fileInput) fileInput.accept = 'video/mp4,video/quicktime,video/webm,video/*';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'tool_compressor_drop');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('tool_compressor_drop')) || 'Drop video here or click to select';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_video');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_video')) || 'Supports MP4, MOV, WebM';
                }
            } else {
                if (fileInput) fileInput.accept = 'video/mp4,video/quicktime,video/webm,video/*';
                if (dropTitle) {
                    dropTitle.setAttribute('data-i18n', 'patcher_drop_label');
                    dropTitle.textContent = (window.getTranslation && window.getTranslation('patcher_drop_label')) || 'Drop video here or click to browse';
                }
                if (dropSubtitle) {
                    dropSubtitle.setAttribute('data-i18n', 'tool_drop_formats_video');
                    dropSubtitle.textContent = (window.getTranslation && window.getTranslation('tool_drop_formats_video')) || 'Supports MP4, MOV, WebM';
                }
            }
        }

        if (tool.hideProcessBtn) {
            if (processBtn && processBtn.parentElement) processBtn.parentElement.classList.add('hidden');
        } else {
            if (processBtn && processBtn.parentElement) processBtn.parentElement.classList.remove('hidden');
        }

        if (tool.hideProgress) {
            if (progressSec) progressSec.classList.add('hidden');
        }

        if (optContainer) {
            optContainer.innerHTML = '';
        }

        if (typeof tool.initModal === 'function') {
            tool.initModal({
                optContainer,
                dropZone,
                fileInput,
                processBtn,
                processLabel,
                downloadBtn,
                progressSec
            });
        }

        const activeState = (window.ToolProgressManager && tool && tool._id) ? window.ToolProgressManager.get(tool._id) : null;
        if (activeState && (activeState.isProcessing || activeState.completed)) {
            currentToolFile = activeState.file || null;
            if (currentToolFile && fileNameEl && fileSizeEl) {
                fileNameEl.textContent = currentToolFile.name;
                fileSizeEl.textContent = `(${(currentToolFile.size / (1024 * 1024)).toFixed(1)} MB)`;
                if (dropIcon) dropIcon.classList.add('hidden');
                if (dropContent) dropContent.classList.add('hidden');
                if (fileBadge) fileBadge.classList.remove('hidden');
            }
            if (tool.hideDropOnUpload && dropZone && currentToolFile) dropZone.classList.add('hidden');
            if (progressSec) progressSec.classList.remove('hidden');
            const p = Math.max(0, Math.min(100, Math.round(activeState.percent || 0)));
            if (progressFill) progressFill.style.width = `${p}%`;
            if (progressPercent) progressPercent.textContent = `${p}%`;
            if (progressStatus && activeState.status) progressStatus.textContent = activeState.status;

            if (processBtn) {
                if (activeState.isProcessing) {
                    processBtn.disabled = true;
                    processBtn.dataset.state = 'processing';
                } else if (activeState.completed) {
                    processBtn.disabled = false;
                    processBtn.dataset.state = 'completed';
                    if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation('status_process_another')) || 'Process Another';
                }
            }
        } else {
            if (fileBadge) fileBadge.classList.add('hidden');
            if (dropIcon) dropIcon.classList.remove('hidden');
            if (dropContent) dropContent.classList.remove('hidden');
            if (fileInput) fileInput.value = '';
            if (progressSec) progressSec.classList.add('hidden');
            if (progressFill) progressFill.style.width = '0%';
            if (progressPercent) progressPercent.textContent = '0%';
            if (downloadBtn) downloadBtn.classList.add('hidden');
            if (processBtn) {
                if (tool.inputType === 'url') {
                    processBtn.disabled = false;
                    processBtn.dataset.state = 'ready';
                } else {
                    processBtn.disabled = true;
                    processBtn.dataset.state = 'idle';
                }
                if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation(getProcessKey(tool))) || getProcessFallback(tool);
            }
        }

        const resetForNewVideo = () => {
            currentToolFile = null;
            if (window.ToolProgressManager && tool && tool._id) {
                window.ToolProgressManager.clear(tool._id);
            }
            if (window._tktk) {
                window._tktk.selectedFile = null;
                window._tktk.currentFileBuffer = null;
                window._tktk.isProcessing = false;
            }
            if (typeof tool.onReset === 'function') {
                tool.onReset();
            }

            populateToolDetails(tool);

            if (typeof window.updateOpenModalsLayout === 'function') {
                window.updateOpenModalsLayout(true);
            }
        };

        const handleFileSelect = (file) => {
            if (!file) return;
            currentToolFile = file;
            if (window._tktk) window._tktk.selectedFile = file;
            if (fileNameEl) fileNameEl.textContent = file.name;
            if (fileSizeEl) fileSizeEl.textContent = `(${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
            if (dropIcon) dropIcon.classList.add('hidden');
            if (dropContent) dropContent.classList.add('hidden');
            if (fileBadge) fileBadge.classList.remove('hidden');
            if (tool.hideDropOnUpload && dropZone) dropZone.classList.add('hidden');
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.dataset.state = 'ready';
                if (processLabel) processLabel.textContent = (window.getTranslation && window.getTranslation(getProcessKey(tool))) || getProcessFallback(tool);
            }
            if (downloadBtn) downloadBtn.classList.add('hidden');
            if (progressSec) progressSec.classList.add('hidden');

            if (typeof tool.onFileSelect === 'function') {
                tool.onFileSelect(file);
            }
        };

        if (dropZone && fileInput) {
            const handleFileList = (fileList) => {
                if (!fileList || fileList.length === 0) return;
                if (fileList.length > 1 && typeof tool.onFilesSelect === 'function') {
                    tool.onFilesSelect(Array.from(fileList));
                    return;
                }
                handleFileSelect(fileList[0]);
            };
            dropZone.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    handleFileList(e.target.files);
                }
            };

            dropZone.ondragover = (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            };
            dropZone.ondragleave = () => {
                dropZone.classList.remove('dragover');
            };
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileList(e.dataTransfer.files);
                }
            };
        }

        if (processBtn) {
            processBtn.onclick = () => {
                if (processBtn.dataset.state === 'completed') {
                    resetForNewVideo();
                    return;
                }
                const canProcess = typeof tool.canProcess === 'function'
                    ? tool.canProcess(currentToolFile)
                    : (tool.inputType === 'url' || tool.hideDropZone || !!currentToolFile);
                if (!canProcess) return;
                if (typeof tool.onProcess === 'function') {
                    tool.onProcess(currentToolFile);
                }
            };
        }
    }

    function openToolModal(tool, sourceCard) {
        const backdrop = document.getElementById('tool-modal-backdrop');
        const cardEl = document.getElementById('tool-modal-card');
        if (!backdrop || !cardEl || isToolModalAnimating || !sourceCard) return;

        isToolModalAnimating = true;
        cachedToolSourceCard = sourceCard;

        const sourceW = sourceCard.offsetWidth;
        const sourceH = sourceCard.offsetHeight;
        const rect = sourceCard.getBoundingClientRect();
        const sRect = {
            left: rect.left,
            top: rect.top,
            width: sourceW,
            height: sourceH
        };
        cachedToolSourceRect = sRect;

        const heroSlot = document.getElementById('tool-modal-hero-slot');
        if (heroSlot) {
            heroSlot.innerHTML = sourceCard.innerHTML;
            const sArrow = heroSlot.querySelector('.tool-card-arrow');
            if (sArrow) sArrow.remove();
        }

        populateToolDetails(tool);

        const closeBtn = document.getElementById('tool-modal-close-btn');
        const closeProgress = document.getElementById('tool-close-progress-text');
        const state = (window.ToolProgressManager && tool && tool._id) ? window.ToolProgressManager.get(tool._id) : null;
        if (closeBtn) {
            closeBtn.classList.remove('is-closing');
            if (state && state.isProcessing) {
                closeBtn.classList.add('is-processing');
                if (closeProgress) closeProgress.textContent = `${Math.max(0, Math.min(100, Math.round(state.percent || 0)))}%`;
            } else {
                closeBtn.classList.remove('is-processing');
                if (closeProgress) closeProgress.textContent = '';
            }
        }

        const geom = getModalTargetGeometry(cardEl, 0.86);

        cardEl.classList.remove('expanded');
        cardEl.style.willChange = 'left, top, width, height';
        cardEl.style.left = `${sRect.left}px`;
        cardEl.style.top = `${sRect.top}px`;
        cardEl.style.width = `${sRect.width}px`;
        cardEl.style.height = `${sRect.height}px`;
        cardEl.style.maxHeight = 'none';
        cardEl.style.borderRadius = 'var(--radius-l)';
        cardEl.style.background = 'var(--md-sys-color-surface-container)';
        cardEl.style.border = '1px solid var(--md-sys-color-outline-variant)';
        cardEl.style.opacity = '1';
        cardEl.style.visibility = 'visible';
        cardEl.style.pointerEvents = 'auto';

        backdrop.style.visibility = 'visible';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'none';

        sourceCard.style.visibility = 'hidden';

        void cardEl.offsetHeight;

        const isMobileMorph = window.innerWidth <= 600;
        const morphS = isMobileMorph ? 0.34 : 0.42;
        cardEl.classList.add('is-morphing');

        predecodeHeroImages(heroSlot || cardEl).then(() => {
            requestAnimationFrame(() => {
                document.body.classList.add('tool-modal-open');
                backdrop.classList.add('active');
                backdrop.style.transition = 'opacity 0.38s var(--ease-spring-soft)';
                backdrop.style.opacity = '1';
                cardEl.classList.add('expanded');

                cardEl.style.transition = `left ${morphS}s var(--ease-spring-soft), top ${morphS}s var(--ease-spring-soft), width ${morphS}s var(--ease-spring-soft), height ${morphS}s var(--ease-spring-soft), border-radius ${morphS}s var(--ease-spring-soft)`;
                cardEl.style.left = `${geom.targetLeft}px`;
                cardEl.style.top = `${geom.targetTop}px`;
                cardEl.style.width = `${geom.targetW}px`;
                cardEl.style.height = `${geom.targetH}px`;
                cardEl.style.borderRadius = geom.borderRadius;

                setTimeout(() => {
                    cardEl.classList.remove('is-morphing');
                    cardEl.style.willChange = '';
                    isToolModalAnimating = false;
                    updateOpenModalsLayout(false);
                }, Math.round(morphS * 1000) + 20);
            });
        });
    };

    function closeToolModal() {
        const backdrop = document.getElementById('tool-modal-backdrop');
        const cardEl = document.getElementById('tool-modal-card');
        if (isToolModalAnimating || !backdrop || !cardEl) return;

        isToolModalAnimating = true;

        const closeBtn = document.getElementById('tool-modal-close-btn');
        if (closeBtn) closeBtn.classList.add('is-closing');

        let sRect = cachedToolSourceRect;

        if (sRect) {
            const curRect = cardEl.getBoundingClientRect();
            cardEl.style.transition = 'none';
            cardEl.style.willChange = 'left, top, width, height';
            cardEl.style.left = `${curRect.left}px`;
            cardEl.style.top = `${curRect.top}px`;
            cardEl.style.width = `${curRect.width}px`;
            cardEl.style.height = `${curRect.height}px`;
            cardEl.style.maxHeight = 'none';
            cardEl.style.opacity = '1';

            void cardEl.offsetHeight;

            const isMobileMorph = window.innerWidth <= 600;
            const morphS = isMobileMorph ? 0.32 : 0.40;
            cardEl.classList.add('is-morphing');

            requestAnimationFrame(() => {
                document.body.classList.remove('tool-modal-open');
                cardEl.classList.remove('expanded');

                cardEl.style.transition = `left ${morphS}s var(--ease-spring-soft), top ${morphS}s var(--ease-spring-soft), width ${morphS}s var(--ease-spring-soft), height ${morphS}s var(--ease-spring-soft), border-radius ${morphS}s var(--ease-spring-soft)`;
                cardEl.style.left = `${sRect.left}px`;
                cardEl.style.top = `${sRect.top}px`;
                cardEl.style.width = `${sRect.width}px`;
                cardEl.style.height = `${sRect.height}px`;
                cardEl.style.borderRadius = 'var(--radius-l)';

                backdrop.style.transition = 'opacity 0.38s var(--ease-spring-soft)';
                backdrop.style.opacity = '0';

                setTimeout(() => {
                    if (cachedToolSourceCard) {
                        cachedToolSourceCard.style.visibility = 'visible';
                    }

                    if (closeBtn) closeBtn.classList.remove('is-closing');
                    backdrop.classList.remove('active');
                    backdrop.style.cssText = '';
                    cardEl.style.cssText = '';
                    cardEl.classList.remove('is-morphing');

                    if (currentToolItem) {
                        const stAfterClose = (window.ToolProgressManager && currentToolItem._id)
                            ? window.ToolProgressManager.get(currentToolItem._id)
                            : null;
                        if (!stAfterClose || !stAfterClose.isProcessing) {
                            if (stAfterClose && stAfterClose.completed && window.ToolProgressManager) {
                                window.ToolProgressManager.clear(currentToolItem._id);
                            }
                            if (typeof currentToolItem.onReset === 'function') {
                                currentToolItem.onReset();
                            }
                            const optC = document.getElementById('tool-dynamic-options');
                            if (optC) optC.innerHTML = '';
                        }
                    }

                    isToolModalAnimating = false;
                }, Math.round(morphS * 1000) + 20);
            });
        } else {
            document.body.classList.remove('tool-modal-open');
            backdrop.classList.remove('active');
            cardEl.style.cssText = '';
            cardEl.classList.remove('is-morphing');
            if (currentToolItem) {
                const stAfterClose = (window.ToolProgressManager && currentToolItem._id)
                    ? window.ToolProgressManager.get(currentToolItem._id)
                    : null;
                if (!stAfterClose || !stAfterClose.isProcessing) {
                    if (stAfterClose && stAfterClose.completed && window.ToolProgressManager) {
                        window.ToolProgressManager.clear(currentToolItem._id);
                    }
                    if (typeof currentToolItem.onReset === 'function') {
                        currentToolItem.onReset();
                    }
                    const optC = document.getElementById('tool-dynamic-options');
                    if (optC) optC.innerHTML = '';
                }
            }
            isToolModalAnimating = false;
        }
    };

    function renderTools(query = '', filterCategory = 'All') {
        const container = document.getElementById('tools-grid');
        if (!container) return;

        renderToolCategories(allTools);

        let filtered = allTools;

        if (filterCategory !== 'All') {
            filtered = filtered.filter(t => {
                const cats = Array.isArray(t.category) ? t.category : (t.category ? [t.category] : []);
                return cats.includes(filterCategory);
            });
        }

        if (query) {
            const q = query.toLowerCase().trim();
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.desc && t.desc.toLowerCase().includes(q)) ||
                (t.version && t.version.toLowerCase().includes(q)) ||
                (Array.isArray(t.category) ? t.category.join(' ') : (t.category || '')).toLowerCase().includes(q)
            );
        }

        if (filtered.length > 0) {
            container.innerHTML = filtered.map(t => {
                let tIcon = t.icon ? String(t.icon).trim() : '';
                if (tIcon.startsWith('assets/')) tIcon = '/' + tIcon;
                const iconHtml = (tIcon && (tIcon.startsWith('http') || tIcon.includes('/')))
                    ? `<img src="${tIcon}" class="tool-icon-img" alt="${t.title}">`
                    : `<span class="material-symbols-rounded tool-icon">${t.icon || 'build'}</span>`;

                const state = (window.ToolProgressManager && window.ToolProgressManager.get(t._id)) || {};
                let arrowContent = `<span class="material-symbols-rounded">chevron_right</span>`;
                let arrowClass = '';
                if (state.isProcessing) {
                    arrowClass = 'is-processing';
                    arrowContent = `<span class="tool-card-progress-text">${Math.max(0, Math.min(100, Math.round(state.percent || 0)))}%</span>`;
                } else if (state.completed) {
                    arrowClass = 'is-completed';
                    arrowContent = `<span class="material-symbols-rounded">check</span>`;
                }

                const title = (t.titleKey && window.getTranslation ? window.getTranslation(t.titleKey) : null) || t.title;
                const desc = (t.descKey && window.getTranslation ? window.getTranslation(t.descKey) : null) || t.desc || '';
                const titleAttr = t.titleKey ? ` data-i18n="${t.titleKey}"` : '';
                const descAttr = t.descKey ? ` data-i18n="${t.descKey}"` : '';

                return `
                <div class="tool-card ${state.isProcessing ? 'tool-card-processing' : ''}" data-id="${t._id}">
                    <div class="tool-icon-wrapper">
                        ${iconHtml}
                        <span class="tool-ver-badge">${t.version || 'v1.0.0'}</span>
                    </div>
                    <div class="tool-info">
                        <h4 class="tool-title"${titleAttr}>${title}</h4>
                        <p class="tool-desc"${descAttr}>${desc}</p>
                    </div>
                    <div class="tool-card-arrow ${arrowClass}">
                        ${arrowContent}
                    </div>
                </div>`;
            }).join('');

            container.querySelectorAll('.tool-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const item = allTools.find(t => t._id === id);
                    if (item) {
                        openToolModal(item, card);
                    }
                });
            });
        } else {
            const noToolsMsg = (window.getTranslation && window.getTranslation('no_results')) || 'No tools found';
            container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded empty-state-icon">search_off</span><p class="empty-state-text">${noToolsMsg}</p></div>`;
        }
    };

    const populateResourceDetails = (resource) => {
        let selectedOs = null;
        let selectedVer = null;
        let osVersionMap = {};

        const osArr = Array.isArray(resource.os) ? resource.os : [];
        osArr.forEach(o => {
            const rawName = typeof o === 'string' ? o : (o.name || '');
            const key = resolveOsKey(rawName) || String(rawName).toUpperCase();
            osVersionMap[key] = o.versions || [];
        });

        const downloadSection = document.getElementById('res-modal-download-section');
        const verSection = document.getElementById('res-modal-ver-section');
        const passwordSection = document.getElementById('res-modal-password-section');
        const instrSection = document.getElementById('res-modal-instruction-section');

        const downloadBtn = document.getElementById('res-modal-download-btn');
        const downloadLabel = document.getElementById('res-modal-download-label');
        const verChipsEl = document.getElementById('res-modal-ver-chips');
        const osChipsEl = document.getElementById('res-modal-os-chips');

        verSection.classList.add('hidden');
        downloadSection.classList.add('hidden');
        passwordSection.classList.add('hidden');
        instrSection.classList.add('hidden');

        const adjustModalLayout = (duration = 0.38) => {
            const cardEl = document.getElementById('res-modal-card');
            if (!cardEl || !cardEl.classList.contains('expanded')) return;

            const curH = cardEl.getBoundingClientRect().height;
            const curTop = cardEl.getBoundingClientRect().top;

            cardEl.style.transition = 'none';
            cardEl.style.height = `${curH}px`;
            cardEl.style.top = `${curTop}px`;

            const geom = getModalTargetGeometry(cardEl, 0.86);

            cardEl.style.height = `${curH}px`;
            cardEl.style.top = `${curTop}px`;
            void cardEl.offsetHeight;

            requestAnimationFrame(() => {
                cardEl.style.transition = `top ${duration}s var(--ease-spring-soft), height ${duration}s var(--ease-spring-soft), left ${duration}s var(--ease-spring-soft), width ${duration}s var(--ease-spring-soft), border-radius ${duration}s var(--ease-spring-soft)`;
                cardEl.style.left = `${geom.targetLeft}px`;
                cardEl.style.width = `${geom.targetW}px`;
                cardEl.style.height = `${geom.targetH}px`;
                cardEl.style.top = `${geom.targetTop}px`;
                cardEl.style.borderRadius = geom.borderRadius;
            });
        };

        const updateDownloadBtn = () => {
            if (selectedOs && selectedVer) {
                const versions = osVersionMap[selectedOs] || [];
                const entry = versions.find(v => v.label === selectedVer);
                if (entry && entry.url) {
                    downloadBtn.disabled = false;
                    downloadBtn.onclick = () => window.open(ensureProtocol(entry.url), '_blank');
                    downloadLabel.textContent = `${OS_LABEL[selectedOs] || selectedOs} • ${selectedVer}`;

                    downloadSection.classList.remove('hidden');
                    passwordSection.classList.remove('hidden');
                    if (resource.instruction) {
                        instrSection.classList.remove('hidden');
                    }
                } else {
                    downloadBtn.disabled = true;
                    downloadLabel.textContent = (window.getTranslation && window.getTranslation('res_no_link')) || 'No download link configured';
                    downloadSection.classList.remove('hidden');
                    passwordSection.classList.add('hidden');
                    instrSection.classList.add('hidden');
                }
            } else {
                downloadBtn.disabled = true;
                downloadLabel.textContent = (window.getTranslation && window.getTranslation('res_modal_select_os')) || 'Select OS & Version';
                downloadSection.classList.add('hidden');
                passwordSection.classList.add('hidden');
                instrSection.classList.add('hidden');
            }
        };

        const renderVerChips = () => {
            if (!selectedOs) {
                verSection.classList.add('hidden');
                adjustModalLayout();
                return;
            }
            const versions = osVersionMap[selectedOs] || [];
            if (!versions.length) {
                const noVerText = (window.getTranslation && window.getTranslation('res_no_versions')) || 'No versions available';
                verChipsEl.innerHTML = `<span style="color:var(--md-sys-color-on-surface-variant);font-size:13px">${noVerText}</span>`;
                verSection.classList.remove('hidden');
                adjustModalLayout();
                return;
            }
            verChipsEl.innerHTML = versions.map(v =>
                `<button type="button" class="res-popup-chip ${selectedVer === v.label ? 'active' : ''}" data-ver="${v.label}">${v.label}</button>`
            ).join('');
            verSection.classList.remove('hidden');
            adjustModalLayout();

            verChipsEl.querySelectorAll('.res-popup-chip').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedVer = btn.dataset.ver;
                    verChipsEl.querySelectorAll('.res-popup-chip').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateDownloadBtn();
                    adjustModalLayout();
                });
            });
        };

        const osSection = document.getElementById('res-modal-os-section');
        const isWebApp = Array.isArray(resource.category) ? resource.category.some(c => String(c).toLowerCase().includes('web app')) : String(resource.category || '').toLowerCase().includes('web app');
        
        if (isWebApp) {
            if (osSection) osSection.classList.add('hidden');
            verSection.classList.add('hidden');
            
            let launchUrl = '';
            const osKeys = Object.keys(osVersionMap);
            for (const key of osKeys) {
                if (osVersionMap[key].length > 0 && osVersionMap[key][0].url) {
                    launchUrl = osVersionMap[key][0].url;
                    break;
                }
            }

            if (launchUrl) {
                downloadBtn.disabled = false;
                downloadBtn.onclick = () => window.open(ensureProtocol(launchUrl), '_blank');
                downloadLabel.textContent = (window.getTranslation && window.getTranslation('res_launch_apps')) || 'Launch Apps';
                downloadSection.classList.remove('hidden');
                passwordSection.classList.add('hidden');
                if (resource.instruction) instrSection.classList.remove('hidden');
            } else {
                downloadBtn.disabled = true;
                downloadLabel.textContent = (window.getTranslation && window.getTranslation('res_no_link')) || 'No URL configured';
                downloadSection.classList.remove('hidden');
            }
            adjustModalLayout();
        } else {
            if (osSection) osSection.classList.remove('hidden');
            const osKeys = Object.keys(osVersionMap);
            if (osKeys.length > 0) {
                osChipsEl.innerHTML = osKeys.map(key =>
                    `<button type="button" class="res-popup-chip os-chip-btn" data-os="${key}" title="${OS_LABEL[key] || key}" aria-label="${OS_LABEL[key] || key}">
                        ${OS_SVG[key] ? `<img src="${OS_SVG[key]}" class="os-icon-svg" alt="${key}">` : ''}
                    </button>`
                ).join('');
                osChipsEl.querySelectorAll('.os-chip-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        selectedOs = btn.dataset.os;
                        selectedVer = null;
                        osChipsEl.querySelectorAll('.os-chip-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        downloadSection.classList.add('hidden');
                        passwordSection.classList.add('hidden');
                        instrSection.classList.add('hidden');

                        renderVerChips();
                    });
                });
            } else {
                const noPlatText = (window.getTranslation && window.getTranslation('res_no_platforms')) || 'No platforms configured';
                osChipsEl.innerHTML = `<span style="color:var(--md-sys-color-on-surface-variant);font-size:13px">${noPlatText}</span>`;
            }
        }

        document.getElementById('res-modal-password').textContent = RESOURCE_PASSWORD;
        const copyBtn = document.getElementById('res-modal-copy-btn');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(RESOURCE_PASSWORD).then(() => {
                const icon = copyBtn.querySelector('.material-symbols-rounded');
                const text = copyBtn.querySelector('span:not(.material-symbols-rounded)');
                if (icon) icon.textContent = 'check';
                if (text) text.textContent = (window.getTranslation && window.getTranslation('copied')) || 'Copied!';
                setTimeout(() => {
                    if (icon) icon.textContent = 'content_copy';
                    if (text) text.textContent = (window.getTranslation && window.getTranslation('res_modal_copy')) || 'Copy';
                }, 1800);
            });
        };

        const instrEl = document.getElementById('res-modal-instruction');
        if (resource.instruction) {
            instrEl.textContent = resource.instruction;
        }
    };

    const openResourceModal = (resource, sourceCard) => {
        const backdrop = document.getElementById('res-modal-backdrop');
        const cardEl = document.getElementById('res-modal-card');
        if (!backdrop || !cardEl || isResModalAnimating || !sourceCard) return;

        isResModalAnimating = true;
        cachedSourceCard = sourceCard;

        const sourceW = sourceCard.offsetWidth;
        const sourceH = sourceCard.offsetHeight;
        const rect = sourceCard.getBoundingClientRect();
        const sRect = {
            left: rect.left,
            top: rect.top,
            width: sourceW,
            height: sourceH
        };
        cachedResSourceRect = sRect;


        populateResourceDetails(resource);


        const heroSlot = document.getElementById('res-modal-hero-slot');
        if (heroSlot) {
            heroSlot.innerHTML = sourceCard.innerHTML;
            const sArrow = heroSlot.querySelector('.resource-card-arrow');
            if (sArrow) sArrow.remove();
        }


        const isCutefish = sourceCard.classList.contains('resource-card-cutefish');
        const initialBg = 'var(--md-sys-color-surface-container)';
        const initialBorder = isCutefish ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)';

        const geom = getModalTargetGeometry(cardEl, 0.86);


        cardEl.classList.remove('expanded');
        cardEl.style.willChange = 'left, top, width, height';
        cardEl.style.left = `${sRect.left}px`;
        cardEl.style.top = `${sRect.top}px`;
        cardEl.style.width = `${sRect.width}px`;
        cardEl.style.height = `${sRect.height}px`;
        cardEl.style.maxHeight = 'none';
        cardEl.style.borderRadius = 'var(--radius-l)';
        cardEl.style.background = initialBg;
        cardEl.style.border = initialBorder;
        cardEl.style.opacity = '1';
        cardEl.style.visibility = 'visible';


        backdrop.style.visibility = 'visible';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'none';


        sourceCard.style.visibility = 'hidden';

        void cardEl.offsetHeight;

        const isMobileMorph = window.innerWidth <= 600;
        const morphS = isMobileMorph ? 0.34 : 0.42;
        cardEl.classList.add('is-morphing');

        predecodeHeroImages(heroSlot || cardEl).then(() => {
            requestAnimationFrame(() => {
                document.body.classList.add('res-modal-open');
                backdrop.classList.add('active');
                backdrop.style.transition = 'opacity 0.38s var(--ease-spring-soft)';
                backdrop.style.opacity = '1';
                cardEl.classList.add('expanded');


                cardEl.style.transition = `left ${morphS}s var(--ease-spring-soft), top ${morphS}s var(--ease-spring-soft), width ${morphS}s var(--ease-spring-soft), height ${morphS}s var(--ease-spring-soft), border-radius ${morphS}s var(--ease-spring-soft)`;
                cardEl.style.left = `${geom.targetLeft}px`;
                cardEl.style.top = `${geom.targetTop}px`;
                cardEl.style.width = `${geom.targetW}px`;
                cardEl.style.height = `${geom.targetH}px`;
                cardEl.style.borderRadius = geom.borderRadius;

                setTimeout(() => {
                    cardEl.classList.remove('is-morphing');
                    cardEl.style.willChange = '';
                    isResModalAnimating = false;
                }, Math.round(morphS * 1000) + 20);
            });
        });
    };

    const closeResourceModal = () => {
        const backdrop = document.getElementById('res-modal-backdrop');
        const cardEl = document.getElementById('res-modal-card');
        if (isResModalAnimating || !backdrop || !cardEl) return;

        isResModalAnimating = true;

        let sRect = cachedResSourceRect;

        if (sRect) {
            const curRect = cardEl.getBoundingClientRect();
            cardEl.style.transition = 'none';
            cardEl.style.willChange = 'left, top, width, height';
            cardEl.style.left = `${curRect.left}px`;
            cardEl.style.top = `${curRect.top}px`;
            cardEl.style.width = `${curRect.width}px`;
            cardEl.style.height = `${curRect.height}px`;
            cardEl.style.maxHeight = 'none';
            cardEl.style.opacity = '1';

            const isMobileMorph = window.innerWidth <= 600;
            const morphS = isMobileMorph ? 0.32 : 0.40;
            cardEl.classList.add('is-morphing');


            requestAnimationFrame(() => {
                document.body.classList.remove('res-modal-open');
                cardEl.classList.remove('expanded');

                const isCutefish = cachedSourceCard && cachedSourceCard.classList.contains('resource-card-cutefish');
                const targetBg = 'var(--md-sys-color-surface-container)';
                const targetBorder = isCutefish ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)';

                cardEl.style.transition = `left ${morphS}s var(--ease-spring-soft), top ${morphS}s var(--ease-spring-soft), width ${morphS}s var(--ease-spring-soft), height ${morphS}s var(--ease-spring-soft), border-radius ${morphS}s var(--ease-spring-soft)`;
                cardEl.style.left = `${sRect.left}px`;
                cardEl.style.top = `${sRect.top}px`;
                cardEl.style.width = `${sRect.width}px`;
                cardEl.style.height = `${sRect.height}px`;
                cardEl.style.borderRadius = 'var(--radius-l)';
                cardEl.style.background = targetBg;
                cardEl.style.border = targetBorder;

                backdrop.style.transition = 'opacity 0.38s var(--ease-spring-soft)';
                backdrop.style.opacity = '0';

                setTimeout(() => {
                    if (cachedSourceCard) {
                        cachedSourceCard.style.visibility = 'visible';
                    }

                    backdrop.classList.remove('active');
                    backdrop.style.cssText = '';
                    cardEl.style.cssText = '';
                    cardEl.classList.remove('is-morphing');

                    isResModalAnimating = false;
                }, Math.round(morphS * 1000) + 20);
            });
        } else {
            document.body.classList.remove('res-modal-open');
            backdrop.classList.remove('active');
            cardEl.style.cssText = '';
            cardEl.classList.remove('is-morphing');
            isResModalAnimating = false;
        }
    };

    const closeResBtn = document.getElementById('res-modal-close-btn');
    if (closeResBtn) {
        closeResBtn.addEventListener('click', closeResourceModal);
    }

    const resBackdrop = document.getElementById('res-modal-backdrop');
    if (resBackdrop) {
        resBackdrop.addEventListener('click', (e) => {
            if (e.target === resBackdrop) closeResourceModal();
        });
    }

    const closeToolBtn = document.getElementById('tool-modal-close-btn');
    if (closeToolBtn) {
        closeToolBtn.addEventListener('click', closeToolModal);
    }

    const toolBackdrop = document.getElementById('tool-modal-backdrop');
    if (toolBackdrop) {
        toolBackdrop.addEventListener('click', (e) => {
            if (e.target === toolBackdrop) closeToolModal();
        });
    }

    function makeSearchDebounce(fn, delayMs) {
        let timer = null;
        return (e) => {
            const val = e.target.value;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn(val), delayMs);
        };
    }

    const resSearchInput = document.getElementById('resource-search');
    if (resSearchInput) {
        resSearchInput.addEventListener('input', makeSearchDebounce((val) => {
            renderResources(val, activeResourceCategory);
        }, 160));
    }

    const toolsSearchInput = document.getElementById('tools-search');
    if (toolsSearchInput) {
        toolsSearchInput.addEventListener('input', makeSearchDebounce((val) => {
            renderTools(val, activeToolCategory);
        }, 160));
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeResourceModal();
            closeToolModal();
        }
    });

    renderTools();
    renderResources();

    const views = {
        home: document.getElementById('view-home'),
        social: document.getElementById('view-social'),
        tools: document.getElementById('view-tools'),
        resource: document.getElementById('view-resource'),
        preset: document.getElementById('view-preset'),
        contact: document.getElementById('view-contact')
    };

    const dockOrder = ['preset', 'home', 'social', 'tools', 'resource', 'contact'];
    let cubeAngleAccum = 0;
    let parallaxAccumX = 0;

    const getDockDelta = (fromKey, toKey) => {
        const fromIdx = dockOrder.indexOf(fromKey);
        const toIdx = dockOrder.indexOf(toKey);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return 0;
        return -(toIdx - fromIdx) * 60;
    };

    let currentViewKey = 'home';
    let isCubeRotating = false;

    function updateCubeDimensions() {
        const viewport = document.getElementById('cube-viewport');
        if (!viewport) return;
        const width = viewport.offsetWidth;
        if (width > 0) {
            const depth = Math.round(width / (2 * Math.tan(Math.PI / 6)));
            document.documentElement.style.setProperty('--cube-depth', `${depth}px`);
        }
    }

    function updateNavIndicator() {
        const navBar = document.getElementById('floating-nav');
        const indicator = document.getElementById('floating-nav-indicator');
        const activeItem = navBar ? navBar.querySelector('.floating-nav-item.active') : null;
        if (!navBar || !indicator || !activeItem) return;

        const navRect = navBar.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const leftPos = itemRect.left - navRect.left + (navBar.scrollLeft || 0);
        const width = itemRect.width;

        indicator.style.left = `${leftPos}px`;
        indicator.style.width = `${width}px`;
    }

    let navScrolledOnce = false;

    function scrollActiveNavIntoView() {
        const navBar = document.getElementById('floating-nav');
        const activeItem = navBar ? navBar.querySelector('.floating-nav-item.active') : null;
        if (!navBar || !activeItem) return;
        if (navBar.scrollWidth <= navBar.clientWidth + 1) return;
        const target = activeItem.offsetLeft - (navBar.clientWidth - activeItem.offsetWidth) / 2;
        const maxScroll = navBar.scrollWidth - navBar.clientWidth;
        const clamped = Math.max(0, Math.min(target, maxScroll));
        if (Math.abs(navBar.scrollLeft - clamped) < 1) return;
        try {
            navBar.scrollTo({ left: clamped, behavior: navScrolledOnce ? 'smooth' : 'auto' });
        } catch (e) {
            navBar.scrollLeft = clamped;
        }
    }

    let navIndicatorRaf = null;

    function trackNavIndicator(duration = 400) {
        if (navIndicatorRaf) cancelAnimationFrame(navIndicatorRaf);
        const startTime = performance.now();

        function step(now) {
            updateNavIndicator();
            if (now - startTime < duration) {
                navIndicatorRaf = requestAnimationFrame(step);
            } else {
                updateNavIndicator();
                navIndicatorRaf = null;
            }
        }
        navIndicatorRaf = requestAnimationFrame(step);
    }

    const floatingNavScrollEl = document.getElementById('floating-nav');
    if (floatingNavScrollEl) {
        floatingNavScrollEl.addEventListener('scroll', updateNavIndicator, { passive: true });
    }

    let cubeRotationTimer = null;

    function onTabSettled(viewKey) {
        if (viewKey === 'social') {
            renderSocialButtons();
        } else if (viewKey === 'contact') {
            renderContactButtons();
        } else if (viewKey === 'resource') {
            const resSearchInput = document.getElementById('resource-search');
            renderResources(resSearchInput ? resSearchInput.value : '', activeResourceCategory);
        } else if (viewKey === 'preset') {
            if (typeof window.loadPresetsIfNeeded === 'function') {
                window.loadPresetsIfNeeded();
            }
        }
    }

    function navigateToRoute() {
        if (document.body.classList.contains('legal-modal-open') || isModalAnimating) {
            document.body.classList.remove('legal-modal-open');
            cleanupLegalModal();
        }
        if (document.body.classList.contains('tool-modal-open')) {
            closeToolModal();
        }
        if (document.body.classList.contains('res-modal-open')) {
            closeResourceModal();
        }

        const rawHash = (window.location.hash || '#home').replace('#', '').toLowerCase();

        let activeViewKey = 'home';
        window.pendingPresetIndex = null;

        const hasExplicitHash = !!window.location.hash;
        const presetPathMatch = window.location.pathname.match(/^\/(?:preset\/)?(\d+)\/?$/);
        const isPresetDeepLink = presetPathMatch && (!hasExplicitHash || rawHash === 'preset' || rawHash === 'presets');

        if (isPresetDeepLink) {
            window.pendingPresetIndex = parseInt(presetPathMatch[1], 10);
            activeViewKey = 'preset';
            if (window.location.pathname !== `/${presetPathMatch[1]}`) {
                history.replaceState({ presetModalOpen: true, presetId: window.pendingPresetIndex }, '', `/${presetPathMatch[1]}`);
            }
        } else if (rawHash === 'social') {
            activeViewKey = 'social';
        } else if (rawHash === 'tools' || rawHash === 'tool') {
            activeViewKey = 'tools';
        } else if (rawHash === 'resource' || rawHash === 'resources') {
            activeViewKey = 'resource';
        } else if (['fishtoolupdate', 'fishtoolsupdate', 'fishtools'].includes(rawHash)) {
            activeViewKey = 'resource';
            window.pendingResourceTitle = 'fishtools';
        } else if (rawHash === 'preset' || rawHash === 'presets') {
            activeViewKey = 'preset';
        } else if (rawHash === 'contact' || rawHash === 'contact-us' || rawHash === 'contacts') {
            activeViewKey = 'contact';
        } else if (rawHash === 'privacy' || rawHash === 'tos' || rawHash === 'terms' || rawHash === 'disclaimer' || rawHash === 'dmca') {
            const doc = (rawHash === 'privacy') ? 'privacy' : (rawHash === 'disclaimer' || rawHash === 'dmca') ? 'disclaimer' : 'tos';
            openLegalModal(doc, document.querySelector(`[data-open-legal="${doc}"]`));
            activeViewKey = 'home';
        } else {
            activeViewKey = 'home';
        }

        const prevViewKey = currentViewKey;
        currentViewKey = activeViewKey;
        document.body.dataset.view = activeViewKey;

        if (window.location.pathname !== '/' && !isPresetDeepLink) {
            const keepHash = ['privacy', 'tos', 'terms', 'disclaimer', 'dmca'].includes(rawHash);
            const finalHash = keepHash ? `#${rawHash}` : (activeViewKey === 'home' ? '' : `#${activeViewKey}`);
            history.replaceState(null, '', `/${finalHash}`);
        }

        navItems.forEach(item => {
            const itemRoute = item.getAttribute('data-route');
            if (itemRoute === activeViewKey) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        trackNavIndicator(400);
        scrollActiveNavIntoView();
        navScrolledOnce = true;

        updateCubeDimensions();

        const moveDelta = getDockDelta(prevViewKey, activeViewKey);
        if (moveDelta !== 0) {
            cubeAngleAccum += moveDelta;
            parallaxAccumX += moveDelta * 0.6;
            startParallaxTransition(parallaxAccumX, 600);
        } else {
            triggerRender();
        }

        const targetViewEl = views[activeViewKey];
        const prevViewEl = views[prevViewKey];
        const targetAngle = cubeAngleAccum;
        const cubeBox = document.getElementById('cube-3d-box');

        if (cubeRotationTimer) {
            clearTimeout(cubeRotationTimer);
            cubeRotationTimer = null;
        }

        if (prevViewEl && targetViewEl && prevViewKey !== activeViewKey) {
            isCubeRotating = true;
            if (contentScroller) {
                contentScroller.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // Hanya face asal + tujuan yang ikut dirender selama rotasi
            Object.values(views).forEach(el => {
                if (el) el.classList.remove('face-entering');
            });
            targetViewEl.classList.add('face-entering');
            if (cubeBox) cubeBox.classList.add('cube-rotating');
            document.documentElement.style.setProperty('--cube-rot-y', `${targetAngle}deg`);

            cubeRotationTimer = setTimeout(() => {
                Object.values(views).forEach(el => {
                    if (el) {
                        el.classList.remove('active-face');
                        el.classList.remove('face-entering');
                    }
                });
                targetViewEl.classList.add('active-face');
                if (cubeBox) cubeBox.classList.remove('cube-rotating');
                isCubeRotating = false;
                cubeRotationTimer = null;

                if (contentScroller) {
                    contentScroller.scrollTop = 0;
                }

                if (activeViewKey === 'home') {
                    requestAnimationFrame(updateTimelineConnector);
                }

                onTabSettled(activeViewKey);
            }, 700);
        } else if (targetViewEl) {
            document.documentElement.style.setProperty('--cube-rot-y', `${targetAngle}deg`);
            Object.values(views).forEach(el => {
                if (el) {
                    el.classList.remove('active-face');
                    el.classList.remove('face-entering');
                }
            });
            targetViewEl.classList.add('active-face');
            if (cubeBox) cubeBox.classList.remove('cube-rotating');
            isCubeRotating = false;

            if (contentScroller) {
                contentScroller.scrollTo({ top: 0, behavior: 'smooth' });
            }

            if (activeViewKey === 'home') {
                requestAnimationFrame(updateTimelineConnector);
            }

            onTabSettled(activeViewKey);
        }
    }


    function updateTimelineConnector() {
        const wrapper = document.getElementById('timeline-wrapper');
        const path = document.getElementById('timeline-dynamic-path');
        if (!wrapper || !path) return;

        if (wrapper.offsetWidth === 0 || wrapper.offsetHeight === 0) return;

        const markers = Array.from(wrapper.querySelectorAll('.zigzag-marker'));
        if (markers.length < 2) return;

        function getElementOffsetRelativeTo(el, parent) {
            let top = 0;
            let left = 0;
            let curr = el;
            while (curr && curr !== parent && curr !== document.body) {
                top += curr.offsetTop;
                left += curr.offsetLeft;
                curr = curr.offsetParent;
            }
            return { left, top };
        }

        const points = markers.map(m => {
            const pos = getElementOffsetRelativeTo(m, wrapper);
            const w = m.offsetWidth || 42;
            const h = m.offsetHeight || 42;
            return {
                x: pos.left + (w / 2),
                y: pos.top + (h / 2)
            };
        });

        if (points.length < 2) return;

        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            if (Math.abs(p0.x - p1.x) > 6) {
                const midY = ((p0.y + p1.y) / 2).toFixed(1);
                d += ` C ${p0.x.toFixed(1)} ${midY}, ${p1.x.toFixed(1)} ${midY}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
            } else {
                d += ` L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
            }
        }

        path.setAttribute('d', d);
    }

    const timelineWrapper = document.getElementById('timeline-wrapper');
    if (timelineWrapper && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(updateTimelineConnector);
        });
        ro.observe(timelineWrapper);
    }

    let layoutResizeTimer = null;
    window.addEventListener('resize', () => {
        if (layoutResizeTimer) clearTimeout(layoutResizeTimer);
        layoutResizeTimer = setTimeout(() => {
            updateCubeDimensions();
            updateTimelineConnector();
            updateNavIndicator();
            scrollActiveNavIntoView();
            updateOpenModalsLayout();
            requestAnimationFrame(updateNavIndicator);
        }, 150);
    });
    window.addEventListener('hashchange', navigateToRoute);
    window.addEventListener('popstate', navigateToRoute);
    if (typeof window.translateUI === 'function') {
        window.translateUI();
    }

    function initVercelReleaseBadge() {
        const badgeEl = document.getElementById('vercel-release-badge');
        const verEl = document.getElementById('vercel-release-version');
        if (!badgeEl || !verEl) return;
        fetch('/api/version', { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data || !data.version || String(data.version).startsWith('dev-')) {
                    badgeEl.classList.add('hidden');
                    return;
                }
                verEl.textContent = data.version;
                if (data.buildDateId) badgeEl.title = `Build ${data.buildDateId}`;
            })
            .catch(() => badgeEl.classList.add('hidden'));
    }
    initVercelReleaseBadge();

    updateCubeDimensions();
    navigateToRoute();
    setTimeout(() => {
        if (typeof window.translateUI === 'function') {
            window.translateUI();
        }
        updateCubeDimensions();
        updateTimelineConnector();
        updateNavIndicator();
        scrollActiveNavIntoView();
    }, 150);
});
