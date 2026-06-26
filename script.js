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
        const tctx = temp.getContext('2d');
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
    if (typeof TextPressure === 'undefined') {
        console.warn('TextPressure library not loaded. Skipping text pressure effect.');
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
    // 主视觉图片
    const heroImg = document.querySelector('.hero-image-container img');
    const heroContainer = document.querySelector('.hero-image-container');
    if (heroImg && heroContainer) {
        new PixelDispersion(heroContainer, heroImg);
    }

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
var articlesData = [
    {
        id: 1,
        category: '思考',
        title: '数字时代的阅读与思考',
        date: '2026.05.12',
        excerpt: '在信息爆炸的时代，如何保持深度思考的能力？碎片化阅读究竟带来了什么。',
        image: 'images/waterfall/101909633_p0_master1200.jpg',
        content: [
            '我们活在一个被屏幕包围的时代。晨起第一件事是摸手机，睡前最后一件事是放下手机。',
            '信息如洪流涌来，每一秒钟都有数不清的文字、图片、视频被生产、被消费、被遗忘。',
            '古人云："学而不思则罔。"这句话在今天比任何时候都更具警示意义。',
            '当我们习惯了滑动而非翻页、浏览而非阅读、收藏而非消化时，思考的肌肉正在萎缩。',
            '深度思考需要的不是更多信息，而是留白。是放下手机后那些看似"无聊"的瞬间。',
            '在这个时代选择慢下来，本身就是一种勇敢的反抗。'
        ]
    },
    {
        id: 2,
        category: '技术',
        title: '构建极简的个人知识库',
        date: '2026.04.28',
        excerpt: '知识管理不是收藏，而是连接与内化。聊聊我如何用最少的工具管理知识。',
        image: 'images/waterfall/104001143_p0_master1200.jpg',
        content: [
            '我们收藏了太多东西：稍后阅读从未打开，书签密密麻麻从未整理，笔记应用装了又卸。',
            '知识的价值不在于收集的数量，而在于连接的深度。',
            '一个好的知识库应该像一棵树——从少数几个核心概念出发，长出枝叶，形成网络。',
            '我删掉了所有"稍后阅读"工具，只留下一个笔记和一个日历。',
            '当信息减去噪音，剩下的才是真正属于你的东西。',
            '简单不是匮乏，而是精准。这是我在知识管理中学到的最重要的一课。'
        ]
    },
    {
        id: 3,
        category: '随笔',
        title: '山间漫步的哲学',
        date: '2026.04.10',
        excerpt: '在群山之间寻找内心的平静，徒步教会我的那些事。',
        image: 'images/waterfall/106310971_p0_master1200.jpg',
        content: [
            '山路蜿蜒，每一步都在向上。呼吸渐渐沉重，思绪却变得轻盈。',
            '城市里的我们习惯了速度和效率，忘记了走路本身就是一种冥想。',
            '山不言语，却教会我们最多。它的沉默是一种邀请——邀请你放下焦虑，回到当下。',
            '走到半山腰，回头看，来时的路已经消失在雾中。往前走，山顶还在云里。',
            '人生也是如此吧——既看不清来路，也望不穿前程，但脚下的这一步是真实的。',
            '山在那里，不是为了被征服，而是为了被感受。'
        ]
    },
    {
        id: 4,
        category: '生活',
        title: '书写即生活',
        date: '2026.03.22',
        excerpt: '用文字记录每一个值得铭记的瞬间，关于写作的初心与坚持。',
        image: 'images/waterfall/108121531_p0_master1200.jpg',
        content: [
            '写作于我，不是输出，而是澄清。',
            '许多想不清楚的事情，在落笔的瞬间变得明朗。文字有一种魔力——它迫使你直面自己的模糊。',
            '坚持写作最难的不是没有灵感，而是在觉得自己写得不够好的时候依然继续。',
            '每一个伟大的写作者都曾是糟糕的初学者，区别只在于他们从未停下。',
            '生活每天都在发生，如果不记录下来，它们就像没发生过一样消散。',
            '所以书写即生活——不是为了给别人看，而是为了让自己活得更清楚一些。'
        ]
    },
    {
        id: 5,
        category: '摄影',
        title: '镜头里的光影叙事',
        date: '2026.03.05',
        excerpt: '摄影不只是按下快门，更是对光的理解和对时间的截取。',
        image: 'images/waterfall/110773119_p0_master1200.jpg',
        content: [
            '光是摄影的语法，而相机只是翻译工具。',
            '最好的照片往往不是计划出来的，而是在等待中遇见的。等待光线恰好穿过树叶的那个角度。',
            '我越来越觉得，摄影与写作有奇妙的共通之处——两者都是在时间之流中截取一个瞬间。',
            '不同的是，摄影用光书写，文字用思考书写。',
            '"与其拍摄一个东西，不如拍摄一个理念；与其拍摄一个理念，不如拍摄一种情绪。"',
            '每一次按下快门，都是在说：这一刻，值得被记住。'
        ]
    },
    {
        id: 6,
        category: '旅行',
        title: '在异乡寻找故乡',
        date: '2026.02.16',
        excerpt: '旅行的意义不在于去了多远，而在于回归时你变成了谁。',
        image: 'images/waterfall/114490740_p0_master1200.jpg',
        content: [
            '每一次离开，都是为了更好地回来。',
            '异乡的街道、陌生的语言、不同的气味——这些陌生感像一面镜子，照出你从未察觉的自我。',
            '在熟悉的地方，我们活成了习惯。在陌生的地方，我们才真正地活着。',
            '我喜欢的旅行不是打卡，而是在一个地方住下来，像当地人一样买菜、散步、发呆。',
            '当你把异乡走成了故乡，故乡也就成了另一个异乡。人总是在路上。',
            '旅行最珍贵的纪念品，是归来后发现自己变成了一个更完整的人。'
        ]
    },
    {
        id: 7,
        category: '影评',
        title: '电影是现代人的神话',
        date: '2026.01.28',
        excerpt: '为什么我们需要故事？从一部老电影说起。',
        image: 'images/waterfall/118954605_p0_master1200.jpg',
        content: [
            '在一个理性至上的时代，我们依然需要神话。电影，就是现代人的神话。',
            '好的电影不是给你答案，而是让你带着问题走出影院。',
            '故事是人类最古老的科技——远在文字发明之前，我们就在篝火旁讲述。',
            '每一个角色都是我们自己的一个侧面，每一次感动都是一次自我确认。',
            '"不是所有的流浪者都迷失了方向。"这句话来自某部电影，却像是写给每一个人的。',
            '在黑暗中坐着，看别人的故事，流的却是自己的眼泪——这是电影最奇妙的魔法。'
        ]
    },
    {
        id: 8,
        category: '杂记',
        title: '城市的呼吸与心跳',
        date: '2026.01.10',
        excerpt: '城市从来不只是钢筋水泥，它有自己独特的生命节奏。',
        image: 'images/waterfall/120051783_p0_master1200.jpg',
        content: [
            '凌晨四点的城市，是一天中最诚实的时刻。霓虹褪去，喧嚣沉寂，只剩下路灯和早起的鸟儿。',
            '每个城市都有自己的呼吸节奏。有的急促如东京，有的慵懒如清迈。',
            '我习惯在周末的清晨在城市里漫无目的地走，不带手机，不带耳机。',
            '你会发现很多平时看不见的东西：墙缝里开出的花、咖啡馆门口晒太阳的猫。',
            '城市其实很有耐心——它会等待那些愿意慢下来的人，向他们展示自己温柔的一面。',
            '如果你觉得城市冷漠，也许只是你还没有找到和它对话的方式。'
        ]
    },
    {
        id: 9,
        category: '音乐',
        title: '音符之间的沉默',
        date: '2025.12.22',
        excerpt: '音乐的美不只在于声音，更在于声音之间的留白。',
        image: 'images/waterfall/121177347_p0_master1200.jpg',
        content: [
            '一位音乐家说过："音乐不是音符，而是音符之间的沉默。"',
            '越来越觉得，这句话不仅适用于音乐，也适用于生活。',
            '我们害怕沉默——谈话中的冷场、工作中的间隙、独处时的安静。',
            '但正是这些间隙赋予了声音意义。没有休止符的乐章是噪音，没有停顿的人生是混乱。',
            '学会倾听沉默，是学会倾听一切的前提。',
            '下次听音乐时，试着去听那些没有声音的瞬间——那里藏着作曲家最深的秘密。'
        ]
    }
];

// ==================== 渲染文章卡片 ====================
function renderArticleCards() {
    var grid = document.getElementById('articlesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    articlesData.forEach(function(article) {
        var card = document.createElement('div');
        card.className = 'article-card';
        card.setAttribute('data-id', article.id);
        card.innerHTML =
            '<div class="card-image">' +
                '<img src="' + article.image + '" alt="' + article.title + '" loading="lazy">' +
            '</div>' +
            '<div class="card-body">' +
                '<span class="card-category">' + article.category + '</span>' +
                '<h3 class="card-title">' + article.title + '</h3>' +
                '<p class="card-excerpt">' + article.excerpt + '</p>' +
                '<span class="card-date">' + article.date + '</span>' +
            '</div>';

        card.addEventListener('click', function() {
            openBookReader(article);
        });

        grid.appendChild(card);
    });
}

