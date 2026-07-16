// ==================== 像素散开效果（跟随鼠标局部散开） ====================
class PixelDispersion {
    constructor(container, img) {
        this.container = container;
        this.img = img;
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.pixelSize = 7;
        this.radius = 70;        // 鼠标影响半径
        this.strength = 28;      // 最大散开距离
        this.mx = -9999;         // 鼠标在 canvas 上的 x
        this.my = -9999;         // 鼠标在 canvas 上的 y
        this.hovering = false;
        this.ready = false;
        this.raf = null;

        this.init();
    }

    init() {
        // 创建 canvas 覆盖层，始终可见
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        Object.assign(this.canvas.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '5'
        });

        const cs = getComputedStyle(this.container);
        if (cs.position === 'static') {
            this.container.style.position = 'relative';
        }
        this.container.appendChild(this.canvas);

        const setup = () => {
            this.setupParticles();
            this.ready = true;
            this.startLoop();
        };

        if (this.img.complete && this.img.naturalWidth > 0) {
            setup();
        } else {
            this.img.addEventListener('load', setup, { once: true });
        }

        this.container.addEventListener('mouseenter', (e) => {
            this.hovering = true;
            this.updateMouse(e);
        });
        this.container.addEventListener('mousemove', (e) => this.updateMouse(e));
        this.container.addEventListener('mouseleave', () => {
            this.hovering = false;
        });
    }

    updateMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mx = e.clientX - rect.left;
        this.my = e.clientY - rect.top;
    }

    // 处理 object-fit: cover 的裁剪参数
    getImageDrawParams() {
        const iw = this.img.naturalWidth;
        const ih = this.img.naturalHeight;
        const cw = this.container.offsetWidth;
        const ch = this.container.offsetHeight;
        const imgStyle = getComputedStyle(this.img);

        if (imgStyle.objectFit === 'cover') {
            const imgRatio = iw / ih;
            const contRatio = cw / ch;
            let sx, sy, sw, sh;
            if (imgRatio > contRatio) {
                sh = ih;
                sw = ih * contRatio;
                sx = (iw - sw) / 2;
                sy = 0;
            } else {
                sw = iw;
                sh = iw / contRatio;
                sx = 0;
                sy = (ih - sh) / 2;
            }
            return { sx, sy, sw, sh };
        }

        return { sx: 0, sy: 0, sw: iw, sh: ih };
    }

    setupParticles() {
        const w = this.container.offsetWidth;
        const h = this.container.offsetHeight;
        if (w === 0 || h === 0) return;

        this.canvas.width = w;
        this.canvas.height = h;

        const params = this.getImageDrawParams();

        // 在临时 canvas 上按实际渲染尺寸绘制图片
        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tctx = temp.getContext('2d', { willReadFrequently: true });
        tctx.drawImage(
            this.img,
            params.sx, params.sy, params.sw, params.sh,
            0, 0, w, h
        );

        // 将图片切割成像素块
        this.particles = [];
        const ps = this.pixelSize;

        for (let y = 0; y < h; y += ps) {
            for (let x = 0; x < w; x += ps) {
                const pw = Math.min(ps, w - x);
                const ph = Math.min(ps, h - y);
                const data = tctx.getImageData(x, y, pw, ph);
                this.particles.push({
                    x, y,
                    ox: x, oy: y,
                    w: pw, h: ph,
                    data,
                    // 每个粒子固定的随机散射方向和距离系数
                    angle: Math.random() * Math.PI * 2,
                    distFactor: 0.4 + Math.random() * 0.6
                });
            }
        }
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.raf = requestAnimationFrame(loop);
        };
        loop();
    }

    update() {
        if (!this.ready) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const radius = this.radius;
        const strength = this.strength;
        const mx = this.mx;
        const my = this.my;

        for (const p of this.particles) {
            const dx = p.ox - mx;
            const dy = p.oy - my;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this.hovering && dist < radius) {
                // 离鼠标越近散开越远
                const factor = 1 - dist / radius;
                const ease = factor * factor;
                p.tx = p.ox + Math.cos(p.angle) * strength * ease * p.distFactor;
                p.ty = p.oy + Math.sin(p.angle) * strength * ease * p.distFactor;
            } else {
                // 鼠标范围外的粒子回归原位
                p.tx = p.ox;
                p.ty = p.oy;
            }

            // 缓动趋近目标位置
            p.x += (p.tx - p.x) * 0.15;
            p.y += (p.ty - p.y) * 0.15;

            // 只绘制已偏离原位的粒子（原位粒子由底层图片显示）
            const displace = Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy);
            if (displace > 0.5) {
                this.ctx.putImageData(p.data, Math.round(p.x), Math.round(p.y));
            }
        }
    }
}

// ==================== 初始化 TextPressure ====================
function initTextPressure() {
    const container = document.getElementById('textPressure');
    if (!container) return;
    if (getComputedStyle(container).display === 'none') return;
    if (typeof TextPressure === 'undefined') {
        return;
    }

    new TextPressure(container, {
        text: '二极管三重唱',
        fontFamily: 'Roboto Flex',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&display=swap',
        flex: true,
        scale: false,
        alpha: true,
        stroke: false,
        width: true,
        weight: true,
        italic: true,
        textColor: 'rgba(201, 169, 110, 0.4)',
        strokeColor: '#c9a96e',
        minFontSize: 36
    });
}

// ==================== 初始化 InfiniteMenu ====================
function initInfiniteMenuBlog() {
    const container = document.getElementById('infiniteMenuContainer');
    if (!container) return;
    if (typeof initInfiniteMenu !== 'function') return;

    const menuItems = [
        {
            image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600',
            link: '#',
            title: '数字时代的阅读与思考',
            description: '在信息爆炸的时代，如何保持深度思考的能力？'
        },
        {
            image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600',
            link: '#',
            title: '构建极简的个人知识库',
            description: '知识管理不是收藏，而是连接与内化。'
        },
        {
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            link: '#',
            title: '山间漫步的哲学',
            description: '在群山之间寻找内心的平静。'
        },
        {
            image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=500',
            link: '#',
            title: '书写即生活',
            description: '用文字记录每一个值得铭记的瞬间。'
        }
    ];

    initInfiniteMenu(container, menuItems, { scale: 1.0 });
}

