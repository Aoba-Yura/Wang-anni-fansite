# 王安妮应援信息站

一个中日双语的王安妮非官方粉丝信息站。

## 项目结构

```text
src/
├─ pages/       页面源码
├─ partials/     构建时注入的共享片段
├─ styles/      样式源码
├─ scripts/     交互脚本
├─ games/       独立小游戏及其私有资源
├─ assets/      图片、图标、字体等静态资源
└─ data/        人物资料与日常动态数据
dist/           本地构建与预览文件（不提交）
docs/           GitHub Pages 发布文件（提交到 main）
tools/          构建脚本
```

## 本地构建

需要 Node.js 24 LTS。运行：

```bash
npm run build
```

构建脚本会把 `src/` 中的源码整理为可直接预览的 `dist/`。

本地预览必须通过 HTTP 打开，不能直接双击 `dist/*.html`，否则浏览器会阻止页面读取 JSON：

```bash
npm run preview
```

然后访问 `http://127.0.0.1:4173/diary.html`。

## 发布到 GitHub Pages

GitHub Actions 不参与网站构建。准备发布版本时，在本地运行：

```bash
npm run build:pages
```

该命令会重新生成可直接发布的 `docs/`，并把仓库根目录的 `CNAME` 复制到发布目录。请将源码变更与 `docs/` 一起提交并推送到 `main`。

首次切换发布方式时，请在仓库的 **Settings → Pages** 中选择 **Deploy from a branch**，分支选择 `main`，目录选择 `/docs`，然后保存。此后 GitHub Pages 会直接发布已经在本地编译完成的静态文件，不再依赖项目的自定义 Actions 工作流。

## 小游戏版本约定

独立小游戏采用 `主版本.次版本.修订版本` 格式。破坏兼容的规则重做提升主版本，新增玩法提升次版本，平衡与错误修复提升修订版本。游戏页面展示、运行时常量和静态资源缓存参数必须使用同一版本；构建脚本会自动检查一致性。

独立小游戏统一放在 `src/games/<slug>/`，必须能够从自身的 `index.html` 启动，并只使用目录内的相对资源。站点构建会原样复制整个 `src/games/`，游戏大厅通过 `./games/<slug>/index.html` 进入；全局样式和脚本不得注入独立游戏。新增游戏还需在 `src/pages/game.html` 添加入口卡片，并纳入 `tools/build.mjs` 的版本一致性校验。CI 会自动语法检查所有独立游戏的 JavaScript。

## 内容约定

- `src/pages/` 保持页面结构与可读文案。
- `src/styles/` 维护全站视觉系统与响应式规则。
- `src/scripts/` 维护主题切换、日常筛选、文学栏目切换、色值复制和应援按钮等交互。
- `src/assets/` 只放可复用的本地资源；外部官方图片和官方链接在页面中注明来源。
- `src/data/weibo.json` 与 `src/data/bilibili.json` 分别保存微博、B 站资料的结构化底稿。

本网站为粉丝创作与公开资料整理项目，人物资料与原始动态请以王安妮及 TSH48 官方渠道为准。
