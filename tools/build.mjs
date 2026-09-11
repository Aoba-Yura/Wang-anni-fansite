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
const noticeData = await readFile(join(source, "data/notices.json"), "utf8");
const noticeDataScript = `<script id="notice-data" type="application/json">${noticeData.replaceAll("<", "\\u003c")}</script>`;
const hymnData = await readFile(join(source, "data/hymns.json"), "utf8");
const hymnDataScript = `<script id="hymn-data" type="application/json">${hymnData.replaceAll("<", "\\u003c")}</script>`;

const navigation = [
  ["index.html", "首页", "ホーム"],
  ["profile.html", "人物档案", "プロフィール"],
  ["diary.html", "安妮日常", "日常"],
  ["notices.html", "公告栏", "お知らせ"],
  ["hymn.html", "安妮颂", "賛歌"],
  ["game.html", "小游戏", "ミニゲーム"],
];

function renderHeader(file) {
  const activeFile = file === "redbean-breakout.html" ? "game.html" : file;
  const desktopNav = file === "index.html"
    ? ""
    : `  <nav class="desktop-nav" aria-label="主导航 / メインナビゲーション">${navigation.map(([href, label, japanese]) => {
        const current = href === activeFile ? ' class="active" aria-current="page"' : "";
        return `<a${current} href="./${href}"><span>${label}</span><small lang="ja">${japanese}</small></a>`;
      }).join("")}</nav>`;

  return header
    .replace("{{HOME_HEADER_CLASS}}", file === "index.html" ? " home-header" : "")
    .replace("{{DESKTOP_NAV}}", desktopNav);
}

function renderMobileLabels(html) {
  const labels = [["首页", "ホーム"], ["档案", "人物"], ["日常", "日常"], ["公告", "告知"], ["安妮颂", "賛歌"], ["游戏", "遊ぶ"]];
  return html.replace(/<nav class="mobile-nav"[\s\S]*?<\/nav>/g, (navigationHtml) => labels.reduce((output, [chinese, japanese]) => output.replaceAll(`<span>${chinese}</span>`, `<span>${chinese}<small lang="ja">${japanese}</small></span>`), navigationHtml).replace('aria-label="手机端主导航"', 'aria-label="手机端主导航 / モバイルナビゲーション"'));
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
    .replaceAll("<!-- DIARY_DATA -->", "")
    .replaceAll("<!-- NOTICE_DATA -->", file === "notices.html" ? noticeDataScript : "")
    .replaceAll("<!-- HYMN_DATA -->", file === "hymn.html" ? hymnDataScript : "");
  html = renderMobileLabels(html);
  await writeFile(join(dist, file), html);
}

const stylesheet = await readFile(join(source, "styles/main.css"), "utf8");
await writeFile(join(dist, "styles.css"), stylesheet.replaceAll("../assets/", "./assets/"));
await cp(join(source, "styles/game.css"), join(dist, "game.css"));
const mainScript = await readFile(join(source, "scripts/main.js"), "utf8");
await writeFile(join(dist, "script.js"), mainScript.replaceAll("../data/diary.json", "./data/diary.json"));
await cp(join(source, "scripts/game.js"), join(dist, "game.js"));
await cp(join(source, "assets/icons/favicon.svg"), join(dist, "favicon.svg"));
await cp(join(source, "assets"), join(dist, "assets"), { recursive: true });
await cp(join(source, "data"), join(dist, "data"), { recursive: true });

// Keep the complete Weibo archive in Git, but publish only fields the page may read.
const diaryArchive = JSON.parse(await readFile(join(source, "data/diary.json"), "utf8"));
const publicDiary = {
  schema_version: diaryArchive.schema_version,
  generated_at: diaryArchive.generated_at,
  display_total: diaryArchive.records.filter((record) => record.display).length,
  records: diaryArchive.records
    .filter((record) => record.display)
    .map((record) => ({ id: record.id, display: record.display })),
};
await writeFile(join(dist, "data/diary.json"), JSON.stringify(publicDiary));

console.log(`Built ${await readdir(dist).then(files => files.length)} files in dist/`);