// ==================== 初始化像素散开效果 ====================
function initPixelEffects() {
    // 文章配图
    document.querySelectorAll('.article-image img').forEach(img => {
        const container = img.closest('.article-image');
        if (container) {
            new PixelDispersion(container, img);
        }
    });

    // 关于区域图片
    const aboutImg = document.querySelector('.about-image img');
    const aboutContainer = document.querySelector('.about-image');
    if (aboutImg && aboutContainer) {
        new PixelDispersion(aboutContainer, aboutImg);
    }
}

// ==================== 视频探照灯效果 ====================
(function initSpotlight() {
    const overlay = document.querySelector('.bg-video-overlay');
    if (!overlay) return;

    // 默认位置：屏幕中心
    overlay.style.setProperty('--spotlight-x', '50%');
    overlay.style.setProperty('--spotlight-y', '50%');

    document.addEventListener('mousemove', function (e) {
        overlay.style.setProperty('--spotlight-x', e.clientX + 'px');
        overlay.style.setProperty('--spotlight-y', e.clientY + 'px');
    });

    // 移动端触摸支持
    document.addEventListener('touchmove', function (e) {
        const touch = e.touches[0];
        overlay.style.setProperty('--spotlight-x', touch.clientX + 'px');
        overlay.style.setProperty('--spotlight-y', touch.clientY + 'px');
    }, { passive: true });
})();

// ==================== 文章数据 ====================
// Set this to true when article images should be shown again.
var ARTICLES_SHOW_IMAGES = false;

function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char];
    });
}

var ARTICLE_ROUTE_PARAM = 'article';
var DEFAULT_DOCUMENT_TITLE = document.title;
var DEFAULT_META_DESCRIPTION_NODE = document.querySelector('meta[name="description"]');
var DEFAULT_META_DESCRIPTION = DEFAULT_META_DESCRIPTION_NODE ? DEFAULT_META_DESCRIPTION_NODE.getAttribute('content') || '' : '';
var DEFAULT_OG_TITLE_NODE = document.querySelector('meta[property="og:title"]');
var DEFAULT_OG_DESCRIPTION_NODE = document.querySelector('meta[property="og:description"]');
var DEFAULT_OG_TITLE = DEFAULT_OG_TITLE_NODE ? DEFAULT_OG_TITLE_NODE.getAttribute('content') || DEFAULT_DOCUMENT_TITLE : DEFAULT_DOCUMENT_TITLE;
var DEFAULT_OG_DESCRIPTION = DEFAULT_OG_DESCRIPTION_NODE ? DEFAULT_OG_DESCRIPTION_NODE.getAttribute('content') || DEFAULT_META_DESCRIPTION : DEFAULT_META_DESCRIPTION;

function normalizeArticleSlug(value, fallback) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw && fallback != null) raw = String(fallback).trim();
    if (!raw) return '';
    if (raw.normalize) raw = raw.normalize('NFKD');
    var slug = raw.toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
        .replace(/^-+|-+$/g, '');
    if (slug) return slug;
    return fallback != null ? 'article-' + String(fallback).trim() : '';
}

function getBasePagePath() {
    var path = window.location.pathname || '/';
    var articleIndex = path.indexOf('/article/');
    if (articleIndex !== -1) {
        return path.slice(0, articleIndex + 1) || '/';
    }
    return path;
}

function getArticleRouteKey(article) {
    if (!article) return '';
    return article.slug || normalizeArticleSlug(article.id, article.title || 'article');
}

function getArticlePermalink(article) {
    var url = new URL(window.location.href);
    url.pathname = getBasePagePath();
    url.searchParams.set(ARTICLE_ROUTE_PARAM, getArticleRouteKey(article));
    url.hash = '';
    return url.pathname + url.search + url.hash;
}

function getUrlWithoutArticleRoute() {
    var url = new URL(window.location.href);
    url.pathname = getBasePagePath();
    url.searchParams.delete(ARTICLE_ROUTE_PARAM);
    return url.pathname + url.search + url.hash;
}

function setMetaContent(selector, attrName, attrValue, content) {
    var node = document.querySelector(selector);
    if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attrName, attrValue);
        document.head.appendChild(node);
    }
    node.setAttribute('content', content || '');
}

function updateCanonicalUrl(article) {
    var node = document.querySelector('link[rel="canonical"]');
    if (!node) {
        node = document.createElement('link');
        node.setAttribute('rel', 'canonical');
        document.head.appendChild(node);
    }
    var href = article ? getArticlePermalink(article) : getUrlWithoutArticleRoute();
    node.setAttribute('href', new URL(href, window.location.href).href);
}