// ==================== 书籍阅读器 ====================
function openBookReader(article) {
    var overlay = document.getElementById('bookReader');
    var bookLeftImg = document.getElementById('bookLeftImg');
    var bookCategory = document.getElementById('bookCategory');
    var bookDate = document.getElementById('bookDate');
    var bookTitle = document.getElementById('bookTitle');
    var bookContent = document.getElementById('bookContent');

    if (!overlay) return;

    // 填充左页图片
    if (bookLeftImg) {
        bookLeftImg.src = article.image;
        bookLeftImg.alt = article.title;
    }
    if (bookCategory) bookCategory.textContent = article.category;
    if (bookDate) bookDate.textContent = article.date;
    if (bookTitle) bookTitle.textContent = article.title;

    // 竖排文字填充右页
    if (bookContent) {
        bookContent.innerHTML = '';
        // 分成两栏竖排
        var mid = Math.ceil(article.content.length / 2);
        var cols = [
            article.content.slice(0, mid),
            article.content.slice(mid)
        ];
        cols.forEach(function(lines) {
            var col = document.createElement('div');
            col.className = 'vertical-col';
            lines.forEach(function(line) {
                var p = document.createElement('p');
                p.textContent = line;
                col.appendChild(p);
            });
            bookContent.appendChild(col);
        });
    }

    // 显示并做入场动画
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBookReader() {
    var overlay = document.getElementById('bookReader');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ==================== 初始化书籍阅读器事件 ====================
function initBookReader() {
    var closeBtn = document.getElementById('bookClose');
    var overlay = document.getElementById('bookReader');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeBookReader);
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
    });
}

