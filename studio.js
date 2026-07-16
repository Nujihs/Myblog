(function() {
    'use strict';

    var STORAGE_KEY = window.BLOG_COMPANION_STORAGE_KEY || 'blogCompanionArticles.v1';
    var CHANNEL_NAME = window.BLOG_COMPANION_CHANNEL_NAME || 'blog-companion-articles';
    var ACTIVE_KEY = 'blogCompanionActiveArticle.v1';
    var LIBRARY_COLLAPSED_KEY = 'blogCompanionLibraryCollapsed.v1';
    var DEFAULT_IMAGE = 'poster.png';
    var DEFAULT_VIDEO = '21d4305faa4741709a89d2451a673372.mp4';
    var BLOCK_TYPES = ['text', 'image', 'video', 'template'];
    var BLOCK_LABELS = {
        text: '文本',
        image: '图片',
        video: '视频',
        template: '模板'
    };
    var SPAN_LABELS = {
        full: '整行',
        half: '半宽',
        third: '三分之一'
    };

    var state = {
        articles: [],
        activeId: null,
        selectedBlockId: null,
        filter: 'all',
        query: '',
        libraryCollapsed: false,
        draggedBlockId: null,
        saveTimer: null,
        toastTimer: null,
        channel: null
    };

    var els = {};

    function $(id) {
        return document.getElementById(id);
    }

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

    function uid(prefix) {
        return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function todayLabel() {
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        return y + '.' + m + '.' + d;
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
            var defaultSpan = type === 'image' || type === 'video' || type === 'template' ? 'half' : 'full';
            return {
                id: String(block.id || uid('block-' + index)),
                type: type,
                title: String(block.title || ''),
                body: String(block.body || ''),
                src: String(block.src || ''),
                caption: String(block.caption || ''),
                span: ['full', 'half', 'third'].indexOf(block.span) !== -1 ? block.span : defaultSpan
            };
        });
    }

    function textLinesFromBlocks(blocks) {
        return (Array.isArray(blocks) ? blocks : []).reduce(function(lines, block) {
            if (!block) return lines;
            if (block.type === 'text') return lines.concat(splitLines(block.body));
            if (block.type === 'template') {
                var templateLines = [];
                if (block.title) templateLines.push(block.title);
                return lines.concat(templateLines, splitLines(block.body));
            }
            return lines.concat(splitLines(block.caption));
        }, []);
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
        var blocks = normalizeBlocks(article.blocks, normalizedContent);
        var contentLines = textLinesFromBlocks(blocks);

        return {
            id: String(article.id || (index + 1)),
            published: article.published !== false,
            category: String(article.category || '随笔'),
            title: String(article.title || '未命名文章'),
            date: String(article.date || todayLabel()),
            excerpt: String(article.excerpt || ''),
            image: String(article.image || ''),
            blocks: blocks,
            content: contentLines.length ? contentLines : normalizedContent
        };
    }

    function normalizeArticleList(list) {
        return (Array.isArray(list) ? list : []).map(normalizeArticle).filter(function(article) {
            return article.title || article.excerpt || article.blocks.length;
        });
    }

    function serializeArticle(article) {
        var blocks = normalizeBlocks(article.blocks, []);
        return {
            id: article.id,
            published: article.published !== false,
            category: article.category,
            title: article.title,
            date: article.date,
            excerpt: article.excerpt,
            image: article.image,
            blocks: blocks,
            content: textLinesFromBlocks(blocks)
        };
    }

    function serializableArticles() {
        return state.articles.map(serializeArticle);
    }

    function readStoredArticles() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            console.warn('readStoredArticles failed:', e);
            return null;
        }
    }

    function loadInitialArticles() {
        var stored = readStoredArticles();
        var source = stored || window.BLOG_ARTICLES || [];
        var articles = normalizeArticleList(source);
        if (articles.length) return articles;
        return [normalizeArticle({
            id: uid('article'),
            published: false,
            category: '随笔',
            title: '新文章',
            date: todayLabel(),
            excerpt: '这里是文章摘要，会同步显示在主站卡片中。',
            image: DEFAULT_IMAGE,
            blocks: [
                {
                    id: uid('block'),
                    type: 'text',
                    title: '正文',
                    body: '从这里开始写下第一段内容。',
                    span: 'full'
                }
            ]
        }, 0)];
    }

    function getActiveArticle() {
        return state.articles.find(function(article) {
            return String(article.id) === String(state.activeId);
        }) || state.articles[0] || null;
    }

    function getSelectedBlock() {
        var article = getActiveArticle();
        if (!article) return null;
        return article.blocks.find(function(block) {
            return String(block.id) === String(state.selectedBlockId);
        }) || null;
    }

    function setSaveState(text) {
        if (els.saveState) els.saveState.textContent = text;
    }

    function showToast(message) {
        if (!els.toast) return;
        els.toast.textContent = message;
        els.toast.classList.add('active');
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(function() {
            els.toast.classList.remove('active');
        }, 2200);
    }

    function applyLibraryCollapsed() {
        document.body.classList.toggle('library-collapsed', state.libraryCollapsed);
        if (!els.toggleLibrary) return;
        els.toggleLibrary.textContent = state.libraryCollapsed ? '›' : '‹';
        els.toggleLibrary.title = state.libraryCollapsed ? '展开文章库' : '收起文章库';
        els.toggleLibrary.setAttribute('aria-label', state.libraryCollapsed ? '展开文章库' : '收起文章库');
        els.toggleLibrary.setAttribute('aria-expanded', state.libraryCollapsed ? 'false' : 'true');
    }

    function toggleLibraryCollapsed() {
        state.libraryCollapsed = !state.libraryCollapsed;
        try {
            localStorage.setItem(LIBRARY_COLLAPSED_KEY, state.libraryCollapsed ? '1' : '0');
        } catch (e) {
            console.warn('save library collapsed failed:', e);
        }
        applyLibraryCollapsed();
    }

    function announceUpdate() {
        if (state.channel) {
            state.channel.postMessage({ type: 'articles-updated', source: 'studio', at: Date.now() });
        }
    }

    function persistNow(message) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableArticles()));
        if (state.activeId) localStorage.setItem(ACTIVE_KEY, String(state.activeId));
        announceUpdate();
        setSaveState(message || ('已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false })));
        updateArticleCount();
    }

    function schedulePersist(message) {
        setSaveState('保存中...');
        clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(function() {
            persistNow(message);
        }, 160);
    }

    function updateArticleCount() {
        var publishedCount = state.articles.filter(function(article) {
            return article.published !== false;
        }).length;
        if (els.articleCount) {
            els.articleCount.textContent = state.articles.length + ' 篇文章 · ' + publishedCount + ' 篇发布';
        }
    }

    function filteredArticles() {
        var query = state.query.trim().toLowerCase();
        return state.articles.filter(function(article) {
            if (state.filter === 'published' && article.published === false) return false;
            if (state.filter === 'draft' && article.published !== false) return false;
            if (!query) return true;
            return [article.title, article.category, article.excerpt, article.date].join(' ').toLowerCase().indexOf(query) !== -1;
        });
    }

    function renderArticleList() {
        if (!els.articleList) return;
        var list = filteredArticles();
        els.articleList.innerHTML = '';
        if (!list.length) {
            els.articleList.innerHTML = '<div class="empty-state">没有匹配的文章。</div>';
            return;
        }

        list.forEach(function(article) {
            var articleTitle = article.title || '未命名文章';
            var articleMeta = (article.category || '未分类') + ' · ' + (article.date || '');
            var articleStatus = article.published !== false ? '已发布' : '草稿';
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'article-item' + (String(article.id) === String(state.activeId) ? ' active' : '');
            item.dataset.articleId = article.id;
            item.title = articleTitle + '\n' + articleMeta + '\n' + articleStatus;
            item.setAttribute('aria-label', articleTitle + '，' + articleStatus);
            item.innerHTML =
                '<div class="item-row">' +
                    '<small>' + escapeHTML(article.category || '未分类') + ' · ' + escapeHTML(article.date || '') + '</small>' +
                    '<span class="item-status ' + (article.published !== false ? 'published' : '') + '">' + articleStatus + '</span>' +
                '</div>' +
                '<strong>' + escapeHTML(articleTitle) + '</strong>' +
                '<span>' + escapeHTML(article.excerpt || '暂无摘要') + '</span>';
            item.addEventListener('click', function() {
                selectArticle(article.id);
            });
            els.articleList.appendChild(item);
        });
    }

    function renderEditorFields() {
        var article = getActiveArticle();
        if (!article) return;
        if (els.articleTitle) els.articleTitle.value = article.title;
        if (els.articleCategory) els.articleCategory.value = article.category;
        if (els.articleDate) els.articleDate.value = article.date;
        if (els.articlePublished) els.articlePublished.checked = article.published !== false;
        if (els.articleExcerpt) els.articleExcerpt.value = article.excerpt;
        if (els.articleImage) els.articleImage.value = article.image;
        if (els.canvasTitle) els.canvasTitle.textContent = article.title || '未命名文章';
    }

    function renderBlockContent(block) {
        if (block.type === 'text') {
            return '<div class="block-content"><p>' + escapeHTML(block.body || '空文本模块') + '</p></div>';
        }
        if (block.type === 'template') {
            return '<div class="block-content">' +
                (block.title ? '<h3>' + escapeHTML(block.title) + '</h3>' : '') +
                '<p>' + escapeHTML(block.body || '模板正文') + '</p>' +
            '</div>';
        }
        if (block.type === 'image') {
            return (block.src
                ? '<div class="block-media"><img src="' + escapeHTML(block.src) + '" alt="' + escapeHTML(block.caption || block.title || '') + '"></div>'
                : '<div class="media-placeholder">添加图片路径</div>') +
                '<div class="block-caption">' + escapeHTML(block.caption || block.title || '图片模块') + '</div>';
        }
        if (block.type === 'video') {
            return (block.src
                ? '<div class="block-media"><video src="' + escapeHTML(block.src) + '" controls muted preload="none"></video></div>'
                : '<div class="media-placeholder">添加视频路径</div>') +
                '<div class="block-caption">' + escapeHTML(block.caption || block.title || '视频模块') + '</div>';
        }
        return '';
    }

    function renderCanvas() {
        var article = getActiveArticle();
        if (!els.canvasGrid || !article) return;
        els.canvasGrid.innerHTML = '';
        if (!article.blocks.length) {
            els.canvasGrid.innerHTML = '<div class="canvas-empty">画布为空。使用上方按钮添加文本、图片或视频模块。</div>';
            return;
        }

        article.blocks.forEach(function(block, index) {
            var module = document.createElement('article');
            module.className = 'canvas-module span-' + block.span + (String(block.id) === String(state.selectedBlockId) ? ' selected' : '');
            module.dataset.blockId = block.id;
            module.draggable = true;
            module.innerHTML =
                '<div class="block-head">' +
                    '<span class="block-type">' + escapeHTML(BLOCK_LABELS[block.type] || block.type) + ' · ' + escapeHTML(SPAN_LABELS[block.span] || block.span) + '</span>' +
                    '<div class="block-actions">' +
                        '<button type="button" data-block-action="up" ' + (index === 0 ? 'disabled' : '') + '>上移</button>' +
                        '<button type="button" data-block-action="down" ' + (index === article.blocks.length - 1 ? 'disabled' : '') + '>下移</button>' +
                        '<button type="button" data-block-action="copy">复制</button>' +
                        '<button type="button" data-block-action="delete">删除</button>' +
                    '</div>' +
                '</div>' +
                renderBlockContent(block);
            els.canvasGrid.appendChild(module);
        });
    }

    function renderInspector() {
        var block = getSelectedBlock();
        if (!els.blockInspector || !els.selectedBlockTitle) return;
        if (!block) {
            els.selectedBlockTitle.textContent = '未选择模块';
            els.blockInspector.className = 'block-inspector empty-state';
            els.blockInspector.textContent = '选择画布中的模块后，可编辑内容、媒体地址和排版宽度。';
            return;
        }

        els.selectedBlockTitle.textContent = BLOCK_LABELS[block.type] || '模块';
        els.blockInspector.className = 'block-inspector';
        els.blockInspector.innerHTML =
            '<div class="inspector-grid">' +
                '<label class="inspector-field">' +
                    '<span>类型</span>' +
                    '<select data-block-field="type">' +
                        '<option value="text">文本</option>' +
                        '<option value="image">图片</option>' +
                        '<option value="video">视频</option>' +
                        '<option value="template">模板</option>' +
                    '</select>' +
                '</label>' +
                '<label class="inspector-field">' +
                    '<span>排版宽度</span>' +
                    '<select data-block-field="span">' +
                        '<option value="full">整行</option>' +
                        '<option value="half">半宽</option>' +
                        '<option value="third">三分之一</option>' +
                    '</select>' +
                '</label>' +
                '<label class="inspector-field full">' +
                    '<span>标题 / 备注</span>' +
                    '<input type="text" data-block-field="title" value="' + escapeHTML(block.title) + '">' +
                '</label>' +
                '<label class="inspector-field full" data-field-wrap="body">' +
                    '<span>正文</span>' +
                    '<textarea data-block-field="body" rows="6">' + escapeHTML(block.body) + '</textarea>' +
                '</label>' +
                '<label class="inspector-field full" data-field-wrap="src">' +
                    '<span>媒体路径</span>' +
                    '<input type="text" data-block-field="src" value="' + escapeHTML(block.src) + '" placeholder="poster.png / images/... / .mp4">' +
                '</label>' +
                '<label class="inspector-field full" data-field-wrap="caption">' +
                    '<span>说明文字</span>' +
                    '<textarea data-block-field="caption" rows="3">' + escapeHTML(block.caption) + '</textarea>' +
                '</label>' +
            '</div>';

        els.blockInspector.querySelector('[data-block-field="type"]').value = block.type;
        els.blockInspector.querySelector('[data-block-field="span"]').value = block.span;
        updateInspectorVisibility(block.type);
        bindInspectorFields();
    }

    function updateInspectorVisibility(type) {
        if (!els.blockInspector) return;
        var bodyWrap = els.blockInspector.querySelector('[data-field-wrap="body"]');
        var srcWrap = els.blockInspector.querySelector('[data-field-wrap="src"]');
        var captionWrap = els.blockInspector.querySelector('[data-field-wrap="caption"]');
        if (bodyWrap) bodyWrap.style.display = type === 'image' || type === 'video' ? 'none' : '';
        if (srcWrap) srcWrap.style.display = type === 'image' || type === 'video' ? '' : 'none';
        if (captionWrap) captionWrap.style.display = type === 'image' || type === 'video' ? '' : 'none';
    }

    function formatPreviewVerticalText(text) {
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
            '「': '﹁',
            '」': '﹂',
            '『': '﹃',
            '』': '﹄',
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

    function getPreviewBlockLines(block) {
        if (!block) return [];
        if (block.type === 'text') return splitLines(block.body);
        if (block.type === 'template') {
            return (block.title ? [block.title] : []).concat(splitLines(block.body));
        }
        return [];
    }

    function getPreviewArticleLines(article) {
        var lines = [];
        article.blocks.forEach(function(block) {
            lines = lines.concat(getPreviewBlockLines(block));
        });
        return lines.length ? lines : ['暂无正文'];
    }

    function getStudioCoverStyleIndex(article) {
        var publishedArticles = state.articles.filter(function(item) {
            return item && item.published !== false;
        });
        var source = article && article.published !== false && publishedArticles.length ? publishedArticles : state.articles;
        var index = source.findIndex(function(item) {
            return String(item.id) === String(article.id);
        });
        if (index < 0) index = 0;
        return (index % 6) + 1;
    }

    function renderStudioBookCover(article) {
        var styleIndex = getStudioCoverStyleIndex(article);
        return '<article class="studio-preview-book-cover cover-style-' + styleIndex + '" aria-label="文章书封">' +
            '<span class="studio-cover-spine">' + escapeHTML(article.category || '') + '</span>' +
            '<span class="studio-cover-category">' + escapeHTML(article.category || '未分类') + '</span>' +
            '<h3>' + escapeHTML(article.title || '未命名文章') + '</h3>' +
            '<p>' + escapeHTML(article.excerpt || '暂无摘要') + '</p>' +
            '<time>' + escapeHTML(article.date || '') + '</time>' +
        '</article>';
    }

    function renderStudioBookColumns(article) {
        return getPreviewArticleLines(article).slice(0, 5).map(function(line) {
            return '<div class="studio-preview-vertical-col"><p>' + escapeHTML(formatPreviewVerticalText(line)) + '</p></div>';
        }).join('');
    }

    function renderPreview() {
        var article = getActiveArticle();
        if (!els.sitePreview || !article) return;
        els.sitePreview.innerHTML =
            '<div class="studio-book-preview">' +
                '<div class="studio-preview-label"><span>书封</span></div>' +
                '<div class="studio-preview-cover-stage">' + renderStudioBookCover(article) + '</div>' +
                '<div class="studio-preview-label"><span>阅读页</span></div>' +
                '<article class="studio-preview-reader-book">' +
                    '<header><span>' + escapeHTML(article.category || '未分类') + '</span><span>' + escapeHTML(article.date || '') + '</span></header>' +
                    '<h3>' + escapeHTML(article.title || '未命名文章') + '</h3>' +
                    '<div class="studio-preview-page-body">' + renderStudioBookColumns(article) + '</div>' +
                    '<span class="studio-preview-page-num">02</span>' +
                '</article>' +
            '</div>';
    }

    function renderAll() {
        updateArticleCount();
        renderArticleList();
        renderEditorFields();
        renderCanvas();
        renderInspector();
        renderPreview();
    }

    function selectArticle(id) {
        state.activeId = String(id);
        var article = getActiveArticle();
        state.selectedBlockId = article && article.blocks[0] ? article.blocks[0].id : null;
        localStorage.setItem(ACTIVE_KEY, state.activeId);
        renderAll();
    }

    function selectBlock(id) {
        state.selectedBlockId = String(id);
        renderCanvas();
        renderInspector();
    }

    function updateActiveArticle(patch) {
        var article = getActiveArticle();
        if (!article) return;
        Object.keys(patch).forEach(function(key) {
            article[key] = patch[key];
        });
        if (els.canvasTitle) els.canvasTitle.textContent = article.title || '未命名文章';
        renderArticleList();
        renderPreview();
        schedulePersist();
    }

    function updateSelectedBlock(field, value) {
        var block = getSelectedBlock();
        if (!block) return;
        block[field] = value;
        if (field === 'type') {
            if (value === 'image' && !block.src) block.src = DEFAULT_IMAGE;
            if (value === 'video' && !block.src) block.src = DEFAULT_VIDEO;
            if (value === 'text' && !block.body) block.body = '新的文本内容。';
            if (value === 'template' && !block.body) block.body = '模板正文内容。';
            renderInspector();
        }
        renderCanvas();
        renderPreview();
        schedulePersist();
    }

    function createBlock(type) {
        var article = getActiveArticle();
        if (!article) return;
        var block = {
            id: uid('block'),
            type: type,
            title: '',
            body: '',
            src: '',
            caption: '',
            span: type === 'text' ? 'full' : 'half'
        };
        if (type === 'text') {
            block.title = '正文';
            block.body = '新的文本内容。';
        }
        if (type === 'template') {
            block.title = '小标题';
            block.body = '这里可以放置引言、章节说明或补充段落。';
        }
        if (type === 'image') {
            block.src = article.image || DEFAULT_IMAGE;
            block.caption = '图片说明';
        }
        if (type === 'video') {
            block.src = DEFAULT_VIDEO;
            block.caption = '视频说明';
        }
        article.blocks.push(block);
        state.selectedBlockId = block.id;
        renderCanvas();
        renderInspector();
        renderPreview();
        schedulePersist('已添加模块并保存');
    }

    function moveBlock(id, delta) {
        var article = getActiveArticle();
        if (!article) return;
        var index = article.blocks.findIndex(function(block) {
            return String(block.id) === String(id);
        });
        var nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= article.blocks.length) return;
        var block = article.blocks.splice(index, 1)[0];
        article.blocks.splice(nextIndex, 0, block);
        state.selectedBlockId = block.id;
        renderCanvas();
        renderPreview();
        schedulePersist();
    }

    function duplicateBlock(id) {
        var article = getActiveArticle();
        if (!article) return;
        var index = article.blocks.findIndex(function(block) {
            return String(block.id) === String(id);
        });
        if (index < 0) return;
        var clone = JSON.parse(JSON.stringify(article.blocks[index]));
        clone.id = uid('block');
        article.blocks.splice(index + 1, 0, clone);
        state.selectedBlockId = clone.id;
        renderCanvas();
        renderInspector();
        renderPreview();
        schedulePersist('已复制模块');
    }

    function deleteBlock(id) {
        var article = getActiveArticle();
        if (!article) return;
        article.blocks = article.blocks.filter(function(block) {
            return String(block.id) !== String(id);
        });
        state.selectedBlockId = article.blocks[0] ? article.blocks[0].id : null;
        renderCanvas();
        renderInspector();
        renderPreview();
        schedulePersist('已删除模块');
    }

    function reorderDraggedBlock(targetId) {
        var article = getActiveArticle();
        if (!article || !state.draggedBlockId || String(state.draggedBlockId) === String(targetId)) return;
        var fromIndex = article.blocks.findIndex(function(block) {
            return String(block.id) === String(state.draggedBlockId);
        });
        var toIndex = article.blocks.findIndex(function(block) {
            return String(block.id) === String(targetId);
        });
        if (fromIndex < 0 || toIndex < 0) return;
        var block = article.blocks.splice(fromIndex, 1)[0];
        article.blocks.splice(toIndex, 0, block);
        state.selectedBlockId = block.id;
        state.draggedBlockId = null;
        renderCanvas();
        renderPreview();
        schedulePersist('已调整模块顺序');
    }

    function createArticle() {
        var article = normalizeArticle({
            id: uid('article'),
            published: false,
            category: '随笔',
            title: '新文章',
            date: todayLabel(),
            excerpt: '为这篇文章写一句能出现在主站卡片里的摘要。',
            image: DEFAULT_IMAGE,
            blocks: [
                {
                    id: uid('block'),
                    type: 'text',
                    title: '正文',
                    body: '从这里开始写下第一段内容。',
                    span: 'full'
                }
            ]
        }, state.articles.length);
        state.articles.unshift(article);
        state.activeId = article.id;
        state.selectedBlockId = article.blocks[0].id;
        renderAll();
        persistNow('已创建新文章');
    }

    function deleteActiveArticle() {
        var article = getActiveArticle();
        if (!article) return;
        if (!confirm('确定删除《' + article.title + '》吗？此操作会同步影响主站本地预览。')) return;
        state.articles = state.articles.filter(function(item) {
            return String(item.id) !== String(article.id);
        });
        if (!state.articles.length) {
            createArticle();
            return;
        }
        state.activeId = state.articles[0].id;
        state.selectedBlockId = state.articles[0].blocks[0] ? state.articles[0].blocks[0].id : null;
        renderAll();
        persistNow('已删除文章');
    }

    function moveActiveArticle(delta) {
        var article = getActiveArticle();
        if (!article) return;
        var index = state.articles.findIndex(function(item) {
            return String(item.id) === String(article.id);
        });
        var nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= state.articles.length) return;
        var item = state.articles.splice(index, 1)[0];
        state.articles.splice(nextIndex, 0, item);
        renderArticleList();
        persistNow('已调整文章顺序');
    }

    function exportArticles() {
        var output = '// Article data used by index.html.\n' +
            '// Set published to false to take an article offline without deleting it.\n' +
            'window.BLOG_ARTICLES = ' + JSON.stringify(serializableArticles(), null, 4) + ';\n';
        if (els.exportOutput) els.exportOutput.value = output;
        if (els.exportPanel) {
            els.exportPanel.classList.add('active');
            els.exportPanel.setAttribute('aria-hidden', 'false');
        }
    }

    function copyExport() {
        if (!els.exportOutput) return;
        var text = els.exportOutput.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                showToast('已复制导出内容');
            }).catch(function() {
                els.exportOutput.select();
                document.execCommand('copy');
                showToast('已复制导出内容');
            });
            return;
        }
        els.exportOutput.select();
        document.execCommand('copy');
        showToast('已复制导出内容');
    }

    function resetLocal() {
        if (!confirm('确定清空后台本地同步数据，并恢复 articles-data.js 的原始内容吗？')) return;
        localStorage.removeItem(STORAGE_KEY);
        state.articles = loadInitialArticles();
        state.activeId = state.articles[0] ? state.articles[0].id : null;
        state.selectedBlockId = state.articles[0] && state.articles[0].blocks[0] ? state.articles[0].blocks[0].id : null;
        announceUpdate();
        renderAll();
        showToast('已恢复原始数据');
        setSaveState('已清空本地同步');
    }

    function bindInspectorFields() {
        if (!els.blockInspector) return;
        els.blockInspector.querySelectorAll('[data-block-field]').forEach(function(field) {
            var key = field.getAttribute('data-block-field');
            var eventName = field.tagName === 'SELECT' ? 'change' : 'input';
            field.addEventListener(eventName, function() {
                updateSelectedBlock(key, field.value);
            });
        });
    }

    function bindEvents() {
        if (els.articleSearch) {
            els.articleSearch.addEventListener('input', function(event) {
                state.query = event.target.value;
                renderArticleList();
            });
        }

        document.querySelectorAll('[data-filter]').forEach(function(button) {
            button.addEventListener('click', function() {
                state.filter = button.getAttribute('data-filter') || 'all';
                document.querySelectorAll('[data-filter]').forEach(function(item) {
                    item.classList.toggle('active', item === button);
                });
                renderArticleList();
            });
        });

        [
            ['articleTitle', 'title'],
            ['articleCategory', 'category'],
            ['articleDate', 'date'],
            ['articleExcerpt', 'excerpt'],
            ['articleImage', 'image']
        ].forEach(function(pair) {
            var el = els[pair[0]];
            if (!el) return;
            el.addEventListener('input', function(event) {
                var patch = {};
                patch[pair[1]] = event.target.value;
                updateActiveArticle(patch);
            });
        });

        if (els.articlePublished) {
            els.articlePublished.addEventListener('change', function(event) {
                updateActiveArticle({ published: event.target.checked });
            });
        }

        document.querySelectorAll('[data-add-block]').forEach(function(button) {
            button.addEventListener('click', function() {
                createBlock(button.getAttribute('data-add-block'));
            });
        });

        if (els.canvasGrid) {
            els.canvasGrid.addEventListener('click', function(event) {
                var action = event.target.closest('[data-block-action]');
                var module = event.target.closest('.canvas-module');
                if (action && module) {
                    event.stopPropagation();
                    var blockId = module.dataset.blockId;
                    var actionName = action.getAttribute('data-block-action');
                    if (actionName === 'up') moveBlock(blockId, -1);
                    if (actionName === 'down') moveBlock(blockId, 1);
                    if (actionName === 'copy') duplicateBlock(blockId);
                    if (actionName === 'delete') deleteBlock(blockId);
                    return;
                }
                if (module) selectBlock(module.dataset.blockId);
            });

            els.canvasGrid.addEventListener('dragstart', function(event) {
                var module = event.target.closest('.canvas-module');
                if (!module) return;
                state.draggedBlockId = module.dataset.blockId;
                module.classList.add('dragging');
                event.dataTransfer.effectAllowed = 'move';
            });

            els.canvasGrid.addEventListener('dragend', function(event) {
                var module = event.target.closest('.canvas-module');
                if (module) module.classList.remove('dragging');
                state.draggedBlockId = null;
            });

            els.canvasGrid.addEventListener('dragover', function(event) {
                if (event.target.closest('.canvas-module')) {
                    event.preventDefault();
                }
            });

            els.canvasGrid.addEventListener('drop', function(event) {
                var module = event.target.closest('.canvas-module');
                if (!module) return;
                event.preventDefault();
                reorderDraggedBlock(module.dataset.blockId);
            });
        }

        if (els.toggleLibrary) els.toggleLibrary.addEventListener('click', toggleLibraryCollapsed);
        if (els.newArticle) els.newArticle.addEventListener('click', createArticle);
        if (els.deleteArticle) els.deleteArticle.addEventListener('click', deleteActiveArticle);
        if (els.moveArticleUp) els.moveArticleUp.addEventListener('click', function() { moveActiveArticle(-1); });
        if (els.moveArticleDown) els.moveArticleDown.addEventListener('click', function() { moveActiveArticle(1); });
        if (els.usePoster) {
            els.usePoster.addEventListener('click', function() {
                updateActiveArticle({ image: DEFAULT_IMAGE });
                renderEditorFields();
            });
        }
        if (els.publishArticle) {
            els.publishArticle.addEventListener('click', function() {
                updateActiveArticle({ published: true });
                if (els.articlePublished) els.articlePublished.checked = true;
                persistNow('已发布到主站');
                showToast('已发布，主站会实时刷新');
            });
        }
        if (els.openMainSite) {
            els.openMainSite.addEventListener('click', function() {
                window.open('index.html#articles', '_blank');
            });
        }
        if (els.openPreview) {
            els.openPreview.addEventListener('click', function() {
                var article = getActiveArticle();
                if (!article) return;
                window.open('preview.html?id=' + encodeURIComponent(article.id), '_blank');
            });
        }
        if (els.exportData) els.exportData.addEventListener('click', exportArticles);
        if (els.refreshPreview) els.refreshPreview.addEventListener('click', renderPreview);
        if (els.closeExport) {
            els.closeExport.addEventListener('click', function() {
                els.exportPanel.classList.remove('active');
                els.exportPanel.setAttribute('aria-hidden', 'true');
            });
        }
        if (els.copyExport) els.copyExport.addEventListener('click', copyExport);
        if (els.resetLocal) els.resetLocal.addEventListener('click', resetLocal);
        if (els.exportPanel) {
            els.exportPanel.addEventListener('click', function(event) {
                if (event.target === els.exportPanel) {
                    els.exportPanel.classList.remove('active');
                    els.exportPanel.setAttribute('aria-hidden', 'true');
                }
            });
        }
    }

    function initElements() {
        [
            'saveState',
            'articleCount',
            'openMainSite',
            'openPreview',
            'exportData',
            'publishArticle',
            'toggleLibrary',
            'newArticle',
            'articleSearch',
            'articleList',
            'moveArticleUp',
            'moveArticleDown',
            'deleteArticle',
            'articleTitle',
            'articleCategory',
            'articleDate',
            'articlePublished',
            'articleExcerpt',
            'articleImage',
            'usePoster',
            'canvasTitle',
            'canvasGrid',
            'selectedBlockTitle',
            'blockInspector',
            'sitePreview',
            'refreshPreview',
            'exportPanel',
            'closeExport',
            'exportOutput',
            'copyExport',
            'resetLocal',
            'toast'
        ].forEach(function(id) {
            els[id] = $(id);
        });
    }

    function init() {
        initElements();
        try {
            state.libraryCollapsed = localStorage.getItem(LIBRARY_COLLAPSED_KEY) === '1';
        } catch (e) {
            state.libraryCollapsed = false;
        }
        applyLibraryCollapsed();
        if ('BroadcastChannel' in window) {
            state.channel = new BroadcastChannel(CHANNEL_NAME);
        }
        state.articles = loadInitialArticles();
        var savedActiveId = localStorage.getItem(ACTIVE_KEY);
        state.activeId = savedActiveId && state.articles.some(function(article) {
            return String(article.id) === String(savedActiveId);
        }) ? savedActiveId : (state.articles[0] ? state.articles[0].id : null);
        var active = getActiveArticle();
        state.selectedBlockId = active && active.blocks[0] ? active.blocks[0].id : null;
        bindEvents();
        renderAll();
        persistNow('已连接主站数据');
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (window.BLOG_OWNER_AUTH) {
            window.BLOG_OWNER_AUTH.requireAccess().then(init);
            return;
        }
        init();
    });
})();