function updateDocumentArticleMeta(article) {
    if (!article) {
        document.title = DEFAULT_DOCUMENT_TITLE;
        setMetaContent('meta[name="description"]', 'name', 'description', DEFAULT_META_DESCRIPTION);
        setMetaContent('meta[property="og:title"]', 'property', 'og:title', DEFAULT_OG_TITLE);
        setMetaContent('meta[property="og:description"]', 'property', 'og:description', DEFAULT_OG_DESCRIPTION);
        updateCanonicalUrl(null);
        return;
    }

    var title = article.title || DEFAULT_DOCUMENT_TITLE;
    var description = article.excerpt || article.content && article.content[0] || title;
    document.title = title + ' | ' + DEFAULT_DOCUMENT_TITLE;
    setMetaContent('meta[name="description"]', 'name', 'description', description);
    setMetaContent('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaContent('meta[property="og:description"]', 'property', 'og:description', description);
    updateCanonicalUrl(article);
}

function pushArticleRoute(article, replace) {
    if (!window.history || !window.history.pushState || !article) return;
    var nextUrl = getArticlePermalink(article);
    var currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (nextUrl === currentUrl) return;
    var state = { article: getArticleRouteKey(article) };
    if (replace) {
        window.history.replaceState(state, '', nextUrl);
    } else {
        window.history.pushState(state, '', nextUrl);
    }
}

function clearArticleRoute() {
    if (!window.history || !window.history.replaceState) return;
    var nextUrl = getUrlWithoutArticleRoute();
    var currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (nextUrl === currentUrl) return;
    window.history.replaceState({ article: null }, '', nextUrl);
}

var BLOG_COMPANION_STORAGE_KEY = window.BLOG_COMPANION_STORAGE_KEY || 'blogCompanionArticles.v1';
var BLOG_COMPANION_CHANNEL_NAME = window.BLOG_COMPANION_CHANNEL_NAME || 'blog-companion-articles';
var BLOG_COMPANION_OWNER_SESSION_KEY = 'blogCompanionOwnerSession.v1';
var BLOG_COMPANION_OWNER_HASH = 'cfdbb37f33c79d68f9091c87161191c885e26ee940392cd2a68527e275924462';

function hasCompanionOwnerSession() {
    try {
        return localStorage.getItem(BLOG_COMPANION_OWNER_SESSION_KEY) === BLOG_COMPANION_OWNER_HASH;
    } catch (e) {
        return false;
    }
}

function readCompanionArticles() {
    if (!hasCompanionOwnerSession()) return null;
    try {
        var raw = localStorage.getItem(BLOG_COMPANION_STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        console.warn('readCompanionArticles failed:', e);
        return null;
    }
}

function getCurrentArticleSource() {
    var companionArticles = readCompanionArticles();
    return companionArticles || window.BLOG_ARTICLES || [];
}

function initPublicContentProtection() {
    document.documentElement.classList.add('content-protected');

    var noticeTimer = null;
    function showProtectionNotice(message) {
        var notice = document.getElementById('contentProtectionNotice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'contentProtectionNotice';
            notice.className = 'content-protection-notice';
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-live', 'polite');
            document.body.appendChild(notice);
        }
        notice.textContent = message || '本站内容与视觉设计受版权保护，请勿未经授权复制或抓取。';
        notice.classList.add('active');
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(function() {
            notice.classList.remove('active');
        }, 2200);
    }

    function blockInteraction(event, message) {
        event.preventDefault();
        event.stopPropagation();
        showProtectionNotice(message);
        return false;
    }

    function blockContextMenu(event) {
        return blockInteraction(event, '本站内容与视觉设计受版权保护。');
    }

    window.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('contextmenu', blockContextMenu, true);
    document.oncontextmenu = blockContextMenu;

    document.addEventListener('selectstart', function(event) {
        if (event.target && event.target.closest && event.target.closest('input, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
    }, true);

    ['copy', 'cut', 'dragstart'].forEach(function(type) {
        document.addEventListener(type, function(event) {
            return blockInteraction(event, '请勿未经授权复制本站内容。');
        }, true);
    });

    document.addEventListener('keydown', function(event) {
        var key = String(event.key || '').toLowerCase();
        var combo = event.ctrlKey || event.metaKey;
        var blocked =
            event.key === 'F12' ||
            (combo && event.shiftKey && ['i', 'j', 'c'].indexOf(key) !== -1) ||
            (combo && ['u', 's', 'p'].indexOf(key) !== -1);

        if (!blocked) return;
        return blockInteraction(event, '该操作已关闭。本站创意与内容受版权保护。');
    }, true);

    if (window.console && console.info) {
        console.info('© 2026 二极管三重唱。本站内容、视觉设计与交互创意保留所有权利。');
    }
}

function findArticleById(id) {
    var key = String(id);
    return articlesData.find(function(article) {
        return String(article.id) === key;
    }) || null;
}

function getArticleRouteValueFromLocation() {
    var params = new URLSearchParams(window.location.search);
    var value = params.get(ARTICLE_ROUTE_PARAM);
    if (value) return value;

    var match = (window.location.pathname || '').match(/\/article\/([^\/?#]+)/);
    if (!match) return '';
    try {
        return decodeURIComponent(match[1]);
    } catch (e) {
        return match[1];
    }
}

function findArticleByRouteValue(value) {
    var key = normalizeArticleSlug(value, null);
    if (!key) return null;
    return getPublishedArticlesData().find(function(article) {
        var idKey = normalizeArticleSlug(article.id, null);
        return normalizeArticleSlug(article.slug, null) === key ||
            idKey === key ||
            (idKey && key.slice(-(idKey.length + 1)) === '-' + idKey);
    }) || null;
}

function syncBookReaderWithRoute() {
    var article = findArticleByRouteValue(getArticleRouteValueFromLocation());
    if (article) {
        openBookReader(article, { updateUrl: false });
        return;
    }

    if (currentBookArticle) {
        closeBookReader({ updateUrl: false });
    } else {
        updateDocumentArticleMeta(null);
    }
}

function initArticleRoutes() {
    syncBookReaderWithRoute();
    window.addEventListener('popstate', syncBookReaderWithRoute);
}

function refreshArticlesFromCompanion() {
    articlesData = normalizeArticleData(getCurrentArticleSource());
    renderArticleCards();

    if (!currentBookArticle) {
        syncBookReaderWithRoute();
        return;
    }
    var nextArticle = findArticleById(currentBookArticle.id);
    if (!nextArticle || nextArticle.published === false) {
        closeBookReader();
        return;
    }

    currentBookArticle = nextArticle;
    currentBookPageIndex = 0;
    updateBookReaderMeta(nextArticle);
    updateDocumentArticleMeta(nextArticle);
    renderBookContent(nextArticle);
}

function initCompanionArticleSync() {
    window.addEventListener('storage', function(event) {
        if (event.key === BLOG_COMPANION_STORAGE_KEY) {
            refreshArticlesFromCompanion();
        }
    });

    if ('BroadcastChannel' in window) {
        var channel = new BroadcastChannel(BLOG_COMPANION_CHANNEL_NAME);
        channel.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'articles-updated') {
                refreshArticlesFromCompanion();
            }
        });
    }
}

function normalizeArticleBlocks(blocks, content) {
    var normalizedContent = Array.isArray(content) ? content : [];
    var sourceBlocks = Array.isArray(blocks) && blocks.length
        ? blocks
        : normalizedContent.map(function(line, index) {
            return {
                id: 'legacy-' + index,
                type: 'text',
                title: index === 0 ? '正文' : '段落 ' + (index + 1),
                body: line,
                span: 'full'
            };
        });

    return sourceBlocks.map(function(block, index) {
        block = block || {};
        var type = ['text', 'image', 'video', 'template'].indexOf(block.type) !== -1 ? block.type : 'text';
        var defaultSpan = type === 'image' || type === 'template' ? 'half' : 'full';
        return {
            id: String(block.id || ('block-' + index)),
            type: type,
            title: String(block.title || ''),
            body: String(block.body || ''),
            src: String(block.src || ''),
            caption: String(block.caption || ''),
            span: ['full', 'half', 'third'].indexOf(block.span) !== -1 ? block.span : defaultSpan
        };
    });
}

function splitReaderLines(value) {
    return String(value || '').split(/\r?\n/).map(function(line) {
        return line.trim();
    }).filter(Boolean);
}

function getArticleTextLinesFromBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).reduce(function(lines, block) {
        if (!block) return lines;
        if (block.type === 'text') return lines.concat(splitReaderLines(block.body));
        if (block.type === 'template') {
            var templateLines = [];
            if (block.title) templateLines.push(block.title);
            return lines.concat(templateLines, splitReaderLines(block.body));
        }
        return lines.concat(splitReaderLines(block.caption));
    }, []);
}

function getArticleReaderTextLinesFromBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).reduce(function(lines, block) {
        if (!block) return lines;
        if (block.type === 'text') return lines.concat(splitReaderLines(block.body));
        if (block.type === 'template') {
            var templateLines = [];
            if (block.title) templateLines.push(block.title);
            return lines.concat(templateLines, splitReaderLines(block.body));
        }
        return lines;
    }, []);
}