// ==================== 导航栏滚动效果 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 初始化像素散开效果
    try { initPixelEffects(); } catch (e) { console.warn('PixelDispersion init failed:', e); }

    // GIF 对话气泡 - 点击主图右上角弹出（跟随滚动）
    (function initGifMonitor() {
        var heroImg = document.querySelector('.hero-image-container img');
        var heroContainer = document.querySelector('.hero-image-container');
        var heroSection = document.querySelector('.hero');
        var gifMonitor = document.getElementById('gifMonitor');
        if (!heroImg || !gifMonitor || !heroContainer || !heroSection) return;

        heroImg.style.cursor = 'pointer';

        function positionBubble() {
            var rect = heroContainer.getBoundingClientRect();
            var sectionRect = heroSection.getBoundingClientRect();
            var bubbleW = rect.width * 1.15;
            var bubbleH = rect.height * 0.8;
            bubbleW = Math.min(bubbleW, window.innerWidth * 0.45);
            bubbleH = Math.min(bubbleH, window.innerHeight * 0.45);
            gifMonitor.style.width = bubbleW + 'px';
            gifMonitor.style.height = bubbleH + 'px';
            // 相对于 hero section 定位
            gifMonitor.style.left = (rect.right - bubbleW * 0.35 - sectionRect.left) + 'px';
            gifMonitor.style.top = (rect.top - bubbleH * 0.65 - sectionRect.top) + 'px';
        }

        positionBubble();
        window.addEventListener('resize', positionBubble);
        window.addEventListener('scroll', positionBubble);

        heroImg.addEventListener('click', function (e) {
            e.stopPropagation();
            positionBubble();
            gifMonitor.classList.toggle('active');
        });

        // 点击气泡关闭
        gifMonitor.addEventListener('click', function () {
            gifMonitor.classList.remove('active');
        });
    })();

    // 初始化 TextPressure 动态文字
    try { initTextPressure(); } catch (e) { console.warn('TextPressure init failed:', e); }

    // 初始化文章卡片
    try { renderArticleCards(); } catch (e) { console.warn('renderArticleCards failed:', e); }

    // 初始化书籍阅读器
    try { initBookReader(); } catch (e) { console.warn('initBookReader failed:', e); }

    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
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
        <a class="menu__item" tabindex="0" data-key="grid">网格点阵</a>
        <a class="menu__item" tabindex="0" data-key="birds">像素鸟群</a>
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
    var footerBrand = document.querySelector('.footer-brand');
    if (!navBrand && !footerBrand) return;

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
            applyFont(navBrand, font);
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
            if (navBrand) applyFont(navBrand, font);
            applyFont(footerBrand, font);
        });
    }
})();
