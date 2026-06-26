// ==================== 像素点阵背景 — 鸟群 & 潮汐均在网格上移动 ====================
class PixelDotBackground {
    constructor() {
        this.canvas = null;
        this.ctx = null;

        // 独立开关
        this.showGrid = true;     // 网格点阵
        this.showBirds = true;    // 像素鸟
        this.animId = null;

        // 网格配置
        this.gridSize = 12;
        this.dotSize = 2;
        this.cols = 0;
        this.rows = 0;

        // 所有网格点
        this.gridPoints = [];

        // 鸟群
        this.birdCount = 22;
        this.birds = [];

        this.birdShapes = [
            [
                { rx: -1.8, ry: 0, w: 2, h: 1, flap: -0.8 },
                { rx: -0.8, ry: 0.4, w: 1, h: 1, flap: -0.35 },
                { rx: 0, ry: 0, w: 2, h: 1, flap: 0 },
                { rx: 0.8, ry: 0.4, w: 1, h: 1, flap: -0.35 },
                { rx: 1.8, ry: 0, w: 2, h: 1, flap: -0.8 },
                { rx: 0, ry: 0.9, w: 1, h: 1, flap: 0.15 },
            ],
            [
                { rx: -1.5, ry: -0.6, w: 1, h: 1, flap: -1.1 },
                { rx: -0.7, ry: -0.1, w: 2, h: 1, flap: -0.55 },
                { rx: 0, ry: 0.2, w: 2, h: 1, flap: 0 },
                { rx: 0.8, ry: -0.1, w: 2, h: 1, flap: -0.55 },
                { rx: 1.6, ry: -0.7, w: 1, h: 1, flap: -1.1 },
            ],
            [
                { rx: -1.7, ry: 0.7, w: 1, h: 1, flap: 0.9 },
                { rx: -0.8, ry: 0.2, w: 2, h: 1, flap: 0.45 },
                { rx: 0, ry: 0, w: 2, h: 1, flap: 0 },
                { rx: 0.8, ry: 0.2, w: 2, h: 1, flap: 0.45 },
                { rx: 1.7, ry: 0.7, w: 1, h: 1, flap: 0.9 },
                { rx: -0.2, ry: 0.8, w: 1, h: 1, flap: 0.2 },
            ],
            [
                { rx: -1.3, ry: -0.1, w: 2, h: 1, flap: -0.45 },
                { rx: -0.2, ry: 0.2, w: 2, h: 1, flap: 0 },
                { rx: 0.8, ry: -0.2, w: 2, h: 1, flap: -0.25 },
                { rx: 1.5, ry: -0.5, w: 1, h: 1, flap: -0.7 },
                { rx: -0.9, ry: 0.7, w: 1, h: 1, flap: 0.2 },
            ],
        ];

        // 群中心
        this.flockX = 0;
        this.flockY = 0;
        this.flockGridX = 0;
        this.flockGridY = 0;

        // 鼠标
        this.mx = 0;
        this.my = 0;
        this.mouseVx = 0;
        this.mouseVy = 0;
        this.mouseSpeed = 0;

        // 状态
        this.idleTimer = 0;
        this.idleThreshold = 2000;
        this.tideMix = 0;
        this.tideTime = 0;

        // 潮汐波浪层
        this.tideLayers = [
            { yBase: 0.80, amp: 8, freq: 0.012, speed: 0.5 },
            { yBase: 0.84, amp: 7, freq: 0.015, speed: 0.65 },
            { yBase: 0.88, amp: 6, freq: 0.018, speed: 0.8 },
            { yBase: 0.91, amp: 5, freq: 0.022, speed: 0.95 },
            { yBase: 0.94, amp: 4, freq: 0.027, speed: 1.1 },
            { yBase: 0.96, amp: 3, freq: 0.033, speed: 1.3 },
        ];

        this.init();
    }

    // 设置网格点阵开关
    setGrid(on) {
        this.showGrid = on;
        this.updateCanvasState();
    }

    // 设置像素鸟开关
    setBirds(on) {
        this.showBirds = on;
        this.updateCanvasState();
    }

    // 根据子开关更新 canvas 可见性和动画状态
    updateCanvasState() {
        const shouldShow = this.showGrid || this.showBirds;
        this.canvas.style.display = shouldShow ? '' : 'none';
        if (shouldShow && !this.animId) {
            this.animId = requestAnimationFrame(t => this.animate(t));
        }
    }