function normalizeArticleData(source) {
    var list = Array.isArray(source) ? source : [];
    return list.map(function(article, index) {
        article = article || {};
        var articleId = article.id || (index + 1);
        var explicitSlug = normalizeArticleSlug(article.slug, null);
        var titleSlug = normalizeArticleSlug(article.title, null);
        var idSlug = normalizeArticleSlug(articleId, articleId);
        var routeSlug = explicitSlug || (titleSlug && idSlug ? titleSlug + '-' + idSlug : idSlug);
        var content = Array.isArray(article.content)
            ? article.content
            : String(article.content || '').split(/\r?\n/);
        var normalizedContent = content.map(function(line) {
            return String(line || '');
        }).filter(function(line) {
            return line.trim().length > 0;
        });
        var blocks = normalizeArticleBlocks(article.blocks, normalizedContent);
        var blockContent = getArticleTextLinesFromBlocks(blocks);

        return {
            id: articleId,
            slug: routeSlug,
            published: article.published !== false,
            category: String(article.category || ''),
            title: String(article.title || ''),
            date: String(article.date || ''),
            excerpt: String(article.excerpt || ''),
            image: String(article.image || ''),
            blocks: blocks,
            content: blockContent.length ? blockContent : normalizedContent
        };
    }).filter(function(article) {
        return article.title || article.excerpt || article.content.length || article.blocks.length;
    });
}

function shouldShowArticleImage(article) {
    return ARTICLES_SHOW_IMAGES && article && article.image;
}

function renderArticleCoverArt(article) {
    if (!shouldShowArticleImage(article)) return '';
    var image = escapeHTML(article.image);
    var title = escapeHTML(article.title);
    return '<div class="cover-art">' +
        '<img src="' + image + '" alt="' + title + '" loading="lazy">' +
    '</div>';
}

var articlesData = normalizeArticleData(getCurrentArticleSource());

function getPublishedArticlesData() {
    return articlesData.filter(function(article) {
        return article && article.published !== false;
    });
}

// ==================== 渲染文章卡片 ====================
function renderArticleCards() {
    var grid = document.getElementById('articlesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var visibleArticles = getPublishedArticlesData();
    if (!visibleArticles.length) {
        grid.innerHTML = '<p class="articles-empty">暂无上架文章。</p>';
        return;
    }

    visibleArticles.forEach(function(article, index) {
        var card = document.createElement('a');
        var styleIndex = (index % 6) + 1;
        card.className = 'article-card cover-style-' + styleIndex + (shouldShowArticleImage(article) ? '' : ' no-cover-image');
        card.setAttribute('data-id', article.id);
        card.setAttribute('data-slug', article.slug);
        card.setAttribute('aria-label', article.title);
        card.href = getArticlePermalink(article);
        card.innerHTML =
            '<div class="book-cover">' +
                renderArticleCoverArt(article) +
                '<span class="cover-category">' + escapeHTML(article.category) + '</span>' +
                '<h3 class="cover-title">' + escapeHTML(article.title) + '</h3>' +
                '<p class="cover-excerpt">' + escapeHTML(article.excerpt) + '</p>' +
                '<span class="cover-date">' + escapeHTML(article.date) + '</span>' +
                '<span class="cover-spine">' + escapeHTML(article.category) + '</span>' +
            '</div>' +
            '<div class="card-body" aria-hidden="true">' +
                '<span class="card-category">' + escapeHTML(article.category) + '</span>' +
                '<h3 class="card-title">' + escapeHTML(article.title) + '</h3>' +
                '<p class="card-excerpt">' + escapeHTML(article.excerpt) + '</p>' +
                '<span class="card-date">' + escapeHTML(article.date) + '</span>' +
            '</div>';

        card.addEventListener('click', function(event) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            openBookReader(article, { updateUrl: true });
        });

        grid.appendChild(card);
        if (document.readyState !== 'loading') {
            requestAnimationFrame(function() {
                card.classList.add('visible');
            });
        }
    });
}

// ==================== 书籍阅读器 ====================
var BOOK_READER_FONT_KEY = 'bookReaderFont';
var BOOK_READER_FONT_OPTIONS = ['mao', 'serif', 'pixel', 'fun'];
var BOOK_READER_WRITING_KEY = 'bookReaderWriting';
var BOOK_READER_WRITING_OPTIONS = ['vertical', 'horizontal'];
var currentBookArticle = null;
var currentBookPageIndex = 0;
var currentBookPages = [];

function getSavedBookReaderFont() {
    try {
        var savedFont = localStorage.getItem(BOOK_READER_FONT_KEY);
        return BOOK_READER_FONT_OPTIONS.indexOf(savedFont) !== -1 ? savedFont : 'mao';
    } catch (e) {
        return 'mao';
    }
}

function applyBookReaderFont(fontKey) {
    var overlay = document.getElementById('bookReader');
    var currentFont = BOOK_READER_FONT_OPTIONS.indexOf(fontKey) !== -1 ? fontKey : 'mao';
    var buttons = document.querySelectorAll('[data-reader-font]');

    if (overlay) {
        BOOK_READER_FONT_OPTIONS.forEach(function(option) {
            overlay.classList.remove('reader-font-' + option);
        });
        overlay.classList.add('reader-font-' + currentFont);
    }

    buttons.forEach(function(button) {
        button.classList.toggle('active', button.getAttribute('data-reader-font') === currentFont);
    });

    try {
        localStorage.setItem(BOOK_READER_FONT_KEY, currentFont);
    } catch (e) {}
}

function getSavedBookReaderWriting() {
    try {
        var savedWriting = localStorage.getItem(BOOK_READER_WRITING_KEY);
        return BOOK_READER_WRITING_OPTIONS.indexOf(savedWriting) !== -1 ? savedWriting : 'vertical';
    } catch (e) {
        return 'vertical';
    }
}

