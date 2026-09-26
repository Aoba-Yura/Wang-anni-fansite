import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "src");
const pages = join(source, "pages");
const partials = join(source, "partials");
const games = join(source, "games");
const dist = join(root, "dist");
const beanlandRoot = join(games, "beanland-amusement-park");

const [beanlandIndex, beanlandConfig] = await Promise.all([
  readFile(join(beanlandRoot, "index.html"), "utf8"),
  readFile(join(beanlandRoot, "assets/js/config.js"), "utf8"),
]);
const beanlandVersion = beanlandConfig.match(/VERSION:\s*'([^']+)'/)?.[1];
const beanlandAssetVersions = [...beanlandIndex.matchAll(/[?&]v=([0-9.]+)/g)].map((match) => match[1]);
if (!beanlandVersion || !/^\d+\.\d+\.\d+$/.test(beanlandVersion)) {
  throw new Error("Beanland VERSION must use MAJOR.MINOR.PATCH format.");
}
if (!beanlandIndex.includes(`<title>豆城光辉游乐园 v${beanlandVersion}</title>`)
  || !beanlandIndex.includes(`<div class="version">v${beanlandVersion}</div>`)
  || beanlandAssetVersions.length !== 9
  || beanlandAssetVersions.some((version) => version !== beanlandVersion)) {
  throw new Error(`Beanland page, runtime, and asset versions must all match ${beanlandVersion}.`);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const header = await readFile(join(partials, "header.html"), "utf8");
const footer = await readFile(join(partials, "footer.html"), "utf8");
const noticeData = await readFile(join(source, "data/notices.json"), "utf8");
const noticeDataScript = `<script id="notice-data" type="application/json">${noticeData.replaceAll("<", "\\u003c")}</script>`;
const diaryKindData = await readFile(join(source, "data/diary-kinds.json"), "utf8");
const diaryKindDocument = JSON.parse(diaryKindData);
if (diaryKindDocument.schemaVersion !== 1 || !Array.isArray(diaryKindDocument.categories) || !diaryKindDocument.categories.length) {
  throw new Error("diary-kinds.json must contain schemaVersion 1 and at least one category.");
}
const diaryKindGroups = new Map();
diaryKindDocument.categories.forEach((category) => {
  if (!category.id || !category.label || !Array.isArray(category.kinds) || !category.kinds.length) throw new Error("Invalid diary category: " + (category.id || "unnamed"));
  category.kinds.forEach((kind) => {
    if (diaryKindGroups.has(kind)) throw new Error(`Diary kind "${kind}" belongs to both "${diaryKindGroups.get(kind)}" and "${category.id}".`);
    diaryKindGroups.set(kind, category.id);
  });
});
const diaryKindDataScript = `<script id="diary-kind-data" type="application/json">${diaryKindData.replaceAll("<", "\\u003c")}</script>`;
const hymnData = await readFile(join(source, "data/hymns.json"), "utf8");
const hymnDocument = JSON.parse(hymnData);
if (hymnDocument.schemaVersion !== 1 || !Array.isArray(hymnDocument.items) || !hymnDocument.items.length) {
  throw new Error("hymns.json must contain schemaVersion 1 and at least one item.");
}
const literaryIds = new Set();
hymnDocument.items.forEach((item) => {
  if (!item.id || literaryIds.has(item.id)) throw new Error("Missing or duplicate literary item id: " + item.id);
  literaryIds.add(item.id);
});
const poemsData = await readFile(join(source, "data/poems.json"), "utf8");
const poemsDocument = JSON.parse(poemsData);
if (poemsDocument.schemaVersion !== 1 || !Array.isArray(poemsDocument.items) || !poemsDocument.items.length) {
  throw new Error("poems.json must contain schemaVersion 1 and at least one item.");
}
const poemIds = new Set();
poemsDocument.items.forEach((poem) => {
  const hasValidText = Array.isArray(poem.text)
    && poem.text.length === 3
    && poem.text.every((line) => String(line).trim());
  const isValid = poem.id
    && !poemIds.has(poem.id)
    && ["haiku", "senryu"].includes(poem.type)
    && hasValidText;
  if (!isValid) {
    throw new Error(`Invalid poem: ${poem.id || "unnamed"}.`);
  }
  poemIds.add(poem.id);
});
const tanzakuCharacters = poemsDocument.items
  .flatMap((poem) => [...poem.text, poem.title || ""])
  .join("") + "安妮俳句川柳縁";
const weiboArchive = JSON.parse(await readFile(join(source, "data/weibo.json"), "utf8"));
const bilibiliArchive = JSON.parse(await readFile(join(source, "data/bilibili.json"), "utf8"));
const diaryById = Object.fromEntries(
  [...weiboArchive.records, ...bilibiliArchive.records]
    .filter((record) => record.display)
    .map((record) => [record.id, {
      id: record.id,
      date: record.display.date,
      platform: record.display.platform,
      excerpt: record.display.excerpt,
      note: record.display.note,
      title: record.display.title,
      url: record.display.source,
    }])
);
poemsDocument.items.forEach((poem) => {
  if (poem.source_id && !diaryById[poem.source_id]) console.warn(`[Tanzaku] Missing diary source: ${poem.source_id}`);
});
const referencedDiaryById = Object.fromEntries(
  poemsDocument.items
    .filter((poem) => poem.source_id && diaryById[poem.source_id])
    .map((poem) => [poem.source_id, diaryById[poem.source_id]])
);
const tanzakuData = JSON.stringify({
  poems: poemsDocument.items,
  diaryById: referencedDiaryById,
}).replaceAll("<", "\\u003c");
const tanzakuDataScript = `<script id="tanzaku-data" type="application/json">${tanzakuData}</script>`;
const redbeanLevelData = await readFile(join(source, "data/redbean-levels.json"), "utf8");
const redbeanLevelDocument = JSON.parse(redbeanLevelData);
const redbeanPatterns = new Set(["full", "stripes", "steps", "gates", "diamond", "ring", "tunnel", "checker", "fortress", "heart", "zigzag", "shield", "pinwheel", "core", "final"]);
if (redbeanLevelDocument.schemaVersion !== 1 || !Array.isArray(redbeanLevelDocument.levels) || redbeanLevelDocument.levels.length !== 18) {
  throw new Error("redbean-levels.json must contain schemaVersion 1 and exactly 18 levels.");
}
redbeanLevelDocument.levels.forEach((level, index) => {
  const validNumbers = ["rows", "cols", "mobileCols", "speed", "powerEvery"]
    .every((key) => Number.isFinite(level[key]) && level[key] > 0);
  if (!level.name || !validNumbers || !redbeanPatterns.has(level.pattern)) {
    throw new Error("Invalid redbean level at index " + index + ".");
  }
});
const redbeanLevelDataScript = '<script id="redbean-level-data" type="application/json">' + redbeanLevelData.replaceAll("<", "\\u003c") + "</script>";
const hymnDataScript = `<script id="hymn-data" type="application/json">${hymnData.replaceAll("<", "\\u003c")}</script>`;

const navigation = [
  { href: "index.html", label: "首页", japanese: "ホーム", mobileLabel: "首页", mobileJapanese: "ホーム", icon: "⌂" },
  { href: "profile.html", label: "人物档案", japanese: "プロフィール", mobileLabel: "档案", mobileJapanese: "プロフィール", icon: "✦", artwork: "assets/images/anni_6th_anniversary.svg" },
  { href: "diary.html", label: "安妮日常", japanese: "ダイアリー", mobileLabel: "日常", mobileJapanese: "ダイアリー", icon: "✎" },
  { href: "notices.html", label: "公告栏", japanese: "お知らせ", mobileLabel: "公告", mobileJapanese: "お知らせ", icon: "♡" },
  { href: "hymn.html", label: "安妮颂", japanese: "賛歌", mobileLabel: "安妮颂", mobileJapanese: "賛歌", icon: "✿" },
  { href: "game.html", label: "小游戏", japanese: "ミニゲーム", mobileLabel: "游戏", mobileJapanese: "ミニゲーム", icon: "▦" },
];

function renderHeader(file) {
  const activeFile = file === "redbean-breakout.html" ? "game.html" : file;
  const desktopNav = file === "index.html"
    ? ""
    : `  <nav class="desktop-nav" aria-label="主导航 / メインナビゲーション">${navigation.map(({ href, label, japanese }) => {
        const current = href === activeFile ? ' class="active" aria-current="page"' : "";
        return `<a${current} href="./${href}"><span>${label}</span><small lang="ja">${japanese}</small></a>`;
      }).join("")}</nav>`;

  return header
    .replace("{{HOME_HEADER_CLASS}}", file === "index.html" ? " home-header" : "")
    .replace("{{DESKTOP_NAV}}", desktopNav);
}

function renderMobileNav(file) {
  const activeFile = file === "redbean-breakout.html" ? "game.html" : file;
  return `<nav class="mobile-nav" aria-label="手机端主导航 / モバイルナビゲーション">${navigation.map(({ href, mobileLabel, mobileJapanese, icon }) => {
    const current = href === activeFile ? ' class="active" aria-current="page"' : "";
    return `<a${current} href="./${href}"><b aria-hidden="true">${icon}</b><span>${mobileLabel}<small lang="ja">${mobileJapanese}</small></span></a>`;
  }).join("")}</nav>`;
}

function renderHomeNav() {
  return navigation.slice(1).map(({ href, label, japanese, artwork }, index) => {
    const cardClass = href.replace(".html", "");
    const artworkSlot = artwork
      ? `<span class="bento-artwork" aria-hidden="true"><img src="./${artwork}" width="1448" height="1086" alt="" loading="lazy" decoding="async"></span>`
      : "";
    return `<a class="bento-card bento-${cardClass}" href="./${href}"><span>${String(index + 1).padStart(2, "0")}</span>${artworkSlot}<div><small lang="ja">${japanese}</small><strong>${label}</strong></div><b>↗</b></a>`;
  }).join("\n      ");
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
    .replaceAll("./data/weibo.json", "./data/weibo.json")
    .replaceAll("<!-- SITE_HEADER -->", renderHeader(file))
    .replaceAll("<!-- SITE_FOOTER -->", footer)
    .replaceAll("<!-- MOBILE_NAV -->", file === "index.html" ? "" : renderMobileNav(file))
    .replaceAll("<!-- HOME_NAV -->", file === "index.html" ? renderHomeNav() : "")
    .replaceAll("../vendor/motion.js", "./motion.js")
    .replaceAll("<!-- DIARY_DATA -->", "")
    .replaceAll("<!-- DIARY_KIND_DATA -->", file === "diary.html" ? diaryKindDataScript : "")
    .replaceAll("<!-- NOTICE_DATA -->", file === "notices.html" ? noticeDataScript : "")
    .replaceAll("<!-- HYMN_DATA -->", file === "hymn.html" ? hymnDataScript : "")
    .replaceAll("<!-- TANZAKU_DATA -->", file === "hymn.html" ? tanzakuDataScript : "")
    .replaceAll("<!-- REDBEAN_LEVEL_DATA -->", file === "redbean-breakout.html" ? redbeanLevelDataScript : "");
  await writeFile(join(dist, file), html);
}

const stylesheet = await readFile(join(source, "styles/main.css"), "utf8");
await writeFile(join(dist, "styles.css"), stylesheet.replaceAll("../assets/", "./assets/"));
await cp(join(source, "styles/game.css"), join(dist, "game.css"));
const mainScript = await readFile(join(source, "scripts/main.js"), "utf8");
await writeFile(join(dist, "script.js"), mainScript
  .replaceAll("../data/weibo.json", "./data/weibo.json")
  .replaceAll("../data/bilibili.json", "./data/bilibili.json"));
await cp(join(source, "scripts/game.js"), join(dist, "game.js"));
await cp(join(root, "node_modules/framer-motion/dist/dom-mini.js"), join(dist, "motion.js"));
await cp(join(source, "assets/icons/favicon.svg"), join(dist, "favicon.svg"));
await cp(join(source, "assets"), join(dist, "assets"), { recursive: true });
await cp(join(source, "data"), join(dist, "data"), { recursive: true });
await cp(games, join(dist, "games"), { recursive: true });

// These source assets are retained for rebuilding or archival work, but no
// published page references them. Keep them out of the deploy payload.
await Promise.all([
  "assets/fonts/yuji-syuku/YujiSyuku-Regular.woff2",
  "assets/fonts/ma-shan-zheng/MaShanZheng-Regular.woff2",
  "assets/images/wang-anni-profile.png",
  "assets/images/profile.svg",
].map((relativePath) => rm(join(dist, relativePath), { force: true })));

const tanzakuFontSources = [
  ["yuji-syuku", "YujiSyuku-Regular.woff2", "YujiSyuku-Tanzaku.woff2"],
  ["ma-shan-zheng", "MaShanZheng-Regular.woff2", "MaShanZheng-Tanzaku.woff2"],
];
await Promise.all(tanzakuFontSources.map(async ([directory, sourceName, outputName]) => {
  const font = await readFile(join(source, "assets/fonts", directory, sourceName));
  const subset = await subsetFont(font, tanzakuCharacters, { targetFormat: "woff2" });
  await writeFile(join(dist, "assets/fonts", directory, outputName), subset);
}));

// Keep the complete Weibo archive in Git, but publish only fields the page may read.
const visibleWeiboRecords = weiboArchive.records.filter((record) => record.display);
const addDiaryKindGroup = (record) => {
  const kindGroup = diaryKindGroups.get(record.display.kind);
  if (!kindGroup) throw new Error(`Unclassified diary kind "${record.display.kind}" in record "${record.id}".`);
  return { id: record.id, display: { ...record.display, kindGroup } };
};
const weiboStats = {
  total: weiboArchive.records.length,
  visible: visibleWeiboRecords.length,
  hidden: weiboArchive.records.length - visibleWeiboRecords.length,
};
const publicWeibo = {
  schema_version: weiboArchive.schema_version,
  records: visibleWeiboRecords
    .map(addDiaryKindGroup),
};
await writeFile(join(dist, "data/weibo.json"), JSON.stringify(publicWeibo));
console.log(`Weibo archive: ${weiboStats.total} total, ${weiboStats.visible} visible, ${weiboStats.hidden} hidden`);

const visibleBilibiliRecords = bilibiliArchive.records.filter((record) => record.display);
const bilibiliStats = {
  total: bilibiliArchive.records.length,
  visible: visibleBilibiliRecords.length,
  hidden: bilibiliArchive.records.length - visibleBilibiliRecords.length,
};
const publicBilibili = {
  schema_version: bilibiliArchive.schema_version,
  records: visibleBilibiliRecords.map(addDiaryKindGroup),
};
await writeFile(join(dist, "data/bilibili.json"), JSON.stringify(publicBilibili));
console.log(`Bilibili archive: ${bilibiliStats.total} total, ${bilibiliStats.visible} visible, ${bilibiliStats.hidden} hidden`);

console.log(`Built ${await readdir(dist).then(files => files.length)} files in dist/`);
console.log(`Beanland game: v${beanlandVersion}`);
