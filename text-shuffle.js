// ==================== TextShuffle — 原生 JS 文字乱序动画 ====================
class TextShuffle {
    constructor(el, options = {}) {
        this.el = el;
        this.text = options.text || el.textContent.trim();
        this.shuffleDirection = options.shuffleDirection || 'right';
        this.duration = options.duration ?? 0.35;
        this.ease = options.ease || 'power3.out';
        this.shuffleTimes = options.shuffleTimes ?? 2;
        this.stagger = options.stagger ?? 0.04;
        this.triggerOnHover = options.triggerOnHover ?? true;
        this.scrambleCharset = options.scrambleCharset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

        this.playing = false;
        this.initialized = false;
        this.chars = [];
        this.wrappers = [];

        this._onHover = this._onHover.bind(this);
        this._onLeave = this._onLeave.bind(this);

        this.init();
    }

    init() {
        // 等待 GSAP 加载
        if (typeof gsap === 'undefined') {
            console.warn('GSAP not loaded. TextShuffle disabled.');
            return;
        }
        this.build();
        this.initialized = true;

        // 延迟首次播放（等字体/布局稳定）
        setTimeout(() => this.play(), 300);

        if (this.triggerOnHover) {
            this.el.addEventListener('mouseenter', this._onHover);
            this.el.addEventListener('mouseleave', this._onLeave);
        }
    }

    _onHover() {
        if (this.playing) return;
        if (this._hoverTimer) clearTimeout(this._hoverTimer);
        this.build();
        this.play();
    }

    _onLeave() {
        // 离开后重置为静态态
        this._hoverTimer = setTimeout(() => {
            if (this.playing) return;
            this.cleanupToStill();
        }, 400);
    }

    // 构建字符条
    build() {
        // 清理之前的结构
        this.cleanup();

        const chars = [...this.text];
        const rolls = Math.max(1, Math.floor(this.shuffleTimes));
        const charset = this.scrambleCharset;
        const rand = () => charset.charAt(Math.floor(Math.random() * charset.length));

        this.el.innerHTML = '';

        chars.forEach(ch => {
            // 获取单个字符的尺寸（通过临时测量）
            const measure = document.createElement('span');
            measure.textContent = ch;
            measure.style.cssText = 'display:inline-block;visibility:hidden;position:absolute;';
            this.el.appendChild(measure);
            const w = measure.offsetWidth;
            const h = measure.offsetHeight;
            measure.remove();

            // 字体可能不含该字符，兜底使用字号作为最小尺寸
            const fallbackW = w || parseFloat(getComputedStyle(this.el).fontSize) || 16;
            const fallbackH = h || fallbackW;

            // 外层 overflow 容器
            const wrap = document.createElement('span');
            Object.assign(wrap.style, {
                display: 'inline-block',
                overflow: 'hidden',
                width: fallbackW + 'px',
                height: fallbackH + 'px',
                verticalAlign: 'bottom',
                position: 'relative',
            });
            wrap.classList.add('shuffle-char-wrapper');

            // 内层 strip
            const strip = document.createElement('span');
            Object.assign(strip.style, {
                display: 'inline-flex',
                flexDirection: this.shuffleDirection === 'up' || this.shuffleDirection === 'down'
                    ? 'column' : 'row',
                willChange: 'transform',
            });

            // 根据方向决定字符顺序
            const steps = rolls + 1;
            const items = [];

            // 中间：乱码
            for (let i = 0; i < rolls; i++) {
                const r = document.createElement('span');
                r.textContent = rand();
                r.style.cssText = `display:inline-block;width:${fallbackW}px;text-align:center;line-height:1;`;
                items.push(r);
            }

            // 真实字符（最终显示）
            const real = document.createElement('span');
            real.textContent = ch;
            real.dataset.orig = '1';
            real.style.cssText = `display:inline-block;width:${fallbackW}px;text-align:center;line-height:1;`;
            items.push(real);

            const dir = this.shuffleDirection;
            const isH = dir === 'left' || dir === 'right';
            const isPositive = dir === 'right' || dir === 'down';
            const stepSize = isH ? -fallbackW : -fallbackH;

            if (isPositive) {
                // right/down: 乱码在上方，滑入到真实字符
                // strip 含 steps 个元素，第 0 个是 real，末尾是乱码
                // 初始：最后一个乱码可见 → y = -(steps-1)*stepSize
                // 终点：第一个 real 可见 → y = 0
                items.pop();
                strip.appendChild(real);
                items.forEach(item => strip.appendChild(item));
                const initOffset = (steps - 1) * stepSize;
                gsap.set(strip, { x: isH ? initOffset : 0, y: isH ? 0 : initOffset });
                strip.dataset.startX = String(isH ? initOffset : 0);
                strip.dataset.startY = String(isH ? 0 : initOffset);
                strip.dataset.finalX = '0';
                strip.dataset.finalY = '0';
            } else {
                // left/up: 乱码在前，滑出到真实字符
                items.forEach(item => strip.appendChild(item));
                strip.appendChild(real);
                gsap.set(strip, { x: 0, y: 0 });
                strip.dataset.startX = '0';
                strip.dataset.startY = '0';
                strip.dataset.finalX = String(isH ? steps * stepSize : 0);
                strip.dataset.finalY = String(isH ? 0 : steps * stepSize);
            }

            wrap.appendChild(strip);
            this.el.appendChild(wrap);

            this.chars.push({ wrap, strip, w: fallbackW, h: fallbackH, steps, isH, stepsDone: false });
            this.wrappers.push(wrap);
        });
    }