function getCurrentBookReaderWriting() {
    var overlay = document.getElementById('bookReader');
    if (overlay && overlay.classList.contains('reader-writing-horizontal')) {
        return 'horizontal';
    }
    return 'vertical';
}

function applyBookReaderWriting(writingMode) {
    var overlay = document.getElementById('bookReader');
    var currentWriting = BOOK_READER_WRITING_OPTIONS.indexOf(writingMode) !== -1 ? writingMode : 'vertical';
    var buttons = document.querySelectorAll('[data-reader-writing]');

    if (overlay) {
        BOOK_READER_WRITING_OPTIONS.forEach(function(option) {
            overlay.classList.remove('reader-writing-' + option);
        });
        overlay.classList.add('reader-writing-' + currentWriting);
    }

    buttons.forEach(function(button) {
        button.classList.toggle('active', button.getAttribute('data-reader-writing') === currentWriting);
    });

    try {
        localStorage.setItem(BOOK_READER_WRITING_KEY, currentWriting);
    } catch (e) {}
}

function formatVerticalText(text) {
    var quoteOpen = true;
    var singleQuoteOpen = true;
    var punctuationMap = {
        '，': '︐',
        ',': '︐',
        '、': '︑',
        '。': '︒',
        '.': '︒',
        '：': '︓',
        ':': '︓',
        '；': '︔',
        ';': '︔',
        '！': '︕',
        '!': '︕',
        '？': '︖',
        '?': '︖',
        '（': '︵',
        '(': '︵',
        '）': '︶',
        ')': '︶',
        '《': '︽',
        '》': '︾',
        '〈': '︿',
        '〉': '﹀',
        '「': '﹁',
        '」': '﹂',
        '『': '﹃',
        '』': '﹄',
        '【': '︻',
        '】': '︼',
        '——': '︱︱',
        '—': '︱',
        '……': '︙︙',
        '…': '︙'
    };

    return String(text || '')
        .replace(/——/g, punctuationMap['——'])
        .replace(/……/g, punctuationMap['……'])
        .split('')
        .map(function(char) {
            if (char === '"' || char === '“' || char === '”') {
                var quote = quoteOpen ? '﹃' : '﹄';
                quoteOpen = !quoteOpen;
                return quote;
            }
            if (char === "'" || char === '‘' || char === '’') {
                var singleQuote = singleQuoteOpen ? '﹁' : '﹂';
                singleQuoteOpen = !singleQuoteOpen;
                return singleQuote;
            }
            return punctuationMap[char] || char;
        })
        .join('');
}

function getArticleReaderLines(article) {
    if (!article) return [];
    if (Array.isArray(article.blocks) && article.blocks.length) {
        var blockLines = getArticleReaderTextLinesFromBlocks(article.blocks);
        if (blockLines.length) return blockLines;
    }
    return Array.isArray(article.content) ? article.content : [];
}

function hasRichReaderBlocks(article) {
    return !!(article && Array.isArray(article.blocks) && article.blocks.some(function(block) {
        return block && (block.type === 'image' || block.type === 'video' || block.type === 'template');
    }));
}

function appendReaderParagraphs(target, text) {
    splitReaderLines(text).forEach(function(line) {
        var p = document.createElement('p');
        p.textContent = line;
        target.appendChild(p);
    });
}

function appendReaderRichBlock(target, block) {
    var wrap = document.createElement('section');
    wrap.className = 'reader-rich-block reader-rich-' + block.type;

    if (block.type === 'text') {
        appendReaderParagraphs(wrap, block.body);
    }

    if (block.type === 'template') {
        if (block.title) {
            var heading = document.createElement('h3');
            heading.textContent = block.title;
            wrap.appendChild(heading);
        }
        appendReaderParagraphs(wrap, block.body);
    }

    if ((block.type === 'image' || block.type === 'video') && block.src) {
        var figure = document.createElement('figure');
        var media = document.createElement(block.type === 'video' ? 'video' : 'img');
        media.src = block.src;
        if (block.type === 'video') {
            media.controls = true;
            media.muted = true;
            media.preload = 'none';
        } else {
            media.alt = block.caption || block.title || '';
            media.loading = 'lazy';
        }
        figure.appendChild(media);
        if (block.caption || block.title) {
            var caption = document.createElement('figcaption');
            caption.textContent = block.caption || block.title;
            figure.appendChild(caption);
        }
        wrap.appendChild(figure);
    }

    if (wrap.children.length) {
        target.appendChild(wrap);
    }
}

function getReaderTextLinesForBlock(block) {
    if (!block) return [];
    if (block.type === 'text') return splitReaderLines(block.body);
    if (block.type === 'template') {
        var templateLines = [];
        if (block.title) templateLines.push(block.title);
        return templateLines.concat(splitReaderLines(block.body));
    }
    return [];
}

function appendReaderVerticalSegment(lines, target) {
    if (!lines.length) return;
    var segment = document.createElement('div');
    segment.className = 'reader-flow-segment reader-text-segment';
    lines.forEach(function(line) {
        var col = document.createElement('div');
        col.className = 'vertical-col';
        var p = document.createElement('p');
        p.textContent = formatVerticalText(line);
        col.appendChild(p);
        segment.appendChild(col);
    });
    target.appendChild(segment);
}

