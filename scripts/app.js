document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';
    let globalMuted = false;

    const ensureProtocol = (url) => {
        if (!url || url === '#') return '#';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) return url;
        return `https://${url}`;
    };

    const thumbUrl = (url, width = 128) => {
        return url;
    };

    const isTikTokLikeUrl = (s) => {
        if (!s || typeof s !== 'string') return false;
        const u = s.toLowerCase();
        return u.includes('tiktok.com') || u.includes('tikwm.com');
    };

    const getTikTokId = (url) => {
        if (!url) return null;
        const match = url.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
    };

    const isDirectVideoUrl = (s) => {
        if (!s || typeof s !== 'string') return false;
        return /\.(mp4|webm)(\?|#|$)/i.test(s) || /tiktokcdn\.com\/.+\/video\//i.test(s);
    };

    let lastClickedId = null;
    let lastClickedRect = null;

    const showExplore = () => {
        const presetExploreView = document.getElementById('preset-explore-view');
        const presetFeedView = document.getElementById('preset-feed-view');
        
        history.pushState(null, null, '/#preset');

        if (presetFeedView && !presetFeedView.classList.contains('hidden')) {
            // Slide down + fade out animation — works regardless of grid scroll position
            presetFeedView.style.transition = 'transform 0.28s cubic-bezier(0.4, 0, 1, 1), opacity 0.22s ease';
            presetFeedView.style.transform = 'translateY(6%)';
            presetFeedView.style.opacity = '0';

            if (presetExploreView) {
                presetExploreView.classList.remove('hidden');
                presetExploreView.style.opacity = '0';
                presetExploreView.style.transition = 'opacity 0.2s ease';
                requestAnimationFrame(() => {
                    presetExploreView.style.opacity = '1';
                });
            }

            setTimeout(() => {
                presetFeedView.classList.add('hidden');
                presetFeedView.style.transform = '';
                presetFeedView.style.transition = '';
                presetFeedView.style.opacity = '';
            }, 300);
        } else {
            if (presetFeedView) {
                presetFeedView.classList.add('hidden');
                presetFeedView.style.opacity = '0';
            }
            if (presetExploreView) {
                presetExploreView.classList.remove('hidden');
                presetExploreView.style.opacity = '1';
            }
        }

        if (presetFeedView) {
            presetFeedView.querySelectorAll('.tiktok-media-host').forEach(host => {
                const v = host.querySelector('video');
                if (v) v.pause();
                host.innerHTML = '<div class="tiktok-media-skeleton"><span class="material-symbols-rounded tiktok-skel-icon">smart_display</span></div>';
                delete host.dataset.tiktokState;
            });
        }
    };

    const showFeed = async (targetId, clickedEl = null) => {
        const exploreView = document.getElementById('preset-explore-view');
        const feedView = document.getElementById('preset-feed-view');
        const feedContainer = document.getElementById('preset-feed');

        if (!feedView || !feedContainer) return;

        history.pushState(null, null, `/${targetId}`);

        lastClickedId = targetId;
        lastClickedRect = clickedEl ? clickedEl.getBoundingClientRect() : null;

        // Reset transition styles
        feedView.style.transition = 'none';
        feedView.style.transform = 'translateY(6%)';
        feedView.style.opacity = '0';
        feedView.style.display = 'block';
        feedView.classList.remove('hidden');

        if (exploreView) {
            exploreView.style.transition = 'opacity 0.15s ease';
            exploreView.style.opacity = '0';
        }

        // Trigger reflow to apply starting styles before transition starts
        void feedView.offsetWidth;

        requestAnimationFrame(() => {
            feedView.style.transition = 'transform 0.28s cubic-bezier(0, 0, 0.2, 1), opacity 0.22s ease';
            feedView.style.transform = 'translateY(0)';
            feedView.style.opacity = '1';
        });

        setTimeout(() => {
            if (exploreView) exploreView.classList.add('hidden');
            feedView.style.transform = '';
            feedView.style.transition = '';
            feedView.style.opacity = '';
        }, 300);

        if (feedContainer) {
            hydrateTikTokHosts(feedContainer, 'video');
            setupTikTokInteractions(feedContainer);
            updateScrollingTitles(feedContainer);
        }

        const targetPost = document.querySelector(`.preset-post[data-id="${targetId}"]`);
        if (targetPost) {
            targetPost.scrollIntoView({ behavior: 'auto', block: 'start' });
            const video = targetPost.querySelector('video');
            if (video) {
                video.muted = globalMuted;
                video.play().catch((err) => {
                    console.warn('Autoplay blocked in showFeed, retrying muted:', err);
                    video.muted = true;
                    video.play().catch(e => console.error('Final play attempt failed:', e));
                });
            }
        }
    };
    
    const setupTikTokInteractions = (root) => {
        const containers = root.querySelectorAll('.post-media-container');
        containers.forEach(container => {
            if (container.dataset.interactionsSet) return;
            container.dataset.interactionsSet = 'true';
            
            const muteBtn = container.querySelector('.video-mute-btn');
            if (muteBtn) {
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const video = container.querySelector('video') || container.querySelector('.tiktok-media-host video');
                    if (video) {
                        video.muted = !video.muted;
                        globalMuted = video.muted;
                        const icon = muteBtn.querySelector('.material-symbols-rounded');
                        if (icon) icon.textContent = video.muted ? 'volume_off' : 'volume_up';
                    }
                });
            }

            let lastTap = 0;
            let tapTimeout;
            
            container.addEventListener('click', (e) => {
                const now = Date.now();
                const DOUBLE_TAP_DELAY = 300;
                
                if (now - lastTap < DOUBLE_TAP_DELAY) {
                    // Double Tap
                    clearTimeout(tapTimeout);
                    handleDoubleTap(container, e);
                    lastTap = 0;
                } else {
                    // Single Tap potential
                    lastTap = now;
                    tapTimeout = setTimeout(() => {
                        handleSingleTap(container);
                    }, DOUBLE_TAP_DELAY);
                }
            });
        });
    };

    const handleSingleTap = (container) => {
        const video = container.querySelector('video') || container.querySelector('.tiktok-media-host video');
        const pauseIcon = container.querySelector('.overlay-pause');
        
        if (!video) return;
        
        if (video.paused) {
            video.play();
            if (pauseIcon) {
                pauseIcon.textContent = 'play_arrow';
                pauseIcon.classList.remove('animate-pause');
                void pauseIcon.offsetWidth; // trigger reflow
                pauseIcon.classList.add('animate-pause');
            }
        } else {
            video.pause();
            if (pauseIcon) {
                pauseIcon.textContent = 'pause';
                pauseIcon.classList.remove('animate-pause');
                void pauseIcon.offsetWidth; // trigger reflow
                pauseIcon.classList.add('animate-pause');
            }
        }
    };

    const handleDoubleTap = (container, e) => {
        const slide = container.closest('.tiktok-slide');
        const id = slide?.dataset.id;
        const likeBtn = slide?.querySelector('[data-action="like"]');
        
        // Show heart animation
        const heart = document.createElement('span');
        heart.className = 'material-symbols-rounded overlay-heart animate-heart';
        heart.textContent = 'favorite';
        
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        heart.style.left = `${x - 40}px`;
        heart.style.top = `${y - 40}px`;

        if (likeBtn) {
            const btnRect = likeBtn.getBoundingClientRect();
            const targetX = btnRect.left - rect.left + btnRect.width / 2;
            const targetY = btnRect.top - rect.top + btnRect.height / 2;
            
            const flyX = targetX - x;
            const flyY = targetY - y;
            
            heart.style.setProperty('--fly-x', `${flyX}px`);
            heart.style.setProperty('--fly-y', `${flyY}px`);
        }
        
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 800);
        
        if (id && likeBtn) {
            handleLike(id, likeBtn, true); // true = onlyLike
        }
    };

    const updateScrollingTitles = (root) => {
        if (!root) return;
        // Wait a bit for layout to settle
        setTimeout(() => {
            root.querySelectorAll('.tiktok-title').forEach(title => {
                const wrapper = title.parentElement;
                if (!wrapper) return;
                
                title.classList.remove('scroll');
                void title.offsetWidth; // reflow
                
                if (title.scrollWidth > wrapper.clientWidth + 1) {
                    const dist = (title.scrollWidth - wrapper.clientWidth) + 30;
                    title.style.setProperty('--scroll-dist', `${dist}px`);
                    title.classList.add('scroll');
                }
            });
            
            root.querySelectorAll('.plugin-tag-v2').forEach(tag => {
                const wrapper = tag.parentElement;
                if (!wrapper) return;
                
                tag.classList.remove('scroll');
                void tag.offsetWidth;
                
                if (tag.scrollWidth > wrapper.clientWidth + 1) {
                    const dist = (tag.scrollWidth - wrapper.clientWidth) + 30;
                    tag.style.setProperty('--scroll-dist', `${dist}px`);
                    tag.classList.add('scroll');
                }
            });
        }, 500);
    };

    const escapeHtmlAttr = (s) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');

    const normalizeClientIp = (raw) => {
        if (raw == null) return '';
        let ip = String(raw).trim();
        if (!ip) return '';
        const lower = ip.toLowerCase();
        if (lower.startsWith('::ffff:')) ip = ip.slice(7);
        if (lower === '::1' || ip === '::1') ip = '127.0.0.1';
        return ip;
    };

    const presetMediaInnerHtml = (media, name) => {
        const label = escapeHtmlAttr(name || 'Preset');
        const m = media == null ? '' : String(media).trim();
        if (!m) {
            return '<div class="media-placeholder" aria-hidden="true"></div>';
        }
        if (isDirectVideoUrl(m)) {
            // Remove controls, keep autoplay and loop
            return `<video src="${escapeHtmlAttr(m)}" muted loop playsinline autoplay crossorigin="anonymous" referrerpolicy="no-referrer"></video>`;
        }
        if (isTikTokLikeUrl(m)) {
            return `<div class="tiktok-media-host" data-tiktok-url="${escapeHtmlAttr(m)}" role="group" aria-label="${label}"><div class="tiktok-media-skeleton"><span class="material-symbols-rounded tiktok-skel-icon">smart_display</span></div></div>`;
        }
        return `<img src="${escapeHtmlAttr(m)}" alt="${label}" referrerpolicy="no-referrer">`;
    };

    const hydrateTikTokHosts = async (root, mode = 'video') => {
        if (!root || !('IntersectionObserver' in window)) return;
        const hosts = root.querySelectorAll('.tiktok-media-host:not([data-tiktok-state])');
        if (!hosts.length) return;

        if (root._hydrateIo) {
            root._hydrateIo.disconnect();
            root._hydrateIo = null;
        }

        const io = new IntersectionObserver((entries) => {
            entries.forEach(async (en) => {
                const el = en.target;
                if (!en.isIntersecting || el.dataset.tiktokState) return;
                
                const src = el.dataset.tiktokUrl;
                if (!src) return;
                
                 el.dataset.tiktokState = 'loading';
                
                const resolveWithRetry = async (retryCount = 0, bypassCache = false) => {
                    try {
                        const url = `${API_URL}/tiktok-resolve?url=${encodeURIComponent(src)}${bypassCache ? '&nocache=1' : ''}`;
                        const r = await fetch(url);
                        if (r.status === 404 && retryCount < 3) {
                            await new Promise(res => setTimeout(res, 1000));
                            return resolveWithRetry(retryCount + 1);
                        }
                        
                        const j = await r.json().catch(() => ({}));
                        
                        if (!r.ok || (!j.play && !j.is_fallback)) {
                            el.dataset.tiktokState = 'error';
                            el.innerHTML = '<div class="tiktok-media-error"><span class="material-symbols-rounded">broken_image</span><span>Video unavailable</span></div>';
                        } else {
                            el.innerHTML = '';
                            if ((mode === 'image' || j.is_fallback) && j.cover) {
                                const img = document.createElement('img');
                                img.src = j.cover;
                                img.alt = j.title || 'Preset';
                                img.setAttribute('referrerpolicy', 'no-referrer');
                                el.appendChild(img);
                                if (mode === 'video') {
                                    const videoId = j.id || getTikTokId(src);
                                    if (videoId) {
                                        el.innerHTML = `<iframe src="https://www.tiktok.com/embed/${videoId}" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
                                    } else {
                                        const link = document.createElement('a');
                                        link.href = src;
                                        link.target = '_blank';
                                        link.className = 'tiktok-fallback-link';
                                        link.innerHTML = '<span class="material-symbols-rounded">open_in_new</span><span>View on TikTok</span>';
                                        el.appendChild(link);
                                    }
                                }
                            } else {
                                const v = document.createElement('video');
                                v.src = j.play;
                                v.muted = globalMuted;
                                v.loop = true;
                                v.playsInline = true;
                                v.autoplay = true;
                                v.setAttribute('playsinline', '');
                                v.setAttribute('crossorigin', 'anonymous');
                                v.setAttribute('referrerpolicy', 'no-referrer');
                                if (!globalMuted) v.volume = 1;
                                el.appendChild(v);
 
                                const slide = el.closest('.tiktok-slide');
                                const muteBtn = slide?.querySelector('.video-mute-btn');
                                if (muteBtn) {
                                    const icon = muteBtn.querySelector('.material-symbols-rounded');
                                    if (icon) icon.textContent = v.muted ? 'volume_off' : 'volume_up';
                                }

                                v.onerror = () => {
                                    if (retryCount < 1) {
                                        el.innerHTML = '';
                                        el.dataset.tiktokState = 'loading';
                                        resolveWithRetry(retryCount + 1, true);
                                    } else {
                                        const videoId = j.id || getTikTokId(src);
                                        if (videoId) {
                                            el.innerHTML = `<iframe src="https://www.tiktok.com/embed/${videoId}" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
                                            el.dataset.tiktokState = 'ready';
                                        } else if (j.cover) {
                                            el.innerHTML = '';
                                            const img = document.createElement('img');
                                            img.src = j.cover;
                                            img.alt = j.title || 'Preset';
                                            img.setAttribute('referrerpolicy', 'no-referrer');
                                            el.appendChild(img);
                                            el.dataset.tiktokState = 'ready';
                                        } else {
                                            el.innerHTML = '<div class="tiktok-media-error"><span class="material-symbols-rounded">broken_image</span><span>Video unavailable</span></div>';
                                            el.dataset.tiktokState = 'error';
                                        }
                                    }
                                };
 
                                v.play().catch((err) => {
                                    v.muted = true;
                                    if (muteBtn) {
                                        const icon = muteBtn.querySelector('.material-symbols-rounded');
                                        if (icon) icon.textContent = 'volume_off';
                                    }
                                    v.play().catch(e => {});
                                });
                            }
                            el.dataset.tiktokState = 'ready';
                        }
                    } catch (err) {
                        if (retryCount < 3) {
                            await new Promise(res => setTimeout(res, 1000));
                            return resolveWithRetry(retryCount + 1);
                        }
                        el.dataset.tiktokState = 'error';
                    }
                };

                await resolveWithRetry();
                io.unobserve(el);
            });
        }, { threshold: 0.1 });

        hosts.forEach(h => io.observe(h));
        root._hydrateIo = io;
    };

    const disconnectScrollVideoIo = (attachEl) => {
        if (attachEl && attachEl._scrollVideoIo) {
            attachEl._scrollVideoIo.disconnect();
            attachEl._scrollVideoIo = null;
        }
    };

    const setupScrollLinkedVideoPlayback = (scrollRoot, slideSelector, attachEl) => {
        if (!scrollRoot) return;
        const tag = attachEl || scrollRoot;
        disconnectScrollVideoIo(tag);

        const getAllVideos = () => [...scrollRoot.querySelectorAll(`${slideSelector} video`)];

        const playVisible = () => {
            const slides = [...scrollRoot.querySelectorAll(slideSelector)];
            const rootRect = scrollRoot.getBoundingClientRect();
            const rootCenter = rootRect.top + rootRect.height / 2;

            let bestSlide = null, bestDist = Infinity;
            slides.forEach(slide => {
                const r = slide.getBoundingClientRect();
                const dist = Math.abs((r.top + r.height / 2) - rootCenter);
                if (dist < bestDist) { bestDist = dist; bestSlide = slide; }
            });

            getAllVideos().forEach(v => v.pause());

            if (bestSlide) {
                const host = bestSlide.querySelector('.tiktok-media-host');
                const v = (host && host.querySelector('video')) || bestSlide.querySelector('video');
                if (v) {
                    v.muted = globalMuted;
                    if (!globalMuted) v.volume = 1;
                    v.play().catch(() => { 
                        v.muted = true;
                        const muteBtn = bestSlide.querySelector('.video-mute-btn');
                        if (muteBtn) {
                            const icon = muteBtn.querySelector('.material-symbols-rounded');
                            if (icon) icon.textContent = 'volume_off';
                        }
                        v.play().catch(() => {});
                    });
                    
                    const muteBtn = bestSlide.querySelector('.video-mute-btn');
                    if (muteBtn) {
                        const icon = muteBtn.querySelector('.material-symbols-rounded');
                        if (icon) icon.textContent = v.muted ? 'volume_off' : 'volume_up';
                    }
                }
                
                const slideId = bestSlide.dataset.id;
                if (slideId) {
                    // Update lastClickedId so close animation targets the current card
                    lastClickedId = slideId;
                    // Find matching grid item and update its rect for the close animation
                    const gridItem = document.querySelector(`.explore-item[data-id="${slideId}"]`);
                    if (gridItem) {
                        lastClickedRect = gridItem.getBoundingClientRect();
                    }
                    history.pushState(null, null, `/${slideId}`);
                }
            }
        };

        let scrollTimer = null;
        const onScroll = () => {
            clearTimeout(scrollTimer);
            getAllVideos().forEach(v => v.pause());
            scrollTimer = setTimeout(playVisible, 150);
        };

        scrollRoot.addEventListener('scroll', onScroll, { passive: true });
        tag._scrollVideoIo = {
            disconnect: () => {
                scrollRoot.removeEventListener('scroll', onScroll);
                clearTimeout(scrollTimer);
            }
        };
    };

    const renderContacts = async () => {
        const grid = document.getElementById('contact-grid');
        if (!grid) return;
        try {
            grid.innerHTML = Array(6).fill('<div class="skeleton-social-card"><div class="skeleton-social-icon"></div><div class="skeleton-social-name"></div></div>').join('');
            const res = await fetch(`${API_URL}/contacts`);
            const contacts = await res.json();
            if (contacts.length === 0) {
                grid.innerHTML = '<div class="empty-state">No contact links found.</div>';
                return;
            }
            grid.innerHTML = contacts.map(c => {
                const iconHtml = (c.icon && (c.icon.startsWith('http') || c.icon.includes('/')))
                    ? `<img src="${thumbUrl(c.icon, 96)}" class="social-icon-img" alt="${c.name}" loading="lazy">`
                    : (c.icon && c.icon.startsWith('bi-'))
                        ? `<span class="brand-icon ${c.icon} social-icon"></span>`
                        : (c.icon && c.icon.startsWith('ms-'))
                            ? `<span class="material-symbols-rounded social-icon">${c.icon.substring(3)}</span>`
                            : `<span class="material-symbols-rounded social-icon">${c.icon || 'public'}</span>`;
                
                return `
                <a href="${ensureProtocol(c.url)}" class="card social-card" target="_blank">
                    <div class="flex align-center gap-16">
                        ${iconHtml}
                        <h3 class="social-name">${c.name}</h3>
                    </div>
                </a>
                `;
            }).join('');
        } catch (err) {
            console.error('Render contacts failed:', err);
            grid.innerHTML = '<div class="error-state">Failed to load contacts.</div>';
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');

            // Stop any playing video if switching away from the feed
            const feedView = document.getElementById('preset-feed-view');
            const feedContainer = document.getElementById('preset-feed');
            if (feedView && !feedView.classList.contains('hidden')) {
                feedView.querySelectorAll('video').forEach(v => v.pause());
                // If on a direct-link preset URL and switching tab, hide the feed
                if (targetTab !== 'preset') {
                    feedView.classList.add('hidden');
                    feedView.style.opacity = '0';
                    feedView.style.transform = '';
                }
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetTab) {
                    section.classList.add('active');
                    if (targetTab === 'preset') {
                        showExplore();
                    }
                }
            });
            if (targetTab === 'social') {
                renderSocials();
            } else if (targetTab === 'preset') {
                renderPresets();
            } else if (targetTab === 'resource') {
                renderResources();
            } else if (targetTab === 'contact') {
                renderContacts();
            }
            if (history.pushState) {
                history.pushState(null, null, `#${targetTab}`);
            }
        });
    });
    const path = window.location.pathname.substring(1);
    
    let targetTab = '';
    let targetSubId = null;
    
    if (/^[a-f0-9]{24}$/i.test(path)) {
        targetTab = 'preset';
        targetSubId = path;
    }
    
    const downloadModal = document.getElementById('download-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const modalBadgeContainer = document.getElementById('modal-badge-container');
    const modalFileSize = document.getElementById('modal-file-size');
    const modalFileType = document.getElementById('modal-file-type');
    const modalMinVersion = document.getElementById('modal-min-version');
    const modalTitle = document.getElementById('modal-title');
    const presetExploreView = document.getElementById('preset-explore-view');
    const presetFeedView = document.getElementById('preset-feed-view');
    const backToExploreBtn = document.getElementById('back-to-explore');
    if (backToExploreBtn) {
        backToExploreBtn.addEventListener('click', showExplore);
    }
    const presetExploreGrid = document.getElementById('preset-explore-grid');
    const presetFeed = document.getElementById('preset-feed');

    if (presetFeed) {
        presetFeed.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const slide = btn.closest('.tiktok-slide');
            const id = slide?.dataset.id;

            if (action === 'download' && id) {
                try {
                    const res = await fetch(`${API_URL}/presets/${id}`);
                    const data = await res.json();
                    const urls = Array.isArray(data.urls) ? data.urls.filter(u => u.url) : [];
                    const softwareArr = Array.isArray(data.software) ? data.software : (data.software ? [data.software] : []);
                    
                    if (softwareArr.length === 1 && softwareArr.includes('AM')) {
                        openAmDownloadPicker(data);
                    } else if (urls.length > 1) {
                        openSwDownloadPicker(urls, data.name, data);
                    } else if (urls.length === 1) {
                        if (urls[0].sw === 'AM') {
                            openAmDownloadPicker(data);
                        } else {
                            window.open(ensureProtocol(urls[0].url), '_blank');
                        }
                    } else if (data.url) {
                        window.open(ensureProtocol(data.url), '_blank');
                    }
                } catch (err) {
                    console.error('Download error:', err);
                }
            } else if (action === 'like' && id) {
                handleLike(id, btn);
            } else if (action === 'source' && id) {
                const res = await fetch(`${API_URL}/presets/${id}`);
                const data = await res.json();
                if (data.media) window.open(data.media, '_blank');
            }
        });
    }

    const SOFTWARE_FULL_NAMES = {
        'AE': 'After Effects',
        'AM': 'Alight Motion',
        'Blurr': 'Blurr',
        'CC': 'Capcut',
        'FM': 'Funimate',
        'Node': 'Node Video'
    };

    const openAmDownloadPicker = (presetData) => {
        const picker = document.getElementById('sw-download-picker');
        const optionsContainer = document.getElementById('sw-download-options');
        if (!picker || !optionsContainer) return;

        let html = '';
        
        if (presetData.amPremiumUrl) {
            html += `
                <button class="sw-download-option-btn am-option-btn" data-url="${escapeHtmlAttr(presetData.amPremiumUrl)}">
                    <img src="assets/icon/Am.png" alt="Alight Motion Premium">
                    <span>Alight Motion Premium</span>
                </button>
            `;
        }
        
        if (presetData.am5MbUrl) {
            html += `
                <button class="sw-download-option-btn am-option-btn" data-url="${escapeHtmlAttr(presetData.am5MbUrl)}">
                    <img src="assets/icon/Am.png" alt="Alight Motion 5MB">
                    <span>Alight Motion 5MB</span>
                </button>
            `;
        }

        if (presetData.amXmlUrl) {
            html += `
                <button class="sw-download-option-btn am-option-btn am-xml-btn" data-url="${escapeHtmlAttr(presetData.amXmlUrl)}">
                    <span class="material-symbols-rounded" style="font-size: 22px;">code</span>
                    <span>XML</span>
                </button>
            `;
        }

        if (Array.isArray(presetData.amXmlExtras) && presetData.amXmlExtras.length > 0) {
            html += `
                <div class="am-extra-section" style="margin-top: 16px; border-top: 1px dashed var(--md-sys-color-outline-variant); padding-top: 12px; width: 100%;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--md-sys-color-on-surface); text-align: left; padding-left: 8px;">
                        Additional Files:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
            `;
            presetData.amXmlExtras.forEach(extra => {
                html += `
                    <button class="sw-download-option-btn am-extra-btn" data-url="${escapeHtmlAttr(extra.url)}" style="border: 1px dashed var(--md-sys-color-outline); padding: 8px 12px; font-size: 12px; border-radius: 8px; box-shadow: none;">
                        <span style="flex-grow: 1; text-align: left;">${escapeHtmlAttr(extra.label)}</span>
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-on-surface-variant);">download</span>
                    </button>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        optionsContainer.innerHTML = html;

        optionsContainer.querySelectorAll('.sw-download-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) window.open(ensureProtocol(url), '_blank');
                if (!btn.classList.contains('am-extra-btn')) {
                    picker.classList.remove('show');
                }
            });
        });

        picker.classList.add('show');
    };

    const openSwDownloadPicker = (urls, presetName, presetData) => {
        const picker = document.getElementById('sw-download-picker');
        const optionsContainer = document.getElementById('sw-download-options');
        if (!picker || !optionsContainer) return;
        const badgeIcons = {
            'AE': 'assets/icon/Ae.png',
            'AM': 'assets/icon/Am.png',
            'Blurr': 'assets/icon/Blurr.png',
            'CC': 'assets/icon/CC.png',
            'FM': 'assets/icon/Fm.png',
            'Node': 'assets/icon/Node.png'
        };
        optionsContainer.innerHTML = urls.map(entry => {
            const icon = badgeIcons[entry.sw];
            const label = SOFTWARE_FULL_NAMES[entry.sw] || entry.sw;
            return `
                <button class="sw-download-option-btn" data-sw="${escapeHtmlAttr(entry.sw)}" data-url="${escapeHtmlAttr(entry.url || '')}">
                    ${icon ? `<img src="${icon}" alt="${label}">` : `<span class="material-symbols-rounded">apps</span>`}
                    <span>${label}</span>
                </button>`;
        }).join('');
        optionsContainer.querySelectorAll('.sw-download-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sw = btn.dataset.sw;
                if (sw === 'AM') {
                    openAmDownloadPicker(presetData);
                } else {
                    const url = btn.dataset.url;
                    if (url) window.open(ensureProtocol(url), '_blank');
                    picker.classList.remove('show');
                }
            });
        });
        picker.classList.add('show');
    };

    const cancelSwDownloadBtn = document.getElementById('cancel-sw-download');
    if (cancelSwDownloadBtn) {
        cancelSwDownloadBtn.addEventListener('click', () => {
            document.getElementById('sw-download-picker')?.classList.remove('show');
        });
    }

    document.getElementById('sw-download-picker')?.addEventListener('click', (e) => {
        if (e.target.id === 'sw-download-picker') {
            e.target.classList.remove('show');
        }
    });

    const handleLike = async (id, btn, onlyLike = false) => {
        const isLiked = btn.classList.contains('liked');
        if (onlyLike && isLiked) return; // For double tap, only allow liking

        try {
            const res = await fetch(`${API_URL}/presets/${id}/like`, {
                method: 'POST'
            });
            
            const data = await res.json();
            
            if (res.ok) {
                if (data.liked) {
                    btn.classList.add('liked');
                    const icon = btn.querySelector('.material-symbols-rounded');
                    if (icon) icon.textContent = 'favorite';
                    btn.classList.add('like-pop');
                    setTimeout(() => btn.classList.remove('like-pop'), 400);
                } else {
                    btn.classList.remove('liked');
                    const icon = btn.querySelector('.material-symbols-rounded');
                    if (icon) icon.textContent = 'favorite_border';
                }
                
                const label = btn.querySelector('.action-label');
                if (label) label.textContent = data.likes;
            } else {
                alert('Failed to like: ' + data.error);
            }
        } catch (err) {
            console.error('Like error:', err);
        }
    };

    const openDownloadModal = (res) => {
        if (!downloadModal) return;
        modalTitle.textContent = res.name;
        modalFileSize.textContent = res.size || 'N/A';
        modalFileType.textContent = res.type || 'Preset';
        modalMinVersion.textContent = res.version || 'v1.0';
        
        const swName = document.getElementById('modal-software-name');
        if (swName) swName.textContent = '@cutefishaep';

        const pluginsRow = document.getElementById('modal-plugins-row');
        const pluginsText = document.getElementById('modal-plugins-text');
        if (pluginsRow && pluginsText) {
            if (res.plugin) {
                pluginsText.textContent = res.plugin;
                pluginsRow.classList.remove('hidden');
            } else {
                pluginsRow.classList.add('hidden');
            }
        }

        const softwareStyles = {
            'AE': { label: 'Ae', color: '#9999ff', dark: '#00005b' },
            'AM': { label: 'Am', color: '#00ffcc', dark: '#002211' },
            'Blurr': { label: 'Bl', color: '#00ff88', dark: '#002211' },
            'CC': { label: 'Cc', color: '#ffffff', dark: '#000000' },
            'FM': { label: 'Fm', color: '#ff00ff', dark: '#330033' },
            'Node': { label: 'Nv', color: '#00ffff', dark: '#001122' }
        };

        const swKey = res.software || 'AE';
        const style = softwareStyles[swKey] || { label: '??', color: '#888', dark: '#222' };

        const modalIconContainer = document.querySelector('.app-icon-large');
        if (modalIconContainer) {
            modalIconContainer.style.setProperty('--brand-color', style.color);
            modalIconContainer.style.setProperty('--brand-color-dark', style.dark);
        }

        modalBadgeContainer.innerHTML = `
            <div class="sw-icon-content">
                <span class="sw-icon-text" style="color: ${style.color};">${style.label}</span>
            </div>
        `;
        
        const downloadBtn = downloadModal.querySelector('.download-confirm-btn');
        if (downloadBtn) {
            downloadBtn.onclick = () => window.open(res.url || '#', '_blank');
        }
        downloadModal.classList.add('show');
    };

    if (presetExploreGrid) {
        presetExploreGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.explore-item');
            if (item) {
                const id = item.dataset.id;
                showFeed(id, item);
            }
        });
    }

    const badgeIcons = {
        'AE': 'assets/icon/Ae.png',
        'AM': 'assets/icon/Am.png',
        'Blurr': 'assets/icon/Blurr.png',
        'CC': 'assets/icon/CC.png',
        'FM': 'assets/icon/Fm.png',
        'Node': 'assets/icon/Node.png'
    };

    const renderSocials = async () => {
        const container = document.getElementById('social-grid');
        if (!container || container.getAttribute('data-loaded') === 'true') return;

        // Show skeleton loading state
        container.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton-social-card">
                <div class="skeleton-social-icon"></div>
                <div class="skeleton-social-name"></div>
            </div>
        `).join('');

        const res = await fetch(`${API_URL}/socials`);
        const socials = await res.json();
        if (socials.length > 0) {
            container.innerHTML = socials.map(s => {
                const iconHtml = (s.icon && (s.icon.startsWith('http') || s.icon.includes('/')))
                    ? `<img src="${thumbUrl(s.icon, 96)}" class="social-icon-img" alt="${s.name}" loading="lazy">`
                    : (s.icon && s.icon.startsWith('bi-'))
                        ? `<span class="brand-icon ${s.icon} social-icon"></span>`
                        : (s.icon && s.icon.startsWith('ms-'))
                            ? `<span class="material-symbols-rounded social-icon">${s.icon.substring(3)}</span>`
                            : `<span class="material-symbols-rounded social-icon">${s.icon || 'public'}</span>`;
                
                return `
                <a href="${ensureProtocol(s.url)}" class="card social-card" target="_blank">
                    <div class="flex align-center gap-16">
                        ${iconHtml}
                        <h3 class="social-name">${s.name}</h3>
                    </div>
                </a>
                `;
            }).join('');
            container.setAttribute('data-loaded', 'true');
        }
    };

    const renderPresetCategories = (presets) => {
        const categoryContainer = document.getElementById('preset-categories');
        if (!categoryContainer) return;
        
        const activeCategory = categoryContainer.querySelector('.chip.active')?.dataset.software || 'All';
        const allSw = new Set();
        presets.forEach(p => {
            const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
            swArr.forEach(sw => allSw.add(sw));
        });
        const categories = ['All', ...allSw];
        
        categoryContainer.innerHTML = categories.map(cat => {
            if (cat === 'All') return `<div class="chip ${activeCategory === 'All' ? 'active' : ''}" data-software="All">All</div>`;
            
            const localBadgeIcons = {
                'AE': 'assets/icon/Ae.png',
                'AM': 'assets/icon/Am.png',
                'Blurr': 'assets/icon/Blurr.png',
                'CC': 'assets/icon/CC.png',
                'FM': 'assets/icon/Fm.png',
                'Node': 'assets/icon/Node.png'
            };
            const icon = localBadgeIcons[cat];
            const iconHtml = icon ? `<img src="${icon}" alt="${cat}" class="chip-icon">` : '';
            return `<div class="chip ${activeCategory === cat ? 'active' : ''}" data-software="${cat}">${iconHtml}${cat}</div>`;
        }).join('');
    };

    const renderPresets = async (filterSoftware = 'All') => {
        const exploreGrid = document.getElementById('preset-explore-grid');
        if (!exploreGrid) return;
        
        exploreGrid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
        
        const res = await fetch(`${API_URL}/presets`);
        const allPresets = await res.json();
        
        renderPresetCategories(allPresets);
        
        const presets = filterSoftware === 'All'
            ? allPresets
            : allPresets.filter(p => {
                const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                return swArr.includes(filterSoftware);
            });
        const feedContainer = document.getElementById('preset-feed');
        if (exploreGrid) disconnectScrollVideoIo(exploreGrid);
        if (feedContainer) disconnectScrollVideoIo(feedContainer);
        
        if (presets.length === 0) {
            exploreGrid.innerHTML = `<div class="empty-state">No presets found for ${filterSoftware}</div>`;
        } else {
            exploreGrid.innerHTML = presets.map(p => {
                const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                const badgesHtml = swArr.map(sw => {
                    const icon = badgeIcons[sw];
                    return icon ? `<div class="explore-badge-multi"><img src="${icon}" alt="${sw}"></div>` : '';
                }).join('');
                return `
                <div class="explore-item" data-id="${p._id}">
                    ${presetMediaInnerHtml(p.media, p.name)}
                    <div class="explore-badges">${badgesHtml}</div>
                    <div class="explore-info">
                        <div class="explore-info-title">${escapeHtmlAttr(p.name)}</div>
                        <div class="explore-info-row">
                            <span class="material-symbols-rounded" style="${p.liked ? 'color: #ff3b5c; font-variation-settings: \'FILL\' 1;' : ''}">favorite</span>
                            <span>${p.likes || 0}</span>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            exploreGrid.setAttribute('data-loaded', 'true');
        }
        if (feedContainer) {
            const dsa = escapeHtmlAttr;
            feedContainer.innerHTML = presets.map((p) => {
                const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                const swIconsHtml = swArr.map(sw => {
                    const icon = badgeIcons[sw];
                    return icon ? `<img src="${icon}" class="tiktok-title-icon" alt="${sw}">` : '';
                }).join('');
                return `
                <article class="tiktok-slide preset-post"
                    data-id="${p._id}"
                    data-name="${dsa(p.name)}"
                    data-size="${dsa(p.size)}"
                    data-type="${dsa(p.type)}"
                    data-version="${dsa(p.version)}"
                    data-software="${dsa(Array.isArray(p.software) ? p.software.join(',') : (p.software || ''))}">
                    <div class="tiktok-slide-media post-media-container">
                        ${presetMediaInnerHtml(p.media, p.name)}
                        <div class="tiktok-slide-gradient" aria-hidden="true"></div>
                        <button type="button" class="video-mute-btn" aria-label="Toggle mute" style="position: absolute; top: max(12px, env(safe-area-inset-top, 12px)); right: 12px; z-index: 160; background: rgba(0, 0, 0, 0.45); border: none; width: 44px; height: 44px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;">
                            <span class="material-symbols-rounded" style="font-size: 24px;">volume_off</span>
                        </button>
                        <div class="video-interaction-overlay">
                            <span class="material-symbols-rounded overlay-pause">pause</span>
                        </div>
                    </div>
                    <div class="tiktok-slide-ui">
                        <div class="tiktok-rail">
                            <button type="button" class="tiktok-rail-btn action-btn ${p.liked ? 'liked' : ''}" data-action="like">
                                <span class="material-symbols-rounded">${p.liked ? 'favorite' : 'favorite_border'}</span>
                                <span class="action-label">${p.likes || 0}</span>
                            </button>
                            <button type="button" class="tiktok-rail-btn action-btn" data-action="source">
                                <span class="material-symbols-rounded">open_in_new</span>
                                <span class="action-label">Source</span>
                            </button>
                        </div>
                        <div class="tiktok-bottom">
                            <div class="tiktok-info">
                                <div class="tiktok-title-row">
                                    <div class="tiktok-title-icons">${swIconsHtml}</div>
                                    <div class="tiktok-title-wrapper">
                                        <h3 class="tiktok-title">${dsa(p.name)}</h3>
                                    </div>
                                </div>
                                <div class="tiktok-meta">
                                    <div class="meta-item">
                                        <span>${dsa(p.size || 'N/A')}</span>
                                    </div>
                                    <span class="meta-dot">•</span>
                                    <div class="meta-item">
                                        <span>${dsa(p.version || 'v1.0')}</span>
                                    </div>
                                </div>
                            </div>
                            
                            ${p.plugin ? `
                            <div class="tiktok-plugin-bar">
                                <span class="material-symbols-rounded">extension</span>
                                <span>${dsa(p.plugin)}</span>
                            </div>
                            ` : ''}
                            
                            <button type="button" class="tiktok-download-btn-full" data-action="download">
                                Download
                            </button>
                        </div>
                    </div>
                </article>
            `;
            }).join('');
        }
        await hydrateTikTokHosts(exploreGrid, 'image');
        await hydrateTikTokHosts(feedContainer, 'video');
        if (feedContainer) {
            setupScrollLinkedVideoPlayback(feedContainer, '.tiktok-slide', feedContainer);
            setupTikTokInteractions(feedContainer);
            updateScrollingTitles(feedContainer);
        }
        if (filterSoftware === 'All') {
            exploreGrid.setAttribute('data-loaded', 'true');
            if (targetSubId) {
                const presetExists = allPresets.some(p => p._id === targetSubId);
                if (presetExists) {
                    showFeed(targetSubId);
                }
            }
        }
    };
    const OS_SVG = { WIN: 'assets/svg/windows.svg', MAC: 'assets/svg/apple.svg', ANDROID: 'assets/svg/android.svg' };
    const OS_LABEL = { WIN: 'Windows', MAC: 'macOS', ANDROID: 'Android' };

    const renderResourceCategories = (resources) => {
        const categoryContainer = document.getElementById('resource-categories');
        if (!categoryContainer) return;

        const activeCategory = categoryContainer.querySelector('.chip.active')?.dataset.category || 'All';
        const catSet = new Set();
        resources.forEach(r => {
            const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
            cats.forEach(c => catSet.add(c));
        });

        // Sort: "Made By Cutefish" first, then alphabetical
        const sorted = [...catSet].sort((a, b) => {
            if (a === 'Made By Cutefish') return -1;
            if (b === 'Made By Cutefish') return 1;
            return a.localeCompare(b);
        });
        const categories = ['All', ...sorted];

        categoryContainer.innerHTML = categories.map(cat => `
            <div class="chip ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</div>
        `).join('');
    };

    let allResources = [];
    const renderResources = async (query = '', filterCategory = 'All') => {
        const container = document.getElementById('resource-grid');
        if (!container) return;

        container.innerHTML = Array(4).fill(0).map(() => `
            <div class="skeleton-resource-card">
                <div class="skeleton-resource-card-icon"></div>
                <div class="skeleton-resource-card-info">
                    <div class="skeleton-resource-card-line"></div>
                    <div class="skeleton-resource-card-line short"></div>
                    <div class="skeleton-resource-card-line medium"></div>
                </div>
            </div>
        `).join('');

        const res = await fetch(`${API_URL}/resources`);
        allResources = await res.json();

        renderResourceCategories(allResources);

        let filtered = allResources;

        if (filterCategory !== 'All') {
            filtered = filtered.filter(r => {
                const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                return cats.includes(filterCategory);
            });
        }

        if (query) {
            filtered = filtered.filter(r =>
                r.title.toLowerCase().includes(query.toLowerCase()) ||
                (Array.isArray(r.category) ? r.category.join(' ') : (r.category || '')).toLowerCase().includes(query.toLowerCase()) ||
                (r.dev && r.dev.toLowerCase().includes(query.toLowerCase()))
            );
        }

        // Sort: "Made By Cutefish" category resources first
        filtered.sort((a, b) => {
            const aIsCute = (Array.isArray(a.category) ? a.category : [a.category]).includes('Made By Cutefish');
            const bIsCute = (Array.isArray(b.category) ? b.category : [b.category]).includes('Made By Cutefish');
            if (aIsCute && !bIsCute) return -1;
            if (!aIsCute && bIsCute) return 1;
            return 0;
        });

        if (filtered.length > 0) {
            container.innerHTML = filtered.map((r) => {
                const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                const osArr = Array.isArray(r.os) ? r.os : [];
                const osIconsHtml = osArr.map(o => {
                    const key = typeof o === 'string' ? o.toUpperCase() : (o.name || '').toUpperCase();
                    const svg = OS_SVG[key];
                    return svg ? `<img src="${svg}" class="os-icon-svg" alt="${key}" style="width:14px;height:14px">` : '';
                }).join('');

                const isCutefish = cats.includes('Made By Cutefish');
                const iconHtml = (r.icon && (r.icon.startsWith('http') || r.icon.includes('/')))
                    ? `<img src="${thumbUrl(r.icon, 128)}" class="resource-icon-img" alt="${r.title}" loading="lazy">`
                    : `<span class="material-symbols-rounded resource-icon">${r.icon || 'shop'}</span>`;

                return `
                <div class="card resource-card ${isCutefish ? 'resource-card-cutefish' : ''}" data-id="${r._id}" style="cursor:pointer">
                    <div class="resource-icon-wrapper">
                        ${iconHtml}
                    </div>
                    <div class="resource-info-compact">
                        <h4 class="resource-title-compact">${r.title}</h4>
                        <p class="resource-dev-compact">${r.dev || 'CHROS Team'}</p>
                        <div class="resource-meta-compact">
                            ${osIconsHtml ? `<span class="chip-mini os-chip">${osIconsHtml}</span>` : ''}
                            <span class="resource-info-text">${r.info || ''}</span>
                        </div>
                        <div class="resource-cats-row">
                            ${cats.map(c => `<span class="resource-cat-chip">${c}</span>`).join('')}
                        </div>
                    </div>
                    <button class="download-direct-btn res-card-detail-btn" data-id="${r._id}" aria-label="Details">
                        <span class="btn-label">Download</span>
                        <span class="material-symbols-rounded">download</span>
                    </button>
                </div>`;
            }).join('');
            container.setAttribute('data-loaded', 'true');

            // Attach click handlers
            container.querySelectorAll('.resource-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.res-card-detail-btn') || e.target.closest('.download-direct-btn')) return;
                    const id = card.dataset.id;
                    const item = allResources.find(r => r._id === id);
                    if (item) openResourcePopup(item);
                });
            });
            container.querySelectorAll('.res-card-detail-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const item = allResources.find(r => r._id === id);
                    if (item) openResourcePopup(item);
                });
            });
        }
    };


    const RESOURCE_PASSWORD = 'EDITINGSTUFF';

    const openResourcePopup = (resource) => {
        const popup = document.getElementById('resource-detail-popup');
        if (!popup) return;

        // Icon
        const iconEl = document.getElementById('res-popup-icon');
        const fallbackEl = document.getElementById('res-popup-icon-fallback');
        if (resource.icon && (resource.icon.startsWith('http') || resource.icon.includes('/'))) {
            iconEl.src = thumbUrl(resource.icon, 128);
            iconEl.classList.remove('hidden');
            if (fallbackEl) fallbackEl.classList.add('hidden');
        } else {
            iconEl.classList.add('hidden');
            if (fallbackEl) fallbackEl.classList.remove('hidden');
        }

        document.getElementById('res-popup-title').textContent = resource.title;
        document.getElementById('res-popup-dev').textContent = resource.dev || 'CHROS Team';
        document.getElementById('res-popup-info').textContent = resource.info || '—';

        // Categories
        const cats = Array.isArray(resource.category) ? resource.category : (resource.category ? [resource.category] : []);
        document.getElementById('res-popup-cats').innerHTML = cats.map(c =>
            `<span class="res-popup-cat-chip">${c}</span>`
        ).join('');

        // OS data
        const osArr = Array.isArray(resource.os) ? resource.os : [];
        document.getElementById('res-popup-os-count').textContent = osArr.length || '—';
        const totalVers = new Set();
        osArr.forEach(o => { if (o.versions) o.versions.forEach(v => totalVers.add(v.label)); });
        document.getElementById('res-popup-ver-count').textContent = totalVers.size || '—';

        // State
        let selectedOs = null;
        let selectedVer = null;
        let osVersionMap = {}; // { WIN: [{label, url}], MAC: [...] }

        osArr.forEach(o => {
            const key = typeof o === 'string' ? o.toUpperCase() : (o.name || '').toUpperCase();
            osVersionMap[key] = o.versions || [];
        });

        const downloadSection = document.getElementById('res-popup-download-section');
        const verSection = document.getElementById('res-popup-ver-section');
        const passwordSection = document.getElementById('res-popup-password-section');
        const instrSection = document.getElementById('res-popup-instruction-section');

        const downloadBtn = document.getElementById('res-popup-download-btn');
        const downloadLabel = document.getElementById('res-popup-download-label');
        const verChipsEl = document.getElementById('res-popup-ver-chips');
        const osChipsEl = document.getElementById('res-popup-os-chips');

        // Hide downstream sections initially
        verSection.classList.add('hidden');
        downloadSection.classList.add('hidden');
        passwordSection.classList.add('hidden');
        instrSection.classList.add('hidden');

        const updateDownloadBtn = () => {
            const mainTextEl = downloadBtn.querySelector('.download-main-text');
            if (selectedOs && selectedVer) {
                const versions = osVersionMap[selectedOs] || [];
                const entry = versions.find(v => v.label === selectedVer);
                if (entry && entry.url) {
                    downloadBtn.disabled = false;
                    downloadBtn.onclick = () => window.open(ensureProtocol(entry.url), '_blank');
                    if (mainTextEl) mainTextEl.style.display = 'block';
                    downloadLabel.textContent = `${OS_LABEL[selectedOs] || selectedOs} - ${selectedVer}`;
                    
                    // Show downstream sections once selected
                    downloadSection.classList.remove('hidden');
                    passwordSection.classList.remove('hidden');
                    if (resource.instruction) {
                        instrSection.classList.remove('hidden');
                    }
                } else {
                    downloadBtn.disabled = true;
                    if (mainTextEl) mainTextEl.style.display = 'none';
                    downloadLabel.textContent = 'No link available';
                    downloadSection.classList.remove('hidden');
                }
            } else {
                downloadBtn.disabled = true;
                if (mainTextEl) mainTextEl.style.display = 'none';
                downloadLabel.textContent = 'Select OS & Version';
            }
        };

        const renderVerChips = () => {
            if (!selectedOs) {
                verSection.classList.add('hidden');
                return;
            }
            const versions = osVersionMap[selectedOs] || [];
            if (!versions.length) {
                verChipsEl.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant);font-size:13px">No versions available</span>';
                verSection.classList.remove('hidden');
                return;
            }
            verChipsEl.innerHTML = versions.map(v =>
                `<button class="res-popup-chip ${selectedVer === v.label ? 'active' : ''}" data-ver="${v.label}">${v.label}</button>`
            ).join('');
            verSection.classList.remove('hidden');

            verChipsEl.querySelectorAll('.res-popup-chip').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedVer = btn.dataset.ver;
                    verChipsEl.querySelectorAll('.res-popup-chip').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateDownloadBtn();
                });
            });
        };

        // Render OS chips
        const osKeys = Object.keys(osVersionMap);
        if (osKeys.length > 0) {
            osChipsEl.innerHTML = osKeys.map(key =>
                `<button class="res-popup-chip os-chip-btn" data-os="${key}">
                    ${OS_SVG[key] ? `<img src="${OS_SVG[key]}" class="os-icon-svg" style="width:16px;height:16px" alt="${key}">` : ''}
                    <span>${OS_LABEL[key] || key}</span>
                </button>`
            ).join('');
            osChipsEl.querySelectorAll('.os-chip-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedOs = btn.dataset.os;
                    selectedVer = null;
                    osChipsEl.querySelectorAll('.os-chip-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Reset and hide downstream when switching platform
                    downloadSection.classList.add('hidden');
                    passwordSection.classList.add('hidden');
                    instrSection.classList.add('hidden');

                    renderVerChips();
                });
            });
        } else {
            osChipsEl.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant);font-size:13px">No platforms configured</span>';
        }

        // Password
        document.getElementById('res-popup-password').textContent = RESOURCE_PASSWORD;
        const copyBtn = document.getElementById('res-popup-copy-btn');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(RESOURCE_PASSWORD).then(() => {
                const icon = copyBtn.querySelector('.material-symbols-rounded');
                icon.textContent = 'check';
                setTimeout(() => { icon.textContent = 'content_copy'; }, 1500);
            });
        };

        // Instruction
        const instrEl = document.getElementById('res-popup-instruction');
        if (resource.instruction) {
            instrEl.textContent = resource.instruction;
        }

        popup.classList.add('show');
    };

    document.getElementById('close-resource-popup')?.addEventListener('click', () => {
        document.getElementById('resource-detail-popup').classList.remove('show');
    });
    document.getElementById('resource-detail-popup')?.addEventListener('click', (e) => {
        if (e.target.id === 'resource-detail-popup') {
            e.target.classList.remove('show');
        }
    });



    const categoryContainer = document.getElementById('preset-categories');
    if (categoryContainer) {
        categoryContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            categoryContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const software = chip.dataset.software;
            renderPresets(software);
        });
    }

    const resourceCategoryContainer = document.getElementById('resource-categories');
    if (resourceCategoryContainer) {
        resourceCategoryContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            resourceCategoryContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const category = chip.dataset.category;
            renderResources('', category);
        });
    }

    const resourceSearch = document.getElementById('resource-search');
    if (resourceSearch) {
        resourceSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            const activeCategory = document.querySelector('#resource-categories .chip.active')?.dataset.category || 'All';
            renderResources(query, activeCategory);
        });
    }




    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        const root = document.documentElement;
        
        const getPreferredTheme = () => {
            const saved = localStorage.getItem('theme');
            if (saved) return saved;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        };

        const setTheme = (theme) => {
            const icon = themeToggleBtn.querySelector('.material-symbols-rounded');
            if (theme === 'dark') {
                root.classList.add('dark-theme');
                root.classList.remove('light-theme');
                if (icon) icon.textContent = 'light_mode';
                localStorage.setItem('theme', 'dark');
            } else {
                root.classList.add('light-theme');
                root.classList.remove('dark-theme');
                if (icon) icon.textContent = 'dark_mode';
                localStorage.setItem('theme', 'light');
            }
        };

        // Init theme
        setTheme(getPreferredTheme());

        themeToggleBtn.addEventListener('click', () => {
            const isDark = root.classList.contains('dark-theme') || 
                           (!root.classList.contains('light-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
            setTheme(isDark ? 'light' : 'dark');
        });
    }

    const initialTab = (targetTab === 'fishtoolupdate') ? 'resource' : (targetTab || 'social');
    const initialItem = document.querySelector(`.nav-item[data-tab="${initialTab}"]`);
    if (initialItem) initialItem.click();

    // Auto-open FishTools popup when hash is #fishtoolupdate
    if (targetTab === 'fishtoolupdate') {
        const tryOpenFishTools = async () => {
            // Wait for resources to be fetched and rendered
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                if (allResources.length > 0) {
                    clearInterval(poll);
                    const fishTools = allResources.find(r => r.title && r.title.toLowerCase() === 'fishtools');
                    if (fishTools) openResourcePopup(fishTools);
                }
                if (attempts > 40) clearInterval(poll); // stop after 4 seconds
            }, 100);
        };
        tryOpenFishTools();
    }
});