    // 播放动画
    play() {
        if (!this.initialized || this.playing || !this.chars.length) return;
        this.playing = true;

        const dir = this.shuffleDirection;
        const isH = dir === 'left' || dir === 'right';

        const strips = this.chars.map(c => c.strip);
        const odd = strips.filter((_, i) => i % 2 === 1);
        const even = strips.filter((_, i) => i % 2 === 0);

        const tl = gsap.timeline({
            onComplete: () => {
                this.playing = false;
                this.cleanupToStill();
            }
        });

        const tweenVars = (targets) => ({
            duration: this.duration,
            ease: this.ease,
            stagger: this.stagger,
            force3D: true,
            [isH ? 'x' : 'y']: (i, t) => parseFloat(t.dataset[isH ? 'finalX' : 'finalY'] || '0'),
        });

        if (odd.length) tl.to(odd, tweenVars(odd), 0);
        if (even.length) {
            const oddDur = this.duration + Math.max(0, odd.length - 1) * this.stagger;
            tl.to(even, tweenVars(even), odd.length ? oddDur * 0.7 : 0);
        }
    }

    // 收拢到静态态
    cleanupToStill() {
        this.wrappers.forEach(w => {
            const strip = w.firstElementChild;
            if (!strip) return;
            // 找出 data-orig 标记的或最后一个真实字符
            const kids = Array.from(strip.children);
            const real = kids.find(k => k.dataset.orig === '1') || kids[kids.length - 1];
            if (real) {
                strip.innerHTML = '';
                strip.appendChild(real.cloneNode(true));
            }
            gsap.set(strip, { x: 0, y: 0, clearProps: 'willChange' });
        });
    }

    // 完全清理 DOM 结构
    cleanup() {
        this.chars.forEach(c => {
            if (c.strip) gsap.killTweensOf(c.strip);
        });
        this.chars = [];
        this.wrappers = [];
        this.el.innerHTML = this.text;
    }

    destroy() {
        this.el.removeEventListener('mouseenter', this._onHover);
        this.el.removeEventListener('mouseleave', this._onLeave);
        this.cleanup();
        this.initialized = false;
    }
}

// 全局初始化
(function () {
    if (typeof gsap === 'undefined') return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShuffles);
    } else {
        initShuffles();
    }

    function initShuffles() {
        // 导航栏品牌名
        const navBrand = document.querySelector('.nav-brand-text');
        if (navBrand) {
            navBrand._shuffle = new TextShuffle(navBrand, {
                shuffleDirection: 'down',
                duration: 0.3,
                shuffleTimes: 2,
                stagger: 0.05,
                scrambleCharset: 'ILOVEY',
                triggerOnHover: true,
            });
        }

        // 页脚品牌名
        const footerBrand = document.querySelector('.footer-brand');
        if (footerBrand) {
            footerBrand._shuffle = new TextShuffle(footerBrand, {
                shuffleDirection: 'right',
                duration: 0.35,
                shuffleTimes: 1,
                stagger: 0.06,
                scrambleCharset: 'ILOVEY',
                triggerOnHover: true,
            });
        }
    }
})();