    init() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        Object.assign(this.canvas.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '1', opacity: '1',
            imageRendering: 'pixelated',
        });
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        document.body.prepend(this.canvas);

        this.setupGrid();
        this.createFlock();

        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('resize', () => this.onResize());
        this.animId = requestAnimationFrame(t => this.animate(t));
    }

    // ---------- 建立网格 ----------
    setupGrid() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.cols = Math.ceil(w / this.gridSize) + 1;
        this.rows = Math.ceil(h / this.gridSize) + 1;

        this.gridPoints = [];
        for (let iy = 0; iy < this.rows; iy++) {
            for (let ix = 0; ix < this.cols; ix++) {
                this.gridPoints.push({
                    ix, iy,
                    x: ix * this.gridSize,
                    y: iy * this.gridSize,
                    brightness: 0.15 + Math.random() * 0.1,  // 基础亮度略有变化
                });
            }
        }
        // 初始化群中心到屏幕中央
        this.flockX = Math.floor(this.cols / 2);
        this.flockY = Math.floor(this.rows / 3);
        this.flockGridX = this.flockX;
        this.flockGridY = this.flockY;
    }

    // ---------- 获取网格点坐标 ----------
    getPoint(ix, iy) {
        if (ix < 0) ix = 0; if (ix >= this.cols) ix = this.cols - 1;
        if (iy < 0) iy = 0; if (iy >= this.rows) iy = this.rows - 1;
        return this.gridPoints[iy * this.cols + ix];
    }

    // ---------- 创建鸟群 ----------
    createFlock() {
        const cx = this.flockX;
        const cy = this.flockY;
        const spread = 10;  // 网格单位

        const modes = ['normal', 'dart', 'hover', 'cruise', 'swirl'];

        for (let bi = 0; bi < this.birdCount; bi++) {
            const angle = (bi / this.birdCount) * Math.PI * 2 + Math.random() * 0.5;
            const dist = Math.floor(spread * (0.3 + Math.random() * 0.7));
            const offsetX = Math.round(Math.cos(angle) * dist);
            const offsetY = Math.round(Math.sin(angle) * dist * 0.6);

            // 为鸟的每个像素块分配网格点
            const birdPoints = [];
            const shape = this.birdShapes[Math.floor(Math.random() * this.birdShapes.length)];
            for (let pi = 0; pi < shape.length; pi++) {
                const part = shape[pi];
                // 每个点分配到一条波浪线，预计算其在波浪上的 x 相位
                const waveLayer = pi % this.tideLayers.length;
                birdPoints.push({
                    rx: part.rx,
                    ry: part.ry,
                    w: part.w || 1,
                    h: part.h || 1,
                    flap: part.flap || 0,
                    gix: cx + offsetX,
                    giy: cy + offsetY,
                    tgix: cx + offsetX,
                    tgiy: cy + offsetY,
                    waveLayer,
                    wavePhase: Math.random() * Math.PI * 2,
                });
            }

            this.birds.push({
                points: birdPoints,
                offsetX, offsetY,
                // 当前中心网格坐标
                gix: cx + offsetX,
                giy: cy + offsetY,
                // 速度（网格单位/帧）
                vx: 0, vy: 0,
                facing: Math.random() > 0.5 ? 1 : -1,
                phase: Math.random() * Math.PI * 2,
                flapSpeed: 0.025 + Math.random() * 0.055,
                mode: modes[bi % modes.length],
                modeTimer: 90 + Math.random() * 180,
                targetAngle: Math.random() * Math.PI * 2,
            });
        }
    }

    onMouseMove(e) {
        const prevX = this.mx, prevY = this.my;
        this.mx = e.clientX;
        this.my = e.clientY;
        this.mouseVx = this.mx - prevX;
        this.mouseVy = this.my - prevY;
        this.mouseSpeed = Math.sqrt(this.mouseVx ** 2 + this.mouseVy ** 2);
        this.idleTimer = 0;

        // 鼠标位置转换为网格坐标
        const mouseGridX = Math.floor(this.mx / this.gridSize);
        const mouseGridY = Math.floor(this.my / this.gridSize);

        // 群中心向鼠标方向移动（滞后）
        const dx = mouseGridX - this.flockX;
        const dy = mouseGridY - this.flockY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
            const moveSpeed = Math.min(dist * 0.035, 0.75);
            this.flockGridX += (dx / dist) * moveSpeed;
            this.flockGridY += (dy / dist) * moveSpeed;
        }
    }

    onResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.setupGrid();
        // 重新约束鸟的位置
        for (const bird of this.birds) {
            bird.gix = Math.min(Math.max(bird.gix, 2), this.cols - 3);
            bird.giy = Math.min(Math.max(bird.giy, 2), this.rows - 3);
            for (const p of bird.points) {
                p.gix = bird.gix;
                p.giy = bird.giy;
            }
        }
    }

    // ---------- 更新鸟群（网格坐标）----------
    updateFlock() {
        // 平滑群中心
        this.flockX += (this.flockGridX - this.flockX) * 0.045;
        this.flockY += (this.flockGridY - this.flockY) * 0.045;

        const modes = ['normal', 'dart', 'hover', 'cruise', 'swirl'];

        for (const bird of this.birds) {
            // 行为切换
            bird.modeTimer--;
            if (bird.modeTimer <= 0) {
                bird.mode = modes[Math.floor(Math.random() * modes.length)];
                bird.modeTimer = 90 + Math.random() * 180;
                if (bird.mode === 'dart' || bird.mode === 'cruise' || bird.mode === 'swirl') {
                    bird.targetAngle = Math.random() * Math.PI * 2;
                }
            }

            // 计算目标位置（网格坐标）
            let targetX = this.flockX + bird.offsetX;
            let targetY = this.flockY + bird.offsetY;

            // 鼠标影响
            const mouseInf = Math.min(this.mouseSpeed * 0.02, 3);
            targetX += (this.mouseVx || 0) * mouseInf * 0.018;
            targetY += (this.mouseVy || 0) * mouseInf * 0.012;

            // 行为偏移
            switch (bird.mode) {
                case 'dart':
                    targetX += Math.cos(bird.targetAngle) * 5;
                    targetY += Math.sin(bird.targetAngle) * 3;
                    break;
                case 'hover':
                    targetX = bird.gix + Math.sin(bird.phase) * 2;
                    targetY = bird.giy + Math.cos(bird.phase * 1.2) * 2;
                    break;
                case 'cruise':
                    targetX += Math.cos(bird.targetAngle) * 7;
                    targetY += Math.sin(bird.targetAngle) * 4;
                    break;
                case 'swirl':
                    const swirlT = Date.now() * 0.00045 + bird.phase;
                    targetX += Math.cos(swirlT) * 3.5;
                    targetY += Math.sin(swirlT) * 2.5;
                    break;
            }

            // 向目标移动
            const dx = targetX - bird.gix;
            const dy = targetY - bird.giy;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

            const accel = bird.mode === 'dart' ? 0.055 : bird.mode === 'hover' ? 0.014 : 0.032;
            bird.vx += (dx / dist) * accel;
            bird.vy += (dy / dist) * accel * 0.7;

            // 分离力（避免重叠）
            for (const other of this.birds) {
                if (other === bird) continue;
                const sdx = bird.gix - other.gix;
                const sdy = bird.giy - other.giy;
                const sdist = Math.sqrt(sdx * sdx + sdy * sdy) + 0.1;
                if (sdist < 4) {
                    bird.vx += (sdx / sdist) * 0.05;
                    bird.vy += (sdy / sdist) * 0.04;
                }
            }

            // 阻尼
            const damp = bird.mode === 'dart' ? 0.88 : bird.mode === 'hover' ? 0.82 : 0.86;
            bird.vx *= damp;
            bird.vy *= damp;

            // 速度限制
            const spd = Math.sqrt(bird.vx ** 2 + bird.vy ** 2);
            let maxSpd = bird.mode === 'dart' ? 0.9 : bird.mode === 'hover' ? 0.18 : 0.5;
            if (this.mouseSpeed > 3) maxSpd += 0.2;
            if (spd > maxSpd) {
                bird.vx = (bird.vx / spd) * maxSpd;
                bird.vy = (bird.vy / spd) * maxSpd;
            }

            // 更新位置
            bird.gix += bird.vx;
            bird.giy += bird.vy;

            // 边界
            if (bird.gix < 2) { bird.gix = 2; bird.vx *= -0.5; }
            if (bird.gix > this.cols - 3) { bird.gix = this.cols - 3; bird.vx *= -0.5; }
            if (bird.giy < 2) { bird.giy = 2; bird.vy *= -0.5; }
            if (bird.giy > this.rows - 3) { bird.giy = this.rows - 3; bird.vy *= -0.5; }

            // 朝向
            if (Math.abs(bird.vx) > 0.05) {
                bird.facing += (Math.sign(bird.vx) - bird.facing) * 0.2;
            }

            // 翅膀相位
            const flapRate = bird.flapSpeed + spd * 0.025;
            bird.phase += flapRate;

            // 更新每个像素块的目标网格位置
            const f = bird.facing;
            const wingFold = Math.sin(bird.phase);
            const tipOff = wingFold * 0.9;

            for (const p of bird.points) {
                let rx = p.rx * f;
                let ry = p.ry;
                ry += tipOff * p.flap;

                p.tgix = bird.gix + rx;
                p.tgiy = bird.giy + ry;

                // 平滑移动到目标网格
                p.gix += (p.tgix - p.gix) * 0.3;
                p.giy += (p.tgiy - p.giy) * 0.3;
            }
        }
    }

    // ---------- 更新潮汐模式（水平波浪线）----------
    updateTide() {
        const t = this.tideTime;
        const rows = this.rows;
        const cols = this.cols;

        // 每条波浪线上的点数
        const pointsPerLine = Math.ceil(this.birds.length * 5 / this.tideLayers.length) + 10;

        for (const bird of this.birds) {
            for (const p of bird.points) {
                const layer = this.tideLayers[p.waveLayer];
                const baseRow = Math.floor(rows * layer.yBase);

                // 计算该点在波浪线上的 x 位置（使用 wavePhase 作为 x 偏移）
                const xPhase = p.wavePhase / (Math.PI * 2);
                // x 位置：在全屏宽度范围内均匀分布，并随着时间缓慢右移
                p.tgix = ((xPhase * cols + t * layer.speed * 3) % cols);
                if (p.tgix < 0) p.tgix += cols;

                // y 位置 = 基线 + 正弦波浪
                const wx = p.tgix * layer.freq;
                p.tgiy = baseRow + Math.sin(wx + t * layer.speed * 2) * layer.amp
                       + Math.sin(wx * 2.3 + t * layer.speed) * layer.amp * 0.35;

                // 平滑移动
                p.gix += (p.tgix - p.gix) * 0.1;
                p.giy += (p.tgiy - p.giy) * 0.1;
            }
        }
    }

    // ---------- 主循环 ----------
    animate(timestamp = 0) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // 状态更新
        this.idleTimer += 16;
        if (this.idleTimer > this.idleThreshold) {
            this.tideMix = Math.min(1, this.tideMix + 0.005);
        } else {
            this.tideMix = Math.max(0, this.tideMix - 0.025);
        }
        this.tideTime += 0.016;
        this.mouseSpeed *= 0.9;

        const mix = this.tideMix;

        // 更新模式
        if (mix < 0.3) {
            this.updateFlock();
        } else if (mix > 0.7) {
            this.updateTide();
        } else {
            // 过渡：两者都更新，但插值由绘制时处理
            this.updateFlock();
            // 存储鸟模式位置用于插值
            for (const bird of this.birds) {
                for (const p of bird.points) {
                    p._birdGix = p.gix;
                    p._birdGiy = p.giy;
                }
            }
            this.updateTide();
            // 插值回中间状态
            const t = (mix - 0.3) / 0.4;  // 0~1
            for (const bird of this.birds) {
                for (const p of bird.points) {
                    p.gix = p._birdGix + (p.gix - p._birdGix) * t;
                    p.giy = p._birdGiy + (p.giy - p._birdGiy) * t;
                }
            }
        }

        // 绘制背景网格点
        if (this.showGrid) {
            ctx.fillStyle = 'rgba(29, 29, 31, 0.16)';
            for (const pt of this.gridPoints) {
                ctx.fillRect(pt.x, pt.y, this.dotSize, this.dotSize);
            }
        }

        // 绘制活跃点（鸟/潮汐）
        if (this.showBirds) {
            for (const bird of this.birds) {
                const r = Math.floor(126 + mix * 42);
                const g = Math.floor(76 + mix * 8);
                const b = Math.floor(28 + mix * 20);
                const color = `rgba(${r},${g},${b},0.95)`;

                for (const p of bird.points) {
                    const gix = Math.round(p.gix);
                    const giy = Math.round(p.giy);
                    if (gix >= 0 && gix < this.cols && giy >= 0 && giy < this.rows) {
                        const pt = this.getPoint(gix, giy);
                        const block = this.dotSize + 1;
                        const width = block * (p.w || 1);
                        const height = block * (p.h || 1);
                        ctx.fillStyle = color;
                        ctx.fillRect(
                            pt.x - Math.floor((width - block) / 2),
                            pt.y - Math.floor((height - block) / 2),
                            width,
                            height
                        );
                    }
                }
            }
        }

        // 两个都关了 → 停止动画、隐藏 canvas
        if (!this.showGrid && !this.showBirds) {
            this.animId = null;
            return;
        }

        this.animId = requestAnimationFrame(t => this.animate(t));
    }
}

// 全局实例引用
let pixelBirdsInstance = null;

// 初始化
(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            pixelBirdsInstance = new PixelDotBackground();
        });
    } else {
        pixelBirdsInstance = new PixelDotBackground();
    }
})();
