# 王安妮应援信息站

一个中日双语的王安妮非官方粉丝信息站。

## 项目结构

```text
src/
├─ pages/       页面源码
├─ partials/     构建时注入的共享片段
├─ styles/      样式源码
├─ scripts/     交互脚本
├─ assets/      图片、图标、字体等静态资源
└─ data/        人物资料与日常动态数据
dist/           GitHub Pages / Sites 发布文件
tools/          构建脚本
.github/        GitHub Actions 自动发布配置
```

## 本地构建

需要 Node.js 24 LTS。运行：

```bash
npm run build
```

构建脚本会把 `src/` 中的源码整理为可直接部署的 `dist/`。

本地预览必须通过 HTTP 打开，不能直接双击 `dist/*.html`，否则浏览器会阻止页面读取 JSON：

```bash
npm run preview
```

然后访问 `http://127.0.0.1:4173/diary.html`。

项目已经附带 GitHub Actions 自动发布配置。请在仓库的 **Settings → Pages** 中把发布来源设为 **GitHub Actions**。此后每次推送到 `main`，工作流会使用 Node.js 24 LTS 构建并检查脚本，然后自动发布 `dist/`；也可在 **Actions** 页面手动运行。

## 内容约定

- `src/pages/` 保持页面结构与可读文案。
- `src/styles/` 维护全站视觉系统与响应式规则。
- `src/scripts/` 维护主题切换、日常筛选、文学栏目切换、色值复制和应援按钮等交互。
- `src/assets/` 只放可复用的本地资源；外部官方图片和官方链接在页面中注明来源。
- `src/data/weibo.json` 与 `src/data/bilibili.json` 分别保存微博、B 站资料的结构化底稿。

本网站为粉丝创作与公开资料整理项目，人物资料与原始动态请以王安妮及 TSH48 官方渠道为准。