function chunkReaderItems(items, size) {
    var chunks = [];
    var chunkSize = Math.max(1, size || 1);
    for (var i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

function getReaderTextLinesPerPage(isVertical) {
    var width = window.innerWidth || document.documentElement.clientWidth || 1200;
    if (!isVertical) return width <= 768 ? 4 : 5;
    if (width <= 768) return 3;
    if (width <= 1100) return 5;
    return 6;
}

function pushReaderTextPages(pages, lines, isVertical) {
    chunkReaderItems(lines, getReaderTextLinesPerPage(isVertical)).forEach(function(chunk) {
        if (chunk.length) {
            pages.push([{ type: 'text', lines: chunk }]);
        }
    });
}

function getReaderMediaWeight(block) {
    var span = getReaderMediaSpan(block);
    if (span === 'third') return 1 / 3;
    if (span === 'half') return 1 / 2;
    return 1;
}

function canAppendReaderMedia(pageUnits, block) {
    var used = 0;
    var hasFullMedia = false;
    pageUnits.forEach(function(unit) {
        if (!unit || unit.type !== 'rich' || !unit.block || (unit.block.type !== 'image' && unit.block.type !== 'video')) return;
        var weight = getReaderMediaWeight(unit.block);
        used += weight;
        if (weight >= 1) hasFullMedia = true;
    });
    var nextWeight = getReaderMediaWeight(block);
    if (hasFullMedia || nextWeight >= 1) return used === 0;
    return used + nextWeight <= 1.01;
}

function buildBookReaderPages(article) {
    var isVertical = getCurrentBookReaderWriting() === 'vertical';
    var pages = [];

    if (hasRichReaderBlocks(article)) {
        var pendingTextLines = [];
        var openMediaPage = null;
        function flushTextPages(keepLastChunk) {
            var chunks = chunkReaderItems(pendingTextLines, getReaderTextLinesPerPage(isVertical));
            var lastIndex = keepLastChunk && chunks.length ? chunks.length - 1 : chunks.length;
            var keptPage = [];
            chunks.slice(0, lastIndex).forEach(function(chunk) {
                if (chunk.length) pages.push([{ type: 'text', lines: chunk }]);
            });
            if (keepLastChunk && chunks.length) {
                keptPage.push({ type: 'text', lines: chunks[chunks.length - 1] });
            }
            pendingTextLines = [];
            return keptPage;
        }

        article.blocks.forEach(function(block) {
            if (!block) return;
            if (block.type === 'image' || block.type === 'video') {
                var mediaPage = flushTextPages(true);
                if (mediaPage.length) {
                    pages.push(mediaPage);
                    openMediaPage = mediaPage;
                }
                if (block.src) {
                    if (!openMediaPage || !canAppendReaderMedia(openMediaPage, block)) {
                        openMediaPage = [];
                        pages.push(openMediaPage);
                    }
                    openMediaPage.push({ type: 'rich', block: block });
                }
                return;
            }
            openMediaPage = null;
            pendingTextLines = pendingTextLines.concat(getReaderTextLinesForBlock(block));
        });
        flushTextPages(false);
    } else {
        pushReaderTextPages(pages, getArticleReaderLines(article), isVertical);
    }

    return pages.length ? pages : [[{ type: 'text', lines: ['暂无正文'] }]];
}

function updateBookReaderNav() {
    var prev = document.getElementById('bookPrev');
    var next = document.getElementById('bookNext');
    var progress = document.getElementById('bookProgress');
    var pageNumber = document.querySelector('.book-page-number.right-num');
    var total = currentBookPages.length || 1;
    var page = Math.min(currentBookPageIndex + 1, total);
    var visiblePageNumber = shouldShowArticleImage(currentBookArticle) ? page + 1 : page;

    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= total;
    if (progress) progress.textContent = page + ' / ' + total;
    if (pageNumber) pageNumber.textContent = String(visiblePageNumber).padStart(2, '0');
}

function getReaderMediaSpan(block) {
    var span = block && block.span;
    return span === 'full' || span === 'half' || span === 'third' ? span : 'half';
}

function appendReaderMediaSegment(block, target) {
    if (!block || !block.src) return;
    var segment = document.createElement('div');
    segment.className = 'reader-flow-segment reader-media-segment media-span-' + getReaderMediaSpan(block);
    var figure = document.createElement('figure');
    var media = document.createElement(block.type === 'video' ? 'video' : 'img');
    media.src = block.src;
    if (block.type === 'video') {
        media.controls = true;
        media.muted = true;
        media.preload = 'none';
    } else {
        media.alt = block.caption || block.title || '';
        media.loading = 'lazy';
    }
    figure.appendChild(media);
    if (block.caption || block.title) {
        var caption = document.createElement('figcaption');
        caption.textContent = block.caption || block.title;
        figure.appendChild(caption);
    }
    segment.appendChild(figure);
    target.appendChild(segment);
}

function getReaderMediaStackSpan(units) {
    var rank = { third: 1, half: 2, full: 3 };
    var span = 'third';
    units.forEach(function(unit) {
        var unitSpan = getReaderMediaSpan(unit && unit.block);
        if (rank[unitSpan] > rank[span]) span = unitSpan;
    });
    return span;
}

function appendReaderMediaStack(units, target) {
    if (!units.length) return;
    var stack = document.createElement('div');
    var countClass = units.length >= 3 ? ' stack-count-many' : ' stack-count-' + units.length;
    stack.className = 'reader-flow-segment reader-media-stack media-span-' + getReaderMediaStackSpan(units) + countClass;
    units.forEach(function(unit) {
        appendReaderMediaSegment(unit.block, stack);
    });
    if (stack.children.length) target.appendChild(stack);
}

function renderReaderPageUnit(unit, target, isVertical) {
    if (!unit) return;
    if (unit.type === 'rich') {
        if (isVertical && (unit.block.type === 'image' || unit.block.type === 'video')) {
            appendReaderMediaSegment(unit.block, target);
        } else {
            appendReaderRichBlock(target, unit.block);
        }
        return;
    }
    if (isVertical) {
        appendReaderVerticalSegment(unit.lines || [], target);
        return;
    }
    (unit.lines || []).forEach(function(line) {
        var p = document.createElement('p');
        p.textContent = line;
        target.appendChild(p);
    });
}

function isReaderMediaUnit(unit) {
    return !!(unit && unit.type === 'rich' && unit.block && (unit.block.type === 'image' || unit.block.type === 'video'));
}

function renderReaderPageUnits(pageUnits, target, isVertical) {
    if (!isVertical) {
        pageUnits.forEach(function(unit) {
            renderReaderPageUnit(unit, target, false);
        });
        return;
    }

    var mediaUnits = [];
    function flushMediaUnits() {
        if (!mediaUnits.length) return;
        if (mediaUnits.length === 1) {
            renderReaderPageUnit(mediaUnits[0], target, true);
        } else {
            appendReaderMediaStack(mediaUnits, target);
        }
        mediaUnits = [];
    }

    pageUnits.forEach(function(unit) {
        if (isReaderMediaUnit(unit)) {
            mediaUnits.push(unit);
            return;
        }
        flushMediaUnits();
        renderReaderPageUnit(unit, target, true);
    });
    flushMediaUnits();
}

function renderBookContent(article) {
    var bookContent = document.getElementById('bookContent');
    if (!bookContent || !article) return;

    var isVertical = getCurrentBookReaderWriting() === 'vertical';
    currentBookPages = buildBookReaderPages(article);
    currentBookPageIndex = Math.max(0, Math.min(currentBookPageIndex, currentBookPages.length - 1));
    var pageUnits = currentBookPages[currentBookPageIndex] || [];
    bookContent.innerHTML = '';
    bookContent.classList.toggle('has-media-page', pageUnits.some(function(unit) {
        return unit.type === 'rich' && unit.block && (unit.block.type === 'image' || unit.block.type === 'video');
    }));

    if (!isVertical) {
        var horizontalCol = document.createElement('div');
        horizontalCol.className = 'horizontal-col';
        renderReaderPageUnits(pageUnits, horizontalCol, false);
        bookContent.appendChild(horizontalCol);
        updateBookReaderNav();
        return;
    }

    renderReaderPageUnits(pageUnits, bookContent, true);
    updateBookReaderNav();
}

function goToBookPage(delta) {
    if (!currentBookArticle || !currentBookPages.length) return;
    var nextIndex = currentBookPageIndex + delta;
    if (nextIndex < 0 || nextIndex >= currentBookPages.length) return;
    currentBookPageIndex = nextIndex;
    renderBookContent(currentBookArticle);
}

function updateBookReaderMeta(article) {
    var overlay = document.getElementById('bookReader');
    var bookLeftImg = document.getElementById('bookLeftImg');
    var bookCategory = document.getElementById('bookCategory');
    var bookDate = document.getElementById('bookDate');
    var bookTitle = document.getElementById('bookTitle');

    if (overlay) {
        overlay.classList.toggle('reader-no-images', !shouldShowArticleImage(article));
    }
    if (bookLeftImg) {
        if (shouldShowArticleImage(article)) {
            bookLeftImg.src = article.image;
            bookLeftImg.alt = article.title;
        } else {
            bookLeftImg.removeAttribute('src');
            bookLeftImg.alt = '';
        }
    }
    if (bookCategory) bookCategory.textContent = article.category;
    if (bookDate) bookDate.textContent = article.date;
    if (bookTitle) bookTitle.textContent = article.title;
}

function openBookReader(article, options) {
    options = options || {};
    var overlay = document.getElementById('bookReader');

    if (!overlay) return;
    currentBookArticle = article;
    currentBookPageIndex = 0;
    applyBookReaderFont(getSavedBookReaderFont());
    applyBookReaderWriting(getSavedBookReaderWriting());
    updateBookReaderMeta(article);
    updateDocumentArticleMeta(article);
    renderBookContent(article);

    // 显示并做入场动画
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (options.updateUrl) {
        pushArticleRoute(article, !!options.replaceUrl);
    }
}

function closeBookReader(options) {
    options = options || {};
    var overlay = document.getElementById('bookReader');
    if (!overlay) return;
    overlay.classList.remove('active');
    currentBookArticle = null;
    document.body.style.overflow = '';
    updateDocumentArticleMeta(null);

    if (options.updateUrl !== false) {
        clearArticleRoute();
    }
}

// ==================== 初始化书籍阅读器事件 ====================
function initBookReader() {
    var closeBtn = document.getElementById('bookClose');
    var overlay = document.getElementById('bookReader');
    var fontToolbar = document.getElementById('bookFontToolbar');
    var prevBtn = document.getElementById('bookPrev');
    var nextBtn = document.getElementById('bookNext');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeBookReader);
    }

    if (fontToolbar) {
        applyBookReaderFont(getSavedBookReaderFont());
        applyBookReaderWriting(getSavedBookReaderWriting());
        fontToolbar.addEventListener('click', function(e) {
            e.stopPropagation();
            var fontTarget = e.target.closest('[data-reader-font]');
            if (fontTarget) {
                applyBookReaderFont(fontTarget.getAttribute('data-reader-font'));
                if (currentBookArticle) {
                    currentBookPageIndex = 0;
                    renderBookContent(currentBookArticle);
                }
                return;
            }

            var writingTarget = e.target.closest('[data-reader-writing]');
            if (!writingTarget) return;
            applyBookReaderWriting(writingTarget.getAttribute('data-reader-writing'));
            if (currentBookArticle) {
                currentBookPageIndex = 0;
                renderBookContent(currentBookArticle);
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            goToBookPage(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            goToBookPage(1);
        });
    }

    // 点击背景关闭
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeBookReader();
            }
        });
    }

    // ESC 关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
            closeBookReader();
        }
        if (!overlay || !overlay.classList.contains('active')) return;
        if (e.key === 'ArrowLeft') goToBookPage(1);
        if (e.key === 'ArrowRight') goToBookPage(-1);
    });

    window.addEventListener('resize', function() {
        if (!overlay || !overlay.classList.contains('active') || !currentBookArticle) return;
        renderBookContent(currentBookArticle);
    });
}

