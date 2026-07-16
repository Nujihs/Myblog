(function() {
    'use strict';

    var STORAGE_KEY = window.BLOG_COMPANION_STORAGE_KEY || 'blogCompanionArticles.v1';
    var CHANNEL_NAME = window.BLOG_COMPANION_CHANNEL_NAME || 'blog-companion-articles';
    var BLOCK_TYPES = ['text', 'image', 'video', 'template'];
    var root = null;

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

    function splitLines(value) {
        return String(value || '').split(/\r?\n/).map(function(line) {
            return line.trim();
        }).filter(Boolean);
    }

    function normalizeBlocks(blocks, content) {
        var normalizedContent = Array.isArray(content) ? content : [];
        var sourceBlocks = Array.isArray(blocks) && blocks.length
            ? blocks
            : normalizedContent.map(function(line, index) {
                return {
                    id: 'legacy-' + index,
                    type: 'text',
                    title: index === 0 ? '正文' : '',
                    body: line,
                    span: 'full'
                };
            });

        return sourceBlocks.map(function(block, index) {
            block = block || {};
            var type = BLOCK_TYPES.indexOf(block.type) !== -1 ? block.type : 'text';
            return {
                id: String(block.id || ('block-' + index)),
                type: type,
                title: String(block.title || ''),
                body: String(block.body || ''),
                src: String(block.src || ''),
                caption: String(block.caption || ''),
                span: ['full', 'half', 'third'].indexOf(block.span) !== -1 ? block.span : 'full'
            };
        });
    }

    function normalizeArticle(article, index) {
        article = article || {};
        var content = Array.isArray(article.content)
            ? article.content
            : String(article.content || '').split(/\r?\n/);
        var normalizedContent = content.map(function(line) {
            return String(line || '');
        }).filter(function(line) {
            return line.trim().length > 0;
        });
        return {
            id: String(article.id || (index + 1)),
            published: article.published !== false,
            category: String(article.category || ''),
            title: String(article.title || ''),
            date: String(article.date || ''),
            excerpt: String(article.excerpt || ''),
            image: String(article.image || ''),
            blocks: normalizeBlocks(article.blocks, normalizedContent)
        };
    }

    function readArticles() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.map(normalizeArticle);
            }
        } catch (e) {
            console.warn('read preview articles failed:', e);
        }
        return (Array.isArray(window.BLOG_ARTICLES) ? window.BLOG_ARTICLES : []).map(normalizeArticle);
    }

    function getRequestedId() {
        return new URLSearchParams(window.location.search).get('id');
    }

    function formatVerticalText(text) {
        var quoteOpen = true;
        var singleQuoteOpen = true;
        var punctuationMap = {
            '。': '︒',
            '，': '︐',
            '、': '︑',
            '；': '︔',
            '：': '︓',
            '？': '︖',
            '！': '︕',
            '（': '︵',
            '）': '︶',
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

    function getBlockTextLines(block) {
        if (!block) return [];
        if (block.type === 'text') return splitLines(block.body);
        if (block.type === 'template') {
            return (block.title ? [block.title] : []).concat(splitLines(block.body));
        }
        return [];
    }

    function getArticleTextLines(article) {
        var lines = [];
        article.blocks.forEach(function(block) {
            lines = lines.concat(getBlockTextLines(block));
        });
        return lines.length ? lines : ['暂无正文'];
    }

    function getFirstMediaBlock(article) {
        return article.blocks.find(function(block) {
            return block && (block.type === 'image' || block.type === 'video') && block.src;
        }) || null;
    }

    function renderVerticalColumns(article) {
        return getArticleTextLines(article).slice(0, 7).map(function(line) {
            return '<div class="standalone-vertical-col"><p>' + escapeHTML(formatVerticalText(line)) + '</p></div>';
        }).join('');
    }

    function renderInlineMedia(block) {
        if (!block) return '';
        if (block.type === 'image') {
            return '<figure class="standalone-book-media">' +
                '<img src="' + escapeHTML(block.src) + '" alt="' + escapeHTML(block.caption || block.title || '') + '">' +
                (block.caption || block.title ? '<figcaption>' + escapeHTML(block.caption || block.title) + '</figcaption>' : '') +
            '</figure>';
        }
        return '<figure class="standalone-book-media">' +
            '<video src="' + escapeHTML(block.src) + '" controls muted preload="none"></video>' +
            (block.caption || block.title ? '<figcaption>' + escapeHTML(block.caption || block.title) + '</figcaption>' : '') +
        '</figure>';
    }

    function getCoverStyleIndex(article, articles) {
        var publishedArticles = articles.filter(function(item) {
            return item && item.published !== false;
        });
        var source = article && article.published !== false && publishedArticles.length ? publishedArticles : articles;
        var index = source.findIndex(function(item) {
            return String(item.id) === String(article.id);
        });
        if (index < 0) index = 0;
        return (index % 6) + 1;
    }

    function renderBookCover(article, styleIndex) {
        return '<article class="standalone-book-cover cover-style-' + styleIndex + '" aria-label="主站书封预览">' +
            '<div class="standalone-cover-art">' +
                (article.image ? '<img src="' + escapeHTML(article.image) + '" alt="">' : '') +
            '</div>' +
            '<span class="standalone-cover-category">' + escapeHTML(article.category || '未分类') + '</span>' +
            '<h1 class="standalone-cover-title">' + escapeHTML(article.title || '未命名文章') + '</h1>' +
            '<p class="standalone-cover-excerpt">' + escapeHTML(article.excerpt || '暂无摘要') + '</p>' +
            '<span class="standalone-cover-date">' + escapeHTML(article.date || '') + '</span>' +
            '<span class="standalone-cover-spine">' + escapeHTML(article.category || '') + '</span>' +
        '</article>';
    }

    function renderBookSpread(article, styleIndex) {
        var mediaBlock = getFirstMediaBlock(article);
        return '<section class="standalone-reader-book" aria-label="打开后的书页预览">' +
            '<div class="standalone-book-spread">' +
                '<div class="standalone-book-page standalone-book-left">' +
                    renderBookCover(article, styleIndex) +
                    '<span class="standalone-page-number">01</span>' +
                '</div>' +
                '<div class="standalone-book-page standalone-book-right">' +
                    '<header class="standalone-book-page-header">' +
                        '<span>' + escapeHTML(article.category || '未分类') + '</span>' +
                        '<span>' + escapeHTML(article.date || '') + '</span>' +
                    '</header>' +
                    '<h2>' + escapeHTML(article.title || '未命名文章') + '</h2>' +
                    '<div class="standalone-book-body">' +
                        '<div class="standalone-book-columns">' + renderVerticalColumns(article) + '</div>' +
                        renderInlineMedia(mediaBlock) +
                    '</div>' +
                    '<span class="standalone-page-number right">02</span>' +
                '</div>' +
                '<div class="standalone-book-spine-line"></div>' +
            '</div>' +
        '</section>';
    }

    function render() {
        var articles = readArticles();
        var requestedId = getRequestedId();
        var article = articles.find(function(item) {
            return String(item.id) === String(requestedId);
        }) || articles[0];

        if (!root) return;
        if (!article) {
            root.innerHTML = '<div class="empty-state">没有可预览的文章。</div>';
            return;
        }

        document.title = (article.title || '主站预览') + ' · 主站预览';
        var styleIndex = getCoverStyleIndex(article, articles);
        root.innerHTML =
            '<div class="standalone-book-preview">' +
                '<section class="standalone-book-stage">' +
                    renderBookCover(article, styleIndex) +
                '</section>' +
                renderBookSpread(article, styleIndex) +
            '</div>';
    }

    function init() {
        root = document.getElementById('previewRoot');
        render();
        window.addEventListener('storage', function(event) {
            if (event.key === STORAGE_KEY) render();
        });
        if ('BroadcastChannel' in window) {
            var channel = new BroadcastChannel(CHANNEL_NAME);
            channel.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'articles-updated') render();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (window.BLOG_OWNER_AUTH) {
            window.BLOG_OWNER_AUTH.requireAccess().then(init);
            return;
        }
        init();
    });
})();
