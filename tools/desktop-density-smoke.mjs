import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.slice(1));
const candidates = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const browserPath = candidates.find((path) => path && existsSync(path));
if (!browserPath) throw new Error("Chrome or Edge was not found; set BROWSER_PATH.");

const pages = [
  "index.html",
  "profile.html",
  "diary.html",
  "notices.html",
  "hymn.html",
  "game.html",
  "redbean-breakout.html",
];
const auditPath = join(root, "dist", "__desktop-density.html");
const frames = pages
  .map((page) => `<iframe data-page="${page}" src="./${page}" style="width:1440px;height:900px"></iframe>`)
  .join("");
const auditHtml = `<!doctype html>
<meta charset="utf-8">
<style>iframe { display: block; border: 0; }</style>
${frames}
<pre id="result"></pre>
<script>
  const frames = [...document.querySelectorAll("iframe")];
  const waitForFrame = (frame) => new Promise((resolve) => {
    frame.addEventListener("load", () => setTimeout(resolve, 700), { once: true });
  });

  Promise.all(frames.map(waitForFrame)).then(() => {
    const result = frames.map((frame) => {
      const doc = frame.contentDocument;
      const header = doc.querySelector(".site-header");
      const canvas = doc.querySelector("canvas");

      return {
        page: frame.dataset.page,
        zoom: getComputedStyle(doc.body).zoom,
        scrollWidth: doc.documentElement.scrollWidth,
        clientWidth: doc.documentElement.clientWidth,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
        canvasRight: canvas ? Math.round(canvas.getBoundingClientRect().right) : null,
      };
    });

    document.querySelector("#result").textContent = JSON.stringify(result);
  });
<\/script>`;

try {
  await writeFile(auditPath, auditHtml);
  const run = spawnSync(
    browserPath,
    [
      "--headless=new",
      "--allow-file-access-from-files",
      "--disable-gpu",
      "--virtual-time-budget=4000",
      "--dump-dom",
      pathToFileURL(auditPath).href,
    ],
    { encoding: "utf8", maxBuffer: 10_000_000 },
  );
  if (run.status !== 0) throw new Error(run.stderr || "Desktop browser audit failed.");
  const encoded = run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
  if (!encoded) throw new Error("No desktop audit result returned.");
  const result = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  const expected = (page) => {
    if (page === "index.html") return { zoom: "1", header: 82 };
    if (["game.html", "redbean-breakout.html"].includes(page)) return { zoom: "0.9", header: 74 };
    return { zoom: "0.8", header: 66 };
  };
  const failures = result.filter((item) => {
    const density = expected(item.page);
    return item.zoom !== density.zoom
      || item.scrollWidth > item.clientWidth
      || item.headerHeight !== density.header
      || (item.canvasRight && item.canvasRight > 1440);
  });
  result.forEach((item) => {
    const status = failures.includes(item) ? "FAIL" : "PASS";
    console.log(`${status} ${item.page} zoom=${item.zoom} width=${item.scrollWidth}/${item.clientWidth}`);
  });
  if (failures.length) throw new Error(JSON.stringify(failures));
} finally {
  await rm(auditPath, { force: true });
}