// ==================== 关于区 GIF 气泡 ====================
function initAboutGifMonitor() {
    var aboutImage = document.querySelector('.about-image');
    var aboutContent = document.querySelector('.about-content');
    var gifMonitor = document.getElementById('aboutGifMonitor');
    if (!aboutImage || !aboutContent || !gifMonitor) return;

    aboutImage.style.cursor = 'pointer';

    var openScrollY = 0;

    function closeBubble(immediate) {
        if (immediate) {
            gifMonitor.classList.add('closing');
            gifMonitor.classList.remove('active');
            window.setTimeout(function() {
                gifMonitor.classList.remove('closing');
            }, 80);
            return;
        }
        gifMonitor.classList.remove('active');
    }

    function isImageVisible() {
        var imageRect = aboutImage.getBoundingClientRect();
        var visibleX = Math.min(imageRect.right, window.innerWidth) - Math.max(imageRect.left, 0);
        var visibleY = Math.min(imageRect.bottom, window.innerHeight) - Math.max(imageRect.top, 0);
        return visibleX > 80 && visibleY > Math.min(imageRect.height * 0.2, 100);
    }

    function positionBubble() {
        var imageRect = aboutImage.getBoundingClientRect();
        var contentRect = aboutContent.getBoundingClientRect();
        var bubbleW = Math.min(Math.max(imageRect.width * 0.55, 180), 320, window.innerWidth * 0.46);
        var bubbleH = bubbleW * 0.75;
        var left = imageRect.right - contentRect.left - bubbleW * 0.42;
        var top = imageRect.top - contentRect.top - bubbleH - 10;
        var minLeft = -contentRect.left + 8;
        var maxLeft = window.innerWidth - contentRect.left - bubbleW - 8;
        var minTop = 8 - contentRect.top;
        var maxTop = window.innerHeight - contentRect.top - bubbleH - 8;

        left = Math.max(minLeft, Math.min(left, maxLeft));
        top = Math.max(minTop, Math.min(top, maxTop, contentRect.height - bubbleH));

        gifMonitor.style.width = bubbleW + 'px';
        gifMonitor.style.height = bubbleH + 'px';
        gifMonitor.style.left = left + 'px';
        gifMonitor.style.top = top + 'px';
    }

    aboutImage.addEventListener('click', function(e) {
        e.stopPropagation();
        if (gifMonitor.classList.contains('active')) {
            closeBubble();
            return;
        }
        gifMonitor.classList.remove('closing');
        positionBubble();
        openScrollY = window.scrollY;
        gifMonitor.classList.add('active');
    });

    gifMonitor.addEventListener('click', function(e) {
        e.stopPropagation();
        closeBubble();
    });

    document.addEventListener('click', function() {
        closeBubble();
    });

    window.addEventListener('resize', function() {
        if (!gifMonitor.classList.contains('active')) return;
        if (!isImageVisible()) {
            closeBubble(true);
            return;
        }
        positionBubble();
    });

    window.addEventListener('scroll', function() {
        if (!gifMonitor.classList.contains('active')) return;
        if (Math.abs(window.scrollY - openScrollY) > 8 || !isImageVisible()) {
            closeBubble(true);
            return;
        }
        positionBubble();
    }, { passive: true });
}

