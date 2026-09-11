import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "src");
const pages = join(source, "pages");
const partials = join(source, "partials");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const header = await readFile(join(partials, "header.html"), "utf8");
const footer = await readFile(join(partials, "footer.html"), "utf8");
const diaryData = await readFile(join(source, "data/diary.json"), "utf8");
const diaryDataScript = `<script id="diary-data" type="application/json">${diaryData.replaceAll("<", "\\u003c")}</script>`;
const noticeData = await readFile(join(source, "data/notices.json"), "utf8");
const noticeDataScript = `<script id="notice-data" type="application/json">${noticeData.replaceAll("<", "\\u003c")}</script>`;

const navigation = [
  ["index.html", "首页"],
  ["profile.html", "人物档案"],
  ["diary.html", "安妮日志"],
  ["notices.html", "お知らせ"],
  ["hymn.html", "安妮颂"],
  ["game.html", "小游戏"],
];

function renderHeader(file) {
  const activeFile = file === "redbean-breakout.html" ? "game.html" : file;
  const desktopNav = file === "index.html"
    ? ""
    : `  <nav class="desktop-nav" aria-label="主导航">${navigation.map(([href, label]) => {
        const current = href === activeFile ? ' class="active" aria-current="page"' : "";
        return `<a${current} href="./${href}">${label}</a>`;
      }).join("")}</nav>`;

  return header
    .replace("{{HOME_HEADER_CLASS}}", file === "index.html" ? " home-header" : "")
    .replace("{{DESKTOP_NAV}}", desktopNav);
}

for (const file of await readdir(pages)) {
  if (!file.endsWith(".html")) continue;
  let html = await readFile(join(pages, file), "utf8");
  html = html
    .replaceAll("../assets/icons/favicon.svg", "./favicon.svg")
    .replaceAll("../assets/", "./assets/")
    .replaceAll("../styles/main.css", "./styles.css")
    .replaceAll("../styles/game.css", "./game.css")
    .replaceAll("../scripts/main.js", "./script.js")
    .replaceAll("../scripts/game.js", "./game.js")
    .replaceAll("./data/diary.json", "./data/diary.json")
    .replaceAll("<!-- SITE_HEADER -->", renderHeader(file))
    .replaceAll("<!-- SITE_FOOTER -->", footer)
    .replaceAll("<!-- DIARY_DATA -->", file === "diary.html" ? diaryDataScript : "")
    .replaceAll("<!-- NOTICE_DATA -->", file === "notices.html" ? noticeDataScript : "");
  await writeFile(join(dist, file), html);
}

const stylesheet = await readFile(join(source, "styles/main.css"), "utf8");
await writeFile(join(dist, "styles.css"), stylesheet.replaceAll("../assets/", "./assets/"));
await cp(join(source, "styles/game.css"), join(dist, "game.css"));
await cp(join(source, "scripts/main.js"), join(dist, "script.js"));
await cp(join(source, "scripts/game.js"), join(dist, "game.js"));
await cp(join(source, "assets/icons/favicon.svg"), join(dist, "favicon.svg"));
await cp(join(source, "assets"), join(dist, "assets"), { recursive: true });
await cp(join(source, "data"), join(dist, "data"), { recursive: true });

console.log(`Built ${await readdir(dist).then(files => files.length)} files in dist/`);
