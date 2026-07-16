# 二极管三重唱

一个以阅读体验和视觉表达为核心的静态个人博客。项目使用原生 HTML、CSS 和 JavaScript 构建，无需安装依赖或执行打包命令；除博客主站外，还提供一个可在浏览器中管理文章、编排内容和实时预览的本地工作台。

## 功能特性

- 响应式博客首页，包含主视觉、文章瀑布流和关于页面
- 书本式文章阅读器，支持翻页、横排/竖排和多种字体
- 像素鸟、文字扰动等动态视觉效果
- 文章工作台：新建、编辑、删除、排序、搜索及草稿筛选
- 支持文本、图片、视频和模板等内容模块，并可拖拽排序
- 主站、工作台和独立预览页之间实时同步
- 将编辑结果导出为 `articles-data.js`，方便部署到纯静态托管平台
- 工作台访问密钥校验和手动锁定

## 技术栈

- HTML5
- CSS3
- Vanilla JavaScript
- [GSAP](https://gsap.com/)：页面动画
- [gl-matrix](https://glmatrix.net/)：图形计算
- `localStorage` 与 `BroadcastChannel`：本地保存及跨页面同步

## 项目结构

```text
Myblog/
├── index.html            # 博客主站
├── styles.css            # 主站样式
├── script.js             # 主站交互与文章阅读器
├── articles-data.js      # 可部署的文章数据
├── studio.html           # 文章管理工作台
├── studio.css            # 工作台及预览样式
├── studio.js             # 文章编辑、保存与导出逻辑
├── studio-auth.js        # 工作台访问校验
├── preview.html          # 独立文章预览页
├── preview.js            # 预览页逻辑
├── pixel-birds.js        # 像素鸟动画
├── text-shuffle.js       # 文字扰动效果
├── images/               # 文章图片资源
├── 字体/                  # 本地字体资源
└── *.png / *.gif / *.mp4 # 页面视觉素材
```

## 本地运行

项目没有构建步骤。建议通过本地 HTTP 服务运行，以确保访问密钥所用的 Web Crypto API、跨页面通信和媒体资源均能正常工作。

使用 Python：

```bash
python -m http.server 8000
```

或使用 Node.js：

```bash
npx serve .
```

启动后访问：

- 主站：<http://localhost:8000/index.html>
- 工作台：<http://localhost:8000/studio.html>
- 独立预览：<http://localhost:8000/preview.html>

端口可能因所用命令而不同。主站也可以直接打开 `index.html` 查看，但部分浏览器功能在 `file://` 环境下可能受限。

## 文章管理与发布

1. 打开 `studio.html`，输入站长访问密钥解锁工作台。
2. 新建或选择文章，编辑标题、分类、日期、摘要、封面和内容模块。
3. 使用工作台预览，或点击“单独预览”检查最终阅读效果。
4. 打开“发布”状态后，点击“发布到主站”。同源页面会通过本地存储实时读取最新数据。
5. 点击“导出 articles-data.js”，复制导出的完整内容并替换项目中的 `articles-data.js`。
6. 提交并部署更新后的静态文件，使修改对其他访客永久可见。

工作台中的编辑首先保存在当前浏览器的 `localStorage` 中，不会自动写回磁盘。清除浏览器站点数据会丢失尚未导出到 `articles-data.js` 的修改。

## 修改工作台访问密钥

访问密钥以 SHA-256 哈希形式保存在 `studio-auth.js` 中，同时 `script.js` 使用相同哈希判断主站是否读取工作台的本地数据。修改密钥时，需要生成新密钥的 SHA-256 值，并同步替换以下常量：

- `studio-auth.js` 中的 `OWNER_HASH`
- `script.js` 中的 `BLOG_COMPANION_OWNER_HASH`

可在浏览器控制台生成哈希：

```js
const bytes = new TextEncoder().encode('你的新密钥');
const hash = await crypto.subtle.digest('SHA-256', bytes);
console.log([...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''));
```

> 注意：这是纯前端静态项目，哈希和校验逻辑会随源码一起公开。该机制适合避免普通访客误入本地工作台，不等同于服务端身份认证，也不能保护敏感数据。

## 部署

整个目录可以直接部署至 GitHub Pages、Netlify、Cloudflare Pages、Vercel 或任意静态文件服务器。部署前请确认：

- 已将工作台中的最终文章数据导出并写入 `articles-data.js`
- 图片、字体、视频等资源路径保持相对路径可访问
- 站点允许访问外部 CDN 和 Google Fonts；若需完全离线运行，请将对应依赖下载到本地并修改引用
- 生产环境使用 HTTPS

## 浏览器支持

建议使用较新版本的 Chrome、Edge、Firefox 或 Safari。工作台依赖 `Web Crypto API`、`localStorage` 和 `BroadcastChannel`；在不支持 `BroadcastChannel` 的浏览器中，部分跨标签页实时同步体验可能受限。

## 许可证

当前仓库未声明开源许可证。除非项目所有者另行授权，否则请勿直接复制或分发其中的代码、文章及图片素材。
