# 独立小游戏集成规范

每款游戏使用一个稳定的短目录名，并保持以下最小结构：

```text
src/games/<slug>/
├─ index.html
├─ game.js
├─ styles.css
└─ assets/
```

- `index.html` 是唯一入口，所有资源使用相对路径，不依赖站点全局 CSS 或 JavaScript。
- 游戏应适配触屏、鼠标、视口安全区以及页面可见性变化。
- 版本采用 `MAJOR.MINOR.PATCH`，页面显示、运行时常量和资源缓存参数保持一致。
- 持久化数据使用带游戏前缀的 `localStorage` 键，升级时不要无故清除玩家进度。
- 主构建原样复制 `src/games/` 到 `dist/games/`，并校验版本；CI 语法检查其中的全部 JavaScript。
- 游戏大厅入口统一添加在 `src/pages/game.html`，封面优先复用游戏私有资源，避免重复文件。
