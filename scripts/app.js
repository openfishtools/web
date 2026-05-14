document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messageContainer = document.getElementById('message-container');
    const chatLogin = document.getElementById('chat-login');
    const chatActive = document.getElementById('chat-active');
    const startChatBtn = document.getElementById('start-chat-btn');
    const userNameInput = document.getElementById('user-name');
    const userHandleInput = document.getElementById('user-handle');
    const userIpDisplay = document.getElementById('user-ip');

    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : 'https://chros-backend.onrender.com/api'; // Replace with your actual Render URL later

    const ensureProtocol = (url) => {
        if (!url || url === '#') return '#';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) return url;
        return `https://${url}`;
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
        
        if (presetFeedView && !presetFeedView.classList.contains('hidden') && lastClickedRect) {
            const targetInGrid = document.querySelector(`.explore-item[data-id="${lastClickedId}"]`);
            if (!targetInGrid) {
                presetFeedView.classList.add('hidden');
                presetExploreView.classList.remove('hidden');
                return;
            }

            const morph = document.createElement('div');
            morph.className = 'morph-element';
            const clone = targetInGrid.cloneNode(true);
            morph.appendChild(clone);

            const mockupScreen = document.querySelector('.phone-screen');
            const isMockup = mockupScreen && getComputedStyle(document.querySelector('.phone-notch')).display !== 'none';
            
            const first = isMockup ? mockupScreen.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
            const last = lastClickedRect;

            const scaleX = last.width / first.width;
            const scaleY = last.height / first.height;
            const translateX = last.left - first.left;
            const translateY = last.top - first.top;

            Object.assign(morph.style, {
                position: 'fixed',
                top: `${first.top}px`,
                left: `${first.left}px`,
                width: `${first.width}px`,
                height: `${first.height}px`,
                zIndex: '10000',
                borderRadius: isMockup ? '16px' : '0',
                overflow: 'hidden',
                transformOrigin: 'top left',
                willChange: 'transform, opacity',
                pointerEvents: 'none',
                boxShadow: 'var(--md-sys-elevation-4)',
            });

            document.body.appendChild(morph);
            presetFeedView.style.opacity = '0';
            presetFeedView.style.transition = 'opacity 0.15s ease';

            if (presetExploreView) {
                presetExploreView.classList.remove('hidden');
                presetExploreView.style.opacity = '1';
                presetExploreView.style.transition = 'none';
            }

            // Double RAF to ensure initial styles are painted before transition starts (fixes Firefox)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    morph.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
                    morph.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
                    morph.style.borderRadius = '12px';
                });
            });

            setTimeout(() => {
                presetFeedView.classList.add('hidden');
                morph.style.opacity = '0';
                morph.style.transition = 'opacity 0.15s ease';
                setTimeout(() => morph.remove(), 150);
            }, 250);
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

        lastClickedId = targetId;
        lastClickedRect = clickedEl ? clickedEl.getBoundingClientRect() : null;

        feedView.style.opacity = '0';
        feedView.style.display = 'block';
        feedView.classList.remove('hidden');

        if (clickedEl && lastClickedRect) {
            const morph = document.createElement('div');
            morph.className = 'morph-element';
            const clone = clickedEl.cloneNode(true);
            morph.appendChild(clone);

            const mockupScreen = document.querySelector('.phone-screen');
            const isMockup = mockupScreen && getComputedStyle(document.querySelector('.phone-notch')).display !== 'none';

            const first = lastClickedRect;
            const last = isMockup ? mockupScreen.getBoundingClientRect() : {
                top: 0,
                left: 0,
                width: window.innerWidth,
                height: window.innerHeight
            };

            const scaleX = first.width / last.width;
            const scaleY = first.height / last.height;
            const translateX = first.left - last.left;
            const translateY = first.top - last.top;

            Object.assign(morph.style, {
                position: 'fixed',
                top: `${last.top}px`,
                left: `${last.left}px`,
                width: `${last.width}px`,
                height: `${last.height}px`,
                zIndex: '10000',
                borderRadius: '12px',
                overflow: 'hidden',
                transformOrigin: 'top left',
                transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
                willChange: 'transform, opacity',
                pointerEvents: 'none',
                boxShadow: 'var(--md-sys-elevation-4)',
                transition: 'none'
            });

            document.body.appendChild(morph);

            requestAnimationFrame(() => {
                morph.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
                morph.style.transform = 'translate(0, 0) scale(1)';
                morph.style.borderRadius = isMockup ? '16px' : '0';
                feedView.style.opacity = '1';
                feedView.style.transition = 'opacity 0.2s ease';
            });

            if (exploreView) {
                exploreView.style.transition = 'opacity 0.15s ease';
                exploreView.style.opacity = '0';
            }

            setTimeout(() => {
                if (exploreView) exploreView.classList.add('hidden');
                morph.style.opacity = '0';
                morph.style.transition = 'opacity 0.15s ease';
                setTimeout(() => morph.remove(), 150);
            }, 250);
        } else {
            if (exploreView) exploreView.classList.add('hidden');
            feedView.style.opacity = '1';
        }

        if (feedContainer) {
            hydrateTikTokHosts(feedContainer, 'video');
        }

        const targetPost = document.querySelector(`.preset-post[data-id="${targetId}"]`);
        if (targetPost) {
            targetPost.scrollIntoView({ behavior: 'auto', block: 'start' });
            const video = targetPost.querySelector('video');
            if (video) {
                video.muted = globalMuted;
                video.play().catch(() => {});
            }
        }
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
            return `<video src="${escapeHtmlAttr(m)}" muted loop playsinline autoplay crossorigin="anonymous"></video>`;
        }
        if (isTikTokLikeUrl(m)) {
            return `<div class="tiktok-media-host" data-tiktok-url="${escapeHtmlAttr(m)}" role="group" aria-label="${label}"><div class="tiktok-media-skeleton"><span class="material-symbols-rounded tiktok-skel-icon">smart_display</span></div></div>`;
        }
        return `<img src="${escapeHtmlAttr(m)}" alt="${label}">`;
    };

    const hydrateTikTokHosts = async (root, mode = 'video') => {
        if (!root || !('IntersectionObserver' in window)) return;
        const hosts = root.querySelectorAll('.tiktok-media-host:not([data-tiktok-state])');
        
        const io = new IntersectionObserver((entries) => {
            entries.forEach(async (en) => {
                const el = en.target;
                if (!en.isIntersecting || el.dataset.tiktokState) return;
                
                const src = el.dataset.tiktokUrl;
                if (!src) return;
                
                el.dataset.tiktokState = 'loading';
                
                const resolveWithRetry = async (retryCount = 0) => {
                    try {
                        const r = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(src)}`);
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
                                el.appendChild(img);
                                if (mode === 'video') {
                                    const link = document.createElement('a');
                                    link.href = src;
                                    link.target = '_blank';
                                    link.className = 'tiktok-fallback-link';
                                    link.innerHTML = '<span class="material-symbols-rounded">open_in_new</span><span>View on TikTok</span>';
                                    el.appendChild(link);
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
                                if (!globalMuted) v.volume = 1;
                                el.appendChild(v);
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
    };

    const disconnectScrollVideoIo = (attachEl) => {
        if (attachEl && attachEl._scrollVideoIo) {
            attachEl._scrollVideoIo.disconnect();
            attachEl._scrollVideoIo = null;
        }
    };

    const setupScrollLinkedVideoPlayback = (scrollRoot, slideSelector, attachEl) => {
        if (!scrollRoot || !('IntersectionObserver' in window)) return;
        const tag = attachEl || scrollRoot;
        disconnectScrollVideoIo(tag);
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                const slide = en.target;
                const host = slide.querySelector(':scope .tiktok-media-host');
                const video = slide.querySelector(':scope video');
                const el = (host && host.querySelector('video')) || video;
                if (!el || el.tagName !== 'VIDEO') return;
                if (en.isIntersecting && en.intersectionRatio >= 0.2) {
                    el.muted = globalMuted;
                    if (!globalMuted) el.volume = 1;
                    el.play().catch((err) => {
                        console.log('Autoplay blocked:', err);
                        el.muted = true;
                        el.play();
                    });
                } else {
                    el.pause();
                }
            });
        }, {
            root: scrollRoot === document.documentElement ? null : scrollRoot,
            threshold: [0, 0.25, 0.4, 0.55, 1],
            rootMargin: '0px'
        });
        scrollRoot.querySelectorAll(slideSelector).forEach((el) => io.observe(el));
        tag._scrollVideoIo = io;
    };

    let globalMuted = false;
    let currentChatId = null;
    let messagesPollInterval = null;
    let heartbeatInterval = null;

    const stopChatPolling = () => {
        if (messagesPollInterval != null) {
            clearInterval(messagesPollInterval);
            messagesPollInterval = null;
        }
        if (heartbeatInterval != null) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    };

    const updateAdminStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/status`);
            const data = await res.json();
            const statusEl = document.getElementById('admin-status-text');
            if (statusEl) {
                statusEl.textContent = data.online ? 'Online' : 'Offline';
                statusEl.style.color = data.online ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)';
            }
        } catch (err) {
            console.error('Admin status check failed:', err);
        }
    };
    setInterval(updateAdminStatus, 5000);
    updateAdminStatus();

    let userIp = null;
    fetch(`${API_URL}/get-ip`)
        .then(response => response.json())
        .then((data) => {
            userIp = normalizeClientIp(data.ip);
            userIpDisplay.textContent = `Your IP: ${userIp}`;
            checkExistingChat();
        })
        .catch(() => {
            userIp = '127.0.0.1';
            userIpDisplay.textContent = 'IP: 127.0.0.1 (Local/Mock)';
            checkExistingChat();
        });

    const loadMessages = async () => {
        if (!currentChatId) return;
        try {
            const res = await fetch(`${API_URL}/messages/${currentChatId}`);
            if (res.status === 404) {
                stopChatPolling();
                currentChatId = null;
                alert('Your chat has been closed by the admin.');
                location.reload();
                return;
            }
            const messages = await res.json();
            
            const currentCount = messageContainer.querySelectorAll('.message-group').length;
            if (messages.length === currentCount) return;

            messageContainer.innerHTML = messages.map(m => `
                <div class="message-group ${m.type}">
                    <div class="message">${renderMessageContent(m.text)}</div>
                    <div class="timestamp">${m.time}</div>
                </div>
            `).join('');
            messageContainer.scrollTop = messageContainer.scrollHeight;
        } catch (err) {
            console.error('Load messages failed:', err);
        }
    };

    const renderMessageContent = (text) => {
        const fileMatch = text.match(/📁 Shared a file: \[(.*?)\]\((.*?)\)/);
        if (!fileMatch) return text;

        const [_, fileName, fileUrl] = fileMatch;
        const ext = fileName.split('.').pop().toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return `
                <a href="${fileUrl}" target="_blank" class="message-media">
                    <img src="${fileUrl}" class="message-img" alt="${fileName}">
                </a>
            `;
        }

        if (['mp4', 'webm', 'ogg'].includes(ext)) {
            return `
                <div class="message-media">
                    <video src="${fileUrl}" class="message-video" controls></video>
                </div>
            `;
        }

        return `
            <a href="${fileUrl}" target="_blank" class="message-file">
                <div class="file-icon-wrapper">
                    <span class="material-symbols-rounded">description</span>
                </div>
                <div class="file-info">
                    <span class="file-name">${fileName}</span>
                    <span class="file-ext">${ext}</span>
                </div>
            </a>
        `;
    };

    const pollMessages = () => {
        stopChatPolling();
        loadMessages();
        messagesPollInterval = setInterval(loadMessages, 3000);
        heartbeatInterval = setInterval(async () => {
            if (currentChatId) {
                await fetch(`${API_URL}/chats/${currentChatId}/heartbeat`, { method: 'POST' });
            }
        }, 5000);
    };

    const checkExistingChat = async () => {
        if (!userIp) return;
        try {
            const res = await fetch(`${API_URL}/chats/check?ip=${encodeURIComponent(userIp)}`);
            const chat = await res.json();
            if (chat && chat._id) {
                currentChatId = chat._id;
                chatLogin.classList.add('hidden');
                chatActive.classList.remove('hidden');
                pollMessages();
            }
        } catch (err) {
            console.error('Check existing chat failed:', err);
        }
    };

    startChatBtn.addEventListener('click', async () => {
        const name = userNameInput.value.trim();
        const handle = userHandleInput.value.trim();

        if (name && handle && userIp) {
            try {
                const res = await fetch(`${API_URL}/chats`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: `${name} (${handle})`, 
                        ip: userIp,
                        lastMsg: 'Joined chat', 
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    })
                });

                if (res.status === 403) {
                    alert('You have been blocked from the chat.');
                    return;
                }

                if (res.ok) {
                    const chat = await res.json();
                    currentChatId = chat._id;
                    chatLogin.classList.add('hidden');
                    chatActive.classList.remove('hidden');
                    pollMessages();
                } else {
                    const err = await res.json();
                    alert(`Error: ${err.error || 'Failed to start chat'}`);
                }
            } catch (err) {
                alert('Connection error. Is the server running?');
                console.error(err);
            }
        } else {
            alert('Please enter both Name and Username');
        }
    });

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
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
                stopChatPolling();
            } else if (targetTab === 'preset') {
                renderPresets();
                stopChatPolling();
            } else if (targetTab === 'resource') {
                renderResources();
                stopChatPolling();
            } else if (targetTab === 'chat') {
                pollMessages();
            }
            if (history.pushState) {
                history.pushState(null, null, `#${targetTab}`);
            }
        });
    });

    const sendMessage = async (customText = null) => {
        const text = (typeof customText === 'string') ? customText : chatInput.value.trim();
        if (text && currentChatId) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const res = await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: currentChatId, text, type: 'sent', time })
            });
            if (res.status === 403) {
                alert('You are blocked from sending messages.');
                return;
            }
            if (typeof customText !== 'string') chatInput.value = '';
            loadMessages();
        }
    };

    const openUploadBtn = document.getElementById('open-upload-modal');
    const closeUploadBtn = document.getElementById('close-upload-modal');
    const uploadModal = document.getElementById('upload-modal');
    const uploadDrop = document.getElementById('chat-upload-drop');
    const fileInput = document.getElementById('chat-file-input');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const statusText = document.getElementById('upload-status-text');

    if (openUploadBtn) openUploadBtn.onclick = () => uploadModal.classList.add('show');
    if (closeUploadBtn) closeUploadBtn.onclick = () => uploadModal.classList.remove('show');

    const handleFileUpload = async (file) => {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            alert('File too large. Max size is 50MB.');
            return;
        }
        progressContainer.classList.remove('hidden');
        progressFill.style.width = '0%';
        statusText.textContent = `Uploading ${file.name}...`;
        const formData = new FormData();
        formData.append('file', file);
        try {
            let progress = 0;
            const progInterval = setInterval(() => {
                progress += 5;
                if (progress <= 90) progressFill.style.width = `${progress}%`;
            }, 1500);
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            clearInterval(progInterval);
            if (res.ok) {
                const data = await res.json();
                progressFill.style.width = '100%';
                statusText.textContent = 'Upload successful!';
                const msgText = `📁 Shared a file: [${data.name}](${data.url})`;
                await sendMessage(msgText);
                setTimeout(() => {
                    uploadModal.classList.remove('show');
                    progressContainer.classList.add('hidden');
                }, 1000);
            } else {
                statusText.textContent = 'Upload failed. Try again.';
            }
        } catch (err) {
            console.error('Upload error:', err);
            statusText.textContent = 'Upload error. Check connection.';
        }
    };

    if (uploadDrop) {
        uploadDrop.onclick = () => fileInput.click();
        uploadDrop.ondragover = (e) => { e.preventDefault(); uploadDrop.classList.add('active'); };
        uploadDrop.ondragleave = () => uploadDrop.classList.remove('active');
        uploadDrop.ondrop = (e) => {
            e.preventDefault();
            uploadDrop.classList.remove('active');
            if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
        };
        fileInput.onchange = () => {
            if (fileInput.files.length) handleFileUpload(fileInput.files[0]);
        };
    }

    sendBtn.addEventListener('click', () => sendMessage());
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    const hash = window.location.hash.substring(1);
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
                    if (data.url) {
                        window.open(data.url, '_blank');
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

    const handleLike = async (id, btn) => {
        if (btn.classList.contains('liked')) return;
        
        try {
            const res = await fetch(`${API_URL}/presets/${id}/like`, {
                method: 'POST'
            });
            
            const data = await res.json();
            
            if (res.ok) {
                btn.classList.add('liked');
                const icon = btn.querySelector('.material-symbols-rounded');
                const label = btn.querySelector('.action-label');
                
                if (icon) icon.textContent = 'favorite';
                if (label) label.textContent = data.likes;
                
                // Pop animation
                btn.classList.add('like-pop');
                setTimeout(() => btn.classList.remove('like-pop'), 400);
            } else {
                if (data.error === 'Already liked from this IP') {
                    btn.classList.add('liked');
                    const icon = btn.querySelector('.material-symbols-rounded');
                    if (icon) icon.textContent = 'favorite';
                    alert('You have already liked this preset.');
                } else {
                    alert('Failed to like: ' + data.error);
                }
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
        const res = await fetch(`${API_URL}/socials`);
        const socials = await res.json();
        if (socials.length > 0) {
            container.innerHTML = socials.map(s => {
                const iconHtml = (s.icon && (s.icon.startsWith('http') || s.icon.includes('/')))
                    ? `<img src="${s.icon}" class="social-icon-img" alt="${s.name}">`
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
        const categories = ['All', ...new Set(presets.map(p => p.software))];
        
        categoryContainer.innerHTML = categories.map(cat => {
            if (cat === 'All') return `<div class="chip ${activeCategory === 'All' ? 'active' : ''}" data-software="All">All</div>`;
            
            const badgeIcons = {
                'AE': 'assets/icon/Ae.png',
                'AM': 'assets/icon/Am.png',
                'Blurr': 'assets/icon/Blurr.png',
                'CC': 'assets/icon/CC.png',
                'FM': 'assets/icon/Fm.png',
                'Node': 'assets/icon/Node.png'
            };
            const icon = badgeIcons[cat];
            const iconHtml = icon ? `<img src="${icon}" alt="${cat}" class="chip-icon">` : '';
            return `<div class="chip ${activeCategory === cat ? 'active' : ''}" data-software="${cat}">${iconHtml}${cat}</div>`;
        }).join('');
    };

    const renderPresets = async (filterSoftware = 'All') => {
        const exploreGrid = document.getElementById('preset-explore-grid');
        if (!exploreGrid) return;
        
        const res = await fetch(`${API_URL}/presets`);
        const allPresets = await res.json();
        
        renderPresetCategories(allPresets);
        
        const presets = filterSoftware === 'All' ? allPresets : allPresets.filter(p => p.software === filterSoftware);
        const feedContainer = document.getElementById('preset-feed');
        if (exploreGrid) disconnectScrollVideoIo(exploreGrid);
        if (feedContainer) disconnectScrollVideoIo(feedContainer);
        
        if (presets.length === 0) {
            exploreGrid.innerHTML = `<div class="empty-state">No presets found for ${filterSoftware}</div>`;
        } else {
            exploreGrid.innerHTML = presets.map(p => `
                <div class="explore-item" data-id="${p._id}">
                    ${presetMediaInnerHtml(p.media, p.name)}
                    <div class="explore-badge">
                        <img src="${badgeIcons[p.software] || ''}" alt="${p.software}">
                    </div>
                    <div class="explore-info">
                        <span class="material-symbols-rounded">favorite</span>
                        <span>${p.likes || 0}</span>
                    </div>
                </div>
            `).join('');
            exploreGrid.setAttribute('data-loaded', 'true');
        }
        if (feedContainer) {
            const dsa = escapeHtmlAttr;
            feedContainer.innerHTML = presets.map((p) => `
                <article class="tiktok-slide preset-post"
                    data-id="${p._id}"
                    data-name="${dsa(p.name)}"
                    data-size="${dsa(p.size)}"
                    data-type="${dsa(p.type)}"
                    data-version="${dsa(p.version)}"
                    data-software="${dsa(p.software)}">
                    <div class="tiktok-slide-media post-media-container">
                        ${presetMediaInnerHtml(p.media, p.name)}
                        <div class="tiktok-slide-gradient" aria-hidden="true"></div>
                    </div>
                    <div class="tiktok-slide-ui">
                        <div class="tiktok-rail">
                            <button type="button" class="tiktok-rail-btn action-btn" data-action="like">
                                <span class="material-symbols-rounded">favorite_border</span>
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
                                    <img src="${badgeIcons[p.software] || ''}" class="tiktok-title-icon" alt="">
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
                                ${p.plugin ? `
                                <div class="plugin-scroll-container">
                                    <div class="plugin-tag-v2">
                                        <span class="material-symbols-rounded">extension</span>
                                        <span>${dsa(p.plugin)}</span>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <button type="button" class="tiktok-download-btn" data-action="download">
                                Download
                            </button>
                        </div>
                    </div>
                </article>
            `).join('');
        }
        await hydrateTikTokHosts(exploreGrid, 'image');
        await hydrateTikTokHosts(feedContainer, 'video');
        if (feedContainer) {
            setupScrollLinkedVideoPlayback(feedContainer, '.tiktok-slide', feedContainer);
            setTimeout(() => {
                feedContainer.querySelectorAll('.tiktok-title').forEach(title => {
                    const wrapper = title.parentElement;
                    if (wrapper && title.scrollWidth > wrapper.clientWidth + 1) {
                        const dist = (title.scrollWidth - wrapper.clientWidth) + 30; // Extra offset for fade
                        title.style.setProperty('--scroll-dist', `${dist}px`);
                        title.classList.add('scroll');
                    }
                });
                feedContainer.querySelectorAll('.plugin-tag-v2').forEach(tag => {
                    const wrapper = tag.parentElement;
                    if (wrapper && tag.scrollWidth > wrapper.clientWidth + 1) {
                        const dist = (tag.scrollWidth - wrapper.clientWidth) + 30; // Extra offset for fade
                        tag.style.setProperty('--scroll-dist', `${dist}px`);
                        tag.classList.add('scroll');
                    }
                });
            }, 800); 
        }
        if (filterSoftware === 'All') {
            exploreGrid.setAttribute('data-loaded', 'true');
        }
    };

    const renderResourceCategories = (resources) => {
        const categoryContainer = document.getElementById('resource-categories');
        if (!categoryContainer) return;
        
        const activeCategory = categoryContainer.querySelector('.chip.active')?.dataset.category || 'All';
        const categories = ['All', ...new Set(resources.map(r => r.category))];
        
        categoryContainer.innerHTML = categories.map(cat => `
            <div class="chip ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</div>
        `).join('');
    };

    let allResources = [];
    const renderResources = async (query = '', filterCategory = 'All') => {
        const container = document.getElementById('resource-grid');
        if (!container) return;
        
        const res = await fetch(`${API_URL}/resources`);
        allResources = await res.json();
        
        renderResourceCategories(allResources);
        
        let filtered = allResources;
        
        if (filterCategory !== 'All') {
            filtered = filtered.filter(r => r.category === filterCategory);
        }
        
        if (query) {
            filtered = filtered.filter(r => 
                r.title.toLowerCase().includes(query.toLowerCase()) ||
                (r.category && r.category.toLowerCase().includes(query.toLowerCase())) ||
                (r.dev && r.dev.toLowerCase().includes(query.toLowerCase()))
            );
        }

        if (filtered.length > 0) {
            container.innerHTML = filtered.map((r) => {
                const iconHtml = (r.icon && (r.icon.startsWith('http') || r.icon.includes('/')))
                    ? `<img src="${r.icon}" class="resource-icon-img" alt="${r.title}">`
                    : `<span class="material-symbols-rounded resource-icon">${r.icon || 'shop'}</span>`;
                
                return `
                <div class="card resource-card" data-id="${r._id}">
                    <div class="resource-icon-wrapper">
                        ${iconHtml}
                    </div>
                    <div class="resource-info-compact">
                        <h4 class="resource-title-compact">${r.title}</h4>
                        <p class="resource-dev-compact">${r.dev || 'CHROS Team'} • ${r.category || 'App'}</p>
                        <div class="resource-meta-compact">
                            <span class="chip-mini">${r.version || 'v1.0'}</span>
                            ${r.os ? `
                            <span class="chip-mini os-chip">
                                <img src="assets/svg/${r.os.toLowerCase() === 'mac' ? 'apple' : (r.os.toLowerCase() === 'win' ? 'windows' : 'android')}.svg" class="os-icon-svg" alt="${r.os}">
                            </span>` : ''}
                            <span class="resource-info-text">${r.info || ''}</span>
                        </div>
                    </div>
                    <a href="${ensureProtocol(r.url)}" target="_blank" class="download-direct-btn">
                        <span class="btn-label">Download</span>
                        <span class="material-symbols-rounded">download</span>
                    </a>
                </div>`;
            }).join('');
            container.setAttribute('data-loaded', 'true');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">search_off</span>
                    <p>No resources found</p>
                </div>
            `;
        }
    };

    const openResourceDetails = (resource) => {
        const modal = document.getElementById('resource-modal');
        const sheet = document.getElementById('resource-sheet');
        
        // Populate modal
        const iconImg = document.getElementById('res-modal-icon');
        if (resource.icon && (resource.icon.startsWith('http') || resource.icon.includes('/'))) {
            iconImg.src = resource.icon;
            iconImg.style.display = 'block';
        } else {
            iconImg.style.display = 'none'; // Could add a fallback icon here
        }
        
        document.getElementById('res-modal-title').textContent = resource.title;
        document.getElementById('res-modal-dev').textContent = resource.dev || 'CHROS Team';
        document.getElementById('res-modal-category').textContent = resource.category || 'App';
        document.getElementById('res-modal-version').textContent = resource.version || 'v1.0';
        document.getElementById('res-modal-info').textContent = resource.info || 'N/A';
        document.getElementById('res-modal-desc').textContent = resource.desc || 'No description provided.';
        
        // Setup Download Buttons
        const downloadAction = () => {
            if (resource.url) window.open(resource.url, '_blank');
        };
        document.getElementById('res-modal-download-btn').onclick = downloadAction;
        document.getElementById('res-modal-download-btn-large').onclick = downloadAction;
        
        modal.classList.add('show');
    };

    const closeResourceBtn = document.getElementById('close-resource-modal');
    if (closeResourceBtn) {
        closeResourceBtn.onclick = () => {
            document.getElementById('resource-modal').classList.remove('show');
        };
    }

    // Close modal on overlay click
    document.getElementById('resource-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'resource-modal') {
            document.getElementById('resource-modal').classList.remove('show');
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

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'chat') {
                pollMessages();
            }
        } else {
            stopChatPolling();
        }
    });

    const initialTab = hash || 'social';
    const initialItem = document.querySelector(`.nav-item[data-tab="${initialTab}"]`);
    if (initialItem) initialItem.click();
});