// ==================== 导航栏滚动效果 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 初始化像素散开效果
    try { initPixelEffects(); } catch (e) { console.warn('PixelDispersion init failed:', e); }

    // 初始化关于区 GIF 气泡
    try { initAboutGifMonitor(); } catch (e) { console.warn('initAboutGifMonitor failed:', e); }

    // 初始化 TextPressure 动态文字
    try { initTextPressure(); } catch (e) { console.warn('TextPressure init failed:', e); }

    // 初始化伴生系统文章同步
    try { initCompanionArticleSync(); } catch (e) { console.warn('initCompanionArticleSync failed:', e); }

    // 初始化公开页面内容防护
    try { initPublicContentProtection(); } catch (e) { console.warn('initPublicContentProtection failed:', e); }

    // 初始化文章卡片
    try { renderArticleCards(); } catch (e) { console.warn('renderArticleCards failed:', e); }

    // 初始化书籍阅读器
    try { initBookReader(); } catch (e) { console.warn('initBookReader failed:', e); }
    try { initArticleRoutes(); } catch (e) { console.warn('initArticleRoutes failed:', e); }

    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        if (!navbar) return;
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 滚动显示动画 - 延迟等待文章卡片渲染完成
    setTimeout(function() {
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -30px 0px'
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        const articleCards = document.querySelectorAll('.article-card');
        articleCards.forEach(card => {
            observer.observe(card);
        });
    }, 100);

    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 导航链接激活状态
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', function() {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            if (scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });

    // 图片懒加载 - 不隐藏已加载的图片
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.src) {
                    // 如果图片已加载完成，添加渐入效果
                    if (img.complete && img.naturalWidth > 0) {
                        img.style.transition = 'opacity 0.5s ease, transform 0.6s ease';
                    } else {
                        // 等待图片加载后渐入
                        img.addEventListener('load', function onLoad() {
                            img.style.transition = 'opacity 0.5s ease, transform 0.6s ease';
                            img.removeEventListener('load', onLoad);
                        }, { once: true });
                    }
                }
                observer.unobserve(img);
            }
        });
    });

    lazyImages.forEach(img => imageObserver.observe(img));

    // ==================== 独立效果开关面板 ====================
    createTogglePanel();
});

// 创建浮动开关面板
function createTogglePanel() {
    const panel = document.createElement('div');
    panel.className = 'fx-menu';
    panel.innerHTML = `
        <button class="menu__item" type="button" data-key="grid">网格点阵</button>
        <button class="menu__item" type="button" data-key="birds">像素鸟群</button>
    `;
    document.body.appendChild(panel);

    const gridItem = panel.querySelector('[data-key="grid"]');
    const birdsItem = panel.querySelector('[data-key="birds"]');

    let gridOn = true;
    let birdsOn = true;

    gridItem.addEventListener('click', function () {
        gridOn = !gridOn;
        this.classList.toggle('off', !gridOn);
        if (typeof pixelBirdsInstance !== 'undefined' && pixelBirdsInstance) {
            pixelBirdsInstance.setGrid(gridOn);
        }
    });

    birdsItem.addEventListener('click', function () {
        birdsOn = !birdsOn;
        this.classList.toggle('off', !birdsOn);
        if (typeof pixelBirdsInstance !== 'undefined' && pixelBirdsInstance) {
            pixelBirdsInstance.setBirds(birdsOn);
        }
    });
}

// ==================== 点击切换 "二极管三重唱" 字体 ====================
(function initFontSwitcher() {
    var navBrand = document.querySelector('.nav-brand');
    var navBrandText = document.querySelector('.nav-brand-text');
    var footerBrand = document.querySelector('.footer-brand');
    if (!navBrandText && !footerBrand) return;

    // 字体列表（第一个为默认字体）
    var fonts = [
        '',                          // 默认（继承 Noto Serif SC）
        'HYPixel9pxU',               // 9px像素体
        'MaoZeDong',                 // 毛泽东体
        'ZiYuQuWeiXiangSu'           // 趣味像素体
    ];
    var currentIndex = 0;

    // 给一个元素应用字体切换
    function applyFont(el, font) {
        var shuffle = el._shuffle;
        if (shuffle) {
            shuffle.playing = true;
            shuffle.cleanup();
            shuffle.playing = false;
        }
        if (font) {
            el.style.fontFamily = '"' + font + '", "Noto Serif SC", serif';
        } else {
            el.style.fontFamily = '';
        }
    }

    // 配置 navBrand
    if (navBrand) {
        navBrand.style.transition = 'font-family 0.3s ease';
        navBrand.style.cursor = 'pointer';
        navBrand.title = '点击切换字体';

        navBrand.addEventListener('click', function (e) {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % fonts.length;
            var font = fonts[currentIndex];
            if (navBrandText) applyFont(navBrandText, font);
            if (footerBrand) applyFont(footerBrand, font);
        });
    }

    // 配置 footerBrand
    if (footerBrand) {
        footerBrand.style.transition = 'font-family 0.3s ease';
        footerBrand.style.cursor = 'pointer';
        footerBrand.title = '点击切换字体';

        footerBrand.addEventListener('click', function (e) {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % fonts.length;
            var font = fonts[currentIndex];
            if (navBrandText) applyFont(navBrandText, font);
            applyFont(footerBrand, font);
        });
    }
})();
